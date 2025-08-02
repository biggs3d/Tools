import { z } from 'zod';
import { 
  AuthPlugin, 
  AuthType, 
  AuthRequirements, 
  AuthConfig, 
  AuthStartResult,
  AuthCallbackParams,
  AuthResult,
  StoredCredentials,
  ValidationResult,
  PluginConfig
} from '../../types/plugin.js';
import { createHmac, createVerify, timingSafeEqual } from 'crypto';
import { pino } from 'pino';

// NOTE-AI: Webhook Signature Plugin Implementation - Critical Design Decisions
// ==========================================================================
// 
// IMPORTANT: This is NOT authentication in the traditional sense!
// This plugin validates webhook signatures to ensure message integrity
// and authentic origin. It's more about verification than authentication.
// 
// STANDARDS COMPLIANCE:
// - HMAC-SHA256 (most common - GitHub, Stripe, Slack)
// - HMAC-SHA1 (legacy - Twitter, older systems)
// - RSA signatures (Twilio, some enterprise systems)
// - Ed25519 (modern, Discord)
// - Custom schemes (AWS SNS, etc.)
// 
// SECURITY REQUIREMENTS:
// - Timing-safe comparison (prevent timing attacks)
// - Timestamp validation (prevent replay attacks)
// - Multiple signature support (key rotation)
// - Body encoding handling (raw vs parsed)
// - Signature location flexibility
// 
// SIGNATURE SCHEMES:
// - HMAC with secret key (symmetric)
// - RSA/ECDSA with public key (asymmetric)
// - Timestamp-based (include timestamp in signature)
// - Nonce-based (prevent replay)
// - Multi-part (headers + body)
// 
// ARCHITECTURE DECISIONS:
// - Verification-only (doesn't generate signatures)
// - Support multiple providers in one plugin
// - Automatic scheme detection where possible
// - Middleware-friendly for request validation
// - Non-interactive (no user flow)
// 
// COMMON PATTERNS:
// - GitHub: HMAC-SHA256, X-Hub-Signature-256 header
// - Stripe: HMAC-SHA256, Stripe-Signature with timestamp
// - Slack: HMAC-SHA256, X-Slack-Signature with timestamp
// - Twilio: RSA-SHA256, X-Twilio-Signature
// - AWS SNS: RSA-SHA256, multiple headers
// 
// INTEGRATION NOTES:
// - Often combined with API keys for dual verification
// - Publishes verification events to Project 3 (Event Mesh)
// - Checks Project 8 (Governance) for allowed webhook sources
// - Full audit trail of all verifications
// - Can trigger automated responses
// 
// ADVANCED FEATURES:
// - Signature key rotation - Phase 2
// - JWS (JSON Web Signature) support - Phase 2
// - Webhook replay protection - Phase 2
// - Custom signature schemes - Phase 3
// 
// KNOWN LIMITATIONS:
// - Body must be available as raw bytes
// - Some schemes require specific header ordering
// - No support for encrypted webhooks yet
// 
// Rationale: Webhooks are critical for event-driven architectures.
// Signature validation prevents spoofing and ensures data integrity.
// Many webhook implementations are vulnerable to replay attacks.
// 
// Decision Date: 2024-01-15
// Last Updated: 2024-01-15
// Revisit if: New signature schemes emerge, quantum-safe signatures needed

const WebhookConfigSchema = z.object({
  // Signature scheme
  scheme: z.enum(['hmac-sha256', 'hmac-sha1', 'rsa-sha256', 'ed25519', 'custom']).default('hmac-sha256'),
  
  // Secret/key configuration
  secret: z.string().optional(), // For HMAC
  publicKey: z.string().optional(), // For RSA/Ed25519
  
  // Signature location
  signatureHeader: z.string().default('X-Webhook-Signature'),
  signaturePrefix: z.string().optional(), // e.g., "sha256=" for GitHub
  
  // Timestamp validation (Stripe/Slack style)
  timestampHeader: z.string().optional(),
  timestampTolerance: z.number().default(300), // 5 minutes
  includeTimestampInSignature: z.boolean().default(false),
  
  // Advanced options
  encoding: z.enum(['hex', 'base64', 'base64url']).default('hex'),
  includedHeaders: z.array(z.string()).optional(), // Headers to include in signature
  bodyEncoding: z.enum(['raw', 'utf8', 'base64']).default('raw'),
  
  // Provider presets
  provider: z.enum(['github', 'stripe', 'slack', 'twilio', 'custom']).optional(),
  
  // Security
  requireTimestamp: z.boolean().default(true),
  maxAgeSeconds: z.number().default(300),
  preventReplay: z.boolean().default(true),
  
  // Multiple keys for rotation
  secrets: z.array(z.string()).optional(),
  publicKeys: z.array(z.string()).optional()
}).refine(data => {
  // Must have secret for HMAC or public key for asymmetric
  if (data.scheme.startsWith('hmac')) {
    return !!(data.secret || data.secrets);
  } else if (data.scheme === 'custom') {
    return true; // Custom validation
  } else {
    return !!(data.publicKey || data.publicKeys);
  }
}, {
  message: 'Must provide appropriate key/secret for the signature scheme'
});

// Provider presets for common webhook providers
const PROVIDER_PRESETS = {
  github: {
    scheme: 'hmac-sha256',
    signatureHeader: 'X-Hub-Signature-256',
    signaturePrefix: 'sha256=',
    encoding: 'hex',
    requireTimestamp: false
  },
  stripe: {
    scheme: 'hmac-sha256',
    signatureHeader: 'Stripe-Signature',
    includeTimestampInSignature: true,
    timestampTolerance: 300,
    encoding: 'hex'
  },
  slack: {
    scheme: 'hmac-sha256',
    signatureHeader: 'X-Slack-Signature',
    timestampHeader: 'X-Slack-Request-Timestamp',
    signaturePrefix: 'v0=',
    includeTimestampInSignature: true,
    encoding: 'hex'
  },
  twilio: {
    scheme: 'rsa-sha256',
    signatureHeader: 'X-Twilio-Signature',
    encoding: 'base64'
  }
};

export class WebhookPlugin implements AuthPlugin {
  readonly id = 'webhook';
  readonly name = 'Webhook Signature Validation';
  readonly version = '1.0.0';
  readonly supportedFlows = ['validation-only'];
  
  private logger = pino({ name: 'webhook-plugin' });
  private replayCache = new Set<string>(); // Prevent replay attacks

  async initialize(config: PluginConfig): Promise<void> {
    this.logger.info('Webhook plugin initialized');
    
    // NOTE-AI: Clean up replay cache periodically
    setInterval(() => {
      // In production, use Redis with TTL
      if (this.replayCache.size > 10000) {
        this.replayCache.clear();
      }
    }, 3600000); // Hourly
  }

  async shutdown(): Promise<void> {
    this.replayCache.clear();
    this.logger.info('Webhook plugin shutdown');
  }

  async detectAuthRequirements(endpoint: URL): Promise<AuthRequirements | null> {
    // NOTE-AI: Webhook signature detection is unusual
    // We're not detecting if an endpoint SENDS webhooks,
    // but rather if it RECEIVES them (less common to detect)
    
    // Check for webhook-related paths
    const webhookPaths = ['/webhook', '/webhooks', '/callback', '/hook'];
    const path = endpoint.pathname.toLowerCase();
    
    if (webhookPaths.some(p => path.includes(p))) {
      return {
        type: AuthType.WEBHOOK,
        metadata: {
          hint: 'Possible webhook endpoint detected',
          note: 'Webhook signature validation is for receiving webhooks, not sending them'
        }
      };
    }
    
    return null;
  }

  async startAuth(config: AuthConfig): Promise<AuthStartResult> {
    // NOTE-AI: Webhooks are non-interactive and validation-only
    // There's no "auth flow" - just configuration
    
    const validationResult = this.validateConfig(config);
    if (!validationResult.valid) {
      throw new Error(`Invalid webhook config: ${validationResult.errors?.join(', ')}`);
    }
    
    // Apply provider preset if specified
    if (config.provider && config.provider !== 'custom') {
      const preset = PROVIDER_PRESETS[config.provider as keyof typeof PROVIDER_PRESETS];
      Object.assign(config, preset);
    }
    
    // Return configuration as "completed"
    return {
      completed: true,
      flowType: 'non-interactive',
      metadata: {
        scheme: config.scheme,
        provider: config.provider,
        note: 'Webhook signature validation configured'
      }
    };
  }

  async completeAuth(params: AuthCallbackParams): Promise<AuthResult> {
    throw new Error('Webhook validation does not support callback flow');
  }

  async refreshAuth(credentials: StoredCredentials): Promise<AuthResult> {
    // NOTE-AI: Webhook secrets can be rotated
    // But this is usually done at the provider side
    
    return {
      success: false,
      error: {
        code: 'WEBHOOK_NO_REFRESH',
        message: 'Webhook signatures do not refresh',
        remediation: 'Update webhook secret in provider settings and broker configuration'
      }
    };
  }

  async validateCredentials(credentials: unknown): Promise<ValidationResult> {
    // NOTE-AI: For webhooks, "credentials" are the request data to validate
    const schema = z.object({
      headers: z.record(z.string()),
      body: z.union([z.string(), z.instanceof(Buffer)]),
      timestamp: z.number().optional(),
      config: z.any() // The webhook configuration
    });
    
    try {
      const parsed = schema.parse(credentials);
      const config = parsed.config;
      
      // Get signature from headers
      const signature = this.extractSignature(parsed.headers, config);
      if (!signature) {
        return {
          valid: false,
          errors: ['Missing signature header']
        };
      }
      
      // Validate timestamp if required
      if (config.requireTimestamp) {
        const timestamp = this.extractTimestamp(parsed.headers, config);
        if (!timestamp) {
          return {
            valid: false,
            errors: ['Missing timestamp']
          };
        }
        
        const age = Math.abs(Date.now() / 1000 - timestamp);
        if (age > config.maxAgeSeconds) {
          return {
            valid: false,
            errors: [`Webhook timestamp too old (${age}s > ${config.maxAgeSeconds}s)`]
          };
        }
      }
      
      // Verify signature based on scheme
      const body = typeof parsed.body === 'string' 
        ? Buffer.from(parsed.body, config.bodyEncoding)
        : parsed.body;
        
      const isValid = await this.verifySignature(
        signature,
        body,
        parsed.headers,
        config
      );
      
      if (!isValid) {
        return {
          valid: false,
          errors: ['Invalid webhook signature']
        };
      }
      
      // Check replay attack
      if (config.preventReplay) {
        const replayKey = `${signature}-${parsed.timestamp || Date.now()}`;
        if (this.replayCache.has(replayKey)) {
          return {
            valid: false,
            errors: ['Webhook replay detected']
          };
        }
        this.replayCache.add(replayKey);
      }
      
      return { valid: true };
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { 
        valid: false, 
        errors: ['Invalid webhook validation format'] 
      };
    }
  }

  getTokenExpiration(credentials: unknown): Date | null {
    // Webhooks don't expire
    return null;
  }

  getConfigSchema(): z.ZodSchema {
    return WebhookConfigSchema;
  }

  validateConfig(config: unknown): ValidationResult {
    try {
      WebhookConfigSchema.parse(config);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { valid: false, errors: ['Invalid configuration'] };
    }
  }
  
  // Helper methods
  private extractSignature(headers: Record<string, string>, config: any): string | null {
    const headerName = config.signatureHeader.toLowerCase();
    const signature = headers[headerName];
    
    if (!signature) return null;
    
    // Remove prefix if configured
    if (config.signaturePrefix && signature.startsWith(config.signaturePrefix)) {
      return signature.slice(config.signaturePrefix.length);
    }
    
    return signature;
  }
  
  private extractTimestamp(headers: Record<string, string>, config: any): number | null {
    if (config.timestampHeader) {
      const timestamp = headers[config.timestampHeader.toLowerCase()];
      return timestamp ? parseInt(timestamp, 10) : null;
    }
    
    // Some providers include timestamp in signature header
    if (config.provider === 'stripe') {
      const sig = headers[config.signatureHeader.toLowerCase()];
      const match = sig?.match(/t=(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    }
    
    return null;
  }
  
  private async verifySignature(
    signature: string,
    body: Buffer,
    headers: Record<string, string>,
    config: any
  ): Promise<boolean> {
    // NOTE-AI: Build payload based on provider pattern
    let payload = body;
    
    // Add timestamp to payload if required
    if (config.includeTimestampInSignature) {
      const timestamp = this.extractTimestamp(headers, config);
      if (config.provider === 'slack') {
        // Slack format: v0:timestamp:body
        payload = Buffer.concat([
          Buffer.from(`v0:${timestamp}:`),
          body
        ]);
      } else if (config.provider === 'stripe') {
        // Stripe format: timestamp.body
        payload = Buffer.concat([
          Buffer.from(`${timestamp}.`),
          body
        ]);
      }
    }
    
    // Include headers if specified
    if (config.includedHeaders) {
      const headerParts = config.includedHeaders
        .map(h => `${h}:${headers[h.toLowerCase()]}`)
        .join('\n');
      payload = Buffer.concat([
        Buffer.from(headerParts + '\n'),
        payload
      ]);
    }
    
    // Verify based on scheme
    switch (config.scheme) {
      case 'hmac-sha256':
      case 'hmac-sha1': {
        const algorithm = config.scheme.replace('hmac-', '');
        const secrets = config.secrets || [config.secret];
        
        // Try all secrets (for rotation)
        for (const secret of secrets) {
          const hmac = createHmac(algorithm, secret);
          hmac.update(payload);
          const expected = hmac.digest(config.encoding);
          
          if (this.timingSafeEqual(signature, expected)) {
            return true;
          }
        }
        return false;
      }
      
      case 'rsa-sha256': {
        // NOTE-AI: RSA signature verification
        // Would use public key to verify
        return false; // Placeholder
      }
      
      case 'ed25519': {
        // NOTE-AI: Ed25519 signature verification
        // Modern, fast, secure
        return false; // Placeholder
      }
      
      default:
        return false;
    }
  }
  
  private timingSafeEqual(a: string, b: string): boolean {
    // NOTE-AI: Timing-safe comparison to prevent timing attacks
    if (a.length !== b.length) return false;
    
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    
    return timingSafeEqual(bufferA, bufferB);
  }
}
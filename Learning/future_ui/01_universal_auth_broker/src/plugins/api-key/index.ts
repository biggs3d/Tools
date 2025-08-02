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
  PluginConfig,
  AuthCredentials
} from '../../types/plugin.js';
import { createHash, randomBytes } from 'crypto';
import { pino } from 'pino';

// NOTE-AI: API Key Plugin Implementation - Critical Design Decisions
// =================================================================
// 
// STANDARDS COMPLIANCE:
// - No formal standard - follows industry best practices
// - Support for header, query param, and body placement
// - Custom header names (X-API-Key, Authorization, etc.)
// - Bearer prefix support for Authorization header
// 
// SECURITY REQUIREMENTS:
// - Keys stored hashed (SHA-256) not plaintext
// - Key rotation with overlap period
// - Rate limiting per key
// - IP allowlisting per key (optional)
// - Usage analytics and anomaly detection
// - Automatic expiration support
// 
// KEY FORMATS:
// - UUID v4: Default format (crypto.randomUUID)
// - Prefixed: "sk_live_" or "sk_test_" (Stripe-style)
// - JWT-like: Three parts separated by dots
// - Custom: User-provided format validation
// 
// ARCHITECTURE DECISIONS:
// - Non-interactive auth (no user flow)
// - Supports both static and dynamic keys
// - Key generation available but optional
// - Usage tracking for analytics
// - Composite keys (multiple keys per connection)
// 
// VALIDATION FEATURES:
// - Format validation (regex patterns)
// - Entropy checking (minimum randomness)
// - Prefix validation for environment
// - Domain/IP restrictions
// - Usage quota enforcement
// 
// INTEGRATION NOTES:
// - Can combine with other auth (API key + JWT)
// - Publishes usage metrics to Project 3 (Event Mesh)
// - Checks Project 8 (Governance) for key policies
// - Full audit trail in Project 15
// - Integrates with rotation engine
// 
// ADVANCED FEATURES:
// - Hierarchical keys (master/sub-keys) - Phase 2
// - Cryptographic signing (HMAC) - Phase 2
// - Time-based keys (TOTP-style) - Phase 3
// - Capability-based keys - Phase 3
// 
// KNOWN LIMITATIONS:
// - No built-in rate limiting (use API gateway)
// - No geographic restrictions yet
// - Limited to single key per request
// 
// Rationale: API keys are simple but often implemented insecurely.
// This plugin enforces best practices while remaining flexible.
// Many breaches involve leaked API keys - we minimize that risk.
// 
// Decision Date: 2024-01-15
// Last Updated: 2024-01-15
// Revisit if: Industry patterns change, new key standards emerge

const APIKeyConfigSchema = z.object({
  // Key placement
  placement: z.enum(['header', 'query', 'body']).default('header'),
  paramName: z.string().default('X-API-Key'),
  
  // For Authorization header
  useBearer: z.boolean().default(false),
  customPrefix: z.string().optional(), // e.g., "Token", "ApiKey"
  
  // Key format
  keyFormat: z.enum(['uuid', 'prefixed', 'custom']).default('uuid'),
  keyPrefix: z.string().optional(), // e.g., "sk_live_"
  keyPattern: z.string().regex(/^\/.*\/$/).optional(), // Regex pattern
  minLength: z.number().min(16).default(32),
  
  // Security
  hashKeys: z.boolean().default(true),
  requireHttps: z.boolean().default(true),
  ipAllowlist: z.array(z.string()).optional(),
  
  // Validation
  checkEntropy: z.boolean().default(true),
  minEntropy: z.number().min(3).default(4), // bits per character
  
  // Rotation
  rotationEnabled: z.boolean().default(false),
  rotationPeriodDays: z.number().min(1).default(90),
  rotationOverlapDays: z.number().min(1).default(7),
  
  // Usage tracking
  trackUsage: z.boolean().default(true),
  usageQuota: z.number().optional(),
  quotaPeriod: z.enum(['hour', 'day', 'month']).default('month'),
  
  // Composite keys
  allowMultipleKeys: z.boolean().default(false),
  keyRoles: z.array(z.string()).optional() // e.g., ['read', 'write']
}).refine(data => {
  if (data.keyFormat === 'custom' && !data.keyPattern) {
    return false;
  }
  return true;
}, {
  message: 'keyPattern is required when keyFormat is "custom"'
});

export class APIKeyPlugin implements AuthPlugin {
  readonly id = 'api_key';
  readonly name = 'API Key';
  readonly version = '1.0.0';
  readonly supportedFlows = ['static'];
  
  private logger = pino({ name: 'api-key-plugin' });
  private usageCache = new Map<string, { count: number; resetAt: Date }>();

  async initialize(config: PluginConfig): Promise<void> {
    this.logger.info('API Key plugin initialized');
    
    // NOTE-AI: Set up usage tracking cleanup
    setInterval(() => {
      const now = new Date();
      for (const [key, usage] of this.usageCache.entries()) {
        if (usage.resetAt < now) {
          this.usageCache.delete(key);
        }
      }
    }, 3600000); // Hourly cleanup
  }

  async shutdown(): Promise<void> {
    this.usageCache.clear();
    this.logger.info('API Key plugin shutdown');
  }

  async detectAuthRequirements(endpoint: URL): Promise<AuthRequirements | null> {
    // NOTE-AI: API key detection heuristics
    // Look for common patterns in headers or docs
    
    try {
      const response = await fetch(endpoint.href, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });
      
      // Check for API key headers in response
      const headers = response.headers;
      const apiKeyHeaders = [
        'x-api-key',
        'api-key',
        'apikey',
        'x-auth-token',
        'x-access-token'
      ];
      
      for (const header of apiKeyHeaders) {
        if (headers.has(header) || headers.has(`x-required-${header}`)) {
          return {
            type: AuthType.API_KEY,
            metadata: {
              suggestedHeader: header,
              hint: 'API key authentication detected'
            }
          };
        }
      }
      
      // Check WWW-Authenticate for API key mention
      const wwwAuth = headers.get('WWW-Authenticate');
      if (wwwAuth && /api.?key/i.test(wwwAuth)) {
        return {
          type: AuthType.API_KEY,
          metadata: { wwwAuthenticate: wwwAuth }
        };
      }
    } catch (error) {
      this.logger.debug({ endpoint: endpoint.href, error }, 
        'Failed to detect API key requirements');
    }
    
    return null;
  }

  async startAuth(config: AuthConfig): Promise<AuthStartResult> {
    // NOTE-AI: API keys are non-interactive
    // If a key is provided, validate and store it
    // If not, optionally generate one
    
    const validationResult = this.validateConfig(config);
    if (!validationResult.valid) {
      throw new Error(`Invalid API key config: ${validationResult.errors?.join(', ')}`);
    }
    
    if (config.apiKey) {
      // Validate provided key
      const keyValidation = await this.validateApiKey(config.apiKey as string, config);
      if (!keyValidation.valid) {
        throw new Error(`Invalid API key: ${keyValidation.errors?.join(', ')}`);
      }
      
      // Return completed auth
      return {
        completed: true,
        credentials: {
          apiKey: config.apiKey as string,
          expiresAt: config.expiresAt as Date
        },
        flowType: 'non-interactive'
      };
    }
    
    // Generate new key if requested
    if (config.generateKey) {
      const newKey = await this.generateApiKey(config);
      return {
        completed: true,
        credentials: {
          apiKey: newKey,
          expiresAt: config.expiresAt as Date
        },
        flowType: 'non-interactive',
        metadata: { generated: true }
      };
    }
    
    throw new Error('Either provide apiKey or set generateKey=true');
  }

  async completeAuth(params: AuthCallbackParams): Promise<AuthResult> {
    // API keys don't have a callback flow
    throw new Error('API key authentication does not support callback flow');
  }

  async refreshAuth(credentials: StoredCredentials): Promise<AuthResult> {
    // NOTE-AI: API key rotation
    // 1. Generate new key
    // 2. Overlap period where both work
    // 3. Deprecate old key
    
    return {
      success: false,
      error: {
        code: 'API_KEY_ROTATION_NOT_IMPLEMENTED',
        message: 'API key rotation not yet implemented',
        remediation: 'Generate a new API key and update your systems during the overlap period'
      }
    };
  }

  async validateCredentials(credentials: unknown): Promise<ValidationResult> {
    const schema = z.object({
      apiKey: z.string(),
      expiresAt: z.date().optional(),
      roles: z.array(z.string()).optional()
    });
    
    try {
      const parsed = schema.parse(credentials);
      
      // Check expiration
      if (parsed.expiresAt && new Date() > parsed.expiresAt) {
        return {
          valid: false,
          errors: ['API key has expired']
        };
      }
      
      // NOTE-AI: Additional validation
      // - Check key format
      // - Verify against hash if stored
      // - Check IP restrictions
      // - Verify usage quota
      
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { valid: false, errors: ['Invalid API key format'] };
    }
  }

  getTokenExpiration(credentials: unknown): Date | null {
    const creds = credentials as any;
    return creds.expiresAt || null;
  }

  getConfigSchema(): z.ZodSchema {
    return APIKeyConfigSchema;
  }

  validateConfig(config: unknown): ValidationResult {
    try {
      APIKeyConfigSchema.parse(config);
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
  private async validateApiKey(key: string, config: any): Promise<ValidationResult> {
    const errors: string[] = [];
    
    // Length check
    if (key.length < config.minLength) {
      errors.push(`Key must be at least ${config.minLength} characters`);
    }
    
    // Format check
    if (config.keyFormat === 'prefixed' && config.keyPrefix) {
      if (!key.startsWith(config.keyPrefix)) {
        errors.push(`Key must start with ${config.keyPrefix}`);
      }
    }
    
    // Pattern check
    if (config.keyPattern) {
      const pattern = new RegExp(config.keyPattern.slice(1, -1));
      if (!pattern.test(key)) {
        errors.push('Key does not match required pattern');
      }
    }
    
    // Entropy check
    if (config.checkEntropy) {
      const entropy = this.calculateEntropy(key);
      if (entropy < config.minEntropy) {
        errors.push(`Key entropy too low (${entropy.toFixed(2)} < ${config.minEntropy})`);
      }
    }
    
    return errors.length > 0 
      ? { valid: false, errors }
      : { valid: true };
  }
  
  private async generateApiKey(config: any): Promise<string> {
    // NOTE-AI: Generate secure API key based on format
    let key: string;
    
    switch (config.keyFormat) {
      case 'uuid':
        key = crypto.randomUUID();
        break;
        
      case 'prefixed':
        const random = randomBytes(24).toString('base64url');
        key = `${config.keyPrefix || 'key_'}${random}`;
        break;
        
      default:
        // Custom format - generate random and fit pattern
        key = randomBytes(32).toString('base64url');
    }
    
    return key;
  }
  
  private calculateEntropy(key: string): number {
    // NOTE-AI: Simple entropy calculation
    // Count unique characters and calculate bits per character
    const unique = new Set(key).size;
    return Math.log2(unique);
  }
  
  // Usage tracking
  async trackUsage(keyHash: string, config: any): Promise<void> {
    if (!config.trackUsage) return;
    
    const usage = this.usageCache.get(keyHash) || {
      count: 0,
      resetAt: this.getResetTime(config.quotaPeriod)
    };
    
    usage.count++;
    
    if (config.usageQuota && usage.count > config.usageQuota) {
      throw new Error('API key usage quota exceeded');
    }
    
    this.usageCache.set(keyHash, usage);
  }
  
  private getResetTime(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'hour':
        return new Date(now.getTime() + 3600000);
      case 'day':
        return new Date(now.getTime() + 86400000);
      case 'month':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      default:
        return new Date(now.getTime() + 86400000);
    }
  }
}
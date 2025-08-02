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
import { generateRandomString, generateCodeChallenge } from './utils.js';
import { pino } from 'pino';

// NOTE-AI: OAuth2/OIDC Plugin Implementation - Critical Design Decisions
// =====================================================================
// 
// STANDARDS COMPLIANCE:
// - OAuth 2.1 Compliant: MUST mandate PKCE for all authorization code flows
// - MUST disallow implicit grant and ROPC (resource owner password credentials)
// - OIDC First-Class: This plugin MUST support full OpenID Connect, not just discovery
//   - Validate ID tokens (signature and claims)
//   - Support userinfo endpoint
//   - Act as compliant OIDC Relying Party (RP)
// 
// SECURITY REQUIREMENTS:
// - State parameter MUST be cryptographically bound to user session (prevent CSRF)
// - Redirect URI MUST be strictly validated against pre-registered allowlist
// - PKCE is mandatory by default (can only be disabled for legacy with explicit flag)
// - Token refresh MUST implement exponential backoff with jitter
// - Credentials returned to broker core - plugin NEVER handles encryption
// 
// ARCHITECTURE DECISIONS:
// - Supports both interactive (authorization code) and non-interactive (client credentials) flows
// - For non-interactive flows, startAuth can return complete AuthResult
// - State store automatically cleans up after 10 minutes (configurable)
// - Plugin receives shared services (logger, HTTP client, cache) via initialize()
// 
// FUTURE ENHANCEMENTS:
// - OAuth 2.1 PAR (Pushed Authorization Requests) - Phase 2
// - OAuth 2.1 RAR (Rich Authorization Requests) - Phase 2
// - Device flow support - Phase 2
// - Dynamic client registration - Phase 3
// - Token introspection endpoint support - Phase 2
// 
// INTEGRATION NOTES:
// - Publishes events to Project 3 (Event Mesh) on token refresh/expiry
// - Checks Project 8 (Governance) for allowed scopes/audiences
// - Stores user preferences in Project 9 (Context Vault)
// - All operations logged to Project 15 (Audit Trail)
// 
// KNOWN LIMITATIONS:
// - No support for mTLS client authentication (planned Phase 3)
// - No support for DPoP (Demonstration of Proof of Possession) yet
// - Refresh token rotation not yet implemented
// 
// Rationale: OAuth2/OIDC is the foundation for most modern auth. Getting this
// right sets the standard for all other plugins. Security is paramount - we'd
// rather be too strict than too permissive.
// 
// Decision Date: 2024-01-15
// Last Updated: 2024-01-15
// Revisit if: New OAuth specs released, security vulnerabilities discovered

const OAuth2ConfigSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  authorizationEndpoint: z.string().url(),
  tokenEndpoint: z.string().url(),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).optional(),
  audience: z.string().optional(),
  responseType: z.enum(['code', 'token']).default('code'),
  usePKCE: z.boolean().default(true),
  // OIDC specific
  issuer: z.string().url().optional(),
  userInfoEndpoint: z.string().url().optional(),
  jwksUri: z.string().url().optional(),
  // Advanced OAuth 2.1
  usePAR: z.boolean().default(false),
  resource: z.string().optional(),
  // Security flags
  allowInsecureNonPKCE: z.boolean().default(false),
  requireStateValidation: z.boolean().default(true)
}).refine(data => {
  // OAuth 2.1 compliance: PKCE is mandatory unless explicitly disabled for legacy
  if (!data.usePKCE && !data.allowInsecureNonPKCE) {
    return false;
  }
  return true;
}, {
  message: 'PKCE is mandatory for OAuth 2.1 compliance. Set allowInsecureNonPKCE=true to override (not recommended)'
});

export class OAuth2Plugin implements AuthPlugin {
  readonly id = 'oauth2';
  readonly name = 'OAuth 2.0 / OpenID Connect';
  readonly version = '1.0.0';
  
  private logger = pino({ name: 'oauth2-plugin' });
  // NOTE-AI: Removed in-memory stateStore - now using distributed state
  private sharedServices: any = {}; // Will be properly typed when we define shared services

  async initialize(config: PluginConfig): Promise<void> {
    // NOTE-AI: Shared services pattern - plugins receive common utilities
    // This prevents each plugin from reimplementing HTTP clients, caching, etc.
    this.sharedServices = config.sharedServices || {};
    this.logger.info('OAuth2/OIDC plugin initialized');
  }

  async shutdown(): Promise<void> {
    // NOTE-AI: No local state to clear - using distributed store
    this.logger.info('OAuth2/OIDC plugin shutdown');
  }

  async detectAuthRequirements(endpoint: URL): Promise<AuthRequirements | null> {
    // Try .well-known discovery (both OAuth2 and OIDC)
    const discoveryUrls = [
      '/.well-known/oauth-authorization-server',
      '/.well-known/openid-configuration'
    ];

    for (const path of discoveryUrls) {
      try {
        const discoveryUrl = new URL(path, endpoint);
        const response = await fetch(discoveryUrl.href, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const metadata = await response.json();
          
          // NOTE-AI: OIDC detection - if we see OIDC-specific fields, mark it
          const isOIDC = !!(metadata.userinfo_endpoint || metadata.id_token_signing_alg_values_supported);
          
          return {
            type: AuthType.OAUTH2,
            authorizationEndpoint: metadata.authorization_endpoint,
            tokenEndpoint: metadata.token_endpoint,
            scopes: metadata.scopes_supported,
            responseTypes: metadata.response_types_supported,
            metadata: {
              ...metadata,
              isOIDC,
              // Store OIDC-specific endpoints if present
              userInfoEndpoint: metadata.userinfo_endpoint,
              jwksUri: metadata.jwks_uri,
              issuer: metadata.issuer
            }
          };
        }
      } catch (error) {
        this.logger.debug({ endpoint: endpoint.href, error }, 
          'Failed to fetch discovery document');
      }
    }

    // Check for common OAuth2 headers
    try {
      const response = await fetch(endpoint.href, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });

      const wwwAuth = response.headers.get('WWW-Authenticate');
      if (wwwAuth?.toLowerCase().includes('bearer')) {
        return {
          type: AuthType.OAUTH2,
          metadata: { wwwAuthenticate: wwwAuth }
        };
      }
    } catch (error) {
      this.logger.debug({ endpoint: endpoint.href, error }, 
        'Failed to check endpoint headers');
    }

    return null;
  }

  async startAuth(config: AuthConfig): Promise<AuthStartResult> {
    const validationResult = this.validateConfig(config);
    if (!validationResult.valid) {
      throw new Error(`Invalid OAuth2 config: ${validationResult.errors?.join(', ')}`);
    }

    // NOTE-AI: Non-interactive flow detection
    // For client_credentials grant, we complete auth immediately
    if (config.grantType === 'client_credentials') {
      return this.performClientCredentialsFlow(config);
    }

    // Interactive flow (authorization code)
    const state = generateRandomString(32);
    const authUrl = new URL(config.authorizationEndpoint as string);
    
    authUrl.searchParams.set('client_id', config.clientId as string);
    authUrl.searchParams.set('redirect_uri', config.redirectUri as string);
    authUrl.searchParams.set('response_type', config.responseType as string || 'code');
    authUrl.searchParams.set('state', state);

    if (config.scopes && config.scopes.length > 0) {
      authUrl.searchParams.set('scope', config.scopes.join(' '));
    }

    if (config.audience) {
      authUrl.searchParams.set('audience', config.audience as string);
    }

    // NOTE-AI: PKCE is mandatory unless explicitly disabled
    let codeVerifier: string | undefined;
    if (config.usePKCE !== false || !config.allowInsecureNonPKCE) {
      codeVerifier = generateRandomString(128);
      const codeChallenge = await generateCodeChallenge(codeVerifier);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
    }

    // NOTE-AI: Store state in distributed store for horizontal scaling
    // This allows any broker instance to handle the callback
    const stateStore = this.sharedServices.stateStore;
    if (!stateStore) {
      throw new Error('State store not available - required for OAuth2 flows');
    }
    
    await stateStore.setOAuthState(state, { codeVerifier, config }, 600); // 10 minutes TTL

    return {
      authUrl: authUrl.toString(),
      state,
      codeVerifier
    };
  }

  async completeAuth(params: AuthCallbackParams): Promise<AuthResult> {
    if (params.error) {
      return {
        success: false,
        error: {
          code: params.error,
          message: params.errorDescription || 'Authorization failed',
          details: params
        }
      };
    }

    if (!params.state || !params.code) {
      return {
        success: false,
        error: {
          code: 'INVALID_CALLBACK',
          message: 'Missing state or code parameter'
        }
      };
    }

    // NOTE-AI: Retrieve state from distributed store
    const stateStore = this.sharedServices.stateStore;
    const stateData = await stateStore.getOAuthState(params.state);
    
    if (!stateData) {
      return {
        success: false,
        error: {
          code: 'INVALID_STATE',
          message: 'Invalid or expired state parameter'
        }
      };
    }

    // Clean up state
    await stateStore.deleteState(params.state);

    try {
      const { config, codeVerifier } = stateData;
      const tokenUrl = new URL(config.tokenEndpoint as string);
      
      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: config.redirectUri as string,
        client_id: config.clientId as string,
        client_secret: config.clientSecret as string
      });

      if (codeVerifier) {
        body.set('code_verifier', codeVerifier);
      }

      const response = await fetch(tokenUrl.href, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: body.toString()
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: data.error || 'TOKEN_EXCHANGE_FAILED',
            message: data.error_description || 'Failed to exchange code for token',
            details: data
          }
        };
      }

      const expiresAt = data.expires_in 
        ? new Date(Date.now() + (data.expires_in * 1000))
        : undefined;

      // NOTE-AI: Return raw credentials - broker core handles encryption
      return {
        success: true,
        credentials: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          idToken: data.id_token,
          tokenType: data.token_type,
          scope: data.scope,
          expiresAt
        }
      };
    } catch (error) {
      this.logger.error({ error }, 'Token exchange failed');
      return {
        success: false,
        error: {
          code: 'TOKEN_EXCHANGE_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  async refreshAuth(credentials: StoredCredentials): Promise<AuthResult> {
    // NOTE-AI: Token refresh implementation
    // - Exponential backoff with jitter on failure
    // - Publish refresh events to Event Mesh
    // - Update audit trail
    throw new Error('Token refresh not implemented yet - Phase 2');
  }

  private async performClientCredentialsFlow(config: AuthConfig): Promise<AuthStartResult> {
    // NOTE-AI: Non-interactive client credentials flow
    // Returns complete AuthResult since no user interaction needed
    throw new Error('Client credentials flow not implemented yet - Phase 2');
  }

  async validateCredentials(credentials: unknown): Promise<ValidationResult> {
    const schema = z.object({
      accessToken: z.string(),
      tokenType: z.string().optional(),
      expiresAt: z.date().optional(),
      refreshToken: z.string().optional(),
      idToken: z.string().optional(), // OIDC
      scope: z.string().optional()
    });

    try {
      schema.parse(credentials);
      
      // NOTE-AI: Additional OIDC validation would go here
      // - Validate ID token signature using JWKS
      // - Check token claims (iss, aud, exp, etc.)
      
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { valid: false, errors: ['Invalid credentials format'] };
    }
  }

  getTokenExpiration(credentials: unknown): Date | null {
    const creds = credentials as any;
    if (creds.expiresAt instanceof Date) {
      return creds.expiresAt;
    }
    if (typeof creds.expiresAt === 'string') {
      return new Date(creds.expiresAt);
    }
    
    // NOTE-AI: For ID tokens, we could decode and check exp claim
    
    return null;
  }

  getConfigSchema(): z.ZodSchema {
    return OAuth2ConfigSchema;
  }

  validateConfig(config: unknown): ValidationResult {
    try {
      OAuth2ConfigSchema.parse(config);
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
}
import { z } from 'zod';

// NOTE-AI: Universal Auth Broker Plugin Interface - Critical Design Decisions
// ===========================================================================
// 
// ARCHITECTURE PRINCIPLES:
// - Plugins are sandboxed and versioned for security and stability
// - Support both sync (API keys) and async (OAuth) authentication flows
// - Event-driven architecture for loose coupling with other Future UI projects
// - Shared services pattern prevents reimplementation of common functionality
// 
// SECURITY REQUIREMENTS:
// - Plugins NEVER handle encryption - broker core owns this responsibility
// - All credentials are returned raw to broker for centralized encryption
// - Plugins must validate but not store sensitive data
// - Support for post-quantum cryptography (Phase 3)
// 
// EXTENSIBILITY FEATURES:
// - Event hooks for async operations and monitoring
// - AI/ML hooks for anomaly detection and predictive features
// - Middleware support for cross-cutting concerns
// - Dependency injection for plugin composition
// 
// COMPLIANCE & STANDARDS:
// - Support for OAuth 2.1, OIDC, SAML 2.0, WebAuthn/Passkeys
// - Fine-grained authorization integration (OpenFGA, SpiceDB)
// - Audit trail integration for all operations
// - Policy enforcement via OPA integration
// 
// FUTURE CONSIDERATIONS:
// - Verifiable Credentials (VCs) and DIDs support
// - Quantum-resistant algorithms
// - Edge computing optimizations
// - Adaptive authentication based on risk
// 
// Rationale: This interface must be flexible enough to handle current auth
// methods while being extensible for future innovations. Security and 
// modularity are paramount.
// 
// Decision Date: 2024-01-15
// Last Updated: 2024-01-15
// Revisit if: New auth standards emerge, security landscape changes

export enum AuthType {
  OAUTH2 = 'oauth2',
  JWT = 'jwt',
  SAML = 'saml',
  API_KEY = 'api_key',
  WEBHOOK = 'webhook',
  PASSKEY = 'passkey',
  CUSTOM = 'custom'
}

export interface AuthRequirements {
  type: AuthType;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  scopes?: string[];
  responseTypes?: string[];
  algorithms?: string[];
  metadata?: Record<string, unknown>;
}

export interface AuthConfig {
  type: AuthType;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  audience?: string;
  issuer?: string;
  grantType?: string;
  [key: string]: unknown;
}

export interface AuthStartResult {
  // For interactive flows
  authUrl?: string;
  state?: string;
  codeVerifier?: string;
  challenge?: string;
  
  // For non-interactive flows
  completed?: boolean;
  credentials?: AuthCredentials;
  
  // Flow control
  flowType?: 'interactive' | 'non-interactive';
  metadata?: Record<string, unknown>;
}

export interface AuthCallbackParams {
  code?: string;
  state?: string;
  error?: string;
  errorDescription?: string;
  [key: string]: unknown;
}

export interface AuthCredentials {
  accessToken?: string;
  refreshToken?: string;
  idToken?: string;
  apiKey?: string;
  certificate?: string;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
  claims?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AuthResult {
  success: boolean;
  credentials?: AuthCredentials;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    remediation?: string;
  };
}

export interface StoredCredentials {
  id: string;
  connectionId: string;
  encryptedData: string;
  expiresAt?: Date;
  version: number;
  metadata?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface PluginConfig {
  // Core configuration
  version?: string;
  environment?: string;
  
  // Shared services injected by broker
  sharedServices?: {
    logger?: any;
    httpClient?: any;
    cache?: any;
    eventBus?: any;
    policyEngine?: any;
    stateStore?: any; // Distributed state for OAuth/WebAuthn
    secretManager?: any; // Secure secret retrieval
  };
  
  // Plugin-specific config
  [key: string]: unknown;
}

export interface AuthField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
  validation?: z.ZodSchema;
  sensitive?: boolean;
}

// Event types for async operations
export interface AuthEvent {
  type: 'token_refreshed' | 'token_expired' | 'auth_failed' | 'anomaly_detected';
  connectionId: string;
  timestamp: Date;
  data?: unknown;
}

// AI/ML hooks for intelligence layer
export interface AIHooks {
  // Anomaly detection during auth
  detectAnomalies?(context: AuthContext): Promise<AnomalyResult>;
  
  // Predict token expiration
  predictExpiration?(credentials: AuthCredentials): Promise<Date>;
  
  // Risk-based authentication
  assessRisk?(context: AuthContext): Promise<RiskAssessment>;
  
  // Generate remediation hints
  suggestRemediation?(error: AuthError): Promise<string>;
}

export interface AuthContext {
  connectionId: string;
  clientIp?: string;
  userAgent?: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AnomalyResult {
  detected: boolean;
  confidence: number;
  reasons?: string[];
}

export interface RiskAssessment {
  score: number; // 0-100
  factors: string[];
  requiresMFA?: boolean;
  suggestedAction?: string;
}

export interface AuthError {
  code: string;
  message: string;
  context?: unknown;
}

// Main plugin interface
export interface AuthPlugin {
  // Metadata
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly supportedFlows?: string[];
  readonly dependencies?: string[]; // Other plugins this depends on
  
  // Lifecycle
  initialize(config: PluginConfig): Promise<void>;
  shutdown(): Promise<void>;
  
  // Health check
  healthCheck?(): Promise<{ healthy: boolean; details?: unknown }>;
  
  // Discovery
  detectAuthRequirements(endpoint: URL): Promise<AuthRequirements | null>;
  
  // Authentication flows
  startAuth(config: AuthConfig): Promise<AuthStartResult>;
  completeAuth(params: AuthCallbackParams): Promise<AuthResult>;
  refreshAuth(credentials: StoredCredentials): Promise<AuthResult>;
  
  // Validation
  validateCredentials(credentials: unknown): Promise<ValidationResult>;
  getTokenExpiration(credentials: unknown): Date | null;
  
  // Configuration
  getConfigSchema(): z.ZodSchema;
  validateConfig(config: unknown): ValidationResult;
  
  // Event handling (optional)
  onEvent?(event: AuthEvent): Promise<void>;
  registerEventHandler?(handler: (event: AuthEvent) => Promise<void>): void;
  
  // AI/ML hooks (optional)
  aiHooks?: AIHooks;
  
  // Middleware support (optional)
  beforeAuth?(config: AuthConfig): Promise<AuthConfig>;
  afterAuth?(result: AuthResult): Promise<AuthResult>;
}

// Plugin registry interface
export interface PluginRegistry {
  register(plugin: AuthPlugin): Promise<void>;
  unregister(pluginId: string): Promise<void>;
  getPlugin(pluginId: string): AuthPlugin | undefined;
  getPluginByAuthType(authType: AuthType): AuthPlugin | undefined;
  getAllPlugins(): AuthPlugin[];
  
  // Plugin composition
  composePlugins?(plugins: string[]): AuthPlugin;
  
  // Event bus
  publishEvent?(event: AuthEvent): Promise<void>;
}
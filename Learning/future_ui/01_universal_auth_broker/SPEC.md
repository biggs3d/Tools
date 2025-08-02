# Universal Auth Broker - Technical Specification

## API Specification

### Base URL
```
https://auth-broker.{environment}.app/v1
```

### Authentication
The Auth Broker itself uses JWT tokens with tenant isolation:
```
Authorization: Bearer <jwt-token>
X-Tenant-ID: tenant_123
```

## Core Endpoints

### 1. Connection Management

#### Create Connection
```http
POST /connections
Content-Type: application/json

{
  "name": "GitHub Integration",
  "service": "github",
  "endpoint": "https://api.github.com",
  "authConfig": {
    "type": "oauth2",
    "clientId": "{{CLIENT_ID}}",
    "clientSecretRef": "vault:secret/data/github/oauth#client_secret",
    "scopes": ["read:user", "repo"],
    "redirectUri": "https://app.example.com/auth/callback"
  },
  "metadata": {
    "environment": "production",
    "owner": "team-platform"
  }
}

Response: 201 Created
{
  "id": "conn_xGh5kL9mN3pQ",
  "name": "GitHub Integration",
  "service": "github",
  "authType": "oauth2",
  "status": "pending_auth",
  "authUrl": "https://github.com/login/oauth/authorize?...",
  "createdAt": "2024-01-15T10:30:00Z",
  "expiresAt": null
}
```

#### Complete OAuth Flow
```http
POST /connections/{connectionId}/callback
Content-Type: application/json

{
  "code": "abc123",
  "state": "xyz789"
}

Response: 200 OK
{
  "id": "conn_xGh5kL9mN3pQ",
  "status": "active",
  "expiresAt": "2024-01-16T10:30:00Z",
  "capabilities": ["read:user", "repo"]
}
```

#### Get Connection Token
```http
GET /connections/{connectionId}/token

Response: 200 OK
{
  "accessToken": "gho_xxxxx",
  "tokenType": "bearer",
  "expiresIn": 3600,
  "refreshToken": "ghr_xxxxx",
  "scope": "read:user repo"
}
```

#### List Connections
```http
GET /connections?service=github&status=active

Response: 200 OK
{
  "connections": [
    {
      "id": "conn_xGh5kL9mN3pQ",
      "name": "GitHub Integration",
      "service": "github",
      "status": "active",
      "lastUsed": "2024-01-15T14:30:00Z",
      "expiresAt": "2024-01-16T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "perPage": 20
  }
}
```

### 2. Plugin Management

#### List Available Plugins
```http
GET /plugins

Response: 200 OK
{
  "plugins": [
    {
      "id": "oauth2",
      "name": "OAuth 2.0",
      "version": "1.0.0",
      "supportedFlows": ["authorization_code", "client_credentials", "device"],
      "requiredFields": ["clientId", "clientSecret"],
      "optionalFields": ["scopes", "audience", "resource"]
    },
    {
      "id": "jwt",
      "name": "JSON Web Token",
      "version": "1.0.0",
      "supportedAlgorithms": ["RS256", "HS256", "ES256"],
      "requiredFields": ["secret_or_key"],
      "optionalFields": ["issuer", "audience", "algorithms"]
    }
  ]
}
```

#### Auto-Detect Auth Requirements
```http
POST /plugins/detect
Content-Type: application/json

{
  "endpoint": "https://api.example.com/v1"
}

Response: 200 OK
{
  "detected": true,
  "authType": "oauth2",
  "discoveryUrl": "https://api.example.com/.well-known/oauth-authorization-server",
  "requirements": {
    "authorizationEndpoint": "https://auth.example.com/oauth/authorize",
    "tokenEndpoint": "https://auth.example.com/oauth/token",
    "scopes": ["read", "write"],
    "responseTypes": ["code", "token"]
  }
}
```

### 3. Credential Vault

#### Store Credentials
```http
POST /vault/credentials
Content-Type: application/json

{
  "connectionId": "conn_xGh5kL9mN3pQ",
  "credentials": {
    "accessToken": "encrypted_token_here",
    "refreshToken": "encrypted_refresh_here",
    "expiresAt": "2024-01-16T10:30:00Z"
  },
  "encryption": {
    "algorithm": "AES-256-GCM",
    "keyId": "kek_123"
  }
}

Response: 201 Created
{
  "id": "cred_aB3dE5fG7",
  "connectionId": "conn_xGh5kL9mN3pQ",
  "status": "active",
  "rotationSchedule": {
    "nextRotation": "2024-01-15T10:30:00Z",
    "strategy": "before_expiry",
    "window": "24h"
  }
}
```

#### Rotation Configuration
```http
PUT /vault/credentials/{credentialId}/rotation
Content-Type: application/json

{
  "enabled": true,
  "strategy": "before_expiry",
  "rotationWindow": "24h",
  "notificationWebhook": "https://app.example.com/webhooks/rotation"
}

Response: 200 OK
{
  "id": "cred_aB3dE5fG7",
  "rotationEnabled": true,
  "nextRotation": "2024-01-15T10:30:00Z"
}
```

### 4. Monitoring & Health

#### Health Check
```http
GET /health

Response: 200 OK
{
  "status": "healthy",
  "version": "1.0.0",
  "checks": {
    "database": "ok",
    "vault": "ok",
    "redis": "ok"
  }
}
```

#### Metrics
```http
GET /metrics

Response: 200 OK
{
  "authRequests": {
    "total": 1000000,
    "successful": 999500,
    "failed": 500,
    "avgLatencyMs": 45
  },
  "connections": {
    "active": 1250,
    "expired": 50,
    "byType": {
      "oauth2": 800,
      "jwt": 300,
      "saml": 100,
      "apikey": 50
    }
  },
  "rotations": {
    "scheduled": 25,
    "completed": 150,
    "failed": 2
  }
}
```

## Plugin Interface Specification

```typescript
// Base plugin interface
interface AuthPlugin {
  // Metadata
  readonly id: string;
  readonly name: string;
  readonly version: string;
  
  // Lifecycle
  initialize(config: PluginConfig): Promise<void>;
  shutdown(): Promise<void>;
  
  // Discovery
  detectAuthRequirements(endpoint: URL): Promise<AuthRequirements | null>;
  
  // Authentication
  startAuth(config: AuthConfig): Promise<AuthStartResult>;
  completeAuth(params: AuthCallbackParams): Promise<AuthResult>;
  refreshAuth(credentials: StoredCredentials): Promise<AuthResult>;
  
  // Validation
  validateCredentials(credentials: unknown): Promise<ValidationResult>;
  getTokenExpiration(credentials: unknown): Date | null;
  
  // Configuration
  getConfigSchema(): JSONSchema;
  validateConfig(config: unknown): ValidationResult;
}

// OAuth2 Plugin Example
class OAuth2Plugin implements AuthPlugin {
  readonly id = 'oauth2';
  readonly name = 'OAuth 2.0';
  readonly version = '1.0.0';
  
  async detectAuthRequirements(endpoint: URL): Promise<AuthRequirements | null> {
    // Try .well-known discovery
    const discoveryUrl = new URL('/.well-known/oauth-authorization-server', endpoint);
    try {
      const response = await fetch(discoveryUrl);
      if (response.ok) {
        const metadata = await response.json();
        return {
          type: 'oauth2',
          authorizationEndpoint: metadata.authorization_endpoint,
          tokenEndpoint: metadata.token_endpoint,
          scopes: metadata.scopes_supported,
          responseTypes: metadata.response_types_supported
        };
      }
    } catch (e) {
      // Try other detection methods
    }
    return null;
  }
  
  async startAuth(config: AuthConfig): Promise<AuthStartResult> {
    const state = generateSecureRandom();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    
    const authUrl = new URL(config.authorizationEndpoint);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    
    if (config.scopes) {
      authUrl.searchParams.set('scope', config.scopes.join(' '));
    }
    
    return {
      authUrl: authUrl.toString(),
      state,
      codeVerifier
    };
  }
  
  // ... rest of implementation
}
```

## Data Models

### Connection
```typescript
interface Connection {
  id: string;
  tenantId: string;
  name: string;
  service: string;
  endpoint: string;
  authType: AuthType;
  status: ConnectionStatus;
  authConfig: Record<string, any>;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  lastUsed?: Date;
  expiresAt?: Date;
}

enum ConnectionStatus {
  PENDING_AUTH = 'pending_auth',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  FAILED = 'failed',
  REVOKED = 'revoked'
}
```

### Stored Credentials
```typescript
interface StoredCredential {
  id: string;
  connectionId: string;
  encryptedData: string;
  encryptionKeyId: string;
  algorithm: string;
  expiresAt?: Date;
  rotationConfig?: RotationConfig;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

interface RotationConfig {
  enabled: boolean;
  strategy: RotationStrategy;
  rotationWindow: string;
  lastRotation?: Date;
  nextRotation?: Date;
  notificationWebhook?: string;
}
```

## Security Considerations

### Secret Management
- **NO DIRECT SECRETS IN API**: Secrets referenced by ID/path
- Supported backends: Vault, AWS Secrets Manager, Azure Key Vault
- Reference format: `backend:path/to/secret#key`
- All secret access audited with context
- Break-glass emergency access procedures

### Encryption
- All credentials encrypted using AES-256-GCM
- DEK (Data Encryption Key) per credential
- KEK (Key Encryption Key) rotated monthly
- Support for HSM integration for KEK storage
- Broker owns entire encryption lifecycle

### State Management
- Distributed state store (Redis) for horizontal scaling
- OAuth state and WebAuthn challenges in Redis, not memory
- Automatic expiration (TTL) for all ephemeral state
- Redis Cluster/Sentinel for high availability

### Access Control
- JWT-based authentication with tenant isolation
- Role-based access control (RBAC)
- Audit logging for all credential access
- Rate limiting per tenant and endpoint

### Network Security
- TLS 1.3 minimum
- Certificate pinning for critical auth providers
- Webhook signature validation
- IP allowlisting support

### Brokered Calls Pattern
- **NO TOKEN VENDING**: Tokens never exposed via API
- Services request broker to make authenticated calls
- `POST /connections/{id}/request` for brokered requests
- Dramatically reduces attack surface

## Error Responses

Standard error format:
```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Authentication failed for service",
    "details": {
      "service": "github",
      "reason": "invalid_client"
    },
    "remediation": "Check your client credentials and try again",
    "requestId": "req_xY9mK3pL",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

Common error codes:
- `AUTH_REQUIRED` - Authentication needed
- `AUTH_FAILED` - Authentication failed
- `TOKEN_EXPIRED` - Access token expired
- `INVALID_CREDENTIALS` - Invalid credentials format
- `PLUGIN_NOT_FOUND` - Requested auth plugin not available
- `RATE_LIMITED` - Too many requests
- `SERVICE_UNAVAILABLE` - Auth provider unreachable

## Migration & Backwards Compatibility

### Version Strategy
- Semantic versioning for API
- Deprecation notices 6 months in advance
- Dual-running for major version changes

### Data Migration
- Automatic credential format upgrades
- Backwards compatible API responses
- Legacy plugin support via adapters
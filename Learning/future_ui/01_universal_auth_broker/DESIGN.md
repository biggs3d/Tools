# Universal Auth Broker - Design Document

## Overview

The Universal Auth Broker is a foundational service that provides a unified interface for handling all authentication patterns. It abstracts away the complexity of different auth mechanisms (OAuth2, JWT, SAML, API keys, webhooks) behind a consistent API, enabling AI concierges and other services to connect seamlessly to dozens of external services.

## Core Requirements

### Functional Requirements

1. **Universal Auth Support**
   - OAuth2 (all flows: authorization code, client credentials, device flow, PKCE)
   - JWT (validation, generation, refresh)
   - SAML 2.0 (SP and IdP modes)
   - API Keys (static and rotating)
   - Webhook signatures (HMAC, RSA)
   - Custom auth plugins

2. **Credential Management**
   - Secure credential storage (encrypted at rest)
   - Automatic token refresh before expiration
   - Credential rotation schedules
   - Audit logging for all credential access
   - Multi-tenant isolation

3. **Developer Experience**
   - Single unified API regardless of auth type
   - Auto-discovery of auth requirements
   - Intelligent retry with backoff
   - Clear error messages with remediation hints

4. **Performance Requirements** (per CLAUDE.md)
   - Sub-100ms response time for auth operations
   - Graceful degradation under load
   - Circuit breakers for failing auth providers
   - Caching for validated tokens

### Non-Functional Requirements

1. **Security**
   - Zero-knowledge architecture where possible
   - Hardware security module (HSM) support
   - Secrets never logged or exposed
   - Rate limiting per tenant/credential

2. **Reliability**
   - 99.99% uptime target ("four 9s")
   - Graceful fallback for provider outages
   - Health check endpoints
   - Distributed deployment support

3. **Compliance**
   - GDPR compliant (right to deletion)
   - SOX compliant audit trails
   - HIPAA ready (for healthcare integrations)
   - PCI DSS Level 1 for payment credentials

## Architecture Approach

Following the CLAUDE.md guidelines, we'll use the **Distributed Specialist** approach as default:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Auth Broker   │────▶│  Plugin Registry │────▶│   Auth Plugins  │
│      Core       │     └─────────────────┘     │  (OAuth, JWT...)│
└────────┬────────┘                             └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Credential Vault│────▶│ Rotation Engine │
└─────────────────┘     └─────────────────┘
```

## Key Design Decisions

### 1. Plugin Architecture

Each auth method is implemented as a plugin with a standard interface:

```typescript
interface AuthPlugin {
  type: AuthType;
  
  // Discovery
  detectAuthRequirements(endpoint: URL): Promise<AuthRequirements>;
  
  // Authentication
  authenticate(config: AuthConfig): Promise<AuthResult>;
  refreshCredentials(credentials: StoredCredentials): Promise<AuthResult>;
  
  // Validation
  validateCredentials(credentials: any): Promise<boolean>;
  getExpirationTime(credentials: any): Date | null;
  
  // Metadata
  getRequiredFields(): AuthField[];
  getOptionalFields(): AuthField[];
}
```

### 2. Credential Storage

- Use envelope encryption (DEK + KEK pattern)
- Support multiple storage backends (PostgreSQL, DynamoDB, Vault)
- Implement soft deletes with retention periods
- Tag credentials with:
  - Service/endpoint
  - Auth type
  - Tenant ID
  - Creation/rotation timestamps
  - Usage statistics

### 3. Unified API Design

Single endpoint handles all auth types:

```typescript
POST /auth/connect
{
  "service": "github",
  "endpoint": "https://api.github.com",
  "credentials": {
    // Auto-detected or explicitly provided
  }
}

Response:
{
  "connectionId": "conn_123",
  "authType": "oauth2",
  "status": "active",
  "expiresAt": "2024-12-31T23:59:59Z",
  "capabilities": ["read:user", "repo"]
}
```

### 4. Auto-Discovery Flow

1. Probe endpoint for auth hints (WWW-Authenticate, docs links)
2. Check internal service registry
3. Try common patterns (/.well-known/oauth-authorization-server)
4. Fall back to manual configuration

### 5. Rotation Strategy

- Configurable rotation windows (e.g., rotate 24h before expiry)
- Gradual rollout (keep old credentials active during transition)
- Automatic rollback on failure
- Notification webhooks for rotation events

## Integration Points

### With Other Future UI Projects

1. **Project 3 (Real-time Event Mesh)**: Publish auth events (new connection, rotation, expiry)
2. **Project 8 (AI Governance)**: Enforce auth policies (approved services only)
3. **Project 9 (User Context Vault)**: Store user preferences for auth methods
4. **Project 15 (Decision Audit Trail)**: Log all auth decisions and access

### External Integrations

- Support for popular auth providers OOTB
- Webhook receivers for OAuth callbacks
- SAML metadata endpoints
- OIDC discovery endpoints

## Development Phases

### Phase 1: Core + Basic Plugins (MVP)
- Core broker with plugin system
- OAuth2 authorization code flow
- JWT validation
- Basic credential vault (PostgreSQL)
- Health checks and monitoring

### Phase 2: Advanced Auth
- SAML 2.0 support
- OAuth2 device flow
- Webhook signatures
- Auto-discovery v1

### Phase 3: Enterprise Features
- HSM integration
- Advanced rotation policies
- Multi-region replication
- Compliance reporting

### Phase 4: Intelligence Layer
- ML-based anomaly detection
- Predictive rotation
- Auth method recommendations
- Cost optimization suggestions

## Testing Strategy

Per CLAUDE.md requirements:

1. **Smoke Tests**: Basic auth flows for each plugin
2. **Chaos Tests**: Provider outages, network issues, token corruption
3. **Load Tests**: 10K auth/sec target
4. **Security Tests**: Penetration testing, secret scanning

## Success Metrics

- Time to integrate new service: < 5 minutes
- Auth-related incidents: 50% reduction
- Developer satisfaction: > 4.5/5
- Token refresh success rate: > 99.9%

## Open Questions

1. Should we support biometric auth in v1?
2. How to handle legacy auth methods (Basic, Digest)?
3. Build vs buy for HSM integration?
4. Pricing model for SaaS offering?

## Next Steps

1. Finalize plugin interface specification
2. Choose storage backend for MVP
3. Design detailed API schemas
4. Create reference implementation for OAuth2 plugin
5. Set up development environment with monitoring
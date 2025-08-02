# Next Session Guide - Universal Auth Broker

## Project Status

### ✅ Completed
1. **DESIGN.md** - Complete requirements analysis and architecture decisions
2. **SPEC.md** - Detailed API specification with endpoints and data models
3. **Core Plugin System** - Plugin interface and registry implemented
4. **All Auth Plugins** - Comprehensive implementations with NOTE-AI docs:
   - OAuth2/OIDC (with OAuth 2.1 compliance, PKCE mandatory)
   - JWT (validation-focused, JWKS support)
   - SAML 2.0 (SP-only, metadata-driven)
   - API Keys (multiple formats, entropy validation)
   - Webhook Signatures (provider presets, replay prevention)
   - Passkeys/WebAuthn (W3C compliant, future-proof)
5. **API Structure** - Routes for connections and plugins
6. **Security Implementations**:
   - Removed GET /token endpoint (no token vending)
   - Brokered calls pattern (POST /connections/{id}/request)
   - Secret management service (reference-based, vault backends)
   - Distributed state store (Redis for horizontal scaling)
7. **Architecture Review** - Incorporated all feedback from Gemini and Grok
8. **NOTE-AI Documentation** - Every critical decision documented at source

### 🚧 In Progress / Next Steps

#### 1. Credential Vault Implementation (Priority: High)
**File to create**: `src/services/credential-vault.ts`
```typescript
// Key responsibilities:
// - Encrypt credentials using AES-256-GCM
// - DEK/KEK pattern implementation
// - Integration with SecretManager for KEK retrieval
// - Soft delete with retention periods
// - Audit all access operations
```

#### 2. Database Schema Implementation (Priority: High)
**Actions needed**:
```bash
# Install Prisma
npm install prisma @prisma/client

# Initialize Prisma
npx prisma init

# Create schema based on SPEC.md models
```

**Schema to implement**:
```prisma
model Connection {
  id          String   @id @default(cuid())
  tenantId    String
  name        String
  service     String
  endpoint    String
  authType    String
  status      ConnectionStatus
  authConfig  Json
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  credentials Credential[]
  
  @@index([tenantId, status])
}

model Credential {
  id                String   @id @default(cuid())
  connectionId      String
  encryptedData     String   @db.Text
  encryptionKeyId   String
  algorithm         String   @default("AES-256-GCM")
  expiresAt         DateTime?
  version           Int      @default(1)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  deletedAt         DateTime? // Soft delete
  connection        Connection @relation(fields: [connectionId], references: [id])
  rotationSchedule  RotationSchedule?
  
  @@index([connectionId, version])
  @@index([expiresAt])
}

model RotationSchedule {
  id                String   @id @default(cuid())
  credentialId      String   @unique
  enabled           Boolean  @default(true)
  strategy          String   // "before_expiry", "fixed_schedule"
  rotationWindow    String   // "24h", "7d", etc
  lastRotation      DateTime?
  nextRotation      DateTime
  notificationUrl   String?
  credential        Credential @relation(fields: [credentialId], references: [id])
}

model AuditLog {
  id           String   @id @default(cuid())
  tenantId     String
  action       String
  resourceType String
  resourceId   String
  userId       String?
  metadata     Json
  timestamp    DateTime @default(now())
  
  @@index([tenantId, timestamp])
  @@index([resourceId])
}
```

#### 3. Complete Brokered Request Implementation (Priority: High)
**File to update**: `src/api/connections.ts`
```typescript
// Implement the POST /:connectionId/request endpoint:
// 1. Retrieve connection from database
// 2. Get credentials from vault
// 3. Decrypt credentials
// 4. Make HTTP request with injected auth
// 5. Return response (not credentials)
// 6. Audit the operation
```

#### 4. Rotation Engine Service (Priority: Medium)
**File to create**: `src/services/rotation-engine.ts`
```typescript
// Background service that:
// - Monitors credential expiration
// - Triggers rotation based on strategy
// - Manages overlap periods
// - Sends notifications
// - Updates credentials atomically
```

#### 5. Integration Tests (Priority: High)
**Files to create**: `tests/integration/`
- OAuth2 flow with mock provider
- JWT validation scenarios
- Secret management integration
- Distributed state verification
- Brokered calls end-to-end

#### 6. Plugin Sandboxing (Priority: Medium)
**Approach options**:
1. Node.js Worker Threads
2. WebAssembly (WASM) runtime
3. Separate processes with IPC
4. Docker containers (heavier)

**Key requirements**:
- Resource limits (CPU, memory)
- No direct file system access
- Controlled network access
- Timeout enforcement

#### 7. Compliance Engine Integration (Priority: Medium)
**File to create**: `src/services/policy-engine.ts`
- Integrate with Open Policy Agent (OPA)
- Define policies for:
  - Allowed auth methods per service
  - Secret access controls
  - Rate limiting rules
  - Compliance requirements (GDPR, SOX, HIPAA)

#### 8. Formal Threat Model (Priority: Medium)
**Update**: `DESIGN.md`
- STRIDE methodology analysis
- Attack surface mapping
- Mitigation strategies
- Security testing plan

## Environment Setup Checklist

- [ ] PostgreSQL database running
- [ ] Redis instance (or cluster) available
- [ ] Environment variables configured:
  ```env
  DATABASE_URL=postgresql://...
  REDIS_URL=redis://...
  JWT_SECRET=...
  ENCRYPTION_KEY=... (32 bytes)
  VAULT_URL=... (if using HashiCorp Vault)
  ```
- [ ] SSL certificates for development
- [ ] Docker Compose for local services

## Quick Commands

```bash
# Install all dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:smoke
```

## Architecture Decisions Log

### What We Built
1. **Plugin-based architecture** - Each auth method is isolated
2. **Reference-based secrets** - Never accept raw secrets in API
3. **Distributed state** - Redis for horizontal scaling
4. **Brokered calls** - Services never see raw tokens
5. **Comprehensive NOTE-AI docs** - Knowledge preserved at source

### Why These Matter
- **Security**: Dramatically reduced attack surface
- **Scalability**: Ready for multi-instance deployment
- **Maintainability**: Self-documenting code
- **Extensibility**: Easy to add new auth methods
- **Future-proof**: AI hooks, event-driven, standards-compliant

## Key Implementation Notes

### Secret References Format
```
vault:path/to/secret#key
aws:secretsmanager:region:secret-name
azure:keyvault:vault-name:secret-name
env:VARIABLE_NAME (dev only)
```

### State Store Keys
```
auth-broker:oauth:state:{state-id}
auth-broker:webauthn:challenge:{challenge-id}
auth-broker:saml:request:{request-id}
```

### Plugin Shared Services
Each plugin receives:
- `logger` - Structured logging (pino)
- `httpClient` - Configured with retries, timeouts
- `stateStore` - Distributed state management
- `secretManager` - Secure secret retrieval
- `eventBus` - Publish auth events
- `policyEngine` - Check auth policies

## Testing Strategy

1. **Unit Tests** - Each plugin, service, utility
2. **Integration Tests** - Full auth flows
3. **Chaos Tests** - Network failures, timeouts
4. **Load Tests** - 10K requests/sec target
5. **Security Tests** - Penetration testing scenarios

## Performance Targets
- Auth operations: < 100ms (p99)
- Token refresh: < 50ms (p99)
- Secret retrieval: < 200ms (with cache)
- Concurrent connections: 10K+
- Requests/sec: 10K (per instance)

## Monitoring & Observability

### Metrics to Track
- Auth success/failure rates by type
- Latency percentiles (p50, p95, p99)
- Secret access patterns
- Token expiration distribution
- Plugin health status

### Alerts to Configure
- High failure rate (> 1%)
- Slow auth operations (> 500ms)
- Secret access anomalies
- Redis connection issues
- Database connection pool exhaustion

## Next Major Milestones

1. **MVP Release** (Phase 1)
   - Core broker with OAuth2, JWT, API Keys
   - Basic credential vault
   - Brokered calls working
   - Docker deployment ready

2. **Enterprise Features** (Phase 2)
   - SAML support
   - Advanced rotation policies
   - Compliance reporting
   - Multi-region deployment

3. **Intelligence Layer** (Phase 3)
   - ML-based anomaly detection
   - Predictive token rotation
   - Smart auth method selection
   - Cost optimization

4. **Future Tech** (Phase 4)
   - Quantum-resistant algorithms
   - Verifiable Credentials (DIDs)
   - Edge deployment optimizations
   - AI-driven auth orchestration

## Resources & References

- [OAuth 2.1 Draft](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-07)
- [WebAuthn Level 2](https://www.w3.org/TR/webauthn-2/)
- [SAML 2.0 Specs](https://www.oasis-open.org/standards#samlv2.0)
- [NIST Crypto Guidelines](https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final)
- [STRIDE Threat Modeling](https://docs.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats)

---

**Remember**: This is setting a new standard for auth brokers. Every decision should prioritize security, scalability, and developer experience. The NOTE-AI documentation ensures nothing is lost between sessions! 🚀
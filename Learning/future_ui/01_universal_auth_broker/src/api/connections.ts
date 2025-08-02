import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AuthType } from '../types/plugin.js';

// NOTE-AI: Connection API Design - Critical Security Decisions
// ============================================================
// 
// SECURITY PRINCIPLE: NO TOKEN VENDING
// The broker should NEVER expose raw tokens via API endpoints. This creates
// a massive blast radius if compromised. Instead, we implement:
// 
// 1. BROKERED CALLS: Services ask the broker to make authenticated calls
// 2. SHORT-LIVED TOKENS: If absolutely needed, tokens expire in 60 seconds
// 3. STRICT ACCESS CONTROL: Separate privileged scope for token access
// 
// REMOVED ENDPOINTS:
// - GET /connections/{connectionId}/token - REMOVED for security
// 
// NEW PATTERN:
// - POST /connections/{connectionId}/request - Make authenticated request
// - Returns the API response, not the token
// 
// Rationale: This pattern keeps credentials within the security boundary
// of the broker, preventing token leakage and reducing attack surface.
// 
// Decision Date: 2024-01-15
// Revisit if: Absolute requirement for token vending (implement with extreme controls)

// NOTE-AI: Secret Management Pattern - CRITICAL SECURITY DESIGN
// ============================================================
// 
// NEVER accept secrets directly in API calls!
// Secrets should be referenced by ID/name and retrieved from secure storage.
// 
// PATTERN:
// 1. Secrets stored in vault (HashiCorp Vault, AWS Secrets Manager, etc.)
// 2. API accepts secret references (vault path, secret ID)
// 3. Broker retrieves secrets from vault with proper authentication
// 4. Secrets never appear in logs, monitoring, or memory dumps
// 
// This prevents secret exposure through:
// - Request logs
// - Application monitoring
// - Memory inspection
// - API documentation/examples

const CreateConnectionSchema = z.object({
  name: z.string(),
  service: z.string(),
  endpoint: z.string().url(),
  authConfig: z.object({
    type: z.nativeEnum(AuthType),
    clientId: z.string().optional(),
    // SECURITY: Use secret references, not raw secrets
    clientSecretRef: z.string().optional(), // e.g., "vault:secret/data/github/client-secret"
    apiKeyRef: z.string().optional(), // e.g., "aws:secretsmanager:api-keys/stripe"
    privateKeyRef: z.string().optional(), // e.g., "env:SAML_PRIVATE_KEY"
    // OAuth specific
    scopes: z.array(z.string()).optional(),
    redirectUri: z.string().url().optional(),
    // Direct values only for non-sensitive config
    issuer: z.string().optional(),
    audience: z.string().optional(),
  }).passthrough(),
  metadata: z.record(z.unknown()).optional()
});

const BrokeredRequestSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  path: z.string(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  timeout: z.number().min(1000).max(300000).default(30000) // 30s default
});

export const connectionRoutes: FastifyPluginAsync = async (fastify) => {
  // Create a new connection
  fastify.post('/', async (request, reply) => {
    try {
      const body = CreateConnectionSchema.parse(request.body);
      
      // Get the appropriate plugin
      const plugin = fastify.pluginRegistry.getPluginByAuthType(body.authConfig.type);
      if (!plugin) {
        return reply.status(400).send({
          error: {
            code: 'UNSUPPORTED_AUTH_TYPE',
            message: `Auth type ${body.authConfig.type} is not supported`
          }
        });
      }

      // Validate auth config against plugin schema
      const validationResult = plugin.validateConfig(body.authConfig);
      if (!validationResult.valid) {
        return reply.status(400).send({
          error: {
            code: 'INVALID_AUTH_CONFIG',
            message: 'Invalid authentication configuration',
            details: validationResult.errors
          }
        });
      }

      // Start auth flow if needed (OAuth2, SAML)
      if (plugin.id === 'oauth2' || plugin.id === 'saml') {
        const authResult = await plugin.startAuth(body.authConfig);
        
        // In a real implementation, we would:
        // 1. Generate connection ID
        // 2. Store connection in database
        // 3. Return auth URL for user to complete flow
        
        return reply.status(201).send({
          id: `conn_${Date.now()}`, // Mock ID
          name: body.name,
          service: body.service,
          authType: body.authConfig.type,
          status: 'pending_auth',
          authUrl: authResult.authUrl,
          createdAt: new Date().toISOString()
        });
      }

      // For API keys, JWT, etc - direct storage
      return reply.status(201).send({
        id: `conn_${Date.now()}`,
        name: body.name,
        service: body.service,
        authType: body.authConfig.type,
        status: 'active',
        createdAt: new Date().toISOString()
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: error.errors
          }
        });
      }
      throw error;
    }
  });

  // Make authenticated request through broker
  fastify.post('/:connectionId/request', async (request, reply) => {
    const { connectionId } = request.params as { connectionId: string };
    
    try {
      const body = BrokeredRequestSchema.parse(request.body);
      
      // NOTE-AI: This is the secure pattern - broker makes the call
      // 1. Retrieve connection and decrypt credentials
      // 2. Inject auth headers/params based on auth type
      // 3. Make the HTTP request
      // 4. Return response to client
      // 5. Log to audit trail
      
      // Mock implementation
      return reply.status(501).send({
        error: {
          code: 'NOT_IMPLEMENTED',
          message: 'Brokered requests not yet implemented',
          remediation: 'This is the secure way to use stored credentials'
        }
      });
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request format',
            details: error.errors
          }
        });
      }
      throw error;
    }
  });

  // List connections
  fastify.get('/', async (request, reply) => {
    // Mock response - would query database
    return {
      connections: [],
      pagination: {
        total: 0,
        page: 1,
        perPage: 20
      }
    };
  });

  // Get specific connection (no token exposure)
  fastify.get('/:connectionId', async (request, reply) => {
    const { connectionId } = request.params as { connectionId: string };
    
    // Would return connection metadata, NOT credentials
    return reply.status(404).send({
      error: {
        code: 'CONNECTION_NOT_FOUND',
        message: `Connection ${connectionId} not found`
      }
    });
  });

  // OAuth callback handler
  fastify.post('/:connectionId/callback', async (request, reply) => {
    const { connectionId } = request.params as { connectionId: string };
    
    // Would:
    // 1. Look up connection and its pending auth state
    // 2. Use appropriate plugin to complete auth
    // 3. Store credentials securely (broker handles encryption)
    // 4. Update connection status
    
    return {
      message: 'Callback handler not fully implemented yet',
      connectionId
    };
  });

  // Delete connection
  fastify.delete('/:connectionId', async (request, reply) => {
    const { connectionId } = request.params as { connectionId: string };
    
    // Would:
    // 1. Soft delete for compliance
    // 2. Schedule credential purge after retention period
    // 3. Emit deletion event
    
    return reply.status(204).send();
  });
};
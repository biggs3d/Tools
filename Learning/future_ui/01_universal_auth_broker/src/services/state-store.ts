import { Redis, Cluster } from 'ioredis';
import { pino } from 'pino';

// NOTE-AI: Distributed State Store - Critical for Horizontal Scaling
// ==================================================================
// 
// PROBLEM SOLVED:
// In-memory Maps don't work in production with multiple instances.
// OAuth state and WebAuthn challenges must be accessible across all
// broker instances for proper horizontal scaling.
// 
// IMPLEMENTATION:
// - Redis for distributed state (with Cluster/Sentinel support)
// - Automatic expiration (TTL) for all state
// - Atomic operations to prevent race conditions
// - Graceful fallback if Redis is unavailable (single-instance mode)
// 
// STATE TYPES:
// 1. OAuth State - CSRF protection for OAuth flows
// 2. WebAuthn Challenges - Prevent replay attacks
// 3. SAML Requests - Track pending SAML assertions
// 4. Temporary tokens - Short-lived auth tokens
// 
// SECURITY CONSIDERATIONS:
// - All state data is ephemeral (auto-expires)
// - State IDs are cryptographically random
// - No sensitive data in state (just IDs and metadata)
// - Redis AUTH and TLS in production
// 
// SCALING PATTERNS:
// - Redis Cluster for high availability
// - Read replicas for geo-distribution
// - Consistent hashing for predictable sharding
// - Connection pooling for performance
// 
// Decision Date: 2024-01-15
// Last Updated: 2024-01-15
// Revisit if: Moving to different distributed cache, edge deployment

interface StateData {
  id: string;
  type: 'oauth_state' | 'webauthn_challenge' | 'saml_request' | 'temp_token';
  data: Record<string, any>;
  createdAt: Date;
  expiresAt: Date;
}

export class DistributedStateStore {
  private redis: Redis | Cluster | null = null;
  private logger = pino({ name: 'state-store' });
  private fallbackStore = new Map<string, StateData>();
  private isConnected = false;
  
  constructor(private config: {
    redisUrl?: string;
    redisOptions?: any;
    enableCluster?: boolean;
    clusterNodes?: { host: string; port: number }[];
    keyPrefix?: string;
    fallbackToMemory?: boolean; // Only for development
  }) {
    this.initializeRedis();
  }
  
  private async initializeRedis(): Promise<void> {
    try {
      if (this.config.enableCluster && this.config.clusterNodes) {
        // Redis Cluster mode
        this.redis = new Cluster(this.config.clusterNodes, {
          redisOptions: this.config.redisOptions
        });
      } else if (this.config.redisUrl) {
        // Single Redis instance or Sentinel
        this.redis = new Redis(this.config.redisUrl, this.config.redisOptions);
      } else {
        throw new Error('No Redis configuration provided');
      }
      
      // Test connection
      await this.redis.ping();
      this.isConnected = true;
      this.logger.info('Connected to Redis for distributed state');
      
      // Handle connection events
      this.redis.on('error', (error) => {
        this.logger.error({ error }, 'Redis connection error');
        this.isConnected = false;
      });
      
      this.redis.on('connect', () => {
        this.logger.info('Redis connection restored');
        this.isConnected = true;
      });
      
    } catch (error) {
      this.logger.error({ error }, 'Failed to connect to Redis');
      
      if (this.config.fallbackToMemory && process.env.NODE_ENV !== 'production') {
        this.logger.warn('Falling back to in-memory state store - DO NOT USE IN PRODUCTION');
        this.redis = null; // Ensure redis is null for fallback
        this.isConnected = false;
        this.setupMemoryCleanup();
      } else {
        throw new Error('Redis is required for distributed state management');
      }
    }
  }
  
  async setState(
    key: string, 
    data: Record<string, any>, 
    type: StateData['type'],
    ttlSeconds: number = 300 // 5 minutes default
  ): Promise<void> {
    const stateData: StateData = {
      id: key,
      type,
      data,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (ttlSeconds * 1000))
    };
    
    const fullKey = this.getKey(key);
    
    if (this.isConnected && this.redis) {
      try {
        // Store in Redis with TTL
        await this.redis.setex(
          fullKey,
          ttlSeconds,
          JSON.stringify(stateData)
        );
        
        this.logger.debug({ key, type, ttl: ttlSeconds }, 'State stored in Redis');
      } catch (error) {
        this.logger.error({ error, key }, 'Failed to store state in Redis');
        throw error;
      }
    } else if (this.config.fallbackToMemory) {
      // Fallback to memory
      this.fallbackStore.set(fullKey, stateData);
      
      // Set timeout for expiration
      setTimeout(() => {
        this.fallbackStore.delete(fullKey);
      }, ttlSeconds * 1000);
      
      this.logger.debug({ key, type }, 'State stored in memory (fallback)');
    } else {
      throw new Error('No state store available');
    }
  }
  
  async getState(key: string): Promise<StateData | null> {
    const fullKey = this.getKey(key);
    
    if (this.isConnected && this.redis) {
      try {
        const data = await this.redis.get(fullKey);
        if (!data) return null;
        
        const parsed = JSON.parse(data) as StateData;
        parsed.createdAt = new Date(parsed.createdAt);
        parsed.expiresAt = new Date(parsed.expiresAt);
        
        // Check if expired (Redis should handle this, but double-check)
        if (parsed.expiresAt < new Date()) {
          await this.redis.del(fullKey);
          return null;
        }
        
        return parsed;
      } catch (error) {
        this.logger.error({ error, key }, 'Failed to get state from Redis');
        throw error;
      }
    } else if (this.config.fallbackToMemory) {
      const state = this.fallbackStore.get(fullKey);
      if (!state) return null;
      
      // Check expiration
      if (state.expiresAt < new Date()) {
        this.fallbackStore.delete(fullKey);
        return null;
      }
      
      return state;
    } else {
      throw new Error('No state store available');
    }
  }
  
  async deleteState(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    
    if (this.isConnected && this.redis) {
      try {
        await this.redis.del(fullKey);
        this.logger.debug({ key }, 'State deleted from Redis');
      } catch (error) {
        this.logger.error({ error, key }, 'Failed to delete state from Redis');
        throw error;
      }
    } else if (this.config.fallbackToMemory) {
      this.fallbackStore.delete(fullKey);
    } else {
      throw new Error('No state store available');
    }
  }
  
  // OAuth-specific helper
  async setOAuthState(
    state: string, 
    data: { codeVerifier?: string; config: any },
    ttlSeconds: number = 600 // 10 minutes for OAuth
  ): Promise<void> {
    await this.setState(state, data, 'oauth_state', ttlSeconds);
  }
  
  async getOAuthState(state: string): Promise<{ codeVerifier?: string; config: any } | null> {
    const stateData = await this.getState(state);
    return stateData?.data as any || null;
  }
  
  // WebAuthn-specific helper
  async setWebAuthnChallenge(
    challengeId: string,
    data: { challenge: string; userId?: string },
    ttlSeconds: number = 300 // 5 minutes for WebAuthn
  ): Promise<void> {
    await this.setState(challengeId, data, 'webauthn_challenge', ttlSeconds);
  }
  
  async getWebAuthnChallenge(challengeId: string): Promise<{ challenge: string; userId?: string } | null> {
    const stateData = await this.getState(challengeId);
    return stateData?.data as any || null;
  }
  
  // Atomic increment (for rate limiting, counters)
  async increment(key: string, ttlSeconds?: number): Promise<number> {
    const fullKey = this.getKey(key);
    
    if (this.isConnected && this.redis) {
      const result = await this.redis.incr(fullKey);
      if (ttlSeconds && result === 1) {
        await this.redis.expire(fullKey, ttlSeconds);
      }
      return result;
    } else {
      throw new Error('Increment requires Redis connection');
    }
  }
  
  private getKey(key: string): string {
    return this.config.keyPrefix ? `${this.config.keyPrefix}:${key}` : key;
  }
  
  private setupMemoryCleanup(): void {
    // Clean up expired entries periodically
    setInterval(() => {
      const now = new Date();
      for (const [key, state] of this.fallbackStore.entries()) {
        if (state.expiresAt < now) {
          this.fallbackStore.delete(key);
        }
      }
    }, 60000); // Every minute
  }
  
  async shutdown(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.fallbackStore.clear();
  }
  
  // Health check
  async isHealthy(): Promise<boolean> {
    if (!this.redis) return false;
    
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }
}
/**
 * Simple cache implementation for LLM responses to reduce API calls
 */

export interface CacheOptions {
    /** Maximum number of items in the cache */
    maxSize?: number;
    /** Time-to-live in milliseconds (0 = no expiration) */
    ttlMs?: number;
}

export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    hitRate: number;
}

/**
 * Default cache options
 */
const DEFAULT_CACHE_OPTIONS: CacheOptions = {
    maxSize: 1000,
    ttlMs: 1000 * 60 * 30 // 30 minutes
};

/**
 * Cache entry with expiration
 */
interface CacheEntry<T> {
    value: T;
    expiresAt: number;
    createdAt: number;
}

/**
 * Simple in-memory LRU-like cache for LLM responses
 */
export class ResponseCache<T = string> {
    private cache: Map<string, CacheEntry<T>> = new Map();
    private options: Required<CacheOptions>;
    private stats = {
        hits: 0,
        misses: 0
    };

    constructor(options: CacheOptions = {}) {
        this.options = {
            ...DEFAULT_CACHE_OPTIONS,
            ...options
        } as Required<CacheOptions>;
    }

    /**
     * Set a value in the cache
     */
    set(key: string, value: T): void {
        // Ensure key is a string
        const cacheKey = String(key || '');

        // Calculate expiration time
        const now = Date.now();
        const expiresAt = this.options.ttlMs ? now + this.options.ttlMs : 0;

        // Add to cache
        this.cache.set(cacheKey, {
            value,
            expiresAt,
            createdAt: now
        });

        // Enforce max size
        if (this.options.maxSize && this.cache.size > this.options.maxSize) {
            // Remove oldest entry (approximation of LRU)
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }
    }

    /**
     * Get a value from the cache
     */
    get(key: string): T | undefined {
        // Ensure key is a string
        const cacheKey = String(key || '');
        const entry = this.cache.get(cacheKey);

        if (!entry) {
            this.stats.misses++;
            return undefined;
        }

        // Check if expired
        if (entry.expiresAt && entry.expiresAt < Date.now()) {
            this.cache.delete(cacheKey);
            this.stats.misses++;
            return undefined;
        }

        this.stats.hits++;
        return entry.value;
    }

    /**
     * Clear the cache
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats(): CacheStats {
        const total = this.stats.hits + this.stats.misses;
        return {
            hits: this.stats.hits,
            misses: this.stats.misses,
            size: this.cache.size,
            hitRate: total > 0 ? this.stats.hits / total : 0
        };
    }

    /**
     * Reset cache statistics
     */
    resetStats(): void {
        this.stats = { hits: 0, misses: 0 };
    }

    /**
     * Prune expired entries
     */
    prune(): number {
        if (!this.options.ttlMs) return 0;

        const now = Date.now();
        let pruned = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && entry.expiresAt < now) {
                this.cache.delete(key);
                pruned++;
            }
        }

        return pruned;
    }
}

// Global cache instance for LLM responses
export const llmResponseCache = new ResponseCache<string>();

/**
 * Wrapper for LLM calls with caching
 */
export async function withCache<T>(
    cacheKey: string,
    fn: () => Promise<T>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cache: ResponseCache<T> = llmResponseCache as any,
    cacheable: boolean = true
): Promise<T> {
    // Skip cache if caching is disabled
    if (!cacheable) {
        return fn();
    }

    // Try to get from cache
    const cached = cache.get(cacheKey);
    if (cached !== undefined) {
        return cached;
    }

    // Execute the function
    const result = await fn();

    // Cache the result
    cache.set(cacheKey, result);

    return result;
}
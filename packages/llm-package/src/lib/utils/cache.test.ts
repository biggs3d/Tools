/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResponseCache, withCache } from './cache.js';

describe('Cache Utils', () => {
    describe('ResponseCache', () => {
        let cache: ResponseCache;
        
        beforeEach(() => {
            cache = new ResponseCache({
                maxSize: 5,
                ttlMs: 100
            });
        });
        
        it('should store and retrieve values', () => {
            cache.set('key1', 'value1');
            
            expect(cache.get('key1')).toBe('value1');
        });
        
        it('should return undefined for non-existent keys', () => {
            expect(cache.get('nonexistent')).toBeUndefined();
        });
        
        it('should respect max size limit', () => {
            // Add 6 items to a cache with max size 5
            for (let i = 0; i < 6; i++) {
                cache.set(`key${i}`, `value${i}`);
            }
            
            // First item should be evicted
            expect(cache.get('key0')).toBeUndefined();
            expect(cache.get('key5')).toBe('value5');
        });
        
        it('should respect TTL', async () => {
            cache.set('expiring', 'value');
            
            // Should be present immediately
            expect(cache.get('expiring')).toBe('value');
            
            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Should be gone after TTL
            expect(cache.get('expiring')).toBeUndefined();
        });
        
        it('should track hits and misses', () => {
            cache.set('hit', 'value');
            
            // Reset stats
            cache.resetStats();
            
            // Generate some hits and misses
            cache.get('hit');
            cache.get('hit');
            cache.get('miss');
            cache.get('miss');
            cache.get('miss');
            
            const stats = cache.getStats();
            
            expect(stats.hits).toBe(2);
            expect(stats.misses).toBe(3);
            expect(stats.hitRate).toBeCloseTo(0.4);
        });
        
        it('should prune expired entries', async () => {
            cache.set('expire1', 'value1');
            cache.set('expire2', 'value2');
            
            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, 150));
            
            // Add a new entry that won't expire yet
            cache.set('fresh', 'value');
            
            // Prune should remove 2 expired entries
            const pruned = cache.prune();
            expect(pruned).toBe(2);
            
            // Only the fresh entry should remain
            expect(cache.getStats().size).toBe(1);
            expect(cache.get('fresh')).toBe('value');
        });
        
        it('should clear all entries', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            
            cache.clear();
            
            expect(cache.get('key1')).toBeUndefined();
            expect(cache.get('key2')).toBeUndefined();
            expect(cache.getStats().size).toBe(0);
        });
    });
    
    describe('withCache', () => {
        let cache: ResponseCache;
        
        beforeEach(() => {
            cache = new ResponseCache();
            cache.resetStats();
        });
        
        it('should cache function results', async () => {
            const fn = vi.fn().mockResolvedValue('result');
            
            // First call should execute the function
            const result1 = await withCache('key', fn, cache);
            expect(result1).toBe('result');
            expect(fn).toHaveBeenCalledTimes(1);
            
            // Second call should use cached result
            const result2 = await withCache('key', fn, cache);
            expect(result2).toBe('result');
            expect(fn).toHaveBeenCalledTimes(1); // Still only called once
        });
        
        it('should bypass cache when cacheable is false', async () => {
            const fn = vi.fn().mockResolvedValue('result');
            
            // First call with caching disabled
            await withCache('key', fn, cache, false);
            expect(fn).toHaveBeenCalledTimes(1);
            
            // Second call with caching disabled
            await withCache('key', fn, cache, false);
            expect(fn).toHaveBeenCalledTimes(2); // Called again
        });
        
        it('should propagate errors', async () => {
            const error = new Error('Test error');
            const fn = vi.fn().mockRejectedValue(error);
            
            await expect(withCache('key', fn, cache)).rejects.toThrow('Test error');
        });
    });
});
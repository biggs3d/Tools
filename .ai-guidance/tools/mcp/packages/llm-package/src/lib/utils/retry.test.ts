/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { retry } from './retry.js';

describe('Retry Utils', () => {
    // Mock setTimeout to speed up tests
    vi.useFakeTimers({ shouldAdvanceTime: true });
    
    beforeEach(() => {
        vi.clearAllMocks();
    });
    
    it('should execute function and return result', async () => {
        const fn = vi.fn().mockResolvedValue('success');
        
        const promise = retry(fn);
        vi.runAllTimers();
        
        const result = await promise;
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });
    
    it('should retry on failure', async () => {
        const error = new Error('Test error');
        const fn = vi.fn()
            .mockRejectedValueOnce(error)
            .mockResolvedValueOnce('success');
        
        // Use a simpler approach with minimal timeouts
        const result = await retry(fn, { 
            maxAttempts: 2,
            initialDelayMs: 10, // Use a short delay
            useExponentialBackoff: false
        });
        
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });
    
    it('should respect max attempts', async () => {
        const error = new Error('Test error');
        const fn = vi.fn().mockRejectedValue(error);
        
        // Use a simpler approach with minimal timeouts
        try {
            await retry(fn, { 
                maxAttempts: 3,
                initialDelayMs: 10, // Use a short delay
                useExponentialBackoff: false
            });
            // If we get here, the test should fail
            expect(true).toBe(false);
        } catch (e) {
            expect(e.message).toBe('Test error');
        }
        
        expect(fn).toHaveBeenCalledTimes(3);
    });
    
    it('should support backoff options', async () => {
        // Simplified test that just verifies options are accepted
        const fn = vi.fn().mockResolvedValue('success');
        
        const result = await retry(fn, {
            maxAttempts: 3,
            initialDelayMs: 100,
            useExponentialBackoff: true,
            jitter: 0
        });
        
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });
    
    it('should support isRetryable predicate', async () => {
        // Simplified test that just verifies options are accepted
        const fn = vi.fn().mockResolvedValue('success');
        
        const isRetryable = vi.fn().mockReturnValue(true);
        
        const result = await retry(fn, { 
            maxAttempts: 3,
            initialDelayMs: 10,
            isRetryable
        });
        
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
        // isRetryable is not called when there's no error
        expect(isRetryable).not.toHaveBeenCalled();
    });
});
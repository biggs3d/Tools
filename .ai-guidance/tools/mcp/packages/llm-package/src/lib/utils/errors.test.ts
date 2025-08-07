/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect } from 'vitest';
import {
    LLMError,
    LLMConfigurationError,
    LLMRateLimitError,
    LLMNetworkError,
    LLMTimeoutError,
    LLMAuthenticationError,
    LLMModelError,
    LLMContentError,
    LLMParsingError,
    isRetryableError
} from './errors.js';

describe('Error Utils', () => {
    describe('Custom Error Classes', () => {
        it('should create base LLM error', () => {
            const error = new LLMError('Test error');
            
            expect(error.name).toBe('LLMError');
            expect(error.message).toBe('Test error');
            expect(error.cause).toBeUndefined();
            expect(error instanceof Error).toBe(true);
            expect(error instanceof LLMError).toBe(true);
        });
        
        it('should create LLM error with cause', () => {
            const cause = new Error('Cause error');
            const error = new LLMError('Test error', cause);
            
            expect(error.cause).toBe(cause);
        });
        
        it('should create configuration error', () => {
            const error = new LLMConfigurationError('Invalid config');
            
            expect(error.name).toBe('LLMConfigurationError');
            expect(error.message).toBe('Invalid config');
            expect(error instanceof LLMError).toBe(true);
            expect(error instanceof LLMConfigurationError).toBe(true);
        });
        
        it('should create rate limit error', () => {
            const error = new LLMRateLimitError('Rate limited', 5000);
            
            expect(error.name).toBe('LLMRateLimitError');
            expect(error.message).toBe('Rate limited');
            expect(error.retryAfterMs).toBe(5000);
            expect(error instanceof LLMError).toBe(true);
            expect(error instanceof LLMRateLimitError).toBe(true);
        });
        
        it('should create network error', () => {
            const error = new LLMNetworkError('Network failure');
            
            expect(error.name).toBe('LLMNetworkError');
            expect(error.message).toBe('Network failure');
            expect(error instanceof LLMError).toBe(true);
            expect(error instanceof LLMNetworkError).toBe(true);
        });
        
        it('should create timeout error', () => {
            const error = new LLMTimeoutError('Request timeout', 30000);
            
            expect(error.name).toBe('LLMTimeoutError');
            expect(error.message).toBe('Request timeout');
            expect(error.timeoutMs).toBe(30000);
            expect(error instanceof LLMError).toBe(true);
            expect(error instanceof LLMTimeoutError).toBe(true);
        });
        
        it('should create authentication error', () => {
            const error = new LLMAuthenticationError('Invalid API key');
            
            expect(error.name).toBe('LLMAuthenticationError');
            expect(error.message).toBe('Invalid API key');
            expect(error instanceof LLMError).toBe(true);
            expect(error instanceof LLMAuthenticationError).toBe(true);
        });
        
        it('should create model error', () => {
            const error = new LLMModelError('Model not found', 'gpt-5');
            
            expect(error.name).toBe('LLMModelError');
            expect(error.message).toBe('Model not found');
            expect(error.modelName).toBe('gpt-5');
            expect(error instanceof LLMError).toBe(true);
            expect(error instanceof LLMModelError).toBe(true);
        });
        
        it('should create content error', () => {
            const error = new LLMContentError('Content policy violation');
            
            expect(error.name).toBe('LLMContentError');
            expect(error.message).toBe('Content policy violation');
            expect(error instanceof LLMError).toBe(true);
            expect(error instanceof LLMContentError).toBe(true);
        });
        
        it('should create parsing error', () => {
            const error = new LLMParsingError('Failed to parse JSON', 'Invalid JSON');
            
            expect(error.name).toBe('LLMParsingError');
            expect(error.message).toBe('Failed to parse JSON');
            expect(error.rawResponse).toBe('Invalid JSON');
            expect(error instanceof LLMError).toBe(true);
            expect(error instanceof LLMParsingError).toBe(true);
        });
    });
    
    describe('isRetryableError', () => {
        it('should identify network errors as retryable', () => {
            const error = new LLMNetworkError('Connection error');
            expect(isRetryableError(error)).toBe(true);
        });
        
        it('should identify rate limit errors as retryable', () => {
            const error = new LLMRateLimitError('Too many requests', 1000);
            expect(isRetryableError(error)).toBe(true);
        });
        
        it('should identify timeout errors as retryable', () => {
            const error = new LLMTimeoutError('Request timeout', 30000);
            expect(isRetryableError(error)).toBe(true);
        });
        
        it('should identify errors with retryable messages', () => {
            const tests = [
                new Error('timeout occurred'),
                new Error('rate limit exceeded'),
                new Error('too many requests'),
                new Error('service is at capacity'),
                new Error('please retry later'),
                new Error('server is overloaded'),
                new Error('service temporarily unavailable')
            ];
            
            for (const error of tests) {
                expect(isRetryableError(error)).toBe(true);
            }
        });
        
        it('should identify non-retryable errors', () => {
            const tests = [
                new LLMAuthenticationError('Invalid API key'),
                new LLMConfigurationError('Missing required parameter'),
                new LLMContentError('Content policy violation'),
                new LLMModelError('Model not found', 'gpt-5'),
                new Error('invalid request'),
                new Error('bad parameter')
            ];
            
            for (const error of tests) {
                expect(isRetryableError(error)).toBe(false);
            }
        });
        
        it('should handle non-error objects', () => {
            const tests = [
                null,
                undefined,
                {},
                { code: 'ERROR' },
                { message: null }
            ];
            
            for (const value of tests) {
                expect(isRetryableError(value)).toBe(false);
            }
        });
    });
});
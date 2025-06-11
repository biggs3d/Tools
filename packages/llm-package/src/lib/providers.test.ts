/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIProvider } from './providers/openaiProvider.js';
import { AnthropicProvider } from './providers/anthropicProvider.js';
import { AzureOpenAIProvider } from './providers/azureOpenAIProvider.js';
import { LLMClient, LLMProvider } from './types.js';
import { LLMMemoryClient } from './llmProvider.js';

// Mock OpenAI client
vi.mock('openai', () => {
    return {
        default: class MockOpenAI {
            apiKey: string = 'mock-api-key';
            chat = {
                completions: {
                    create: vi.fn().mockResolvedValue({
                        choices: [{ message: { content: 'Test response' } }]
                    })
                }
            };
            embeddings = {
                create: vi.fn().mockResolvedValue({
                    data: [{ embedding: Array(10).fill(0).map((_, i) => i/10) }]
                })
            };
        }
    };
});

// Mock dynamic import for Anthropic
vi.mock('@anthropic-ai/sdk', () => {
    return {
        default: class MockAnthropic {
            constructor() {
                // Mock constructor
            }
            messages = {
                create: vi.fn().mockResolvedValue({
                    content: [{ text: 'Test response' }]
                })
            };
        }
    };
}, { virtual: true });

describe('Provider Tests', () => {
    // Test functions to run for each provider
    const runProviderTests = (name: string, provider: LLMProvider) => {
        describe(`${name} Provider`, () => {
            it('should return provider and model names', () => {
                expect(provider.getProviderName()).toBeDefined();
                expect(provider.getModelName()).toBeDefined();
            });
            
            it('should complete prompts', async () => {
                const result = await provider.complete('Test prompt');
                expect(result).toBeDefined();
            });
            
            // Only test these if the provider implements these methods
            if (provider.countTokens !== undefined) {
                it('should count tokens', async () => {
                    const count = await provider.countTokens!('Test text');
                    expect(typeof count).toBe('number');
                    expect(count).toBeGreaterThan(0);
                });
            }
            
            if (provider.getEmbedding !== undefined) {
                it('should generate embeddings', async () => {
                    const embedding = await provider.getEmbedding!('Test text');
                    expect(Array.isArray(embedding)).toBe(true);
                    expect(embedding.length).toBeGreaterThan(0);
                });
            }
        });
    };
    
    describe('OpenAI Provider', () => {
        // Setup the provider with mock config
        const provider = new OpenAIProvider({
            provider: 'openai',
            apiKey: 'test-key',
            model: 'gpt-4'
        });
        
        runProviderTests('OpenAI', provider);
    });
    
    describe('Memory Client Integration', () => {
        let client: LLMClient;
        
        beforeEach(() => {
            const provider = new OpenAIProvider({
                provider: 'openai',
                apiKey: 'test-key',
                model: 'gpt-4'
            });
            client = new LLMMemoryClient(provider);
        });
        
        it('should return provider and model names', () => {
            expect(client.getProviderName()).toBe('openai');
            expect(client.getModelName()).toBe('gpt-4');
        });
        
        it('should handle memory operations', async () => {
            // These will use the mocked OpenAI client
            await expect(client.calculateImportance('test')).resolves.not.toThrow();
            await expect(client.summarizeObservations(['test1', 'test2'])).resolves.not.toThrow();
            await expect(client.generateAbstraction(['test1', 'test2'])).resolves.not.toThrow();
            await expect(client.rateSimilarity('test1', 'test2')).resolves.not.toThrow();
            await expect(client.clusterObservations(['test1', 'test2', 'test3'])).resolves.not.toThrow();
        });
    });
});
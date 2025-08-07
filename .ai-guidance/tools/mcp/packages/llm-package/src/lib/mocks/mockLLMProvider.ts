/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.14
 * https://github.com/biggs3d/McpMemoryServer
 */

import { BaseLLMProvider } from '../llmProvider.js';
import { LLMConfig, CompletionOptions } from '../types.js';

/**
 * Mock LLM provider for testing that doesn't require API keys
 */
export class MockLLMProvider extends BaseLLMProvider {
    private readonly responses: Record<string, string>;

    constructor(
        config: LLMConfig = {
            provider: 'openai', // Use a valid provider type for TypeScript
            apiKey: 'mock-key'
        },
        mockResponses?: Record<string, string>
    ) {
        super(config);
        
        // Default responses for common operations
        this.responses = {
            // Default response for any prompt
            default: 'Mock response',
            
            // Response for importance scoring (return a number 0-10)
            importance: '7',
            
            // Response for similarity rating (return a number 0-1)
            similarity: '0.85',
            
            // Response for memory summarization
            summarize: 'Summarized observation containing key points',
            
            // Response for abstraction generation
            abstraction: 'Abstract principle derived from the observations',
            
            // Response for clustering (must be valid JSON)
            cluster: JSON.stringify([[0, 1], [2, 3]])
        };
        
        // Override with custom responses if provided
        if (mockResponses) {
            this.responses = { ...this.responses, ...mockResponses };
        }
    }
    
    getProviderName(): string {
        return 'mock';
    }
    
    getModelName(): string {
        return 'mock-model';
    }
    
    async complete(prompt: string, _options?: CompletionOptions): Promise<string> {
        // Check if the prompt matches any of our special cases
        if (prompt.includes('importance') || prompt.includes('rate') && prompt.includes('0-10')) {
            return this.responses.importance;
        }
        
        if (prompt.includes('similarity') || (prompt.includes('rate') && prompt.includes('0-1'))) {
            return this.responses.similarity;
        }
        
        if (prompt.includes('summarize') || prompt.includes('summary')) {
            return this.responses.summarize;
        }
        
        if (prompt.includes('abstract') || prompt.includes('pattern')) {
            return this.responses.abstraction;
        }
        
        if (prompt.includes('cluster') || prompt.includes('group')) {
            return this.responses.cluster;
        }
        
        // Fall back to default response
        return this.responses.default;
    }
    
    async countTokens(text: string): Promise<number> {
        // Simple mock implementation
        return Math.ceil(text.length / 4);
    }
    
    async getEmbedding(_text: string): Promise<number[]> {
        // Return a deterministic mock embedding vector
        return Array(128).fill(0).map((_, i) => (i % 10) / 10);
    }
    
    // Allows you to update mock responses at runtime
    setMockResponse(key: string, value: string): void {
        this.responses[key] = value;
    }
}
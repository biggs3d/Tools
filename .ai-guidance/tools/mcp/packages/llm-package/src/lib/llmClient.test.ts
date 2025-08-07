/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

// Create a mock LLM provider for testing
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {CompletionOptions, LLMConfig} from './types.js';
import {BaseLLMProvider, LLMMemoryClient} from './llmProvider.js';

class MockLLMProvider extends BaseLLMProvider {
    constructor(config: LLMConfig = {provider: 'openai', apiKey: 'test-key'}) {
        super(config);
    }

    getProviderName(): string {
        return 'mock';
    }

    getModelName(): string {
        return 'mock-model';
    }

    async complete(prompt: string, _options?: CompletionOptions): Promise<string> {
        // Return predictable responses for testing
        if (prompt.includes('importance')) {
            return '7';
        }

        if (prompt.includes('similarity')) {
            return '0.85';
        }

        if (prompt.includes('summarize') || prompt.includes('summary')) {
            return 'Summarized content';
        }

        if (prompt.includes('abstraction') || prompt.includes('abstract')) {
            return 'Abstract pattern from observations';
        }

        if (prompt.includes('cluster')) {
            return JSON.stringify([[1, 2], [3, 4]]);
        }

        return 'Mock response';
    }

    async getEmbedding(text: string): Promise<number[]> {
        // Return a deterministic mock embedding
        return Array(10).fill(0).map((_, i) => i / 10);
    }
}

describe('LLMMemoryClient', () => {
    let client: LLMMemoryClient;
    let mockProvider: MockLLMProvider;

    beforeEach(() => {
        mockProvider = new MockLLMProvider();
        client = new LLMMemoryClient(mockProvider);
    });

    it('should get provider and model names', () => {
        expect(client.getProviderName()).toBe('mock');
        expect(client.getModelName()).toBe('mock-model');
    });

    it('should forward complete calls to provider', async () => {
        const spy = vi.spyOn(mockProvider, 'complete');
        const result = await client.complete('test prompt');

        expect(spy).toHaveBeenCalledWith('test prompt', undefined);
        expect(result).toBe('Mock response');
    });

    it('should calculate importance score', async () => {
        const score = await client.calculateImportance('This is an important memory');
        expect(score).toBe(7);
    });

    it('should rate similarity between texts', async () => {
        const similarity = await client.rateSimilarity('text1', 'text2');
        expect(similarity).toBe(0.85);
    });

    it('should generate abstractions from observations', async () => {
        const abstraction = await client.generateAbstraction(['obs1', 'obs2']);
        expect(abstraction).toBe('Abstract pattern from observations');
    });

    it('should summarize observations', async () => {
        const summaries = await client.summarizeObservations(['obs1', 'obs2']);
        expect(summaries).toEqual(['Summarized content']);
    });

    it('should cluster observations', async () => {
        const observations = ['obs1', 'obs2', 'obs3', 'obs4'];
        const clusters = await client.clusterObservations(observations);

        // Just check that we get a result with the observations
        expect(clusters.length).toBeGreaterThan(0);
        expect(clusters[0].length).toBeGreaterThan(0);
        expect(observations).toContain(clusters[0][0]);
    });

    it('should get embeddings', async () => {
        const embedding = await client.getEmbedding('test text');
        expect(embedding.length).toBe(10);
        expect(embedding[5]).toBe(0.5);
    });
});
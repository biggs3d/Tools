/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMMemoryClient } from './llmProvider.js';
import { MockLLMProvider } from './mocks/mockLLMProvider.js';
import { SummarizationOptions } from './types.js';

describe('LLMMemoryClient', () => {
    let mockProvider: MockLLMProvider;
    let client: LLMMemoryClient;
    
    beforeEach(() => {
        mockProvider = new MockLLMProvider();
        client = new LLMMemoryClient(mockProvider);
    });
    
    it('should provide provider metadata', () => {
        expect(client.getProviderName()).toBe('mock');
        expect(client.getModelName()).toBe('mock-model');
    });
    
    it('should forward completion requests to provider', async () => {
        const spy = vi.spyOn(mockProvider, 'complete');
        const result = await client.complete('Test prompt');
        
        expect(spy).toHaveBeenCalledWith('Test prompt', undefined);
        expect(result).toBe('Mock response');
    });
    
    it('should calculate importance scores for memory content', async () => {
        const content = 'This is an important memory about user preferences';
        const score = await client.calculateImportance(content);
        
        expect(score).toBe(7);
    });
    
    it('should calculate importance with context', async () => {
        const spy = vi.spyOn(mockProvider, 'complete');
        const content = 'User prefers dark mode';
        const context = 'UI preferences';
        
        await client.calculateImportance(content, context);
        
        // Verify that context is included in the prompt
        expect(spy).toHaveBeenCalled();
        const prompt = spy.mock.calls[0][0];
        expect(prompt).toContain(content);
        expect(prompt).toContain(context);
    });
    
    it('should rate similarity between two texts', async () => {
        const text1 = 'The user prefers dark mode';
        const text2 = 'The user likes dark themes for UI';
        
        const similarity = await client.rateSimilarity(text1, text2);
        
        expect(similarity).toBe(0.85);
    });
    
    it('should generate abstractions from observations', async () => {
        const observations = [
            'User enabled dark mode in the app',
            'User mentioned they find light themes cause eye strain',
            'User installed browser extension for dark mode'
        ];
        
        const abstraction = await client.generateAbstraction(observations);
        
        expect(abstraction).toBe('Abstract principle derived from the observations');
    });
    
    it('should summarize observations', async () => {
        const observations = [
            'User clicked on settings',
            'User toggled dark mode on',
            'User adjusted font size to larger'
        ];
        
        const options: SummarizationOptions = {
            summaryType: 'concise',
            maxSummaries: 1
        };
        
        const summaries = await client.summarizeObservations(observations, options);
        
        expect(summaries).toHaveLength(1);
        expect(summaries[0]).toBe('Summarized observation containing key points');
    });
    
    it('should handle empty observations', async () => {
        const observations: string[] = [];
        const summaries = await client.summarizeObservations(observations);
        
        expect(summaries).toEqual(observations);
    });
    
    it('should cluster observations by similarity', async () => {
        const observations = [
            'User enabled dark mode',
            'User prefers dark theme in IDE',
            'User runs tests before committing code',
            'User follows TDD principles'
        ];
        
        const clusters = await client.clusterObservations(observations);
        
        // Just verify we get back a result with all observations
        expect(clusters.length).toBeGreaterThan(0);
        const allObservationsInClusters = clusters.flat();
        expect(allObservationsInClusters.length).toBe(observations.length);
        
        for (const obs of observations) {
            expect(allObservationsInClusters).toContain(obs);
        }
    });
    
    it('should generate embeddings for text', async () => {
        const spy = vi.spyOn(mockProvider, 'getEmbedding');
        const embedding = await client.getEmbedding('Test text');
        
        expect(spy).toHaveBeenCalled();
        expect(embedding.length).toBeGreaterThan(0);
    });
    
    it('should handle embedding support check', async () => {
        // We'll just check that embeddings work in the regular case
        const embedding = await client.getEmbedding('test');
        expect(embedding.length).toBeGreaterThan(0);
    });
    
    it('should handle parsing errors in clustering', async () => {
        // Set invalid JSON response for clustering
        mockProvider.setMockResponse('cluster', 'Not valid JSON');
        
        const observations = ['Obs1', 'Obs2', 'Obs3', 'Obs4'];
        
        // Should fall back to returning all observations as one cluster
        const clusters = await client.clusterObservations(observations);
        
        expect(clusters).toHaveLength(1);
        expect(clusters[0]).toEqual(observations);
    });
});
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { 
    countTokens, 
    countObjectTokens, 
    createSnippet, 
    createMemorySummary, 
    buildTokenAwareResponse, 
    formatTokenAwareResponse,
    cleanup as cleanupTokenizer 
} from '../src/lib/token-utils.js';
import type { CleanMemoryRecord, CleanMemorySearchResult } from '@mcp/shared-types';
import type { MCPResponseConfig } from '../src/config.js';

const testConfig: MCPResponseConfig = {
    tokenLimit: 25000,
    tokenBuffer: 1000,
    fullMemoryTokenThreshold: 0.7
};

// Smaller token limit for testing truncation behavior
const testConfigSmall: MCPResponseConfig = {
    tokenLimit: 6000,
    tokenBuffer: 1000,
    fullMemoryTokenThreshold: 0.7
};

describe('Token-aware Response System', () => {
    afterAll(() => {
        cleanupTokenizer();
    });

    describe('Token Counting', () => {
        it('should count tokens accurately for Claude', () => {
            const text = 'This is a test string for token counting.';
            const tokens = countTokens(text, 'claude-3');
            expect(tokens).toBeGreaterThan(0);
            expect(tokens).toBeLessThan(text.length); // Should be less than character count
        });

        it('should estimate tokens for Gemini models', () => {
            const text = 'This is a test string for token counting.';
            const tokens = countTokens(text, 'gemini-pro');
            expect(tokens).toBeGreaterThan(0);
            expect(tokens).toBeLessThan(text.length); // Should be less than character count
            // For Gemini, should use estimation (~3.5 chars per token)
            expect(tokens).toBeCloseTo(text.length / 3.5, 0);
        });

        it('should count object tokens', () => {
            const obj = { key: 'value', nested: { data: 'test' } };
            const tokens = countObjectTokens(obj);
            expect(tokens).toBeGreaterThan(0);
        });
    });

    describe('Snippet Creation', () => {
        it('should create snippets at sentence boundaries', () => {
            const content = 'This is the first sentence. This is the second sentence. This is the third.';
            const snippet = createSnippet(content, 50);
            expect(snippet).toBe('This is the first sentence. This is the second...');
        });

        it('should handle content shorter than max length', () => {
            const content = 'Short content';
            const snippet = createSnippet(content, 100);
            expect(snippet).toBe('Short content');
        });
    });

    describe('Memory Summary Creation', () => {
        it('should create summary from memory record', () => {
            const memory: CleanMemoryRecord = {
                id: 'test-123',
                content: 'This is a long memory content that should be truncated in the summary to keep token count low.',
                importance: 8,
                tags: ['test', 'example'],
                createdAt: new Date().toISOString(),
                lastAccessed: new Date().toISOString(),
                accessCount: 5,
                relatedCount: 2
            };

            const summary = createMemorySummary(memory);
            expect(summary.id).toBe(memory.id);
            expect(summary.importance).toBe(memory.importance);
            expect(summary.tags).toEqual(memory.tags);
            expect(summary.relatedCount).toBe(2);
            expect(summary.tokenCount).toBeGreaterThan(0);
        });

        it('should include similarity score when present', () => {
            const searchResult: CleanMemorySearchResult = {
                id: 'test-456',
                content: 'Memory with similarity',
                importance: 7,
                tags: ['search'],
                createdAt: new Date().toISOString(),
                lastAccessed: new Date().toISOString(),
                accessCount: 3,
                similarity: 0.92
            };

            const summary = createMemorySummary(searchResult);
            expect(summary.similarity).toBe(0.92);
        });
    });

    describe('Token-aware Response Building', () => {
        const createTestMemory = (id: string, importance: number, contentLength: number = 100): CleanMemoryRecord => ({
            id,
            content: 'x'.repeat(contentLength),
            importance,
            tags: ['test'],
            createdAt: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
            accessCount: 1
        });

        it('should prioritize high-importance memories for full inclusion', () => {
            const memories = [
                createTestMemory('low-1', 3, 1000),
                createTestMemory('high-1', 9, 1000),
                createTestMemory('med-1', 5, 1000),
                createTestMemory('high-2', 8, 1000)
            ];

            const response = buildTokenAwareResponse(memories, testConfigSmall);
            
            // High importance memories should be in fullMemories
            expect(response.fullMemories.some(m => m.id === 'high-1')).toBe(true);
            expect(response.fullMemories.some(m => m.id === 'high-2')).toBe(true);
            
            // Lower importance should be summaries
            expect(response.summaries.some(s => s.id === 'low-1')).toBe(true);
        });

        it('should respect token limits', () => {
            const memories = Array.from({ length: 100 }, (_, i) => 
                createTestMemory(`mem-${i}`, 5, 10000) // Very large memories
            );

            const response = buildTokenAwareResponse(memories, testConfigSmall);
            
            expect(response.truncated).toBe(true);
            expect(response.tokenCount).toBeLessThanOrEqual(testConfigSmall.tokenLimit - testConfigSmall.tokenBuffer);
            expect(response.totalFound).toBe(100);
        });

        it('should prioritize by similarity when available', () => {
            const searchResults: CleanMemorySearchResult[] = [
                { ...createTestMemory('low-sim', 7), similarity: 0.6 },
                { ...createTestMemory('high-sim', 7), similarity: 0.95 },
                { ...createTestMemory('med-sim', 7), similarity: 0.75 }
            ];

            const response = buildTokenAwareResponse(searchResults, testConfigSmall);
            
            // High similarity should be prioritized
            const firstMemory = response.fullMemories[0] || response.summaries[0];
            expect(firstMemory.id).toBe('high-sim');
        });
    });

    describe('Response Formatting', () => {
        it('should format response with proper sections', () => {
            const response = {
                summaries: [{
                    id: 'sum-1',
                    contentSnippet: 'Test snippet...',
                    importance: 6,
                    tags: ['test'],
                    similarity: 0.85,
                    tokenCount: 150
                }],
                fullMemories: [{
                    id: 'full-1',
                    content: 'Full memory content',
                    importance: 9,
                    tags: ['important'],
                    createdAt: new Date().toISOString(),
                    lastAccessed: new Date().toISOString(),
                    accessCount: 10
                }],
                totalFound: 10,
                truncated: true,
                tokenCount: 5000
            };

            const formatted = formatTokenAwareResponse(response);
            
            expect(formatted).toContain('Found 10 memories');
            expect(formatted).toContain('Full Memories (High Relevance)');
            expect(formatted).toContain('Memory Summaries');
            expect(formatted).toContain('Similarity: 85.0%');
            expect(formatted).toContain('Results truncated to fit token limits');
        });
    });
});
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryService } from '../src/memory.service.js';
import { createDatabaseService, DatabaseType } from '@mcp/database-services';
import type { MemoryRecord } from '@mcp/shared-types';

// Mock the Google Generative AI to avoid requiring API keys in tests
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      embedContent: vi.fn().mockResolvedValue({
        embedding: {
          values: Array.from({ length: 768 }, () => Math.random() * 2 - 1)
        }
      })
    })
  }))
}));

describe('MemoryService', () => {
  let memoryService: MemoryService;

  beforeEach(async () => {
    // Mock the environment variable
    process.env.GEMINI_API_KEY = 'test-api-key';
    
    // Use in-memory database for testing
    const dbConfig = {
      type: DatabaseType.InMemory,
      providerConfig: {}
    };

    // Mock embedding config
    const embeddingConfig = {
      model: 'text-embedding-004',
      batchSize: 10,
      similarityThreshold: 0.7
    };

    memoryService = new MemoryService(dbConfig, embeddingConfig);
    await memoryService.initialize();
  });

  describe('remember', () => {
    it('should create a new memory with valid data', async () => {
      const result = await memoryService.remember('Test content', 5, ['test']);

      expect(result.content).toBe('Test content');
      expect(result.importance).toBe(5);
      expect(result.tags).toEqual(['test']);
      expect(result.accessCount).toBe(1);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.lastAccessed).toBeDefined();
    });

    it('should clamp importance values to 0-10 range', async () => {
      const result1 = await memoryService.remember('Test high', 15, []);
      expect(result1.importance).toBe(10);

      const result2 = await memoryService.remember('Test low', -5, []);
      expect(result2.importance).toBe(0);
    });

    it('should handle empty tags array', async () => {
      const result = await memoryService.remember('Test no tags', 5, []);
      expect(result.tags).toEqual([]);
    });
  });

  describe('recall', () => {
    beforeEach(async () => {
      // Add test memories
      await memoryService.remember('JavaScript is a programming language', 8, ['programming', 'javascript']);
      await memoryService.remember('TypeScript extends JavaScript', 7, ['programming', 'typescript']);
      await memoryService.remember('Python is also popular', 6, ['programming', 'python']);
    });

    it('should filter memories by content query', async () => {
      const results = await memoryService.recall('javascript');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(r => r.content.toLowerCase().includes('javascript'))).toBe(true);
    });

    it('should filter memories by tags', async () => {
      const results = await memoryService.recall('', ['typescript']);
      
      expect(results).toHaveLength(1);
      expect(results[0].content).toContain('TypeScript');
    });

    it('should sort by relevance (importance)', async () => {
      const results = await memoryService.recall('programming');
      
      // Should be sorted by importance descending
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].importance).toBeGreaterThanOrEqual(results[i + 1].importance);
      }
    });

    it('should respect limit parameter', async () => {
      const results = await memoryService.recall('programming', undefined, 2);
      
      expect(results).toHaveLength(2);
    });

    it('should return empty array for no matches', async () => {
      const results = await memoryService.recall('nonexistent', undefined, 10, 'text');
      
      expect(results).toHaveLength(0);
    });
  });

  describe('getMemory', () => {
    it('should retrieve and update access metadata', async () => {
      const stored = await memoryService.remember('Test content', 5, ['test']);
      const initialAccessCount = stored.accessCount;
      
      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await memoryService.getMemory(stored.id);

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Test content');
      expect(result!.accessCount).toBe(initialAccessCount + 1);
      expect(new Date(result!.lastAccessed).getTime()).toBeGreaterThanOrEqual(new Date(stored.lastAccessed).getTime());
    });

    it('should return null for non-existent memory', async () => {
      const result = await memoryService.getMemory('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('listMemories', () => {
    beforeEach(async () => {
      // Add test memories with different creation times
      await new Promise(resolve => setTimeout(resolve, 10));
      await memoryService.remember('First memory', 9, ['important', 'first']);
      await new Promise(resolve => setTimeout(resolve, 10));
      await memoryService.remember('Second memory', 5, ['normal']);
      await new Promise(resolve => setTimeout(resolve, 10));
      await memoryService.remember('Third memory', 7, ['important']);
    });

    it('should sort by createdAt by default (descending)', async () => {
      const results = await memoryService.listMemories();
      
      expect(results).toHaveLength(3);
      // Should be in descending order by creation time
      expect(results[0].content).toBe('Third memory'); // Most recent
      expect(results[2].content).toBe('First memory'); // Oldest
    });

    it('should sort by importance', async () => {
      const results = await memoryService.listMemories(undefined, 20, 'importance');
      
      expect(results[0].importance).toBe(9);
      expect(results[1].importance).toBe(7);
      expect(results[2].importance).toBe(5);
    });

    it('should filter by tags', async () => {
      const results = await memoryService.listMemories(['important']);
      
      expect(results).toHaveLength(2);
      expect(results.every(m => m.tags.includes('important'))).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const results = await memoryService.listMemories(undefined, 2);
      
      expect(results).toHaveLength(2);
    });

    it('should handle pagination with offset', async () => {
      const firstPage = await memoryService.listMemories(undefined, 2, 'createdAt', 0);
      const secondPage = await memoryService.listMemories(undefined, 2, 'createdAt', 2);
      
      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(1); // Only 3 total memories
      expect(firstPage[0].id).not.toBe(secondPage[0].id);
    });
  });

  describe('updateMemory', () => {
    it('should update memory fields', async () => {
      const stored = await memoryService.remember('Original content', 5, ['original']);
      
      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = await memoryService.updateMemory(
        stored.id,
        'Updated content',
        8,
        ['updated']
      );

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Updated content');
      expect(result!.importance).toBe(8);
      expect(result!.tags).toEqual(['updated']);
      expect(new Date(result!.lastAccessed).getTime()).toBeGreaterThanOrEqual(new Date(stored.lastAccessed).getTime());
    });

    it('should update only specified fields', async () => {
      const stored = await memoryService.remember('Original content', 5, ['original']);
      
      const result = await memoryService.updateMemory(stored.id, 'Updated content');

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Updated content');
      expect(result!.importance).toBe(5); // Unchanged
      expect(result!.tags).toEqual(['original']); // Unchanged
    });

    it('should return null for non-existent memory', async () => {
      const result = await memoryService.updateMemory('non-existent', 'New content');

      expect(result).toBeNull();
    });

    it('should clamp importance values', async () => {
      const stored = await memoryService.remember('Test', 5, []);
      
      const result = await memoryService.updateMemory(stored.id, undefined, 15);
      expect(result!.importance).toBe(10);
    });
  });

  describe('forget', () => {
    it('should delete a memory', async () => {
      const stored = await memoryService.remember('To be deleted', 5, ['test']);
      
      const result = await memoryService.forget(stored.id);
      expect(result).toBe(true);
      
      // Verify it's actually deleted
      const retrieved = await memoryService.getMemory(stored.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent memory', async () => {
      const result = await memoryService.forget('non-existent-id');
      expect(result).toBe(false);
    });
  });
});
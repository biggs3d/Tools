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

    // Phase 4: Add background processing config
    const backgroundConfig = {
      maxOperationsPerRun: 5,
      maxTimePerRun: 2000,
      enableEmbeddingBackfill: true,
      enableImportanceDecay: true
    };

    memoryService = new MemoryService(dbConfig, embeddingConfig, backgroundConfig);
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

  // Phase 4 Tests - Data Integrity & Performance
  describe('Phase 4: Atomicity in Memory Consolidation', () => {
    it('should use consolidationStatus for atomic consolidation', async () => {
      const memory1 = await memoryService.remember('First related concept', 7, ['concept']);
      const memory2 = await memoryService.remember('Second related concept', 6, ['concept']);
      
      const consolidated = await memoryService.consolidateMemories([memory1.id, memory2.id]);
      
      expect(consolidated.consolidationStatus).toBe('completed');
      expect(consolidated.isConsolidated).toBe(true);
      expect(consolidated.consolidatedFrom).toEqual([memory1.id, memory2.id]);
      expect(consolidated.importance).toBeGreaterThan(Math.max(memory1.importance, memory2.importance));
    });

    it('should handle consolidation errors gracefully', async () => {
      const memory1 = await memoryService.remember('Valid memory', 7, ['test']);
      const invalidId = 'non-existent-id';
      
      await expect(memoryService.consolidateMemories([memory1.id, invalidId]))
        .rejects.toThrow('Memory(s) with ID(s) non-existent-id not found');
    });

    it('should require at least 2 memories for consolidation', async () => {
      const memory1 = await memoryService.remember('Single memory', 7, ['test']);
      
      await expect(memoryService.consolidateMemories([memory1.id]))
        .rejects.toThrow('At least 2 memories are required for consolidation');
    });

    it('should clean up orphaned consolidations', async () => {
      // This test would need to simulate orphaned consolidations
      // For now, just test that the cleanup method exists and runs
      const result = await memoryService.cleanupOrphanedConsolidations(1000);
      expect(result).toHaveProperty('cleaned');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });

  describe('Phase 4: Optimistic Locking for Race Conditions', () => {
    it('should initialize new memories with version 1', async () => {
      const memory = await memoryService.remember('Test version', 5, ['test']);
      expect(memory.version).toBe(1);
    });

    it('should increment access count atomically', async () => {
      const memory = await memoryService.remember('Test access count', 5, ['test']);
      const initialVersion = memory.version;
      
      const retrieved = await memoryService.getMemory(memory.id);
      
      expect(retrieved).not.toBeNull();
      expect(retrieved!.accessCount).toBe(memory.accessCount + 1);
      expect(retrieved!.version).toBe(initialVersion! + 1);
    });

    it('should handle concurrent access gracefully', async () => {
      const memory = await memoryService.remember('Concurrent test', 5, ['test']);
      
      // Simulate concurrent access (in real scenario, this would be from different processes)
      const promises = Array.from({ length: 5 }, () => memoryService.getMemory(memory.id));
      const results = await Promise.all(promises);
      
      // All should succeed
      results.forEach(result => {
        expect(result).not.toBeNull();
        expect(result!.id).toBe(memory.id);
      });
    });
  });

  describe('Phase 4: Pagination for Scalability', () => {
    beforeEach(async () => {
      // Create multiple memories for pagination testing
      for (let i = 0; i < 25; i++) {
        await memoryService.remember(`Memory ${i}`, 5, ['pagination-test']);
      }
    });

    it('should handle large collections in generateEmbeddingsForExisting', async () => {
      const result = await memoryService.generateEmbeddingsForExisting(5);
      
      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('updated');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should use pagination in cleanup operations', async () => {
      const result = await memoryService.cleanupOrphanedConsolidations(1000);
      
      // Should complete without errors even with many memories
      expect(result).toHaveProperty('cleaned');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('Phase 4: Knowledge Graph Features', () => {
    let memory1: any, memory2: any, memory3: any;

    beforeEach(async () => {
      memory1 = await memoryService.remember('Graph node 1', 7, ['graph']);
      memory2 = await memoryService.remember('Graph node 2', 6, ['graph']);
      memory3 = await memoryService.remember('Graph node 3', 5, ['graph']);
    });

    it('should link memories bidirectionally', async () => {
      const success = await memoryService.linkMemories(memory1.id, memory2.id);
      expect(success).toBe(true);
      
      const updated1 = await memoryService.getMemory(memory1.id);
      const updated2 = await memoryService.getMemory(memory2.id);
      
      expect(updated1!.relatedMemories).toContain(memory2.id);
      expect(updated2!.relatedMemories).toContain(memory1.id);
    });

    it('should unlink memories bidirectionally', async () => {
      // First link them
      await memoryService.linkMemories(memory1.id, memory2.id);
      
      // Then unlink
      const success = await memoryService.unlinkMemories(memory1.id, memory2.id);
      expect(success).toBe(true);
      
      const updated1 = await memoryService.getMemory(memory1.id);
      const updated2 = await memoryService.getMemory(memory2.id);
      
      expect(updated1!.relatedMemories || []).not.toContain(memory2.id);
      expect(updated2!.relatedMemories || []).not.toContain(memory1.id);
    });

    it('should handle linking non-existent memories gracefully', async () => {
      const success = await memoryService.linkMemories(memory1.id, 'non-existent');
      expect(success).toBe(false);
    });

    it('should auto-link similar memories', async () => {
      const result = await memoryService.autoLinkSimilarMemories(0.5, 2);
      
      expect(result).toHaveProperty('linked');
      expect(result).toHaveProperty('errors');
      expect(typeof result.linked).toBe('number');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should get related memories through various connection types', async () => {
      // Link some memories
      await memoryService.linkMemories(memory1.id, memory2.id);
      
      const related = await memoryService.getRelatedMemories(memory1.id);
      
      expect(related).toHaveProperty('consolidatedFrom');
      expect(related).toHaveProperty('consolidatedInto');
      expect(related).toHaveProperty('similar');
      expect(related).toHaveProperty('relatedByTags');
      expect(Array.isArray(related.consolidatedFrom)).toBe(true);
      expect(Array.isArray(related.consolidatedInto)).toBe(true);
      expect(Array.isArray(related.similar)).toBe(true);
      expect(Array.isArray(related.relatedByTags)).toBe(true);
    });
  });

  describe('Phase 4: Similarity Scores Enhancement', () => {
    let testMemory: any;

    beforeEach(async () => {
      testMemory = await memoryService.remember('Machine learning algorithms', 8, ['ml', 'algorithms']);
      await memoryService.remember('Deep learning networks', 7, ['ml', 'deep-learning']);
      await memoryService.remember('Natural language processing', 6, ['ml', 'nlp']);
    });

    it('should find similar memories with scores', async () => {
      const similar = await memoryService.findSimilarMemoriesWithScores(testMemory.id, 0.0, 5);
      
      expect(Array.isArray(similar)).toBe(true);
      similar.forEach(memory => {
        expect(memory).toHaveProperty('similarity');
        expect(typeof memory.similarity).toBe('number');
        expect(memory.similarity).toBeGreaterThanOrEqual(-1.000001); // Full cosine similarity range  
        expect(memory.similarity).toBeLessThanOrEqual(1.000001); // Allow floating point precision
      });
    });

    it('should respect similarity threshold', async () => {
      const similar = await memoryService.findSimilarMemoriesWithScores(testMemory.id, 0.9, 5);
      
      similar.forEach(memory => {
        expect(memory.similarity).toBeGreaterThanOrEqual(0.9);
      });
    });

    it('should maintain backward compatibility with findSimilarMemories', async () => {
      const similar = await memoryService.findSimilarMemories(testMemory.id, 0.0, 5);
      
      expect(Array.isArray(similar)).toBe(true);
      similar.forEach(memory => {
        expect(memory).not.toHaveProperty('similarity');
      });
    });
  });

  describe('Phase 4: Batch Fetching Performance', () => {
    let memoryIds: string[];

    beforeEach(async () => {
      memoryIds = [];
      for (let i = 0; i < 10; i++) {
        const memory = await memoryService.remember(`Batch memory ${i}`, 5, ['batch']);
        memoryIds.push(memory.id);
      }
    });

    it('should fetch multiple memories efficiently', async () => {
      // Access the repository directly for this test
      const memories = await (memoryService as any).memoryRepository.getManyByIds(memoryIds);
      
      expect(memories).toHaveLength(memoryIds.length);
      memories.forEach((memory, index) => {
        expect(memory.content).toBe(`Batch memory ${index}`);
      });
    });

    it('should handle empty ID arrays', async () => {
      const memories = await (memoryService as any).memoryRepository.getManyByIds([]);
      expect(memories).toHaveLength(0);
    });

    it('should handle non-existent IDs gracefully', async () => {
      const mixedIds = [memoryIds[0], 'non-existent', memoryIds[1]];
      const memories = await (memoryService as any).memoryRepository.getManyByIds(mixedIds);
      
      expect(memories).toHaveLength(2);
    });
  });

  describe('Phase 4: Proper Disposal Cleanup', () => {
    it('should dispose gracefully', async () => {
      // Test that dispose method exists and can be called
      await expect(memoryService.dispose()).resolves.not.toThrow();
    });

    it('should handle disposal errors gracefully', async () => {
      // Mock a disposal error scenario
      const originalDispose = (memoryService as any).backgroundService.dispose;
      (memoryService as any).backgroundService.dispose = vi.fn().mockRejectedValue(new Error('Disposal error'));
      
      await expect(memoryService.dispose()).rejects.toThrow('Disposal error');
      
      // Restore original method
      (memoryService as any).backgroundService.dispose = originalDispose;
    });
  });
});
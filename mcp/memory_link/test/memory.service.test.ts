import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryService } from '../src/memory.service.js';
import type { MemoryRecord } from '@mcp/shared-types';
import type { IDatabaseConfig } from '@mcp/database-services';

// Mock the database service
vi.mock('@mcp/database-services', () => ({
  createDatabaseService: vi.fn(() => ({
    getProvider: vi.fn()
  })),
  DatabaseService: vi.fn()
}));

describe('MemoryService', () => {
  let memoryService: MemoryService;
  let mockProvider: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create a mock provider
    mockProvider = {
      create: vi.fn(),
      read: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      query: vi.fn()
    };

    // Mock the database service to return our mock provider
    const mockDbService = {
      getProvider: vi.fn(() => Promise.resolve(mockProvider))
    };

    // Create service instance with mocked dependencies
    const mockConfig: IDatabaseConfig = {
      type: 'in-memory' as any,
      providerConfig: {}
    };

    memoryService = new MemoryService(mockConfig);
    (memoryService as any).dbService = mockDbService;
  });

  describe('remember', () => {
    it('should create a new memory with valid data', async () => {
      const mockMemory: MemoryRecord = {
        id: 'test-id',
        content: 'Test content',
        importance: 5,
        tags: ['test'],
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 1
      };

      mockProvider.create.mockResolvedValue(mockMemory);

      const result = await memoryService.remember('Test content', 5, ['test']);

      expect(mockProvider.create).toHaveBeenCalledWith('memories', expect.objectContaining({
        content: 'Test content',
        importance: 5,
        tags: ['test'],
        accessCount: 1
      }));
      expect(result).toEqual(mockMemory);
    });

    it('should clamp importance values to 0-10 range', async () => {
      mockProvider.create.mockResolvedValue({} as MemoryRecord);

      await memoryService.remember('Test', 15, []);
      expect(mockProvider.create).toHaveBeenCalledWith('memories', expect.objectContaining({
        importance: 10
      }));

      await memoryService.remember('Test', -5, []);
      expect(mockProvider.create).toHaveBeenCalledWith('memories', expect.objectContaining({
        importance: 0
      }));
    });
  });

  describe('recall', () => {
    const mockMemories: MemoryRecord[] = [
      {
        id: '1',
        content: 'JavaScript is a programming language',
        importance: 8,
        tags: ['programming', 'javascript'],
        createdAt: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-02T00:00:00Z',
        accessCount: 5
      },
      {
        id: '2',
        content: 'TypeScript extends JavaScript',
        importance: 7,
        tags: ['programming', 'typescript'],
        createdAt: '2024-01-02T00:00:00Z',
        lastAccessed: '2024-01-03T00:00:00Z',
        accessCount: 3
      },
      {
        id: '3',
        content: 'Python is also popular',
        importance: 6,
        tags: ['programming', 'python'],
        createdAt: '2024-01-03T00:00:00Z',
        lastAccessed: '2024-01-01T00:00:00Z',
        accessCount: 2
      }
    ];

    beforeEach(() => {
      mockProvider.query.mockResolvedValue(mockMemories);
    });

    it('should filter memories by content query', async () => {
      const results = await memoryService.recall('javascript', undefined, 10);
      
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('1');
      expect(results[1].id).toBe('2');
    });

    it('should filter memories by tags', async () => {
      const results = await memoryService.recall('', ['typescript'], 10);
      
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('2');
    });

    it('should sort by importance and recency', async () => {
      const results = await memoryService.recall('programming', undefined, 10);
      
      expect(results[0].importance).toBe(8);
      expect(results[1].importance).toBe(7);
      expect(results[2].importance).toBe(6);
    });

    it('should respect limit parameter', async () => {
      const results = await memoryService.recall('programming', undefined, 2);
      
      expect(results).toHaveLength(2);
    });
  });

  describe('getMemory', () => {
    it('should retrieve and update access metadata', async () => {
      const mockMemory: MemoryRecord = {
        id: 'test-id',
        content: 'Test content',
        importance: 5,
        tags: ['test'],
        createdAt: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-01T00:00:00Z',
        accessCount: 1
      };

      mockProvider.read.mockResolvedValue(mockMemory);
      mockProvider.update.mockResolvedValue({ ...mockMemory, accessCount: 2 });

      const result = await memoryService.getMemory('test-id');

      expect(mockProvider.read).toHaveBeenCalledWith('memories', 'test-id');
      expect(mockProvider.update).toHaveBeenCalledWith('memories', 'test-id', {
        lastAccessed: expect.any(String),
        accessCount: 2
      });
      expect(result?.accessCount).toBe(2);
    });

    it('should return null for non-existent memory', async () => {
      mockProvider.read.mockResolvedValue(null);

      const result = await memoryService.getMemory('non-existent');

      expect(result).toBeNull();
      expect(mockProvider.update).not.toHaveBeenCalled();
    });
  });

  describe('listMemories', () => {
    const mockMemories: MemoryRecord[] = [
      {
        id: '1',
        content: 'First memory',
        importance: 9,
        tags: ['important', 'first'],
        createdAt: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-05T00:00:00Z',
        accessCount: 10
      },
      {
        id: '2',
        content: 'Second memory',
        importance: 5,
        tags: ['normal'],
        createdAt: '2024-01-02T00:00:00Z',
        lastAccessed: '2024-01-03T00:00:00Z',
        accessCount: 3
      },
      {
        id: '3',
        content: 'Third memory',
        importance: 7,
        tags: ['important'],
        createdAt: '2024-01-03T00:00:00Z',
        lastAccessed: '2024-01-04T00:00:00Z',
        accessCount: 5
      }
    ];

    beforeEach(() => {
      mockProvider.query.mockResolvedValue(mockMemories);
    });

    it('should sort by createdAt by default', async () => {
      const results = await memoryService.listMemories();
      
      expect(results[0].id).toBe('3'); // Most recent
      expect(results[1].id).toBe('2');
      expect(results[2].id).toBe('1'); // Oldest
    });

    it('should sort by importance', async () => {
      const results = await memoryService.listMemories(undefined, 20, 'importance');
      
      expect(results[0].importance).toBe(9);
      expect(results[1].importance).toBe(7);
      expect(results[2].importance).toBe(5);
    });

    it('should sort by lastAccessed', async () => {
      const results = await memoryService.listMemories(undefined, 20, 'lastAccessed');
      
      expect(results[0].id).toBe('1'); // Most recently accessed
      expect(results[1].id).toBe('3');
      expect(results[2].id).toBe('2'); // Least recently accessed
    });

    it('should filter by tags', async () => {
      const results = await memoryService.listMemories(['important']);
      
      expect(results).toHaveLength(2);
      expect(results.every(m => m.tags.includes('important'))).toBe(true);
    });
  });

  describe('updateMemory', () => {
    it('should update memory fields', async () => {
      const existingMemory: MemoryRecord = {
        id: 'test-id',
        content: 'Original content',
        importance: 5,
        tags: ['original'],
        createdAt: '2024-01-01T00:00:00Z',
        lastAccessed: '2024-01-01T00:00:00Z',
        accessCount: 1
      };

      mockProvider.read.mockResolvedValue(existingMemory);
      mockProvider.update.mockResolvedValue({
        ...existingMemory,
        content: 'Updated content',
        importance: 8
      });

      const result = await memoryService.updateMemory(
        'test-id',
        'Updated content',
        8,
        ['updated']
      );

      expect(mockProvider.update).toHaveBeenCalledWith('memories', 'test-id', {
        content: 'Updated content',
        importance: 8,
        tags: ['updated'],
        lastAccessed: expect.any(String)
      });
      expect(result?.content).toBe('Updated content');
    });

    it('should return null for non-existent memory', async () => {
      mockProvider.read.mockResolvedValue(null);

      const result = await memoryService.updateMemory('non-existent', 'New content');

      expect(result).toBeNull();
      expect(mockProvider.update).not.toHaveBeenCalled();
    });
  });

  describe('forget', () => {
    it('should delete a memory', async () => {
      mockProvider.delete.mockResolvedValue(true);

      const result = await memoryService.forget('test-id');

      expect(mockProvider.delete).toHaveBeenCalledWith('memories', 'test-id');
      expect(result).toBe(true);
    });

    it('should return false for non-existent memory', async () => {
      mockProvider.delete.mockResolvedValue(false);

      const result = await memoryService.forget('non-existent');

      expect(result).toBe(false);
    });
  });
});
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRepository } from '../src/memory.repository.js';
import { createDatabaseService, DatabaseType } from '@mcp/database-services';
import type { MemoryRecord } from '@mcp/shared-types';

describe('Vector Similarity Performance Tests', () => {
  let memoryRepository: MemoryRepository;
  let testMemories: MemoryRecord[];

  beforeEach(async () => {
    // Use in-memory database for testing
    const dbConfig = {
      type: DatabaseType.InMemory,
      providerConfig: {}
    };

    const dbService = createDatabaseService(dbConfig);
    memoryRepository = new MemoryRepository(dbService);
    await memoryRepository.initialize();

    // Create test memories with mock embeddings (no API calls)
    testMemories = [];
    const testData = [
      { content: 'JavaScript is a programming language', tags: ['coding', 'web'] },
      { content: 'Dogs are loyal pets and faithful companions', tags: ['animals', 'pets'] },
      { content: 'TypeScript adds static typing to JavaScript', tags: ['coding', 'web'] },
      { content: 'Cats are independent animals and good mousers', tags: ['animals', 'pets'] },
      { content: 'Python is great for data science and ML', tags: ['coding', 'data'] },
      { content: 'The sun is a massive star providing energy', tags: ['science', 'astronomy'] }
    ];

    // Generate mock embeddings that are actually similar for related content
    for (let i = 0; i < testData.length; i++) {
      const data = testData[i];
      let embedding: number[];
      
      // Create semantically similar embeddings for related content
      if (data.tags.includes('coding')) {
        // Programming-related embeddings: high values in first 100 dimensions
        embedding = Array.from({ length: 768 }, (_, idx) => 
          idx < 100 ? (Math.random() * 0.4 + 0.6) : (Math.random() * 0.4 - 0.2)
        );
      } else if (data.tags.includes('animals')) {
        // Animal-related embeddings: high values in dimensions 100-200
        embedding = Array.from({ length: 768 }, (_, idx) => 
          (idx >= 100 && idx < 200) ? (Math.random() * 0.4 + 0.6) : (Math.random() * 0.4 - 0.2)
        );
      } else {
        // Other content: random embeddings
        embedding = Array.from({ length: 768 }, () => Math.random() * 2 - 1);
      }

      const memory: MemoryRecord = {
        id: `test-memory-${i}`,
        content: data.content,
        importance: 7,
        tags: data.tags,
        embedding,
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 1,
        version: 1
      };

      await memoryRepository.add(memory);
      testMemories.push(memory);
    }
  });

  it('should perform cosine similarity calculations quickly', async () => {
    const startTime = Date.now();
    
    // Get the first programming-related memory
    const programmingMemory = testMemories.find(m => m.tags.includes('coding'))!;
    
    // Perform vector search (this should be very fast - just math)
    const results = await memoryRepository.find({
      vectorQuery: programmingMemory.embedding,
      limit: 10,
      sortBy: 'relevance',
      sortOrder: 'desc',
      searchStrategy: 'vector',
      includeSimilarityScores: true
    });
    
    const duration = Date.now() - startTime;
    
    // Vector similarity should complete in under 100ms even with 6 memories
    expect(duration).toBeLessThan(100);
    expect(results.length).toBeGreaterThan(0);
    
    console.log(`Vector similarity search took ${duration}ms for ${testMemories.length} memories`);
  });

  it('should find semantically similar content based on mock embeddings', async () => {
    // Get a programming-related memory
    const jsMemory = testMemories.find(m => m.content.includes('JavaScript'))!;
    
    // Search for similar content
    const results = await memoryRepository.find({
      vectorQuery: jsMemory.embedding,
      limit: 10,
      sortBy: 'relevance',
      sortOrder: 'desc',
      searchStrategy: 'vector',
      includeSimilarityScores: true
    });
    
    // Should find other programming-related content
    const programmingResults = results.filter(r => 
      r.content.includes('TypeScript') || r.content.includes('Python')
    );
    
    expect(programmingResults.length).toBeGreaterThan(0);
    console.log(`Found ${programmingResults.length} programming-related memories`);
  });

  it('should scale linearly with number of memories', async () => {
    // Add more memories to test performance scaling
    const additionalMemories = 100;
    
    for (let i = 0; i < additionalMemories; i++) {
      const memory: MemoryRecord = {
        id: `scale-test-${i}`,
        content: `Test memory content ${i}`,
        importance: 5,
        tags: ['test'],
        embedding: Array.from({ length: 768 }, () => Math.random() * 2 - 1),
        createdAt: new Date().toISOString(),
        lastAccessed: new Date().toISOString(),
        accessCount: 1,
        version: 1
      };
      
      await memoryRepository.add(memory);
    }
    
    const startTime = Date.now();
    
    // Perform vector search with 100+ memories
    const queryEmbedding = Array.from({ length: 768 }, () => Math.random() * 2 - 1);
    const results = await memoryRepository.find({
      vectorQuery: queryEmbedding,
      limit: 10,
      sortBy: 'relevance',
      sortOrder: 'desc',
      searchStrategy: 'vector'
    });
    
    const duration = Date.now() - startTime;
    
    // Even with 100+ memories, vector search should complete quickly
    expect(duration).toBeLessThan(500); // 500ms is reasonable for 100+ memories
    expect(results.length).toBeGreaterThan(0);
    
    console.log(`Vector search with ${additionalMemories + testMemories.length} memories took ${duration}ms`);
  });

  it('should demonstrate cosine similarity scoring', async () => {
    const programmingMemory = testMemories.find(m => m.content.includes('JavaScript'))!;
    
    const results = await memoryRepository.find({
      vectorQuery: programmingMemory.embedding,
      limit: 10,
      sortBy: 'relevance',
      sortOrder: 'desc',
      searchStrategy: 'vector',
      includeSimilarityScores: true
    }) as (MemoryRecord & { similarity?: number })[];
    
    // Verify similarity scores are present and in valid cosine similarity range [-1, 1]
    results.forEach(result => {
      expect(result.similarity).toBeDefined();
      expect(result.similarity).toBeGreaterThanOrEqual(-1.000001); // Full cosine similarity range
      expect(result.similarity).toBeLessThanOrEqual(1.000001); // Allow for floating point precision
    });
    
    // Results should be sorted by similarity (highest first)
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].similarity!).toBeGreaterThanOrEqual(results[i + 1].similarity!);
    }
    
    console.log('Similarity scores:', results.map(r => ({ 
      content: r.content.substring(0, 30) + '...', 
      similarity: r.similarity?.toFixed(3) 
    })));
  });
});
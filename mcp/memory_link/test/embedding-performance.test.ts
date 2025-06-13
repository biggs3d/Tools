import 'dotenv/config';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryService } from '../src/memory.service.js';
import { createDatabaseService, DatabaseType } from '@mcp/database-services';

describe('Embedding API Performance Tests', () => {
  let memoryService: MemoryService;

  beforeEach(async () => {
    // Use in-memory database for testing
    const dbConfig = {
      type: DatabaseType.InMemory,
      providerConfig: {}
    };

    const embeddingConfig = {
      model: 'text-embedding-004',
      batchSize: 10,
      similarityThreshold: 0.7
    };

    const backgroundConfig = {
      maxOperationsPerRun: 5,
      maxTimePerRun: 2000,
      enableEmbeddingBackfill: true,
      enableImportanceDecay: true
    };

    memoryService = new MemoryService(dbConfig, embeddingConfig, backgroundConfig);
    await memoryService.initialize();
  });

  it('should measure single embedding API call performance', async () => {
    const startTime = Date.now();
    
    const memory = await memoryService.remember(
      'Test embedding performance with a reasonable length text that represents typical memory content',
      7,
      ['performance', 'test']
    );
    
    const duration = Date.now() - startTime;
    
    expect(memory.embedding).toBeDefined();
    expect(memory.embedding).toHaveLength(768);
    
    console.log(`Single embedding API call took ${duration}ms`);
    
    // Should complete in reasonable time (generous upper bound)
    expect(duration).toBeLessThan(5000); // 5 seconds max
  });

  it('should measure multiple sequential embedding calls', async () => {
    const testTexts = [
      'JavaScript programming language fundamentals',
      'Machine learning algorithms and data science',
      'Web development with React and TypeScript',
      'Cloud computing and distributed systems',
      'Database design and query optimization'
    ];
    
    const startTime = Date.now();
    const memories = [];
    
    for (const text of testTexts) {
      const memory = await memoryService.remember(text, 7, ['performance']);
      memories.push(memory);
    }
    
    const totalDuration = Date.now() - startTime;
    const avgDuration = totalDuration / testTexts.length;
    
    console.log(`${testTexts.length} sequential embedding calls:`);
    console.log(`  Total time: ${totalDuration}ms`);
    console.log(`  Average per call: ${avgDuration}ms`);
    console.log(`  Requests per second: ${(1000 / avgDuration).toFixed(2)}`);
    
    // Verify all embeddings were generated
    memories.forEach(memory => {
      expect(memory.embedding).toBeDefined();
      expect(memory.embedding).toHaveLength(768);
    });
    
    // Should complete all calls in reasonable time
    expect(totalDuration).toBeLessThan(15000); // 15 seconds for 5 calls
    
    // Report rate limit status based on real performance
    const requestsPerSecond = 1000 / avgDuration;
    if (requestsPerSecond > 5.0) {
      console.log(`⚠️  Exceeding observed safe rate limit of 5.0 RPS`);
    } else {
      console.log(`✅ Within observed safe rate limit of 5.0 RPS`);
    }
  });

  it('should test semantic search performance after embeddings exist', async () => {
    // First create some memories (this will take time for embeddings)
    await memoryService.remember('JavaScript is a programming language', 8, ['coding']);
    await memoryService.remember('Python is used for data science', 7, ['coding']);
    await memoryService.remember('Dogs are loyal companions', 6, ['animals']);
    
    // Now test semantic search speed (should be fast - just one embedding + vector math)
    const startTime = Date.now();
    
    const results = await memoryService.recall('software development', undefined, 10, 'semantic');
    
    const searchDuration = Date.now() - startTime;
    
    console.log(`Semantic search took ${searchDuration}ms`);
    
    expect(results.length).toBeGreaterThan(0);
    // Semantic search should be fast (one embedding call + vector math)
    expect(searchDuration).toBeLessThan(2000); // 2 seconds max
  });

  it('should test optimal rate limiting for batch operations', async () => {
    // Test with rate limiting closer to API limits
    const testTexts = [
      'First test memory for rate limiting',
      'Second test memory for rate limiting', 
      'Third test memory for rate limiting'
    ];
    
    const startTime = Date.now();
    
    // Simulate optimal rate limiting (400ms between calls = 2.5 RPS)
    for (let i = 0; i < testTexts.length; i++) {
      const callStart = Date.now();
      
      await memoryService.remember(testTexts[i], 7, ['rate-test']);
      
      const callDuration = Date.now() - callStart;
      console.log(`Call ${i + 1} took ${callDuration}ms`);
      
      // Add delay only if we completed too quickly (stay under 5 RPS based on real performance)
      if (i < testTexts.length - 1) { // Don't delay after last call
        const minInterval = 200; // 200ms = 5 RPS
        const timeToWait = Math.max(0, minInterval - callDuration);
        
        if (timeToWait > 0) {
          console.log(`Waiting ${timeToWait}ms to respect rate limit`);
          await new Promise(resolve => setTimeout(resolve, timeToWait));
        }
      }
    }
    
    const totalDuration = Date.now() - startTime;
    const actualRPS = (testTexts.length / (totalDuration / 1000));
    
    console.log(`Optimal rate limiting test:`);
    console.log(`  Total time: ${totalDuration}ms`);
    console.log(`  Actual RPS: ${actualRPS.toFixed(2)}`);
    
    // Should be close to but not exceed 5 RPS (based on real API performance)
    expect(actualRPS).toBeLessThanOrEqual(5.5); // Allow for real API performance
  });
});
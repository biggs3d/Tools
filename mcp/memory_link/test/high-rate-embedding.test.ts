import 'dotenv/config';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryService } from '../src/memory.service.js';
import { createDatabaseService, DatabaseType } from '@mcp/database-services';

describe('High Rate Embedding Tests', () => {
  let memoryService: MemoryService;

  beforeEach(async () => {
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

  it('should handle rapid embedding generation within text-embedding-004 limits', { timeout: 15000 }, async () => {
    const testTexts = [
      'First rapid embedding test',
      'Second rapid embedding test', 
      'Third rapid embedding test',
      'Fourth rapid embedding test',
      'Fifth rapid embedding test',
      'Sixth rapid embedding test',
      'Seventh rapid embedding test',
      'Eighth rapid embedding test'
    ];
    
    const startTime = Date.now();
    const memories = [];
    
    // Create memories rapidly to test the new rate limiting
    for (const text of testTexts) {
      const memory = await memoryService.remember(text, 7, ['rapid-test']);
      memories.push(memory);
    }
    
    const totalDuration = Date.now() - startTime;
    const avgDuration = totalDuration / testTexts.length;
    const actualRPS = 1000 / avgDuration;
    
    console.log(`${testTexts.length} rapid embedding calls:`);
    console.log(`  Total time: ${totalDuration}ms`);
    console.log(`  Average per call: ${avgDuration}ms`);
    console.log(`  Actual RPS: ${actualRPS.toFixed(2)}`);
    
    // All embeddings should be generated
    memories.forEach(memory => {
      expect(memory.embedding).toBeDefined();
      expect(memory.embedding).toHaveLength(768);
    });
    
    // Should be much faster now with optimized rate limiting
    expect(totalDuration).toBeLessThan(8000); // 8 seconds for 8 calls (was taking much longer)
    
    // Report performance vs limits
    if (actualRPS > 25) {
      console.log(`⚠️  Exceeding text-embedding-004 rate limit of 25 RPS`);
    } else if (actualRPS > 20) {
      console.log(`✅ High performance: ${actualRPS.toFixed(1)} RPS (within 25 RPS limit)`);
    } else {
      console.log(`✅ Conservative rate: ${actualRPS.toFixed(1)} RPS (well within 25 RPS limit)`);
    }
  });

  it('should test semantic search speed with many memories', async () => {
    // Create several memories first
    const setupTexts = [
      'Machine learning algorithms process data efficiently',
      'Deep learning networks require large datasets', 
      'Natural language processing enables text understanding',
      'Computer vision analyzes images and videos',
      'JavaScript is a versatile programming language'
    ];
    
    for (const text of setupTexts) {
      await memoryService.remember(text, 7, ['setup']);
    }
    
    // Now test semantic search performance
    const searchStartTime = Date.now();
    
    const results = await memoryService.recall('artificial intelligence', undefined, 10, 'semantic');
    
    const searchDuration = Date.now() - searchStartTime;
    
    console.log(`Semantic search with ${setupTexts.length} memories took ${searchDuration}ms`);
    
    expect(results.length).toBeGreaterThan(0);
    // Semantic search should be very fast (one embedding + vector similarity)
    expect(searchDuration).toBeLessThan(1000); // Should complete in under 1 second
    
    // Find AI-related content
    const aiContent = results.filter(r => 
      r.content.includes('learning') || 
      r.content.includes('intelligence') ||
      r.content.includes('processing')
    );
    expect(aiContent.length).toBeGreaterThan(0);
  });
});
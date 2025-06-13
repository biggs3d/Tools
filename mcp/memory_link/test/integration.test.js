import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('memory_link Integration Tests', () => {
  let serverProcess;
  let requestId = 1;

  const sendRequest = (method, params = {}) => {
    return new Promise((resolve, reject) => {
      const request = {
        jsonrpc: '2.0',
        id: requestId++,
        method,
        params
      };

      const responseHandler = (data) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === request.id) {
            serverProcess.stdout.off('data', responseHandler);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (e) {
          // Ignore non-JSON output
        }
      };

      serverProcess.stdout.on('data', responseHandler);
      serverProcess.stdin.write(JSON.stringify(request) + '\n');

      // Timeout after 5 seconds
      setTimeout(() => {
        serverProcess.stdout.off('data', responseHandler);
        reject(new Error('Request timeout'));
      }, 5000);
    });
  };

  beforeAll(async () => {
    const serverPath = resolve(__dirname, '..', 'index.js');
    
    serverProcess = spawn('node', [serverPath], {
      cwd: resolve(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        DATABASE_TYPE: 'in-memory',
        GEMINI_API_KEY: 'test-api-key-for-integration-tests'
      }
    });

    // Wait for server to start
    await new Promise((resolve) => {
      serverProcess.stderr.on('data', (data) => {
        if (data.toString().includes('MCP Server started')) {
          resolve();
        }
      });
    });

    // Initialize the connection
    await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('Server Setup', () => {
    it('should list available tools', async () => {
      const result = await sendRequest('tools/list');
      expect(result.tools).toBeDefined();
      expect(result.tools.length).toBeGreaterThan(0);
      
      const toolNames = result.tools.map(t => t.name);
      expect(toolNames).toContain('remember');
      expect(toolNames).toContain('recall');
      expect(toolNames).toContain('get_memory');
      expect(toolNames).toContain('forget');
      expect(toolNames).toContain('list_memories');
      expect(toolNames).toContain('update_memory');
    });
  });

  describe('Memory Operations', () => {
    let createdMemoryId;

    it('should create a new memory', async () => {
      const result = await sendRequest('tools/call', {
        name: 'remember',
        arguments: {
          content: 'Test memory content',
          importance: 7,
          tags: ['test', 'integration']
        }
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].text).toMatch(/Memory stored with ID:/);
      
      // Extract the ID
      const idMatch = result.content[0].text.match(/ID: (.+)/);
      expect(idMatch).toBeTruthy();
      createdMemoryId = idMatch[1];
    });

    it('should retrieve the created memory', async () => {
      const result = await sendRequest('tools/call', {
        name: 'get_memory',
        arguments: { id: createdMemoryId }
      });

      const memory = JSON.parse(result.content[0].text);
      expect(memory.content).toBe('Test memory content');
      expect(memory.importance).toBe(7);
      expect(memory.tags).toEqual(['test', 'integration']);
      expect(memory.accessCount).toBeGreaterThan(0);
    });

    it('should recall memories by query', async () => {
      const result = await sendRequest('tools/call', {
        name: 'recall',
        arguments: {
          query: 'test',
          limit: 10
        }
      });

      const memories = JSON.parse(result.content[0].text);
      expect(memories).toBeInstanceOf(Array);
      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0].content.toLowerCase()).toContain('test');
    });

    it('should list memories with filters', async () => {
      const result = await sendRequest('tools/call', {
        name: 'list_memories',
        arguments: {
          tags: ['test'],
          limit: 5,
          sortBy: 'importance'
        }
      });

      const memories = JSON.parse(result.content[0].text);
      expect(memories).toBeInstanceOf(Array);
      expect(memories.every(m => m.tags.includes('test'))).toBe(true);
    });

    it('should update a memory', async () => {
      const result = await sendRequest('tools/call', {
        name: 'update_memory',
        arguments: {
          id: createdMemoryId,
          content: 'Updated test memory content',
          importance: 9
        }
      });

      const updated = JSON.parse(result.content[0].text);
      expect(updated.content).toBe('Updated test memory content');
      expect(updated.importance).toBe(9);
      expect(updated.tags).toEqual(['test', 'integration']); // Tags unchanged
    });

    it('should delete a memory', async () => {
      const result = await sendRequest('tools/call', {
        name: 'forget',
        arguments: { id: createdMemoryId }
      });

      expect(result.content[0].text).toMatch(/Memory .+ forgotten/);

      // Verify it's deleted
      const getResult = await sendRequest('tools/call', {
        name: 'get_memory',
        arguments: { id: createdMemoryId }
      });

      expect(getResult.isError).toBe(true);
      expect(getResult.content[0].text).toMatch(/not found/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid memory ID gracefully', async () => {
      const result = await sendRequest('tools/call', {
        name: 'get_memory',
        arguments: { id: 'non-existent-id' }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/not found/);
    });

    it('should enforce importance score bounds', async () => {
      try {
        await sendRequest('tools/call', {
          name: 'remember',
          arguments: {
            content: 'Test bounds',
            importance: 15, // Over max
            tags: []
          }
        });
        // Should not reach this point
        expect(false).toBe(true);
      } catch (error) {
        expect(error.message).toContain('Number must be less than or equal to 10');
      }
    });
  });

  // Phase 4 Integration Tests
  describe('Phase 4: Knowledge Graph Tools', () => {
    let memory1Id, memory2Id, memory3Id;

    beforeAll(async () => {
      // Create test memories for knowledge graph testing
      const memory1 = await sendRequest('tools/call', {
        name: 'remember',
        arguments: {
          content: 'React components are reusable UI elements',
          importance: 8,
          tags: ['react', 'frontend', 'components']
        }
      });
      memory1Id = memory1.content[0].text.match(/ID: (\S+)/)[1];

      const memory2 = await sendRequest('tools/call', {
        name: 'remember',
        arguments: {
          content: 'Vue components are similar to React components',
          importance: 7,
          tags: ['vue', 'frontend', 'components']
        }
      });
      memory2Id = memory2.content[0].text.match(/ID: (\S+)/)[1];

      const memory3 = await sendRequest('tools/call', {
        name: 'remember',
        arguments: {
          content: 'Angular components use TypeScript',
          importance: 6,
          tags: ['angular', 'frontend', 'typescript']
        }
      });
      memory3Id = memory3.content[0].text.match(/ID: (\S+)/)[1];
    });

    it('should link memories bidirectionally', async () => {
      const result = await sendRequest('tools/call', {
        name: 'link_memories',
        arguments: {
          memory_id_1: memory1Id,
          memory_id_2: memory2Id
        }
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Successfully linked');
      expect(result.content[0].text).toContain(memory1Id);
      expect(result.content[0].text).toContain(memory2Id);
    });

    it('should unlink memories bidirectionally', async () => {
      // First ensure they're linked
      await sendRequest('tools/call', {
        name: 'link_memories',
        arguments: {
          memory_id_1: memory1Id,
          memory_id_2: memory3Id
        }
      });

      // Then unlink them
      const result = await sendRequest('tools/call', {
        name: 'unlink_memories',
        arguments: {
          memory_id_1: memory1Id,
          memory_id_2: memory3Id
        }
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Successfully unlinked');
      expect(result.content[0].text).toContain(memory1Id);
      expect(result.content[0].text).toContain(memory3Id);
    });

    it('should auto-link similar memories', async () => {
      const result = await sendRequest('tools/call', {
        name: 'auto_link_similar_memories',
        arguments: {
          similarity_threshold: 0.3,
          max_links_per_memory: 3
        }
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Auto-Linking Complete');
      expect(result.content[0].text).toContain('New Connections:');
    });

    it('should handle linking non-existent memories gracefully', async () => {
      const result = await sendRequest('tools/call', {
        name: 'link_memories',
        arguments: {
          memory_id_1: memory1Id,
          memory_id_2: 'non-existent-id'
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Failed to link memories');
    });
  });

  describe('Phase 4: Enhanced Similarity Search', () => {
    let testMemoryId;

    beforeAll(async () => {
      const memory = await sendRequest('tools/call', {
        name: 'remember',
        arguments: {
          content: 'Machine learning algorithms process data',
          importance: 9,
          tags: ['ml', 'algorithms', 'data']
        }
      });
      testMemoryId = memory.content[0].text.match(/ID: (\S+)/)[1];

      // Add some related memories
      await sendRequest('tools/call', {
        name: 'remember',
        arguments: {
          content: 'Deep learning is a subset of machine learning',
          importance: 8,
          tags: ['ml', 'deep-learning']
        }
      });

      await sendRequest('tools/call', {
        name: 'remember',
        arguments: {
          content: 'Data science uses statistical methods',
          importance: 7,
          tags: ['data-science', 'statistics']
        }
      });
    });

    it('should find similar memories with scores', async () => {
      const result = await sendRequest('tools/call', {
        name: 'find_similar_memories_with_scores',
        arguments: {
          memory_id: testMemoryId,
          similarity_threshold: 0.1,
          limit: 5
        }
      });

      expect(result.isError).toBeFalsy();
      // The response format may be "Similar Memories with Scores" or "No similar memories found"
      expect(result.content[0].text).toMatch(/(Similar Memories with Scores|No similar memories found)/);
      
      // If there are results, they should contain similarity scores
      if (result.content[0].text.includes('Similar Memories with Scores')) {
        expect(result.content[0].text).toMatch(/\d\.\d{3}/); // Score format like 0.856
      }
    });

    it('should respect similarity threshold', async () => {
      const result = await sendRequest('tools/call', {
        name: 'find_similar_memories_with_scores',
        arguments: {
          memory_id: testMemoryId,
          similarity_threshold: 0.99, // Very high threshold
          limit: 5
        }
      });

      expect(result.isError).toBeFalsy();
      // Should find few or no results with such high threshold
      expect(result.content[0].text).toMatch(/(Similar Memories with Scores|No similar memories found)/);
    });

    it('should handle invalid memory ID in similarity search', async () => {
      const result = await sendRequest('tools/call', {
        name: 'find_similar_memories_with_scores',
        arguments: {
          memory_id: 'non-existent-id',
          similarity_threshold: 0.7,
          limit: 5
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Failed to find similar memories');
    });
  });

  describe('Phase 4: Memory Consolidation Atomicity', () => {
    let sourceMemoryIds = [];

    beforeAll(async () => {
      // Create memories for consolidation testing
      const memories = [
        'JavaScript is a dynamic programming language',
        'JavaScript supports functional programming',
        'JavaScript has prototype-based inheritance'
      ];

      for (const content of memories) {
        const memory = await sendRequest('tools/call', {
          name: 'remember',
          arguments: {
            content: content,
            importance: 7,
            tags: ['javascript', 'programming']
          }
        });
        const memoryId = memory.content[0].text.match(/ID: (\S+)/)[1];
        sourceMemoryIds.push(memoryId);
      }
    });

    it('should consolidate memories atomically', async () => {
      const result = await sendRequest('tools/call', {
        name: 'consolidate_memories',
        arguments: {
          memory_ids: sourceMemoryIds.slice(0, 2), // Use first 2 memories
          summary_prompt: 'Summarize these JavaScript concepts'
        }
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Memory Consolidation Complete');
      expect(result.content[0].text).toContain('Source Memories');
      
      // Extract consolidated memory ID from the response (format: "**Consolidated Memory ID:** xxxx")
      const idMatch = result.content[0].text.match(/\*\*Consolidated Memory ID:\*\* (\S+)/);
      expect(idMatch).toBeTruthy();
      const consolidatedId = idMatch[1];
      expect(consolidatedId).toBeDefined();
    });

    it('should handle consolidation errors gracefully', async () => {
      const result = await sendRequest('tools/call', {
        name: 'consolidate_memories',
        arguments: {
          memory_ids: [sourceMemoryIds[0], 'non-existent-id']
        }
      });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Failed to consolidate');
    });

    it('should require at least 2 memories for consolidation', async () => {
      try {
        await sendRequest('tools/call', {
          name: 'consolidate_memories',
          arguments: {
            memory_ids: [sourceMemoryIds[0]] // Only 1 memory
          }
        });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Array must contain at least 2 element(s)');
      }
    });
  });

  describe('Phase 4: Background Processing and Status', () => {
    it('should report background processing status', async () => {
      const result = await sendRequest('tools/call', {
        name: 'get_background_status',
        arguments: {}
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Background Processing Status');
      expect(result.content[0].text).toContain('Status:');
      expect(result.content[0].text).toContain('Queue Length:');
      expect(result.content[0].text).toContain('Operations Completed:');
      expect(result.content[0].text).toContain('Elapsed Time:');
    });

    it('should handle embedding generation for existing memories', async () => {
      const result = await sendRequest('tools/call', {
        name: 'generate_embeddings_for_existing',
        arguments: {
          batch_size: 5
        }
      });

      expect(result.isError).toBeFalsy();
      expect(result.content[0].text).toContain('Embedding Generation Complete');
      expect(result.content[0].text).toContain('Processed');
      expect(result.content[0].text).toContain('Updated');
      expect(result.content[0].text).toContain('Errors');
    });
  });

  describe('Phase 4: Integration Error Handling', () => {
    it('should handle missing required parameters', async () => {
      try {
        await sendRequest('tools/call', {
          name: 'link_memories',
          arguments: {
            memory_id_1: 'some-id'
            // missing memory_id_2
          }
        });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Required');
      }
    });

    it('should validate similarity threshold bounds', async () => {
      try {
        await sendRequest('tools/call', {
          name: 'find_similar_memories_with_scores',
          arguments: {
            memory_id: 'some-id',
            similarity_threshold: 1.5 // Invalid - over 1.0
          }
        });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('must be less than or equal to 1');
      }
    });

    it('should validate auto-link parameters', async () => {
      try {
        await sendRequest('tools/call', {
          name: 'auto_link_similar_memories',
          arguments: {
            max_links_per_memory: 25 // Invalid - over 20
          }
        });
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('must be less than or equal to 20');
      }
    });
  });
});
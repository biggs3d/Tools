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
});
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Semantic Search Integration Tests', () => {
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

      // Timeout after 20 seconds for embedding operations
      setTimeout(() => {
        serverProcess.stdout.off('data', responseHandler);
        reject(new Error('Request timeout'));
      }, 20000);
    });
  };

  beforeAll(async () => {
    const serverPath = resolve(__dirname, '..', 'index.js');
    
    serverProcess = spawn('node', [serverPath], {
      cwd: resolve(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env, 
        DATABASE_TYPE: 'in-memory'
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
      clientInfo: { name: 'semantic-test-client', version: '1.0.0' }
    });
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  describe('Semantic Search Functionality', () => {
    let memoryIds = [];

    it('should create memories with diverse content for semantic testing', async () => {
      // Create memories with related concepts but different words
      const testData = [
        { content: 'JavaScript is a programming language', importance: 8, tags: ['coding', 'web'] },
        { content: 'Dogs are loyal pets and faithful companions', importance: 7, tags: ['animals', 'pets'] },
        { content: 'TypeScript adds static typing to JavaScript', importance: 8, tags: ['coding', 'web'] },
        { content: 'Cats are independent animals and good mousers', importance: 6, tags: ['animals', 'pets'] },
        { content: 'Python is great for data science and ML', importance: 9, tags: ['coding', 'data'] },
        { content: 'The sun is a massive star providing energy', importance: 5, tags: ['science', 'astronomy'] }
      ];

      for (const data of testData) {
        const result = await sendRequest('tools/call', {
          name: 'remember',
          arguments: data
        });
        expect(result.content[0].text).toContain('Memory stored with ID:');
        const memoryId = result.content[0].text.match(/ID: (.+)$/)[1];
        memoryIds.push(memoryId);
      }

      expect(memoryIds).toHaveLength(6);
    });

    it('should find semantically related content with semantic search', { timeout: 15000 }, async () => {
      // Search for "pets" - should find both dog and cat memories
      const result = await sendRequest('tools/call', {
        name: 'recall',
        arguments: {
          query: 'pets',
          search_type: 'semantic',
          limit: 10
        }
      });

      const memories = JSON.parse(result.content[0].text);
      expect(memories.length).toBeGreaterThan(0);
      
      // Should find animal-related content even if it doesn't contain "pets"
      const animalContent = memories.filter(m => 
        m.content.includes('Dogs') || m.content.includes('Cats')
      );
      expect(animalContent.length).toBeGreaterThan(0);
    });

    it('should find programming-related content semantically', { timeout: 15000 }, async () => {
      // Search for "coding" - should find JavaScript, TypeScript, Python
      const result = await sendRequest('tools/call', {
        name: 'recall',
        arguments: {
          query: 'software development',
          search_type: 'semantic',
          limit: 10
        }
      });

      const memories = JSON.parse(result.content[0].text);
      expect(memories.length).toBeGreaterThan(0);
      
      // Should find programming languages
      const programmingContent = memories.filter(m => 
        m.content.includes('JavaScript') || 
        m.content.includes('TypeScript') || 
        m.content.includes('Python')
      );
      expect(programmingContent.length).toBeGreaterThan(0);
    });

    it('should show difference between text and semantic search', { timeout: 15000 }, async () => {
      // Text search for exact word
      const textResult = await sendRequest('tools/call', {
        name: 'recall',
        arguments: {
          query: 'faithful',
          search_type: 'text',
          limit: 10
        }
      });

      // Semantic search for related concept
      const semanticResult = await sendRequest('tools/call', {
        name: 'recall',
        arguments: {
          query: 'loyal companion',
          search_type: 'semantic',
          limit: 10
        }
      });

      const textMemories = JSON.parse(textResult.content[0].text);
      const semanticMemories = JSON.parse(semanticResult.content[0].text);

      // Text search should find exact match
      expect(textMemories.some(m => m.content.includes('faithful'))).toBe(true);
      
      // Semantic search should find related concepts
      expect(semanticMemories.some(m => 
        m.content.includes('loyal') || m.content.includes('Dogs')
      )).toBe(true);
    });

    it('should demonstrate hybrid search combining both approaches', { timeout: 15000 }, async () => {
      const hybridResult = await sendRequest('tools/call', {
        name: 'recall',
        arguments: {
          query: 'programming language',
          search_type: 'hybrid',
          limit: 10
        }
      });

      const memories = JSON.parse(hybridResult.content[0].text);
      expect(memories.length).toBeGreaterThan(0);
      
      // Should find both exact matches and semantically related content
      const hasExactMatch = memories.some(m => 
        m.content.includes('programming language')
      );
      const hasSemanticMatch = memories.some(m => 
        m.content.includes('JavaScript') || 
        m.content.includes('TypeScript') || 
        m.content.includes('Python')
      );
      
      expect(hasExactMatch || hasSemanticMatch).toBe(true);
    });

    it('should test generate_embeddings_for_existing tool', async () => {
      const result = await sendRequest('tools/call', {
        name: 'generate_embeddings_for_existing',
        arguments: {}
      });

      expect(result.content[0].text).toContain('Embedding Generation Complete');
    });
  });
});
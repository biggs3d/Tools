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
      // Create fewer memories to reduce API calls while still testing semantic search
      const testData = [
        { content: 'JavaScript is a programming language', importance: 8, tags: ['coding', 'web'] },
        { content: 'Dogs are loyal pets and faithful companions', importance: 7, tags: ['animals', 'pets'] },
        { content: 'TypeScript adds static typing to JavaScript', importance: 8, tags: ['coding', 'web'] }
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

      expect(memoryIds).toHaveLength(3);
    });

    it('should find semantically related content with semantic search', { timeout: 30000 }, async () => {
      // Search for "pets" - should find both dog and cat memories
      const result = await sendRequest('tools/call', {
        name: 'recall',
        arguments: {
          query: 'pets',
          search_type: 'semantic',
          limit: 10
        }
      });

      const responseText = result.content[0].text;
      expect(responseText).toContain('Found');
      expect(responseText).toContain('memories');
      
      // Should find animal-related content even if it doesn't contain "pets"
      expect(responseText.includes('Dogs')).toBe(true);
    });

    it('should find programming-related content semantically', { timeout: 30000 }, async () => {
      // Search for "coding" - should find JavaScript, TypeScript, Python
      const result = await sendRequest('tools/call', {
        name: 'recall',
        arguments: {
          query: 'software development',
          search_type: 'semantic',
          limit: 10
        }
      });

      const responseText = result.content[0].text;
      expect(responseText).toContain('Found');
      expect(responseText).toContain('memories');
      
      // Should find programming languages
      const hasProgrammingContent = responseText.includes('JavaScript') || responseText.includes('TypeScript');
      expect(hasProgrammingContent).toBe(true);
    });

    it('should show difference between text and semantic search', { timeout: 30000 }, async () => {
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

      const textResponse = textResult.content[0].text;
      const semanticResponse = semanticResult.content[0].text;

      // Text search should find exact match
      expect(textResponse.includes('faithful')).toBe(true);
      
      // Semantic search should find related concepts
      expect(semanticResponse.includes('Dogs')).toBe(true);
    });

    it('should demonstrate hybrid search combining both approaches', { timeout: 30000 }, async () => {
      const hybridResult = await sendRequest('tools/call', {
        name: 'recall',
        arguments: {
          query: 'programming language',
          search_type: 'hybrid',
          limit: 10
        }
      });

      const hybridResponse = hybridResult.content[0].text;
      expect(hybridResponse).toContain('Found');
      expect(hybridResponse).toContain('memories');
      
      // Should find both exact matches and semantically related content
      const hasExactMatch = hybridResponse.includes('programming language');
      const hasSemanticMatch = hybridResponse.includes('JavaScript') || hybridResponse.includes('TypeScript');
      
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
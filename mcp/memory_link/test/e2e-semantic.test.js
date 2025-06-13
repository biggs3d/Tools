import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('E2E Semantic Search Test', { timeout: 30000 }, () => {
  let serverProcess;
  let requestId = 1;
  let createdMemoryIds = [];

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

      // Timeout after 15 seconds for embedding operations
      setTimeout(() => {
        serverProcess.stdout.off('data', responseHandler);
        reject(new Error('Request timeout'));
      }, 15000);
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
      clientInfo: { name: 'e2e-test-client', version: '1.0.0' }
    });
  });

  afterAll(() => {
    if (serverProcess) {
      serverProcess.kill();
    }
  });

  it('should demonstrate end-to-end semantic search functionality', async () => {
    // Step 1: Create memories with related concepts
    console.log('Creating test memories...');
    
    const testMemories = [
      { content: 'Dogs are loyal pets and faithful companions', importance: 8, tags: ['animals', 'pets'] },
      { content: 'JavaScript is a popular programming language', importance: 7, tags: ['coding', 'web'] },
      { content: 'Cats are independent animals that hunt mice', importance: 6, tags: ['animals', 'pets'] }
    ];

    for (const memory of testMemories) {
      const result = await sendRequest('tools/call', {
        name: 'remember',
        arguments: memory
      });
      
      expect(result.content[0].text).toContain('Memory stored with ID:');
      const memoryId = result.content[0].text.match(/ID: (.+)$/)[1];
      createdMemoryIds.push(memoryId);
    }

    expect(createdMemoryIds).toHaveLength(3);
    console.log(`Created ${createdMemoryIds.length} test memories`);

    // Step 2: Test semantic search for "pets" - should find both dogs and cats
    console.log('Testing semantic search for "pets"...');
    
    const semanticResult = await sendRequest('tools/call', {
      name: 'recall',
      arguments: {
        query: 'pets',
        search_type: 'semantic',
        limit: 10
      }
    });

    const semanticMemories = JSON.parse(semanticResult.content[0].text);
    expect(semanticMemories.length).toBeGreaterThan(0);
    
    // Should find animal-related content
    const animalContent = semanticMemories.filter(m => 
      m.content.includes('Dogs') || m.content.includes('Cats')
    );
    expect(animalContent.length).toBeGreaterThan(0);
    console.log(`Found ${animalContent.length} animal-related memories via semantic search`);

    // Step 3: Test hybrid search combining text and semantic
    console.log('Testing hybrid search...');
    
    const hybridResult = await sendRequest('tools/call', {
      name: 'recall',
      arguments: {
        query: 'programming',
        search_type: 'hybrid',
        limit: 10
      }
    });

    const hybridMemories = JSON.parse(hybridResult.content[0].text);
    expect(hybridMemories.length).toBeGreaterThan(0);
    
    // Should find JavaScript content
    const programmingContent = hybridMemories.filter(m => 
      m.content.includes('JavaScript') || m.content.includes('programming')
    );
    expect(programmingContent.length).toBeGreaterThan(0);
    console.log(`Found ${programmingContent.length} programming-related memories via hybrid search`);

    // Step 4: Test text-only search for comparison
    console.log('Testing text-only search...');
    
    const textResult = await sendRequest('tools/call', {
      name: 'recall',
      arguments: {
        query: 'faithful',
        search_type: 'text',
        limit: 10
      }
    });

    const textMemories = JSON.parse(textResult.content[0].text);
    expect(textMemories.length).toBeGreaterThan(0);
    expect(textMemories.some(m => m.content.includes('faithful'))).toBe(true);
    console.log(`Found ${textMemories.length} memories with exact text match`);

    // Step 5: Clean up - delete all created memories
    console.log('Cleaning up test memories...');
    
    for (const memoryId of createdMemoryIds) {
      const deleteResult = await sendRequest('tools/call', {
        name: 'forget',
        arguments: { id: memoryId }
      });
      
      expect(deleteResult.content[0].text).toContain('forgotten');
    }

    console.log(`Cleaned up ${createdMemoryIds.length} test memories`);

    // Step 6: Verify cleanup - search should return no results
    const cleanupCheck = await sendRequest('tools/call', {
      name: 'recall',
      arguments: {
        query: 'Dogs',
        search_type: 'text',
        limit: 10
      }
    });

    const remainingMemories = JSON.parse(cleanupCheck.content[0].text);
    expect(remainingMemories.length).toBe(0);
    console.log('✅ All test memories successfully cleaned up');
  });
});
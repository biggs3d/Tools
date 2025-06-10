#!/usr/bin/env node

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Testing MCP server protocol communication...\n');

async function testMCPServer() {
  const serverPath = resolve(__dirname, '..', 'index.js');
  
  console.log('Starting MCP server:', serverPath);
  
  const server = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let outputBuffer = '';
  let errorBuffer = '';

  server.stdout.on('data', (data) => {
    outputBuffer += data.toString();
  });

  server.stderr.on('data', (data) => {
    errorBuffer += data.toString();
    console.error('Server log:', data.toString().trim());
  });

  // Helper to send JSON-RPC request
  async function sendRequest(method, params = {}) {
    const request = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params
    };
    
    server.stdin.write(JSON.stringify(request) + '\n');
    
    // Wait for response
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for response')), 5000);
      
      const checkResponse = setInterval(() => {
        try {
          const lines = outputBuffer.split('\n').filter(line => line.trim());
          for (const line of lines) {
            const response = JSON.parse(line);
            if (response.id === request.id) {
              clearInterval(checkResponse);
              clearTimeout(timeout);
              resolve(response);
            }
          }
        } catch (e) {
          // Continue waiting
        }
      }, 100);
    });
  }

  try {
    // Test 1: Initialize
    console.log('\n1. Testing initialize...');
    const initResponse = await sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'mcp-test',
        version: '1.0.0'
      }
    });
    
    if (initResponse.result) {
      console.log('✓ Server initialized successfully');
      console.log('  Server:', initResponse.result.serverInfo.name, initResponse.result.serverInfo.version);
    } else {
      throw new Error('Initialize failed');
    }

    // Test 2: List tools
    console.log('\n2. Testing tools/list...');
    const toolsResponse = await sendRequest('tools/list');
    
    if (toolsResponse.result && toolsResponse.result.tools) {
      console.log('✓ Tools listed successfully');
      console.log('  Available tools:');
      toolsResponse.result.tools.forEach(tool => {
        console.log(`    - ${tool.name}: ${tool.description}`);
      });
    } else {
      throw new Error('List tools failed');
    }

    // Test 3: Navigate to a page
    console.log('\n3. Testing navigate tool...');
    // Use a simple test URL that should work
    const testUrl = 'https://httpbin.org/html';
    
    console.log('  Navigating to:', testUrl);
    const navResponse = await sendRequest('tools/call', {
      name: 'navigate',
      arguments: {
        url: testUrl
      }
    });
    
    if (navResponse.result) {
      const content = JSON.parse(navResponse.result.content[0].text);
      if (content.success) {
        console.log('✓ Navigation successful');
        console.log('  URL:', content.url);
        console.log('  Title:', content.title);
      } else {
        console.log('✗ Navigation failed');
        console.log('  Error:', content.error);
        console.log('  Target URL:', content.url);
      }
    } else if (navResponse.error) {
      console.log('✗ Navigate tool error:', navResponse.error.message);
      throw new Error('Navigate failed: ' + navResponse.error.message);
    } else {
      throw new Error('Navigate failed with unknown error');
    }

    // Wait for page to load and generate logs
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test 4: Get logs
    console.log('\n4. Testing get_logs tool...');
    const logsResponse = await sendRequest('tools/call', {
      name: 'get_logs',
      arguments: {
        level: 'log'
      }
    });
    
    if (logsResponse.result) {
      console.log('✓ Get logs successful');
      const content = JSON.parse(logsResponse.result.content[0].text);
      console.log('  Log count:', content.count);
      if (content.count > 0) {
        console.log('  Sample log:', content.logs[0].text.substring(0, 50) + '...');
      }
    } else {
      throw new Error('Get logs failed');
    }

    // Test 5: Get status
    console.log('\n5. Testing get_status tool...');
    const statusResponse = await sendRequest('tools/call', {
      name: 'get_status',
      arguments: {}
    });
    
    if (statusResponse.result) {
      console.log('✓ Get status successful');
      const content = JSON.parse(statusResponse.result.content[0].text);
      console.log('  Browser connected:', content.browserConnected);
      console.log('  Current URL:', content.currentUrl);
    } else {
      throw new Error('Get status failed');
    }

    // Test 6: Clear logs
    console.log('\n6. Testing clear_logs tool...');
    const clearResponse = await sendRequest('tools/call', {
      name: 'clear_logs',
      arguments: {}
    });
    
    if (clearResponse.result) {
      console.log('✓ Clear logs successful');
      const content = JSON.parse(clearResponse.result.content[0].text);
      console.log('  Result:', content.message);
    } else {
      throw new Error('Clear logs failed');
    }
    
    // Verify logs were cleared
    const verifyResponse = await sendRequest('tools/call', {
      name: 'get_logs',
      arguments: { level: 'log' }
    });
    
    if (verifyResponse.result) {
      const content = JSON.parse(verifyResponse.result.content[0].text);
      if (content.count === 0) {
        console.log('  ✓ Verified: Log buffer is empty');
      } else {
        throw new Error(`Log buffer should be empty but has ${content.count} entries`);
      }
    }

    console.log('\n✅ All MCP protocol tests passed!');

  } catch (error) {
    console.error('\n❌ MCP test failed:', error.message);
    process.exitCode = 1;
  } finally {
    // Clean shutdown
    server.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (server.exitCode === null) {
      server.kill('SIGKILL');
    }
  }
}

testMCPServer().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
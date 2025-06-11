#!/usr/bin/env node
/**
 * Smoke test for memory_link MCP server
 * Tests basic server startup and MCP protocol communication
 */

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = resolve(__dirname, '..', 'index.js');
const timeout = 10000; // 10 second timeout

console.log('🔍 Starting memory_link smoke test...');
console.log(`📁 Server path: ${serverPath}`);

const testProcess = spawn('node', [serverPath], {
  cwd: resolve(__dirname, '..'),
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, DATABASE_TYPE: 'in-memory' }
});

let hasResponded = false;

// Set timeout
const timeoutId = setTimeout(() => {
  if (!hasResponded) {
    console.error('❌ Test failed: Server did not respond within timeout');
    testProcess.kill();
    process.exit(1);
  }
}, timeout);

// Handle server stderr (where logs go)
testProcess.stderr.on('data', (data) => {
  const output = data.toString();
  console.log(`[Server Log] ${output.trim()}`);
  
  if (output.includes('memory_link MCP Server started')) {
    console.log('✅ Server started successfully');
  }
});

// Handle server stdout (MCP protocol messages)
testProcess.stdout.on('data', (data) => {
  const output = data.toString();
  try {
    const response = JSON.parse(output);
    console.log('📨 Received response:', JSON.stringify(response, null, 2));
    
    if (response.id === 1 && response.result) {
      console.log('✅ Initialize successful');
      hasResponded = true;
      
      // Send list tools request
      const listToolsRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };
      
      console.log('📤 Sending tools/list request...');
      testProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    } else if (response.id === 2 && response.result && response.result.tools) {
      console.log(`✅ Server has ${response.result.tools.length} tools available`);
      console.log('🎯 Tools:', response.result.tools.map(t => t.name).join(', '));
      
      clearTimeout(timeoutId);
      console.log('\n✅ All smoke tests passed!');
      testProcess.kill();
      process.exit(0);
    }
  } catch (e) {
    // Not JSON, probably a log message
  }
});

// Handle process errors
testProcess.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  clearTimeout(timeoutId);
  process.exit(1);
});

// Send initialize request
const initRequest = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'memory_link-test',
      version: '1.0.0'
    }
  }
};

console.log('📤 Sending initialize request...');
testProcess.stdin.write(JSON.stringify(initRequest) + '\n');
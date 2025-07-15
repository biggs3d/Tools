#!/usr/bin/env node

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPSmokeTest {
  constructor() {
    this.serverPath = resolve(__dirname, '..', 'index.js');
    this.testsPassed = 0;
    this.testsTotal = 0;
  }

  async runTest(name, testFn) {
    this.testsTotal++;
    console.log(`\n🧪 Testing: ${name}`);
    
    try {
      await testFn();
      console.log(`✅ PASSED: ${name}`);
      this.testsPassed++;
    } catch (error) {
      console.log(`❌ FAILED: ${name}`);
      console.log(`   Error: ${error.message}`);
    }
  }

  async sendMCPMessage(message) {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [this.serverPath], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(error);
      });

      // Send the message
      child.stdin.write(JSON.stringify(message) + '\n');
      child.stdin.end();

      // Timeout after 5 seconds
      setTimeout(() => {
        child.kill();
        reject(new Error('Test timed out'));
      }, 5000);
    });
  }

  async testInitializeProtocol() {
    const initMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'smoke-test',
          version: '1.0.0'
        }
      }
    };

    const response = await this.sendMCPMessage(initMessage);
    const parsed = JSON.parse(response);
    
    if (!parsed.result) {
      throw new Error('Initialize response missing result');
    }

    if (!parsed.result.capabilities) {
      throw new Error('Initialize response missing capabilities');
    }
  }

  async testListTools() {
    const listMessage = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };

    const response = await this.sendMCPMessage(listMessage);
    const parsed = JSON.parse(response);
    
    if (!parsed.result || !parsed.result.tools) {
      throw new Error('List tools response missing tools array');
    }

    const tools = parsed.result.tools;
    const expectedTools = [
      'valet_get_daily_context',
      'valet_update_daily',
      'valet_new_day',
      'valet_todo_operations',
      'valet_todo_view'
    ];

    for (const expectedTool of expectedTools) {
      const found = tools.find(tool => tool.name === expectedTool);
      if (!found) {
        throw new Error(`Expected tool '${expectedTool}' not found`);
      }
    }

    console.log(`   Found ${tools.length} tools: ${tools.map(t => t.name).join(', ')}`);
  }

  async testServerStarts() {
    const child = spawn('node', [this.serverPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return new Promise((resolve, reject) => {
      let hasError = false;
      
      child.stderr.on('data', (data) => {
        const message = data.toString();
        if (message.includes('Error') || message.includes('failed')) {
          hasError = true;
          reject(new Error(`Server startup error: ${message}`));
        }
      });

      child.on('error', reject);

      // Kill after 2 seconds - if no errors, consider it successful
      setTimeout(() => {
        child.kill();
        if (!hasError) {
          resolve();
        }
      }, 2000);
    });
  }

  async runAllTests() {
    console.log('🚀 Starting VALET MCP Server Smoke Tests\n');
    console.log(`Server path: ${this.serverPath}`);

    await this.runTest('Server Starts Without Errors', () => this.testServerStarts());
    await this.runTest('MCP Protocol Initialize', () => this.testInitializeProtocol());
    await this.runTest('List Tools', () => this.testListTools());

    // Results
    console.log('\n📊 Test Results:');
    console.log(`   Passed: ${this.testsPassed}/${this.testsTotal}`);
    
    if (this.testsPassed === this.testsTotal) {
      console.log('🎉 All tests passed!');
      process.exit(0);
    } else {
      console.log('💥 Some tests failed!');
      process.exit(1);
    }
  }
}

// Run the tests
const tester = new MCPSmokeTest();
tester.runAllTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
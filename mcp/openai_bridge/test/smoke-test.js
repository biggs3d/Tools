#!/usr/bin/env node

// OpenAI Bridge MCP Server - Smoke Test
// Quick test to verify basic functionality

import 'dotenv/config';
import { spawn } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds
const SERVER_PATH = resolve(__dirname, '..', 'index.js');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    dim: '\x1b[2m'
};

// Test utilities
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
    console.log(`\n${colors.blue}▶ Testing: ${name}${colors.reset}`);
}

function logSuccess(message) {
    console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
    console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

// JSON-RPC helpers
let requestId = 1;

function createRequest(method, params = {}) {
    return {
        jsonrpc: '2.0',
        id: requestId++,
        method,
        params
    };
}

// Main test function
async function runSmokeTest() {
    log('🚀 OpenAI Bridge MCP Server - Smoke Test', 'yellow');
    log('=' .repeat(50), 'dim');
    
    // Check for API key
    if (!process.env.OPENAI_API_KEY) {
        logError('OPENAI_API_KEY environment variable not set!');
        log('Please set your OpenAI API key in .env file or environment', 'yellow');
        process.exit(1);
    }
    
    logSuccess(`API key configured (length: ${process.env.OPENAI_API_KEY.length})`);
    
    if (process.env.OPENAI_ORGANIZATION_ID) {
        logSuccess(`Organization ID configured: ${process.env.OPENAI_ORGANIZATION_ID}`);
    }
    
    // Start the server
    logTest('Server startup');
    const server = spawn('node', [SERVER_PATH], {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serverOutput = '';
    let serverError = '';
    const responses = new Map();
    
    // Handle server output
    server.stdout.on('data', (data) => {
        serverOutput += data.toString();
        
        // Try to parse JSON-RPC responses
        const lines = serverOutput.split('\n');
        for (const line of lines) {
            if (line.trim() && line.includes('{')) {
                try {
                    const json = JSON.parse(line);
                    if (json.id !== undefined) {
                        responses.set(json.id, json);
                    }
                } catch (e) {
                    // Not JSON, ignore
                }
            }
        }
    });
    
    server.stderr.on('data', (data) => {
        serverError += data.toString();
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (serverError.includes('OpenAI Bridge MCP Server running')) {
        logSuccess('Server started successfully');
    } else {
        logError('Server may not have started correctly');
        console.log('Server error output:', serverError);
    }
    
    // Test sequence
    try {
        // Test 1: Initialize
        logTest('MCP protocol initialization');
        const initRequest = createRequest('initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'smoke-test',
                version: '1.0.0'
            }
        });
        
        server.stdin.write(JSON.stringify(initRequest) + '\n');
        await waitForResponse(responses, initRequest.id, 5000);
        
        const initResponse = responses.get(initRequest.id);
        if (initResponse?.result?.protocolVersion) {
            logSuccess(`Protocol initialized: ${initResponse.result.protocolVersion}`);
            logSuccess(`Server: ${initResponse.result.serverInfo.name} v${initResponse.result.serverInfo.version}`);
        } else {
            throw new Error('Failed to initialize protocol');
        }
        
        // Test 2: List tools
        logTest('Tool discovery');
        const toolsRequest = createRequest('tools/list');
        server.stdin.write(JSON.stringify(toolsRequest) + '\n');
        await waitForResponse(responses, toolsRequest.id, 5000);
        
        const toolsResponse = responses.get(toolsRequest.id);
        if (toolsResponse?.result?.tools) {
            const tools = toolsResponse.result.tools;
            logSuccess(`Found ${tools.length} tools:`);
            tools.forEach(tool => {
                log(`  • ${tool.name} - ${tool.description.substring(0, 60)}...`, 'dim');
            });
        } else {
            throw new Error('Failed to list tools');
        }
        
        // Test 3: Get system info
        logTest('System information');
        const sysInfoRequest = createRequest('tools/call', {
            name: 'get_system_info',
            arguments: { include_models: false }
        });
        
        server.stdin.write(JSON.stringify(sysInfoRequest) + '\n');
        await waitForResponse(responses, sysInfoRequest.id, 10000);
        
        const sysInfoResponse = responses.get(sysInfoRequest.id);
        if (sysInfoResponse?.result?.content) {
            const info = JSON.parse(sysInfoResponse.result.content[0].text);
            logSuccess('System info retrieved:');
            log(`  • Default model: ${info.configuration.defaultModel}`, 'dim');
            log(`  • Context window: ${info.configuration.contextWindow}`, 'dim');
            log(`  • API key configured: ${info.environment.apiKeySet}`, 'dim');
        } else {
            throw new Error('Failed to get system info');
        }
        
        // Test 4: Simple OpenAI query (minimal tokens)
        logTest('OpenAI API connectivity');
        const queryRequest = createRequest('tools/call', {
            name: 'send_to_openai',
            arguments: {
                prompt: 'Say "Hello from OpenAI Bridge MCP!" in exactly 5 words.',
                files: [],
                model: 'gpt-4o-mini' // Use mini model for cost efficiency
            }
        });
        
        server.stdin.write(JSON.stringify(queryRequest) + '\n');
        await waitForResponse(responses, queryRequest.id, 20000);
        
        const queryResponse = responses.get(queryRequest.id);
        if (queryResponse?.result?.content) {
            const response = queryResponse.result.content[0].text;
            logSuccess('OpenAI API response received:');
            log(`  "${response.trim()}"`, 'dim');
        } else {
            throw new Error('Failed to query OpenAI');
        }
        
        // All tests passed
        log('\n' + '=' .repeat(50), 'dim');
        log('✨ All smoke tests passed!', 'green');
        
    } catch (error) {
        logError(`Test failed: ${error.message}`);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        // Clean shutdown
        server.kill('SIGTERM');
        setTimeout(() => process.exit(0), 1000);
    }
}

// Helper to wait for response
async function waitForResponse(responses, id, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (responses.has(id)) {
            return responses.get(id);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timeout waiting for response to request ${id}`);
}

// Run the test
runSmokeTest().catch(error => {
    logError(`Fatal error: ${error.message}`);
    process.exit(1);
});
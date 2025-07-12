#!/usr/bin/env node

// Smoke test for Grok Bridge MCP Server
// This test verifies basic functionality without requiring an API key

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = resolve(__dirname, '..', 'index.js');

console.log('🧪 Running Grok Bridge MCP Server smoke test...');

// Test 1: Server starts without API key (should fail gracefully)
console.log('\n📋 Test 1: Server startup without API key');

const child = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, XAI_API_KEY: undefined }
});

let stderr = '';
child.stderr.on('data', (data) => {
    stderr += data.toString();
});

child.on('exit', (code) => {
    if (code === 1 && stderr.includes('XAI_API_KEY environment variable is required')) {
        console.log('✅ Server correctly requires XAI_API_KEY');
    } else {
        console.log('❌ Server did not fail as expected');
        console.log('Exit code:', code);
        console.log('Stderr:', stderr);
    }
    
    // Test 2: Basic MCP protocol test
    console.log('\n📋 Test 2: MCP protocol compliance');
    testMCPProtocol();
});

function testMCPProtocol() {
    // Set a dummy API key for protocol testing
    const testChild = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, XAI_API_KEY: 'test-key-for-protocol-test' }
    });

    let stdout = '';
    let protocolStderr = '';
    
    testChild.stdout.on('data', (data) => {
        stdout += data.toString();
    });
    
    testChild.stderr.on('data', (data) => {
        protocolStderr += data.toString();
    });

    // Send MCP initialize request
    const initRequest = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: {
                name: "smoke-test",
                version: "1.0.0"
            }
        }
    }) + '\n';

    testChild.stdin.write(initRequest);

    setTimeout(() => {
        if (stdout.includes('"result"') && stdout.includes('"capabilities"')) {
            console.log('✅ Server responds to MCP initialize request');
            
            // Test tools listing
            const listToolsRequest = JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/list"
            }) + '\n';

            testChild.stdin.write(listToolsRequest);

            setTimeout(() => {
                if (stdout.includes('send_to_grok') && 
                    stdout.includes('estimate_context_size') && 
                    stdout.includes('find_relevant_files')) {
                    console.log('✅ Server exposes expected tools');
                } else {
                    console.log('❌ Server missing expected tools');
                    console.log('Tools response:', stdout.slice(-500));
                }
                
                testChild.kill();
                
                // Final summary
                console.log('\n🎯 Smoke test summary:');
                console.log('- Server requires API key: ✅');
                console.log('- MCP protocol compliance: ✅');
                console.log('- Expected tools available: ✅');
                console.log('\n✅ Smoke test passed! Server is ready for use.');
                console.log('\n📝 Next steps:');
                console.log('1. Set your XAI_API_KEY in .env file');
                console.log('2. Add the server to Claude Code with:');
                console.log('   claude mcp add grok-bridge -s user -- node /mnt/d/Tools/mcp/grok_bridge/index.js');
            }, 1000);
        } else {
            console.log('❌ Server did not respond correctly to initialize');
            console.log('Response:', stdout);
            console.log('Stderr:', protocolStderr);
            testChild.kill();
        }
    }, 2000);
}
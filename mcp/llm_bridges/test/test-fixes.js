#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, '..', 'index.js');

async function sendRequest(child, request) {
    return new Promise((resolve) => {
        let response = '';
        const listener = (data) => {
            const text = data.toString();
            response += text;
            
            // Check if we have a complete JSON response
            try {
                const lines = response.split('\n').filter(l => l.trim());
                for (const line of lines) {
                    const parsed = JSON.parse(line);
                    if (parsed.id === request.id) {
                        child.stdout.removeListener('data', listener);
                        resolve(parsed);
                        return;
                    }
                }
            } catch (e) {
                // Not yet complete JSON
            }
        };
        
        child.stdout.on('data', listener);
        child.stdin.write(JSON.stringify(request) + '\n');
        
        // Timeout after 10 seconds
        setTimeout(() => {
            child.stdout.removeListener('data', listener);
            resolve(null);
        }, 10000);
    });
}

async function runTests() {
    console.log('🧪 Testing LLM Bridges fixes...\n');
    
    const child = spawn('node', [serverPath], {
        stdio: ['pipe', 'pipe', 'inherit']
    });
    
    try {
        // Initialize
        console.log('1️⃣  Initializing MCP server...');
        const initResponse = await sendRequest(child, {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'test', version: '1.0.0' }
            }
        });
        
        if (!initResponse || !initResponse.result) {
            throw new Error('Failed to initialize');
        }
        console.log('✅ Server initialized\n');
        
        // Test 1: Single provider (OpenAI)
        console.log('2️⃣  Testing single provider (OpenAI)...');
        const openaiResponse = await sendRequest(child, {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
                name: 'send_to_llm',
                arguments: {
                    llm: 'openai',
                    prompt: 'Say "OpenAI test successful" and nothing else.'
                }
            }
        });
        
        if (openaiResponse && openaiResponse.result) {
            console.log('✅ OpenAI query successful');
            console.log('   Response:', openaiResponse.result.content[0].text.substring(0, 100) + '...\n');
        } else if (openaiResponse && openaiResponse.error) {
            console.log('❌ OpenAI query failed:', openaiResponse.error.message);
            if (openaiResponse.error.message.includes('signal')) {
                console.log('   ⚠️  Signal parameter error still present!\n');
            }
        }
        
        // Test 2: Multiple specific providers
        console.log('3️⃣  Testing multiple specific providers (["gemini", "grok"])...');
        const multiResponse = await sendRequest(child, {
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
                name: 'send_to_llm',
                arguments: {
                    llm: ['gemini', 'grok'],
                    prompt: 'Say "Provider test successful" and nothing else.'
                }
            }
        });
        
        if (multiResponse && multiResponse.result) {
            const responseText = multiResponse.result.content[0].text;
            const hasGemini = responseText.includes('gemini') || responseText.includes('Gemini');
            const hasGrok = responseText.includes('grok') || responseText.includes('Grok');
            const hasOpenAI = responseText.includes('openai') || responseText.includes('OpenAI');
            
            if (hasGemini && hasGrok && !hasOpenAI) {
                console.log('✅ Provider selection working correctly - only requested providers responded');
            } else {
                console.log('⚠️  Provider selection issue:');
                console.log(`   Gemini: ${hasGemini ? 'Yes' : 'No'}`);
                console.log(`   Grok: ${hasGrok ? 'Yes' : 'No'}`);
                console.log(`   OpenAI: ${hasOpenAI ? 'Yes (should not be present!)' : 'No'}`);
            }
            console.log('   Response preview:', responseText.substring(0, 200) + '...\n');
        }
        
        // Test 3: File analysis
        console.log('4️⃣  Testing file analysis...');
        const fileResponse = await sendRequest(child, {
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
                name: 'send_to_llm',
                arguments: {
                    llm: 'gemini',
                    prompt: 'What is the main purpose of this file? Answer in one sentence.',
                    files: ['./README.md']
                }
            }
        });
        
        if (fileResponse && fileResponse.result) {
            console.log('✅ File analysis successful');
            console.log('   Response:', fileResponse.result.content[0].text.substring(0, 150) + '...\n');
        }
        
        console.log('🎉 All tests completed!');
        
    } catch (error) {
        console.error('❌ Test error:', error.message);
    } finally {
        child.kill();
        process.exit(0);
    }
}

runTests();
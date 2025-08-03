#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Running LLM Bridges smoke test...\n');

// Test MCP protocol initialization
async function testMCPProtocol() {
    console.log('Testing MCP protocol...');
    
    // Test server startup using direct execution
    try {
        // First, test if we can import the server
        const serverModule = await import('../server.js');
        console.log('✅ Server module loads successfully');
        
        // Now test MCP protocol with a simple echo test
        const testResponse = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('MCP test timed out'));
            }, 3000);
            
            // Use the simple test approach that we know works
            const serverPath = resolve(__dirname, '..', 'index.js');
            
            const child = spawn(process.execPath, [serverPath], {
                stdio: ['pipe', 'pipe', 'inherit'],
                cwd: resolve(__dirname, '..')
            });
            
            let response = '';
            
            child.stdout.on('data', (data) => {
                response += data.toString();
                if (response.includes('"result"')) {
                    clearTimeout(timeout);
                    child.kill('SIGTERM');
                    setTimeout(() => resolve(true), 100); // Give it time to clean up
                }
            });
            
            child.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
            
            // Ensure clean termination
            child.on('exit', () => {
                clearTimeout(timeout);
            });
            
            // Send init after delay
            setTimeout(() => {
                const init = JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: {
                        protocolVersion: '2024-11-05',
                        capabilities: {},
                        clientInfo: { name: 'test', version: '1.0.0' }
                    }
                }) + '\n';
                
                child.stdin.write(init);
            }, 500);
        });
        
        if (testResponse) {
            console.log('✅ MCP protocol working');
        }
    } catch (error) {
        console.error('❌ MCP test failed:', error.message);
        throw error;
    }
}

// Test configuration loading
async function testConfiguration() {
    console.log('\nTesting configuration...');
    
    try {
        const { CONFIG, getAvailableProviders } = await import('../lib/config.js');
        
        console.log('✅ Configuration loaded');
        
        const providers = getAvailableProviders();
        console.log(`✅ Available providers: ${providers.length > 0 ? providers.join(', ') : 'None (this is OK for testing)'}`);
        
        // Check shared config
        if (CONFIG.shared.maxFileSize && CONFIG.shared.charsPerToken) {
            console.log('✅ Shared configuration loaded correctly');
        } else {
            throw new Error('Shared configuration missing');
        }
    } catch (error) {
        throw new Error(`Configuration error: ${error.message}`);
    }
}

// Test provider loading
async function testProviders() {
    console.log('\nTesting provider modules...');
    
    try {
        const { BaseProvider } = await import('../lib/providers/base.js');
        const { GeminiProvider } = await import('../lib/providers/gemini.js');
        const { OpenAIProvider } = await import('../lib/providers/openai.js');
        const { GrokProvider } = await import('../lib/providers/grok.js');
        
        console.log('✅ All provider modules loaded');
        
        // Test instantiation (won't initialize without API keys)
        const testConfig = {
            apiKey: null,
            defaultModel: 'test-model',
            maxTokens: 100000,
            timeoutMin: 5
        };
        
        const gemini = new GeminiProvider(testConfig);
        const openai = new OpenAIProvider(testConfig);
        const grok = new GrokProvider(testConfig);
        
        if (gemini.name === 'gemini' && openai.name === 'openai' && grok.name === 'grok') {
            console.log('✅ Provider instantiation successful');
        } else {
            throw new Error('Provider names incorrect');
        }
    } catch (error) {
        throw new Error(`Provider error: ${error.message}`);
    }
}

// Test utilities
async function testUtilities() {
    console.log('\nTesting utility modules...');
    
    try {
        const { normalizePath, isBinaryFile } = await import('../lib/utils/file-handler.js');
        const { estimateTokens } = await import('../lib/utils/token-estimator.js');
        const { classifyError } = await import('../lib/utils/error-handler.js');
        
        // Test path normalization
        const testPath = normalizePath('C:\\test\\file.txt');
        console.log('✅ Path normalization working');
        
        // Test token estimation
        const tokens = estimateTokens('Hello, world!');
        if (tokens > 0) {
            console.log('✅ Token estimation working');
        } else {
            throw new Error('Token estimation failed');
        }
        
        // Test error classification
        const errorType = classifyError(new Error('Invalid API key'));
        if (errorType === 'auth') {
            console.log('✅ Error classification working');
        } else {
            throw new Error('Error classification incorrect');
        }
    } catch (error) {
        throw new Error(`Utilities error: ${error.message}`);
    }
}

// Run all tests
async function runTests() {
    try {
        await testConfiguration();
        await testProviders();
        await testUtilities();
        await testMCPProtocol();
        
        console.log('\n✅ All smoke tests passed!');
        console.log('\nNote: To test with actual LLM providers, add API keys to your .env file.');
        process.exit(0);
    } catch (error) {
        console.error(`\n❌ Smoke test failed: ${error.message}`);
        process.exit(1);
    }
}

runTests();
#!/usr/bin/env node

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, '..', 'index.js');
console.log('Starting server:', serverPath);

const child = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'inherit'] // inherit stderr to see errors
});

let stdout = '';

child.stdout.on('data', (data) => {
    stdout += data.toString();
    console.log('STDOUT:', data.toString().trim());
});

child.on('exit', (code) => {
    console.log('Process exited with code:', code);
});

// Wait a bit then send init
setTimeout(() => {
    console.log('Sending initialize request...');
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
}, 1000);

// Wait for response
setTimeout(() => {
    if (stdout.includes('"result"')) {
        console.log('✅ Success!');
        process.exit(0);
    } else {
        console.log('❌ No response received');
        console.log('Full stdout:', stdout);
        process.exit(1);
    }
}, 3000);
#!/usr/bin/env node

// MCP Server stdio wrapper
// This wrapper is required for proper stdio handling in the MCP protocol

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start the server as a child process
const serverPath = resolve(__dirname, 'server.js');
const child = spawn('node', [serverPath], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe']
});

// Pipe stdio streams
process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

// Handle process termination
child.on('exit', (code) => {
    process.exit(code);
});

// Forward signals to child process
process.on('SIGINT', () => {
    child.kill('SIGINT');
});

process.on('SIGTERM', () => {
    child.kill('SIGTERM');
});
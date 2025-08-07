#!/usr/bin/env node

// Grok Bridge MCP Server Entry Point
// This wrapper ensures proper stdio handling for MCP protocol compatibility

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start the actual server as a child process to ensure proper stdio handling
const serverPath = resolve(__dirname, 'server.js');
const child = spawn('node', [serverPath], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe']
});

// Forward stdin from parent to child (MCP protocol communication)
process.stdin.pipe(child.stdin);

// Forward stdout from child to parent (MCP responses)
child.stdout.pipe(process.stdout);

// Forward stderr from child to parent (server logs)
child.stderr.pipe(process.stderr);

// Handle child process exit
child.on('exit', (code, signal) => {
  process.exit(code || 0);
});

child.on('error', (error) => {
  console.error(`Server error: ${error.message}`);
  process.exit(1);
});

// Handle parent process signals
process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  child.kill('SIGINT');
});
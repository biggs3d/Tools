#!/usr/bin/env node

import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = resolve(__dirname, 'server.js');

const child = spawn('node', [serverPath], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env }
});

// Pipe stdio
process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

// Handle process termination
const cleanup = () => {
  if (child && !child.killed) {
    child.kill('SIGTERM');
  }
};

process.on('exit', cleanup);
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  cleanup();
  process.exit(1);
});

// Handle child process exit
child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(128 + (signal === 'SIGTERM' ? 15 : 1));
  } else {
    process.exit(code || 0);
  }
});

child.on('error', (error) => {
  console.error('Child process error:', error);
  process.exit(1);
});
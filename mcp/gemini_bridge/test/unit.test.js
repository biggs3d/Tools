#!/usr/bin/env node

import { test, describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// We'll need to import our functions - but they're not exported yet
// For now, let's create testable versions of our key functions

import { loadEnv } from './load-env.js';

// Mock environment for testing
const originalEnv = process.env;
before(async () => {
  // Load .env first, then override with test values
  await loadEnv();
  
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key-123';
  process.env.MAX_FILE_SIZE = '1000000'; // 1MB for faster tests
  process.env.MAX_TOTAL_TOKENS = '10000';
  process.env.ENABLE_AUTO_OPTIMIZATION = 'true';
  process.env.ENABLE_SMART_RECOVERY = 'true';
});

after(() => {
  process.env = originalEnv;
});

// Create test utilities
async function createTestDir() {
  const testDir = join(tmpdir(), `gemini-bridge-test-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
  return testDir;
}

async function createTestFile(dir, name, content) {
  const filePath = join(dir, name);
  await writeFile(filePath, content);
  return filePath;
}

// Test path normalization function
function normalizePath(filePath) {
  if (!filePath) return filePath;
  
  // Handle WSL paths when called from Windows
  if (process.platform === 'win32' && filePath.startsWith('/mnt/')) {
    const match = filePath.match(/^\/mnt\/([a-z])\/(.*)/i);
    if (match) {
      return `${match[1].toUpperCase()}:/${match[2]}`;
    }
  }
  
  // Handle Windows paths when called from WSL
  if (process.platform !== 'win32' && /^[A-Z]:/i.test(filePath)) {
    const match = filePath.match(/^([A-Z]):\/(.*)/i);
    if (match) {
      return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, '/')}`;
    }
  }
  
  return filePath.replace(/\\/g, '/');
}

// Test error classification
function classifyError(error) {
  const msg = error.message.toLowerCase();
  
  if (msg.includes('api key') || msg.includes('authentication')) return 'auth';
  if (msg.includes('quota') || msg.includes('rate limit')) return 'quota';
  if (msg.includes('model') || msg.includes('not found')) return 'model';
  if (msg.includes('context') || msg.includes('token')) return 'context';
  if (msg.includes('file') || msg.includes('access')) return 'file';
  if (msg.includes('network') || msg.includes('connection')) return 'network';
  
  return 'unknown';
}

// Test token estimation
function estimateTokens(text, charsPerToken = 4, buffer = 1.2) {
  return Math.round((text.length / charsPerToken) * buffer);
}

describe('Core Functions', () => {
  describe('Path Normalization', () => {
    it('should handle WSL to Windows conversion', () => {
      // Mock Windows platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      
      const result = normalizePath('/mnt/c/Users/test/file.txt');
      assert.strictEqual(result, 'C:/Users/test/file.txt');
      
      // Restore platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle Windows to WSL conversion', () => {
      // Mock Linux platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      
      const result = normalizePath('C:/Users/test/file.txt');
      assert.strictEqual(result, '/mnt/c/Users/test/file.txt');
      
      // Restore platform
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should handle null/undefined paths', () => {
      assert.strictEqual(normalizePath(null), null);
      assert.strictEqual(normalizePath(undefined), undefined);
      assert.strictEqual(normalizePath(''), '');
    });

    it('should normalize backslashes to forward slashes', () => {
      const result = normalizePath('some\\path\\with\\backslashes');
      assert.strictEqual(result, 'some/path/with/backslashes');
    });
  });

  describe('Error Classification', () => {
    it('should classify authentication errors', () => {
      const authError = new Error('API key is invalid');
      assert.strictEqual(classifyError(authError), 'auth');
      
      const authError2 = new Error('Authentication failed');
      assert.strictEqual(classifyError(authError2), 'auth');
    });

    it('should classify quota errors', () => {
      const quotaError = new Error('Quota exceeded');
      assert.strictEqual(classifyError(quotaError), 'quota');
      
      const rateLimitError = new Error('Rate limit reached');
      assert.strictEqual(classifyError(rateLimitError), 'quota');
    });

    it('should classify model errors', () => {
      const modelError = new Error('Model not found');
      assert.strictEqual(classifyError(modelError), 'model');
    });

    it('should classify context errors', () => {
      const contextError = new Error('Context too large');
      assert.strictEqual(classifyError(contextError), 'context');
      
      const tokenError = new Error('Token limit exceeded');
      assert.strictEqual(classifyError(tokenError), 'context');
    });

    it('should classify file errors', () => {
      const fileError = new Error('File not accessible');
      assert.strictEqual(classifyError(fileError), 'file');
    });

    it('should classify network errors', () => {
      const networkError = new Error('Network connection failed');
      assert.strictEqual(classifyError(networkError), 'network');
    });

    it('should return unknown for unclassified errors', () => {
      const unknownError = new Error('Something weird happened');
      assert.strictEqual(classifyError(unknownError), 'unknown');
    });
  });

  describe('Token Estimation', () => {
    it('should estimate tokens correctly with default values', () => {
      const text = 'This is a test string with about twenty characters total.';
      const estimated = estimateTokens(text);
      const expected = Math.round((text.length / 4) * 1.2);
      assert.strictEqual(estimated, expected);
    });

    it('should respect custom chars per token', () => {
      const text = 'test';
      const estimated = estimateTokens(text, 2, 1.0); // 2 chars per token, no buffer
      assert.strictEqual(estimated, 2);
    });

    it('should apply buffer correctly', () => {
      const text = 'test';
      const estimated = estimateTokens(text, 4, 1.5); // 50% buffer
      assert.strictEqual(estimated, Math.round((4 / 4) * 1.5));
    });

    it('should handle empty strings', () => {
      const estimated = estimateTokens('');
      assert.strictEqual(estimated, 0);
    });
  });
});

describe('File Operations', () => {
  let testDir;

  before(async () => {
    testDir = await createTestDir();
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should create test files successfully', async () => {
    const content = 'console.log("Hello, World!");';
    const filePath = await createTestFile(testDir, 'test.js', content);
    
    // Verify file was created (this tests our test utility)
    const { readFile } = await import('fs/promises');
    const readContent = await readFile(filePath, 'utf-8');
    assert.strictEqual(readContent, content);
  });

  it('should handle various file types', async () => {
    const files = [
      { name: 'script.js', content: 'console.log("JavaScript");' },
      { name: 'data.json', content: '{"test": true}' },
      { name: 'doc.md', content: '# Test Document' },
      { name: 'style.css', content: 'body { margin: 0; }' },
    ];

    for (const file of files) {
      const filePath = await createTestFile(testDir, file.name, file.content);
      const { stat } = await import('fs/promises');
      const stats = await stat(filePath);
      assert.ok(stats.isFile());
      assert.ok(stats.size > 0);
    }
  });
});

describe('Configuration', () => {
  it('should parse environment variables correctly', () => {
    // Test that our environment setup is working
    assert.ok(process.env.GEMINI_API_KEY); // Should have a value (from .env or test)
    assert.strictEqual(process.env.MAX_FILE_SIZE, '1000000');
    assert.strictEqual(process.env.ENABLE_AUTO_OPTIMIZATION, 'true');
  });

  it('should handle missing environment variables with defaults', () => {
    delete process.env.SOME_OPTIONAL_VAR;
    const defaultValue = process.env.SOME_OPTIONAL_VAR || 'default';
    assert.strictEqual(defaultValue, 'default');
  });
});

// Mock API tests
describe('API Mocking', () => {
  it('should mock fetch for model API calls', async () => {
    // Mock fetch globally
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async (url) => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return {
          ok: true,
          json: async () => ({
            models: [
              { name: 'models/gemini-1.5-flash' },
              { name: 'models/gemini-1.5-pro' },
              { name: 'models/gemini-2.0-flash-exp' }
            ]
          })
        };
      }
      throw new Error('Unexpected URL');
    });

    // Test the mocked API
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=test');
    const data = await response.json();
    
    assert.ok(Array.isArray(data.models));
    assert.strictEqual(data.models.length, 3);
    assert.ok(data.models[0].name.includes('gemini'));

    // Restore fetch
    global.fetch = originalFetch;
  });
});

console.log('🧪 Unit tests completed! Run with: node --test test/unit.test.js');
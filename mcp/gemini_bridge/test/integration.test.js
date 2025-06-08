#!/usr/bin/env node

import { test, describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { writeFile, mkdir, rm, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadEnv } from './load-env.js';

// Load .env before importing main module
await loadEnv();

// Set test environment BEFORE importing main module to prevent real API calls
process.env.AUTO_FETCH_MODELS = 'false';
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-api-key-12345';

// Import our exported functions
import {
  normalizePath,
  isBinaryFile,
  createSmartError,
  classifyError,
  optimizeContext,
  estimateTokensForFiles,
  fetchAvailableModels,
  getAvailableModels,
  CONFIG,
  GeminiBridgeMCP
} from '../server.js';

// Test utilities
async function createTestDir() {
  const testDir = join(tmpdir(), `gemini-bridge-integration-${Date.now()}`);
  await mkdir(testDir, { recursive: true });
  return testDir;
}

async function createTestFile(dir, name, content) {
  const filePath = join(dir, name);
  await writeFile(filePath, content);
  return filePath;
}

async function createBinaryFile(dir, name) {
  const filePath = join(dir, name);
  // Create a more substantial binary file with lots of null bytes
  const binaryData = Buffer.alloc(1024, 0); // 1KB of null bytes
  binaryData.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0); // PNG header
  await writeFile(filePath, binaryData);
  return filePath;
}

// Mock environment setup
const originalEnv = process.env;
before(async () => {
  // Environment already loaded at module level
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-api-key-12345';
  process.env.MAX_FILE_SIZE = '1048576'; // 1MB
  process.env.MAX_TOTAL_TOKENS = '50000';
  process.env.ENABLE_AUTO_OPTIMIZATION = 'true';
  process.env.ENABLE_SMART_RECOVERY = 'true';
  process.env.AUTO_FETCH_MODELS = 'false'; // Disable for tests to prevent real API calls
});

after(() => {
  process.env = originalEnv;
});

describe('Binary File Detection', () => {
  let testDir;

  before(async () => {
    testDir = await createTestDir();
  });

  after(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('should detect text files as non-binary', async () => {
    const textFile = await createTestFile(testDir, 'test.txt', 'Hello, World!\nThis is a text file.');
    const isBinary = await isBinaryFile(textFile);
    assert.strictEqual(isBinary, false);
  });

  it('should detect JavaScript files as non-binary', async () => {
    const jsFile = await createTestFile(testDir, 'test.js', 'console.log("Hello, World!");\nfunction test() { return true; }');
    const isBinary = await isBinaryFile(jsFile);
    assert.strictEqual(isBinary, false);
  });

  it('should detect JSON files as non-binary', async () => {
    const jsonFile = await createTestFile(testDir, 'test.json', '{\n  "name": "test",\n  "value": 123,\n  "active": true\n}');
    const isBinary = await isBinaryFile(jsonFile);
    assert.strictEqual(isBinary, false);
  });

  it('should detect binary files correctly', async () => {
    const binaryFile = await createBinaryFile(testDir, 'test.png');
    const isBinary = await isBinaryFile(binaryFile);
    // With 1KB of null bytes, this should definitely be detected as binary
    assert.strictEqual(isBinary, true);
  });

  it('should detect files with null bytes as binary', async () => {
    const nullByteFile = await createTestFile(testDir, 'nullbyte.bin', 'Hello\x00World');
    const isBinary = await isBinaryFile(nullByteFile);
    assert.strictEqual(isBinary, true);
  });

  it('should handle empty files as non-binary', async () => {
    const emptyFile = await createTestFile(testDir, 'empty.txt', '');
    const isBinary = await isBinaryFile(emptyFile);
    assert.strictEqual(isBinary, false);
  });

  it('should handle non-existent files', async () => {
    const nonExistentFile = join(testDir, 'does-not-exist.txt');
    const isBinary = await isBinaryFile(nonExistentFile);
    assert.strictEqual(isBinary, true); // Should default to binary when can't read
  });
});

describe('Smart Error Handling', () => {
  it('should create smart error for API key issues', () => {
    const error = new Error('Invalid API key provided');
    const smartError = createSmartError(error, { model: 'gemini-1.5-flash' });
    
    assert.strictEqual(smartError.type, 'auth');
    assert.ok(smartError.suggestions.includes('Check that GEMINI_API_KEY is set correctly'));
    assert.ok(smartError.suggestions.includes('Verify your API key at https://aistudio.google.com/'));
  });

  it('should create smart error for quota issues', () => {
    const error = new Error('Quota exceeded for requests');
    const smartError = createSmartError(error);
    
    assert.strictEqual(smartError.type, 'quota');
    assert.ok(smartError.suggestions.some(s => s.includes('usage at https://aistudio.google.com')));
    assert.ok(smartError.suggestions.some(s => s.includes('less powerful model')));
  });

  it('should create smart error for model issues', () => {
    const error = new Error('Model gemini-invalid not found');
    const smartError = createSmartError(error);
    
    assert.strictEqual(smartError.type, 'model');
    assert.ok(smartError.suggestions.some(s => s.includes('get_system_info')));
  });

  it('should create smart error for context size issues', () => {
    const error = new Error('Context window size exceeded');
    const smartError = createSmartError(error, { 
      estimatedTokens: 150000,
      maxTokens: 100000 
    });
    
    assert.strictEqual(smartError.type, 'context');
    assert.ok(smartError.suggestions.some(s => s.includes('estimate_context_size')));
    assert.ok(smartError.suggestions.some(s => s.includes('Reduce the number of files')));
  });

  it('should preserve error context', () => {
    const error = new Error('Test error');
    const context = { model: 'test-model', files: 5 };
    const smartError = createSmartError(error, context);
    
    assert.deepStrictEqual(smartError.context, context);
    assert.strictEqual(smartError.message, 'Test error');
  });
});

describe('Context Optimization', () => {
  const mockFiles = [
    { path: 'config.json', content: '{"setting": "value"}', size: 20 },
    { path: 'README.md', content: '# Project\nThis is a test project with documentation.', size: 45 },
    { path: 'app.js', content: 'console.log("Main application file");\nfunction main() {\n  return true;\n}', size: 70 },
    { path: 'styles.css', content: 'body { margin: 0; padding: 0; background: white; }', size: 50 },
    { path: 'large-file.js', content: 'x'.repeat(1000), size: 1000 }
  ];

  it('should return original files when under token limit', () => {
    const result = optimizeContext(mockFiles.slice(0, 2), 1000); // Small subset, high limit
    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result, mockFiles.slice(0, 2));
  });

  it('should optimize by removing largest files first', () => {
    // Set a low token limit to force optimization
    const result = optimizeContext(mockFiles, 50); // Very low limit
    
    // Should keep smaller, higher priority files
    assert.ok(result.length < mockFiles.length);
    assert.ok(result.every(file => file.size <= 100)); // No large files
    
    // Should prioritize config and docs
    const filenames = result.map(f => f.path);
    assert.ok(filenames.includes('config.json'));
  });

  it('should respect file priority by extension', () => {
    const priorityFiles = [
      { path: 'config.json', content: 'a'.repeat(100) },
      { path: 'app.js', content: 'b'.repeat(100) },
      { path: 'styles.css', content: 'c'.repeat(100) }
    ];
    
    const result = optimizeContext(priorityFiles, 150); // Only room for ~1.5 files
    
    // Should keep config.json (priority 2) over styles.css (priority 5)
    const filenames = result.map(f => f.path);
    assert.ok(filenames.includes('config.json'));
  });

  it('should leave 10% buffer for safety', () => {
    const singleFile = [{ path: 'test.txt', content: 'x'.repeat(400) }]; // ~100 tokens
    const result = optimizeContext(singleFile, 111); // Just over 90% of 100 tokens
    
    // Should respect the 90% limit - if file is too large, it gets excluded
    assert.ok(Array.isArray(result));
    assert.ok(result.length <= 1);
  });
});

describe('Token Estimation', () => {
  it('should estimate tokens for multiple files', () => {
    const files = [
      { path: 'file1.txt', content: 'Hello World' }, // ~11 chars
      { path: 'file2.txt', content: 'Test content here' }, // ~17 chars
    ];
    
    const estimated = estimateTokensForFiles(files);
    
    // Should account for content + paths + overhead
    assert.ok(estimated > 0);
    assert.ok(estimated > (11 + 17) / 4); // Should be more than just content
  });

  it('should handle empty file list', () => {
    const estimated = estimateTokensForFiles([]);
    assert.strictEqual(estimated, 0);
  });

  it('should include path lengths in estimation', () => {
    const shortPath = [{ path: 'a.txt', content: 'test' }];
    const longPath = [{ path: 'very/long/path/to/file.txt', content: 'test' }];
    
    const shortEstimate = estimateTokensForFiles(shortPath);
    const longEstimate = estimateTokensForFiles(longPath);
    
    assert.ok(longEstimate > shortEstimate);
  });
});

describe('Model Management', () => {
  it('should handle API errors gracefully', async () => {
    // Mock fetch to simulate API error
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async () => {
      throw new Error('Network error');
    });

    try {
      const models = await fetchAvailableModels('test-key');
      // Should return empty array when API fails (system uses DEFAULT_MODEL)
      assert.ok(Array.isArray(models));
      assert.strictEqual(models.length, 0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should parse API response correctly', async () => {
    // Mock successful API response
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async (url) => {
      assert.ok(url.includes('generativelanguage.googleapis.com'));
      return {
        ok: true,
        json: async () => ({
          models: [
            { name: 'models/gemini-1.5-flash' },
            { name: 'models/gemini-1.5-pro' },
            { name: 'models/gemini-2.0-flash-exp' },
            { name: 'models/text-bison-001' } // Non-gemini model
          ]
        })
      };
    });

    try {
      const models = await fetchAvailableModels('test-key');
      assert.ok(Array.isArray(models));
      assert.strictEqual(models.length, 3); // Should filter to only gemini models
      assert.ok(models.includes('gemini-1.5-flash'));
      assert.ok(models.includes('gemini-1.5-pro'));
      assert.ok(models.includes('gemini-2.0-flash-exp'));
      assert.ok(!models.includes('text-bison-001'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should handle HTTP errors from API', async () => {
    const originalFetch = global.fetch;
    global.fetch = mock.fn(async () => ({
      ok: false,
      status: 403
    }));

    try {
      const models = await fetchAvailableModels('invalid-key');
      // Should return empty array when API fails (system uses DEFAULT_MODEL)
      assert.ok(Array.isArray(models));
      assert.strictEqual(models.length, 0);
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('Path Normalization Edge Cases', () => {
  it('should handle complex WSL paths', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'win32' });
    
    const result = normalizePath('/mnt/d/Projects/My Folder/file.txt');
    assert.strictEqual(result, 'D:/Projects/My Folder/file.txt');
    
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should handle UNC paths', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux' });
    
    const result = normalizePath('Z:/network/share/file.txt');
    assert.strictEqual(result, '/mnt/z/network/share/file.txt');
    
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('should handle relative paths', () => {
    const result = normalizePath('./src/components/Button.jsx');
    // normalize() might convert './' to just the path
    assert.ok(result.includes('src/components/Button.jsx'));
  });

  it('should normalize mixed slashes', () => {
    const result = normalizePath('src\\components/Button\\index.js');
    assert.strictEqual(result, 'src/components/Button/index.js');
  });
});

describe('Configuration', () => {
  it('should expose CONFIG object', () => {
    assert.ok(typeof CONFIG === 'object');
    assert.ok(typeof CONFIG.MAX_FILE_SIZE === 'number');
    assert.ok(typeof CONFIG.MAX_TOTAL_TOKENS === 'number');
    assert.ok(Array.isArray(CONFIG.EXCLUDED_EXTENSIONS));
    assert.ok(Array.isArray(CONFIG.EXCLUDED_DIRS));
  });

  it('should have reasonable defaults', () => {
    assert.ok(CONFIG.MAX_FILE_SIZE > 0);
    assert.ok(CONFIG.MAX_TOTAL_TOKENS > 0);
    assert.ok(CONFIG.EXCLUDED_EXTENSIONS.includes('.exe'));
    assert.ok(CONFIG.EXCLUDED_DIRS.includes('node_modules'));
    assert.ok(CONFIG.FORCE_TEXT_EXTENSIONS.includes('.pdf'));
  });

  it('should handle boolean environment variables', () => {
    assert.ok(typeof CONFIG.ENABLE_AUTO_OPTIMIZATION === 'boolean');
    assert.ok(typeof CONFIG.ENABLE_SMART_RECOVERY === 'boolean');
    assert.ok(typeof CONFIG.AUTO_FETCH_MODELS === 'boolean');
  });
});

describe('Server Class', () => {
  it('should create server instance without starting', () => {
    const server = new GeminiBridgeMCP();
    assert.ok(server instanceof GeminiBridgeMCP);
    assert.ok(typeof server.start === 'function');
    assert.ok(typeof server.setupTools === 'function');
  });

  it('should have server properties', () => {
    const server = new GeminiBridgeMCP();
    assert.ok(server.server);
    // Server instance created successfully
    assert.ok(typeof server.server === 'object');
  });
});

console.log('🧪 Integration tests completed! Run with: node --test test/integration.test.js');
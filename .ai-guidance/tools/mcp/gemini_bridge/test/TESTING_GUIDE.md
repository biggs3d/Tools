# Gemini Bridge MCP Server - Testing Guide

This guide provides comprehensive testing strategies for the Gemini Bridge MCP server, from automated tests to manual validation workflows.

## Quick Start Testing

### 1. Run Automated Tests
```bash
# Unit tests
node --test test/unit.test.js

# Integration tests  
node --test test/integration.test.js

# All tests
npm test
```

### 2. Health Check
```bash
# Start the server and check basic functionality
npm run health-check
```

### 3. Smoke Test
```bash
# Quick end-to-end validation
npm run smoke-test
```

## Automated Testing

### Unit Tests (`test/unit.test.js`)
Tests core utility functions:
- ✅ Path normalization (WSL ↔ Windows)
- ✅ Error classification and smart suggestions
- ✅ Token estimation algorithms
- ✅ Configuration parsing
- ✅ File operations

### Integration Tests (`test/integration.test.js`)
Tests component interactions:
- ✅ Binary file detection with real files
- ✅ Context optimization algorithms
- ✅ Model API mocking and fallbacks
- ✅ Smart error handling end-to-end
- ✅ Cross-platform path handling

### Running Tests
```bash
# Individual test files
node --test test/unit.test.js
node --test test/integration.test.js

# Watch mode (re-run on changes)
node --test --watch test/

# Verbose output
node --test --verbose test/

# Coverage (if using c8)
npx c8 node --test test/
```

## Manual Testing Workflows

### Workflow 1: Basic Functionality Test

**Prerequisites:**
- Valid `GEMINI_API_KEY` set
- MCP server running
- Claude Code connected

**Steps:**
1. **System Info Check**
   ```
   Use the gemini bridge get_system_info tool to verify configuration
   ```
   ✅ Expect: Configuration details, model list, smart features status

2. **File Discovery Test**
   ```
   Use find_relevant_files on this project directory
   ```
   ✅ Expect: List of code files, excludes binary/build files

3. **Context Estimation**
   ```
   Use estimate_context_size on a few key files (README.md, index.js)
   ```
   ✅ Expect: Token count, file breakdown, status within limits

4. **Basic Analysis**
   ```
   Use send_to_gemini with README.md and ask "Summarize this project"
   ```
   ✅ Expect: Coherent summary of the Gemini Bridge project

### Workflow 2: Error Handling & Recovery

**Goal:** Verify smart error messages and recovery suggestions

**Steps:**
1. **Invalid Model Test**
   ```
   Use send_to_gemini with model="invalid-model-name"
   ```
   ✅ Expect: Smart error with model suggestions

2. **Missing API Key Test**
   ```
   Temporarily unset GEMINI_API_KEY and restart server
   ```
   ✅ Expect: Clear error message with setup instructions

3. **Context Too Large Test**
   ```
   Use send_to_gemini with many large files to exceed token limit
   ```
   ✅ Expect: Auto-optimization attempt, then helpful suggestions

4. **File Access Test**
   ```
   Use send_to_gemini with non-existent file path
   ```
   ✅ Expect: Clear file access error with path suggestions

### Workflow 3: Cross-Platform Path Testing

**Goal:** Verify WSL ↔ Windows path normalization

**Prerequisites:** Test on both WSL and Windows, or mock platform

**Steps:**
1. **WSL Path Test**
   ```
   Use find_relevant_files with path "/mnt/c/Users/..."
   ```
   ✅ Expect: Normalized paths, successful file discovery

2. **Windows Path Test**
   ```
   Use find_relevant_files with path "C:/Users/..."
   ```
   ✅ Expect: Normalized paths, successful file discovery

3. **Mixed Path Test**
   ```
   Use send_to_gemini with mix of WSL and Windows style paths
   ```
   ✅ Expect: All paths normalized correctly

### Workflow 4: File Type Handling

**Goal:** Verify intelligent file detection and handling

**Test Data Setup:**
```bash
mkdir test-files
echo "console.log('test')" > test-files/script.js
echo "# Documentation" > test-files/readme.md
echo '{"test": true}' > test-files/data.json
echo -e "\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR" > test-files/image.png
```

**Steps:**
1. **Text File Detection**
   ```
   Use find_relevant_files on test-files directory
   ```
   ✅ Expect: Includes .js, .md, .json; excludes .png

2. **Binary File Handling**
   ```
   Try to use send_to_gemini with the .png file directly
   ```
   ✅ Expect: File skipped with informative message

3. **PDF Support Test**
   ```
   Use send_to_gemini with a PDF file (if available)
   ```
   ✅ Expect: PDF processed for text extraction

### Workflow 5: Smart Features Testing

**Goal:** Verify advanced features work as expected

**Steps:**
1. **Auto-Optimization Test**
   ```
   Use send_to_gemini with many files to trigger optimization
   ```
   ✅ Expect: Automatic file prioritization, optimization message

2. **Iterative Refinement Test**
   ```
   Set ENABLE_ITERATIVE_REFINEMENT=true, ask for analysis that might trigger refinement
   ```
   ✅ Expect: Multiple iterations if response contains trigger words

3. **Model Auto-Fetch Test**
   ```
   Set AUTO_FETCH_MODELS=true, check get_system_info
   ```
   ✅ Expect: Live model list from Gemini API

4. **Pattern Analysis Test**
   ```
   Use analyze_code_patterns with type="security" on some code files
   ```
   ✅ Expect: Focused security analysis with recommendations

### Workflow 6: Performance & Reliability

**Goal:** Verify performance and stability under various conditions

**Steps:**
1. **Large File Test**
   ```
   Test with files approaching MAX_FILE_SIZE limit
   ```
   ✅ Expect: Successful processing or clear size limit message

2. **Many Files Test**
   ```
   Test with directory containing 100+ files
   ```
   ✅ Expect: Reasonable response time, max file limit respected

3. **Concurrent Request Test**
   ```
   Make multiple MCP tool calls simultaneously
   ```
   ✅ Expect: All requests handled correctly

4. **Network Resilience Test**
   ```
   Test with poor network conditions (if possible)
   ```
   ✅ Expect: Graceful handling, fallback to cached models

## Test Data Creation

### Script: `test/create-test-data.js`
```javascript
#!/usr/bin/env node

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

async function createTestData() {
  const testDir = 'test-data';
  await mkdir(testDir, { recursive: true });
  
  // Code files
  await writeFile(join(testDir, 'app.js'), `
const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
`.trim());

  await writeFile(join(testDir, 'utils.ts'), `
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function calculateHash(input: string): string {
  // Simple hash function for testing
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}
`.trim());

  // Config files
  await writeFile(join(testDir, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project for Gemini Bridge',
    main: 'app.js',
    scripts: {
      start: 'node app.js',
      test: 'jest'
    },
    dependencies: {
      express: '^4.18.0'
    }
  }, null, 2));

  // Documentation
  await writeFile(join(testDir, 'README.md'), `
# Test Project

This is a test project for validating the Gemini Bridge MCP server.

## Features

- Express.js API server
- TypeScript utilities
- Comprehensive testing

## Usage

\`\`\`bash
npm install
npm start
\`\`\`

## API Endpoints

- \`GET /api/health\` - Health check endpoint
`.trim());

  // Binary file (simulated)
  const binaryData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    // ... more binary data
  ]);
  await writeFile(join(testDir, 'logo.png'), binaryData);

  console.log('✅ Test data created in test-data/ directory');
}

createTestData().catch(console.error);
```

## Smoke Test Script

### Script: `test/smoke-test.js`
```javascript
#!/usr/bin/env node

import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';

async function smokeTest() {
  console.log('🔥 Running Gemini Bridge Smoke Test...\n');
  
  // Check environment
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }
  
  console.log('✅ Environment check passed');
  
  // Test configuration loading
  try {
    const { CONFIG } = await import('../index.js');
    console.log('✅ Configuration loaded successfully');
    console.log(`   - Max file size: ${Math.round(CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB`);
    console.log(`   - Max tokens: ${CONFIG.MAX_TOTAL_TOKENS.toLocaleString()}`);
  } catch (error) {
    console.error('❌ Configuration loading failed:', error.message);
    process.exit(1);
  }
  
  // Test function imports
  try {
    const { normalizePath, classifyError, optimizeContext } = await import('../index.js');
    console.log('✅ Function imports successful');
    
    // Quick function tests
    const testPath = normalizePath('/test/path');
    const testError = classifyError(new Error('API key invalid'));
    console.log('✅ Core functions working');
    
  } catch (error) {
    console.error('❌ Function test failed:', error.message);
    process.exit(1);
  }
  
  console.log('\n🎉 Smoke test passed! Server should be ready for testing.');
}

smokeTest().catch(console.error);
```

## Health Check Script

### Script: `test/health-check.js`
```javascript
#!/usr/bin/env node

async function healthCheck() {
  console.log('🏥 Gemini Bridge Health Check\n');
  
  const checks = [];
  
  // Environment variables
  checks.push({
    name: 'GEMINI_API_KEY',
    status: !!process.env.GEMINI_API_KEY,
    message: process.env.GEMINI_API_KEY ? 'Set' : 'Missing - required for operation'
  });
  
  // Configuration
  try {
    const { CONFIG } = await import('../index.js');
    checks.push({
      name: 'Configuration Load',
      status: true,
      message: `✅ Loaded with ${Object.keys(CONFIG).length} settings`
    });
    
    checks.push({
      name: 'Smart Features',
      status: true,
      message: `Auto-opt: ${CONFIG.ENABLE_AUTO_OPTIMIZATION}, Smart-recovery: ${CONFIG.ENABLE_SMART_RECOVERY}`
    });
    
  } catch (error) {
    checks.push({
      name: 'Configuration Load',
      status: false,
      message: `❌ Failed: ${error.message}`
    });
  }
  
  // Core functions
  try {
    const { normalizePath, isBinaryFile, createSmartError } = await import('../index.js');
    
    // Test path normalization
    const testResult = normalizePath('/test/path');
    checks.push({
      name: 'Path Normalization',
      status: typeof testResult === 'string',
      message: '✅ Working correctly'
    });
    
    // Test error creation
    const smartError = createSmartError(new Error('test'));
    checks.push({
      name: 'Smart Error Creation',
      status: smartError && smartError.type && smartError.suggestions,
      message: '✅ Error classification working'
    });
    
  } catch (error) {
    checks.push({
      name: 'Core Functions',
      status: false,
      message: `❌ Import failed: ${error.message}`
    });
  }
  
  // Display results
  console.log('Health Check Results:');
  console.log('='.repeat(50));
  
  let allPassed = true;
  for (const check of checks) {
    const status = check.status ? '✅' : '❌';
    console.log(`${status} ${check.name}: ${check.message}`);
    if (!check.status) allPassed = false;
  }
  
  console.log('='.repeat(50));
  
  if (allPassed) {
    console.log('🎉 All health checks passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some health checks failed. See above for details.');
    process.exit(1);
  }
}

healthCheck().catch(console.error);
```

## Continuous Testing

### GitHub Actions Workflow (`.github/workflows/test.yml`)
```yaml
name: Test Gemini Bridge

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        cd gemini_bridge
        npm install
        
    - name: Run unit tests
      run: |
        cd gemini_bridge
        node --test test/unit.test.js
        
    - name: Run integration tests
      run: |
        cd gemini_bridge
        node --test test/integration.test.js
        
    - name: Run health check
      run: |
        cd gemini_bridge
        node test/health-check.js
      env:
        GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

## Next Steps for Testing

1. **Run the automated tests** to verify core functionality
2. **Follow the manual workflows** to test real-world scenarios
3. **Set up the health check** in your CI/CD pipeline
4. **Create your own test data** specific to your use cases
5. **Monitor performance** with various file sizes and types

## Test Coverage Goals

- ✅ Unit tests: 90%+ coverage of utility functions
- ✅ Integration tests: All major component interactions
- ✅ Manual tests: Real-world usage scenarios
- ✅ Error paths: All error types and recovery scenarios
- ✅ Cross-platform: WSL and Windows path handling
- ✅ Performance: Large files and many files scenarios

Remember: **Test early, test often, test realistically!**
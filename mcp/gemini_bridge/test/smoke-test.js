#!/usr/bin/env node

import { spawn } from 'child_process';
import { writeFile } from 'fs/promises';
import { loadEnv } from './load-env.js';

async function smokeTest() {
  // Load .env file if available
  await loadEnv();
  console.log('🔥 Running Gemini Bridge Smoke Test...\n');
  
  let allPassed = true;
  
  // Check environment
  console.log('🔍 Environment Check');
  console.log('='.repeat(30));
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not set');
    console.error('   Set it with: export GEMINI_API_KEY="your-key-here"');
    allPassed = false;
  } else {
    console.log('✅ GEMINI_API_KEY is set');
    // Mask the key for security
    const maskedKey = process.env.GEMINI_API_KEY.slice(0, 8) + '...' + process.env.GEMINI_API_KEY.slice(-4);
    console.log(`   Key: ${maskedKey}`);
  }
  
  // Test configuration loading
  console.log('\n📋 Configuration Test');
  console.log('='.repeat(30));
  
  try {
    const { CONFIG } = await import('../index.js');
    console.log('✅ Configuration loaded successfully');
    console.log(`   - Max file size: ${Math.round(CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB`);
    console.log(`   - Max tokens: ${CONFIG.MAX_TOTAL_TOKENS.toLocaleString()}`);
    console.log(`   - Default model: ${CONFIG.DEFAULT_MODEL}`);
    console.log(`   - Auto-optimization: ${CONFIG.ENABLE_AUTO_OPTIMIZATION ? 'ON' : 'OFF'}`);
    console.log(`   - Smart recovery: ${CONFIG.ENABLE_SMART_RECOVERY ? 'ON' : 'OFF'}`);
    console.log(`   - Auto-fetch models: ${CONFIG.AUTO_FETCH_MODELS ? 'ON' : 'OFF'}`);
  } catch (error) {
    console.error('❌ Configuration loading failed:', error.message);
    allPassed = false;
  }
  
  // Test function imports
  console.log('\n🔧 Function Import Test');
  console.log('='.repeat(30));
  
  try {
    const { 
      normalizePath, 
      classifyError, 
      optimizeContext, 
      isBinaryFile,
      createSmartError,
      estimateTokensForFiles,
      fetchAvailableModels
    } = await import('../index.js');
    
    console.log('✅ All functions imported successfully');
    console.log('   - normalizePath, classifyError, optimizeContext');
    console.log('   - isBinaryFile, createSmartError, estimateTokensForFiles');
    console.log('   - fetchAvailableModels');
    
    // Quick function tests
    const testPath = normalizePath('/test/path');
    console.log(`   - Path normalization test: "${testPath}"`);
    
    const testError = classifyError(new Error('API key invalid'));
    console.log(`   - Error classification test: "${testError}"`);
    
    const testTokens = estimateTokensForFiles([
      { path: 'test.js', content: 'console.log("test");' }
    ]);
    console.log(`   - Token estimation test: ${testTokens} tokens`);
    
  } catch (error) {
    console.error('❌ Function test failed:', error.message);
    allPassed = false;
  }
  
  // Test binary detection
  console.log('\n🔍 Binary Detection Test');
  console.log('='.repeat(30));
  
  try {
    const { isBinaryFile } = await import('../index.js');
    
    // Test with this script (should be text)
    const isThisBinary = await isBinaryFile(import.meta.url.replace('file://', ''));
    if (isThisBinary) {
      console.log('⚠️  Binary detection may be too aggressive (detected this JS file as binary)');
    } else {
      console.log('✅ Binary detection working (correctly identified JS file as text)');
    }
    
  } catch (error) {
    console.error('❌ Binary detection test failed:', error.message);
    allPassed = false;
  }
  
  // API connectivity test (if API key is available)
  if (process.env.GEMINI_API_KEY) {
    console.log('\n🌐 API Connectivity Test');
    console.log('='.repeat(30));
    
    try {
      const { fetchAvailableModels } = await import('../index.js');
      const models = await fetchAvailableModels(process.env.GEMINI_API_KEY);
      
      if (models && models.length > 0) {
        console.log('✅ Gemini API connection successful');
        console.log(`   - Found ${models.length} available models`);
        console.log(`   - Sample models: ${models.slice(0, 3).join(', ')}`);
      } else {
        console.log('⚠️  API connected but no models returned');
      }
    } catch (error) {
      console.log('⚠️  API test failed (fallback will be used):', error.message);
      // Not a critical failure
    }
  }
  
  // Test data check
  console.log('\n📁 Test Data Check');
  console.log('='.repeat(30));
  
  try {
    const { stat } = await import('fs/promises');
    
    try {
      await stat('test-data');
      console.log('✅ Test data directory exists');
      console.log('   Use: node test/create-test-data.js to refresh test data');
    } catch {
      console.log('📋 Test data not found');
      console.log('   Run: node test/create-test-data.js to create test files');
    }
  } catch (error) {
    console.log('⚠️  Could not check test data:', error.message);
  }
  
  // Results summary
  console.log('\n' + '='.repeat(50));
  
  if (allPassed) {
    console.log('🎉 All smoke tests passed!');
    console.log('   The Gemini Bridge server should be ready for use.');
    console.log('\nNext steps:');
    console.log('1. Start the server: npm start');
    console.log('2. Test with Claude Code MCP integration');
    console.log('3. Run manual tests from TESTING_GUIDE.md');
    process.exit(0);
  } else {
    console.log('⚠️  Some smoke tests failed.');
    console.log('   Please address the issues above before using the server.');
    console.log('\nTroubleshooting:');
    console.log('- Ensure GEMINI_API_KEY is set correctly');
    console.log('- Check dependencies with: npm install');
    console.log('- Review configuration in .env file');
    process.exit(1);
  }
}

smokeTest().catch(error => {
  console.error('\n💥 Smoke test crashed:', error.message);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});
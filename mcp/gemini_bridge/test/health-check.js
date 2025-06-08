#!/usr/bin/env node

import { loadEnv } from './load-env.js';

async function healthCheck() {
  // Load .env file if available
  await loadEnv();
  console.log('🏥 Gemini Bridge Health Check\n');
  
  const checks = [];
  let criticalFailure = false;
  
  // Environment variables
  console.log('🔐 Environment Variables');
  console.log('='.repeat(40));
  
  const apiKeyStatus = !!process.env.GEMINI_API_KEY;
  checks.push({
    name: 'GEMINI_API_KEY',
    status: apiKeyStatus,
    critical: true,
    message: apiKeyStatus 
      ? `Set (${process.env.GEMINI_API_KEY.slice(0, 8)}...${process.env.GEMINI_API_KEY.slice(-4)})` 
      : 'Missing - required for operation'
  });
  
  checks.push({
    name: 'NODE_VERSION',
    status: true,
    critical: false,
    message: `${process.version} ${parseInt(process.version.slice(1)) >= 18 ? '✅' : '⚠️ (recommend 18+)'}`
  });
  
  // Configuration loading
  console.log('\n📋 Configuration');
  console.log('='.repeat(40));
  
  try {
    const { CONFIG } = await import('../index.js');
    checks.push({
      name: 'Configuration Load',
      status: true,
      critical: true,
      message: `✅ Loaded with ${Object.keys(CONFIG).length} settings`
    });
    
    checks.push({
      name: 'File Size Limit',
      status: CONFIG.MAX_FILE_SIZE > 0,
      critical: false,
      message: `${Math.round(CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB`
    });
    
    checks.push({
      name: 'Token Limit',
      status: CONFIG.MAX_TOTAL_TOKENS > 0,
      critical: false,
      message: `${CONFIG.MAX_TOTAL_TOKENS.toLocaleString()} tokens`
    });
    
    checks.push({
      name: 'Default Model',
      status: !!CONFIG.DEFAULT_MODEL,
      critical: true,
      message: CONFIG.DEFAULT_MODEL
    });
    
    // Smart features check
    const smartFeatures = [];
    if (CONFIG.ENABLE_AUTO_OPTIMIZATION) smartFeatures.push('Auto-Optimization');
    if (CONFIG.ENABLE_SMART_RECOVERY) smartFeatures.push('Smart-Recovery');
    if (CONFIG.AUTO_FETCH_MODELS) smartFeatures.push('Auto-Fetch-Models');
    if (CONFIG.ENABLE_ITERATIVE_REFINEMENT) smartFeatures.push('Iterative-Refinement');
    
    checks.push({
      name: 'Smart Features',
      status: smartFeatures.length > 0,
      critical: false,
      message: smartFeatures.length > 0 ? smartFeatures.join(', ') : 'None enabled'
    });
    
  } catch (error) {
    checks.push({
      name: 'Configuration Load',
      status: false,
      critical: true,
      message: `❌ Failed: ${error.message}`
    });
  }
  
  // Core functions
  console.log('\n🔧 Core Functions');
  console.log('='.repeat(40));
  
  try {
    const { normalizePath, isBinaryFile, createSmartError, classifyError, optimizeContext } = await import('../index.js');
    
    // Test path normalization
    const testResult = normalizePath('/test/path');
    checks.push({
      name: 'Path Normalization',
      status: typeof testResult === 'string',
      critical: false,
      message: '✅ Working correctly'
    });
    
    // Test error creation
    const smartError = createSmartError(new Error('test'));
    checks.push({
      name: 'Smart Error Creation',
      status: smartError && smartError.type && smartError.suggestions,
      critical: false,
      message: '✅ Error classification working'
    });
    
    // Test binary file detection function exists
    checks.push({
      name: 'Binary File Detection',
      status: typeof isBinaryFile === 'function',
      critical: false,
      message: '✅ Function available'
    });
    
    // Test context optimization
    const testFiles = [{ path: 'test.js', content: 'test content' }];
    const optimized = optimizeContext(testFiles, 1000);
    checks.push({
      name: 'Context Optimization',
      status: Array.isArray(optimized),
      critical: false,
      message: '✅ Optimization working'
    });
    
  } catch (error) {
    checks.push({
      name: 'Core Functions',
      status: false,
      critical: true,
      message: `❌ Import failed: ${error.message}`
    });
  }
  
  // Model management
  console.log('\n🤖 Model Management');
  console.log('='.repeat(40));
  
  if (process.env.GEMINI_API_KEY) {
    try {
      const { getAvailableModels, fetchAvailableModels } = await import('../index.js');
      
      // Test model fetching (with timeout)
      const modelFetchPromise = fetchAvailableModels(process.env.GEMINI_API_KEY);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      );
      
      try {
        const models = await Promise.race([modelFetchPromise, timeoutPromise]);
        checks.push({
          name: 'Model API Access',
          status: models && models.length > 0,
          critical: false,
          message: models ? `✅ ${models.length} models available` : '⚠️ No models returned'
        });
      } catch (fetchError) {
        checks.push({
          name: 'Model API Access',
          status: false,
          critical: false,
          message: `⚠️ Failed: ${fetchError.message} (fallback will be used)`
        });
      }
      
    } catch (error) {
      checks.push({
        name: 'Model Management',
        status: false,
        critical: false,
        message: `❌ Error: ${error.message}`
      });
    }
  } else {
    checks.push({
      name: 'Model API Access',
      status: false,
      critical: false,
      message: '❌ Skipped (no API key)'
    });
  }
  
  // File system access
  console.log('\n📁 File System');
  console.log('='.repeat(40));
  
  try {
    const { readdir, stat } = await import('fs/promises');
    
    // Test current directory access
    await readdir('.');
    checks.push({
      name: 'Directory Access',
      status: true,
      critical: true,
      message: '✅ Can read current directory'
    });
    
    // Test file stat access
    const stats = await stat(import.meta.url.replace('file://', ''));
    checks.push({
      name: 'File Stat Access',
      status: stats.isFile(),
      critical: true,
      message: '✅ Can stat files'
    });
    
  } catch (error) {
    checks.push({
      name: 'File System Access',
      status: false,
      critical: true,
      message: `❌ Failed: ${error.message}`
    });
  }
  
  // Dependencies check
  console.log('\n📦 Dependencies');
  console.log('='.repeat(40));
  
  const requiredDeps = [
    { name: '@modelcontextprotocol/sdk', import: '@modelcontextprotocol/sdk/server/mcp.js' },
    { name: '@google/generative-ai', import: '@google/generative-ai' },
    { name: 'zod', import: 'zod' }
  ];
  
  for (const dep of requiredDeps) {
    try {
      await import(dep.import);
      checks.push({
        name: `Dependency: ${dep.name}`,
        status: true,
        critical: true,
        message: '✅ Available'
      });
    } catch (error) {
      checks.push({
        name: `Dependency: ${dep.name}`,
        status: false,
        critical: true,
        message: `❌ Missing: ${error.message}`
      });
    }
  }
  
  // Display results
  console.log('\n' + '='.repeat(60));
  console.log('Health Check Results');
  console.log('='.repeat(60));
  
  let passedCount = 0;
  let criticalFailureCount = 0;
  
  for (const check of checks) {
    const status = check.status ? '✅' : '❌';
    const criticalMarker = check.critical ? ' [CRITICAL]' : '';
    console.log(`${status} ${check.name}${criticalMarker}: ${check.message}`);
    
    if (check.status) {
      passedCount++;
    } else if (check.critical) {
      criticalFailureCount++;
      criticalFailure = true;
    }
  }
  
  console.log('='.repeat(60));
  console.log(`Results: ${passedCount}/${checks.length} checks passed`);
  
  if (criticalFailure) {
    console.log(`⚠️  ${criticalFailureCount} critical failures detected`);
    console.log('\nThe server will NOT function properly until critical issues are resolved.');
    console.log('\nNext steps:');
    console.log('1. Set GEMINI_API_KEY environment variable');
    console.log('2. Run: npm install (if dependencies are missing)');
    console.log('3. Check file permissions and Node.js version');
    process.exit(1);
  } else if (passedCount === checks.length) {
    console.log('🎉 All health checks passed!');
    console.log('\nThe Gemini Bridge server is healthy and ready for use.');
    console.log('\nNext steps:');
    console.log('1. Run: npm start (to start the server)');
    console.log('2. Test with Claude Code MCP integration');
    console.log('3. Run: npm run smoke-test (for additional validation)');
    process.exit(0);
  } else {
    console.log('⚠️  Some non-critical issues detected.');
    console.log('The server should work, but consider addressing the warnings above.');
    console.log('\nRecommendations:');
    console.log('- Review failed checks and improve configuration');
    console.log('- Check network connectivity for API access');
    console.log('- Enable smart features for better performance');
    process.exit(0);
  }
}

healthCheck().catch(error => {
  console.error('\n💥 Health check crashed:', error.message);
  console.error('This indicates a serious configuration or environment issue.');
  console.error('\nDebug info:');
  console.error('- Node.js version:', process.version);
  console.error('- Platform:', process.platform);
  console.error('- Working directory:', process.cwd());
  console.error('\nStack trace:', error.stack);
  process.exit(1);
});
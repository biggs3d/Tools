import { PuppeteerLogger } from '../lib/puppeteer-logger.js';

console.log('Running browser-debug smoke test...');

async function test() {
  const logger = new PuppeteerLogger();
  
  try {
    await logger.init({ headless: true });
    console.log('✓ Browser initialized');
    
    const navResult = await logger.navigate('https://example.com');
    console.log('✓ Navigation successful:', navResult.success);
    
    const status = await logger.getStatus();
    console.log('✓ Status retrieved:', status.browserConnected);
    
    const logs = logger.getLogs('error');
    console.log('✓ Logs retrieved:', logs.length, 'entries');
    
    logger.clearLogs();
    console.log('✓ Logs cleared');
    
    await logger.dispose();
    console.log('✓ Browser disposed');
    
    console.log('\nAll tests passed!');
  } catch (error) {
    console.error('Test failed:', error);
    await logger.dispose();
    process.exit(1);
  }
}

test();
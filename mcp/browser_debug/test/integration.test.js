import { PuppeteerLogger } from '../lib/puppeteer-logger.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Running browser-debug integration tests...\n');

const TEST_PAGE_URL = `file://${join(__dirname, 'test-page.html')}`;

async function runTests() {
  const logger = new PuppeteerLogger();
  let testsPassed = 0;
  let testsFailed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✓ ${name}`);
      testsPassed++;
    } catch (error) {
      console.error(`✗ ${name}`);
      console.error(`  Error: ${error.message}`);
      testsFailed++;
    }
  }

  try {
    // Initialize browser
    await logger.init({ headless: true });
    console.log('Browser initialized\n');

    // Navigate to test page
    const navResult = await logger.navigate(TEST_PAGE_URL);
    await test('Navigate to test page', async () => {
      if (!navResult.success) throw new Error('Navigation failed');
      if (!navResult.title.includes('Browser Debug MCP Test Page')) {
        throw new Error(`Unexpected title: ${navResult.title}`);
      }
    });

    // Wait for page to fully load and execute scripts
    await logger.page.waitForFunction(() => {
      return window.addEventListener !== undefined;
    }, { timeout: 5000 });
    
    // Give time for console event handlers to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test direct console.log to verify logging works
    await logger.page.evaluate(() => {
      console.log('Direct test log from evaluate');
    });
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Debug: Show current logs
    const allLogs = logger.getLogs('log');
    console.log('\nDebug - Total logs captured:', allLogs.length);
    if (allLogs.length > 0) {
      console.log('First few logs:');
      allLogs.slice(0, 3).forEach(log => {
        console.log(`  [${log.type}] ${log.text.substring(0, 100)}...`);
      });
    }

    // Test 1: Check initial page load logs
    await test('Capture page load logs', async () => {
      const logs = logger.getLogs('log');
      const loadLog = logs.find(log => log.text.includes('Test page loaded at'));
      if (!loadLog) {
        console.log('  Available logs:', logs.map(l => l.text.substring(0, 50)));
        throw new Error('Page load log not found');
      }
    });

    // Test 2: Test basic console methods by clicking buttons
    await logger.page.click('button[onclick="testBasicLogs()"]');
    await new Promise(resolve => setTimeout(resolve, 500));

    await test('Capture basic console.log messages', async () => {
      const logs = logger.getLogs('log');
      const basicLog = logs.find(log => log.text.includes('This is a basic log message'));
      if (!basicLog) throw new Error('Basic log message not found');
      
      const numberLog = logs.find(log => log.text.includes('Log with number: 42'));
      if (!numberLog) throw new Error('Number log not found');
    });

    // Test 3: Test warnings
    await logger.page.click('button[onclick="testWarnings()"]');
    await new Promise(resolve => setTimeout(resolve, 500));

    await test('Capture console.warn messages', async () => {
      const warnings = logger.getLogs('warning');
      const warnLog = warnings.find(log => 
        log.text.includes('This is a warning message') && (log.type === 'warning' || log.type === 'warn')
      );
      if (!warnLog) {
        console.log('  Available warnings:', warnings.map(w => `[${w.type}] ${w.text.substring(0, 50)}`));
        throw new Error('Warning message not found');
      }
    });

    // Test 4: Test console errors
    await logger.page.click('button[onclick="testErrors()"]');
    await new Promise(resolve => setTimeout(resolve, 500));

    await test('Capture console.error messages', async () => {
      const errors = logger.getLogs('error');
      const errorLog = errors.find(log => 
        log.text.includes('This is an error message') && log.type === 'error'
      );
      if (!errorLog) throw new Error('Error message not found');
    });

    // Test 5: Test page errors (uncaught exceptions)
    await test('Capture uncaught exceptions', async () => {
      const beforeCount = logger.getLogs('error').length;
      
      // Inject a script that will throw an error asynchronously
      await logger.page.evaluate(() => {
        setTimeout(() => {
          throw new Error('Test uncaught error from setTimeout');
        }, 100);
      });
      
      // Wait for the error to be thrown and caught
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const errors = logger.getLogs('error');
      const afterCount = errors.length;
      
      if (afterCount <= beforeCount) {
        console.log('  Errors before:', beforeCount, 'Errors after:', afterCount);
        console.log('  Recent errors:', errors.slice(-3).map(e => e.text.substring(0, 50)));
        throw new Error('No new errors captured');
      }
      
      const uncaughtError = errors.find(log => 
        log.text.includes('Test uncaught error') || log.text.includes('Uncaught Error')
      );
      if (!uncaughtError) throw new Error('Uncaught error not captured');
      if (!uncaughtError.stack) throw new Error('Stack trace not captured');
    });

    // Test 6: Test network errors
    await logger.page.click('button[onclick="loadBadImage()"]');
    await new Promise(resolve => setTimeout(resolve, 1500));

    await test('Capture network failures', async () => {
      const errors = logger.getLogs('error');
      const networkError = errors.find(log => 
        log.text.includes('non-existent-image') || log.text.includes('Image failed to load')
      );
      if (!networkError) throw new Error('Network error not captured');
    });

    // Test 7: Test log filtering by severity
    await test('Filter logs by severity level', async () => {
      logger.clearLogs();
      
      // Generate logs of different severities
      await logger.page.evaluate(() => {
        console.log('Test log');
        console.info('Test info');
        console.warn('Test warning');
        console.error('Test error');
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const allLogs = logger.getLogs('log');
      const infoAndAbove = logger.getLogs('info');
      const warningAndAbove = logger.getLogs('warning');
      const errorsOnly = logger.getLogs('error');
      
      if (allLogs.length !== 4) throw new Error(`Expected 4 logs, got ${allLogs.length}`);
      if (infoAndAbove.length !== 3) throw new Error(`Expected 3 info+, got ${infoAndAbove.length}`);
      if (warningAndAbove.length !== 2) throw new Error(`Expected 2 warning+, got ${warningAndAbove.length}`);
      if (errorsOnly.length !== 1) throw new Error(`Expected 1 error, got ${errorsOnly.length}`);
    });

    // Test 8: Test log buffer limit
    await test('Retrieve limited number of logs', async () => {
      logger.clearLogs();
      await logger.page.click('button[onclick="rapidFire()"]');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const allLogs = logger.getLogs('log');
      const limitedLogs = logger.getLogs('log', 10);
      
      if (allLogs.length < 50) throw new Error('Not enough logs generated');
      if (limitedLogs.length !== 10) throw new Error(`Expected 10 limited logs, got ${limitedLogs.length}`);
      
      // Verify we got the most recent logs
      const lastAllLog = allLogs[allLogs.length - 1];
      const lastLimitedLog = limitedLogs[limitedLogs.length - 1];
      if (lastAllLog.timestamp !== lastLimitedLog.timestamp) {
        throw new Error('Limited logs should return most recent entries');
      }
    });

    // Test 9: Test clear logs functionality
    await test('Clear log buffer', async () => {
      const beforeClear = logger.getLogs('log').length;
      if (beforeClear === 0) throw new Error('No logs to clear');
      
      const result = logger.clearLogs();
      if (!result.cleared) throw new Error('Clear logs did not return success');
      
      const afterClear = logger.getLogs('log').length;
      if (afterClear !== 0) throw new Error('Logs were not cleared');
    });

    // Test 10: Test status reporting
    await test('Get browser status', async () => {
      const status = await logger.getStatus();
      
      if (!status.browserConnected) throw new Error('Browser should be connected');
      if (!status.currentUrl.includes('test-page.html')) throw new Error('Wrong current URL');
      if (typeof status.logCount !== 'number') throw new Error('Log count should be a number');
    });

    // Test 11: Test special characters and edge cases
    await logger.page.click('button[onclick="specialCharacters()"]');
    await new Promise(resolve => setTimeout(resolve, 500));

    await test('Handle special characters in logs', async () => {
      const logs = logger.getLogs('log');
      const unicodeLog = logs.find(log => log.text.includes('🚀'));
      if (!unicodeLog) throw new Error('Unicode characters not captured correctly');
      
      const specialLog = logs.find(log => log.text.includes('Special chars:'));
      if (!specialLog) throw new Error('Special characters log not found');
    });

    // Test 12: Test multiple arguments in console
    await logger.page.click('button[onclick="multipleArgs()"]');
    await new Promise(resolve => setTimeout(resolve, 500));

    await test('Handle multiple console arguments', async () => {
      const logs = logger.getLogs('log');
      const multiLog = logs.find(log => log.text.includes('Multiple arguments'));
      if (!multiLog) throw new Error('Multiple arguments log not found');
      if (multiLog.args === undefined) throw new Error('Args count not tracked');
    });

    // Test 13: Test promise rejection handling
    await logger.page.click('button[onclick="promiseRejection()"]');
    await new Promise(resolve => setTimeout(resolve, 1500));

    await test('Capture unhandled promise rejections', async () => {
      const errors = logger.getLogs('error');
      const promiseError = errors.find(log => 
        log.text.includes('Unhandled promise rejection')
      );
      if (!promiseError) throw new Error('Promise rejection not captured');
    });

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`Tests passed: ${testsPassed}`);
    console.log(`Tests failed: ${testsFailed}`);
    console.log('='.repeat(50));

    if (testsFailed > 0) {
      throw new Error(`${testsFailed} tests failed`);
    }

    console.log('\n✅ All integration tests passed!');

  } catch (error) {
    console.error('\n❌ Integration test suite failed:', error.message);
    process.exitCode = 1;
  } finally {
    await logger.dispose();
    console.log('\nBrowser disposed');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
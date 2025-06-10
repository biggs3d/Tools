import puppeteer from 'puppeteer';

const MAX_LOG_ENTRIES = 1000;
const SEVERITY_LEVELS = ['error', 'warning', 'info', 'log'];

export class PuppeteerLogger {
  constructor() {
    this.browser = null;
    this.page = null;
    this.logBuffer = [];
  }

  async init(options = {}) {
    const { headless = true, ...browserOptions } = options;
    
    this.browser = await puppeteer.launch({ 
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      ...browserOptions 
    });
    
    this.page = await this.browser.newPage();
    
    this.page.on('console', async (msg) => {
      try {
        // Get the text representation of the console message
        let text = msg.text();
        
        // If text is empty, try to extract from args
        if (!text && msg.args().length > 0) {
          const textParts = [];
          for (const arg of msg.args()) {
            try {
              const value = await arg.jsonValue();
              textParts.push(typeof value === 'object' ? JSON.stringify(value) : String(value));
            } catch {
              textParts.push(await arg.toString());
            }
          }
          text = textParts.join(' ');
        }
        
        this.addLog({
          type: msg.type(),
          text: text,
          args: msg.args().length,
          location: msg.location(),
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        // Fallback to basic text
        this.addLog({
          type: msg.type(),
          text: msg.text() || '[Failed to capture message]',
          args: msg.args().length,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    this.page.on('pageerror', err => {
      this.addLog({
        type: 'error',
        text: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
    });
    
    this.page.on('requestfailed', request => {
      this.addLog({
        type: 'error',
        text: `Network request failed: ${request.failure().errorText}`,
        url: request.url(),
        timestamp: new Date().toISOString()
      });
    });
  }

  addLog(entry) {
    this.logBuffer.push(entry);
    if (this.logBuffer.length > MAX_LOG_ENTRIES) {
      this.logBuffer.shift();
    }
  }

  async navigate(url) {
    if (!this.page) {
      throw new Error('Browser not initialized. Call init() first.');
    }

    if (!url) {
      throw new Error('URL is required for navigation');
    }

    try {
      const response = await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      return {
        success: true,
        url: this.page.url(),
        title: await this.page.title(),
        status: response.status()
      };
    } catch (error) {
      this.addLog({
        type: 'error',
        text: `Navigation failed: ${error.message}`,
        timestamp: new Date().toISOString()
      });
      
      return { 
        success: false, 
        error: error.message,
        url: url
      };
    }
  }

  getLogs(level = 'error', limit = -1) {
    const minSeverityIndex = SEVERITY_LEVELS.indexOf(level);
    if (minSeverityIndex === -1) {
      throw new Error(`Invalid log level: ${level}. Valid levels: ${SEVERITY_LEVELS.join(', ')}`);
    }

    let filteredLogs = this.logBuffer.filter(entry => {
      // Normalize console types to our severity levels
      let entryLevel = entry.type;
      if (entry.type === 'warn') entryLevel = 'warning';
      if (entry.type === 'debug') entryLevel = 'log';
      
      const entrySeverityIndex = SEVERITY_LEVELS.indexOf(entryLevel);
      return entrySeverityIndex !== -1 && entrySeverityIndex <= minSeverityIndex;
    });

    if (limit > 0) {
      filteredLogs = filteredLogs.slice(-limit);
    }

    return filteredLogs;
  }

  clearLogs() {
    this.logBuffer = [];
    return { cleared: true, message: 'Log buffer cleared' };
  }

  getStatus() {
    return {
      browserConnected: this.browser?.isConnected() || false,
      currentUrl: this.page?.url() || null,
      pageTitle: this.page ? this.page.title().catch(() => null) : null,
      logCount: this.logBuffer.length,
      oldestLog: this.logBuffer[0]?.timestamp || null,
      newestLog: this.logBuffer[this.logBuffer.length - 1]?.timestamp || null
    };
  }

  async dispose() {
    if (this.page) {
      await this.page.close().catch(console.error);
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close().catch(console.error);
      this.browser = null;
    }
    this.logBuffer = [];
  }
}
export const config = {
  server: {
    name: 'browser-debug',
    version: '1.0.0',
    description: 'Browser debugging and console logging via Puppeteer'
  },
  
  browser: {
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    defaultTimeout: parseInt(process.env.PUPPETEER_TIMEOUT || '30000', 10),
    args: process.env.PUPPETEER_ARGS ? process.env.PUPPETEER_ARGS.split(',') : []
  },
  
  logging: {
    maxEntries: parseInt(process.env.MAX_LOG_ENTRIES || '1000', 10),
    defaultLevel: process.env.DEFAULT_LOG_LEVEL || 'error'
  }
};

export function getBrowserOptions() {
  const options = {
    headless: config.browser.headless,
    timeout: config.browser.defaultTimeout
  };
  
  if (config.browser.args.length > 0) {
    options.args = config.browser.args;
  }
  
  return options;
}
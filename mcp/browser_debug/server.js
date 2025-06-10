#!/usr/bin/env node

// Load .env file configuration
import 'dotenv/config';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { PuppeteerLogger } from './lib/puppeteer-logger.js';
import { config, getBrowserOptions } from './lib/config.js';

class BrowserDebugMCP {
  constructor() {
    this.server = new McpServer({
      name: config.server.name,
      version: config.server.version
    });
    
    this.logger = new PuppeteerLogger();
    this.setupTools();
  }

  setupTools() {
    // Register navigate tool
    this.server.tool(
      'navigate',
      'Navigate to a URL and start capturing console messages',
      {
        url: z.string().url().describe('The URL to navigate to')
      },
      async ({ url }) => {
        const result = await this.logger.navigate(url);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
    );

    // Register get_logs tool
    this.server.tool(
      'get_logs',
      'Retrieve console messages filtered by severity level',
      {
        level: z.enum(['error', 'warning', 'info', 'log'])
          .optional()
          .default('error')
          .describe('Minimum severity level to retrieve'),
        limit: z.number()
          .optional()
          .default(-1)
          .describe('Maximum number of recent entries to return (-1 for all)')
      },
      async ({ level, limit }) => {
        try {
          const logs = await this.logger.getLogs(level, limit);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                level,
                count: logs.length,
                logs
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ error: error.message }, null, 2)
            }],
            isError: true
          };
        }
      }
    );

    // Register clear_logs tool
    this.server.tool(
      'clear_logs',
      'Clear the in-memory log buffer',
      {},
      async () => {
        const result = this.logger.clearLogs();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
    );

    // Register get_status tool
    this.server.tool(
      'get_status',
      'Get browser status and current page information',
      {},
      async () => {
        const status = await this.logger.getStatus();
        if (status.pageTitle instanceof Promise) {
          status.pageTitle = await status.pageTitle;
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(status, null, 2)
          }]
        };
      }
    );
  }

  async start() {
    try {
      console.error('Starting browser initialization...');
      
      // Initialize Puppeteer
      await this.logger.init(getBrowserOptions());
      console.error('Browser initialized successfully');
      
      // Connect to transport
      console.error('Connecting to transport...');
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      console.error(`${config.server.name} MCP server started`);
      console.error(`Headless mode: ${config.browser.headless}`);
      console.error(`Max log entries: ${config.logging.maxEntries}`);
    } catch (error) {
      console.error('Failed during server start:', error.message);
      throw error;
    }
  }

  async dispose() {
    await this.logger.dispose();
  }
}

// Handle process signals
let server;

process.on('SIGINT', async () => {
  if (server) await server.dispose();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (server) await server.dispose();
  process.exit(0);
});

// Start the server
async function main() {
  try {
    server = new BrowserDebugMCP();
    await server.start();
  } catch (error) {
    console.error('Failed to start server:', error);
    if (server) await server.dispose();
    process.exit(1);
  }
}

// Run main
main();
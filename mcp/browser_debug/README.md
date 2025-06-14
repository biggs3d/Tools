# Browser Debug MCP Server

An MCP server that uses Puppeteer to navigate web pages and capture console messages (logs, warnings, errors) for debugging purposes.

## Features

- **Persistent Browser Session**: Maintains a single browser instance across multiple navigations
- **Console Message Capture**: Captures all console logs, warnings, and errors
- **Network Error Tracking**: Monitors failed network requests
- **In-Memory Buffer**: Fast access to logs with configurable size limit
- **Severity Filtering**: Retrieve logs by severity level (error, warning, info, log)

## Installation

```bash
cd browser_debug
npm install
```

### WSL/Linux Setup

For WSL or Linux environments, you'll need Chrome dependencies:

```bash
# Install Chrome dependencies for headless operation
sudo apt-get update
sudo apt-get install -y \
    libnss3 \
    libatk1.0-0t64 \
    libatk-bridge2.0-0t64 \
    libcups2t64 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2t64 \
    libasound2-dev

# Then install Puppeteer's bundled Chrome
npx puppeteer browsers install chrome
```

**Note**: The `libasound2-dev` package is essential for Chrome audio support in WSL environments.

## Configuration

Environment variables (optional):

- `PUPPETEER_HEADLESS`: Set to "false" to run browser in headed mode (default: true)
- `PUPPETEER_TIMEOUT`: Navigation timeout in milliseconds (default: 30000)
- `PUPPETEER_ARGS`: Comma-separated browser launch args
- `MAX_LOG_ENTRIES`: Maximum log buffer size (default: 1000)
- `DEFAULT_LOG_LEVEL`: Default severity filter (default: error)

## Usage

### Add to Claude Code

```bash
# Global installation
claude mcp add browser-debug -s user -- node /path/to/browser_debug/index.js

# Or in project .mcp.json (Windows paths)
{
  "mcpServers": {
        "browser-debug": {
            "command": "node",
            "args": [
                "/mnt/d/Tools/mcp/browser_debug/index.js"
            ],
            "cwd": "/mnt/d/Tools/mcp/browser_debug"
        },
  }
}
```

### Available Tools

#### `navigate`
Navigate to a URL and start capturing console messages.

**Parameters:**
- `url` (string, required): The URL to navigate to

**Returns:**
- `success`: Whether navigation succeeded
- `url`: Final URL after redirects
- `title`: Page title
- `status`: HTTP response status

#### `get_logs`
Retrieve console messages filtered by severity level.

**Parameters:**
- `level` (string, optional): Minimum severity - "error", "warning", "info", or "log" (default: "error")
- `limit` (number, optional): Max entries to return, -1 for all (default: -1)

**Returns:**
- `level`: Requested severity level
- `count`: Number of logs returned
- `logs`: Array of log entries with timestamp, type, text, and optional stack trace

#### `clear_logs`
Clear the in-memory log buffer.

**Returns:**
- `cleared`: true
- `message`: Confirmation message

#### `get_status`
Get browser status and current page information.

**Returns:**
- `browserConnected`: Whether browser is connected
- `currentUrl`: Current page URL
- `pageTitle`: Current page title
- `logCount`: Number of logs in buffer
- `oldestLog`: Timestamp of oldest log
- `newestLog`: Timestamp of newest log

## Example Usage

```javascript
// Navigate to a page
await tools.navigate({ url: "https://example.com" });

// Get all errors
const errors = await tools.get_logs({ level: "error" });

// Get last 10 warnings and errors
const recent = await tools.get_logs({ level: "warning", limit: 10 });

// Check status
const status = await tools.get_status();

// Clear logs
await tools.clear_logs();
```

## Testing

The server includes comprehensive test suites:

```bash
# Run all tests
npm test

# Individual test suites
npm run test:smoke        # Basic functionality test
npm run test:integration  # Comprehensive browser scenarios
npm run test:mcp         # MCP protocol communication test

# Run everything including MCP protocol test
npm run test:all
```

### Test Files

- `test/smoke-test.js` - Quick verification of basic functionality
- `test/integration.test.js` - Comprehensive test of all console scenarios
- `test/test-page.html` - Interactive test page with various console triggers
- `test/mcp-test.js` - Tests MCP protocol communication directly

The integration test covers:
- Basic console methods (log, warn, error, info)
- Uncaught exceptions and stack traces
- Network errors (failed requests, missing resources)
- Promise rejections
- Special characters and Unicode
- Multiple console arguments
- Log filtering by severity
- Buffer limits and clearing
- Status reporting

## Architecture

The server is organized into modular components:

- `index.js`: Entry point wrapper for proper stdio handling
- `server.js`: MCP server setup and initialization
- `lib/puppeteer-logger.js`: Core browser automation and logging logic
- `lib/tools.js`: MCP tool definitions and handlers
- `lib/config.js`: Configuration management

## Troubleshooting

### Browser won't start
- Check if Chrome/Chromium is installed
- Try setting `PUPPETEER_HEADLESS=false` to see browser errors
- Add `--no-sandbox` to `PUPPETEER_ARGS` for container environments

### Connection errors
- Verify server starts: `node index.js`
- Check for port conflicts or permission issues
- Test server directly: `echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | node index.js`
- Restart Claude Code after configuration changes
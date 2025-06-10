# Puppeteer Console Logger MCP Server Specification

## Overview
Create an MCP (Model Context Protocol) Server that uses Puppeteer to navigate to web pages and capture console messages (logs, warnings, errors) in an in-memory buffer. The server should provide tools to navigate to URLs and retrieve filtered console output on-demand.

## Core Requirements

### 1. Persistent Browser Session
- The Puppeteer browser and page instance should remain open across multiple navigations
- Only close when explicitly disposed or the server shuts down
- Console listeners persist across `page.goto()` calls without needing to re-attach

### 2. In-Memory Log Buffer
- Maintain a JavaScript array to store all console messages
- Each entry should include:
  - `type`: Message severity (error, warning, info, log)
  - `text`: The actual message content
  - `timestamp`: ISO string of when the message was captured
  - `stack`: Stack trace (for page errors only)

### 3. MCP Tools to Implement

#### `navigate`
- **Input**: `url` (string)
- **Description**: Navigate to a URL and start capturing console messages
- **Behavior**: Uses `page.goto()` with `waitUntil: 'networkidle2'`

#### `get_logs`
- **Input**: `level` (string, optional, default: 'error')
- **Description**: Retrieve console messages filtered by severity level
- **Behavior**: Returns all messages at or above the specified severity level
- **Severity hierarchy**: error > warning > info > log

#### `clear_logs`
- **Description**: Clear the in-memory log buffer
- **Behavior**: Resets the buffer array to empty

## Implementation Details

### PuppeteerLogger Class Structure

> NOTE: draft, missing needed capabilities still

```javascript
class PuppeteerLogger {
  constructor() {
    this.browser = null;
    this.page = null;
    this.logBuffer = [];
  }

  async init(headless = true) {
    // Launch browser
    this.browser = await puppeteer.launch({ headless });
    this.page = await this.browser.newPage();
    
    // Attach persistent console listener
    this.page.on('console', msg => {
      this.logBuffer.push({
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    });
    
    // Attach persistent page error listener
    this.page.on('pageerror', err => {
      this.logBuffer.push({
        type: 'error',
        text: err.message,
        stack: err.stack,
        timestamp: new Date().toISOString()
      });
    });
  }

  async navigate(url) {
    await this.page.goto(url, { waitUntil: 'networkidle2' });
  }

  getLogs(level = 'error') {
    const severity = ['error', 'warning', 'info', 'log'];
    const minIndex = severity.indexOf(level);
    return this.logBuffer.filter(entry =>
      severity.indexOf(entry.type) <= minIndex
    );
  }

  clearLogs() {
    this.logBuffer = [];
  }

  async dispose() {
    if (this.page) await this.page.close();
    if (this.browser) await this.browser.close();
  }
}
```

### MCP Server Integration

1. **Initialization**: Create a single `PuppeteerLogger` instance when the MCP server starts
2. **Tool Handlers**: Map MCP tool calls to the corresponding methods:
   - `navigate` → `puppeteerLogger.navigate(url, level = info)`
   - `get_logs` → `puppeteerLogger.getLogs(level = warning, numberOfRecentEntries = -1)`
   - `clear_logs` → `puppeteerLogger.clearLogs()`
3. **Cleanup**: Call `puppeteerLogger.dispose()` when the server shuts down

### Error Handling Considerations

1. **Navigation Errors**: Wrap `page.goto()` in try-catch to handle invalid URLs or network issues
2. **Browser Crashes**: Implement reconnection logic if the browser process dies
3. **Memory Management**: Consider implementing a max buffer size with FIFO eviction

### Example MCP Tool Response Format

```json
{
  "tool": "get_logs",
  "result": [
    {
      "type": "error",
      "text": "Uncaught TypeError: Cannot read property 'foo' of undefined",
      "timestamp": "2024-01-15T10:30:45.123Z",
      "stack": "TypeError: Cannot read property 'foo' of undefined\n    at script.js:42:15"
    },
    {
      "type": "warning",
      "text": "Deprecation warning: Feature X will be removed in version 2.0",
      "timestamp": "2024-01-15T10:30:46.789Z"
    }
  ]
}
```

## Additional Features to Consider

- **Page Tracking**: Include page title & URL in navigation responses
- **Screenshot Capture**: Add a tool to capture screenshots when errors occur (future)
- **DOM Elements**: Add a tool to obtain a specific (or all) html elements (future)
- **Network Error Tracking**: Monitor failed network requests (future)

## Dependencies

- `puppeteer`: Core browser automation library
- Standard MCP server dependencies (based on your existing examples)

## Notes

- The page instance persists across navigations, so console listeners don't need to be re-attached
- This approach is entirely self-contained with no external dependencies beyond Puppeteer
- The in-memory buffer provides instant access to logs without file I/O overhead
- Consider implementing log rotation or size limits for long-running sessions
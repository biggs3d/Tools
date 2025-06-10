# Changelog

## [1.0.0] - 2025-06-10

### Added
- Initial release of Browser Debug MCP Server
- Puppeteer-based browser automation for console capture
- Four MCP tools:
  - `navigate` - Navigate to URLs and capture console output
  - `get_logs` - Retrieve filtered console messages by severity
  - `clear_logs` - Clear the in-memory log buffer  
  - `get_status` - Get browser health and current page info
- Comprehensive test suite:
  - Smoke tests for basic functionality
  - Integration tests covering 13 scenarios
  - MCP protocol communication tests
- Modular architecture with separate concerns
- Support for console.log, warn, error, info messages
- Capture of uncaught exceptions with stack traces
- Network error tracking
- Configurable log buffer with FIFO eviction
- Environment-based configuration

### Technical Details
- Uses MCP SDK's `McpServer` class with proper tool registration
- Implements stdio wrapper pattern for reliable communication
- Handles console message arguments and special characters
- Normalizes log levels (warn → warning, debug → log)
- Supports headless/headed browser modes
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with MCP (Model Context Protocol) server
implementations in this repository.

## Project Overview

This repository contains multiple MCP server implementations for various AI services and utilities. Each implementation
follows the MCP standard for tool integration with Claude and other AI assistants.

## Repository Structure

- `/gemini_bridge/` - MCP server for bridging Claude Code to Gemini's large context window
- Additional MCP servers will be added as subdirectories

## Development Guidelines

### MCP Server Requirements

- Each server should be in its own subdirectory
- Include a `package.json` with proper dependencies
- Follow the MCP SDK patterns for tool implementation
- Include clear setup documentation

### Code Style

- Use ES modules (`type: "module"` in package.json)
- Implement proper error handling and validation
- Use Zod for schema validation
- Keep tools focused and single-purpose

### Documentation

Each MCP server should include:

- Setup instructions in its directory
- Environment variable requirements
- Usage examples
- Troubleshooting guide

### Testing

- Include basic tests for each server
- Test MCP protocol compliance
- Verify tool functionality

## Common Commands

### Development

```bash
# Install dependencies for a specific server
cd <server_directory>
npm install

# Run in development mode
npm run dev

# Test the server
npm test
```

### Adding to Claude Code

```bash
# Add as global MCP server (recommended for system-wide access)
claude mcp add gemini-bridge -s user -- node /mnt/d/Tools/mcp/gemini_bridge/index.js

# Or configure in project's .mcp.json
{
  "mcpServers": {
    "gemini-bridge": {
      "command": "node",
      "args": [
        "/mnt/d/Tools/mcp/gemini_bridge/index.js"
      ],
      "cwd": "/mnt/d/Tools/mcp/gemini_bridge"
    }
  }
}

# With API key in .mcp.json (optional if you have it in .env):
{
  "mcpServers": {
    "gemini-bridge": {
      "command": "node",
      "args": [
        "/mnt/d/Tools/mcp/gemini_bridge/index.js"
      ],
      "cwd": "/mnt/d/Tools/mcp/gemini_bridge",
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Contributing New MCP Servers

When adding a new MCP server:

1. Create a new subdirectory with descriptive name
2. Follow the existing structure (see gemini_bridge example)
3. Document all tools and their parameters
4. Include environment setup instructions
5. Add the server to this README's structure section

## Troubleshooting

### MCP Server Connection Issues

**"Connection closed" errors:**
- Often caused by undefined functions or runtime errors during server startup
- Check server logs with: `node /path/to/server/index.js` to verify it starts without errors
- Test MCP protocol manually: `echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | node server.js`
- If server works standalone but fails in Claude Code, restart Claude Code or refresh MCP connection:
  ```bash
  claude mcp remove server-name
  claude mcp add server-name -s user -- node /path/to/server.js
  ```

**Environment variable issues:**
- Ensure `.env` files are properly configured with required API keys
- Use `import 'dotenv/config';` at the top of server files for automatic loading
- Verify environment loading with smoke tests before troubleshooting MCP connections
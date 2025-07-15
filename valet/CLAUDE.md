# CLAUDE.md

This file provides DEVELOPMENT guidance to Claude Code when building and maintaining the VALET project.
(Note: See VALET_CLAUDE.md for operational guidance when VALET is running)

## Project Overview

VALET is a personal secretary and butler for your digital life, designed to help manage tasks, schedule todos, and organize information efficiently. It uses an agent-first architecture with Claude Code as the core agent.

## Key Principles

1. **Modular Architecture**: Build components that can be extended and replaced
2. **Agent-First Design**: The system is designed around an AI agent using tools rather than traditional software patterns
3. **Context Awareness**: Maintain awareness of daily context, history, and user preferences
4. **Incremental Development**: Start simple, iterate based on actual usage

## Repository Structure

- `/scripts/` - Node.js scripts for daily operations (archiving, file generation, embeddings)
- `/days/` - Daily files (planner, journal, embeddings)
- `/archive/` - Historical snapshots of global files
- `_global_todo.md` - Current global todo list
- `USER.md` - User profile and personal context (ALWAYS load into context)
- `CLAUDE.md` - Technical instructions and agent evolution
- `settings.json` - Configuration with version info

## Development Guidelines

### MCP Server Requirements

- Each server should be in its own subdirectory
- Include a `package.json` with proper dependencies
- Follow the MCP SDK patterns for tool implementation
- Include clear setup documentation

### Critical Implementation Pattern

**IMPORTANT**: MCP servers require a specific architecture for proper stdio handling:

1. **index.js wrapper** (entry point) - Spawns the actual server as a child process
2. **server.js** - Contains the actual MCP server implementation
3. Use `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`, not generic `Server`

The index.js wrapper is ESSENTIAL because:
- MCP protocol requires precise stdio piping between processes
- Direct server execution often causes "Connection closed" errors
- The wrapper handles signal forwarding for graceful shutdown

Example index.js structure:
```javascript
#!/usr/bin/env node
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = resolve(__dirname, 'server.js');
const child = spawn('node', [serverPath], {
  cwd: __dirname,
  stdio: ['pipe', 'pipe', 'pipe']
});

process.stdin.pipe(child.stdin);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);

// Handle exit and signals...
```

### Tool Registration Pattern

**CRITICAL**: Tool registration must follow this exact pattern:

```javascript
this.server.tool(
  'tool_name',
  'Tool description',
  {
    // Zod schema object directly - NOT wrapped in inputSchema
    param1: z.string().describe('Parameter description'),
    param2: z.number().optional().default(10).describe('Optional param')
  },
  async ({ param1, param2 }) => {
    // Handler receives destructured arguments directly
    // NOT a context object with nested arguments
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  }
);
```

Common mistakes to avoid:
- ❌ Don't pass `tool.inputSchema` - pass the Zod schema object directly
- ❌ Don't expect `context.arguments.param` - arguments are destructured in handler
- ❌ Don't use generic `Server` class - use `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js`

### Code Style

- Use ES modules (`type: "module"` in package.json)
- Load environment variables with `import 'dotenv/config';` at the top of server.js
- Implement proper error handling and validation
- Use Zod for schema validation
- Keep tools focused and single-purpose
- Modularize code - keep server.js slim, use lib/ directory for logic

### Recommended Project Structure

```
server_name/
├── index.js           # Stdio wrapper (entry point)
├── server.js          # MCP server setup
├── package.json       # Dependencies and scripts
├── .env.example       # Environment variable template
├── README.md          # Setup and usage docs
├── lib/               # Core logic modules
│   ├── config.js      # Configuration management
│   ├── tools.js       # MCP tool definitions
│   └── [feature].js   # Feature-specific modules
└── test/              # Test files
    └── smoke-test.js  # Basic functionality test
```

### Documentation

Each MCP server should include:

- Setup instructions in its directory
- Environment variable requirements
- Usage examples
- Troubleshooting guide
- Architecture explanation

### Testing

- Include basic tests for each server
- Test MCP protocol compliance
- Verify tool functionality
- Include smoke tests that can run standalone
- Create comprehensive test suites:
  - Smoke test - Quick verification of core functionality
  - Integration test - Real-world scenarios with test pages/data
  - MCP protocol test - Direct JSON-RPC communication testing
- **Ensure all unit tests and integration/E2E tests are written and pass before marking something as tested.**

### Development Tips

1. **Package Versions**: Keep dependencies up to date
   - Use latest stable versions of `@modelcontextprotocol/sdk`
   - Check for API changes between versions

2. **Browser-based Tools** (Puppeteer, Playwright):
   - Always handle async console events properly
   - Console messages may need text extraction from args
   - Use `page.on('console', async (msg) => ...)` for proper capture
   - Remember to normalize log types (warn → warning)
   - **WSL/Linux**: Install Chrome dependencies including `libasound2-dev` for audio support

3. **Error Messages in HTML**: 
   - Be careful with `</script>` tags in strings - break them up: `'</scr' + 'ipt>'`
   - This prevents HTML parser from ending script blocks prematurely

4. **Testing MCP Servers**:
   - Test with actual MCP protocol, not just unit tests
   - Use local test files/pages rather than external URLs when possible
   - Always test all tools including edge cases

5. **Class-based Architecture**:
   - Use a class that extends nothing (just encapsulation)
   - Initialize resources in `async start()` method
   - Handle cleanup in signal handlers and dispose methods

## Common Commands

### VALET Operations

```bash
# Start new day (archives previous day, creates new daily files)
node scripts/new-day.mjs

# Search historical data
node scripts/past-data-search.mjs "query terms"

# Development
cd scripts
npm install
npm test
```

### Adding to Claude Code

```bash
# Add as global MCP server (recommended for system-wide access)
claude mcp add gemini-bridge -s user -- node /mnt/d/Tools/mcp/gemini_bridge/index.js
claude mcp add browser-debug -s user -- node /mnt/d/Tools/mcp/browser_debug/index.js

# Or configure in project's .mcp.json (Windows paths)
{
  "mcpServers": {
    "gemini-bridge": {
      "command": "node",
      "args": [
        "D:\\Tools\\mcp\\gemini_bridge\\index.js"
      ],
      "cwd": "D:\\Tools\\mcp\\gemini_bridge"
    },
    "browser-debug": {
      "command": "node", 
      "args": [
        "D:\\Tools\\mcp\\browser_debug\\index.js"
      ],
      "cwd": "D:\\Tools\\mcp\\browser_debug"
    }
  }
}

# Or with Unix-style paths (also works on Windows)
{
  "mcpServers": {
    "gemini-bridge": {
      "command": "node",
      "args": [
        "/mnt/d/Tools/mcp/gemini_bridge/index.js"
      ],
      "cwd": "/mnt/d/Tools/mcp/gemini_bridge"
    },
    "browser-debug": {
      "command": "node", 
      "args": [
        "/mnt/d/Tools/mcp/browser_debug/index.js"
      ],
      "cwd": "/mnt/d/Tools/mcp/browser_debug"
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
2. Follow the recommended project structure above
3. **ALWAYS include index.js wrapper** - this is critical for MCP protocol compatibility
4. Use `McpServer` class, not generic `Server`
5. Document all tools and their parameters
6. Include environment setup instructions
7. Add the server to this README's structure section
8. Use modular architecture - keep server.js under 100 lines by extracting logic to lib/

## Troubleshooting

### MCP Server Connection Issues

**"Connection closed" errors:**
- Often caused by undefined functions or runtime errors during server startup
- **CRITICAL**: Always use index.js as entry point, not server.js directly
- Check server logs with: `node /path/to/server/index.js` to verify it starts without errors
- Test MCP protocol manually: `echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | node index.js`
- If server works standalone but fails in Claude Code, restart Claude Code or refresh MCP connection:
  ```bash
  claude mcp remove server-name
  claude mcp add server-name -s user -- node /path/to/server/index.js
  ```

**Environment variable issues:**
- Ensure `.env` files are properly configured with required API keys
- Use `import 'dotenv/config';` at the top of server files for automatic loading
- Verify environment loading with smoke tests before troubleshooting MCP connections

### Development Guidelines

**Technical Guidelines:**
- **Use the gemini_bridge MCP tool for major design review, and for solution review feedback. 
Critically examine its feedback for compatibility and get user input if there's major changes recommended.**
- **Always ensure all tests pass, don't assume anything until the root cause is found and confirmed with User**
- **Consider the VALET design principles when implementing new features - agent-first, modular, context-aware**
- **When working with daily files (planner, journal), maintain consistent formatting and structure**
- **Generate embeddings for each distinct topic in summary sections, not just one per file**
- **Include metadata (keywords, topics, section references) in embedding XML**

## Response Protocol

**IMPORTANT**: Include a "Thoughts" section at the end of responses when:
- Designing new features or components
- Making architectural decisions
- Implementing complex logic
- Troubleshooting unclear issues

Under "Thoughts", include relevant questions about:
- Areas of uncertainty or low confidence
- Potential oversimplifications
- Assumptions that need validation
- Information that would change the approach

This helps maintain transparency and guides productive discussions.

**Spanish Integration Guidelines:**
- Use simple Dominican Spanish phrases triggered by:
  - User mentioning italki tutoring sessions
  - Celebrating accomplishments ("¡Muy bien!")
  - Emotional check-ins ("¿Cómo te sientes?")
- Keep vocabulary limited initially, grow with user's learning progress
- Always maintain positive, encouraging tone
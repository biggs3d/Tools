# VALET MCP Server

> A Model Context Protocol (MCP) server that provides personal digital assistant capabilities for managing daily tasks, planning, and journaling.

When you include this MCP server in any repo, Claude Code will proactively use     
these tools based on conversational context, making it feel more like a
personal assistant that naturally tracks your work and maintains continuity        
across sessions.


## Features

- **Daily Operations**: Manage daily planner and journal files
- **Todo Management**: Add, update, complete, and organize tasks
- **Context Retrieval**: Get current daily context without full file reads
- **Cross-Platform**: Works on Windows, macOS, and Linux
- **Security**: Sandboxed operations with input validation

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **VALET data directory setup:**
   
   The server includes a local `valet-data/` directory with sample files:
   - `settings.json` - Configuration file
   - `_global_todo.md` - Global todo list
   - `USER.md` - User profile
   - `days/` - Daily planner and journal files (created automatically)
   - `archive/` - Archived daily files (created automatically)
   
   **Default behavior**: Uses the included `valet-data/` directory
   
   **Custom location**: Set environment variable to use external directory
   ```bash
   export VALET_PATH="/path/to/your/valet-data"
   ```

3. **Test the server:**
   ```bash
   npm test
   ```

## Usage with Claude Code

### Global Installation (Recommended)

```bash
claude mcp add valet -s user -- node /path/to/mcp/valet/index.js
```

### Project-Specific Installation

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "valet": {
      "command": "node",
      "args": ["/path/to/mcp/valet/index.js"],
      "cwd": "/path/to/mcp/valet"
    }
  }
}
```

### Configuration with Custom Data Directory

```json
{
  "mcpServers": {
    "valet": {
      "command": "node",
      "args": ["/path/to/mcp/valet/index.js"],
      "cwd": "/path/to/mcp/valet",
      "env": {
        "VALET_PATH": "/path/to/your/external/valet-data"
      }
    }
  }
}
```

## Available Tools

### Daily Operations

#### `valet_get_daily_context`
Retrieve current daily context without loading entire files.

**Parameters:**
- `date` (optional): Date to retrieve (YYYY-MM-DD)
- `sections` (optional): Specific sections to include
- `includeGlobalTodo` (optional): Include current todo list
- `includePreviousDay` (optional): Include yesterday's summary

**Example:**
```javascript
const context = await mcp__valet__valet_get_daily_context({
  includeGlobalTodo: true,
  includePreviousDay: true
});
```

#### `valet_update_daily`
Update specific sections of daily files without full overwrites.

**Parameters:**
- `date` (optional): Date to update
- `fileType`: 'planner' or 'journal'
- `updates`: Array of update operations
- `keywords` (optional): Keywords for metadata

**Example:**
```javascript
await mcp__valet__valet_update_daily({
  fileType: 'planner',
  updates: [{
    section: 'ongoing_summary',
    operation: 'append',
    content: 'Completed API integration'
  }]
});
```

#### `valet_new_day`
Start a new day, creating files and processing previous day's data.

**Parameters:**
- `skipEmbeddings` (optional): Skip embedding generation for speed
- `date` (optional): Override date

**Example:**
```javascript
await mcp__valet__valet_new_day({
  skipEmbeddings: false
});
```

### Todo Management

#### `valet_todo_operations`
Manage global todo list with granular operations.

**Parameters:**
- `action`: 'add', 'complete', 'update', 'remove', or 'move'
- `task` (optional): Task object
- `filter` (optional): Filter for bulk operations

**Example:**
```javascript
await mcp__valet__valet_todo_operations({
  action: 'add',
  task: {
    content: 'Review architecture proposals',
    priority: 'high',
    category: 'Work'
  }
});
```

#### `valet_todo_view`
Get filtered view of todos without full file load.

**Parameters:**
- `filter` (optional): Filter options
- `format` (optional): Output format ('structured', 'markdown', 'summary')

**Example:**
```javascript
const todos = await mcp__valet__valet_todo_view({
  filter: { priorities: ['high', 'medium'] },
  format: 'structured'
});
```

## Directory Structure

The server includes a local `valet-data/` directory:

```
/mcp/valet/
├── valet-data/            # Local VALET data (included)
│   ├── settings.json      # Configuration
│   ├── _global_todo.md    # Global todo list
│   ├── USER.md           # User profile
│   ├── days/             # Daily files (created automatically)
│   │   ├── 2025-07-15-planner.md
│   │   ├── 2025-07-15-journal.md
│   │   └── ...
│   └── archive/          # Archived daily files (created automatically)
│       ├── 2025-07-14.json
│       └── ...
├── lib/                  # Server implementation
├── test/                 # Test files
├── index.js              # MCP server entry point
└── server.js             # Main server logic
```

## Customizing Your Setup

The included `valet-data/` directory contains sample files ready to use:

1. **Edit `valet-data/settings.json`** - Update your name, timezone, and preferences
2. **Edit `valet-data/USER.md`** - Add your personal context and goals
3. **Start using the tools** - Daily files will be created automatically

## Configuration

The server uses `settings.json` in the VALET directory:

```json
{
  "version": "1.0.0",
  "user": {
    "name": "Your Name",
    "timezone": "America/New_York"
  },
  "mcp": {
    "cache_ttl": 300,
    "max_response_size": 50000,
    "enable_compression": true,
    "audit_log": true,
    "rate_limits": {
      "requests_per_minute": 60,
      "embeddings_per_hour": 100
    }
  },
  "embeddings": {
    "enabled": true,
    "similarity_threshold": 0.7
  }
}
```

## Development

### Running Tests

```bash
npm test
```

### Manual Protocol Testing

```bash
# Start server
node index.js

# Send initialize message
echo '{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2024-11-05", "capabilities": {}, "clientInfo": {"name": "test", "version": "1.0.0"}}}' | node index.js

# List available tools
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}' | node index.js
```

### Architecture

```
/mcp/valet/
├── index.js              # Stdio wrapper for MCP protocol
├── server.js             # Main MCP server setup
├── package.json          # Dependencies and scripts
├── README.md             # This file
├── .env.example          # Environment configuration template
├── valet-data/           # Local VALET data (ready to use)
│   ├── settings.json     # Configuration
│   ├── _global_todo.md   # Global todo list
│   ├── USER.md          # User profile
│   ├── days/            # Daily files (auto-created)
│   └── archive/         # Archived files (auto-created)
├── lib/
│   ├── core/
│   │   ├── config-loader.js    # Configuration management
│   │   ├── file-handler.js     # File system operations
│   │   ├── path-resolver.js    # Cross-platform path handling
│   │   └── valet-server.js     # Main server logic
│   ├── tools/
│   │   ├── daily-ops.js        # Daily file operations
│   │   └── todo-manager.js     # Todo management
├── test/
│   └── smoke-test.js          # Basic functionality tests
└── Design Documentation:
    ├── MCP_DESIGN.md          # Complete architecture specification
    └── CLAUDE_DEV.md          # Development guidance
```

## Troubleshooting

### Common Issues

1. **"Connection closed" errors**
   - Ensure you're using `index.js` as the entry point
   - Check that dependencies are installed: `npm install`
   - Verify the server starts without errors: `node index.js`

2. **VALET directory not found**
   - Set `VALET_PATH` environment variable
   - Ensure the directory exists and contains `settings.json`

3. **Permission errors**
   - Check file permissions in the VALET directory
   - Ensure Node.js can read/write to the directory

### Debug Mode

Set environment variable for debug output:
```bash
export DEBUG=valet:*
```

### Log Files

The server maintains operation logs in:
- Console output for immediate feedback
- File operations are logged to daily files

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## License

MIT License - see LICENSE file for details
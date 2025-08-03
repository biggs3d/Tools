# LLM Bridges - Unified MCP Server

A unified MCP server that provides a single interface to multiple LLM providers (Gemini, OpenAI, Grok), enabling parallel queries, provider comparison, and simplified model management.

## Features

- **Unified Interface**: Single `send_to_llm` tool replaces provider-specific tools
- **Parallel Execution**: Query multiple providers simultaneously for comparison
- **Smart Provider Selection**: Automatically detect provider from model name
- **Accurate Token Counting**: Uses tiktoken for precise token estimation
- **Flexible Configuration**: Environment-based setup with sensible defaults
- **Error Handling**: Intelligent error messages with actionable suggestions

## Installation

1. Clone or download this directory
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and add your API keys:
   ```bash
   cp .env.example .env
   ```
4. Edit `.env` with your API keys (at least one required)

## Configuration

### Required API Keys (at least one)
- `GEMINI_API_KEY`: Google Gemini API key
- `OPENAI_API_KEY`: OpenAI API key  
- `XAI_API_KEY`: Grok (x.ai) API key

### Optional Configuration
See `.env.example` for all configuration options including:
- Default models per provider
- Token limits
- Timeout settings
- File discovery rules
- Model allowlists

## Usage with Claude Code

### Add to Claude Code

**Option 1: Global installation (recommended)**
```bash
claude mcp add llm-bridges -s user -- node /path/to/llm_bridges/index.js
```

**Option 2: Project-specific (.mcp.json)**
```json
{
  "mcpServers": {
    "llm-bridges": {
      "command": "node",
      "args": ["/path/to/llm_bridges/index.js"],
      "cwd": "/path/to/llm_bridges"
    }
  }
}
```

## Available Tools

### 1. `send_to_llm`
Send prompts and files to one or more LLM providers.

**Parameters:**
- `llm` (optional): Provider selection
  - Single provider: `"gemini"`, `"openai"`, `"grok"`
  - Multiple providers: **Note: Array syntax not supported in some MCP clients. Use `"all"` instead**
  - All available: `"all"` (default)
  - Model name: `"gpt-4o"` (auto-detects OpenAI)
- `prompt`: The question or task
- `files` (optional): Array of file paths to include
- `model` (optional): Override default model
- `project_context` (optional): Additional background
- `temperature`, `top_p`, `max_tokens` (optional): Generation parameters

**Examples:**
```javascript
// Query all available providers
await send_to_llm({
  prompt: "Review this code for security issues",
  files: ["src/auth.js"]
});

// Use specific provider
await send_to_llm({
  llm: "gemini",
  prompt: "Analyze this large codebase",
  files: ["src/"],
  model: "gemini-2.0-flash-exp"
});

// Compare all providers
await send_to_llm({
  llm: "all",
  prompt: "Find performance bottlenecks",
  files: ["app.js"]
});
```

### 2. `estimate_context_size`
Estimate token usage before sending to providers.

**Parameters:**
- `files` (optional): File paths to analyze
- `prompt` (optional): Prompt text
- `project_context` (optional): Additional context
- `show_details` (optional): Show breakdown by file

### 3. `get_system_info`
Display available providers and configuration.

## Provider-Specific Notes

### Gemini
- Largest context window (up to 2M tokens)
- Supports embeddings
- Auto-fetches available models
- Iterative refinement option

### OpenAI
- Supports all GPT models including o3
- Handles reasoning models (o1/o3) correctly
- Organization ID support
- Embeddings available

### Grok
- Uses x.ai API
- More conservative token limits
- Good for different perspectives

## Testing

Run the smoke test to verify installation:
```bash
npm test
```

## Migration from Individual Bridges

If you're currently using separate bridge servers:

1. Remove old MCP server configurations:
   ```bash
   claude mcp remove gemini-bridge
   claude mcp remove openai-bridge
   claude mcp remove grok-bridge
   ```

2. Add the unified bridge:
   ```bash
   claude mcp add llm-bridges -s user -- node /path/to/llm_bridges/index.js
   ```

3. Update your usage:
   - `send_to_gemini` → `send_to_llm` with `llm: "gemini"`
   - `send_to_openai` → `send_to_llm` with `llm: "openai"`
   - `send_to_grok` → `send_to_llm` with `llm: "grok"`

## Troubleshooting

### "No providers configured" error
- Ensure at least one API key is set in your `.env` file
- Check that the `.env` file is in the same directory as the server

### Token estimation issues
- The server uses tiktoken for accurate counting
- Falls back to character-based estimation if needed
- Different models may have slightly different tokenization

### Connection issues
- Verify API keys are valid
- Check network connectivity
- Review timeout settings in `.env`

## Known Limitations

### Array Parameters in MCP Clients

Due to current MCP protocol behavior, array parameters (e.g., `["gemini", "grok"]`) may be serialized as JSON strings rather than actual arrays. This is a known limitation with some MCP clients including Claude.

**Workaround**: Use the `"all"` option to query all available providers, or query providers individually.

```javascript
// Instead of: llm: ["gemini", "grok"]
// Use: llm: "all" or make separate calls
```

This limitation is being tracked in the MCP SDK repositories and may be resolved in future versions.

## Architecture

```
llm_bridges/
├── index.js              # MCP stdio wrapper
├── server.js             # Main MCP server
├── lib/
│   ├── providers/        # Provider implementations
│   │   ├── base.js       # Base provider class
│   │   ├── gemini.js     # Google Gemini
│   │   ├── openai.js     # OpenAI
│   │   └── grok.js       # x.ai Grok
│   ├── utils/            # Shared utilities
│   │   ├── file-handler.js    # File operations
│   │   ├── token-estimator.js # Tiktoken integration
│   │   └── error-handler.js   # Error formatting
│   ├── tools/            # MCP tool definitions
│   │   └── send-to-llm.js     # Main unified tool
│   └── config.js         # Configuration management
└── test/                 # Test files
```
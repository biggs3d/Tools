# OpenAI Bridge MCP Server

An MCP (Model Context Protocol) server that bridges Claude Code to OpenAI's GPT models, enabling analysis of large codebases using GPT-4's 128K token context window.

## Features

- **Large Context Analysis**: Send multiple files to GPT-4 with up to 128K tokens
- **Multiple Models**: Support for GPT-4o, GPT-4o-mini, GPT-4-turbo, o1-preview, and more
- **Smart File Discovery**: Automatically find relevant files with glob patterns
- **Token Estimation**: Preview token usage before sending requests
- **Code Pattern Analysis**: Specialized analysis for architecture, security, performance, etc.
- **Embeddings Generation**: Create embeddings using OpenAI's latest models
- **Iterative Refinement**: Optional multi-pass processing for better results

## Installation

1. Clone or download this directory
2. Install dependencies:
   ```bash
   cd openai_bridge
   npm install
   ```

3. Set up your OpenAI API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENAI_API_KEY
   ```

## Configuration

### Required Environment Variables

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `OPENAI_ORGANIZATION_ID`: Your OpenAI organization ID (optional, required for o3 models)

### Optional Environment Variables

See `.env.example` for all available configuration options including:
- Model selection
- Token limits
- File filtering
- Iterative refinement settings

## Usage with Claude Code

### Add to Claude Code globally:
```bash
claude mcp add openai-bridge -s user -- node /path/to/openai_bridge/index.js
```

### Or add to project's `.mcp.json`:
```json
{
  "mcpServers": {
    "openai-bridge": {
      "command": "node",
      "args": ["/path/to/openai_bridge/index.js"],
      "cwd": "/path/to/openai_bridge",
      "env": {
        "OPENAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### 1. send_to_openai
Send files and prompts to OpenAI for analysis.

**Parameters:**
- `prompt` (required): The question or task for OpenAI
- `files`: Array of file paths to include
- `project_context`: Additional background information
- `model`: OpenAI model to use (default: gpt-4o)
- `include_line_numbers`: Add line numbers to code (default: true)
- `enable_iterative`: Enable multi-pass refinement

**Example:**
```
Use tool send_to_openai with:
- prompt: "Review this code for security vulnerabilities"
- files: ["src/auth.js", "src/api.js"]
- model: "gpt-4o"
```

### 2. find_relevant_files
Discover files in a directory for analysis.

**Parameters:**
- `directory` (required): Directory path to scan
- `include_patterns`: Glob patterns to include (e.g., ["**/*.js"])
- `exclude_patterns`: Glob patterns to exclude
- `max_files`: Maximum files to return (default: 50)

### 3. estimate_context_size
Check token usage before sending files.

**Parameters:**
- `files`: Array of file paths to analyze
- `include_project_context`: Include space for context
- `show_estimation_details`: Show detailed breakdown

### 4. analyze_code_patterns
Specialized analysis for specific patterns.

**Parameters:**
- `pattern_type` (required): Type of analysis (architecture, security, performance, etc.)
- `files`: Files to analyze
- `specific_focus`: Additional focus area
- `model`: Model override

### 5. generate_embeddings
Create embeddings for text using OpenAI's models.

**Parameters:**
- `texts` (required): Array of texts to embed
- `model`: Embedding model (default: text-embedding-3-small)
- `dimensions`: Output dimensionality

### 6. get_system_info
Get server configuration and available models.

**Parameters:**
- `include_models`: Fetch live model list (default: true)

## Testing

Run the smoke test to verify setup:
```bash
npm run smoke-test
```

This will test:
- API key configuration
- Server startup
- OpenAI API connectivity
- Basic tool functionality

## Development

- `npm run dev` - Run with auto-reload
- `npm test` - Run all tests
- `npm run health-check` - Quick health check

## Supported Models

### Chat Models
- gpt-4o (latest, recommended)
- gpt-4o-mini (cost-effective)
- gpt-4-turbo
- gpt-4
- gpt-3.5-turbo
- o1-preview (reasoning model)
- o1-mini
- o3 (best reasoning model - requires verified organization*)
- o3-mini (requires verified organization*)

### Embedding Models
- text-embedding-3-small (default)
- text-embedding-3-large
- text-embedding-ada-002

**Note on o3 models**: The o3 and o3-mini models require organizational verification. To use these models:
1. Go to https://platform.openai.com/settings/organization/general
2. Click "Verify Organization"
3. Wait up to 15 minutes for access to propagate
4. Add your `OPENAI_ORGANIZATION_ID` to the `.env` file

## Architecture

The server follows MCP protocol standards:
- `index.js`: Entry point with stdio handling
- `server.js`: Main server implementation
- Modular design for easy extension

## Error Handling

- Automatic retry on transient failures
- Graceful degradation for large files
- Clear error messages with recovery suggestions

## Security

- API keys stored in environment variables
- No sensitive data logging
- Secure file handling with validation

## Troubleshooting

1. **"Connection closed" errors**: Check your API key is set correctly
2. **Token limit errors**: Use `estimate_context_size` first or reduce file count
3. **Model not found**: Check available models with `get_system_info`

## License

MIT License - See LICENSE file for details
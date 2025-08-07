# Grok Bridge MCP Server

A Model Context Protocol (MCP) server that bridges Claude Code to xAI's Grok models, providing access to Grok's powerful AI capabilities including the latest Grok 4 model.

## Features

- **Large Context Windows**: Send up to 900k tokens to Grok for comprehensive code analysis
- **Smart File Discovery**: Automatically find and filter relevant files in your project
- **Cross-Platform Path Support**: Works seamlessly on Windows, macOS, and Linux (including WSL)
- **Model Flexibility**: Support for all Grok models including `grok-2-1212`, `grok-2-vision-1212`, and other variants
- **Auto-Optimization**: Automatically reduces context size when needed while preserving important files
- **Smart Error Recovery**: Contextual error messages with actionable suggestions
- **Token Estimation**: Preview estimated token usage before sending requests
- **Pattern Analysis**: Specialized tools for architectural, security, and code quality analysis

## Installation

### Prerequisites

- Node.js 18 or later
- xAI API account and API key

### Setup

1. Clone or navigate to the grok_bridge directory:
```bash
cd /path/to/Tools/mcp/grok_bridge
```

2. Install dependencies:
```bash
npm install
```

3. Create your environment configuration:
```bash
cp .env.example .env
```

4. Add your xAI API key to the `.env` file:
```bash
# Required: Your xAI API key from https://x.ai/api
XAI_API_KEY=your_api_key_here

# Optional: Customize other settings
DEFAULT_MODEL=grok-2-1212
MAX_TOTAL_TOKENS=900000
```

### Getting Your xAI API Key

1. Visit [xAI API Console](https://x.ai/api)
2. Sign up or log in to your account
3. Navigate to the API Keys page
4. Generate a new API key
5. Copy the key and add it to your `.env` file

## Adding to Claude Code

### Global Installation (Recommended)

```bash
# Add as a global MCP server
claude mcp add grok-bridge -s user -- node /mnt/d/Tools/mcp/grok_bridge/index.js
```

### Project-Specific Configuration

Add to your project's `.mcp.json` file:

```json
{
  "mcpServers": {
    "grok-bridge": {
      "command": "node",
      "args": [
        "/mnt/d/Tools/mcp/grok_bridge/index.js"
      ],
      "cwd": "/mnt/d/Tools/mcp/grok_bridge",
      "env": {
        "XAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### Primary Tools

#### `send_to_grok`
Send files and context to Grok for analysis.

**Parameters:**
- `files` (required): Array of file paths to analyze
- `prompt` (required): The question or task for Grok
- `model` (optional): Grok model to use (default: `grok-2-1212`)
- `project_context` (optional): Additional project background
- `include_line_numbers` (optional): Include line numbers in file content (default: true)
- `enable_iterative` (optional): Enable iterative refinement (default: from config)

**Example:**
```javascript
{
  "files": ["src/main.js", "src/utils.js"],
  "prompt": "Analyze the code structure and suggest improvements",
  "model": "grok-2-1212"
}
```

#### `estimate_context_size`
Estimate token count before sending to Grok.

**Parameters:**
- `files` (required): Array of file paths to analyze
- `include_project_context` (optional): Include space for project context
- `show_estimation_details` (optional): Show calculation details

#### `find_relevant_files`
Discover relevant files in a directory.

**Parameters:**
- `directory` (required): Directory path to scan
- `exclude_patterns` (optional): Patterns to exclude (e.g., ['test', 'spec'])
- `max_files` (optional): Maximum files to return (default: 50)

#### `analyze_code_patterns`
Specialized analysis for specific code patterns.

**Parameters:**
- `pattern_type` (required): Type of analysis ('architecture', 'security', 'performance', 'testing', 'documentation', 'dependencies', 'code_quality')
- `files` (required): Files to analyze
- `specific_focus` (optional): Specific aspect to focus on
- `model` (optional): Override default model

#### `get_system_info`
Get comprehensive system information and diagnostics.

**Parameters:**
- `include_models` (optional): Fetch live model information (default: true)

## Available Models

- **grok-2-1212** (default): Latest Grok 2 model with improved accuracy and multilingual support
- **grok-2-vision-1212**: Grok 2 with vision capabilities for image analysis
- **grok-beta**: Beta version of Grok
- **grok-2**: Base Grok 2 model
- **grok-2-mini**: Smaller, faster Grok 2 variant
- **grok-vision-beta**: Beta version with vision support
- **grok-2**: Earlier generation model

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `XAI_API_KEY` | - | **Required**: Your xAI API key |
| `DEFAULT_MODEL` | `grok-2-1212` | Default model to use |
| `MAX_TOTAL_TOKENS` | `900000` | Maximum context size |
| `GROK_API_BASE_URL` | `https://api.x.ai/v1` | API base URL |
| `GROK_TEMPERATURE` | `0.1` | Generation temperature |
| `GROK_TOP_P` | `0.95` | Top-p sampling parameter |
| `GROK_MAX_OUTPUT_TOKENS` | `8192` | Maximum output tokens |
| `AUTO_FETCH_MODELS` | `true` | Automatically fetch available models |
| `ENABLE_AUTO_OPTIMIZATION` | `true` | Enable automatic context optimization |
| `ENABLE_SMART_RECOVERY` | `true` | Enable smart error recovery |

### Smart Features

- **Auto-Optimization**: Automatically reduces context size by prioritizing important files
- **Smart Recovery**: Provides contextual error messages with actionable suggestions
- **Model Validation**: Automatically validates model availability
- **Path Normalization**: Handles cross-platform path differences (WSL ↔ Windows)

## Usage Examples

### Basic Code Analysis

```bash
# Analyze a single file
send_to_grok(
  files=["src/app.js"],
  prompt="Review this code for potential bugs and improvements"
)

# Analyze multiple files with context
send_to_grok(
  files=["src/", "config/"],
  prompt="Analyze the application architecture",
  project_context="This is a Node.js web application using Express"
)
```

### Security Analysis

```bash
analyze_code_patterns(
  pattern_type="security",
  files=["src/auth.js", "src/api.js"],
  specific_focus="Authentication and authorization vulnerabilities"
)
```

### Performance Review

```bash
analyze_code_patterns(
  pattern_type="performance",
  files=["src/database.js", "src/cache.js"],
  model="grok-2"
)
```

## Pricing

Grok API uses token-based pricing:
- **Input tokens**: $6.00 per million tokens
- **Cached input tokens**: $0.75 per million tokens
- **Output tokens**: $30.00 per million tokens

Use `estimate_context_size` to preview costs before sending requests.

## Troubleshooting

### Common Issues

#### "XAI_API_KEY environment variable is required"
- Ensure you have set your API key in the `.env` file
- Verify the key is correct and active at https://x.ai/api

#### "Connection closed" errors
- Check that the server is properly configured with the index.js wrapper
- Verify Node.js version is 18 or later
- Test the server manually: `node /path/to/grok_bridge/index.js`

#### "Context too large" errors
- Use `estimate_context_size` to check token count
- Enable auto-optimization: `ENABLE_AUTO_OPTIMIZATION=true`
- Reduce the number of files or exclude test/documentation files

#### Model not available
- Use `get_system_info` to see available models
- Check if the model name is correct (e.g., `grok-2-1212`, `grok-2-vision-1212`)
- Verify your API key has access to the requested model
- Run `node test-models.js` to test which models are available with your API key

### Getting Help

1. Use `get_system_info` for detailed diagnostics
2. Check the server logs for error details
3. Verify your `.env` configuration
4. Test with a simple file first

## Testing

```bash
# Run all tests
npm test

# Run individual test suites
npm run test:unit
npm run test:integration

# Health check
npm run health-check

# Smoke test
npm run smoke-test
```

## Development

```bash
# Start in development mode with auto-reload
npm run dev

# Create test data for development
npm run create-test-data
```

## Architecture

The Grok Bridge follows the standard MCP architecture:

- **index.js**: Entry point wrapper for proper stdio handling
- **server.js**: Main MCP server implementation
- **Environment-driven configuration**: All settings configurable via environment variables
- **OpenAI-compatible API**: Uses standard REST endpoints compatible with OpenAI SDK

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting changes

## License

MIT
# Gemini Context Bridge MCP Server

An MCP (Model Context Protocol) server that bridges Claude Code to Google's Gemini models, enabling analysis of large
codebases using Gemini's 2M token context window.

## Features

- 🚀 **Large Context Analysis**: Leverage Gemini's 2M token context window for comprehensive codebase analysis
- 📁 **Smart File Discovery**: Automatically find and filter relevant files in your project using binary detection
- 📊 **Auto-Optimization**: Automatically optimize context when too large, prioritizing important files
- 🤖 **Dynamic Models**: Auto-fetch available models from Gemini API with intelligent fallbacks
- 🚨 **Smart Error Recovery**: Contextual error messages with specific suggestions for each error type
- 🔄 **Iterative Refinement**: Automatic response improvement for better quality results
- 🔍 **Pattern Analysis**: Built-in tools for architecture, security, performance, and code quality analysis
- 📝 **Cross-Platform**: Automatic WSL ↔ Windows path normalization
- 📄 **PDF Support**: Native PDF document analysis through Gemini's text extraction

## Installation

### Prerequisites

- Node.js >= 18.0.0
- Google AI Studio API key ([Get one here](https://aistudio.google.com/))
- Claude Code desktop app

### Quick Setup

1. Clone or download this directory:

```bash
git clone https://github.com/biggs3d/Tools.git
cd Tools/gemini_bridge
```

2. Install dependencies:

```bash
npm install
```

3. Set up your Gemini API key:

```bash
export GEMINI_API_KEY="your-api-key-here"
```

4. Test the server:

```bash
npm start
```

### Add to Claude Code

#### Option 1: Global Installation (Recommended)

```bash
# Add as a global MCP server available in all projects
claude mcp add gemini-bridge -s user -- node /path/to/gemini_bridge/index.js
```

#### Option 2: Project-specific Configuration

Add to your project's `.mcp.json`:

```json
{
    "mcpServers": {
        "gemini-bridge": {
            "command": "node",
            "args": [
                "/path/to/gemini_bridge/index.js"
            ],
            "env": {
                "GEMINI_API_KEY": "your-api-key-here"
            }
        }
    }
}
```

## Usage

### Available Tools

#### 1. `send_to_gemini`

Send files and context to Gemini for analysis.

**Parameters:**

- `files` (required): Array of file paths to analyze
- `prompt` (required): Your question or analysis task
- `model` (optional): Choose model - any gemini-* model (default from env)
- `project_context` (optional): Additional background information about your project
- `include_line_numbers` (optional): Include line numbers in code (default: true)
- `enable_iterative` (optional): Enable iterative refinement for better results (default: from env config)

**Examples:**

```
Can you analyze the architecture of my React app? Use gemini to review all components in src/components and src/hooks directories.
```

#### 2. `estimate_context_size`

Check how many tokens your files will use before sending.

**Parameters:**

- `files` (required): Array of file paths to estimate
- `include_project_context` (optional): Reserve space for project context

**Example:**

```
Please estimate the context size for all TypeScript files in my src directory using the gemini bridge.
```

#### 3. `find_relevant_files`

Discover readable text files in a directory (automatically detects non-binary files).

**Parameters:**

- `directory` (required): Directory to scan
- `exclude_patterns` (optional): Patterns to exclude (e.g., ["test", "spec"])
- `max_files` (optional): Maximum files to return (default: 50)

**Example:**

```
Find all JavaScript and TypeScript files in my project, excluding tests, using the gemini bridge.
```

#### 4. `analyze_code_patterns`

Specialized analysis for specific aspects of your code.

**Parameters:**

- `pattern_type` (required): Type of analysis - "architecture", "security", "performance", "testing", "documentation", "
  dependencies", or "code_quality"
- `files` (required): Files to analyze
- `specific_focus` (optional): Specific aspect to focus on

**Example:**

```
Use gemini to perform a security analysis on all my API endpoints in the src/api directory.
```

## Examples

### Full Project Architecture Review

```
Please find all TypeScript files in my src directory, then use gemini to analyze the overall architecture and suggest improvements.
```

### Security Audit

```
Can you use the gemini bridge to perform a security audit on my authentication and API files? Look for vulnerabilities and best practice violations.
```

### Performance Analysis

```
Use gemini to analyze all React components in src/components for performance issues. Focus on unnecessary re-renders and optimization opportunities.
```

### Code Quality Review

```
Please estimate the context size first, then if it fits, send all JavaScript files in the lib directory to gemini for a code quality review.
```

### Large Source Documents
```
I have two huge Standards pdfs in the ./docs folder, can you use gemini to analyze the main concepts and extract consolidated examples for us to use as more succinct context reference?
```

## Configuration

### Environment Variables

Create a `.env` file for local development by copying `.env.example`:

### File Detection

The server automatically detects readable text files by:

1. **Binary Detection**: Examines file content to determine if it's text or binary
2. **Smart Filtering**: Automatically excludes known binary formats (.exe, .jpg, .zip, etc.)
3. **PDF Support**: PDFs are specially handled and sent to Gemini for text extraction
4. **Universal Support**: Any text-based file format is supported, including:
   - All programming languages (even obscure ones)
   - Configuration files (any format)
   - Documentation (markdown, text, PDFs, etc.)
   - Data files (JSON, XML, YAML, CSV, etc.)
   - Scripts and markup files

The server intelligently detects file types without requiring an exhaustive extension list.

## Troubleshooting

### Common Issues

1. **"GEMINI_API_KEY not found"**
    - Ensure the environment variable is set
    - Check your MCP configuration includes the API key

2. **"Context too large" errors**
    - Use `estimate_context_size` first to check token count
    - Filter by specific file extensions or directories
    - Consider using `exclude_patterns` to skip test files

3. **"Model not available"**
    - Ensure you're using a supported model name
    - Check if you have access to the specific model in your API key

4. **Connection issues**
   ```bash
   # Debug MCP connection
   claude --mcp-debug
   
   # Check server status
   claude mcp list
   ```

### Token Limits

- Gemini 2.5 Pro Exp: 1M tokens (input + output)
- Gemini 2.0 Flash: 1M tokens (input + output)
- Gemini 1.5 Flash: 1M tokens
- Gemini 1.5 Pro: 2M tokens

The server reserves ~100k tokens for output, so maximum input is slightly less.

## Best Practices

1. **Start with Estimation**: Always use `estimate_context_size` for large directories
2. **Use File Discovery**: Let `find_relevant_files` help you identify what to analyze
3. **Be Specific**: Provide clear, specific prompts for better analysis results
4. **Filter Wisely**: Exclude test files, build outputs, and dependencies when not needed

## Iterative Refinement

The server supports automatic iterative refinement to improve response quality:

### How It Works
1. Gemini generates an initial response
2. The response is checked for quality indicators
3. If refinement is needed, Gemini is asked to improve the response
4. This continues up to MAX_ITERATIONS times

### Configuration
Set these in your environment:
- `ENABLE_ITERATIVE_REFINEMENT=true` - Enable by default
- `MAX_ITERATIONS=3` - Maximum refinement attempts
- `ITERATION_TRIGGERS=unclear|incomplete|error` - Words that trigger refinement

### Per-Request Control
Override the default setting for specific requests:
```
Use gemini with enable_iterative=true to analyze my code and ensure a comprehensive response.
```

## Smart Features

### 🤖 Dynamic Model Management
- **Auto-Fetch**: Automatically fetches available models from Gemini API
- **Intelligent Fallback**: Falls back to your models.md file or hardcoded list if API fails
- **Smart Validation**: Validates model names against live API data
- **Caching**: Caches model list for 1 hour to reduce API calls

### 📊 Auto-Optimization
When your context is too large, the server automatically:
1. **Prioritizes Files**: Important files (configs, docs) are included first
2. **Size-Based Sorting**: Smaller files are preferred when space is limited
3. **Smart Filtering**: Keeps the most relevant files within token limits
4. **Transparent Process**: Shows you what was optimized

### 🚨 Smart Error Recovery
Every error provides:
- **Error Classification**: Automatically categorizes the error type
- **Contextual Suggestions**: Specific solutions based on the error
- **Helpful Links**: Direct links to fix common issues
- **Diagnostic Tools**: Guidance to use built-in debugging tools

### 🔄 Automatic Improvements
- **Quality Detection**: Automatically detects low-quality responses
- **Iterative Refinement**: Asks Gemini to improve unclear or incomplete answers
- **Configurable Triggers**: Customize what words trigger refinement
- **Transparent Process**: Shows when refinement is happening

## Security Notes

- Never commit your API key to version control
- The `.gitignore` file excludes `.env` and common sensitive files
- File access is limited to paths you explicitly specify
- Consider API usage costs for large-scale analysis

## Development

### Running in Development Mode

```bash
npm run dev  # Watches for changes and auto-restarts
```

### Testing

```bash
npm test     # Run tests
npm run test:watch  # Run tests in watch mode
```

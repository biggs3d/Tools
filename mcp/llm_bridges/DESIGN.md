# LLM Bridges MCP Server - Design Document

## Overview

A unified MCP server that provides a single interface to multiple LLM providers (Gemini, Grok, OpenAI currently), 
enabling parallel queries, provider comparison, and simplified model management.

## Core Problem

Currently, three separate MCP bridges exist for different LLM providers, leading to:
- Duplicated code and maintenance overhead
- Inconsistent interfaces and error handling
- No easy way to compare responses across providers without pinging them one at a time
- Separate commands for each provider

## Solution: Unified LLM Bridge

### Key Design Decisions

1. **Single Tool Interface**: One `send_to_llm` tool replaces provider-specific tools
2. **Parallel Execution**: When multiple providers selected, query them concurrently
3. **Flexible Provider Selection**: Support single, multiple, or all providers
4. **Minimal Complexity**: MVP focuses on core functionality, no caching or complex routing

## Architecture

### Directory Structure
```
llm_bridges/
├── index.js               # MCP stdio wrapper
├── server.js              # Main MCP server
├── package.json
├── .env.example           # API keys and configuration
├── lib/
│   ├── providers/
│   │   ├── base.js        # Base provider class
│   │   ├── gemini.js      # Gemini implementation
│   │   ├── openai.js      # OpenAI implementation
│   │   └── grok.js        # Grok implementation
│   ├── utils/
│   │   ├── file-handler.js    # File collection and processing
│   │   ├── token-estimator.js # Token counting utilities
│   │   └── error-handler.js   # Unified error handling
│   └── config.js          # Configuration management
└── test/
    └── smoke-test.js      # Basic functionality test
```

## API Design

### Primary Tool: `send_to_llm`

```javascript
{
  llm: z.union([
    z.string(),                    // Single: "gemini", "all"
    z.array(z.string())           // Multiple: ["gemini", "grok"]
  ]).optional()
    .default("all")
    .describe("LLM provider(s) to use: embedded, gemini, grok, openai, all"),
  
  prompt: z.string()
    .describe("The question or task for the LLM"),
  
  files: z.array(z.string())
    .optional()
    .default([])
    .describe("File paths to include in context"),
  
  model: z.string()
    .optional()
    .describe("Specific model to use (provider-dependent)"),
  
  project_context: z.string()
    .optional()
    .describe("Additional project background")
}
```

### Response Format

**Single Provider:**
```json
{
  "content": [{
    "type": "text",
    "text": "✅ **Gemini Analysis**\n\n[response content]"
  }]
}
```

**Multiple Providers:**
```json
{
  "content": [{
    "type": "text", 
    "text": "## 🤖 LLM Analysis Results\n\n### Gemini\n[response]\n\n### OpenAI\n[response]\n\n### Grok\n[response]"
  }]
}
```

## Provider Configuration

### Environment Variables (.env.example)
```bash
# API Keys (at least one required)
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
XAI_API_KEY=your-grok-api-key

# Models Used
GEMINI_DEFAULT_MODEL=gemini-2.5-pro
OPENAI_DEFAULT_MODEL=o3
GROK_DEFAULT_MODEL=grok-4

# Per-Provider Configuration // TODO: change string formats below to json? max tokens is just so different per model, we need flexibility. e.g. gemini can handle so much more for cheaper, yet is only one perspective; grok-4 has a very different and useful perspective, but needs a much longer (10min) timeout!
MAX_FILE_SIZE=25MB
MAX_TOTAL_TOKENS=120000
RESPONSE_TIMEOUTS_MIN=10

# Shared Configuration
ENABLE_PARALLEL=true
```

### Provider Interface
```javascript
class BaseProvider {
  constructor(config) {
    this.name = 'base';
    this.config = config;
  }
  
  async initialize() {
    throw new Error('Must implement initialize()');
  }
  
  async query(prompt, context, options = {}) {
    throw new Error('Must implement query()');
  }
  
  async validateModel(modelName) {
    throw new Error('Must implement validateModel()');
  }
  
  get isAvailable() {
    return !!this.config.apiKey;
  }
}
```

## Implementation Flow

### 1. Server Initialization
```javascript
// Detect available providers based on API keys
const providers = initializeProviders();
// Only providers with API keys are initialized
```

### 2. Request Processing
```javascript
async function handleSendToLLM({ llm, prompt, files, model }) {
  // 1. Parse provider selection
  const selectedProviders = parseProviders(llm, availableProviders);
  
  // 2. Collect and format files
  const context = await prepareContext(files);
  
  // 3. Execute queries (parallel if multiple)
  const results = await Promise.allSettled(
    selectedProviders.map(provider => 
      provider.query(prompt, context, { model })
    )
  );
  
  // 4. Format and return results
  return formatResults(results, selectedProviders);
}
```

### 3. Error Handling
- Provider-specific errors are caught and standardized
- Failed providers in parallel execution don't block others
- Clear error messages with provider context

## MVP Features

### TODO
- ✅ Unified `send_to_llm` tool
- ✅ Parallel provider queries
- ✅ Basic file handling
- ✅ Environment-based configuration
- ✅ Error standardization
- ⏳ Tiktoken token counting for sent & received tokens
- ⏳ Cost estimation (future?)
- ⏳ Glob input options to save on filename context
- ⏳ Response timing metrics

## Usage Examples

### Query All Providers
```javascript
// Default behavior
await send_to_llm({
  prompt: "Review this code architecture",
  files: ["src/server.js", "src/lib/"]
});
```

### Query Specific Provider
```javascript
await send_to_llm({
  llm: "gemini",
  prompt: "Analyze this large codebase",
  files: ["src/"],
  model: "gemini-2.5-flash"
});
```

### Compare Multiple Providers
```javascript
await send_to_llm({
  llm: ["openai", "grok"],
  prompt: "Find security vulnerabilities",
  files: ["auth.js"]
});
```

### Use Embedded Provider (Claude)
```javascript
await send_to_llm({
  llm: "embedded",
  prompt: "Quick syntax check"
  // Uses the current Claude instance
});
```

## Design Principles

1. **Simplicity First**: MVP focuses on core value - unified interface and parallel execution
2. **Progressive Enhancement**: Start simple, add features based on actual usage
3. **Fail Gracefully**: One provider failing shouldn't break the entire request, and the error(s) should be returned to the LLM and therefore the user.
4. **Clear Feedback**: Users should understand which provider gave which response

## Success Metrics

- Reduces 3 MCP servers to 1
- Eliminates ~70% code duplication
- Enables multiple providers' answers for comparison in single command

## Next Steps

1. Create `.env.example` with all configuration options
2. Implement base provider class
3. Port existing provider logic (minimal changes)
4. Create unified `send_to_llm` tool
5. Add smoke tests
6. Document migration path from individual bridges
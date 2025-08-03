# LLM Bridges MCP Server - Architecture Overview

## Overview

A unified MCP server that provides a single interface to multiple LLM providers (Gemini, OpenAI, Grok), enabling parallel queries, provider comparison, and simplified model management.

## Key Design Principles

1. **Single Interface**: One `send_to_llm` tool handles all providers
2. **Parallel Execution**: Query multiple providers concurrently for comparison
3. **Provider Abstraction**: Base class with provider-specific implementations
4. **Smart Error Handling**: Unified error classification with actionable suggestions
5. **Cross-Platform Support**: Works on Windows, macOS, Linux, and WSL

## Architecture

```
llm_bridges/
├── index.js              # MCP stdio wrapper (required for protocol)
├── server.js             # Main MCP server setup
├── lib/
│   ├── config.js         # Centralized configuration with constants
│   ├── providers/        # Provider implementations
│   │   ├── base.js       # Abstract base class with common logic
│   │   ├── gemini.js     # Google Gemini provider
│   │   ├── openai.js     # OpenAI provider (GPT, o1, o3)
│   │   └── grok.js       # x.ai Grok provider
│   ├── tools/            # MCP tool definitions
│   │   └── send-to-llm.js # Main unified tool
│   └── utils/            # Shared utilities
│       ├── file-handler.js    # Cross-platform file operations
│       ├── token-estimator.js # tiktoken-based estimation
│       └── error-handler.js   # Smart error classification
└── test/                 # Test suite
```

## Key Components

### 1. Base Provider Class
- Template method pattern for consistent interface
- Handles initialization, timeouts, error formatting
- Subclasses implement `initializeClient()` and `executeQuery()`

### 2. Configuration System
- Environment-based with `.env` file
- Provider-specific settings (models, limits, timeouts)
- Security limits (max files, file size, rate limiting)
- Cross-platform file handling options

### 3. Error Handling
- `BridgeError` class with provider context
- Error classification (auth, quota, network, timeout, etc.)
- Smart suggestions based on error type
- Graceful degradation for multi-provider queries

### 4. File Operations
- Path traversal protection with double validation
- Cross-platform normalization (Windows/Unix/WSL)
- Binary file detection and exclusion
- Configurable limits to prevent DoS

## Security Features

1. **Path Containment**: Files must be within project root
2. **Resource Limits**: Max files per request, max file size
3. **Input Validation**: Zod schemas for all tool inputs
4. **API Key Protection**: Keys never logged or exposed
5. **Rate Limiting**: Configurable per-provider limits (planned)

## Performance Optimizations

1. **Lazy Provider Initialization**: Providers created on first use
2. **Provider Caching**: Reuse instances across requests
3. **Parallel Execution**: `Promise.allSettled` for multiple providers
4. **Token Estimation**: Pre-flight checks prevent oversized requests
5. **Configurable Timeouts**: Per-provider timeout settings

## Future Enhancements

See [TODO.md](./TODO.md) for detailed improvement roadmap including:
- Symlink vulnerability fix (critical)
- Rate limiting implementation
- Dynamic provider loading
- TypeScript migration
- Advanced caching strategies
- Production monitoring features
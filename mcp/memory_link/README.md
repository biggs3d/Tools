# Memory Link MCP Server

A persistent, semantic memory system for AI agents that enables learning and knowledge retention across sessions.

## Overview

Memory Link provides intelligent memory storage and retrieval capabilities through the Model Context Protocol (MCP). It combines traditional text search with advanced semantic search using Google's Gemini embeddings to help AI agents remember and recall information effectively.

## Features

### ✅ Phase 1: Core Memory Operations
- **Persistent Storage**: Store memories with content, importance scores (0-10), and tags
- **Flexible Search**: Find memories using text-based keyword search
- **Memory Management**: Create, update, delete, and list memories
- **Multiple Storage Backends**: JSON files, SQLite, MongoDB support via `@mcp/database-services`

### ✅ Phase 2: Semantic Intelligence  
- **Vector Embeddings**: Automatic embedding generation using Google Gemini API
- **Semantic Search**: Find conceptually similar memories, not just keyword matches
- **Hybrid Search**: Combines text and semantic search using Reciprocal Rank Fusion
- **Smart Backfilling**: Tool to generate embeddings for existing memories

### 🚧 Phase 3: Advanced Memory Management (In Development)
- **Memory Consolidation**: Merge similar memories into higher-level concepts
- **Memory Linking**: Create knowledge graphs connecting related memories
- **Background Processing**: Automatic maintenance and optimization

## Installation & Setup

### Prerequisites
- Node.js 18+
- Google Gemini API key (for semantic search features)

### Install Dependencies
```bash
cd /path/to/memory_link
npm install
```

### Configuration
Create a `.env` file with your configuration:
```env
# Required for semantic search (Phase 2 features)
GEMINI_API_KEY=your_gemini_api_key_here

# Database configuration (defaults to JSON file storage)  
DATABASE_TYPE=json-file
DATABASE_PATH=./data

# Optional: Embedding configuration
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_BATCH_SIZE=10
SIMILARITY_THRESHOLD=0.7
```

### Build the Server
```bash
npm run build
```

### Add to Claude Code
Add to your `.mcp.json` configuration:
```json
{
  "mcpServers": {
    "memory-link": {
      "command": "node",
      "args": ["/path/to/memory_link/index.js"],
      "cwd": "/path/to/memory_link",
      "env": {
        "GEMINI_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Available Tools

### Core Memory Operations

#### `remember`
Store new information as a memory.
```javascript
// Basic usage
remember({
  content: "Claude Code supports MCP servers for extending functionality",
  importance: 8,
  tags: ["claude-code", "mcp", "tools"]
})

// High importance lesson learned
remember({
  content: "Always use index.js wrapper for MCP servers to handle stdio properly",
  importance: 9,
  tags: ["mcp", "architecture", "lesson-learned"]
})
```

#### `recall`
Search for relevant memories using text, semantic, or hybrid search.
```javascript
// Text search (keyword matching)
recall({
  query: "MCP server setup",
  search_type: "text",
  limit: 5
})

// Semantic search (conceptual similarity)  
recall({
  query: "debugging connection issues",
  search_type: "semantic",
  limit: 10
})

// Hybrid search (best of both - default)
recall({
  query: "how to configure tools",
  search_type: "hybrid",
  tags: ["configuration"],
  limit: 5
})
```

#### `get_memory`
Retrieve a specific memory by ID.
```javascript
get_memory({ id: "uuid-of-memory" })
```

#### `list_memories`
List memories with filtering and sorting.
```javascript
// List recent memories
list_memories({
  sortBy: "createdAt",
  limit: 10
})

// List high-importance memories for a project
list_memories({
  tags: ["project:my-app"],
  sortBy: "importance",
  limit: 20
})
```

#### `update_memory`
Modify existing memories.
```javascript
update_memory({
  id: "memory-uuid",
  content: "Updated information about MCP setup process",
  importance: 9,
  tags: ["mcp", "setup", "updated"]
})
```

#### `forget`
Delete a memory permanently.
```javascript
forget({ id: "memory-uuid" })
```

### Advanced Tools

#### `generate_embeddings_for_existing`
Generate embeddings for memories that don't have them yet (useful when upgrading from Phase 1 to Phase 2).
```javascript
generate_embeddings_for_existing({ batch_size: 10 })
```

## Search Types Explained

### Text Search (`search_type: "text"`)
- Traditional keyword matching
- Fast and efficient
- Best for specific terms and exact phrases
- Searches memory content and tags

### Semantic Search (`search_type: "semantic"`)  
- AI-powered conceptual understanding
- Finds memories with similar meaning, not just matching words
- Requires Gemini API key and embeddings
- Best for exploring related concepts

### Hybrid Search (`search_type: "hybrid"`) - **Recommended**
- Combines text and semantic search results
- Uses Reciprocal Rank Fusion (RRF) algorithm
- Provides both precise matches and conceptual relations
- Balances speed and intelligence

## Usage Patterns

### For Learning & Development
```javascript
// Store lessons learned
remember({
  content: "When MCP server shows 'Connection closed', check for runtime errors in server startup",
  importance: 9,
  tags: ["debugging", "mcp", "lesson-learned"]
})

// Recall similar issues
recall({
  query: "connection problems",
  search_type: "semantic",
  tags: ["debugging"]
})
```

### For Project Knowledge
```javascript
// Store project-specific information
remember({
  content: "This React app uses Vite for development, React Router v6, and Tailwind for styling",
  importance: 7,
  tags: ["project:my-react-app", "architecture", "tech-stack"]
})

// Find project context
recall({
  query: "react app setup",
  tags: ["project:my-react-app"]
})
```

### For User Preferences
```javascript
// Remember user preferences
remember({
  content: "User prefers concise code comments and TypeScript strict mode enabled",
  importance: 6,
  tags: ["user-preference", "coding-style"]
})
```

## Performance Notes

- **Embedding Generation**: ~450ms per memory (acceptable for background processing)
- **Search Performance**: Hybrid search balances speed and accuracy
- **Storage**: Efficient JSON-based storage with optional SQLite/MongoDB backends
- **Memory Usage**: Embeddings cached in memory for fast similarity calculations

## Testing

Run the test suite:
```bash
# All tests
npm test

# Smoke test (basic functionality)
npm run test:smoke

# Integration tests  
npm run test:integration

# Semantic search tests (requires API key)
npm run test:semantic
```

## Architecture

### Components
- **MCP Server**: Tool registration and protocol handling
- **Memory Service**: Core business logic and search algorithms  
- **Database Service**: Abstracted storage layer (`@mcp/database-services`)
- **Embedding Service**: Google Gemini integration for vector generation

### Data Flow
1. **Storage**: Memories stored with content, metadata, and optional embeddings
2. **Search**: Query → embedding generation → similarity calculation → ranking
3. **Hybrid Fusion**: Text and semantic results combined using RRF algorithm

### File Structure
```
memory_link/
├── index.js              # MCP stdio wrapper (entry point)
├── src/
│   ├── server.ts         # MCP server and tool definitions  
│   ├── memory.service.ts # Core memory logic and search
│   └── config.ts         # Configuration management
├── test/                 # Comprehensive test suite
├── data/                 # Memory storage (created automatically)
└── docs/                 # Additional documentation
```

## Troubleshooting

### Common Issues

**"Connection closed" errors:**
- Ensure using `index.js` as entry point, not `server.js` directly
- Check server starts without errors: `node index.js`
- Verify environment variables are properly loaded

**Semantic search not working:**
- Confirm `GEMINI_API_KEY` is set in `.env` or MCP configuration
- Run `generate_embeddings_for_existing` for existing memories
- Check API key permissions and quota

**Poor search results:**
- Try different `search_type` values (text/semantic/hybrid)
- Adjust `SIMILARITY_THRESHOLD` in configuration
- Use more specific tags for filtering

### Debug Mode
Run server directly to see detailed logs:
```bash
cd /path/to/memory_link
node index.js
```

## Roadmap

### Phase 3: Advanced Memory Management
- **Memory Consolidation**: Automatically merge similar memories into higher-level concepts
- **Memory Linking**: Create knowledge graphs showing relationships between memories  
- **Background Processing**: Automatic maintenance, embedding generation, and optimization
- **Advanced Analytics**: Memory usage patterns and importance decay

### Future Enhancements
- **Visual Memory Browser**: Web interface for exploring memory relationships
- **Advanced Decay Models**: Sophisticated importance recalculation based on access patterns
- **Memory Compression**: Efficient storage of large memory collections
- **Multi-tenant Support**: Separate memory spaces for different projects/users

## Contributing

This is part of a larger MCP server ecosystem. See the main project documentation for contributing guidelines and development patterns.

## License

[Add your license information here]
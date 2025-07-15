# VALET MCP Server Design

> This document describes the completed MCP (Model Context Protocol) server implementation for VALET, enabling Claude Code to
> interact with VALET from any location without direct file system access.
> 
> **Status**: ✅ Phase 1 Complete - Core daily operations and todo management implemented and tested.

## Overview

The VALET MCP server acts as a smart gateway between Claude Code and the VALET file system, providing structured tools
for all VALET operations while maintaining the security-first, agent-friendly architecture.

## Architecture Principles

1. **Location Independence**: Agent can operate from anywhere without file access
2. **Efficient Operations**: Only transmit necessary data, never full files
3. **Platform Agnostic**: Handle WSL, iOS, and other platforms transparently
4. **Backward Compatible**: Maintain existing file structure and formats
5. **Extensible**: Easy to add new tools and capabilities

## Core MCP Tools

### 1. Daily Operations

#### valet_new_day

Start a new day, creating files and processing previous day's data.

```typescript
{
    skipEmbeddings ? : boolean  // Skip embedding generation for speed
    date ? : string            // Override date (YYYY-MM-DD), defaults to today
}
```

**Returns**: Status of file creation and embedding generation

#### valet_get_daily_context

Retrieve current daily context without loading entire files.

```typescript
{
    date ? : string           // Date to retrieve (YYYY-MM-DD)
    sections ? : string[]     // Specific sections to include
    includeGlobalTodo ? : boolean  // Include current todo list
    includePreviousDay ? : boolean // Include yesterday's summary
}
```

**Returns**: Structured context object with requested sections

#### valet_update_daily

Update specific sections of daily files without full overwrites.

```typescript
{
    date ? : string          // Date to update, defaults to today
    fileType: 'planner' | 'journal'
    updates: Array<{
        section: 'tasks' | 'data_stash' | 'ongoing_summary' | 'reflections' | 'personal_reminders'
        operation: 'append' | 'replace' | 'prepend'
        content: string
    }>
    keywords ? : string[]    // Keywords for embedding metadata
}
```

**Returns**: Confirmation with updated section details

### 2. Todo Management

#### valet_todo_operations

Manage global todo list with granular operations.

```typescript
{
    action: 'add' | 'complete' | 'update' | 'remove' | 'move'
    task ? : {
        id? : string         // For update/remove/complete
        content? : string    // Task description
        category? : string   // Task category
        priority? : 'high' | 'medium' | 'low'
        due? : string       // Due date (YYYY-MM-DD)
        notes? : string[]   // Sub-notes for task
    }
    filter ? : {           // For bulk operations
        category? : string
        priority? : string
        completed? : boolean
    }
}
```

**Returns**: Updated task(s) and current todo statistics

#### valet_todo_view

Get filtered view of todos without full file load.

```typescript
{
    filter ? : {
        categories? : string[]
        priorities? : string[]
        due? : 'today' | 'week' | 'overdue' | 'all'
        limit? : number
    }
    format ? : 'structured' | 'markdown' | 'summary'
}
```

**Returns**: Filtered todo items in requested format

### 3. Search and History

#### valet_search

Search historical data using embeddings and keywords.

```typescript
{
    query: string
    options ? : {
        maxResults? : number     // Default: 10
        threshold? : number      // Similarity threshold (0-1)
        dateRange? : {
            start? : string
            end? : string
        }
        sources? : ('planner' | 'journal')[]
        includeContext? : boolean // Include surrounding text
    }
}
```

**Returns**: Ranked results with relevance scores and context

#### valet_get_insights

Get AI-generated insights from historical patterns.

```typescript
{
    topic: string           // Topic to analyze
    timeframe ? : 'week' | 'month' | 'quarter' | 'all'
    insightType ? : 'patterns' | 'progress' | 'blockers' | 'solutions'
}
```

**Returns**: Structured insights based on historical data

### 4. Git Monitoring

#### valet_git_check

Check git repositories for activity.

```typescript
{
    repos ? : string[]       // Override configured repos
    since ? : string        // Check since date/timestamp
    summarize ? : boolean   // Use AI summarization for large outputs
}
```

**Returns**: Structured git activity summary

#### valet_git_configure

Update git monitoring configuration.

```typescript
{
    action: 'add' | 'remove' | 'update'
    repo: string
    settings ? : {
        checkFrequency? : string
        includeInBriefing? : boolean
        maxCommits? : number
    }
}
```

**Returns**: Updated configuration

### 5. Context and Learning

#### valet_remember

Store important information for future reference.

```typescript
{
    content: string
    type: 'solution' | 'lesson' | 'preference' | 'context'
    tags: string[]
    relatedTo ? : string    // Link to current task/topic
}
```

**Returns**: Confirmation with embedding status

#### valet_get_related

Find related information based on current context.

```typescript
{
    context: string       // Current topic/task
    limit ? : number
    types ? : string[]     // Filter by information types
}
```

**Returns**: Related memories, solutions, and patterns

### 6. Utility Tools

#### valet_export

Export data in various formats.

```typescript
{
    dataType: 'daily' | 'todos' | 'journal' | 'full'
    format: 'markdown' | 'json' | 'pdf'
    dateRange ? : {
        start: string
        end: string
    }
}
```

**Returns**: Exported data or download link

#### valet_status

Get VALET system status and statistics.

```typescript
{
    include ? : ('storage' | 'embeddings' | 'todos' | 'recent')[]
}
```

**Returns**: System health and usage statistics

## Implementation Architecture

### Directory Structure

```
/valet/
├── index.js              # Stdio wrapper for MCP
├── server.js             # Main MCP server
├── package.json          # Dependencies
├── lib/
│   ├── core/
│   │   ├── data-manager.js      # Data abstraction layer
│   │   ├── file-handler.js      # File system operations
│   │   ├── path-resolver.js     # Cross-platform paths
│   │   └── config-loader.js     # Settings management
│   ├── tools/
│   │   ├── daily-ops.js         # Daily file operations
│   │   ├── todo-manager.js      # Todo list management
│   │   ├── search-engine.js     # Search and embeddings
│   │   ├── git-monitor.js       # Git repository monitoring
│   │   └── context-builder.js   # Smart context loading
│   ├── utils/
│   │   ├── sanitizer.js         # Security sanitization
│   │   ├── differ.js            # Content diff management
│   │   └── cache.js             # Response caching
│   └── embeddings/
│       ├── generator.js          # Embedding generation
│       ├── faiss-index.js        # FAISS operations
│       └── metadata-store.js     # Embedding metadata
└── test/
    ├── smoke-test.js             # Basic functionality
    └── integration-test.js       # Full workflow tests
```

### Data Flow

1. **Request**: Claude Code calls MCP tool
2. **Validation**: Server validates parameters with Zod
3. **Resolution**: Path resolver handles platform differences
4. **Operation**: Tool performs focused operation
5. **Response**: Structured data returned to agent

### Security Layers

1. **Input Sanitization**: All inputs validated and sanitized
2. **Path Isolation**: Operations restricted to VALET directories
3. **Content Filtering**: Summaries sanitized before embedding
4. **Rate Limiting**: Prevent resource exhaustion
5. **Audit Logging**: Track all operations

### Performance Optimizations

1. **Lazy Loading**: Only load required file sections
2. **Caching**: Cache frequently accessed data
3. **Batch Operations**: Group multiple updates
4. **Incremental Sync**: Track changes between calls

## Configuration

The MCP server uses the existing `settings.json` with additional MCP-specific settings:

```json
{
    "mcp": {
        "cache_ttl": 300,
        "max_response_size": 50000,
        "enable_compression": true,
        "audit_log": true,
        "rate_limits": {
            "requests_per_minute": 60,
            "embeddings_per_hour": 100
        }
    }
}
```

## Implementation Status

### ✅ Phase 1: Core Tools (COMPLETED)

- ✅ Daily operations (`valet_get_daily_context`, `valet_update_daily`, `valet_new_day`)
- ✅ Todo management (`valet_todo_operations`, `valet_todo_view`)
- ✅ MCP server architecture with stdio wrapper
- ✅ Cross-platform path resolution
- ✅ Local data directory with sample files
- ✅ Comprehensive test suite

### 🔄 Phase 2: Advanced Features (PLANNED)

- Embedding-based search (`valet_search`)
- Git monitoring (`valet_git_check`, `valet_git_configure`)
- Context building (`valet_get_insights`)
- Memory and pattern recognition (`valet_remember`, `valet_get_related`)

### 🔮 Phase 3: Intelligence Layer (FUTURE)

- Pattern recognition
- Proactive suggestions
- Learning from usage
- Export capabilities (`valet_export`)
- System monitoring (`valet_status`)

## Usage Examples

### Morning Routine

```javascript
// Get context for the day
const context = await mcp__valet__valet_get_daily_context({
    includeGlobalTodo: true,
    includePreviousDay: true
});

// Check git activity
const gitStatus = await mcp__valet__valet_git_check({
    summarize: true
});

// Start new day if needed
if (!context.todayExists) {
    await mcp__valet__valet_new_day();
}
```

### Task Management

```javascript
// Add a new task
await mcp__valet__valet_todo_operations({
    action: 'add',
    task: {
        content: 'Review architecture proposals',
        category: 'Work',
        priority: 'high',
        due: '2025-07-20'
    }
});

// Update daily planner
await mcp__valet__valet_update_daily({
    fileType: 'planner',
    updates: [{
        section: 'tasks',
        operation: 'append',
        content: '- Started architecture review\n  - Focusing on security aspects'
    }]
});
```

### Search and Learning

```javascript
// Search for similar problems
const similar = await mcp__valet__valet_search({
    query: 'authentication implementation',
    options: {
        maxResults: 5,
        includeContext: true
    }
});

// Store solution for future
await mcp__valet__valet_remember({
    content: 'Used JWT with refresh tokens for stateless auth',
    type: 'solution',
    tags: ['auth', 'jwt', 'security'],
    relatedTo: 'authentication implementation'
});
```

## Benefits Over Direct File Access

1. **Structured Operations**: Every action is validated and purposeful
2. **Efficiency**: Only transmit necessary data
3. **Platform Independence**: Works identically everywhere
4. **State Management**: Server maintains context between calls
5. **Evolution Path**: Can change storage backend without affecting agent
6. **Security**: Additional validation and sanitization layer
7. **Performance**: Caching and optimization at server level

## Getting Started

The VALET MCP server is ready to use:

1. **Install dependencies**: `npm install` 
2. **Test the server**: `npm test`
3. **Configure Claude Code**: Add to your `.mcp.json` file
4. **Start using**: Daily files and todos will be created automatically
5. **Customize**: Edit `valet-data/settings.json` and `valet-data/USER.md`

For detailed setup instructions, see [README.md](README.md).

This MCP server design maintains VALET's simplicity while providing a robust interface for Claude Code to work from any
location efficiently.
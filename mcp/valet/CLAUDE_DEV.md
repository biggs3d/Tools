# CLAUDE_MCP.md

This file provides guidance to Claude Code when working with the VALET MCP server implementation.

## Overview

VALET has transitioned from direct file/script access to an MCP (Model Context Protocol) server architecture. This enables Claude Code to interact with VALET from any location without needing file system access.

## Key Changes from Original Design

### Before (Direct Access)
- Agent reads/writes files directly
- Calls Node.js scripts via shell commands
- Must have file system access
- Platform-specific path handling

### After (MCP Server)
- Agent uses structured MCP tools
- No direct file system access needed
- Works from any location
- Platform differences handled by server

## Available MCP Tools

### Daily Operations

**valet_get_daily_context**
- Retrieve current day's context efficiently
- Parameters: `date?`, `sections?`, `includeGlobalTodo?`, `includePreviousDay?`
- Use for: Morning greetings, checking current state

**valet_update_daily**
- Update specific sections without full file rewrites
- Parameters: `date?`, `fileType`, `updates[]`, `keywords?`
- Use for: Adding notes, updating summaries

**valet_new_day**
- Start a new day with file creation and embedding generation
- Parameters: `skipEmbeddings?`, `date?`
- Use for: End of day routine

### Todo Management

**valet_todo_operations**
- Manage tasks with granular operations
- Parameters: `action`, `task?`, `filter?`
- Actions: `add`, `complete`, `update`, `remove`, `move`
- Use for: All todo list modifications

**valet_todo_view**
- Get filtered view of todos
- Parameters: `filter?`, `format?`
- Use for: Reviewing tasks, daily briefings

### Search and Insights

**valet_search**
- Search historical data using embeddings
- Parameters: `query`, `options?`
- Use for: Finding past solutions, similar contexts

**valet_get_insights**
- AI-generated insights from patterns
- Parameters: `topic`, `timeframe?`, `insightType?`
- Use for: Progress tracking, pattern recognition

### Git Monitoring

**valet_git_check**
- Check repository activity
- Parameters: `repos?`, `since?`, `summarize?`
- Use for: Morning briefings, project updates

## Workflow Examples

### Morning Routine
```javascript
// Get daily context
const context = await mcp__valet__valet_get_daily_context({
  includeGlobalTodo: true,
  includePreviousDay: true
});

// Check git activity if configured
if (context.settings?.git_monitoring?.include_in_briefing) {
  const gitStatus = await mcp__valet__valet_git_check({
    summarize: true
  });
}

// Start new day if needed
if (!context.todayExists) {
  await mcp__valet__valet_new_day();
}
```

### Task Management
```javascript
// Add task
await mcp__valet__valet_todo_operations({
  action: 'add',
  task: {
    content: 'Review architecture',
    priority: 'high'
  }
});

// Update planner
await mcp__valet__valet_update_daily({
  fileType: 'planner',
  updates: [{
    section: 'ongoing_summary',
    operation: 'append',
    content: '\n- Completed architecture review'
  }]
});
```

## Best Practices

1. **Efficient Data Transfer**
   - Request only needed sections
   - Use filters to reduce response size
   - Batch related operations when possible

2. **Error Handling**
   - Check response status before proceeding
   - Have fallback strategies for failures
   - Log issues for user awareness

3. **State Management**
   - Don't cache file contents locally
   - Always use tools for current state
   - Trust server's response as authoritative

4. **Tool Selection**
   - Use most specific tool for the task
   - Prefer structured operations over text manipulation
   - Consider dry-run for testing complex operations

## Migration Notes

When transitioning existing VALET workflows:
- Replace file reads with `valet_get_daily_context`
- Replace file writes with `valet_update_daily`
- Replace script calls with appropriate MCP tools
- Remove path handling logic (server handles this)

## Testing

Before deploying:
1. Test each tool individually
2. Run through complete daily workflow
3. Verify cross-platform functionality
4. Check error scenarios

## Future Enhancements

Planned improvements:
- Batch operation support
- Offline queueing
- Advanced search operators
- Plugin system for custom tools
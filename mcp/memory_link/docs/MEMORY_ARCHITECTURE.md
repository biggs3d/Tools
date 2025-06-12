# Memory System Architecture & Usage Patterns

## Overview

This document explores design patterns for the memory_link MCP server, focusing on when/why memories should be saved, categorization strategies, and integration with CLAUDE.md.

## 1. Built-in Tool Guidance via MCP

### Current Capability
MCP tools support description strings that appear in Claude's tool list. These are currently simple one-liners:
- `'Stores a piece of information as a memory.'`
- `'Retrieves memories based on a query.'`

### Enhanced Tool Descriptions
We can expand these descriptions to include usage guidance:

```typescript
server.tool(
    'recall',
    `Retrieves memories based on a query. 
    IMPORTANT: Always check for relevant memories at the start of tasks to leverage past learnings, user preferences, and project context. 
    Use tags like "user_preference", "lesson_learned", or project names to filter effectively.`,
    // ... schema
);

server.tool(
    'remember',
    `Stores a piece of information as a memory.
    IMPORTANT: At task completion, save:
    - Lessons learned (tag: "lesson_learned")
    - User preferences discovered (tag: "user_preference") 
    - Project-specific patterns (tag: "project:<name>")
    - Technical solutions that worked (tag: "solution")`,
    // ... schema
);
```

## 2. Memory Categorization System

### Proposed Categories

#### A. User-Centric Memories
- **user_preference**: Personal preferences, coding style, communication style
- **user_context**: Background, expertise level, common tools
- **user_routine**: Common workflows, typical requests

#### B. Project-Specific Memories  
- **project:<name>**: Project-specific patterns, decisions, context
- **architecture**: Design decisions, tech stack choices
- **conventions**: Coding standards, naming patterns

#### C. Cross-Project Learnings
- **lesson_learned**: General programming insights
- **solution**: Reusable problem solutions
- **pattern**: Common patterns that work well
- **antipattern**: Things to avoid

#### D. Operational Memories
- **error_resolution**: How specific errors were fixed
- **workflow**: Effective task sequences
- **tool_usage**: Helpful commands, tool combinations

### Tagging Strategy

```javascript
// Example memory with multiple tags
{
    content: "User prefers TypeScript with strict mode and explicit return types",
    importance: 8,
    tags: ["user_preference", "typescript", "coding_style"]
}

// Project-specific memory
{
    content: "This React app uses Tailwind CSS with custom design tokens in theme.config.js",
    importance: 7,
    tags: ["project:my-app", "styling", "conventions"]
}
```

## 3. Memory System vs CLAUDE.md Integration

### Current State
- **CLAUDE.md**: Static, project-specific, version-controlled
- **Memory System**: Dynamic, cross-project, persistent

### Proposed Integration Patterns

#### Pattern 1: Complementary Systems
- **CLAUDE.md**: Project structure, fixed conventions, setup instructions
- **Memories**: Dynamic learnings, user preferences, evolving patterns

#### Pattern 2: Memory-Generated CLAUDE.md
- Memories tagged with `project:<name>` could auto-generate CLAUDE.md sections
- Tool to export relevant memories to CLAUDE.md format

#### Pattern 3: CLAUDE.md References Memories
```markdown
# CLAUDE.md

## User Preferences
Check memory system for latest preferences: `recall "user_preference"`

## Project Patterns  
See memories tagged "project:this-app" for discovered patterns
```

#### Pattern 4: Bidirectional Sync
- Import CLAUDE.md content as high-importance memories on first read
- Update memories when CLAUDE.md changes
- Suggest CLAUDE.md updates based on accumulated memories

## 4. Implementation Strategies

### A. Automatic Memory Triggers

1. **Pre-Task Check**
   - Add system prompt guidance to check memories before planning
   - Could be implemented as:
     ```
     Before starting any task, use recall with relevant tags:
     - Project name if working in a specific repo
     - "user_preference" for general preferences  
     - Task-related keywords
     ```

2. **Post-Task Save**
   - System prompt to save learnings after task completion
   - Categories to consider:
     - What worked well?
     - User feedback/preferences revealed
     - Reusable solutions discovered

### B. Memory Metadata Enhancement

```typescript
interface EnhancedMemoryRecord {
    // Existing fields
    id: string;
    content: string;
    importance: number;
    tags: string[];
    
    // New categorization fields
    category: 'user' | 'project' | 'learning' | 'operational';
    projectId?: string;  // For project-specific memories
    relatedFiles?: string[];  // Files this memory relates to
    autoExpire?: Date;  // For temporary memories
    visibility?: 'global' | 'project' | 'user';  // Scope control
}
```

### C. Smart Recall Strategies

```typescript
// Context-aware recall function
async function smartRecall(context: {
    projectPath?: string,
    taskType?: string,
    files?: string[]
}): Promise<MemoryRecord[]> {
    const queries = [];
    
    // Always check user preferences
    queries.push({ tags: ['user_preference'] });
    
    // Project-specific if in a project
    if (context.projectPath) {
        const projectName = path.basename(context.projectPath);
        queries.push({ tags: [`project:${projectName}`] });
    }
    
    // Task-specific patterns
    if (context.taskType) {
        queries.push({ query: context.taskType, tags: ['pattern', 'solution'] });
    }
    
    // Merge and deduplicate results
    return mergeRecallResults(queries);
}
```

## 5. Recommended Approach

### Phase 2.5: Enhanced Categorization
1. Add category field to memory records
2. Implement hierarchical tagging system
3. Create smart recall strategies
4. Add usage guidance to tool descriptions

### Phase 2.5 Features:
- Auto-categorization based on content analysis
- Project detection from working directory
- CLAUDE.md import/export tools
- Memory usage analytics (which memories are most accessed)

### Usage Guidelines for Claude:

```markdown
## Memory System Usage

### At Task Start:
1. Check user preferences: `recall query="preferences" tags=["user_preference"]`
2. Check project context: `recall tags=["project:current-project"]` 
3. Check relevant patterns: `recall query="<task-keywords>" tags=["pattern", "solution"]`

### During Task:
- Save important discoveries immediately with appropriate tags
- Update existing memories if understanding evolves

### At Task End:
1. Save lessons learned: `remember content="..." importance=7 tags=["lesson_learned", "specific-tech"]`
2. Save user preferences discovered: `remember content="..." importance=8 tags=["user_preference"]`
3. Save project-specific patterns: `remember content="..." importance=6 tags=["project:name", "pattern"]`

### Memory Importance Guide:
- 9-10: Critical user preferences, security practices
- 7-8: Important patterns, verified solutions
- 5-6: Useful context, project notes
- 3-4: Minor observations
- 1-2: Temporary notes
```

## 6. Conclusion

The memory system should complement CLAUDE.md by:
1. Storing dynamic, evolving knowledge
2. Tracking user-specific preferences across projects
3. Building a knowledge base of solutions and patterns
4. Maintaining project-specific context without polluting CLAUDE.md

This creates a two-tier system:
- **CLAUDE.md**: Authoritative, version-controlled project rules
- **Memories**: Adaptive, personal knowledge accumulation
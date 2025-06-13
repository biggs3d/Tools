# Memory System & CLAUDE.md Integration Example

## Scenario: Working on a React Project

### Initial Setup

**CLAUDE.md** (static, in repo):
```markdown
# MyApp Project Guidelines

## Tech Stack
- React 18 with TypeScript
- Vite for bundling
- Tailwind CSS for styling
- React Query for data fetching

## Project Structure
- /src/components - Reusable components
- /src/pages - Page components  
- /src/hooks - Custom hooks
- /src/utils - Utility functions

## Conventions
- Use functional components with hooks
- Follow Airbnb style guide
- All components must have TypeScript types
```

**Initial Memories** (when first working on project):
```javascript
// Import key CLAUDE.md info as memories
remember({
    content: "MyApp uses React 18, TypeScript, Vite, Tailwind, React Query",
    importance: 8,
    tags: ["project:myapp", "tech_stack"]
})

remember({
    content: "MyApp follows Airbnb style guide, requires TS types for all components",
    importance: 7,
    tags: ["project:myapp", "conventions"]
})
```

### During Development

**User says:** "I prefer using arrow functions for components"

**Memory saved:**
```javascript
remember({
    content: "User prefers arrow functions for React components: const MyComponent: FC = () => {}",
    importance: 9,
    tags: ["user_preference", "react", "coding_style"]
})
```

**Discovering project pattern:**
```javascript
remember({
    content: "MyApp uses custom useAuth hook from src/hooks/auth.ts for all auth checks",
    importance: 7,
    tags: ["project:myapp", "pattern", "authentication"]
})
```

**Learning from error:**
```javascript
remember({
    content: "Tailwind classes must be complete strings, not concatenated - use clsx() utility instead",
    importance: 8,
    tags: ["lesson_learned", "tailwind", "project:myapp", "solution"]
})
```

### Next Session Workflow

1. **Claude checks memories at start:**
```javascript
// Text search for exact user preferences
recall({ 
    query: "arrow functions", 
    search_type: "text",
    tags: ["user_preference"] 
})
// => Finds: "User prefers arrow functions for React components"

// Semantic search for project concepts  
recall({ 
    query: "authentication patterns", 
    search_type: "semantic",
    tags: ["project:myapp"] 
})
// => Finds: useAuth hook usage, login flows, auth-related patterns

// Hybrid search for component patterns (best approach)
recall({ 
    query: "component architecture", 
    search_type: "hybrid",
    tags: ["pattern", "project:myapp"],
    limit: 5
})
// => Combines exact matches + conceptually similar memories
```

2. **Semantic discovery of related knowledge:**
```javascript
// User asks: "How should I handle form state?"
recall({ 
    query: "form state management", 
    search_type: "semantic"
})
// => Discovers: form validation patterns, useAuth hook, state patterns
// Even if exact "form state" wasn't mentioned before!
```

3. **Combined knowledge from both systems:**
- CLAUDE.md: "Use functional components" (static rule)
- Memory (text): "User prefers arrow functions" (exact preference)
- Memory (semantic): Related component patterns, state management approaches
- Result: Creates components using arrow function syntax with appropriate state patterns

4. **New learning gets saved with embedding:**
```javascript
remember({
    content: "MyApp's form validation uses react-hook-form with yup schemas stored in /src/schemas",
    importance: 6,
    tags: ["project:myapp", "pattern", "forms", "validation"]
})
// => Automatically generates embedding for future semantic search
```

### Cross-Project Benefits

When starting a NEW React project:

```javascript
// Get exact user preferences (text search)
recall({ 
    query: "preferences", 
    search_type: "text",
    tags: ["user_preference", "react"] 
})
// Returns: Arrow function preference, specific coding style choices

// Find conceptually related lessons (semantic search)
recall({ 
    query: "common React pitfalls", 
    search_type: "semantic",
    tags: ["lesson_learned"] 
})
// Returns: Tailwind concatenation issue, useEffect cleanup, state management lessons
// Even if they weren't tagged with "react" specifically!

// Get comprehensive setup knowledge (hybrid search)
recall({ 
    query: "project initialization", 
    search_type: "hybrid",
    tags: ["pattern"],
    limit: 10
})
// Returns: Setup patterns from all React projects + conceptually similar setup steps
```

### Memory Lifecycle Example

1. **Temporary note** (low importance):
```javascript
remember({
    content: "TODO: Refactor UserProfile component to use new API",
    importance: 2,
    tags: ["project:myapp", "todo"]
})
```

2. **Becomes permanent pattern** (after refactor):
```javascript
update_memory({
    id: "...",
    content: "UserProfile uses getUserDetails API with React Query, caches for 5 min",
    importance: 6,
    tags: ["project:myapp", "pattern", "api", "caching"]
})
```

3. **Eventually moves to CLAUDE.md** (if core pattern):
```markdown
## API Patterns
- All user data fetched via React Query
- Standard cache time: 5 minutes
- See src/queries/user.ts for examples
```

### Memory Categories in Practice

**User-Centric** (persist across all projects):
- "User prefers explicit return types in TypeScript"
- "User likes detailed comments for complex logic"
- "User's GitHub username is @example"

**Project-Specific** (scoped to project):
- "MyApp uses /api/v2 endpoints after migration"
- "MyApp's theme colors defined in tailwind.config.js"
- "MyApp deployment requires npm run build:prod"

**Cross-Project Learnings** (valuable everywhere):
- "React.memo only helps if props are memoized too"
- "Vite requires .tsx extension for JSX files"
- "Always cleanup useEffect subscriptions"

**Operational** (how-to knowledge):
- "Fix 'module not found' in Vite by restarting dev server"
- "React Query devtools activated with cmd+shift+Q"
- "Use npm run test:watch for TDD workflow"

### Phase 2 Features in Action

1. **Upgrading existing memories to semantic search:**
```javascript
// After setting up Gemini API, generate embeddings for existing memories
generate_embeddings_for_existing({ batch_size: 10 })
// => Processes memories in batches, generates embeddings for semantic search
```

2. **Smart discovery through semantic search:**
```javascript
// User: "I'm having trouble with component re-renders"
recall({ 
    query: "performance optimization", 
    search_type: "semantic"
})
// => Finds: React.memo patterns, useCallback lessons, memoization strategies
// Even if previous memories used different terminology!
```

3. **Hybrid search for comprehensive results:**
```javascript
// Working on authentication
recall({ 
    query: "login security", 
    search_type: "hybrid",
    limit: 8  
})
// => Text matches: "login", "security", "auth" 
// => Semantic matches: JWT handling, password validation, session management
// => Combined with RRF algorithm for best ranking
```

### Smart Integration Features

1. **Memory-aware CLAUDE.md suggestions:**
   - After accumulating several project patterns, suggest CLAUDE.md updates
   - Flag conflicts between memories and CLAUDE.md
   - Use semantic search to find related patterns across projects

2. **Context-sensitive recall with semantic understanding:**
   - Working on auth? Semantic search finds authentication, security, login patterns
   - In a test file? Finds testing, validation, assertion patterns
   - Error occurs? Semantic search discovers similar error solutions and debugging approaches

3. **Memory inheritance with intelligent filtering:**
   - New React project? Semantic search identifies applicable React patterns
   - Excludes project-specific memories through tag filtering
   - Discovers conceptually similar patterns from other frameworks

4. **Automatic embedding generation:**
   - All new memories get embeddings for future semantic search
   - Background processing can fill in missing embeddings
   - Graceful fallback to text search if embedding generation fails

### Performance & Scalability Notes

- **Embedding Generation**: ~450ms per memory (batched for efficiency)
- **Search Performance**: Hybrid search balances accuracy and speed
- **Memory Efficiency**: Embeddings cached in memory for fast similarity calculations
- **Gradual Enhancement**: Text search always works, semantic search adds intelligence when available

This integration creates a dynamic, intelligent knowledge system that learns and adapts while respecting project-specific rules and user preferences. The semantic capabilities make knowledge discovery more natural and comprehensive.
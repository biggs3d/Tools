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
// Automatic checks when starting work
recall({ tags: ["user_preference"] })
// => Finds: "User prefers arrow functions for React components"

recall({ tags: ["project:myapp"] })  
// => Finds: Tech stack, auth pattern, Tailwind lesson

recall({ query: "component", tags: ["pattern", "project:myapp"] })
// => Finds: Component patterns specific to this project
```

2. **Combined knowledge from both systems:**
- CLAUDE.md: "Use functional components" (static rule)
- Memory: "User prefers arrow functions" (personal preference)
- Result: Creates components using arrow function syntax

3. **New learning gets saved:**
```javascript
remember({
    content: "MyApp's form validation uses react-hook-form with yup schemas stored in /src/schemas",
    importance: 6,
    tags: ["project:myapp", "pattern", "forms", "validation"]
})
```

### Cross-Project Benefits

When starting a NEW React project:

```javascript
recall({ tags: ["user_preference", "react"] })
// Returns: Arrow function preference, other React preferences

recall({ tags: ["lesson_learned", "react"] })
// Returns: Tailwind concatenation issue, other React learnings

recall({ query: "setup", tags: ["pattern", "react"] })
// Returns: Common setup patterns from all React projects
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

### Smart Integration Features

1. **Memory-aware CLAUDE.md suggestions:**
   - After accumulating several project patterns, suggest CLAUDE.md updates
   - Flag conflicts between memories and CLAUDE.md

2. **Context-sensitive recall:**
   - Working on auth? Auto-recall auth-related memories
   - In a test file? Recall testing patterns
   - Error occurs? Search for similar error solutions

3. **Memory inheritance:**
   - New React project? Inherit applicable React memories
   - But NOT project-specific ones from other projects

This integration creates a dynamic knowledge system that learns and adapts while respecting project-specific rules and user preferences.
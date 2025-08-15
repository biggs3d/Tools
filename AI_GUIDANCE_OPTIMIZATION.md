# AI Guidance Documentation Optimization Request

## Context
The user has an extensive AI guidance documentation setup in their work repository that's been growing organically. They're looking to optimize the organization for better AI comprehension and effectiveness. The documentation includes:
- Root `.ai-guidance/` folder with CLAUDE.md and other guides
- Subdirectory `.ai-guidance/ai-guide/` with ~15 framework-specific documents
- Various helper scripts and tools

## User's Goal
Optimize the documentation structure so that Claude Code can:
1. Find information more efficiently
2. Understand which docs to reference when
3. Reduce context usage while maintaining effectiveness
4. Better comprehend the framework and project patterns

## Recommended Reorganization

### 1. Restructure by Usage Frequency
Reorganize the `.ai-guidance/ai-guide/` folder into frequency-based subdirectories:

```
.ai-guidance/
├── CLAUDE.md (main entry point - session protocols)
├── _QUICK_REF.md (NEW - create this with commands, paths, common fixes)
├── ai-guide/
│   ├── _START_HERE.md (keep as framework overview)
│   ├── _DAILY/ (frequent reference during coding)
│   │   ├── COOKBOOK_PATTERNS.md
│   │   ├── COMMON_PITFALLS.md
│   │   └── PROPERTY_VIEWMODEL_GUIDE.md
│   ├── _ARCHITECTURE/ (deeper dives for complex tasks)
│   │   ├── ENTITY_ARCHITECTURE.md
│   │   ├── MODEL_GENERATION_GUIDE.md
│   │   └── FRAMEWORK_GUIDE.md
│   └── _REFERENCE/ (lookup as needed)
│       ├── PHOENIX_UI_LIBRARY.md
│       ├── THEMING_GUIDE.md
│       ├── CSS_GUIDANCE.md
│       ├── CONFIGURATION_GUIDE.md
│       └── DISPLAY_REGISTRATION_GUIDE.md
```

### 2. Create a Quick Reference Index
Create a new `_QUICK_REF.md` file with:

```markdown
# Quick Reference Index

## Most Used Commands
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Generate models: `npm run generate-model`
- Count build errors: `./tools/build-helpers/count-build-errors.sh`
- Show build errors: `./tools/build-helpers/show-build-errors.sh 20`

## Critical Paths
- Model source: `/model/*.model/src/` (edit here)
- Generated models: `client/libs/*/model/` (never edit)
- ViewModels: `{lib}.core/src/lib/viewModels/`
- UI Components: `{lib}.components/src/lib/{feature}/`
- Adapters/Labels: `{lib}.core/src/lib/adapters/`

## Common Error → Fix Mappings
- "Cannot find module" → Check imports, run build
- "Property does not exist" → Model might need regeneration
- Grid reference errors → Get fresh layout references after operations
- "vi.Mock not found" → Use `ReturnType<typeof vi.fn>` instead
- Numeric default issues → Use `??` not `||` for number defaults

## When to Read What
- NEW FEATURE → Start with _DAILY/COOKBOOK_PATTERNS.md
- DEBUGGING → Check _DAILY/COMMON_PITFALLS.md first
- MODEL CHANGES → _ARCHITECTURE/MODEL_GENERATION_GUIDE.md
- PROPERTY VALUES → _DAILY/PROPERTY_VIEWMODEL_GUIDE.md
- STYLING → _REFERENCE/THEMING_GUIDE.md and CSS_GUIDANCE.md
```

### 3. Optimize CLAUDE.md Structure
Restructure the main CLAUDE.md with clear sections and triggers:

```markdown
# CLAUDE.md - Project AI Guidance

## 🚨 CRITICAL CONTEXT (Always Read First)
- **Working Directory**: `/workspaces/cwmi-hmi-v2/client`
- **Framework**: React/MobX/TypeScript with MVVM architecture
- **Model Changes**: ONLY edit `/model/*.model/src/`, then run `npm run generate-model`
- **Quick Start**: See `.ai-guide/_START_HERE.md` for framework overview

## 📋 Session Protocols

### On Session Start
1. Check daily context if greeted
2. Read _QUICK_REF.md for commands/paths
3. Get folder structure if needed
4. Ask for missing context/files

### When User Says X → Do Y
| User Input | Required Action |
|------------|----------------|
| "morning", "hello", "hey" | Check daily context with valet MCP |
| "new feature" | Read _DAILY/ docs first |
| "fix bug" | Check COMMON_PITFALLS.md |
| "update model" | Read MODEL_GENERATION_GUIDE.md |
| "done", "thanks" | Run session retrospective |
| Mentions relative path | Assume repo root, not CWD |

### Task-Based Documentation Map
- **Creating Components** → _DAILY/COOKBOOK_PATTERNS.md
- **Fixing Errors** → _DAILY/COMMON_PITFALLS.md
- **Property Values** → _DAILY/PROPERTY_VIEWMODEL_GUIDE.md
- **Architecture Decisions** → _ARCHITECTURE/*.md
- **UI Components** → _REFERENCE/PHOENIX_UI_LIBRARY.md
- **Styling** → _REFERENCE/THEMING_GUIDE.md

[Rest of existing CLAUDE.md content...]
```

### 4. Leverage Memory System for Dynamic Patterns
Add to CLAUDE.md:

```markdown
## Dynamic Knowledge Management

### Use Memory System For:
- Project-specific solutions that worked
- Patterns discovered during debugging
- Performance optimizations found
- User preferences learned
- Architectural decisions made

### Memory Tagging Convention:
- `project:phoenix` - This specific project
- `pattern` - Reusable patterns discovered
- `solution` - Bug fixes and solutions
- `lesson_learned` - What to do/avoid
- `user_preference` - How user likes things done

### Example Memory Creation:
After solving a tricky issue, save it:
```
mcp__memory-link__remember
  content: "Grid consolidation requires fresh layout refs - stale refs cause position bugs"
  importance: 8
  tags: ["project:phoenix", "pattern", "grid-system"]
```

### Before Major Tasks:
Always check memories for relevant patterns:
```
mcp__memory-link__recall
  query: "grid panel"
  tags: ["project:phoenix", "pattern"]
```
```

### 5. Create Pattern Templates Section
Add a new section to COOKBOOK_PATTERNS.md or create TEMPLATES.md:

```markdown
# Copy-Paste Templates

## New Panel Type
```typescript
// 1. Define in panelTypes.ts
export const MyPanelType: IGridPanelTypeConfig = {
  id: 'my-panel',
  title: 'My Panel',
  component: MyPanelComponent,
  alignment: { horizontal: 'left', vertical: 'top' },
  defaultSize: { width: 300, height: 400 },
  minSize: { width: 200, height: 200 }
};

// 2. Register in setup
GridPanelTypeRegistry.registerPanel(MyPanelType);

// 3. Component in panels/MyPanel.tsx
export const MyPanelComponent: React.FC<IGridPanelProps> = observer(({ viewModel }) => {
  return <div>{/* Implementation */}</div>;
});
```

[More templates...]
```

### 6. Add NOTE-AI Pattern Guidelines
Include in CLAUDE.md:

```markdown
## NOTE-AI Comment Strategy

Use NOTE-AI comments for capturing "why" decisions that future AI sessions need:

### Template:
```javascript
// NOTE-AI: [Decision/Pattern Name]
// - Rationale: [Why this approach]
// - Alternatives considered: [What else was tried/considered]
// - Constraints: [What limits this decision]
// - Revisit if: [Conditions that would change this]
// - See: [Link to relevant docs/issues]
```

### When to Add NOTE-AI:
- After solving complex bugs
- When choosing between architectural approaches
- When working around framework limitations
- When implementing non-obvious solutions
- When user expresses strong preferences
```

## Implementation Steps

1. **Create the folder structure** above in `.ai-guidance/ai-guide/`
2. **Move existing docs** into appropriate subdirectories
3. **Create _QUICK_REF.md** with the content suggested
4. **Update CLAUDE.md** with the clearer structure and triggers
5. **Add memory system usage** guidelines
6. **Test with a simple task** to ensure docs are findable

## Expected Benefits

1. **Faster context acquisition** - I'll know exactly where to look
2. **Reduced token usage** - Won't need to read everything for simple tasks
3. **Better pattern recognition** - Clear separation of concerns
4. **Improved continuity** - Memory system captures evolving patterns
5. **Clearer mental model** - Hierarchy matches task complexity

## Additional Suggestions

### Consider Creating These Additional Docs:
- `DEBUGGING_PLAYBOOK.md` - Step-by-step debugging approaches
- `PERFORMANCE_PATTERNS.md` - Optimization strategies that worked
- `INTEGRATION_GUIDE.md` - How different parts connect

### Use Markdown Features for Scannability:
- Tables for mappings
- Code blocks with language hints
- Collapsible sections for details
- Clear emoji indicators (🚨 critical, 📋 reference, etc.)

### Regular Maintenance:
- Weekly: Update COMMON_PITFALLS with new discoveries
- Monthly: Review and consolidate similar patterns
- Per sprint: Update memory system with lessons learned

## Note to Claude in Work Repo

When implementing these changes:
1. Use the todo list to track reorganization steps
2. Test documentation findability with a sample task
3. Get user feedback on the new structure
4. Consider using the memory system to track which docs are most useful
5. Suggest creating helper scripts for common multi-step operations

The goal is to make the documentation feel like a well-organized toolkit where you can quickly grab exactly what you need for the task at hand, rather than reading through everything each time.
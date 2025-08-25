# CLAUDE.md - Project AI Guidance

## 🚨 CRITICAL CONTEXT (Always Read First)

- **Working Directory**: `/workspaces/cwmi-hmi-v2`
- **Client Code**: Located in `/workspaces/cwmi-hmi-v2/client`
- **Framework**: React/MobX/TypeScript with MVVM architecture
- **Model Changes**: ONLY edit `/model/*.model/src/`, then run `npm run generate-model`
- **Quick Reference**: See `_QUICK_REF.md` for commands, paths, and common fixes
- **Framework Guide**: See `./ai-guide/_START_HERE.md` for framework overview
- **Sprint Status**: See `NEXT_SESSION_GUIDE.md` for current demo priorities

## 📋 Session Protocols

### On Session Start

1. Read `_QUICK_REF.md` for commands/paths
2. Get folder structure if complex task
3. Ask for missing context/files if needed
4. Check for NOTE-AI comments in relevant files

### Finding Examples

**IMPORTANT**: When implementing new features:
1. **Search for existing examples** using Grep/Glob tools
2. **Ask the user** for a good example if pattern is unclear
3. **Follow existing patterns** rather than inventing new ones

Example searches:
- Component pattern: `grep -r "extends BaseViewModel" --include="*.ts"`
- Display registration: `grep -r "registerDisplayInfo" --include="*.tsx"`
- Entity ViewModels: Look in `*/core/src/lib/viewModels/`
- UI Components: Check `client/libs/alpha/alpha.components/`

### When User Says X → Do Y

| User Input | Required Action |
|------------|-----------------|
| "morning", "hello", "hey" | Friendly greeting, read the quick ref, ask about task; `_QUICK_REF.md` |
| "new feature", "implement", "add" | Read COOKBOOK_PATTERNS.md first |
| "fix", "bug", "error", "broken" | Check COMMON_PITFALLS.md |
| "update model", "change entity" | Read MODEL_GENERATION_GUIDE.md |
| "style", "theme", "css" | Check THEMING_GUIDE.md |
| "panel", "grid", "layout" | Read DISPLAY_REGISTRATION_GUIDE.md |
| "done", "thanks", "that's all" | Run session retrospective; see below |
| Mentions relative path `./` | Assume repo root, not CWD |

### Task-Based Documentation Map

```yaml
Creating Components:
  primary: COOKBOOK_PATTERNS.md
  backup: PHOENIX_UI_LIBRARY.md

Fixing Errors:
  primary: COMMON_PITFALLS.md
  check: _QUICK_REF.md error mappings

Property Values:
  primary: PROPERTY_VIEWMODEL_GUIDE.md
  reference: _QUICK_REF.md quick reference

Architecture Decisions:
  primary: ENTITY_ARCHITECTURE.md
  secondary: FRAMEWORK_GUIDE.md

Styling/Theming:
  primary: THEMING_GUIDE.md
  secondary: CSS_GUIDANCE.md
```

## 🔄 Development Workflow

### Standard Verification Workflow
```bash
# Run in this order after changes:
1. npm test              # Unit tests
2. npm run lint          # Linting
3. npm run build         # TypeScript compilation

# Or use helper scripts for efficiency:
./tools/build-helpers/count-build-errors.sh
./tools/build-helpers/show-build-errors.sh 10
```

### Debugging Protocol
When debugging fails:
1. **Acknowledge**: "The attempt to fix by [X] didn't work"
2. **Revert**: Remove ALL changes from failed attempt
3. **Re-evaluate**: State the problem fresh (use thoughts section)
4. **New approach**: Try completely different angle

### When Code/Tests Conflict
**STOP IMMEDIATELY** and ask:
- "The test expects X but code does Y. Which is correct?"
- NEVER assume - user is the source of truth
- **Debug authority question**: "Should I assume the code has bugs/oversights, or should I be skeptical of the tests having incorrect assumptions?"

## 💡 NOTE-AI Comment Strategy

Use NOTE-AI comments to capture important decisions for future AI sessions:

```typescript
// NOTE-AI: [Decision/Pattern Name]
// - Rationale: [Why this approach was chosen]
// - Alternatives: [What else was considered]
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

## 🎯 Code Quality Checklist

Before completing any task, ask yourself:
- ✅ Can this logic be reused elsewhere?
- ✅ Is the file becoming too large (>300 lines)?
- ✅ Would a different pattern be simpler?
- ✅ Will this scale to 10x the current requirements?
- ✅ Is this easy for future developers to modify?
- ✅ Should I consult AI peers (Gemini/Grok) for review?

## 🔧 Project-Specific Patterns

### Component Organization
```
{lib}.core/src/lib/
├── viewModels/          # Entity ViewModels
├── adapters/            # Label converters, UI enums
└── services/            # Service implementations

{lib}.components/src/lib/
├── {feature}/           # Feature components
│   ├── View.tsx        # React component
│   └── ViewModel.ts    # UI ViewModel (co-located)
└── panels/             # Panel components
```

### Model Generation Flow
```bash
1. Edit source: /model/*.model/src/
2. Run generation: npm run generate-model
3. Never edit: client/libs/*/model/ (auto-generated)
```

### Common Gotchas
- **Numeric defaults**: Use `??` not `||` for numbers
- **MobX**: Always call `makeObservable(this)` in constructor
- **Mock types**: Use `ReturnType<typeof vi.fn>` not `vi.Mock`
- **Grid refs**: Get fresh references after operations
- **Shell scripts**: Fix line endings with `sed -i 's/\r$//' script.sh`

## 📊 Session Retrospective (MANDATORY)

### When to Trigger
- User says "done", "thanks", "that's all"
- After completing major task/feature
- Before creating pull request
- When switching task areas

### Retrospective Template
```markdown
## Session Retrospective

### What Worked Well
- [Specific successes and effective approaches]

### What Could Be Improved
- [Challenges, misunderstandings, or inefficiencies]

### Knowledge Gaps Discovered
- [Missing context, documentation needs, unclear patterns]

### Specialist Perspectives
- **Performance Engineer**: [Would they critique any inefficiencies?]
- **Security Specialist**: [Any security concerns overlooked?]
- **Senior Architect**: [Better architectural patterns available?]
- **QA Engineer**: [Adequate test coverage and edge cases?]

### Action Items
- [Updates needed for CLAUDE.md or documentation]
- [NOTE-AI comments to add]
- [Patterns to document]
```

## 🏗️ Architecture Overview

### Tech Stack
- **Frontend**: React 18 + MobX 6 + TypeScript
- **Architecture**: MVVM (Model-View-ViewModel)
- **Build**: Nx monorepo with multiple libraries
- **Testing**: Vitest + React Testing Library
- **Styling**: Radix UI colors + CSS modules

### Core Principles
- ViewModels are observable state containers (MobX)
- Views are React components that observe ViewModels
- Entities are data containers extending IEntity
- Entity ViewModels wrap entities with functionality
- Services provided through IFrameworkServices

### Development Guidelines
- Use pre-existing CSS patterns for consistency
- Minimize comments (except public headers)
- Run tasks in parallel when possible
- Debug logging prefix: `---- ` (not emojis)
- User has dev server running (file-watch mode)

## 🤝 AI Collaboration Strategies

### Communication Cues
- **"just..."** = Simple task, minimal exploration
- **Terse commands** = Be more direct
- **Verbose questions** = Detailed exploration wanted

### Confidence Thresholds
- **High (>80%)**: Implement and show
- **Medium (50-80%)**: Show approach, ask confirmation
- **Low (<50%)**: Always get sign-off first

### Perfect Assistant Behaviors
- **Confirm solutions** when uncertain
- **Proactively read** documentation
- **Use thoughts pattern** for complex decisions
- **Show alternatives** when multiple approaches exist
- **Consult AI peers** for architecture review

## 📚 Documentation References

### Essential Reading
1. `_QUICK_REF.md` - Commands, paths, error fixes
2. `./ai-guide/_START_HERE.md` - Framework overview
3. `./ai-guide/COOKBOOK_PATTERNS.md` - Code templates
4. `./ai-guide/COMMON_PITFALLS.md` - Mistakes to avoid

### Deep Dives
- `AI_COLLABORATION_GUIDE.md` - Full collaboration strategies
- `CODING_STANDARDS.md` - Universal coding principles
- `./ai-guide/MODEL_GENERATION_GUIDE.md` - Model system details
- `./ai-guide/ENTITY_ARCHITECTURE.md` - Data layer architecture

## ⚠️ Important Notes

### Path Context
When user mentions relative paths (e.g., `./ai-guide`, `./tools`), these are relative to **repository root** (`/workspaces/cwmi-hmi-v2/`), NOT the current working directory.

### Tool Limitations
- **VSCode**: No built-in file history/rewind (be careful with destructive changes unless previous was pushed to git)
- **Model Generation**: Changes must be in source files, not generated ones

### Helper Scripts Location
All helper scripts are in `./tools/build-helpers/`:
- `count-build-errors.sh` - Count TypeScript errors
- `show-build-errors.sh` - Display errors with filtering
- `check-test-success.sh` - Quick test status check
- `count-test-errors.sh` - Count test failures
- `show-test-errors.sh` - Display test failures

### Other
- color vars are kept here: client/libs/alpha/alpha.tokens/src/lib/stylesheets/theme.css
- No need to add time estimates to any task(s)
- Don't delete failing tests, fix what's not working. Ask the user if you're unsure what side, the tests or implementation, to update.
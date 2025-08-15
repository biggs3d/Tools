# Project Guidance

## Instructions

- **IMPORTANT**: Let me know if you need any missing files/content/context for data objects & types, or arch. background info!
- **SESSION ENDING PROTOCOL**: Always run the Improvement Stage retrospective when user indicates session is ending (see "After Each Task" section)
- **MODEL CHANGES**: All data model changes must be made in the `/model/cwmi.model/src/` or `/model/phoenix.model/src/` directories first, then run `npm run generate-model` to propagate changes to the client and server. Do NOT edit files directly in `client/libs/cwmi/cwmi.model/` or `client/libs/phoenix/phoenix.model/` as they will be overwritten during generation. See `./ai-guide/MODEL_GENERATION_GUIDE.md` for detailed instructions on model format and troubleshooting

### Path Context Note
**IMPORTANT**: When the user mentions relative paths (e.g., `./ai-guide`, `./tools`, `CLAUDE.md`), these are almost always relative to the **repository root** (`/workspaces/cwmi-hmi-v2/`), NOT the current working directory (`client/`). The user typically thinks in terms of the repo structure.

### Documentation Hierarchy
1. **General Coding Standards**: See `CODING_STANDARDS.md` for universal principles
2. **AI Collaboration**: See `AI_COLLABORATION_GUIDE.md` for AI-human collaboration strategies
3. **Framework Patterns**: See `./ai-guide/` folder for framework-specific React/MobX/TypeScript guidance  
4. **Project-Specific**: This file (CLAUDE.md) for project-unique patterns

### Before Each Task
- Read all the framework documentation in the `./ai-guide` folder
- Read the scripts available in the base `package.json`
- At the start always get the folder hierarchy structure of the project
- Ask me to include any additional example code/files you need, or try searching online

### After Each Task
- Check syntax errors
- Check linting  
- Check for build errors

### Standard Verification Workflow
```bash
# Run in this order:
1. Syntax check (automatic via TypeScript)
2. npm test (or appropriate test command)
3. npm run lint
4. npm run build
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
- If multiple conflicts: list all, get clarification
- **Debug authority question**: "Should I assume the code has bugs/oversights, or should I be skeptical of the tests having incorrect assumptions?"

- **Code Quality Review**:
  - ✅ Can this logic be reused elsewhere?
  - ✅ Is the file becoming too large or doing too much?
  - ✅ Would a different pattern be simpler?
  - ✅ Will this scale to 10x the current requirements?
  - ✅ Is this easy for future developers to modify?
  - ✅ Could I set myself up better for similar future tasks?

- **IMPORTANT**: Review significant code changes with the LLM bridge mcp tools available:
  - Architecture and design patterns validation
  - TypeScript type safety improvements
  - MobX reactive patterns compliance
  - Performance and maintainability considerations
  - Integration with existing framework patterns
  - Always add this peer review to the todo list

- **Continuous Improvement**:
  - **Refactor opportunities**: Look for patterns that emerged
  - **Extract utilities**: Move repeated code to shared helpers
  - **Document decisions**: Use NOTE-AI comments for "why" not "what"
  - **Update patterns**: If you discovered a better approach, document it

- **Improvement Stage (MANDATORY)**: Session retrospective for continuous improvement
    
    **WHEN TO TRIGGER**: 
    - When user says "done", "thanks", "that's all", or similar session-ending phrases
    - After completing a major task/feature
    - Before creating a pull request
    - When switching to a different task area
    
    **HOW TO EXECUTE**:
    1. **Proactively announce**: "Let me run through our session improvement checklist..."
    2. **Create a structured retrospective** with these sections:
       
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
       
       ### Action Items for Shared Project Markdown Documentation and/or CLAUDE.md
       - [Specific updates needed based on this session]
       ```
    
    3. **Ask the user**: "Before we wrap up, do you have any feedback on how I could have been more helpful?"
    
    4. **Persist learnings**:
       - Suggest NOTE-AI comments for significant discoveries
       - Propose CLAUDE.md updates for recurring patterns
       - Create TODO items for unresolved questions
    
    **ENFORCEMENT**: If user ends session without retrospective, remind them: "Should we do a quick retrospective to capture learnings for next time?"

## Project Architecture
- React/MobX/TypeScript repository
- View-ViewModel (MVVM) architecture
- Component-based structure with strong typing

## Project Context
```typescript
interface ProjectContext {
  currentPhase: "prototyping" | "feature-development" | "maintenance" | "refactoring"
  teamSize: number
  criticalPaths: string[]  // What absolutely cannot break
  performanceTargets: Record<string, number>
  techDebtTolerance: "none" | "tactical" | "strategic"
  preferredPatterns: string[]  // Links to examples
}

// Current project state:
const context: ProjectContext = {
  currentPhase: "feature-development",
  teamSize: 1,
  criticalPaths: [],
  performanceTargets: {},
  techDebtTolerance: "tactical",
  preferredPatterns: ["MVVM", "Composition", "Observable State"]
}
```

## Framework Patterns
- ViewModels are observable state containers using MobX
- Views are React components that observe ViewModels
- Entities are simple data containers extending IEntity interface
- Entity ViewModels wrap entities to provide functionality
- Services provided through IFrameworkServices
- Read all the documents in the ./ai-guide folder for detailed guidance!

### Component Organization
- **Entity ViewModels**: Located in `{lib}.core/src/lib/viewModels/`
- **UI ViewModels**: Co-located with their Views in `{lib}.components/src/lib/{feature}/`
- **Label Converters**: Located in `{lib}.core/src/lib/adapters/` (e.g., `trackTypes.ts`)
- **UI Concern Enums**: Located in adapters alongside label converters
- **Model Enums**: Generated in `{lib}.model/src/` - DO NOT modify these directly

### Adapters Pattern
The `adapters/` folder contains:
- Label converters for enum display values (e.g., `TrackQualityTypeLabel`)
- UI-specific enums and types (e.g., `ThreatCategory`, `PlatformType`)
- Bridge implementations between layers
- Service adapters and suppliers

## Common Tools
- MobX for state management
- TypeScript for type safety
- React for UI components
- Framework services for dependency injection
- Bootstrap-style utility classes for styling

## Design Guidelines
- Use the pre-existing css formatting as much as possible for new elements, such as buttons
- Minimize comments outside of public headers
- Run tasks in parallel when possible, such as reading multiple files
- Prefix temporary console debug logging with '---- ' not emojis

## Development Tips
- No need to serve the client, just try building, user always has the client running in file-watch mode
- When creating mock containers for tests, ensure both `offsetWidth/offsetHeight` AND `clientWidth/clientHeight` are set
- Get fresh layout references after grid operations - don't rely on stale references from before the operation
- Grid consolidation happens in multiple passes - changes in one function must persist through the entire flow
- Consider creating test helper functions for common mock objects to ensure consistency

### Perfect Assistant Behaviors
- **Confirm solutions** before implementation when uncertain
- **Proactively read** needed documentation without being asked
- **Use thoughts pattern** consistently for complex decisions
- **Show alternatives** when multiple valid approaches exist

### Tool Limitations
- **VSCode limitation**: Unlike JetBrains IDEs, VSCode lacks built-in file history/rewind features. Be extra careful with destructive changes as recovery options are limited.

### Context Efficiency Scripts
base directory `./tools/build-helpers`

### Build Error Helper Scripts
Instead of running `npm run build` repeatedly and flooding the context, use these helper scripts:
- `./tools/build-helpers/count-build-errors.sh` - Count all TypeScript errors
- `./tools/build-helpers/count-build-errors.sh "pattern"` - Count errors matching pattern
- `./tools/build-helpers/show-build-errors.sh` - Show first 20 errors (cleaned format)
- `./tools/build-helpers/show-build-errors.sh 10` - Show first 10 errors
- `./tools/build-helpers/show-build-errors.sh 15 "grid"` - Show first 15 errors matching "grid"

### Test Error Helper Scripts
- `./tools/build-helpers/check-test-success.sh` - Quick check if all tests pass (returns 0 for success, 1 for failure)
- `./tools/build-helpers/count-test-errors.sh` - Count test failures
- `./tools/build-helpers/show-test-errors.sh` - Show test failure details
- `./tools/build-helpers/show-test-errors.sh 10` - Show first 10 error lines
- `./tools/build-helpers/show-test-errors.sh 10 "grid"` - Show first 10 errors matching "grid"

### Important: Script Line Endings
When creating shell scripts in this WSL environment, ensure they have Unix line endings (LF, not CRLF). If a script fails with "bad interpreter" error, fix with:
```bash
sed -i 's/\r$//' ./path/to/script.sh
```

## Coding Standards

### Core Development Principles

#### 1. Modular Code Organization
- **Extract shared logic** into reusable functions
- **Keep files focused** - single responsibility or orchestration only
- **File size limits**: If a file exceeds ~300 lines, consider splitting
- **Example**: Instead of duplicating validation logic, create a shared utility

#### 2. Architecture & Design
- **Always ask**: "Is there a simpler, more elegant approach?"
- **SOLID principles**: Apply consistently, especially Single Responsibility
- **Composition over inheritance**: Use the plugin system and component composition
- **Scalability check**: "Will this be easy to extend? To modify?"

#### 3. Self-Reflection Questions
These questions help identify improvement opportunities:
- How could you set yourself up for better success next time?
- What patterns emerged that could be extracted?
- Is there a simpler or more elegant architecture?
- What would make this easier to modify in the future?

## Common Patterns and Gotchas

### Nullish Coalescing for Numeric Defaults
- **Always use `??` instead of `||`** when providing default values for numbers
- Example: `config.minWidth ?? defaultMinWidth` (not `||`)
- This prevents valid `0` values from being replaced with defaults

### TypeScript Mock Types
- Use `ReturnType<typeof vi.fn>` for basic mocks
- Use `ReturnType<typeof vi.fn<[ArgType], ReturnType>>` for typed mocks
- Avoid `vi.Mock` as it's not exported as a type

### Panel Types vs Instances
- `IGridPanelTypeConfig`: Registration/configuration (has alignment, minWidth, etc.)
- `IGridPanelInstance`: Runtime instance (has position, state, but not config properties)
- The rename from `IGridPanel` to `IGridPanelInstance` makes this distinction clear

### Testing Best Practices
- Run tests immediately after interface changes
- Use existing test helpers from mockHelpers.ts
- Verify method names match the actual API (registerPanel not registerPanelType)
- Mock containers need both offset and client dimensions






## AI Collaboration Strategies

For comprehensive AI collaboration guidance including metacognitive prompting, confidence elicitation, AI peer consultation, and NOTE-AI patterns, see `AI_COLLABORATION_GUIDE.md`.

### Building Trust Indicators
- When uncertain: "I'm 70% confident because..."
- Show alternatives: "Simple option: X, Complex but powerful: Y"
- Audit trail: Document WHY not just WHAT
- Interrupt counter: Track when user corrects course

### Task Complexity Indicators
- **Simple task** (contains "just..."): Minimal exploration, quick implementation
- **Complex task**: Deep thoughts, multiple approaches, user confirmation
- **Debugging**: ALWAYS ask about test vs code authority
- **New feature**: Read all relevant docs first

### Communication Cues
- **"just..."** = Simple task, minimal exploration needed
- **Terse + direct commands** = User frustration indicator - be more direct
- **Verbose questions** = User wants detailed exploration
- **Confidence thresholds**:
  - High confidence (>80%) → Implement and show
  - Medium (50-80%) → Show approach, ask confirmation
  - Low (<50%) → Always get sign-off before proceeding

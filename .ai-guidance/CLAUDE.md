# Project Guidance

## Instructions

- **IMPORTANT**: Let me know if you need any missing files/content/context for data objects & types, or arch. background info!
- **SESSION ENDING PROTOCOL**: Always run the Improvement Stage retrospective when user indicates session is ending (see "After Each Task" section)

### Before Each Task
- Read all the framework documentation in the `./ai-guide` folder
- Read the scripts available in the base `package.json`
- At the start always get the folder hierarchy structure of the project
- Ask me to include any additional example code/files you need, or try searching online

### After Each Task
- Check syntax errors
- Check linting
- Check for build errors

- **IMPORTANT**: Review significant code changes with the LLM bridge mcp tools available:
  - Architecture and design patterns validation
  - TypeScript type safety improvements
  - MobX reactive patterns compliance
  - Performance and maintainability considerations
  - Integration with existing framework patterns
  - Always add this peer review to the todo list

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

## Framework Patterns
- ViewModels are observable state containers using MobX
- Views are React components that observe ViewModels
- Entities are simple data containers extending IEntity interface
- Entity ViewModels wrap entities to provide functionality
- Services provided through IFrameworkServices
- Read all the documents in the ./ai-guide folder for detailed guidance!

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




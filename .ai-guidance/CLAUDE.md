# Project Guidance

## Instructions

- **IMPORTANT**: Let me know if you need any missing files/content/context for data objects & types, or arch. background info!

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

- **Improvement Stage**: Introspection at the end; strive for continuous improvement in every session!
  - What ended up working? What went wrong? What was misunderstood or not known?
  - How would several different, varied specialists critique this session?
  - What does the user think?
  - With you the agent as the target audience, how should their feedback be incorporated into the project's documentation files and CLAUDE.md?

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

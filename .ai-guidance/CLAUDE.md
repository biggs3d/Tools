# Project Guidance

## Instructions
- At the start of a task always get the folder hierarchy structure using `find . -type f -not -path "*/node_modules/*" -not -path "*/dist/*" | sort`
- Ask me to include any example code/files you need
- Run `npx tsc --noEmit filename.ext` to check typescript errors after updates
- Let me know if you need any missing files/content/context for data objects & types

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

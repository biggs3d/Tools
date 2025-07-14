# Project Guidance

## Instructions

- **IMPORTANT**: Let me know if you need any missing files/content/context for data objects & types, or arch. background info!

### Before Each Task
- Read all the framework documentation in the `./ai-guide` folder
- At the start always get the folder hierarchy structure using `find . -type f -not -path "*/node_modules/*" -not -path "*/dist/*" | sort`
- Ask me to include any example code/files you need

### After Each Task
- Run `npx tsc --noEmit filename.ext` to check typescript errors after updates
- Run `npx nx run-many -t lint` in the client to check lint errors after updates
- Run `npm run build` in the client to test the build (note: the user always has the client running in watch mode, they can review the visuals for you)
- **IMPORTANT**: Review significant code changes with Gemini using `mcp__gemini-bridge__send_to_gemini` tool for:
  - Architecture and design patterns validation
  - TypeScript type safety improvements
  - MobX reactive patterns compliance
  - Performance and maintainability considerations
  - Integration with existing framework patterns
  - Always add this peer review to the todo list

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
- No need to `npm run dev` just try building, user has the client running in file-watch mode

## Other References - Cesium Terrain
- new components: `client/libs/phoenix/phoenix.components/src/lib/components/map/geo.map/*`
- showcase example layer registration: `client/libs/showcase/showcase.registration/src/lib/map.tsx`
- showcase example other registration: `client/libs/showcase/showcase.registration/src/lib/app.showcase/showcase.tsx`
- showcase example code (full): `client/libs/showcase/`
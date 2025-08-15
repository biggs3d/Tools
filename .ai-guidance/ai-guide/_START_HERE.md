# Phoenix Framework - AI Guide

Welcome to the Phoenix framework documentation! This guide is designed to help AI assistants understand and contribute effectively to the codebase.

## Quick Overview

The Phoenix framework is a **React/MobX/TypeScript** application built using **MVVM (Model-View-ViewModel)** architecture for tactical/military applications. It features:

- **Reactive state management** with MobX
- **Strong typing** with TypeScript  
- **Component-based architecture** with reusable UI primitives
- **Entity-driven data models** with property ViewModels
- **Sophisticated theming** using Radix UI colors

## How to Use This Guide

This documentation is organized for quick reference and progressive learning:

### 🚀 **Getting Started** (Start Here)
- **[PROJECT_CONVENTIONS.md](PROJECT_CONVENTIONS.md)** - Project structure, naming, testing, and development workflow
- **[FRAMEWORK_GUIDE.md](FRAMEWORK_GUIDE.md)** - Core MVVM concepts and architecture

### 📚 **Core Concepts** (Essential Reading)
- **[ENTITY_ARCHITECTURE.md](ENTITY_ARCHITECTURE.md)** - Deep dive into the data layer and entity system
- **[PROPERTY_VIEWMODEL_GUIDE.md](PROPERTY_VIEWMODEL_GUIDE.md)** - **Critical**: When to use `value()`, `actual()`, `commanded()`, etc.

### 🔧 **Practical Development** (Daily Reference)
- **[COOKBOOK_PATTERNS.md](COOKBOOK_PATTERNS.md)** - Copy-pasteable code patterns for common tasks
- **[COMMON_PITFALLS.md](COMMON_PITFALLS.md)** - **NEW**: Common mistakes and how to avoid them
- **[PHOENIX_UI_LIBRARY.md](PHOENIX_UI_LIBRARY.md)** - Component library reference with examples
- **[THEMING_GUIDE.md](THEMING_GUIDE.md)** - Complete theming system with Radix UI colors
- **[CSS_GUIDANCE.md](CSS_GUIDANCE.md)** - Styling conventions and utility classes
- **[CONFIGURATION_GUIDE.md](CONFIGURATION_GUIDE.md)** - How to configure components and services (includes runtime configuration)

### 📊 **Advanced Topics**
- **[MODEL_GENERATION_GUIDE.md](MODEL_GENERATION_GUIDE.md)** - **CRITICAL**: How to modify data models and run generation
- **[SAMPLE_DATA_MODEL.md](SAMPLE_DATA_MODEL.md)** - Real data model examples from the codebase
- **[MAP_TROUBLESHOOTING.md](MAP_TROUBLESHOOTING.md)** - Debug 3D map and terrain issues

## Quick Reference Cheatsheet

### Most Common Patterns

#### ✅ **Form Input Binding** (Most Common)
```tsx
<TextInput
    value={viewModel.nameVM.localOrCommanded()}
    onChange={(value) => viewModel.nameVM.onCommandedUpdate(value)}
/>
```

#### ✅ **Display Current State**
```tsx
<div>Speed: {platform.speedVM.actualFormatted()}</div>
```

#### ✅ **Business Logic Decisions**
```tsx
if (platform.speedVM.actual() > 200) {
    enableHighSpeedMode();
}
```

### Property ViewModel Quick Reference

| Method | Use When | Example |
|--------|----------|---------|
| `.localOrCommanded()` | **Form inputs** (most common) | `<input value={vm.localOrCommanded()} />` |
| `.actualFormatted()` | **Display text** | `<span>{vm.actualFormatted()}</span>` |
| `.actual()` | **Business logic** | `if (vm.actual() > threshold)` |
| `.commanded()` | **Show pending changes** | `Pending: ${vm.commanded()}` |
| `.onCommandedUpdate()` | **Handle form changes** | `onChange={vm.onCommandedUpdate}` |

### Component Creation Pattern

```typescript
// 1. ViewModel
export class FeatureViewModel extends BaseViewModel {
    constructor(services: IFrameworkServices) {
        super(services);
        makeObservable(this);
    }
}

// 2. View
export const FeatureView = observer(({ viewModel }: { viewModel: FeatureViewModel }) => {
    return <div>Feature content</div>;
});

// 3. Test
describe('FeatureViewModel', () => {
    // Test cases
});
```

## AI Assistant Workflow

When contributing to this codebase:

1. **📁 Check project structure** - Use `PROJECT_CONVENTIONS.md` for file organization
2. **🧠 Understand the domain** - Read `ENTITY_ARCHITECTURE.md` for data concepts  
3. **⚡ Use property methods correctly** - Reference `PROPERTY_VIEWMODEL_GUIDE.md` 
4. **🎨 Follow UI patterns** - Use `PHOENIX_UI_LIBRARY.md` for components
5. **📝 Copy proven patterns** - Use `COOKBOOK_PATTERNS.md` for implementations
6. **🧪 Write tests** - Follow testing conventions in `PROJECT_CONVENTIONS.md`

## Key Success Factors

### ✅ **DO**
- Use `makeObservable(this)` in ViewModel constructors
- Use `@observer` on React components that consume MobX observables
- Use `localOrCommanded()` for form inputs
- Use `actualFormatted()` for display text
- Use `actual()` for business logic decisions
- Follow naming conventions: `*ViewModel.ts`, `*View.tsx`
- Write tests for ViewModels and components

### ❌ **DON'T**
- Use `any` types - always use proper TypeScript typing
- Use `actual()` for form inputs (use `localOrCommanded()`)
- Use `commanded()` for business logic (use `actual()`)
- Forget `runInAction()` after `await` in async methods
- Create files without following the established patterns

## Need Help?

- **Quick lookup**: Use the search function in your editor across all `.md` files
- **Property methods**: `PROPERTY_VIEWMODEL_GUIDE.md` has detailed examples and troubleshooting
- **Component usage**: `PHOENIX_UI_LIBRARY.md` shows props and examples for all UI components
- **Code patterns**: `COOKBOOK_PATTERNS.md` has copy-pasteable solutions for common tasks

## Development Commands

```bash
# Start development
npm run dev

# Run tests  
npm test

# Type checking
npx tsc --noEmit

# Build project
npm run build
```

Happy coding! 🚀
# Phoenix Framework - AI Guide

Welcome to the Phoenix framework documentation! This guide is organized by usage frequency to help you find information efficiently.

## 🎯 Quick Overview

The Phoenix framework is a **React/MobX/TypeScript** application built using **MVVM (Model-View-ViewModel)** architecture for tactical/military applications. It features:

- **Reactive state management** with MobX
- **Strong typing** with TypeScript  
- **Component-based architecture** with reusable UI primitives
- **Entity-driven data models** with property ViewModels
- **Sophisticated theming** using Radix UI colors

## 📚 Documentation Organization

### 🔥 _DAILY/ - Frequently Referenced (Start Here!)
Documents you'll use every day during active development:

- **[COOKBOOK_PATTERNS_ENHANCED.md](_DAILY/COOKBOOK_PATTERNS_ENHANCED.md)** - Complete copy-paste templates combining multiple patterns
- **[COMMON_PITFALLS.md](_DAILY/COMMON_PITFALLS.md)** - Mistakes to avoid and their fixes
- **[PROPERTY_VIEWMODEL_GUIDE.md](_DAILY/PROPERTY_VIEWMODEL_GUIDE.md)** - When to use `value()`, `actual()`, `commanded()`, etc.

### 🏗️ _ARCHITECTURE/ - Deep Dives
For understanding the system architecture and complex tasks:

- **[FRAMEWORK_GUIDE.md](_ARCHITECTURE/FRAMEWORK_GUIDE.md)** - Core MVVM concepts and architecture
- **[ENTITY_ARCHITECTURE.md](_ARCHITECTURE/ENTITY_ARCHITECTURE.md)** - Data layer and entity system details
- **[MODEL_GENERATION_GUIDE.md](_ARCHITECTURE/MODEL_GENERATION_GUIDE.md)** - How to modify data models
- **[SAMPLE_DATA_MODEL.md](_ARCHITECTURE/SAMPLE_DATA_MODEL.md)** - Real model examples from the codebase

### 📖 _REFERENCE/ - Lookup as Needed
Reference documentation for specific topics:

- **[PHOENIX_UI_LIBRARY.md](_REFERENCE/PHOENIX_UI_LIBRARY.md)** - Component library with examples
- **[THEMING_GUIDE.md](_REFERENCE/THEMING_GUIDE.md)** - Theming system with Radix UI colors
- **[CSS_GUIDANCE.md](_REFERENCE/CSS_GUIDANCE.md)** - Styling conventions and utilities
- **[CONFIGURATION_GUIDE.md](_REFERENCE/CONFIGURATION_GUIDE.md)** - Component and service configuration
- **[DISPLAY_REGISTRATION_GUIDE.md](_REFERENCE/DISPLAY_REGISTRATION_GUIDE.md)** - Display and panel registration
- **[PROJECT_CONVENTIONS.md](_REFERENCE/PROJECT_CONVENTIONS.md)** - Project structure and naming
- **[FYI_PERSONNEL.md](_REFERENCE/FYI_PERSONNEL.md)** - Team information and contacts

## 🚀 Quick Start Path

1. **First Time?** 
   - Read this file completely
   - Review [COOKBOOK_PATTERNS_ENHANCED.md](_DAILY/COOKBOOK_PATTERNS_ENHANCED.md) for complete examples

2. **Creating a Feature?**
   - Start with templates in [COOKBOOK_PATTERNS_ENHANCED.md](_DAILY/COOKBOOK_PATTERNS_ENHANCED.md)
   - Check [COMMON_PITFALLS.md](_DAILY/COMMON_PITFALLS.md) to avoid mistakes

3. **Working with Properties?**
   - Reference [PROPERTY_VIEWMODEL_GUIDE.md](_DAILY/PROPERTY_VIEWMODEL_GUIDE.md)

4. **Need Architecture Info?**
   - See _ARCHITECTURE/ folder for deep dives

## 💡 Key Patterns at a Glance

### Form Input Binding (Most Common)
```tsx
<TextInput
    value={viewModel.nameVM.localOrCommanded()}
    onChange={(value) => viewModel.nameVM.onCommandedUpdate(value)}
/>
```

### MobX Essentials
```typescript
constructor(services: IFrameworkServices) {
    super(services);
    makeObservable(this);  // CRITICAL: Enables reactivity
}
```

### Property ViewModel Methods
| Method | Use For | Returns |
|--------|---------|---------|
| `value()` | ValueProperty only | Raw value |
| `actual()` | Business logic, computations | Current state |
| `commanded()` | Showing pending changes | Desired state |
| `localOrCommanded()` | **Form inputs** | Commanded if set, else actual |
| `actualFormatted()` | Display text | Formatted string |

### Display Registration
```typescript
registerDisplayInfo({
    id: DisplayTypes.MyView,
    tags: [],
    visible: true,
    ordinal: 100,
    Renderer: props => {
        return <MyView viewModel={useViewModel(MyViewModel)} />;
    },
});
export default {};  // Required!
```

## 📋 Common Tasks → Documentation Map

| Task | Primary Doc | Folder |
|------|------------|--------|
| Create new component | COOKBOOK_PATTERNS_ENHANCED | _DAILY |
| Fix TypeScript error | COMMON_PITFALLS | _DAILY |
| Work with properties | PROPERTY_VIEWMODEL_GUIDE | _DAILY |
| Modify data model | MODEL_GENERATION_GUIDE | _ARCHITECTURE |
| Understand architecture | FRAMEWORK_GUIDE | _ARCHITECTURE |
| Find UI component | PHOENIX_UI_LIBRARY | _REFERENCE |
| Apply styling | THEMING_GUIDE, CSS_GUIDANCE | _REFERENCE |

## 🔧 Development Tips

1. **The enhanced cookbook has complete examples** - Each template demonstrates multiple concepts together
2. **Check pitfalls first when debugging** - Most errors have known solutions
3. **Use _QUICK_REF.md in repo root** - For commands, paths, and quick lookups
4. **Read CLAUDE.md for AI guidance** - Session protocols and collaboration strategies

## 🎓 Learning Path

### Beginner
1. This file (_START_HERE.md)
2. COOKBOOK_PATTERNS_ENHANCED - See complete working examples
3. COMMON_PITFALLS - Learn what to avoid

### Intermediate
1. PROPERTY_VIEWMODEL_GUIDE - Master property handling
2. FRAMEWORK_GUIDE - Understand MVVM architecture
3. PHOENIX_UI_LIBRARY - Explore available components

### Advanced
1. ENTITY_ARCHITECTURE - Deep dive into data layer
2. MODEL_GENERATION_GUIDE - Modify core data models
3. All _REFERENCE docs - Master the framework

## 🔍 Need Help?

- **Quick commands?** → See `_QUICK_REF.md` in repo root
- **AI guidance?** → See `CLAUDE.md` in repo root
- **Can't find something?** → Check the folder that matches your task complexity:
  - Simple/daily tasks → _DAILY/
  - Architecture questions → _ARCHITECTURE/
  - Specific lookups → _REFERENCE/

Remember: The enhanced cookbook patterns in _DAILY/ provide complete, working examples that demonstrate multiple concepts together - start there for most tasks!
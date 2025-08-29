# Quick Reference Index

## 🚨 Most Used Commands

### Build & Error Management
```bash
# Count all TypeScript errors
./tools/build-helpers/count-build-errors.sh

# Show first N errors (cleaned format)
./tools/build-helpers/show-build-errors.sh 10

# Show errors matching pattern
./tools/build-helpers/show-build-errors.sh 15 "grid"

# Quick test check (returns 0 for success, 1 for failure)
./tools/build-helpers/check-test-success.sh

# Count test failures
./tools/build-helpers/count-test-errors.sh

# Show test failure details
./tools/build-helpers/show-test-errors.sh 10
```

### Core Development Commands
```bash
# Generate models after changes
npm run generate-model

# Standard verification workflow (run in order)
npm test
npm run lint
npm run build

# Development server (usually already running)
npm run dev
```

## 📁 Critical Paths

### Model Layer (Source of Truth)
```
/model/*.model/src/              # ✅ EDIT HERE for model changes
└── Run: npm run generate-model  # After any changes
```

### Generated Code (Never Edit)
```
client/libs/*/model/              # ❌ NEVER EDIT - auto-generated
```

### Component Organization
```
{lib}.core/src/lib/
├── viewModels/                   # Entity ViewModels
├── adapters/                     # Label converters, UI enums
└── services/                     # Service implementations

{lib}.components/src/lib/
├── {feature}/                    # Feature components
│   ├── FeatureView.tsx          # React component
│   └── FeatureViewModel.ts      # UI ViewModel (co-located)
└── panels/                       # Panel components
```

## 🔧 Common Error → Fix Mappings

| Error | Likely Fix |
|-------|------------|
| "Cannot find module" | Check imports, verify path, run build |
| "Property does not exist" | Model might need regeneration: `npm run generate-model` |
| Grid reference errors | Get fresh layout references after operations |
| "vi.Mock not found" | Use `ReturnType<typeof vi.fn>` instead |
| Numeric default issues | Use `??` not `||` for number defaults |
| "bad interpreter" error | Fix line endings: `sed -i 's/\r$//' ./script.sh` |
| Test container issues | Set both `offsetWidth/Height` AND `clientWidth/Height` |
| "makeObservable not called" | Add `makeObservable(this)` in constructor |

## 🎯 When to Read What

### Task → Documentation Map

| Task | Primary Doc | Backup/Related |
|------|------------|----------------|
| **New Component** | `COOKBOOK_PATTERNS.md` | `PHOENIX_UI_LIBRARY.md` |
| **Fix Bug** | `COMMON_PITFALLS.md` | `_START_HERE.md` |
| **Model Changes** | `MODEL_GENERATION_GUIDE.md` | `ENTITY_ARCHITECTURE.md` |
| **Property Values** | `PROPERTY_VIEWMODEL_GUIDE.md` | `COMMON_PITFALLS.md` |
| **Styling** | `THEMING_GUIDE.md` | `CSS_GUIDANCE.md` |
| **Panel/Grid** | `DISPLAY_REGISTRATION_GUIDE.md` | `COOKBOOK_PATTERNS.md` |
| **Configuration** | `CONFIGURATION_GUIDE.md` | - |

## 💡 Property ViewModel Quick Reference

| Method | Use Case | Returns |
|--------|----------|---------|
| `value()` | **ValueProperty only** | Raw value |
| `actual()` | Business logic, computations | Current server state |
| `commanded()` | Show pending changes | Desired state (not yet applied) |
| `localOrCommanded()` | **Form inputs** | Commanded if set, else actual |
| `actualFormatted()` | Display text | Formatted string with units |

### Form Binding Pattern (Most Common)
```tsx
<TextInput
    value={viewModel.nameVM.localOrCommanded()}
    onChange={(v) => viewModel.nameVM.onCommandedUpdate(v)}
/>
```

## 🔄 MobX Patterns

### Always Include in Constructor
```typescript
constructor(services: IFrameworkServices) {
    super(services);
    makeObservable(this);  // ← CRITICAL: Enables reactivity
}
```

### Observable Collections
```typescript
// ✅ Correct - Replace entire array
@action updateItems(newItems: Item[]) {
    this.items = [...newItems];
}

// ❌ Wrong - Won't trigger updates
this.items.push(newItem);
```

## 🏗️ Architecture Quick Reference

### Base Classes
| Use Case | Base Class |
|----------|------------|
| UI/View logic | `BaseViewModel` |
| Entity wrapper | `BaseEntityViewModel<T>` |
| Collection management | `BaseCollectionViewModel<T>` |
| Simple state | Plain class with MobX |

### Service Access
```typescript
// In any ViewModel
this.services.get<IMapService>(IMapService.id);
this.services.logging.info("Message");
this.services.eventBus.publish(event);
```

## 🎨 Theming Colors

### Radix Color System (Use Global Variables)
```css
/* Background colors */
var(--neutral1)    /* Main app background */
var(--neutral2)    /* Subtle background */
var(--neutral3)    /* Component backgrounds */

/* Borders and UI elements */
var(--neutral4)    /* Borders */
var(--neutral5)    /* Subtle borders */
var(--neutral6)    /* Hover states */

/* Active states and accents */
var(--accent9)     /* Primary actions, solid backgrounds */
var(--accent10)    /* Hover on primary */
var(--accent11)    /* Interactive text/icons */

/* Text colors */
var(--neutral11)   /* Secondary text */
var(--neutral12)   /* Primary text */

/* Semantic colors */
var(--app-red11)   /* Errors/warnings */
```

## 📝 NOTE-AI Comment Template

```typescript
// NOTE-AI: [Decision/Pattern Name]
// - Rationale: [Why this approach]
// - Alternatives: [What else was considered]
// - Constraints: [Limitations]
// - Revisit if: [Conditions for change]
```

## 🚀 Component Creation Checklist

### For New Features (Most Common)
1. Create ViewModel extending `BaseViewModel` (for UI logic)
2. Add `@observable` state and `@action` methods
3. Call `makeObservable(this)` in constructor
4. Create React component with `observer()`
5. Register display with `registerDisplayInfo` if needed
6. Add to barrel exports (index.ts)

### For Entity Management
1. Use existing entity (e.g., Platform, Team) from model
2. Create EntityViewModel extending `BaseEntityViewModel<T>`
3. Add property ViewModels for each field
4. Create collection management in parent ViewModel
5. Create observer React components

## 🔍 Debug Helpers

```typescript
// Temporary debug logging (prefix with ----)
console.log('---- Debug:', variable);

// MobX state inspection
import { toJS } from 'mobx';
console.log('---- State:', toJS(observableObject));

// Track re-renders
console.log('---- Render:', componentName, Date.now());
```
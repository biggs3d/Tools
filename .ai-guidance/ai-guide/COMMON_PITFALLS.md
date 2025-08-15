# Common Pitfalls

This document highlights common mistakes and misunderstandings when working with the Phoenix framework. Learning from these pitfalls will save you time and frustration.

## Table of Contents

1. [Property ViewModel Method Confusion](#property-viewmodel-method-confusion)
2. [MobX Reactivity Issues](#mobx-reactivity-issues)
3. [Base Class Selection](#base-class-selection)
4. [Async Operations](#async-operations)
5. [Entity and ViewModel Lifecycle](#entity-and-viewmodel-lifecycle)
6. [Form Binding Mistakes](#form-binding-mistakes)
7. [Collection Management](#collection-management)
8. [Memory Leaks](#memory-leaks)
9. [Model Package Imports](#model-package-imports)

## Property ViewModel Method Confusion

For a detailed explanation of each method and its use case, see the [Property ViewModel Guide](PROPERTY_VIEWMODEL_GUIDE.md#reading-values---when-to-use-which-method).

### ❌ Common Mistake: Using Wrong Methods

```typescript
// WRONG: Using value() for CommandedProperty
const speed = platform.speedVM.value(); // ❌ value() is for ValueProperty only

// WRONG: Using actual() for form inputs
<TextInput
    value={viewModel.nameVM.actual()} // ❌ Shows old value, ignores user input
    onChange={(v) => viewModel.nameVM.onCommandedUpdate(v)}
/>

// WRONG: Using commanded() for business logic
if (platform.speedVM.commanded() > 200) { // ❌ May not reflect actual state
    enableHighSpeedMode();
}
```

### ✅ Correct Usage

```typescript
// For CommandedProperty - use actual() for current state
const speed = platform.speedVM.actual(); // ✅

// For form inputs - use localOrCommanded()
<TextInput
    value={viewModel.nameVM.localOrCommanded()} // ✅ Shows pending changes
    onChange={(v) => viewModel.nameVM.onCommandedUpdate(v)}
/>

// For business logic - use actual()
if (platform.speedVM.actual() > 200) { // ✅ Uses real state
    enableHighSpeedMode();
}

// For display only - use actualFormatted()
<span>{platform.speedVM.actualFormatted()}</span> // ✅ "250 mph"
```

### Quick Reference

| Method | Use For | Returns |
|--------|---------|---------|
| `value()` | ValueProperty only | Raw value |
| `actual()` | Business logic, computations | Current server state |
| `commanded()` | Showing pending changes | Desired state |
| `localOrCommanded()` | Form inputs | Commanded if set, else actual |
| `actualFormatted()` | Display text | Formatted string |

## MobX Reactivity Issues

### ❌ Forgetting makeObservable

```typescript
// WRONG: MobX won't track changes
export class MyViewModel extends BaseViewModel {
    @observable myValue: string = '';
    
    constructor(services: IFrameworkServices) {
        super(services);
        // ❌ Forgot makeObservable(this)
    }
}
```

### ✅ Always Call makeObservable

```typescript
export class MyViewModel extends BaseViewModel {
    @observable myValue: string = '';
    
    constructor(services: IFrameworkServices) {
        super(services);
        makeObservable(this); // ✅ Essential for MobX
    }
}
```

### ❌ Forgetting observer on Components

```typescript
// WRONG: Component won't re-render on observable changes
export const MyView = (props: { viewModel: MyViewModel }) => {
    return <div>{props.viewModel.myValue}</div>;
};
```

### ✅ Always Wrap with observer

```typescript
import { observer } from 'mobx-react';

export const MyView = observer((props: { viewModel: MyViewModel }) => {
    return <div>{props.viewModel.myValue}</div>;
});
```

## Base Class Selection

### ❌ Wrong Base Class for Entity Type

```typescript
// WRONG: Using BaseEntityViewModel for geo-located entity
export class RoverViewModel extends BaseEntityViewModel<Rover> {
    // Missing geo-specific functionality like latitudeVM, longitudeVM
}

// WRONG: Using GeoEntityBaseVM for non-geo entity  
export class UserSettingsViewModel extends GeoEntityBaseVM<UserSettings> {
    // Unnecessary geo properties
}
```

### ✅ Choose Correct Base Class

```typescript
// For geo-located entities (platforms, vehicles, sensors)
export class RoverViewModel extends GeoEntityBaseVM<Rover> {
    // Automatically provides latitudeVM, longitudeVM, altitudeVM, etc.
}

// For non-geo entities
export class UserSettingsViewModel extends BaseEntityViewModel<UserSettings> {
    // Clean, without geo overhead
}

// For view-specific orchestration
export class DashboardViewModel extends BaseViewModel {
    // Manages multiple entities and UI state
}
```

## Async Operations

### ❌ Missing runInAction After await

```typescript
@action async loadData(): Promise<void> {
    this.isLoading = true; // ✅ Synchronous, tracked
    
    try {
        const data = await fetchData();
        this.data = data; // ❌ After await, not tracked!
        this.isLoading = false; // ❌ Not tracked!
    } catch (error) {
        this.error = error.message; // ❌ Not tracked!
    }
}
```

### ✅ Use runInAction After await

```typescript
@action async loadData(): Promise<void> {
    this.isLoading = true; // ✅ Before await, tracked
    
    try {
        const data = await fetchData();
        
        runInAction(() => {
            this.data = data; // ✅ Wrapped, tracked
            this.isLoading = false; // ✅ Tracked
        });
    } catch (error) {
        runInAction(() => {
            this.error = error.message; // ✅ Tracked
        });
    }
}
```

## Entity and ViewModel Lifecycle

### ❌ Creating ViewModels Incorrectly

```typescript
// WRONG: Manual instantiation without framework
const teamVM = new TeamEntityViewModel(this._services);
// Missing lifecycle management, potential memory leak

// WRONG: Not setting entity ID
const platformVM = this.createVisualPlugin('platform', 
    () => new PlatformEntityViewModel(this._services)
);
// VM created but not connected to any entity!
```

### ✅ Proper ViewModel Creation

```typescript
// For single entities - use createVisualPlugin
@computed get teamVM() {
    const vm = this.createVisualPlugin('teamVM', 
        () => new TeamEntityViewModel(this._services)
    );
    vm.setEntityId(this.selectedTeamId); // ✅ Connect to entity
    return vm;
}

// For collections - use computeItemVMsFromItems
@computed get platformVMs() {
    return this.computeItemVMsFromItems(
        'platformVMs',
        () => this._platformInteractor.getAll(),
        item => {
            const vm = new PlatformEntityViewModel(this._services);
            vm.setEntityId(item.id); // ✅ Each VM connected
            return vm;
        }
    );
}
```

## Form Binding Mistakes

### ❌ Binding to Wrong Property

```typescript
// WRONG: Two-way binding with actual()
<TextInput
    value={vm.nameVM.actual()} // ❌ Won't show user's typing
    onChange={(v) => vm.nameVM.onCommandedUpdate(v)}
/>

// WRONG: Binding enum as number in Select
<Select
    value={vm.statusVM.commanded()} // ❌ Returns number, not string
    onValueChange={(v) => vm.statusVM.onCommandedUpdate(v)}
>
    <SelectItem value={1}>Active</SelectItem> // ❌ Numeric value
</Select>
```

### ✅ Correct Form Bindings

```typescript
// For text inputs
<TextInput
    value={vm.nameVM.localOrCommanded()} // ✅ Shows pending changes
    onChange={(v) => vm.nameVM.onCommandedUpdate(v)}
/>

// For enum selects - use numeric values directly
<Select
    value={vm.statusVM.commanded()} // ✅ Returns numeric enum value
    onValueChange={(value) => vm.statusVM.onCommandedUpdate(value)} // ✅ Direct update
>
    {Object.values(StatusType)
        .filter(v => typeof v === 'number') // ✅ Filter to get only numeric values
        .map((option) => (
            <SelectItem key={option} value={option}> // ✅ Numeric value
                {StatusTypeLabel[option] ?? option.toString()}
            </SelectItem>
        ))}
</Select>
```

## Collection Management

### ❌ Filtering Enums Incorrectly

```typescript
// WRONG: Includes both string keys and numeric values
const statusOptions = Object.values(StatusType); // [0, 1, 2, "Active", "Inactive", "Pending"]

// WRONG: Not maintaining stable references
@computed get activeItems() {
    return this.items.filter(item => item.isActive)
        .map(item => ({ // ❌ Creates new object every render
            id: item.id,
            display: item.name
        }));
}
```

### ✅ Proper Collection Handling

```typescript
// Filter numeric enum values only
const statusOptions = Object.values(StatusType)
    .filter(v => typeof v === 'number') as StatusType[]; // ✅ [0, 1, 2]

// Use computeItemVMsFromItems for stable references
@computed get activeItemVMs() {
    return this.computeItemVMsFromItems(
        'activeItems',
        () => this.items.filter(item => item.isActive),
        item => {
            const vm = new ItemViewModel(this._services);
            vm.setEntityId(item.id);
            return vm;
        }
    );
}
```

## Memory Leaks

### ❌ Not Cleaning Up Resources

```typescript
// WRONG: Subscription not cleaned up
export class DataViewModel extends BaseViewModel {
    private intervalId?: number;
    
    override async start() {
        await super.start();
        // ❌ No cleanup
        this.intervalId = setInterval(() => this.refresh(), 5000);
    }
}

// WRONG: Event listeners not removed
componentDidMount() {
    window.addEventListener('resize', this.handleResize); // ❌
}
```

### ✅ Proper Cleanup

```typescript
export class DataViewModel extends BaseViewModel {
    private intervalId?: number;
    
    override async start() {
        await super.start();
        this.intervalId = setInterval(() => this.refresh(), 5000);
    }
    
    override async stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId); // ✅ Clean up
            this.intervalId = undefined;
        }
        await super.stop();
    }
}

// In React components, use cleanup
useEffect(() => {
    const handleResize = () => { /* ... */ };
    window.addEventListener('resize', handleResize);
    
    return () => {
        window.removeEventListener('resize', handleResize); // ✅ Cleanup
    };
}, []);
```

## Summary of Key Rules

1. **Always use `localOrCommanded()` for form inputs**
2. **Always use `actual()` for business logic**
3. **Always use `actualFormatted()` for display**
4. **Always call `makeObservable(this)` in ViewModels**
5. **Always wrap components with `observer`**
6. **Always use `runInAction` after `await`**
7. **Always set entity IDs on EntityViewModels**
8. **Always filter enum values for numeric types only**
9. **Always clean up resources in `stop()` method**
10. **Use `GeoEntityBaseVM` for geo-located entities only**

## Model Package Imports

### ❌ Common Mistake: Importing from Internal Paths

Generated model packages (like `@tektonux/cwmi-model`, `@tektonux/alpha-model`, etc.) have a nested `src/src/` structure internally, but you should NOT import from these internal paths.

```typescript
// WRONG: Importing from internal file paths
import { AlphaTrack } from '@tektonux/cwmi-model/src/alphaTrack';
import { TrackQualityType } from '@tektonux/cwmi-model/src/trackQualityType';
import { UnitModeType } from '@tektonux/cwmi-model/src/unitModeType';
```

This will cause TypeScript compilation errors like:
```
Cannot find module '@tektonux/cwmi-model/src/alphaTrack' or its corresponding type declarations.
```

### ✅ Correct Usage: Import from Package Root

Always import from the package root, which uses barrel exports from the package's `index.ts`:

```typescript
// CORRECT: Import from package root
import { AlphaTrack, TrackQualityType, UnitModeType } from '@tektonux/cwmi-model';

// Also correct: Separate imports from package root
import { AlphaTrack } from '@tektonux/cwmi-model';
import { TrackQualityType, UnitModeType } from '@tektonux/cwmi-model';
```

### Why This Happens

Model packages are auto-generated with this structure:
```
libs/cwmi/cwmi.model/
├── src/
│   ├── index.ts      # Barrel exports: export * from "./src/alphaTrack"
│   └── src/          # Actual model files
│       ├── alphaTrack.ts
│       ├── trackQualityType.ts
│       └── unitModeType.ts
```

The package's `index.ts` re-exports everything, so you should always import from the package root (`@tektonux/cwmi-model`) rather than trying to access the internal file structure.

Following these guidelines will help you avoid the most common pitfalls and write more robust, maintainable code in the Phoenix framework.
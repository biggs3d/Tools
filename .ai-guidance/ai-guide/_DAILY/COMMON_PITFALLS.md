# Common Pitfalls

This document highlights mistakes that aren't obvious from the examples. For property ViewModel basics and MobX essentials, see `_QUICK_REF.md`.

## Table of Contents

1. [Async Operations & runInAction](#async-operations--runinaction)
2. [Entity and ViewModel Lifecycle](#entity-and-viewmodel-lifecycle)
3. [Memory Leaks](#memory-leaks)
4. [Model Package Imports](#model-package-imports)
5. [Collection Update Patterns](#collection-update-patterns)
6. [Grid Reference Gotchas](#grid-reference-gotchas)

## Async Operations & runInAction

### ❌ State Updates After Await Without runInAction

```typescript
// WRONG - MobX won't track these updates
@action async fetchData(): Promise<void> {
    this.isLoading = true;  // ✅ This works (before await)
    
    const data = await api.getData();
    
    this.data = data;        // ❌ Not tracked by MobX
    this.isLoading = false;  // ❌ Not tracked by MobX
}
```

### ✅ Correct Pattern

```typescript
@action async fetchData(): Promise<void> {
    this.isLoading = true;  // Before await is fine
    
    try {
        const data = await api.getData();
        
        runInAction(() => {
            this.data = data;        // ✅ Wrapped in runInAction
            this.isLoading = false;  // ✅ Wrapped in runInAction
        });
    } catch (error) {
        runInAction(() => {
            this.error = error.message;
            this.isLoading = false;
        });
    }
}
```

## Entity and ViewModel Lifecycle

### ❌ Creating ViewModels in Render

```typescript
// WRONG - Creates new VM on every render
const MyComponent = observer(() => {
    const vm = new ItemViewModel(services);  // ❌ New instance each render
    return <div>{vm.title}</div>;
});
```

### ✅ Use useMemo or computeItemVMs

```typescript
// For single VMs
const MyComponent = observer(() => {
    const vm = React.useMemo(
        () => new ItemViewModel(services),
        []  // Dependencies
    );
    return <div>{vm.title}</div>;
});

// For collections in parent VM
@computed get itemVMs(): Record<string, ItemViewModel> {
    return this.computeItemVMsFromItems(
        'itemVMs',  // Cache key
        () => this._interactor.getAll(),
        item => {
            const vm = new ItemViewModel(this._services);
            vm.setEntityId(item.id);
            return vm;
        }
    );
}
```

## Memory Leaks

### ❌ Subscriptions Without Cleanup

```typescript
// WRONG - No cleanup
constructor(services: IFrameworkServices) {
    super(services);
    
    // This subscription leaks
    this.services.eventBus.subscribe('event', this.handleEvent);
}
```

### ✅ Use addDisposer

```typescript
constructor(services: IFrameworkServices) {
    super(services);
    
    // Automatically cleaned up on dispose
    this.addDisposer(
        this.services.eventBus.subscribe('event', this.handleEvent)
    );
    
    // For reactions
    this.addDisposer(
        reaction(
            () => this.selectedId,
            id => this.loadDetails(id)
        )
    );
}
```

## Model Package Imports

### ❌ Importing from Generated Folders

```typescript
// WRONG - Never import from generated model folders
import { Platform } from '@tektonux/cwmi-core/lib/models/platform';  // ❌
import { Team } from 'client/libs/phoenix/phoenix.model/src';        // ❌
```

### ✅ Import from Package Root

```typescript
// CORRECT - Import from package root
import { Platform, Team } from '@tektonux/phoenix-model';  // ✅
import { AlphaTrack } from '@tektonux/cwmi-model';        // ✅
```

## Collection Update Patterns

### ❌ Mutating Arrays Directly

```typescript
// WRONG - MobX won't detect the change
@observable items: Item[] = [];

@action addItem(item: Item): void {
    this.items.push(item);  // ❌ Mutation not detected
}

@action removeItem(index: number): void {
    this.items.splice(index, 1);  // ❌ Mutation not detected
}
```

### ✅ Replace the Array

```typescript
@observable items: Item[] = [];

@action addItem(item: Item): void {
    this.items = [...this.items, item];  // ✅ New array
}

@action removeItem(index: number): void {
    this.items = this.items.filter((_, i) => i !== index);  // ✅ New array
}

@action updateItems(newItems: Item[]): void {
    this.items = [...newItems];  // ✅ New array
}
```

## Grid Reference Gotchas

### ❌ Using Stale References After Grid Operations

```typescript
// WRONG - Using reference from before operation
const oldLayout = gridVM.currentLayout;
await gridVM.consolidatePanels();
const panelCount = oldLayout.panels.length;  // ❌ Stale reference
```

### ✅ Get Fresh References

```typescript
// CORRECT - Get fresh reference after operation
await gridVM.consolidatePanels();
const currentLayout = gridVM.currentLayout;  // ✅ Fresh reference
const panelCount = currentLayout.panels.length;
```

## Testing Pitfalls

### ❌ Incomplete Mock Containers

```typescript
// WRONG - Missing client dimensions
const container = document.createElement('div');
container.style.width = '800px';   // ❌ Only sets style
container.style.height = '600px';  // ❌ Not actual dimensions
```

### ✅ Set Both Offset and Client Dimensions

```typescript
// CORRECT - Set all dimension properties
const container = document.createElement('div');
Object.defineProperties(container, {
    offsetWidth: { value: 800, writable: true },
    offsetHeight: { value: 600, writable: true },
    clientWidth: { value: 800, writable: true },
    clientHeight: { value: 600, writable: true }
});
```

## TypeScript Mock Types

### ❌ Using vi.Mock

```typescript
// WRONG - vi.Mock is not exported as a type
let mockFn: vi.Mock;  // ❌ Type error
```

### ✅ Use ReturnType

```typescript
// CORRECT - Use ReturnType pattern
let mockFn: ReturnType<typeof vi.fn>;  // ✅ Basic mock

// With types
let mockTyped: ReturnType<typeof vi.fn<[string, number], boolean>>;  // ✅ Typed mock
```

## Key Takeaways

1. **Always use `runInAction` after `await`** in async actions
2. **Replace arrays, don't mutate them** for MobX reactivity
3. **Use `addDisposer`** for all subscriptions and reactions
4. **Import models from package root**, never from generated folders
5. **Get fresh references** after grid/layout operations
6. **Set all dimension properties** when mocking DOM elements

For more patterns and examples, check `COOKBOOK_PATTERNS_ENHANCED.md` in this folder.
# Framework Architecture Guide

This document explains the core architecture concepts. For practical examples, see `COOKBOOK_PATTERNS_ENHANCED.md` in the _DAILY folder.

## MVVM Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                    View (React)                  │
│  - React components with observer()              │
│  - Renders UI based on ViewModel state          │
│  - Delegates all logic to ViewModel             │
└────────────────────┬────────────────────────────┘
                     │ observes
┌────────────────────▼────────────────────────────┐
│              ViewModel (MobX)                    │
│  - UI state and business logic                  │
│  - @observable, @computed, @action              │
│  - Orchestrates entities and services           │
└────────────────────┬────────────────────────────┘
                     │ wraps
┌────────────────────▼────────────────────────────┐
│            Model (Entity/Data)                   │
│  - Pure data structures                         │
│  - ValueProperty, CommandedProperty             │
│  - Generated from model definitions             │
└──────────────────────────────────────────────────┘
```

## Key Concepts

### Services (Dependency Injection)
- **IFrameworkServices**: Container for all services
- **Access pattern**: `this.services.get<IServiceType>(ServiceId)`
- **Common services**: Logging, EventBus, Entity Interactors
- **Lifecycle**: Services are singletons, shared across ViewModels

### Entity System
- **IEntity**: Base interface for all data models
- **Entity Interactor**: CRUD operations for entities
- **Property Types**:
  - `ValueProperty<T>`: Read-only values
  - `CommandedProperty<T>`: Values with commanded/actual states
  - `RangedProperty<T>`: Numeric values with min/max

### ViewModel Types

#### Entity ViewModels
- **Purpose**: Wrap entities with UI functionality
- **Base class**: `BaseEntityViewModel<TEntity>`
- **Features**: Property ViewModels, validation, formatting
- **Location**: `{lib}.core/src/lib/viewModels/`

#### View-Specific ViewModels
- **Purpose**: Manage UI state and orchestration
- **Base class**: `BaseViewModel`
- **Features**: Collections, UI state, business logic
- **Location**: Co-located with View components

### MobX Integration
- **Reactivity**: Automatic UI updates via observer pattern
- **State management**: @observable, @computed, @action
- **Best practice**: Always call `makeObservable(this)` in constructor

## Data Flow

### Read Flow
1. **Entity** has data in properties
2. **EntityViewModel** wraps entity, creates property VMs
3. **View ViewModel** orchestrates entity VMs
4. **View** observes and renders

### Write Flow
1. **User interaction** in View
2. **View** calls ViewModel action
3. **ViewModel** updates property via `onCommandedUpdate()`
4. **Property** sends update to server
5. **Server** confirms, updates actual value
6. **MobX** triggers re-render

## Component Lifecycle

### ViewModel Creation
```
1. Parent creates child VM (usually in @computed getter)
2. Child VM constructor:
   - Calls super(services)
   - Sets up observables
   - Calls makeObservable(this)
   - Adds disposers for subscriptions
```

### ViewModel Disposal
```
1. Parent removes reference
2. Framework calls dispose()
3. Disposers clean up subscriptions
4. Garbage collection
```

## Plugin System

### Visual Plugins
- **Purpose**: Lazy creation of child ViewModels
- **Method**: `createVisualPlugin(key, factory)`
- **Benefit**: Only creates when accessed

### Collection Management
- **Method**: `computeItemVMsFromItems(key, items, factory)`
- **Purpose**: Efficient collection VM management
- **Caching**: Reuses VMs for same entity IDs

## Performance Considerations

### Computed Values
- **Memoized**: Only recalculate when dependencies change
- **Lazy**: Only calculate when accessed
- **Use for**: Derived state, filtered collections

### Reactions vs Autorun
- **reaction**: Runs when specific value changes
- **autorun**: Runs when any observable changes
- **when**: One-time reaction to condition

### Collection Updates
- **Replace arrays**: Don't mutate
- **Batch updates**: Use `runInAction` for multiple changes
- **Virtualization**: Consider for large lists (1000+ items)

## Framework Services

### Core Services
- **Logging**: `services.logging.info/warn/error`
- **EventBus**: Pub/sub for decoupled communication
- **Entity Interactors**: CRUD operations
- **Configuration**: Runtime config management

### Service Registration
- Services registered at app startup
- Accessed via dependency injection
- Singleton pattern for shared state

## Testing Considerations

### ViewModel Testing
- Create with mock services
- Test state changes via actions
- Verify computed values update
- Check disposal cleanup

### View Testing
- Provide mock ViewModel
- Test user interactions
- Verify correct VM methods called
- Check conditional rendering

## Best Practices Summary

1. **Separation of Concerns**: Views render, ViewModels logic, Models data
2. **Composition over Inheritance**: Use plugins and composition
3. **Lazy Creation**: Create VMs only when needed
4. **Proper Disposal**: Always clean up subscriptions
5. **Type Safety**: Leverage TypeScript throughout

For implementation examples of all these concepts, see `COOKBOOK_PATTERNS_ENHANCED.md` which provides complete, working code you can copy and adapt.
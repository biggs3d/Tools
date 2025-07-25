# Framework Guide

This document provides a comprehensive overview of the application framework architecture and patterns used in this project. It serves as a reference for understanding and implementing new components.

## Table of Contents

1.  [Architecture Overview](#architecture-overview)
    *   [MVVM (Model-View-ViewModel) Pattern](#mvvm-model-view-viewmodel-pattern)
    *   [Data Flow and Responsibilities](#data-flow-and-responsibilities)
2.  [Key Concepts](#key-concepts)
    *   [Services](#services)
    *   [Data Models & Entities](#data-models--entities)
    *   [ViewModels](#viewmodels)
        *   [EntityViewModels](#entity-viewmodels-conceptual)
        *   [View-Specific ViewModels](#view-specific-viewmodels)
    *   [Views](#views)
3.  [State Management with MobX](#state-management-with-mobx)
4.  [Entity Architecture Deep Dive](#entity-architecture-deep-dive)
5.  [Common Patterns](#common-patterns)
    *   [Creating ViewModels](#creating-viewmodels)
    *   [Composition with Plugin System](#composition-with-plugin-system)
    *   [Property ViewModels (in EntityViewModels)](#property-viewmodels-in-entityviewmodels)
6.  [Development Workflow](#development-workflow)
7.  [Code Examples](#code-examples)
8.  [Best Practices & Key Principles](#best-practices--key-principles)

## Architecture Overview

The application follows an **MVVM (Model-View-ViewModel)** like pattern, promoting a strong separation of concerns. This architecture, combined with MobX for state management and TypeScript for type safety, forms the backbone of our framework. The key elements include:

-   **Data Models**: Pure representations of domain data.
-   **Entities**: Data Models that conform to the `IEntity` interface for framework management.
-   **EntityViewModels**: Wrappers around Data Models/Entities, adapting them for UI interaction.
-   **View-Specific ViewModels**: Manage state and logic for particular UI views or components.
-   **Views**: React components responsible for rendering UI based on ViewModel state.
-   **Services**: Core application functionalities provided via dependency injection.

The framework emphasizes composition over inheritance and leverages a plugin system for building complex UIs from smaller, manageable parts.

### MVVM (Model-View-ViewModel) Pattern

Our interpretation of MVVM involves these primary roles:

*   **Model (Data Models & Entities):**
    *   Represent the application's data and business logic (though much of the interactive logic is delegated to ViewModels).
    *   Data Models are often plain TypeScript objects/classes or structures defined in shared model libraries (e.g., `@tektonux/uvc-model`, `@tektonux/phoenix-model`).
    *   Entities are Data Models that are integrated with the framework's entity management system, typically by conforming to the `IEntity` interface.

*   **ViewModel (EntityViewModels & View-Specific ViewModels):**
    *   Acts as an intermediary between the Model and the View.
    *   **EntityViewModels** wrap specific Data Models/Entities, exposing their properties through specialized property ViewModels (e.g., `CommandedEnumViewModel`, `RangedNumberViewModel`). They handle formatting, validation, and interaction logic for individual entity properties.
    *   **View-Specific ViewModels** manage the state, presentation logic, and user interaction orchestration for a particular UI View or a significant, self-contained component. They consume EntityViewModels, services, or other ViewModels.
    *   ViewModels use MobX (`@observable`, `@action`, `@computed`) for reactive state management.

*   **View (React Components):**
    *   Represents the UI.
    *   Observes changes in its corresponding ViewModel (typically a View-Specific ViewModel) using `mobx-react`'s `observer` HOC.
    *   Renders data exposed by the ViewModel.
    *   Delegates user interactions (e.g., button clicks, input changes) to action methods on the ViewModel.
    *   Should be as "dumb" as possible, with presentation logic kept to a minimum.

### Data Flow and Responsibilities

Understanding the flow of data and the division of responsibilities is key:

1.  **Data Models/Entities:**
    *   Define the fundamental data structures and their types (e.g., `ValueProperty<string>`, `RangedCommandedProperty<number>`).
    *   Represent the "source of truth" for domain data, often mirroring backend schemas.

2.  **EntityViewModels:**
    *   Adapt individual Data Models/Entities for UI consumption, property by property.
    *   Provide specialized ViewModels for each property (e.g., `get nameVM()`, `get powerLevelVM()`) using `this.createPropertyVM(...)`.
    *   These property ViewModels handle:
        *   Formatting data for display (e.g., using `labelConverter` for enums, number formatting).
        *   Managing commanded properties (actual vs. commanded values).
        *   Input validation or range constraints.
        *   Exposing interaction methods like `onCommandedUpdate()`.
    *   They do *not* duplicate the data fields from the Data Model but provide a reactive and interactive layer over them.

3.  **View-Specific ViewModels:**
    *   Orchestrate the UI logic for a specific screen, modal, or complex component.
    *   Manage local UI state (e.g., visibility of a panel, current form input values not directly part of an entity, loading states).
    *   Consume one or more EntityViewModels to access and manipulate entity data.
    *   Interact with services for operations like fetching data, saving changes, or navigation.
    *   Prepare and expose data (often through `@computed` properties) in a format that the View can easily render.

4.  **Views (React Components):**
    *   Render the state exposed by their corresponding View-Specific ViewModel.
    *   Channel user inputs and events back to the ViewModel's action methods.
    *   Utilize shared UI components from libraries like `@tektonux/phoenix-components-shared`.

## Key Concepts

### Services

Services provide core application functionalities and are accessed via an `IFrameworkServices` interface, typically injected into ViewModel constructors.
-   **Dependency Injection**: Services are resolved using `this.getSharedPlugin()` or `this.getSharedEntityInteractor()`.
-   **Plugin Management**: The framework often uses a plugin system for managing different parts of the application.
-   **Entity Interaction**: Services like `IEntityInteractor` are used to fetch, add, update, or delete entities.

```typescript
// Example from a ViewModel constructor
constructor(services: IFrameworkServices) {
    super(services);
    // Resolving a shared plugin (like a store)
    this._hudStore = this.getSharedPlugin(HudStore.class, HudStore);
    // Resolving an interactor for a specific entity type
    this._teamInteractor = this.getSharedEntityInteractor(Team.class, Team);
}
```

### Data Models & Entities

-   **Data Models**: As described above, these are the TypeScript definitions of your application's data (e.g., `Rover`, `DiscoverySettings`). They define properties often using types like `ValueProperty<T>`, `CommandedProperty<T>`, `RangedProperty<T>` from `@tektonux/model.core`.
-   **Entities**: Data Models that are managed by the framework's entity system. They conform to the `IEntity` interface:
    ```typescript
    interface IEntity {
        id: string;
        className: string; // Static identifier for the entity type
        timestamp?: number;
        associatedEntities?: Record<string, string[]>;
    }
    ```
    Entities are the fundamental units of data that EntityViewModels wrap and manage.

### ViewModels

ViewModels are the cornerstone of UI logic and state management in the framework. They are observable state containers that expose properties and actions to Views.

#### EntityViewModels (Conceptual)
-   **Purpose**: To wrap a single Data Model/Entity instance and make its properties observable and interactive for the UI.
-   **Structure**: Extend a base like `BaseEntityViewModel<EntityType>` or `GeoEntityBaseVM<EntityType>`.
-   **Key Feature**: Provide getter methods for each relevant entity property, returning specialized property ViewModels (e.g., `CommandedEnumViewModel`, `RangedNumberViewModel`). These are created using `this.createPropertyVM('propertyName', SpecializedViewModelConstructor)`.
-   **Responsibilities**: Data formatting, validation for individual properties, handling commanded values.
-   *For a detailed explanation, see the [ENTITY_ARCHITECTURE.md](ENTITY_ARCHITECTURE.md) document.*

#### View-Specific ViewModels
-   **Purpose**: To manage the state, logic, and behavior for a particular UI View, screen, or a significant, self-contained component.
-   **Structure**: Typically extend a common base like `BaseViewModel`.
-   **Responsibilities**:
    -   Orchestrate application logic, which may involve interacting with services, other ViewModels (parent/child), or configuration objects.
    -   Manage local UI state (e.g., visibility of a panel, current input values, loading indicators).
    -   Instantiate or receive instances of EntityViewModels it needs to display/edit entity data.
    -   Prepare and expose data (often through `@computed` properties) in a format that the View can easily consume.
    -   Define `@action` methods to handle user interactions initiated from the View.

### Views
-   **Purpose**: Purely presentational React components.
-   **Structure**: Typically functional components using hooks, wrapped with `observer` from `mobx-react`.
-   **Responsibilities**:
    -   Render the UI based on state provided by their corresponding View-Specific ViewModel.
    -   Delegate user interactions to action methods on the ViewModel.
    -   Utilize shared UI components.

Example of View-ViewModel interaction:
```typescript
// View-Specific ViewModel (e.g., TeamSettingsViewModel.ts)
export class TeamSettingsViewModel extends BaseViewModel {
    @observable teamNameInput: string = '';
    private _teamEntityVM: TeamEntityViewModel; // Assuming it holds an EntityVM

    constructor(services: IFrameworkServices, teamId: string) {
        super(services);
        this._teamEntityVM = this.createVisualPlugin('teamEntityVM', () => new TeamEntityViewModel(this._services));
        this._teamEntityVM.setEntityId(teamId);
        makeObservable(this);
    }

    @computed get currentTeamName(): string {
        return this._teamEntityVM.nameVM.actualFormatted(); // Accessing property via EntityVM's property VM
    }
    
    @action setTeamNameInput(name: string): void {
        this.teamNameInput = name;
    }

    @action async saveTeamName(): Promise<void> {
        if (this.teamNameInput) {
            await this._teamEntityVM.nameVM.onCommandedUpdate(this.teamNameInput);
            this.teamNameInput = ''; // Clear input after save
        }
    }
}

// View (e.g., TeamSettingsView.tsx)
export const TeamSettingsView = observer((props: { viewModel: TeamSettingsViewModel }) => {
    const { viewModel } = props;
    
    return (
        <div>
            <p>Current Name: {viewModel.currentTeamName}</p>
            <input 
                value={viewModel.teamNameInput} 
                onChange={e => viewModel.setTeamNameInput(e.target.value)} 
            />
            <button onClick={() => viewModel.saveTeamName()}>Save</button>
        </div>
    );
});
```

## State Management with MobX

MobX is integral to the framework for managing reactive state within ViewModels.

-   **`@observable`**: Marks properties within a ViewModel whose changes should be tracked by MobX. When these properties change, any `observer` components or `@computed` properties that depend on them will automatically update.
    ```typescript
    @observable isActive: boolean = false;
    @observable items: Map<string, ItemType> = new Map();
    ```

-   **`@action`**: Marks methods that modify observable state. Grouping state modifications within actions is good practice and can improve performance, as MobX can batch updates.
    ```typescript
    @action toggleActive(): void {
        this.isActive = !this.isActive;
    }
    @action addItem(item: ItemType): void {
        this.items.set(item.id, item);
    }
    ```

-   **`@computed`**: Marks getter functions that derive their value from other observable or computed properties. Computed values are memoized; they only re-evaluate if one of their underlying dependencies changes. This is crucial for performance.
    ```typescript
    @computed get activeItemCount(): number {
        return Array.from(this.items.values()).filter(item => item.isActive).length;
    }
    ```

-   **`makeObservable(this)`**: This must be called in the constructor of any ViewModel that uses MobX decorators (`@observable`, `@action`, `@computed`) to initialize MobX's reactivity for that instance.
    ```typescript
    constructor(services: IFrameworkServices) {
        super(services);
        makeObservable(this); // Essential for MobX to work
    }
    ```

-   **`observer` HOC (Higher-Order Component)**: React components that need to react to changes in MobX observable state (from ViewModels) must be wrapped with the `observer` HOC from the `mobx-react` or `mobx-react-lite` library.
    ```tsx
    import { observer } from 'mobx-react';
    
    export const MyReactiveComponent = observer((props: MyProps) => {
        // ... component logic using props.viewModel.observableProperty ...
    });
    ```

This combination allows for a declarative and efficient way to manage UI state, where changes in data automatically propagate to the relevant parts of the UI.

### Working with Async Operations and runInAction

When working with asynchronous operations in MobX, state modifications that occur after `await` statements should be wrapped in `runInAction` to ensure they are properly tracked:

```typescript
import { action, runInAction } from 'mobx';

export class DataViewModel extends BaseViewModel {
    @observable data: DataItem[] = [];
    @observable isLoading: boolean = false;
    @observable error: string | null = null;
    
    @action async loadData(): Promise<void> {
        this.isLoading = true; // This is in the initial synchronous part, so it's tracked
        this.error = null;
        
        try {
            const response = await fetchDataFromAPI(); // Async operation
            
            // After await, we need runInAction for state modifications
            runInAction(() => {
                this.data = response.items;
                this.isLoading = false;
            });
        } catch (error) {
            runInAction(() => {
                this.error = error.message;
                this.isLoading = false;
            });
        }
    }
    
    // Alternative pattern using multiple awaits
    @action async updateMultipleEntities(): Promise<void> {
        const teamVM = this.teamVMs['team1'];
        const platformVM = this.platformVMs['platform1'];
        
        // When updating multiple entities with await
        await teamVM.nameVM.onCommandedUpdate('New Team Name');
        
        // Use runInAction for subsequent state updates
        await runInAction(async () => {
            await platformVM.teamId.onUpdate(teamVM.id);
            this.selectedTeamId = teamVM.id;
        });
    }
}
```

**When to use runInAction:**
- After `await` statements when modifying observable state
- When you need to batch multiple state updates together
- In callbacks or promises where the action decorator doesn't automatically apply

**Note:** MobX 6+ is more forgiving with async actions, but using `runInAction` is still a best practice for clarity and ensuring all state modifications are properly tracked.

## Entity Architecture Deep Dive

For a detailed explanation of how Data Models, Entities (`IEntity`), and EntityViewModels work together, including how EntityViewModels wrap Data Models and provide specialized property ViewModels, please refer to the [ENTITY_ARCHITECTURE.md](ENTITY_ARCHITECTURE.md) document.

## Common Patterns

### 1. Creating ViewModels

ViewModels generally:
- Extend a base class (e.g., `BaseViewModel`, `ViewModel`, `BaseEntityViewModel`).
- Receive `IFrameworkServices` in their constructor for dependency resolution.
- Call `makeObservable(this)` in their constructor.
- Expose state via `@observable` properties.
- Expose derived data via `@computed` properties.
- Expose methods to modify state or perform logic as `@action`s.

```typescript
// Example of a View-Specific ViewModel
export class DiscoverySettingsViewModel extends BaseViewModel {
    @observable isPanelVisible: boolean = false;
    private _config: SomeConfigObject; // Could be another VM or a plain object

    constructor(services: IFrameworkServices, parentViewModel: TeamSettingsModalViewModel) {
        super(services);
        this._parentViewModel = parentViewModel; // Example of parent-child VM relationship
        this._config = this.getSharedPlugin(ConfigStore.class, ConfigStore).discoveryConfig;
        
        makeObservable(this);
    }
    
    @computed get panelTitle(): string {
        return this._config.title + (this.isPanelVisible ? " (Open)" : " (Closed)");
    }
    
    @action togglePanelVisibility(): void {
        this.isPanelVisible = !this.isPanelVisible;
    }
}
```

### 2. Composition with Plugin System

The framework often uses a plugin system for composition, allowing ViewModels to create and manage child ViewModels or other components. `createVisualPlugin` is a common method for this.

```typescript
// In a ParentViewModel
@computed get entityIconVM(): EntityIconViewModel {
    // 'entityIconVM' is a unique key for this plugin instance within the parent
    const vm = this.createVisualPlugin('entityIconVM', () => new EntityIconViewModel(this._services));
    vm.setEntityVM(this.someEntityVM); // Configure the child VM
    return vm;
}

@computed get itemDetailVMs(): Record<string, ItemDetailViewModel> {
    return this.computeItemVMsFromItems(
        "itemDetailVMs", // Unique key for this collection
        () => this._itemInteractor.getAllActive(), // Function to get source items
        item => { // Factory function to create a VM for each item
            const vm = new ItemDetailViewModel(this._services);
            vm.setItemId(item.id);
            return vm;
        }
    );
}
```
- `createVisualPlugin`: Useful for creating single, managed child ViewModel instances.
- `computeItemVMsFromItems`: Ideal for creating and managing a collection of child ViewModels based on a list of data items, ensuring that VMs are created, updated, or removed as the source data changes.

### 3. Property ViewModels (in EntityViewModels)

As detailed in `ENTITY_ARCHITECTURE.md`, EntityViewModels expose properties of their underlying Data Model through specialized property ViewModels.

```typescript
// Inside an EntityViewModel (e.g., TargetEntityViewModel)
get priorityVM(): ICommandedVM<TargetPriorityType, IEnumFormatOptions<TargetPriorityType>> {
    // 'priority' is the name of the property on the Data Model
    const vm = this.createPropertyVM('priority', CommandedEnumViewModel<TargetPriorityType>);
    vm.configure({
        labelConverter: MarkedLocationPriorityTypeLabel, // Function to get display string for enum
        defaultValue: TargetPriorityType.NO_VALUE
    });
    return vm;
}

get altitudeVM(): ICommandedRangeVM<number, INumberFormatOptions> {
    const vm = this.createPropertyVM('altitude', RangedCommandedNumberViewModel);
    vm.configure({
        labelConverter: v => `${v} ft`, // For display
        formatter: v => v != null ? `${v} ft` : 'N/A', // For more complex formatting
        min: 0, // From Data Model's RangedProperty constraints
        max: 50000
    });
    return vm;
}
```
These property ViewModels (like `CommandedEnumViewModel`, `RangedCommandedNumberViewModel`, `StringViewModel`, etc.) handle the specifics of interacting with different types of data model properties (`CommandedProperty`, `RangedProperty`, `ValueProperty`).

### Working with Enums and Label Converters

The framework uses generated number-backed enums with string keys derived from metadata. Label converter functions transform these numeric enum values into user-friendly display strings:

```typescript
// Generated enum with metadata (e.g., from @tektonux/uvc-model)
/**
 * @description {
 *      "clazz" : {
 *         "enum": "DIRECTIONAL,OMNI,PARABOLIC,YAGI",
 *         "title": "AntennaType"
 *      }
 * }
 */
export enum AntennaType {
    DIRECTIONAL = 0,
    OMNI = 1,
    PARABOLIC = 2,
    YAGI = 3
}

// Label map for UI display (maps numeric values to display strings)
export const AntennaTypeLabel: Record<AntennaType, string> = {
    [AntennaType.DIRECTIONAL]: 'Directional',
    [AntennaType.OMNI]: 'Omni-Directional',
    [AntennaType.PARABOLIC]: 'Parabolic Dish',
    [AntennaType.YAGI]: 'Yagi'
};

// Using in EntityViewModel
export class RoverViewModel extends BaseEntityViewModel<Rover> {
    get antennaTypeVM(): ICommandedVM<AntennaType, IEnumFormatOptions<AntennaType>> {
        const vm = this.createPropertyVM('antennaType', CommandedEnumViewModel<AntennaType>);
        vm.configure({
            labelConverter: AntennaTypeLabel, // Pass the label map
            defaultValue: AntennaType.DIRECTIONAL
        });
        return vm;
    }
    
    // Helper method to get string representation
    @computed get antennaTypeString(): string {
        const value = this.antennaTypeVM.actual();
        return AntennaTypeLabel[value] ?? '---';
    }
    
    // Helper method to set from string (reverse lookup)
    @action setAntennaType(labelValue: string): void {
        // Find enum value by matching label
        const enumEntry = Object.entries(AntennaTypeLabel)
            .find(([_, label]) => label === labelValue);
        
        if (enumEntry) {
            const enumValue = Number(enumEntry[0]) as AntennaType;
            this.antennaTypeVM.onCommandedUpdate(enumValue);
        }
    }
}

// Using in View for dropdown options
export const AntennaConfigView = observer((props: { viewModel: RoverViewModel }) => {
    const { viewModel } = props;
    
    // For number-backed enums, filter to only get numeric values
    const antennaOptions = Object.values(AntennaType)
        .filter(value => typeof value === 'number') as AntennaType[];
    
    return (
        <Select
            value={viewModel.antennaTypeString}
            onValueChange={viewModel.setAntennaType}
            scale="large"
        >
            {antennaOptions.map(option => (
                <SelectItem 
                    key={option}
                    value={AntennaTypeLabel[option]}
                >
                    {AntennaTypeLabel[option]}
                </SelectItem>
            ))}
        </Select>
    );
});
```

**Key differences with number-backed enums:**
1. Enum values are numbers (0, 1, 2, etc.)
2. `Object.values(EnumType)` returns both string keys AND numeric values, so filtering is needed
3. Label maps use numeric values as keys
4. Reverse lookup (label to enum) requires finding the numeric value
5. Type casting to the enum type may be needed after numeric operations

**Best practices:**
1. Use consistent numeric sequences (0, 1, 2...) for enum values
2. Create label maps indexed by the numeric enum values
3. Provide helper methods in ViewModels for string conversion
4. Filter enum values to only get numbers when creating option lists
5. Handle edge cases (unknown values) with fallback strings like '---'

## Development Workflow

When implementing a new feature involving data display and interaction, follow this general workflow:

1.  **Define/Identify the Data Model(s):**
    *   Ensure you have clear TypeScript definitions (`.d.ts` files or classes in model libraries like `@tektonux/uvc-model` or `@tektonux/phoenix-model`) for the data you'll be working with.
    *   These models define the shape and types of properties (e.g., `ValueProperty<string>`, `RangedCommandedProperty<Integer>`).

2.  **Create/Update EntityViewModel(s):**
    *   For each Data Model involved, ensure there's an EntityViewModel that wraps it (e.g., `RoverViewModel` for `Rover` Data Model).
    *   This EntityViewModel should extend a base like `GeoEntityBaseVM<DataModelType>` or `BaseEntityViewModel<DataModelType>`.
    *   Add or update property accessor methods (e.g., `get somePropertyVM()`) that use `this.createPropertyVM('someProperty', SpecializedViewModelConstructor)` to return appropriately configured specialized ViewModels (e.g., `CommandedEnumViewModel`, `RangedCommandedNumberViewModel`).
    *   Configure these property VMs with `labelConverter`, `defaultValue`, formatters, etc.

3.  **Develop the View-Specific ViewModel:**
    *   This ViewModel will manage the state and logic for your new UI area (e.g., a modal, a settings panel, a list view).
    *   It will likely instantiate or receive instances of the EntityViewModels it needs (often using `createVisualPlugin` or by resolving them if they are shared).
    *   Define `@observable` properties for UI-specific state (e.g., `isFormVisible`, `currentFilterText`).
    *   Define `@action` methods for user interactions (e.g., `handleSaveButtonClick`, `updateFilterText`).
    *   Define `@computed` properties for derived data to be displayed by the View (e.g., `filteredItems`, `isSaveButtonEnabled`).
    *   Remember to call `makeObservable(this)` in the constructor.

4.  **Build the React View Component (`.tsx`):**
    *   Make it an `observer` by wrapping it with the `observer` HOC from `mobx-react`.
    *   It should receive its View-Specific ViewModel as a prop (or instantiate it, often via `useMemo` if its lifecycle is tied to the view, ensuring `IFrameworkServices` is available).
    *   Bind UI elements to the ViewModel's properties (for display) and actions (for event handling).
    *   Utilize shared UI components from `@tektonux/phoenix-components-shared` or other libraries.
    *   Keep the View focused on presentation; complex logic should reside in the ViewModel.

This structured approach ensures maintainability, testability, and leverages the reactive capabilities of MobX for creating dynamic and responsive user interfaces.

## Code Examples

For practical code examples illustrating these patterns, please refer to the [CODING_EXAMPLES.md](./CODING_EXAMPLES.md) document. It includes examples for:
- Basic ViewModel and View structures.
- EntityViewModel and property VM usage.
- MobX patterns (`@observable`, `@computed`, `@action`).
- Using `createVisualPlugin` and `computeItemVMsFromItems`.
- Working with entity properties and enums.

## Best Practices & Key Principles

1.  **Type Safety**:
    *   Utilize TypeScript interfaces and types rigorously.
    *   Avoid `any` where possible; define clear interfaces for props and state.

2.  **ViewModel Logic**:
    *   Keep Views simple and presentational. Move UI logic, data manipulation, and state management into ViewModels.
    *   Almost all logic that can be done without direct DOM manipulation should be in the ViewModel, not the View `.tsx` file.
    *   Use `@computed` for derived data to ensure efficient updates.
    *   Use `@action` for all methods that modify MobX observable state.
    *   Always call `makeObservable(this)` in ViewModel constructors.

3.  **Component Structure & Naming**:
    *   Organize related files (ViewModel, View, CSS) together, typically in a feature or component folder.
    *   Follow consistent naming conventions:
        *   `*View.tsx` for React View components.
        *   `*View.css` or `*Styles.ts` for styles.
        *   `*ViewModel.ts` for View-Specific ViewModels.
        *   Data model entities are usually named by their type (e.g., `Team.ts`, `Platform.d.ts`) and reside in model libraries.
        *   `*EntityViewModel.ts` for ViewModels that wrap Data Models/Entities.

4.  **Composition over Inheritance**:
    *   Favor composition for building complex UIs and ViewModels.
    *   Leverage the plugin system (`createVisualPlugin`, `computeItemVMsFromItems`) for creating and managing child ViewModels.
    *   Use base classes for genuinely shared, common functionality, but avoid deep inheritance hierarchies.

5.  **Performance**:
    *   Use `@computed` properties extensively for derived values to prevent unnecessary recalculations.
    *   Ensure `observer` components only re-render when their observed data changes.
    *   Keep components small and focused on a single responsibility.

6.  **Entity and Data Handling**:
    *   All data for display or interaction that comes from a backend entity should be accessed through an EntityViewModel, which wraps the raw Data Model.
    *   Data Models themselves typically define properties using `ValueProperty<T>`, `CommandedProperty<T>`, `RangedProperty<T>`, etc., not primitive types directly for properties managed by the framework's entity system.
    *   Do not instantiate EntityViewModels directly if they are meant to be managed by the framework's plugin system or collections; use `createVisualPlugin` or `computeItemVMsFromItems` which handle their lifecycle and service injection.

---

This guide serves as a reference for understanding and working with the application framework. Refer to specific code examples and the `ENTITY_ARCHITECTURE.md` for more detailed implementation patterns.
```

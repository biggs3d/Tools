# Entity Architecture

This document explains the entity-based architecture used in our application, focusing on the relationship between Data Models, Entities, and EntityViewModels.

## Core Data Layers

Our application architecture distinguishes between a few key layers for handling data:

1.  **Data Models (e.g., `Rover` from `Rover.d.ts`, `DiscoverySettings`):**
    *   These are the pure TypeScript representations of your data, often mirroring backend structures or defined in shared model libraries (e.g., `@tektonux/uvc-model`, `@tektonux/phoenix-model`).
    *   They define the shape, types (e.g., `TransmitterModeType`), and properties (e.g., `RangedCommandedProperty<Integer>`, `ValueProperty<TransmitterType>`) of your domain objects.
    *   Typically found in `.d.ts` files or as classes/interfaces in model packages.
    *   These models are simple data containers with minimal functionality, primarily concerned with the structure and type of data.

2.  **Entities (`IEntity` interface):**
    *   The `IEntity` interface provides a common contract for all data models that are managed by the framework's entity system.
    *   Data Models intended to be treated as framework entities will typically extend or implement aspects related to `IEntity`.

3.  **EntityViewModels (e.g., `DiscoverySettingsEntityViewModel`, `RoverViewModel`):**
    *   These are crucial wrappers around Data Models. They bridge the gap between raw data and its UI representation and interaction logic.
    *   They provide observable properties, business logic, validation, UI interaction methods, and data transformation capabilities for a specific Data Model.

## Entity Structure (`IEntity`)

The core of our managed data model is the `IEntity` interface, which all entity classes (Data Models intended for framework management) relate to:

```typescript
export interface IEntity {
    id: string;
    className: string; // Typically a static string identifier for the entity type
    timestamp?: number;
    associatedEntities?: Record<string, string[]>;
}
```
Entities (Data Models) are primarily simple data containers. They represent data that might be shared with a backend or used consistently across the application.

### Real Data Model Examples from Current Codebase

Here are actual Data Model implementations from the EXAMPLES folder:

```typescript
// Real example 1: MarshalPoint.d.ts - Simple geographic entity
import { GeoPoint } from "@tektonux/model.geospatial";

/**
 * @description {
 *      "clazz" : {
 *          "extends": ["GeoPoint"],
 *          "members": ["class"]
 *      }
 * }
 */
export declare class MarshalPoint extends GeoPoint {
    static class: string;
    constructor(id: string);
}

// Real example 2: WcaNotification.d.ts - Inheritance with additional properties
import { ValueProperty } from "@tektonux/model.core/dist";
import { WcaLevelType } from "./types/WcaLevelType";
import { UvcNotification } from "./UvcNotification";

/**
 * @description {
 *      "clazz" : {
 *          "extends" :  ["UvcNotification"],
 *          "members" :  ["class", "level"]
 *      }
 * }
 */
export declare class WcaNotification extends UvcNotification {
    static class: string;
    level?: ValueProperty<WcaLevelType>;
    constructor(id: string);
}

// Real example 3: Rover.d.ts - Complex entity with multiple property types
import { GeoEntity } from "@tektonux/model.geospatial/dist";
import { CommandedProperty, Integer, RangedCommandedProperty } from "@tektonux/model.core/dist";
import { AutoManualStateType } from "@tektonux/model.platform/dist";
import { TransmitterModeType, AntennaPointingModeType, AntennaType } from "./types/...";

export declare class Rover extends GeoEntity {
    static class: string;
    transmitterPowerLevel?: RangedCommandedProperty<Integer>;
    transmitterMode?: CommandedProperty<TransmitterModeType>;
    antennaPointingMode?: CommandedProperty<AntennaPointingModeType>;
    antennaMode?: CommandedProperty<AutoManualStateType>;
    antennaType?: CommandedProperty<AntennaType>;
    antennaAzimuth?: RangedCommandedProperty<number>;
    targetLatitude?: RangedCommandedProperty<number>;
    targetLongitude?: RangedCommandedProperty<number>;
    targetAltitude?: RangedCommandedProperty<number>;
    constructor(id: string);
}
```

## EntityViewModel Architecture

EntityViewModels are essential components that wrap around Data Model instances. They **do not duplicate data fields** from the Data Model. Instead, they provide accessor methods (getters) that return specialized ViewModels for each relevant property of the underlying Data Model.

They provide:
1.  Observable properties derived from the Data Model.
2.  Business logic and validation related to the entity.
3.  UI interaction methods.
4.  Data transformation and formatting for display.

### EntityViewModel Structure

EntityViewModels typically extend a base class like `BaseEntityViewModel<DataModelType>`. For entities that have geographic/location properties (such as platforms, rovers, or other geo-located assets), they extend `GeoEntityBaseVM<DataModelType>`, which provides additional functionality for handling location-based data and map integration.

```typescript
// Real Example 1: MarshalPointViewModel.ts from EXAMPLES
import { IEntityConstructor, IFrameworkServices } from '@tektonux/framework-api';
import { makeObservable } from 'mobx';
import { GeoPointBaseVM } from '@tektonux/phoenix-core';
import { MarshalPoint } from '@tektonux/uvc-model';

export class MarshalPointViewModel extends GeoPointBaseVM<MarshalPoint> {
    constructor(services: IFrameworkServices) {
        super(services);
        makeObservable(this);
    }

    getEntityClassName(): string {
        return MarshalPoint.class;
    }

    getEntityCtr(): IEntityConstructor<MarshalPoint> {
        return MarshalPoint;
    }
}

// Real Example 2: WcaNotificationViewModel.ts from EXAMPLES
import { IEntityConstructor, IEnumFormatOptions, IFrameworkServices, IPropertyVM } from '@tektonux/framework-api';
import { computed, makeObservable } from 'mobx';
import { WcaLevelType, WcaNotification } from '@tektonux/uvc-model';
import { EnumViewModel } from '@tektonux/phoenix-core';
import { UvcNotificationBaseVM } from './base/uvcNotificationBaseVM';
import { WcaLevelTypeLabel } from '../adapters/platform';

export class WcaNotificationViewModel extends UvcNotificationBaseVM<WcaNotification> {
    constructor(services: IFrameworkServices) {
        super(services);
        makeObservable(this);
    }

    getEntityClassName(): string {
        return WcaNotification.class;
    }

    getEntityCtr(): IEntityConstructor<WcaNotification> {
        return WcaNotification;
    }

    @computed
    get levelVM(): IPropertyVM<WcaLevelType, IEnumFormatOptions<WcaLevelType>> {
        const vm = this.createPropertyVM('level', EnumViewModel<WcaLevelType>);
        vm.configure({
            labelConverter: WcaLevelTypeLabel,
            defaultValue: WcaLevelType.CAUTION,
        });
        return vm;
    }
}

// Real Example 3: UvcPlatformBaseVM.ts - Abstract base class from EXAMPLES
export abstract class UvcPlatformBaseVM<T extends UvcPlatform> extends PlatformBaseVM<T> {

    getEntityClassName(): string {
        return UvcPlatform.class;
    }

    getEntityCtr(): IEntityConstructor<T> {
        throw Error('Unexpected call to UvcPlatformBaseVM.getEntityCtr');
    }

    get waypointIdVM(): IPropertyVM<string, IStringFormatOptions> {
        return this.createPropertyVM('waypointId', StringViewModel);
    }

    get isReadyVM(): ICommandedVM<boolean, IBooleanFormatOptions> {
        return this.createPropertyVM('isReady', CommandedBooleanViewModel);
    }

    get launchVM(): ICommandedVM<boolean, IBooleanFormatOptions> {
        return this.createPropertyVM('launch', CommandedBooleanViewModel);
    }

    get landVM(): ICommandedVM<boolean, IBooleanFormatOptions> {
        return this.createPropertyVM('land', CommandedBooleanViewModel);
    }

    get isConnectedVM(): ICommandedVM<boolean, IBooleanFormatOptions> {
        return this.createPropertyVM('isConnected', CommandedBooleanViewModel);
    }

    @computed
    get roverVM(): RoverViewModel {
       const vm = this.createVisualPlugin("roverVM", () => new RoverViewModel(this._services));
       vm.setEntityId(this.datalinkIdVM.value());
       return vm;
    }
}
```

### Real EntityViewModel Base Class Patterns

The current codebase shows three main EntityViewModel inheritance patterns:

#### Pattern 1: Simple Geographic Entities
- **Base**: `GeoPointBaseVM<T>` for simple points
- **Example**: `MarshalPointViewModel extends GeoPointBaseVM<MarshalPoint>`
- **Use case**: Simple geographic markers or waypoints

#### Pattern 2: Notification Entities  
- **Base**: `UvcNotificationBaseVM<T>` for domain-specific notifications
- **Example**: `WcaNotificationViewModel extends UvcNotificationBaseVM<WcaNotification>`
- **Use case**: Different types of alerts and messages

#### Pattern 3: Platform Entities
- **Base**: `PlatformBaseVM<T>` for platform-related entities  
- **Example**: `UvcPlatformBaseVM<T> extends PlatformBaseVM<T>` (abstract)
- **Use case**: Military platforms, vehicles, systems

#### Pattern 4: Abstract Base Classes
Abstract EntityViewModels like `UvcPlatformBaseVM` are used when:
- Multiple concrete implementations will share common functionality
- The `getEntityCtr()` should be implemented by concrete classes
- Related ViewModels need to be exposed (e.g., `roverVM` in the platform base)

#### Example 2: Geo-Located Entity ViewModel

For entities with geographic properties (latitude, longitude, altitude, etc.), extend `GeoEntityBaseVM`:

```typescript
// Example: RoverViewModel.ts (for a geo-located rover)
import { GeoEntityBaseVM } from '@tektonux/phoenix-core';
import { Rover } from '@tektonux/uvc-model'; // Data Model with location properties
import { IEntityConstructor, ICommandedVM, INumberFormatOptions } from '@tektonux/framework-api';
import { RangedCommandedNumberViewModel } from '@tektonux/phoenix-core';

export class RoverViewModel extends GeoEntityBaseVM<Rover> {
    getEntityClassName(): string {
        return Rover.class;
    }
    
    getEntityCtr(): IEntityConstructor<Rover> {
        return Rover;
    }
    
    // GeoEntityBaseVM automatically provides location-related property VMs:
    // - latitudeVM: ICommandedVM<number, INumberFormatOptions>
    // - longitudeVM: ICommandedVM<number, INumberFormatOptions>
    // - altitudeVM: ICommandedVM<number, INumberFormatOptions>
    // - headingVM: ICommandedVM<number, INumberFormatOptions>
    // And other geo-related properties
    
    // Add rover-specific property VMs
    get speedVM(): ICommandedVM<number, INumberFormatOptions> {
        const vm = this.createPropertyVM('speed', RangedCommandedNumberViewModel);
        vm.configure({
            min: 0,
            max: 50, // max speed in km/h
            labelConverter: v => `${v} km/h`
        });
        return vm;
    }
    
    // Rover-specific methods can leverage inherited geo functionality
    @action
    async navigateToLocation(lat: number, lon: number): Promise<void> {
        await this.latitudeVM.onCommandedUpdate(lat);
        await this.longitudeVM.onCommandedUpdate(lon);
        // Additional navigation logic...
    }
}
```

Key differences when using `GeoEntityBaseVM`:
1. Automatic handling of standard geographic properties
2. Built-in support for map integration and visualization
3. Standardized property names for location data (latitude, longitude, altitude, etc.)
4. Additional geo-specific functionality like distance calculations, bearing, etc.

## Component ViewModel (View-Specific ViewModel)

Component ViewModels (often referred to as View-Specific ViewModels) operate at a higher level than EntityViewModels. They are responsible for the state and logic of a particular UI view, screen, or a significant component.

They typically:
1.  Manage one or more EntityViewModels (or other services/stores).
2.  Handle UI state not directly tied to a single entity (e.g., visibility of a panel, current input values for a form that spans multiple entities).
3.  Coordinate actions across multiple entities or services.
4.  Manage the lifecycle of UI elements or child ViewModels.
5.  Utilize MobX (`@observable`, `@action`, `@computed`, `makeObservable`) for reactive state management.

```typescript
// Example: DiscoverySettingsComponentViewModel.ts (manages the overall discovery settings UI)
import { IFrameworkServices } from '@tektonux/framework-api';
import { BaseViewModel } from '@tektonux/framework-shared-plugin';
import { action, computed, makeObservable, observable } from 'mobx';
import { DiscoverySettingsEntityViewModel } from './DiscoverySettingsEntityViewModel';
// Potentially other EntityViewModels or services

export class DiscoverySettingsComponentViewModel extends BaseViewModel {
    @observable isSearchingLocation: boolean = false;
    @observable locationError: string | null = null;
    @observable showSavedToast: boolean = false;
    
    // This Component VM holds an instance of the Entity VM
    private readonly _settingsEntityVM: DiscoverySettingsEntityViewModel;
    
    constructor(services: IFrameworkServices, entityId?: string) { // entityId might be passed in
        super(services);
        
        // Create the entity ViewModel, often as a visual plugin managed by the framework
        this._settingsEntityVM = this.createVisualPlugin('settingsEntityVM', 
            () => new DiscoverySettingsEntityViewModel(this._services));
        
        // Set the entity ID for the EntityViewModel to load/manage the correct Data Model instance
        if (entityId) { // Or if obtained from a store/service
            this._settingsEntityVM.setEntityId(entityId);
        }
        
        makeObservable(this);
    }
    
    // Exposes the EntityViewModel for the View to bind to its property VMs
    @computed get entityVM(): DiscoverySettingsEntityViewModel {
        return this._settingsEntityVM;
    }
    
    // UI-specific actions
    @action setIsSearchingLocation(value: boolean): void {
        this.isSearchingLocation = value;
    }
    
    @action searchLocation(): void {
        this.setIsSearchingLocation(true);
        this.locationError = null;
        
        // Implement location search logic...
        // This might involve calling a service.
        
        // When done:
        // 1. Update entity via entityVM's property VM if location is part of the entity
        // e.g., this.entityVM.searchLocationVM.onCommandedUpdate(newLocation);
        
        // 2. Update UI state
        this.setIsSearchingLocation(false);
        // Potentially set locationError if it failed
    }

    @action async saveAllSettings(): Promise<void> {
        // This action might coordinate saving through the EntityViewModel
        await this.entityVM.saveSettings();
        this.showSavedToast = true;
        // Hide toast after a delay
        setTimeout(() => action(() => this.showSavedToast = false)(), 3000);
    }
}
```

## View Integration

Views (React components) are primarily responsible for rendering the UI based on the state provided by their corresponding Component ViewModel. They use `observer` from `mobx-react` to reactively update when the ViewModel's state changes and delegate user interactions to action methods on the ViewModel.

```tsx
// Example: DiscoverySettingsView.tsx
import { IReactControl, mergeClassNames } from '@tektonux/framework-visual-react-shared';
import { observer } from 'mobx-react';
import { DisplayInfoRenderer } from '@tektonux/framework-visual-react-components'; // Example component
import { DiscoverySettingsComponentViewModel } from './DiscoverySettingsComponentViewModel';
import { Button, DropdownInput, Label } from '@tektonux/phoenix-components-shared'; // Shared UI components
import { useMemo } from 'react';

interface Props extends IReactControl {
    // ViewModel is typically passed as a prop or instantiated within the View (e.g., using useMemo)
    viewModel: DiscoverySettingsComponentViewModel; 
}

export const DiscoverySettingsView = observer((props: Props) => {
    const { viewModel, className, ...rest } = props;
    
    // Example of instantiating ViewModel if not passed, tied to component lifecycle
    // const localViewModel = useMemo(() => {
    //     const vm = new DiscoverySettingsComponentViewModel(services); // services would come from context or props
    //     // vm.setEntityId(someId); // if applicable
    //     return vm;
    // }, [services, someId]);
    // const currentViewModel = props.viewModel || localViewModel;


    return (
        <div className={mergeClassNames(className, 'discovery-settings-view')} {...rest}>
            <div className="settings-header">
                <Label text="Discovery Settings" />
            </div>
            
            <div className="settings-content">
                {/* Bind to the Component ViewModel's EntityViewModel's property VMs */}
                <div className="setting-row">
                    <Label text="Transmitter:" />
                    <DropdownInput
                        // options={viewModel.transmitterOptions} // Options might come from Component VM or be static
                        value={viewModel.entityVM.transmitterVM.actualFormatted()} // Display formatted actual value
                        onChange={(value) => viewModel.entityVM.transmitterVM.onCommandedUpdate(value)} // Update via property VM
                        // disabled={viewModel.entityVM.transmitterVM.disabled}
                    />
                </div>

                <div className="setting-row">
                    <Label text="Power Level:" />
                    {/* Example using a DisplayInfoRenderer or a specific input for numbers */}
                    <DisplayInfoRenderer displayInfo={viewModel.entityVM.powerLevelVM.displayInfo} /> 
                    {/* Or a NumberInput bound to powerLevelVM.localOrCommanded, .onCommandedUpdateString, etc. */}
                </div>
                
                {/* More settings... */}

                <Button text="Save Settings" onClick={() => viewModel.saveAllSettings()} />
                {viewModel.showSavedToast && <div className="toast">Settings Saved!</div>}
            </div>
        </div>
    );
});
```

## Key Concepts Summary

1.  **Separation of Concerns**:
    *   **Data Models**: Pure data structures, often defined in `.d.ts` or model libraries.
    *   **Entities (`IEntity`)**: A common interface for data models managed by the framework.
    *   **EntityViewModels**: Wrap individual Data Models, adapt them for UI by providing specialized property ViewModels (e.g., `CommandedEnumViewModel`, `RangedNumberViewModel`) for each property. They handle formatting, validation, and interaction logic for those properties.
    *   **Component ViewModels (View-Specific VMs)**: Orchestrate UI logic for a screen/component, manage local UI state, and consume EntityViewModels or services.
    *   **Views**: Render state from Component ViewModels and delegate user actions back to them.

2.  **Data Flow**:
    *   Data Model Property -> EntityViewModel's Property VM -> Component ViewModel (exposes EntityVM or derived data) -> View.
    *   View User Event -> Component ViewModel Action -> (Potentially) EntityViewModel Method on a Property VM -> (Potentially) Update to underlying Data Model property.

3.  **Entity Property Types (within Data Models)**:
    *   `ValueProperty<T>`: For simple, direct values.
    *   `CommandedProperty<T>`: For properties that have an "actual" (current/reported) value and a "commanded" (desired/pending) value.
    *   `RangedProperty<T>`: For properties with defined minimum and maximum constraints.
    *   `RangedCommandedProperty<T>`: Combines commanded values with range constraints.
    *   These are wrapped by corresponding specialized Property ViewModels in the EntityViewModel layer (e.g., `CommandedStringViewModel`, `RangedNumberViewModel`).

4.  **Benefits**:
    *   Clear data structure (Data Models) that can be shared or mirror backend.
    *   Consistent property manipulation and UI adaptation through specialized Property ViewModels within EntityViewModels.
    *   Clean separation between raw data, entity-specific logic (EntityViewModels), and broader UI/component logic (Component ViewModels).
    *   Strong typing and observability throughout the system.

This architecture enables a robust and maintainable separation between the fundamental data structures (Data Models) and the client-side logic that presents and interacts with that data.
```

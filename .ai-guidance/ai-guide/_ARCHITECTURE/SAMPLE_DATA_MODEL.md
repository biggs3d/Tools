# Real Data Model Examples

This document provides actual examples of Data Models from the current codebase, showcasing various property types from `@tektonux/model.core` and inheritance patterns. These examples are taken directly from the EXAMPLES folder and represent real implementations used in the application.

Data Models serve as pure TypeScript representations of application data, often generated from backend schemas or defined in shared model libraries (e.g., `@tektonux/uvc-model`). They use specialized property types that support commanded values, ranges, and other advanced features.

EntityViewModels then wrap these Data Models to provide UI-specific logic, observability, and interaction capabilities through specialized property ViewModels.

### 1. Geographic Entity: MarshalPoint

Simple geographic point extending `GeoPoint`:

```typescript
// MarshalPoint.d.ts - Real data model from EXAMPLES folder
import { GeoPoint } from "@tektonux/model.geospatial";

/**
 * @description {
 *      "clazz" : {
 *          "extends": ["GeoPoint"],
 *          "members": [
 *              "class"
 *          ]
 *      }
 * }
 */
export declare class MarshalPoint extends GeoPoint {
    /**
     * @default quicktype.MarshalPoint
     */
    static class: string;
    constructor(id: string);
}

// Corresponding EntityViewModel - marshalPointViewModel.ts
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
```

### 2. Complex Geographic Entity: Rover

Complex entity with multiple commanded properties and enum types:

```typescript
// Rover.d.ts - Real data model showing complex property types
import { GeoEntity } from "@tektonux/model.geospatial/dist";
import { CommandedProperty, Integer, RangedCommandedProperty } from "@tektonux/model.core/dist";
import { AutoManualStateType } from "@tektonux/model.platform/dist";
import { TransmitterModeType } from "./types/TransmitterModeType";
import { AntennaPointingModeType } from "./types/AntennaPointingModeType";
import { AntennaType } from "./types/AntennaType";

/**
 * @description {
 *      "clazz" : {
 *          "extends": ["GeoEntity"],
 *          "members": [
 *              "class",
 *              "transmitterPowerLevel",
 *              "transmitterMode",
 *              "antennaPointingMode",
 *              "antennaMode",
 *              "antennaType",
 *              "antennaAzimuth",
 *              "targetLatitude",
 *              "targetLongitude",
 *              "targetAltitude"
 *          ]
 *      }
 * }
 */
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

### 3. Inheritance Pattern: WcaNotification

Notification entity extending a base notification class:

```typescript
// WcaNotification.d.ts - Real inheritance example
import { ValueProperty } from "@tektonux/model.core/dist";
import { WcaLevelType } from "./types/WcaLevelType";
import { UvcNotification } from "./UvcNotification";

/**
 * @description {
 *      "clazz" : {
 *          "extends" :  ["UvcNotification"],
 *          "members" :  [
 *              "class",
 *              "level"
 *          ]
 *      }
 * }
 */
export declare class WcaNotification extends UvcNotification {
    static class: string;
    level?: ValueProperty<WcaLevelType>;
    constructor(id: string);
}

// Corresponding EntityViewModel - wcaNotificationViewModel.ts
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
```

### 4. Platform History: UvcPlatformHistory

History entity extending base platform history:

```typescript
// UvcPlatformHistory.d.ts - Real platform history example
import { ValueProperty } from "@tektonux/model.core/dist";
import { PlatformHistory } from "@tektonux/model.platform/dist";

/**
 * @description {
 *      "clazz" : {
 *          "extends": ["PlatformHistory"],
 *          "members": ["class","eventType"]
 *      }
 * }
 */
export declare class UvcPlatformHistory extends PlatformHistory {
    static class: string;
    eventType?: ValueProperty<string>;
    constructor(id: string);
}
```

### 5. Abstract Base EntityViewModel Pattern

Real base class implementation showing inheritance patterns:

```typescript
// UvcPlatformBaseVM.ts - Real abstract base implementation from EXAMPLES
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

## Key Takeaways from Real Implementation

### Entity Base Classes in Current Codebase

* **`IEntity`**: Base interface providing `id`, `className`, timestamp, and associatedEntities
* **`GeoEntity`/`GeoPoint`**: Geographic entities with latitude, longitude, altitude properties
* **`PlatformHistory`**: Base for platform-related historical events
* **`UvcNotification`**: Base for notification entities in the UVC domain
* **Static Class Identifier**: Each entity has a unique `static class: string` for framework identification

### Property Types from Current Examples

* **`ValueProperty<T>`**: Simple values (e.g., `eventType` in `UvcPlatformHistory`)
* **`CommandedProperty<T>`**: Actual vs commanded values (e.g., `transmitterMode` in `Rover`)
* **`RangedCommandedProperty<T>`**: Commanded values with constraints (e.g., `transmitterPowerLevel` in `Rover`)
* **Enum Properties**: Use custom enum types (e.g., `WcaLevelType`, `TransmitterModeType`)

### Inheritance Patterns from EXAMPLES

1. **Simple Extension**: `MarshalPoint extends GeoPoint` - minimal additional functionality
2. **Complex Extension**: `Rover extends GeoEntity` - many additional properties
3. **Domain-Specific**: `WcaNotification extends UvcNotification` - specialized notification
4. **Historical**: `UvcPlatformHistory extends PlatformHistory` - platform-specific events

### EntityViewModel Base Classes

* **`GeoPointBaseVM<T>`**: For simple geographic points
* **`GeoEntityBaseVM<T>`**: For complex geographic entities
* **`UvcNotificationBaseVM<T>`**: For UVC-specific notifications
* **`PlatformBaseVM<T>`**: For platform entities (shown in examples)

### Real Implementation Patterns

1. **Abstract Bases**: `UvcPlatformBaseVM` throws error in `getEntityCtr()` - expects concrete implementation
2. **Plugin Integration**: Uses `createVisualPlugin` for related ViewModels (e.g., `roverVM`)
3. **Property VM Configuration**: Each property gets appropriate default values and label converters
4. **Computed Properties**: Related entities exposed as computed properties with lazy initialization

### Metadata-Driven Generation

All data models include rich metadata comments:
- **No package field needed**: The package field is not used in the current model generator
- **Inheritance chain**: `"extends": ["GeoEntity"]`
- **Member properties**: Lists all properties for code generation
- **Default values**: Static class identifiers for framework registration

This structure enables type-safe, reactive data binding between backend entities and UI components through the EntityViewModel layer.

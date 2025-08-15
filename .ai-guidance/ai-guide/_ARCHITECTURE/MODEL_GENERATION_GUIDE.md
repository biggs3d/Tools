# Model Generation Guide

This document explains how to work with data models in the Phoenix/CWMI framework, including the model generation process and best practices.

## Critical Concepts

### 1. Source vs Generated Models

**IMPORTANT**: There are two distinct model locations in this codebase:

1. **Source Models** (Editable):
   - Location: `/model/cwmi.model/src/` and `/model/phoenix.model/src/`
   - These are the ONLY model files you should edit
   - Changes here propagate to both client and server

2. **Generated Models** (Read-only):
   - Client: `/client/libs/cwmi/cwmi.model/` and `/client/libs/phoenix/phoenix.model/`
   - Server: `/server/com.cwmi.model/` and `/server/com.phoenix.model/`
   - These are AUTO-GENERATED - any edits will be OVERWRITTEN
   - Contains a README stating: "The files in this package are generated. We need to build it but not modify any of the src."

### 2. Model Generation Workflow

```bash
# After making changes in /model/*/src/:
npm run generate-model

# This command:
# 1. Reads source models from /model/*/src/
# 2. Generates TypeScript for client
# 3. Generates C# for server
# 4. Copies to appropriate directories
```

## Model File Structure

### Enum Types

Enums must follow a specific metadata format for the generator:

```typescript
// File: /model/project_name.model/src/trackQualityType.ts
/**
 * @description {
 *      "clazz" : {
 *         "enum": "EXCELLENT,GOOD,FAIR,POOR,DEGRADED",
 *         "title":"TrackQualityType"
 *      }
 * }
 * @type integer
 */
export enum TrackQualityType {
    EXCELLENT = 0,
    GOOD = 1,
    FAIR = 2,
    POOR = 3,
    DEGRADED = 4
}
```

**Key Requirements:**
- The `@description` comment is MANDATORY
- List all enum values in the `"enum"` field
- Use `@type integer` for integer-based enums
- Explicitly assign integer values starting from 0
- Values should increment sequentially

### Class/Entity Types

Classes extending base entities need proper metadata:

```typescript
// File: /model/cwmi.model/src/alphaTrack.ts
import { Platform } from "@tektonux/model.platform";
import { ValueProperty } from "@tektonux/model.core";
import { TrackQualityType } from "./trackQualityType";

/**
 * @description {
 *      "clazz" : {
 *           "extends" : ["Platform"],
 *           "members" : ["class","trackId","trackQuality","reasoning"]
 *      }
 * }
 */
export class AlphaTrack extends Platform {
    /**
     * @default quicktype.AlphaTrack
     */
    public static class: string = "quicktype.AlphaTrack";
    trackId?: ValueProperty<string>;
    trackQuality?: ValueProperty<TrackQualityType>;
    reasoning?: ValueProperty<string[]>;  // Arrays are supported

    constructor(id: string) {
        super(id);
        this.className = AlphaTrack.class;
    }
}
```

**Key Requirements:**
- List all class members in the `"members"` array
- Include parent classes in `"extends"` array
- Use `ValueProperty<T>` for read-only properties
- Use `CommandedProperty<T>` for commanded properties
- Arrays are supported (e.g., `string[]`)

### Simple Entity Types (Extending Entity Directly)

Some models extend `Entity` directly when they don't need geographic or platform-specific features:

```typescript
// File: /model/cwmi.model/src/color.ts
import { Entity, ValueProperty } from "@tektonux/model.core";

/**
 * @description {
 *      "clazz" : {
 *          "extends" : ["Entity"],
 *          "members" : ["class", "red", "green", "blue", "opacity"]
 *      }
 * }
 */
export class Color extends Entity {
    /**
     * @default quicktype.Color
     */
    public static class: string = "quicktype.Color";
    red?: ValueProperty<number>;
    green?: ValueProperty<number>;
    blue?: ValueProperty<number>;
    opacity?: ValueProperty<number>;

    constructor(id: string) {
        super(id);
        this.className = Color.class;
    }
}
```

**When to extend Entity directly:**
- Simple data structures that don't fit platform/geographic patterns
- Configuration or settings objects
- UI-specific data models
- Support/utility models

## Common Property Types

### ValueProperty<T>
- Read-only properties from the server
- Cannot be modified by the user
- Example: `timestamp?: ValueProperty<Date>`

### CommandedProperty<T>
- Properties with "actual" and "commanded" states
- User can request changes
- Example: `speed?: CommandedProperty<number>`

### RangedProperty<T> / RangedCommandedProperty<T>
- Numeric properties with min/max constraints
- Can be read-only or commanded
- Example: `altitude?: RangedCommandedProperty<number>`

## Limitations and Workarounds

### Complex Nested Interfaces

The model generator has issues with complex nested interfaces. If you need complex structures:

**Option 1: Flatten the properties**
```typescript
// Instead of:
iffData?: ValueProperty<IffData>;  // Complex nested interface

// Use:
iffCallsign?: ValueProperty<string>;
iffSquawk?: ValueProperty<string>;
iffAltitude?: ValueProperty<number>;
```

**Option 2: Use JSON string**
```typescript
// Store complex data as serialized JSON
iffData?: ValueProperty<string>;  // JSON.stringify(iffDataObject)
```

### Model Generator Errors

Common errors and solutions:

1. **"Duplicate identifier"**: Remove duplicate type definitions
2. **"Enum has no definition!"**: Check enum metadata format
3. **"Cannot read properties of undefined"**: Ensure all referenced types exist

## Best Practices

### 1. Always Edit Source Models
```bash
# ✅ CORRECT - Edit source
/model/cwmi.model/src/myModel.ts

# ❌ WRONG - Never edit generated
/client/libs/cwmi/cwmi.model/src/myModel.ts
```

### 2. Run Generation After Changes
```bash
# Make changes in /model/
vi /model/cwmi.model/src/alphaTrack.ts

# Generate immediately
npm run generate-model

# Check for errors
./tools/build-helpers/count-build-errors.sh
```

### 3. Keep Models Simple
- Use enums for finite sets of values
- Consider UI needs but don't over-optimize for them
- Start with simple types when prototyping, refactor to proper structures later

### 4. Plan for Future Refactoring
When temporarily using simplified structures due to generator limitations:
```typescript
export class AlphaTrack extends Platform {
    // Temporary: flattened IFF properties
    // TODO: Refactor to nested IffData model when generator is updated
    iffCallsign?: ValueProperty<string>;
    iffSquawk?: ValueProperty<string>;
    // Future: iffData?: ValueProperty<IffData>;
}
```
Document the intended final structure so it can be implemented when tooling improves.

## Integration with ViewModels

Once models are generated, EntityViewModels wrap them:

```typescript
// In alpha.core library
export class AlphaTrackEntityViewModel extends BaseEntityViewModel<AlphaTrack> {
    // Access generated properties
    get reasoningVM(): IPropertyVM<string[]> {
        return this.createPropertyVM('reasoning', ArrayViewModel);
    }
    
    get iffCallsignVM(): IPropertyVM<string> {
        return this.createPropertyVM('iffCallsign', StringViewModel);
    }
}
```

## Troubleshooting

### Changes Not Appearing

1. Check you edited the SOURCE model (`/model/*/src/`)
2. Run `npm run generate-model`
3. Check for generation errors in console
4. Verify the metadata annotations are correct
5. Check that members array includes new properties

### Build Errors After Generation

1. Use helper scripts:
   ```bash
   ./tools/build-helpers/count-build-errors.sh
   ./tools/build-helpers/show-build-errors.sh 10
   ```

2. Common fixes:
   - Remove duplicate type exports from index.ts
   - Ensure all enum imports exist
   - Check for circular dependencies

### Generator Crashes

If the generator crashes with C++ errors:
1. Simplify complex types (flatten nested interfaces)
2. Check enum definitions have proper metadata
3. Ensure no circular references
4. Try generating one model at a time

## Summary

The model generation system enforces a clean separation between data definition (models) and UI logic (ViewModels). By understanding the source vs generated distinction and following the metadata format, you can effectively extend the data model while maintaining type safety across the full stack.
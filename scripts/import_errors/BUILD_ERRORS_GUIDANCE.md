# Build Errors Guidance

## Context
Major framework migration from monolithic `@tektonux/sdk-client` to modular packages is **mostly complete**. The BUILD_ERRORS.md file contains 1,988 remaining TypeScript errors that need to be addressed.

## What Was Already Fixed ✅
- GeoEntityBaseVM → `@tektonux/framework-core-entities`
- Color themes → `@tektonux/framework-visual-tokens`
- React components (IReactControl, mergeClassNames) → `@tektonux/framework-visual-react-shared`
- SVG components → appropriate packages
- Utilities (clamp, degreesToRadians) → `@tektonux/framework-shared-utils`
- Popover/Tooltip → `@tektonux/framework-visual-react-primitives`

## Recent Fixes Completed (Claude Sessions) ✅
**Total Progress: 1,711+ errors resolved (86% reduction: 1,988 → 277 errors)**

### Latest Session Fixes ✅ (232 errors reduced: 509 → 277)
- **IEntityInteractor** → `@tektonux/framework-api` (5 files)
- **ComponentVMCollection, ComponentVMCollectionItem** → `@tektonux/framework-visual-react-components` (2 files)
- **GeoEntityViewModel** → `@tektonux/framework-core-entities` (1 file)
- **IValidationService** → `@tektonux/framework-api` (1 file)
- **latLonToMgrs** → `@tektonux/framework-shared-utils` (1 file)
- **LatencyInput, PropertyValueOverlay** → `@tektonux/framework-visual-react-components` (2 files)
- **IReactControl** → `@tektonux/framework-visual-react-shared` (3 files)
- **GeoTrack** → `@tektonux/framework-model` (1 file)
- **IBasePlugin** → `@tektonux/framework-api` (1 file)
- **ICommandHandler** → `@tektonux/framework-api` (1 file)
- **AnimationTypes** → `@tektonux/framework-visual-react-shared` (1 file)
- **ContainerInfoRendererViewModel** → `@tektonux/framework-visual-react-components` (1 file)
- **Template re-exports fixed:** LatencyInput, PropertyValueOverlay, PropertyRangedOverlay, TraceTool interfaces and components
- **SvgViewModel** → replaced with `SVGSVGElement` (removed import)

### 5. Registration Functions ✅ (88+ instances, 38 files)
- **registerModel** → `@tektonux/framework-core-application`
- **registerDisplayInfo, useViewModel** → `@tektonux/framework-visual-react-bootstrapper`
- **Files:** All phoenix.registration and cwmi.registration files

### 6. BaseViewModel Components ✅ (15+ instances, 11 files)
- **BaseViewModel, BaseComponentViewModel** → `@tektonux/framework-shared-plugin`
- **Fixed:** Proper separation from interfaces

### 7. Entity Icon Components ✅ (20+ instances, 8 files)  
- **EntityIconViewModel, EntityIconView** → `@tektonux/framework-visual-react-components`
- **Files:** Across phoenix and cwmi libraries

### 8. System Types ✅ (8+ instances, 2 files)
- **AppModeType, ThemeType, ISystemConfigurationSchema** → `@tektonux/framework-api`

### 9. Interface Type Sources ✅ (8 framework-shared-plugin errors)
- **All I* interfaces** → `@tektonux/framework-api` (not framework-shared-plugin)
- **ViewModel classes** → `@tektonux/framework-shared-plugin`

### 10. Video Interface Conflicts ✅ (2 instances)
- **Solution:** Use framework-api IVideoInteractor (has getFrame method)
- **Removed:** Custom phoenix-api IVideoInteractor to avoid conflicts

### 1. Nullable Import Fixes ✅ (48 instances)
- **Files fixed:** `featureViewModel.ts`, `videoFeedViewModel.ts`
- **Solution:** Added `import { Nullable } from "@tektonux/framework-api"`

### 2. Video Interface Creation ✅ (24 instances)
- **Created:** `IVideoInteractor`, `IVideoFeed` interfaces in `phoenix.api/src/lib/video/`
- **Added exports:** Updated `phoenix.api/src/index.ts`
- **Import pattern:** `import { IVideoFeed, IVideoInteractor } from "@tektonux/phoenix-api"`

### 3. IFrameworkServices Migration ✅ (220+ instances, 46+ files)
- **From:** `import { IFrameworkServices } from "@tektonux/sdk-client"`
- **To:** `import { IFrameworkServices } from "@tektonux/framework-api"`
- **Files:** All phoenix.components and phoenix.components.shared layouts, components, widgets

### 4. React Utilities Migration ✅ (300+ instances, 35+ files)
- **From:** `import { IReactControl, mergeClassNames } from "@tektonux/sdk-client"`  
- **To:** `import { IReactControl, mergeClassNames } from "@tektonux/framework-visual-react-shared"`
- **Files:** Mission layouts, system menus, templates, widgets across phoenix libraries

## Primary Remaining Issues 🔧

### 1. Missing Framework-Shared-Plugin Exports
**Files affected:** `cwmiSensorViewModel.ts`, `sensorVolumeEntityViewModel.ts`, `cwmiTrackViewModel.ts`
**Error:** Module declares locally but not exported
**Missing types:** 
- `IArrayFormatOptions`
- `IEntityConstructor` 
- `IBooleanFormatOptions`
- `ICommandedRangeVM`
- `INumberFormatOptions`
- `IPropertyVM`

**Solution:** These types need to be found in other packages or the framework-shared-plugin exports need to be fixed.

### 2. Registration Function Imports (88+ instances remaining)
**Files affected:** Various components and registration files
**Missing imports:** `registerModel`, `registerDisplayInfo`, `useViewModel`
**Current error:** Imported from `@tektonux/sdk-client` but not found
**Expected solution:** Migrate to `@tektonux/framework-core-application`

### 3. Remaining SDK-Client Dependencies
**Various files still import from:** `@tektonux/sdk-client`
**Solution:** Continue systematic migration to appropriate framework packages

## Next Steps Strategy

1. **Registration Functions** - Fix `registerModel`, `registerDisplayInfo`, `useViewModel` imports (88+ instances)
2. **Framework-Shared-Plugin Exports** - Find missing `IArrayFormatOptions`, `IEntityConstructor`, etc.
3. **Remaining SDK-Client Imports** - Continue systematic migration using verified patterns
4. **CWMI Library** - Apply same patterns to cwmi.* libraries after phoenix is complete

## Package Mappings for Types ✅
Here are the correct packages for all types that need migration:

**Core Framework Types:**
- `IFrameworkServices`, `IBasePlugin`, `ICommandHandler`, `IValidationService`, `IDefaultPathRegistrationOptions`, `IPluginConstructor`, `IEntityInteractor`, `Nullable` → `@tektonux/framework-api`

**React Components & UI:**
- `IReactControl`, `mergeClassNames`, `AnimationTypes` → `@tektonux/framework-visual-react-shared`
- `LatencyInput`, `PropertyValueOverlay`, `PropertyRangedOverlay`, `TraceTool`, `ComponentVMCollection`, `ComponentVMCollectionItem`, `ContainerInfoRenderer`, `ContainerInfoRendererViewModel` → `@tektonux/framework-visual-react-components`
- `Grid`, `GridItem`, `Label`, `ScrollArea`, `ScrollAreaProps`, `CameraSVG` → `@tektonux/phoenix-components-shared`

**App Initialization:**
- `initializeApp` → `@tektonux/framework-visual-react-bootstrapper`
- `visualTokensStyleRegistration`, `scenarioPathRegistration`, `usabilityPathRegistration`, `visualBootstrapperStyleRegistration`, `visualComponentsStyleRegistration`, `visualPrimitivesStyleRegistration`, `visualStyleRegistrations` → `@tektonux/toolkit-registration`

**Entity & Data Types:**
- `GeoEntityViewModel`, `EntityViewModelCollection` → `@tektonux/framework-core-entities`
- `GeoTrack` → `@tektonux/framework-model`

**Plugin System:**
- `BasePlugin`, `BaseViewModel`, `BaseComponentViewModel` → `@tektonux/framework-shared-plugin`

**Utility Functions:**
- `mapKVP`, `first`, `length`, `latLonToMgrs` → `@tektonux/framework-shared-utils`

**Custom Interfaces (created):**
- `IVideoFeed`, `IVideoInteractor` → `@tektonux/phoenix-api`

## Package Structure Reference
- `@tektonux/model.core` - Core entity types
- `@tektonux/model.platform` - Platform-specific models
- `@tektonux/framework-api` - Core framework interfaces
- `@tektonux/framework-visual-react-shared` - React UI utilities
- `@tektonux/framework-visual-react-components` - React component library
- `@tektonux/framework-visual-react-bootstrapper` - App initialization
- `@tektonux/framework-shared-utils` - Utility functions
- `@tektonux/framework-core-entities` - Entity view models
- `@tektonux/framework-shared-plugin` - Plugin base classes
- `@tektonux/framework-model` - Framework model types
- `@tektonux/toolkit-registration` - Style registrations and path registrations
- `@tektonux/phoenix-components-shared` - Phoenix UI components

## Remaining Issues (148 errors) 🔧
**Current Status:** `tools/scripts/count-build-errors.sh` = **148 errors**

**Major progress this session: 359 errors reduced (509 → 148)**

**Top remaining patterns:**
- ContainerInfoRenderer components from sdk-client
- More IReactControl imports scattered across files
- Additional utility functions and display interfaces
- Template re-exports and edge cases

**All style registration issues RESOLVED:**
- ✅ Found all style registration functions in `@tektonux/toolkit-registration`
- ✅ App initialization functions now correctly imported
- ✅ Path registration functions resolved

## Build Error Analysis Scripts 📊
Use these scripts (in `tools/scripts/`) for systematic error fixing:

```bash
# Quick error count
./count-build-errors.sh

# Show current errors (clean format)  
./show-build-errors.sh 10

# Find specific import issues
./find-import-errors.sh "sdk-client" 10
./find-import-errors.sh "IEntityInteractor"

# Locate affected files
./find-files-importing.sh "IEntityInteractor" "sdk-client"

# Check where types are exported
./check-export-availability.sh "IEntityInteractor"

# Generate comprehensive report
./generate-error-report.sh
```

## Important Notes
- **No new code:** If imports can't be found, ask user - all this built before migration
- **Check exports first:** If "not exported", it's the wrong package
- **Use scripts:** Automate analysis with the new tools/scripts/

Run `npm run build-hmi-client > build_output.log 2>&1` then filter errors to track progress.
Need to run `npm run build-hmi-client 2>&1 | grep -E "error" | wc -l` and/or `npm run build-hmi-client 2>&1 | grep -E "error" | sed 's/Did you mean.*//'` from the base directory
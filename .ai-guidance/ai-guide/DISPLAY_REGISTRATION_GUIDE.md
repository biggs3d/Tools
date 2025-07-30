# Display Registration Guide

This guide explains how to use the Phoenix framework's display registration system to dynamically add components to various UI areas.

## Overview

The display registration system allows you to register React components that will be rendered in specific areas of the application based on tags. This is the standard pattern for adding items to toolbars, menus, panels, and other dynamic UI areas.

## Core Concepts

### Display Info Registration

Components are registered using the `registerDisplayInfo` function from `@tektonux/framework-visual-react-bootstrapper`:

```typescript
import { registerDisplayInfo } from '@tektonux/framework-visual-react-bootstrapper';
import { DisplayTypes } from '@your-app/your-api';

registerDisplayInfo({
    id: DisplayTypes.YourComponent,  // Use DisplayTypes constant, not string
    tags: string[];                  // Tags that determine where component renders
    ordinal?: number;                // Sort order (lower numbers appear first)
    visible?: boolean;               // Whether component is visible
    Renderer: React.ComponentType;    // The React component to render
    metadata?: any;                  // Optional metadata
});
```

**Important**: Always use `DisplayTypes` constants for the `id` field, not string literals. Add new display types to your API library's `displayTypes.ts` file.

### Tag System

Tags determine where components are rendered. Each UI area looks for specific tags:

```typescript
// Example DisplayTypes from Alpha library
export const DisplayTypes = {
    ...FrameworkDisplayTypes,
    MainEntry: 'AlphaDisplay',      // Main application entry
    TopToolbar: 'TopToolbar',       // Toolbar component ID
    GridPanel: 'GridPanel',         // Grid panel component ID
    // ... other display types
};

// Example TagTypes from Alpha library  
export const TagTypes = {
    TopToolbarLeft: 'TopToolbarLeft',     // Left side of top toolbar
    TopToolbarRight: 'TopToolbarRight',   // Right side of top toolbar
    // ... other tags
};

// Example tags from Phoenix library
export const TagTypes = {
    MissionViewContent: 'MissionViewContent',
    PlatformCapabilityTrigger: 'PlatformCapabilityTrigger',
    DefaultTeamCapabilityContent: 'DefaultTeamCapabilityContent',
    // ... many more
};
```

### Display Info Renderer

UI areas use `DisplayInfosRenderer` to render registered components:

```typescript
import { DisplayInfosRenderer } from '@tektonux/framework-visual-react-components';

// In your view component
<DisplayInfosRenderer displayInfos={viewModel.leftToolbarItems} />
```

## Implementation Pattern

### 1. Create a ViewModel that Retrieves Display Infos

ViewModels extend from base classes that provide the `getDisplayInfos` method:

```typescript
import { ViewModel } from '@tektonux/phoenix-core';
import { computed } from 'mobx';

export class MyAreaViewModel extends ViewModel {
    @computed get myAreaItems() {
        return this.getDisplayInfos<ComponentType>([TagTypes.MyAreaTag]);
    }
}
```

### 2. Use DisplayInfosRenderer in Your View

```typescript
import { observer } from 'mobx-react';
import { DisplayInfosRenderer } from '@tektonux/framework-visual-react-components';

export const MyAreaView = observer((props: { viewModel: MyAreaViewModel }) => {
    const { viewModel } = props;
    
    return (
        <div className="my-area">
            <DisplayInfosRenderer displayInfos={viewModel.myAreaItems} />
        </div>
    );
});
```

### 3. Register Components

Create registration files in your `*.registration` library:

```typescript
// File: libs/myapp/myapp.registration/src/lib/toolbar/statusIndicator.tsx
import { registerDisplayInfo } from '@tektonux/framework-visual-react-bootstrapper';
import { DisplayTypes, TagTypes } from '@myapp/myapp-api';
import { StatusIndicator } from '@myapp/myapp-components';

registerDisplayInfo({
    id: DisplayTypes.ToolbarStatusIndicator, // Use DisplayTypes constant
    tags: [TagTypes.TopToolbarRight],
    ordinal: 10,
    visible: true,
    Renderer: () => <StatusIndicator status="active" />
});

export default {};
```

## Common Patterns

### Dynamic Component with ViewModel

For components that need access to ViewModels:

```typescript
import { registerDisplayInfo, useViewModel } from '@tektonux/framework-visual-react-bootstrapper';
import { DisplayTypes, TagTypes } from '@myapp/myapp-api';

registerDisplayInfo({
    id: DisplayTypes.MyDynamicComponent, // Use DisplayTypes constant
    tags: [TagTypes.MyArea],
    ordinal: 5,
    Renderer: () => {
        const viewModel = useViewModel(MyComponentViewModel);
        return <MyComponent viewModel={viewModel} />;
    }
});
```

### Conditional Visibility

Control visibility based on conditions:

```typescript
registerDisplayInfo({
    id: DisplayTypes.ConditionalComponent, // Use DisplayTypes constant
    tags: [TagTypes.MyArea],
    visible: true, // Can be set to false to hide
    Renderer: () => {
        const isFeatureEnabled = useFeatureFlag('myFeature');
        return isFeatureEnabled ? <MyComponent /> : null;
    }
});
```

### Multiple Tags

Components can have multiple tags for rendering in multiple areas:

```typescript
registerDisplayInfo({
    id: DisplayTypes.MultiAreaComponent, // Use DisplayTypes constant
    tags: [TagTypes.TopToolbarRight, TagTypes.StatusBar],
    ordinal: 20,
    Renderer: () => <MyComponent />
});
```

## Best Practices

1. **Use DisplayTypes Constants**: Always use `DisplayTypes` constants for IDs, never string literals
   - Add new display types to your API library's `displayTypes.ts` file
   - Follow naming conventions (e.g., `ToolbarMyButton`, `PanelMyPanel`)
2. **Ordinal Values**: Use ordinal values to control ordering, leave gaps (10, 20, 30) for future insertions
3. **Tag Organization**: Define tags in your API library for consistency
4. **Registration Files**: Keep registration files in the `*.registration` library
5. **Export Default**: Always `export default {}` from registration files
6. **Modular Registration**: One registration per file for better organization

## Examples in the Codebase

### Toolbar Registration (Alpha)

The Alpha top toolbar uses the display registration pattern to allow dynamic addition of toolbar items.

#### Implementation Details

1. **Tags**: 
   - `TagTypes.TopToolbarLeft` - Items appear on the left side
   - `TagTypes.TopToolbarRight` - Items appear on the right side

2. **ViewModel**: `TopToolbarViewModel` (extends `ViewModel` from phoenix-core)
   - `leftToolbarItems` - Retrieves display infos for left toolbar items
   - `rightToolbarItems` - Retrieves display infos for right toolbar items

3. **View**: `TopToolbar` component uses `DisplayInfosRenderer` to render registered items

#### Example Registration

```typescript
// File: libs/alpha/alpha.registration/src/lib/toolbar/focusSyncButton.tsx
import { registerDisplayInfo } from '@tektonux/framework-visual-react-bootstrapper';
import { FocusSyncButton } from '@tektonux/alpha-components';
import { DisplayTypes, TagTypes } from '@tektonux/alpha-api';

registerDisplayInfo({
    id: DisplayTypes.TopToolbar, // Use DisplayTypes constant
    tags: [TagTypes.TopToolbarLeft],
    ordinal: 0, // First item on the left
    visible: true,
    Renderer: () => <FocusSyncButton />
});

export default {};
```

#### Dynamic Registration with ViewModels

For toolbar items that need access to ViewModels or services:

```typescript
import { registerDisplayInfo, useViewModel } from '@tektonux/framework-visual-react-bootstrapper';
import { DisplayTypes, TagTypes } from '@tektonux/alpha-api';
import { MyFeatureButton } from './MyFeatureButton';
import { MyFeatureViewModel } from './MyFeatureViewModel';

// First, add to displayTypes.ts:
// export const DisplayTypes = {
//     ...FrameworkDisplayTypes,
//     ToolbarMyFeatureButton: 'ToolbarMyFeatureButton',
// };

registerDisplayInfo({
    id: DisplayTypes.ToolbarMyFeatureButton, // Use DisplayTypes constant
    tags: [TagTypes.TopToolbarRight],
    ordinal: 20,
    visible: true,
    Renderer: () => {
        const viewModel = useViewModel(MyFeatureViewModel);
        return <MyFeatureButton viewModel={viewModel} />;
    }
});
```

#### Notes
- Items are sorted by their `ordinal` property within each position
- Additional children passed to TopToolbar are rendered after registered right items
- Registration files should be in the `alpha.registration` library and exported from its index

### Mission View Content (Phoenix)
- Tag: `TagTypes.MissionViewContent`
- Example: `/libs/phoenix/phoenix.registration/src/lib/display/map/map.tsx`

### Capability Triggers (Phoenix)
- Tags: `TagTypes.DefaultPlatformCapabilityTrigger`, etc.
- Example: Platform-specific UI elements in the HUD workspace

## Troubleshooting

1. **Component not appearing**: 
   - Verify the tag is correct
   - Check that the DisplayType is defined in `displayTypes.ts`
   - Check that the registration file is imported/exported
   - Ensure `visible: true` is set
   - Check ordinal values for conflicts

2. **Wrong order**: 
   - Adjust ordinal values
   - Lower numbers appear first

3. **Build errors**: 
   - Ensure all imports are correct
   - Check that the Renderer returns a valid React element

## Advanced Usage

### Custom Decorators

Some areas support decorators to wrap rendered components:

```typescript
<DisplayInfosRenderer
    displayInfos={viewModel.tabContent}
    decorator={info => {
        const Renderer = info.renderer;
        return (props) => (
            <TabsContent key={info.id} value={info.id} {...props}>
                <Renderer/>
            </TabsContent>
        )
    }}
/>
```

### Metadata

Use metadata to pass additional information:

```typescript
registerDisplayInfo({
    id: DisplayTypes.CommandTrigger, // Use DisplayTypes constant
    tags: [TagTypes.CommandTrigger],
    metadata: {
        commandType: CommandTypes.PLAY_1,
        hotkey: 'F1'
    },
    Renderer: () => <CommandButton />
});
```

This metadata can be accessed in the ViewModel for filtering or processing.
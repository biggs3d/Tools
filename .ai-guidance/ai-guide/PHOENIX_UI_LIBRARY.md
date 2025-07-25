# Phoenix UI Library Reference

This document provides a comprehensive reference for the Phoenix shared component library, including theming, components, and usage patterns.

## Table of Contents

1. [Theming System](#theming-system)
2. [Component Categories](#component-categories)
3. [Component Reference](#component-reference)
4. [Icons](#icons)
5. [Custom Hooks](#custom-hooks)
6. [Usage Patterns](#usage-patterns)

## Theming System

### Color Palette

The Phoenix UI library uses a sophisticated color system based on Radix UI colors:

```css
/* Natural Colors (Slate-based) */
--natural1 through --natural12  /* Light to dark slate tones */

/* Neutral Colors (Gray-based) */
--neutral1 through --neutral12  /* Light to dark gray tones */

/* Accent Colors (Cyan-based) */
--accent1 through --accent12    /* Light to dark cyan tones */

/* Highlight Colors (Orange-based) */
--orange1 through --orange12    /* Light to dark orange tones */
```

### Scale System

Components use a consistent scale system:
- `x-small` - Smallest size
- `small` - Small size  
- `medium` - Default size
- `large` - Large size
- `x-large` - Extra large size
- `xx-large` - Double extra large size
- `auto` - Automatic sizing

### CSS Architecture

```tsx
// Example usage with className merging
<Button 
  scale="large" 
  className="custom-button additional-styles"
  data-variant="primary"
>
  Click me
</Button>
```

## Component Categories

### Form Controls & Inputs
Essential form input components with validation support.

### Button Components  
Various button types for different use cases.

### Layout & Navigation
Components for organizing content and navigation.

### Overlays & Popups
Modal dialogs, tooltips, and popup components.

### Data Display
Components for presenting data and information.

### Interactive Controls
Sliders, toggles, and other interactive elements.

### Specialized Components

Domain-specific components for tactical applications.

#### LoadingSpinner
Animated loading indicator with configurable styling.

```tsx
import { LoadingSpinner } from '@tektonux/phoenix-components-shared';

<LoadingSpinner className="my-custom-spinner" />

// Common usage in conditional rendering
{viewModel.isLoading && (
    <div className="d-flex justify-content-center align-items-center h-100">
        <LoadingSpinner />
    </div>
)}
```

**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `className` | `string` | No | - | Additional CSS classes for styling |

**CSS Styling:**
The LoadingSpinner uses CSS animations and can be styled with custom classes. The default spinner consists of 12 animated elements creating a circular loading effect.

#### Alert (using RadixUI AlertDialog)
Alert dialogs for important notifications and confirmations.

```tsx
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogTrigger } from '@radix-ui/react-alert-dialog';

<AlertDialog>
    <AlertDialogTrigger asChild>
        <Button>Show Alert</Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
        <AlertDialogTitle>Critical System Alert</AlertDialogTitle>
        <AlertDialogDescription>
            {alert.description?.value()}
        </AlertDialogDescription>
        <AlertDialogAction onClick={() => viewModel.acknowledgeAlert()}>
            Acknowledge
        </AlertDialogAction>
    </AlertDialogContent>
</AlertDialog>
```

**Alert Data Model Integration:**
The Alert component can be used with the Alert entity model for displaying system alerts:

```tsx
// Using with Alert entity
const alertLevel = alert.alertLevel?.value(); // AlertLevelType: None, Critical, Warning, Info
const alertDescription = alert.description?.value();
const isActive = alert.active?.value();
```

#### ConfirmDialog
Confirmation dialog for destructive or important actions.

```tsx
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from '@radix-ui/react-alert-dialog';

// Custom ConfirmDialog component pattern
const ConfirmDialog = ({ title, message, onConfirm, onCancel, isOpen }) => (
    <AlertDialog open={isOpen}>
        <AlertDialogContent>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{message}</AlertDialogDescription>
            <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
            <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
        </AlertDialogContent>
    </AlertDialog>
);

// Usage in ViewModels
{viewModel.showDeleteConfirmation && (
    <ConfirmDialog
        title="Delete Item"
        message="Are you sure you want to delete this item? This action cannot be undone."
        onConfirm={viewModel.confirmDelete}
        onCancel={viewModel.cancelDelete}
        isOpen={viewModel.showDeleteConfirmation}
    />
)}
```

**ConfirmDialog Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | `string` | Yes | - | Dialog title |
| `message` | `string` | Yes | - | Confirmation message |
| `onConfirm` | `() => void` | Yes | - | Callback when user confirms |
| `onCancel` | `() => void` | Yes | - | Callback when user cancels |
| `isOpen` | `boolean` | Yes | - | Whether dialog is open |
| `confirmText` | `string` | No | `'Confirm'` | Text for confirm button |
| `cancelText` | `string` | No | `'Cancel'` | Text for cancel button |

## Component Reference

### Form Controls

#### TextInput
Enhanced text input with validation and keyboard handling.

```tsx
import { TextInput } from '@tektonux/phoenix-components-shared';

<TextInput
  scale="medium"
  placeholder="Enter text..."
  value={viewModel.textValue}
  onChange={(value) => viewModel.setTextValue(value)}
  validationVM={viewModel.textValidation}
  onEnterPressed={() => viewModel.handleSubmit()}
/>
```

**Props:**

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | `string` | Yes | - | The current value of the input |
| `onChange` | `(value: string) => void` | Yes | - | Callback when value changes |
| `scale` | `'x-small' \| 'small' \| 'medium' \| 'large' \| 'x-large'` | No | `'medium'` | Size of the input |
| `placeholder` | `string` | No | - | Placeholder text |
| `validationVM` | `IValidationVM` | No | - | Validation ViewModel for error display |
| `onEnterPressed` | `() => void` | No | - | Handler for Enter key press |
| `className` | `string` | No | - | Additional CSS classes |

#### Select
Dropdown selection component with comprehensive options.

```tsx
import { Select, SelectItem } from '@tektonux/phoenix-components-shared';

<Select 
  value={viewModel.selectedValue}
  onValueChange={(value) => viewModel.setSelectedValue(value)}
  scale="medium"
>
  <SelectItem value="option1">Option 1</SelectItem>
  <SelectItem value="option2">Option 2</SelectItem>
</Select>
```

#### Checkbox
Three-state checkbox (checked/unchecked/indeterminate).

```tsx
import { Checkbox } from '@tektonux/phoenix-components-shared';

<Checkbox
  checked={viewModel.isChecked}
  onCheckedChange={(checked) => viewModel.setChecked(checked)}
  scale="medium"
>
  Enable feature
</Checkbox>
```

### Button Components

#### Button
Base button component with scale and variant support.

```tsx
import { Button } from '@tektonux/phoenix-components-shared';

<Button
  scale="medium"
  onClick={() => viewModel.handleClick()}
  disabled={viewModel.isLoading}
  className="primary-button"
>
  {viewModel.isLoading ? 'Loading...' : 'Submit'}
</Button>
```

#### SvgButton
Button with SVG icon support.

```tsx
import { SvgButton, CloseIcon } from '@tektonux/phoenix-components-shared';

<SvgButton
  scale="small"
  onClick={() => viewModel.handleClose()}
  title="Close"
>
  <CloseIcon />
</SvgButton>
```

### Layout Components

#### Tabs
Tab navigation system with content panels.

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@tektonux/phoenix-components-shared';

<Tabs value={viewModel.activeTab} onValueChange={(tab) => viewModel.setActiveTab(tab)}>
  <TabsList>
    <TabsTrigger value="details">Details</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  
  <TabsContent value="details">
    <DetailsView viewModel={viewModel.detailsVM} />
  </TabsContent>
  
  <TabsContent value="settings">
    <SettingsView viewModel={viewModel.settingsVM} />
  </TabsContent>
</Tabs>
```

#### Accordion
Collapsible content sections.

```tsx
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@tektonux/phoenix-components-shared';

<Accordion type="single" collapsible>
  <AccordionItem value="section1">
    <AccordionTrigger>Section 1</AccordionTrigger>
    <AccordionContent>
      Content for section 1
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### Overlay Components

#### Tooltip
Hover-triggered information display.

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@tektonux/phoenix-components-shared';

<Tooltip>
  <TooltipTrigger asChild>
    <Button>Hover me</Button>
  </TooltipTrigger>
  <TooltipContent>
    Helpful tooltip information
  </TooltipContent>
</Tooltip>
```

#### Popover
Click-triggered popup overlay.

```tsx
import { Popover, PopoverContent, PopoverTrigger } from '@tektonux/phoenix-components-shared';

<Popover>
  <PopoverTrigger asChild>
    <Button>Open Popover</Button>
  </PopoverTrigger>
  <PopoverContent className="w-80">
    <div className="p-4">
      Popover content goes here
    </div>
  </PopoverContent>
</Popover>
```

### Data Display

#### Progress
Progress indicator with optional tick marks.

```tsx
import { Progress } from '@tektonux/phoenix-components-shared';

<Progress 
  value={viewModel.progressValue} 
  max={100}
  showTicks={true}
  tickCount={10}
  scale="medium"
/>
```

#### Graph  
Complex charting component supporting multiple chart types.

```tsx
import { Graph } from '@tektonux/phoenix-components-shared';

<Graph
  data={viewModel.chartData}
  type="area" // 'area', 'bar', 'scatter'
  width={400}
  height={200}
  scale="medium"
/>
```

### Interactive Controls

#### Slider
Range slider with tick marks and scale options.

```tsx
import { Slider } from '@tektonux/phoenix-components-shared';

<Slider
  value={[viewModel.sliderValue]}
  onValueChange={([value]) => viewModel.setSliderValue(value)}
  min={0}
  max={100}
  step={1}
  showTicks={true}
  tickCount={11}
  scale="medium"
/>
```

#### Switch
Toggle switch control.

```tsx
import { Switch } from '@tektonux/phoenix-components-shared';

<Switch
  checked={viewModel.isEnabled}
  onCheckedChange={(checked) => viewModel.setEnabled(checked)}
  scale="medium"
>
  Enable feature
</Switch>
```

## Icons

The Phoenix library includes a comprehensive SVG icon system with 50+ icons:

### Navigation Icons
```tsx
import { ArrowLeftIcon, ArrowRightIcon, CloseIcon, AddIcon } from '@tektonux/phoenix-components-shared';
```

### Settings Icons  
```tsx
import { ApplicationSettingsIcon, PlatformSettingsIcon, TeamSettingsIcon } from '@tektonux/phoenix-components-shared';
```

### Status Icons
```tsx
import { LockIcon, UnlockIcon, VisibilityOnIcon, VisibilityOffIcon } from '@tektonux/phoenix-components-shared';
```

### Military/Tactical Icons
```tsx
import { EagleIcon, FriendlyIcon, HostileIcon, NeutralIcon, UnknownIcon } from '@tektonux/phoenix-components-shared';
```

### Icon Usage Pattern
```tsx
// Icons can be used standalone or within buttons
<div className="icon-container">
  <EagleIcon className="w-6 h-6" />
</div>

// Or within SvgButton
<SvgButton onClick={handleAction}>
  <SettingsIcon />
</SvgButton>
```

## Validation System

### IValidationVM Interface

The validation system uses the `IValidationVM` interface for form validation and error display:

```typescript
interface IValidationVM {
    hasError?: boolean;        // Whether validation has failed
    errorMessage?: string;     // The error message to display
    maxLength?: number;        // Maximum allowed input length (optional)
}
```

### Usage with Components

```tsx
// In ViewModel
@computed get nameValidation(): IValidationVM {
    const name = this.nameVM.localOrCommanded();
    
    if (!name || name.trim().length === 0) {
        return {
            hasError: true,
            errorMessage: 'Name is required'
        };
    }
    
    if (name.length > 50) {
        return {
            hasError: true,
            errorMessage: 'Name must be 50 characters or less',
            maxLength: 50
        };
    }
    
    return { hasError: false };
}

// In View
<TextInput
    value={viewModel.nameVM.localOrCommanded()}
    onChange={(value) => viewModel.nameVM.onCommandedUpdate(value)}
    validationVM={viewModel.nameValidation}
    placeholder="Enter name"
/>
```

### Validation Patterns

**Property-Level Validation** (for simple, self-contained rules):
```typescript
get speedVM() {
    const vm = this.createPropertyVM('speed', CommandedNumberViewModel);
    vm.configure({
        min: 0,
        max: 300,
        validator: (value) => {
            if (value > 250 && !this.isHighSpeedAuthorized) {
                return 'High speed requires authorization';
            }
            return null;
        }
    });
    return vm;
}
```

**Dedicated Validation ViewModel** (for complex, cross-field validation):
```typescript
export class FormValidationViewModel extends BaseViewModel {
    @computed get isFormValid(): boolean {
        return !this.nameValidation.hasError && 
               !this.emailValidation.hasError &&
               !this.passwordValidation.hasError;
    }
    
    @computed get nameValidation(): IValidationVM {
        // Complex validation logic
    }
}
```

**When to Use Each Pattern:**
- **Property-level validators**: Use for simple, self-contained rules (min/max, required, format validation)
- **Dedicated validation ViewModel**: Use for complex, cross-field validation logic or when multiple components need shared validation state

## Custom Hooks

The library provides utility hooks for common patterns:

### useDebounce
Debouncing with maximum delay control.

```tsx
import { useDebounce } from '@tektonux/phoenix-components-shared';

const debouncedValue = useDebounce(inputValue, 300, 1000);
```

### useOutsideClick
Detect clicks outside a component.

```tsx
import { useOutsideClick } from '@tektonux/phoenix-components-shared';

const ref = useOutsideClick(() => {
  setIsOpen(false);
});

return <div ref={ref}>Content</div>;
```

### useKeyboardService
Access keyboard input handling.

```tsx
import { useKeyboardService } from '@tektonux/phoenix-components-shared';

const keyboardService = useKeyboardService();
```

## Usage Patterns

### Component Composition
```tsx  
// Compose complex UIs from primitives
const SettingsPanel = observer(({ viewModel }: { viewModel: SettingsPanelViewModel }) => {
  return (
    <div className="settings-panel">
      <Tabs value={viewModel.activeTab} onValueChange={viewModel.setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
          <div className="space-y-4">
            <TextInput
              label="Name"
              value={viewModel.name}
              onChange={viewModel.setName}
              validationVM={viewModel.nameValidation}
            />
            
            <Switch
              checked={viewModel.isEnabled}
              onCheckedChange={viewModel.setEnabled}
            >
              Enable feature
            </Switch>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});
```

### Validation Integration
```tsx
// Components integrate with validation ViewModels
<TextInput
  value={viewModel.email}
  onChange={viewModel.setEmail}
  validationVM={viewModel.emailValidation}
  placeholder="Enter email address"
/>

// The validation ViewModel provides error display
// viewModel.emailValidation.hasError -> boolean
// viewModel.emailValidation.errorMessage -> string
```

### Scale Consistency
```tsx
// Use consistent scaling across related components
const scale = "medium";

<div className="form-section">
  <TextInput scale={scale} />
  <Select scale={scale} />
  <Button scale={scale} />
</div>
```

### Theme Integration
```tsx
// Components automatically use CSS custom properties
.custom-component {
  background-color: var(--neutral2);
  border: 1px solid var(--neutral6);
  color: var(--neutral12);
}

// Accent colors for highlights
.accent-button {
  background-color: var(--accent9);
  color: var(--accent1);
}
```

## Best Practices

1. **Use MobX observer** for components that consume observable data
2. **Forward refs** when creating wrapper components
3. **Merge classNames** using the provided utility for custom styling
4. **Consistent scaling** across related UI elements
5. **Validation ViewModels** for form inputs with error handling
6. **Accessibility** - leverage Radix UI's built-in accessibility features
7. **Performance** - use LazyList for large datasets
8. **Icons** - prefer SVG icons from the library for consistency
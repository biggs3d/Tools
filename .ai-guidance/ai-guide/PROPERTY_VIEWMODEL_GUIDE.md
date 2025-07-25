# Property ViewModel Guide

This document explains the Property ViewModel system in detail, including when and how to use different methods for reading and writing property values.

## Table of Contents

1. [Property Types Overview](#property-types-overview)
2. [Property ViewModel Methods](#property-viewmodel-methods)  
3. [Reading Values - When to Use Which Method](#reading-values---when-to-use-which-method)
4. [Writing Values - Update Methods](#writing-values---update-methods)
5. [Common Patterns and Examples](#common-patterns-and-examples)
6. [Validation and Error Handling](#validation-and-error-handling)
7. [Troubleshooting](#troubleshooting)

## Property Types Overview

The Phoenix framework uses three main property types for entity data:

### ValueProperty<T>
- **Purpose**: Simple read-only values from the server
- **Use Case**: Display data that cannot be modified by the user
- **Examples**: Timestamps, calculated fields, system status

### CommandedProperty<T>  
- **Purpose**: Values that can be commanded (requested to change) by the user
- **Use Case**: User-controllable settings, operational parameters
- **Examples**: Platform speed, weapon settings, communication parameters
- **Key Concept**: Has both "actual" (current server state) and "commanded" (user-requested state) values

### RangedProperty<T>
- **Purpose**: Numeric values with min/max constraints and optional validation
- **Use Case**: Bounded numeric inputs like percentages, coordinates, power levels
- **Examples**: Engine power (0-100%), altitude (-1000 to 50000), frequency ranges

## Property ViewModel Methods

### Reading Methods

| Method | Returns | Property Types | Use Case |
|--------|---------|----------------|----------|
| `.value()` | `T` | ValueProperty | Raw value from read-only properties |
| `.actual()` | `T` | CommandedProperty, RangedProperty | Current server state ("ground truth") |
| `.commanded()` | `T` | CommandedProperty, RangedProperty | User-requested state (may differ from actual) |
| `.localOrCommanded()` | `T` | CommandedProperty, RangedProperty | Commanded value if set, otherwise actual value |
| `.actualFormatted()` | `string` | All types | Formatted actual value for display |
| `.commandedFormatted()` | `string` | CommandedProperty, RangedProperty | Formatted commanded value for display |

### Writing Methods

| Method | Purpose | Property Types | Use Case |
|--------|---------|----------------|----------|
| `.onUpdate(value)` | Update value | ValueProperty | Updating read-only properties (rare) |
| `.onCommandedUpdate(value)` | Update commanded value | CommandedProperty, RangedProperty | Main update method for typed values |
| `.onCommandedUpdateString(str)` | Update from string input | CommandedProperty, RangedProperty | Text inputs that need parsing |

**When to use which update method?**
- Use `.onCommandedUpdate(value)` when the UI component provides the value in the correct data type (e.g., a `NumberInput` providing a `number`, a `Slider`, or a type-safe `<Select>` component)
- Use `.onCommandedUpdateString(stringValue)` primarily for standard HTML `<input type="text">` or `TextInput` components where the value is always a `string` and needs to be parsed into the correct type (like parsing "123" to `123`)

### Additional Methods

| Method | Purpose | Property Types | Use Case |
|--------|---------|----------------|----------|

## Reading Values - When to Use Which Method

### Use `.value()` when:
- Working with **ValueProperty** (read-only data)
- Need the raw, unformatted value
- Building computed properties based on simple values

```typescript
// Examples of .value() usage
const timestamp = entity.lastUpdatedVM.value(); // ValueProperty<Date>
const systemStatus = entity.statusVM.value(); // ValueProperty<SystemStatus>

@computed get isSystemOnline(): boolean {
    return this.systemStatusVM.value() === SystemStatus.Online;
}
```

### Use `.actual()` when:
- Need the **current server state** ("ground truth")
- Displaying what the system is **actually doing** right now
- Making decisions based on confirmed system state
- Comparing commanded vs actual values

```typescript
// Examples of .actual() usage
const currentSpeed = platform.speedVM.actual(); // What speed the platform is actually moving
const actualPower = engine.powerLevelVM.actual(); // Current engine power level
const serverConfirmedMode = radio.modeVM.actual(); // Mode the radio is actually in

// Display actual vs commanded comparison
@computed get speedStatusMessage(): string {
    const actual = this.speedVM.actual();
    const commanded = this.speedVM.commanded();
    
    if (Math.abs(actual - commanded) > 0.1) {
        return `Adjusting speed from ${actual} to ${commanded} mph`;
    }
    return `Speed stable at ${actual} mph`;
}
```

### Use `.commanded()` when:
- Need the **user-requested value**
- Working with form inputs that haven't been confirmed yet
- Building UI that shows what the user has set (even if not applied yet)
- Implementing "pending changes" indicators

```typescript
// Examples of .commanded() usage
const requestedFreq = radio.frequencyVM.commanded(); // What user requested
const targetAltitude = aircraft.altitudeVM.commanded(); // Where user wants to go

// Show pending changes
@computed get hasPendingChanges(): boolean {
    return this.frequencyVM.actual() !== this.frequencyVM.commanded();
}

@computed get pendingChangesList(): string[] {
    const changes: string[] = [];
    
    if (this.speedVM.actual() !== this.speedVM.commanded()) {
        changes.push(`Speed: ${this.speedVM.actual()} → ${this.speedVM.commanded()}`);
    }
    
    return changes;
}
```

### Use `.localOrCommanded()` when:
- **Binding to form inputs** (most common use case)
- Want to show commanded value if user has set one, otherwise show actual
- Building two-way data binding for UI controls
- Default choice for most UI interactions

```typescript
// Examples of .localOrCommanded() usage - MOST COMMON PATTERN
<TextInput
    value={viewModel.platformNameVM.localOrCommanded()}
    onChange={(value) => viewModel.platformNameVM.onCommandedUpdate(value)}
/>

<Slider
    value={viewModel.powerLevelVM.localOrCommanded()}
    onValueChange={(value) => viewModel.powerLevelVM.onCommandedUpdate(value)}
    min={0}
    max={100}
/>

<Select
    value={viewModel.modeVM.localOrCommanded()}
    onValueChange={(value) => viewModel.modeVM.onCommandedUpdate(value)}
>
    {modeOptions.map(option => (
        <SelectItem key={option} value={option}>
            {ModeTypeLabel[option]}
        </SelectItem>
    ))}
</Select>
```

### Use `.actualFormatted()` when:
- **Displaying read-only information** to users
- Need formatted, human-readable text
- Building status displays, labels, or informational text
- Want consistent formatting applied by the Property ViewModel

```typescript
// Examples of .actualFormatted() usage
<div className="status-display">
    <span>Current Speed: {platform.speedVM.actualFormatted()}</span>
    <span>Engine Power: {engine.powerVM.actualFormatted()}</span>
    <span>Last Update: {platform.timestampVM.actualFormatted()}</span>
</div>

// In computed properties for display
@computed get statusSummary(): string {
    return `Platform ${this.nameVM.actualFormatted()} traveling at ${this.speedVM.actualFormatted()}`;
}
```

## Writing Values - Update Methods

### Use `.onCommandedUpdate(value)` when:
- User changes a setting through UI controls
- Need to send a command to the server
- Implementing user-initiated changes

```typescript
// Form input handlers
@action handleSpeedChange(newSpeed: number): void {
    this.speedVM.onCommandedUpdate(newSpeed);
}

@action handleModeSelect(mode: RadioMode): void {
    this.radioModeVM.onCommandedUpdate(mode);
}

// Button actions
@action async setMaxPower(): Promise<void> {
    await this.powerLevelVM.onCommandedUpdate(100);
}
```

### Use `.onCommandedUpdateString(stringValue)` when: 
- Handling string input from form fields
- User types directly into text inputs
- Need automatic parsing/conversion from string

```typescript
// Text input handlers
<TextInput
    value={viewModel.frequencyVM.localOrCommanded().toString()}
    onChange={(stringValue) => viewModel.frequencyVM.onCommandedUpdateString(stringValue)}
/>

// Numeric inputs as strings
@action handleFrequencyInput(input: string): void {
    this.frequencyVM.onCommandedUpdateString(input); // Automatically parses to number
}
```

## Common Patterns and Examples

### Pattern 1: Basic Form Input Binding

```typescript
// ✅ CORRECT - Use localOrCommanded() for input value, onCommandedUpdate for changes
<TextInput
    label="Platform Name"
    value={viewModel.nameVM.localOrCommanded()}
    onChange={(value) => viewModel.nameVM.onCommandedUpdate(value)}
    validationVM={viewModel.nameValidation}
/>

<Slider
    label="Power Level"
    value={viewModel.powerVM.localOrCommanded()}
    onValueChange={(value) => viewModel.powerVM.onCommandedUpdate(value)}
    min={0}
    max={100}
/>
```

### Pattern 2: Status Display with Actual Values

```typescript
// ✅ CORRECT - Use actualFormatted() for read-only displays
const StatusPanel = observer(({ viewModel }) => (
    <div className="status-panel">
        <div>Current Speed: {viewModel.speedVM.actualFormatted()}</div>
        <div>Engine Status: {viewModel.engineStatusVM.actualFormatted()}</div>
        <div>Last Update: {viewModel.lastUpdateVM.actualFormatted()}</div>
    </div>
));
```

### Pattern 3: Pending Changes Indicator

```typescript
// ✅ CORRECT - Compare actual() vs commanded() to show pending changes
@computed get hasPendingSpeedChange(): boolean {
    return this.speedVM.actual() !== this.speedVM.commanded();
}

@computed get speedChangeIndicator(): string {
    if (this.hasPendingSpeedChange) {
        return `Speed changing: ${this.speedVM.actual()} → ${this.speedVM.commanded()}`;
    }
    return `Speed: ${this.speedVM.actualFormatted()}`;
}
```

### Pattern 4: Conditional Logic Based on State

```typescript
// ✅ CORRECT - Use actual() for business logic decisions
@computed get canLaunchWeapon(): boolean {
    return this.weaponStatusVM.actual() === WeaponStatus.Armed &&
           this.powerLevelVM.actual() > 80 &&
           this.targetVM.value() !== null;
}

@action async launchSequence(): Promise<void> {
    if (!this.canLaunchWeapon) {
        throw new Error('Cannot launch weapon in current state');
    }
    
    // Use actual values for critical decisions
    const currentPower = this.powerLevelVM.actual();
    const weaponStatus = this.weaponStatusVM.actual();
    
    await this.weaponService.launch(currentPower, weaponStatus);
}
```

### Pattern 5: Form Validation

```typescript
// ✅ CORRECT - Validate commanded values before they become actual
@action validateFrequency(): string | null {
    const commandedFreq = this.frequencyVM.commanded();
    
    if (commandedFreq < 100 || commandedFreq > 900) {
        return 'Frequency must be between 100-900 MHz';
    }
    
    if (this.isFrequencyBandRestricted(commandedFreq)) {
        return 'Frequency is in restricted band';
    }
    
    return null; // Valid
}

@computed get frequencyValidation(): IValidationVM {
    return {
        hasError: this.validateFrequency() !== null,
        errorMessage: this.validateFrequency() || ''
    };
}
```

## Validation and Error Handling

### Property ViewModel Validation

```typescript
// Configure validation in EntityViewModel
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
        },
        labelConverter: (value) => `${value} mph`
    });
    return vm;
}

// Check validation in UI
<TextInput
    value={viewModel.speedVM.localOrCommanded().toString()}
    onChange={(value) => viewModel.speedVM.onCommandedUpdateString(value)}
    validationVM={{
        hasError: viewModel.speedVM.hasValidationError,
        errorMessage: viewModel.speedVM.validationErrorMessage
    }}
/>
```

### Error Handling Patterns

```typescript
@action async updatePowerLevel(newLevel: number): Promise<void> {
    try {
        await this.powerLevelVM.onCommandedUpdate(newLevel);
        this.clearError();
    } catch (error) {
        this.setError(`Failed to update power level: ${error.message}`);
        
        // Optionally revert to actual value
        this.powerLevelVM.onCommandedUpdate(this.powerLevelVM.actual());
    }
}
```

## Property Update Lifecycle

Understanding the lifecycle of property updates is crucial for building responsive UIs and handling asynchronous behavior correctly.

### The Commanded/Actual Pattern

The Phoenix framework uses a commanded/actual pattern for managing state changes:

1. **User Action**: User changes a value in the UI
2. **Commanded Update**: The new value is stored as "commanded" locally
3. **Server Communication**: The change is sent to the server via SignalR
4. **Server Processing**: Server validates and applies the change
5. **Actual Update**: Server pushes the new "actual" value back to all clients
6. **UI Update**: React/MobX automatically updates the UI with the new actual value

```typescript
// Timeline of a typical update
Time 0ms:    User types "Alpha Team" in name input
Time 1ms:    onCommandedUpdate("Alpha Team") called
Time 2ms:    localOrCommanded() returns "Alpha Team" (commanded value)
Time 50ms:   Change sent to server via SignalR
Time 100ms:  Server processes change
Time 150ms:  Server broadcasts update to all clients
Time 151ms:  actual() now returns "Alpha Team"
Time 152ms:  UI automatically updates (if using observer)
```

### Key Characteristics

1. **Always Asynchronous**: There is ALWAYS a delay between commanded and actual, even for local-only updates
2. **Optimistic UI**: Using `localOrCommanded()` shows changes immediately for better UX
3. **Eventual Consistency**: The actual value will eventually match the commanded value (or revert if rejected)
4. **Multi-Client Sync**: Changes are broadcast to all connected clients via SignalR

### Handling Update States

```typescript
// Property ViewModels automatically track state
const speedVM = platform.speedVM;

// Check if there's a pending change
const hasPendingChange = speedVM.commanded() !== speedVM.actual();

// Show different UI states
if (hasPendingChange) {
    // Show pending indicator
    return <Spinner size="small" />;
}

// Using LatencyInput component for automatic state handling
<LatencyInput 
    viewModel={speedVM}
    level={speedVM.level} // Automatically shows pending/error states
>
    <NumberInput
        value={speedVM.localOrCommanded()}
        onChange={(v) => speedVM.onCommandedUpdate(v)}
    />
</LatencyInput>
```

### Error Handling

When updates fail, the framework provides several mechanisms:

1. **Property-Level Errors**: The property VM's `level` property indicates state
   - `null`: No issues
   - `"pending"`: Update in progress
   - `"error"`: Update failed

2. **ViewModel-Level Errors**: Use the inherited `error()` method
   ```typescript
   try {
       await this.speedVM.onCommandedUpdate(newSpeed);
   } catch (e) {
       this.error("Failed to update speed", e);
   }
   ```

3. **Rollback**: On failure, commanded values may revert to actual values

### Best Practices for Async Updates

1. **Always use `localOrCommanded()` for form inputs** - Shows immediate feedback
2. **Use `actual()` for business logic** - Ensures decisions based on confirmed state
3. **Don't assume immediate updates** - Design UI to handle pending states
4. **Handle connection loss** - SignalR may disconnect; queue updates appropriately
5. **Provide visual feedback** - Use LatencyInput or loading indicators for long operations

## Troubleshooting

### Common Mistakes

#### ❌ WRONG: Using actual() for form inputs
```typescript
// DON'T DO THIS - Form will not show user's changes
<TextInput
    value={viewModel.nameVM.actual()}  // ❌ WRONG
    onChange={(value) => viewModel.nameVM.onCommandedUpdate(value)}
/>
```

#### ✅ CORRECT: Use localOrCommanded() for form inputs
```typescript
<TextInput
    value={viewModel.nameVM.localOrCommanded()}  // ✅ CORRECT
    onChange={(value) => viewModel.nameVM.onCommandedUpdate(value)}
/>
```

#### ❌ WRONG: Using commanded() for business logic
```typescript
// DON'T DO THIS - Logic based on user intent, not reality
if (this.speedVM.commanded() > 200) {  // ❌ WRONG
    this.enableHighSpeedMode();
}
```

#### ✅ CORRECT: Use actual() for business logic
```typescript  
// DO THIS - Logic based on actual system state
if (this.speedVM.actual() > 200) {  // ✅ CORRECT
    this.enableHighSpeedMode();
}
```

#### ❌ WRONG: Using value() on CommandedProperty
```typescript
// DON'T DO THIS - CommandedProperty doesn't have value() method
const speed = this.speedVM.value();  // ❌ RUNTIME ERROR
```

#### ✅ CORRECT: Use appropriate method for property type
```typescript
// DO THIS - Use actual() or commanded() for CommandedProperty
const currentSpeed = this.speedVM.actual();    // ✅ CORRECT
const targetSpeed = this.speedVM.commanded();  // ✅ CORRECT
```

### Debugging Tips

1. **Check Property Type**: Use browser dev tools to inspect the property type
2. **Log Values**: Compare actual vs commanded values when debugging
3. **Validation Errors**: Check `hasValidationError` and `validationErrorMessage` properties
4. **Network Issues**: Look for failed update requests in network tab

```typescript
// Debugging helper
@action debugProperty(propertyName: string): void {
    const vm = this[propertyName];
    console.log(`${propertyName}:`, {
        type: vm.constructor.name,
        actual: vm.actual?.(),
        commanded: vm.commanded?.(),
        localOrCommanded: vm.localOrCommanded?.(),
        hasError: vm.hasValidationError,
        error: vm.validationErrorMessage
    });
}
```

## Quick Reference

### Most Common Usage Patterns

| Scenario | Method to Use | Example |
|----------|---------------|---------|
| Form input binding | `.localOrCommanded()` | `<input value={vm.localOrCommanded()} />` |
| Display current state | `.actualFormatted()` | `<span>{vm.actualFormatted()}</span>` |
| Business logic decisions | `.actual()` | `if (vm.actual() > threshold)` |
| Show pending changes | `.commanded()` vs `.actual()` | `actual: ${vm.actual()}, pending: ${vm.commanded()}` |
| Handle form changes | `.onCommandedUpdate()` | `onChange={vm.onCommandedUpdate}` |
| Handle text input | `.onCommandedUpdateString()` | `onChange={vm.onCommandedUpdateString}` |

This guide covers the essential patterns for working with Property ViewModels effectively. When in doubt, use `.localOrCommanded()` for inputs and `.actualFormatted()` for displays.
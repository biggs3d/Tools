# Cookbook Patterns

This document provides actionable, copy-pasteable patterns for common development tasks in the Phoenix framework.

## Table of Contents

1. [ViewModel Creation Patterns](#viewmodel-creation-patterns)
2. [Entity Property Patterns](#entity-property-patterns)
3. [Collection Management](#collection-management)
4. [UI State Management](#ui-state-management)
5. [Parent-Child Communication](#parent-child-communication)
6. [Enum Handling](#enum-handling)
7. [Async Operations](#async-operations)
8. [Form Validation](#form-validation)
9. [Component Composition](#component-composition)

## ViewModel Creation Patterns

### Basic View-Specific ViewModel

```typescript
// File: ./exampleFeature/exampleViewModel.ts
import { IFrameworkServices } from '@tektonux/framework-api';
import { BaseViewModel } from '@tektonux/framework-shared-plugin';
import { action, computed, makeObservable, observable } from 'mobx';

export class ExampleViewModel extends BaseViewModel {
    public static class: string = 'ExampleViewModel';
    
    @observable private _value: string = '';
    @observable isLoading: boolean = false;
    
    constructor(services: IFrameworkServices) {
        super(services);
        makeObservable(this);
    }
    
    @computed get value(): string {
        return this._value;
    }
    
    @action setValue(value: string): void {
        this._value = value;
    }

    @action async fetchData(): Promise<void> {
        this.isLoading = true;
        try {
            // Async operation
            // const data = await someService.fetch();
            // this.setValue(data.someProperty);
        } catch (error) {
            this.error("Failed to fetch data", error);
        } finally {
            this.isLoading = false;
        }
    }
}
```

### EntityViewModel Pattern

```typescript
// File: ./viewmodels/discoverySettingsEntityViewModel.ts
import { BaseEntityViewModel, CommandedEnumViewModel, CommandedNumberViewModel } from '@tektonux/phoenix-core';
import { DiscoverySettings } from '../models/discoverySettingsDataModel';
import { IEntityConstructor, IFrameworkServices } from '@tektonux/framework-api';
import { TransmitterType, TransmitterTypeLabel } from '../models/enums';
import { action } from 'mobx';

export class DiscoverySettingsEntityViewModel extends BaseEntityViewModel<DiscoverySettings> {
    getEntityClassName(): string {
        return DiscoverySettings.class;
    }
    
    getEntityCtr(): IEntityConstructor<DiscoverySettings> {
        return DiscoverySettings;
    }
    
    // Property ViewModels
    get transmitterVM() {
        const vm = this.createPropertyVM('transmitter', CommandedEnumViewModel<TransmitterType>);
        vm.configure({
            labelConverter: TransmitterTypeLabel,
            defaultValue: TransmitterType.TxRx
        });
        return vm;
    }
    
    get powerLevelVM() {
        const vm = this.createPropertyVM('powerLevel', CommandedNumberViewModel);
        vm.configure({
            min: 0,
            max: 100,
            labelConverter: v => (v != null ? `${v}%` : 'N/A')
        });
        return vm;
    }
    
    @action
    async updateSettings(settings: Partial<{
        transmitter: TransmitterType;
        powerLevel: number;
    }>): Promise<void> {
        const promises: Promise<void>[] = [];
        
        if (settings.transmitter !== undefined) {
            promises.push(this.transmitterVM.onCommandedUpdate(settings.transmitter));
        }
        
        if (settings.powerLevel !== undefined) {
            promises.push(this.powerLevelVM.onCommandedUpdate(settings.powerLevel));
        }
        
        await Promise.all(promises);
    }
}
```

### ViewModel with Entity Interaction

```typescript
// File: ./teamsFeature/teamListViewModel.ts
import { IFrameworkServices, IEntityInteractor } from '@tektonux/framework-api';
import { BaseViewModel } from '@tektonux/framework-shared-plugin';
import { action, computed, makeObservable, observable } from 'mobx';
import { Team } from '@tektonux/phoenix-model';
import { TeamEntityViewModel } from '@tektonux/phoenix-core';

export class TeamListViewModel extends BaseViewModel {
    private readonly _teamInteractor: IEntityInteractor<Team>;
    @observable private _selectedTeamId: string | null = null;
    
    constructor(services: IFrameworkServices) {
        super(services);
        this._teamInteractor = this.getSharedEntityInteractor(Team.class, Team);
        makeObservable(this);
    }
    
    @computed get teamEntityVMs(): Record<string, TeamEntityViewModel> {
        return this.computeItemVMsFromItems(
            'teamEntityVMs',
            () => this._teamInteractor.getAll(),
            item => {
                const vm = new TeamEntityViewModel(this._services);
                vm.setEntityId(item.id);
                return vm;
            }
        );
    }
    
    @computed get selectedTeamVM(): TeamEntityViewModel | null {
        return this._selectedTeamId ? this.teamEntityVMs[this._selectedTeamId] ?? null : null;
    }
    
    @action setSelectedTeam(teamId: string | null): void {
        this._selectedTeamId = teamId;
    }
}
```

## Entity Property Patterns

### Working with Property ViewModels

```typescript
// Reading values from Property ViewModels
const currentValue = propertyVM.value();           // Raw value from ValueProperty
const actualValue = propertyVM.actual();          // Last known state from CommandedProperty  
const commandedValue = propertyVM.commanded();    // Desired state from CommandedProperty
const displayValue = propertyVM.localOrCommanded(); // Commanded if set, otherwise actual
const formattedValue = propertyVM.actualFormatted(); // Formatted for display

// Writing values to Property ViewModels
await propertyVM.onUpdate(newValue);                    // Update ValueProperty
await propertyVM.onCommandedUpdate(newValue);           // Update CommandedProperty
await propertyVM.onCommandedUpdateString(stringValue); // Update from string input
```

### Configuring Property ViewModels

```typescript
// Enum Property Configuration
const enumVM = this.createPropertyVM('status', CommandedEnumViewModel<StatusType>);
enumVM.configure({
    labelConverter: StatusTypeLabel,
    defaultValue: StatusType.Active,
    allowedValues: [StatusType.Active, StatusType.Inactive] // Optional restriction
});

// Number Property Configuration
const numberVM = this.createPropertyVM('speed', CommandedNumberViewModel);
numberVM.configure({
    min: 0,
    max: 100,
    step: 5,
    labelConverter: v => `${v} mph`,
    defaultValue: 0
});

// String Property Configuration
const stringVM = this.createPropertyVM('name', CommandedStringViewModel);
stringVM.configure({
    maxLength: 50,
    required: true,
    validator: (value) => value.trim().length > 0 ? null : 'Name is required'
});
```

## Collection Management

### Basic Collection with Filtering

```typescript
@computed get activeTeamVMs(): Record<string, TeamEntityViewModel> {
    return this.computeItemVMsFromItems(
        'activeTeamVMs',
        () => this._teamInteractor.getAll().filter(team => team.isActive),
        item => {
            const vm = new TeamEntityViewModel(this._services);
            vm.setEntityId(item.id);
            return vm;
        }
    );
}
```

### Advanced Collection Patterns

```typescript
// Filter by payload type
@computed get sensorVMs(): Record<string, SensorViewModel> {
    return this.computeItemVMsFromItems(
        'sensorVMs',
        () => filter(this.payloadVMs, vm => 
            vm.entityIsNotNull && 
            vm.payloadTypeVM.value() === PayloadType.SENSOR
        ),
        item => {
            const vm = new SensorViewModel(this._services);
            vm.setEntityId(item.id);
            return vm;
        }
    );
}

// Sorted collection
@computed get sortedTeamVMs(): TeamEntityViewModel[] {
    return Object.values(this.teamEntityVMs)
        .filter(vm => vm.entityIsNotNull)
        .sort((a, b) => a.nameVM.value().localeCompare(b.nameVM.value()));
}
// Note: This creates a new array on each access, but MobX's @computed 
// memoizes the result and only recalculates when dependencies change.
// For very large collections (1000+ items), consider virtualization.

// Grouped collection
@computed get teamsByStatus(): Record<string, TeamEntityViewModel[]> {
    const teams = Object.values(this.teamEntityVMs);
    return teams.reduce((groups, team) => {
        const status = team.statusVM.value();
        if (!groups[status]) groups[status] = [];
        groups[status].push(team);
        return groups;
    }, {} as Record<string, TeamEntityViewModel[]>);
}
```

### Component Collections

```typescript
// Using ComponentVMCollection for complex list management
@computed get memberVMCollection() {
    return this.createVisualPlugin('memberVMs', () => {
        const vm = new ComponentVMCollection<Member, MemberEntityViewModel, MemberItemViewModel>(this._services);
        vm.configure({
            entityClassName: Member.class,
            entityConstructor: Member,
            entityVMConstructor: MemberEntityViewModel,
            componentVMConstructor: MemberItemViewModel,
            entityFilter: item => item.teamId === this.teamId
        });
        return vm;
    });
}

@computed get memberDisplayProps() {
    return mapKVP(this.memberVMCollection.componentVMs, (id, componentVM) => ({
        key: id,
        memberItemVM: componentVM
    }));
}
```

## UI State Management

### Loading States and Error Handling

```typescript
export class SettingsViewModel extends BaseViewModel {
    @observable isLoading: boolean = false;
    @observable errorMessage: string | null = null;
    @observable showSuccessMessage: boolean = false;
    
    @action async saveSettings(): Promise<void> {
        this.isLoading = true;
        this.errorMessage = null;
        
        try {
            // Implement your save logic here
            // await this._settingsInteractor.save(this.settings);
            this.showSuccessMessage = true;
            
            // Auto-hide success message
            setTimeout(() => {
                runInAction(() => this.showSuccessMessage = false);
            }, 3000);
        } catch (error) {
            this.errorMessage = error.message || 'Failed to save settings';
        } finally {
            this.isLoading = false;
        }
    }
    
    @action clearError(): void {
        this.errorMessage = null;
    }
}
```

### Confirmation Dialogs

```typescript
export class DataManagementViewModel extends BaseViewModel {
    @observable showDeleteConfirmation: boolean = false;
    @observable itemToDelete: string | null = null;
    @observable errorMessage: string | null = null;
    
    constructor(services: IFrameworkServices) {
        super(services);
        makeObservable(this);
    }
    
    @action showDeleteDialog(itemId: string): void {
        this.itemToDelete = itemId;
        this.showDeleteConfirmation = true;
    }
    
    @action cancelDelete(): void {
        this.showDeleteConfirmation = false;
        this.itemToDelete = null;
    }
    
    @action async confirmDelete(): Promise<void> {
        if (!this.itemToDelete) return;
        
        const itemId = this.itemToDelete;
        this.showDeleteConfirmation = false;
        this.itemToDelete = null;
        
        try {
            // Implement your delete logic here
            // await this._itemInteractor.remove(itemId);
        } catch (error) {
            this.errorMessage = 'Failed to delete item';
        }
    }
}
```

### Expandable Sections

```typescript
export class AccordionViewModel extends BaseViewModel {
    @observable expandedSections: Set<string> = new Set();
    
    // This would typically come from your data source
    @computed get availableSections(): Array<{ id: string; title: string }> {
        return []; // Replace with actual sections
    }
    
    constructor(services: IFrameworkServices) {
        super(services);
        makeObservable(this);
    }
    
    @action toggleSection(sectionId: string): void {
        if (this.expandedSections.has(sectionId)) {
            this.expandedSections.delete(sectionId);
        } else {
            this.expandedSections.add(sectionId);
        }
    }
    
    @computed get isSectionExpanded() {
        return (sectionId: string) => this.expandedSections.has(sectionId);
    }
    
    @action expandAll(): void {
        this.availableSections.forEach(section => {
            this.expandedSections.add(section.id);
        });
    }
    
    @action collapseAll(): void {
        this.expandedSections.clear();
    }
}
```

## Parent-Child Communication

### Child to Parent Communication

```typescript
// Parent ViewModel
export class ParentViewModel extends BaseViewModel {
    @action handleChildAction(childId: string, action: string, data?: any): void {
        switch (action) {
            case 'delete':
                this.handleDeleteChild(childId);
                break;
            case 'update':
                this.handleUpdateChild(childId, data);
                break;
            case 'select':
                this.setSelectedChild(childId);
                break;
        }
    }
    
    @computed get childVMs(): Record<string, ChildViewModel> {
        return this.computeItemVMsFromItems(
            'childVMs',
            () => this.getChildItems(),
            item => {
                const vm = new ChildViewModel(this._services, item.id);
                vm.setParentActionHandler(this.handleChildAction.bind(this));
                return vm;
            }
        );
    }
}

// Child ViewModel
export class ChildViewModel extends BaseViewModel {
    private _parentActionHandler?: (childId: string, action: string, data?: any) => void;
    
    setParentActionHandler(handler: (childId: string, action: string, data?: any) => void): void {
        this._parentActionHandler = handler;
    }
    
    @action notifyParent(action: string, data?: any): void {
        if (this._parentActionHandler) {
            this._parentActionHandler(this.id, action, data);
        }
    }
    
    @action handleDelete(): void {
        this.notifyParent('delete');
    }
    
    @action handleUpdate(newData: any): void {
        this.notifyParent('update', newData);
    }
}
```

### Plugin-based Child Creation

```typescript
// Single child plugin
@computed get settingsVM() {
    return this.createVisualPlugin('settings', () => {
        return new SettingsViewModel(this._services);
    });
}

// Multiple children from IDs
@computed get childVMsFromIds(): Record<string, ChildViewModel> {
    return this.computeItemVMsFromIds(
        'childVMs',
        () => this.childIds,
        id => {
            const vm = new ChildViewModel(this._services);
            vm.setEntityId(id);
            return vm;
        }
    );
}
```

## Enum Handling

### Enum Options for UI Components

```typescript
// Get numeric enum values for dropdowns
@computed get transmitterModeOptions(): TransmitterModeType[] {
    return Object.values(TransmitterModeType).filter(v => typeof v === 'number') as TransmitterModeType[];
}

// Usage in Select component
<Select 
    value={viewModel.transmitterModeVM.commanded()}
    onValueChange={(value) => viewModel.transmitterModeVM.onCommandedUpdate(value)}
>
    {viewModel.transmitterModeOptions.map(option => (
        <SelectItem key={option} value={option}>
            {TransmitterModeTypeLabel[option] ?? option.toString()}
        </SelectItem>
    ))}
</Select>
```

### Enum Label Converters

```typescript
// Define label converter
export const StatusTypeLabel: Record<StatusType, string> = {
    [StatusType.Active]: 'Active',
    [StatusType.Inactive]: 'Inactive',
    [StatusType.Pending]: 'Pending',
    [StatusType.Suspended]: 'Suspended'
};

// Use in Property VM configuration
const statusVM = this.createPropertyVM('status', CommandedEnumViewModel<StatusType>);
statusVM.configure({
    labelConverter: StatusTypeLabel,
    defaultValue: StatusType.Active
});

// String getters for UI binding
@computed get statusString(): string {
    return StatusTypeLabel[this.statusVM.value()] ?? 'Unknown';
}

@action setStatusFromString(statusString: string): void {
    const statusType = Object.entries(StatusTypeLabel)
        .find(([_, label]) => label === statusString)?.[0];
    if (statusType) {
        this.statusVM.onCommandedUpdate(Number(statusType) as StatusType);
    }
}
```

## Async Operations

### Proper MobX Async Patterns

```typescript
// Correct async/await with runInAction
@action async fetchData(): Promise<void> {
    this.isLoading = true;
    
    try {
        const result = await this.dataService.fetchData();
        
        // Use runInAction after await
        runInAction(() => {
            this.data = result;
            this.lastUpdated = new Date();
        });
    } catch (error) {
        runInAction(() => {
            this.errorMessage = error.message;
        });
    } finally {
        runInAction(() => {
            this.isLoading = false;
        });
    }
}

// Alternative using action wrapper
@action async saveData(data: any): Promise<void> {
    this.isLoading = true;
    this.errorMessage = null;
    
    try {
        const result = await this.dataService.saveData(data);
        
        const updateState = action('updateAfterSave', () => {
            this.data = result;
            this.hasUnsavedChanges = false;
            this.showSuccessMessage = true;
        });
        
        updateState();
    } catch (error) {
        const handleError = action('handleSaveError', () => {
            this.errorMessage = 'Failed to save data';
        });
        
        handleError();
    } finally {
        runInAction(() => {
            this.isLoading = false;
        });
    }
}
```

### Debounced Operations

```typescript
import { debounce } from 'lodash';

export class SearchViewModel extends BaseViewModel {
    @observable searchTerm: string = '';
    @observable searchResults: any[] = [];
    @observable isSearching: boolean = false;
    
    private debouncedSearch: any;
    
    constructor(services: IFrameworkServices) {
        super(services);
        this.debouncedSearch = debounce(this.performSearch.bind(this), 300);
        makeObservable(this);
    }
    
    @action setSearchTerm(term: string): void {
        this.searchTerm = term;
        if (term.trim()) {
            this.debouncedSearch();
        } else {
            this.searchResults = [];
        }
    }
    
    @action private async performSearch(): Promise<void> {
        this.isSearching = true;
        
        try {
            // Implement your search logic here
            // const results = await this._searchService.search(this.searchTerm);
            const results: any[] = []; // Replace with actual search
            runInAction(() => {
                this.searchResults = results;
            });
        } catch (error) {
            runInAction(() => {
                this.searchResults = [];
            });
        } finally {
            runInAction(() => {
                this.isSearching = false;
            });
        }
    }
}
```

## Form Validation

### Validation Patterns

The Phoenix framework supports two validation approaches:

#### Property-Level Validation (Simple Rules)
Use for simple, self-contained validation rules:

```typescript
// Configure validation directly on Property ViewModel
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

get nameVM() {
    const vm = this.createPropertyVM('name', CommandedStringViewModel);
    vm.configure({
        required: true,
        maxLength: 50,
        validator: (value) => {
            if (!value || value.trim().length === 0) {
                return 'Name is required';
            }
            if (value.length > 50) {
                return 'Name must be 50 characters or less';
            }
            return null;
        }
    });
    return vm;
}

// Usage in View
<TextInput
    value={viewModel.nameVM.localOrCommanded()}
    onChange={(value) => viewModel.nameVM.onCommandedUpdate(value)}
    validationVM={{
        hasError: viewModel.nameVM.hasValidationError,
        errorMessage: viewModel.nameVM.validationErrorMessage
    }}
/>
```

#### Dedicated Validation ViewModel (Complex Rules)
Use for complex, cross-field validation or shared validation state:

```typescript
export class FormValidationViewModel extends BaseViewModel {
    @observable private _validationErrors: Map<string, string> = new Map();
    @observable private _formData: Map<string, any> = new Map();
    
    constructor(services: IFrameworkServices) {
        super(services);
        makeObservable(this);
    }
    
    private getFieldValue(fieldName: string): any {
        return this._formData.get(fieldName);
    }
    
    @action setFieldValue(fieldName: string, value: any): void {
        this._formData.set(fieldName, value);
    }
    
    @computed get hasValidationErrors(): boolean {
        return this._validationErrors.size > 0;
    }
    
    @computed get validationErrors(): Record<string, string> {
        return Object.fromEntries(this._validationErrors);
    }
    
    // Individual field validations
    @computed get nameValidation(): IValidationVM {
        const name = this.getFieldValue('name');
        
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
    
    @computed get emailValidation(): IValidationVM {
        const email = this.getFieldValue('email');
        
        if (!email || !email.includes('@')) {
            return {
                hasError: true,
                errorMessage: 'Valid email address is required'
            };
        }
        
        return { hasError: false };
    }
    
    // Cross-field validation
    @computed get passwordConfirmValidation(): IValidationVM {
        const password = this.getFieldValue('password');
        const confirmPassword = this.getFieldValue('confirmPassword');
        
        if (password !== confirmPassword) {
            return {
                hasError: true,
                errorMessage: 'Passwords do not match'
            };
        }
        
        return { hasError: false };
    }
    
    @computed get isFormValid(): boolean {
        return !this.nameValidation.hasError && 
               !this.emailValidation.hasError &&
               !this.passwordConfirmValidation.hasError;
    }
    
    @action validateAll(): boolean {
        // Trigger all computed validations by accessing them
        const validations = [
            this.nameValidation,
            this.emailValidation,
            this.passwordConfirmValidation
        ];
        
        return validations.every(validation => !validation.hasError);
    }
}

// Usage in View
<TextInput
    value={viewModel.name}
    onChange={viewModel.setName}
    validationVM={viewModel.validationVM.nameValidation}
    placeholder="Enter name"
/>

<TextInput
    value={viewModel.email}
    onChange={viewModel.setEmail}
    validationVM={viewModel.validationVM.emailValidation}
    placeholder="Enter email"
/>
```

#### When to Use Each Pattern

**Use Property-Level Validation when:**
- Simple rules (required, min/max, format)
- Single field validation
- Built-in Property ViewModel validation is sufficient

**Use Dedicated Validation ViewModel when:**
- Complex business rules
- Cross-field validation (password confirmation, date ranges)
- Multiple components need shared validation state
- Custom validation logic that doesn't fit Property ViewModel patterns
```

## Component Composition

### Complex View Composition

```typescript
// View combining multiple patterns
export const TeamManagementView = observer(({ viewModel }: { viewModel: TeamManagementViewModel }) => {
    return (
        <div className="team-management">
            {/* Loading state */}
            {viewModel.isLoading && <LoadingSpinner />}
            
            {/* Error message */}
            {viewModel.errorMessage && (
                <Alert variant="error" onClose={() => viewModel.clearError()}>
                    {viewModel.errorMessage}
                </Alert>
            )}
            
            {/* Success message */}
            {viewModel.showSuccessMessage && (
                <Alert variant="success">
                    Operation completed successfully
                </Alert>
            )}
            
            {/* Search and filters */}
            <div className="controls">
                <TextInput
                    placeholder="Search teams..."
                    value={viewModel.searchTerm}
                    onChange={viewModel.setSearchTerm}
                    scale="medium"
                />
                
                <Select
                    value={viewModel.selectedStatus}
                    onValueChange={viewModel.setSelectedStatus}
                >
                    {viewModel.statusOptions.map(status => (
                        <SelectItem key={status} value={status}>
                            {StatusTypeLabel[status]}
                        </SelectItem>
                    ))}
                </Select>
            </div>
            
            {/* Team list */}
            <div className="team-list">
                {viewModel.filteredTeams.map(team => (
                    <TeamItemView
                        key={team.id}
                        viewModel={team}
                        onEdit={() => viewModel.editTeam(team.id)}
                        onDelete={() => viewModel.showDeleteDialog(team.id)}
                    />
                ))}
            </div>
            
            {/* Confirmation dialog */}
            {viewModel.showDeleteConfirmation && (
                <ConfirmDialog
                    title="Delete Team"
                    message="Are you sure you want to delete this team?"
                    onConfirm={viewModel.confirmDelete}
                    onCancel={viewModel.cancelDelete}
                />
            )}
        </div>
    );
});
```

## Complete Form Example with Validation

### Full Form Implementation Pattern

```typescript
// ViewModel: SettingsFormViewModel.ts
import { IFrameworkServices } from '@tektonux/framework-api';
import { BaseViewModel } from '@tektonux/framework-shared-plugin';
import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import { SettingsEntityViewModel } from './settingsEntityViewModel';

export class SettingsFormViewModel extends BaseViewModel {
    @observable isSubmitting: boolean = false;
    @observable submitError: string | null = null;
    @observable showSuccess: boolean = false;
    
    private readonly _settingsVM: SettingsEntityViewModel;
    
    constructor(services: IFrameworkServices) {
        super(services);
        this._settingsVM = this.createVisualPlugin('settingsVM', 
            () => new SettingsEntityViewModel(this._services));
        makeObservable(this);
    }
    
    @computed get settingsVM(): SettingsEntityViewModel {
        return this._settingsVM;
    }
    
    @computed get isFormValid(): boolean {
        // Check all required fields
        return this.settingsVM.nameVM.localOrCommanded()?.trim().length > 0 &&
               this.settingsVM.powerLevelVM.localOrCommanded() >= 0 &&
               !this.settingsVM.nameVM.hasValidationError;
    }
    
    @action async submitForm(): Promise<void> {
        if (!this.isFormValid) return;
        
        this.isSubmitting = true;
        this.submitError = null;
        
        try {
            // Update all commanded values
            await Promise.all([
                this.settingsVM.nameVM.onCommandedUpdate(
                    this.settingsVM.nameVM.localOrCommanded()
                ),
                this.settingsVM.powerLevelVM.onCommandedUpdate(
                    this.settingsVM.powerLevelVM.localOrCommanded()
                ),
                this.settingsVM.transmitterVM.onCommandedUpdate(
                    this.settingsVM.transmitterVM.localOrCommanded()
                )
            ]);
            
            runInAction(() => {
                this.showSuccess = true;
                // Auto-hide after 3 seconds
                setTimeout(() => {
                    runInAction(() => this.showSuccess = false);
                }, 3000);
            });
        } catch (error) {
            runInAction(() => {
                this.submitError = error.message || 'Failed to save settings';
            });
        } finally {
            runInAction(() => {
                this.isSubmitting = false;
            });
        }
    }
    
    @action clearError(): void {
        this.submitError = null;
    }
}

// View: SettingsFormView.tsx
import { observer } from 'mobx-react';
import { TextInput, NumberInput, Select, SelectItem, Button, Alert } from '@tektonux/phoenix-components-shared';
import { TransmitterTypeLabel } from '../models/enums';

export const SettingsFormView = observer(({ viewModel }: { viewModel: SettingsFormViewModel }) => {
    const { settingsVM } = viewModel;
    
    return (
        <form className="settings-form" onSubmit={(e) => { e.preventDefault(); viewModel.submitForm(); }}>
            {/* Success Alert */}
            {viewModel.showSuccess && (
                <Alert variant="success" className="mb-3">
                    Settings saved successfully!
                </Alert>
            )}
            
            {/* Error Alert */}
            {viewModel.submitError && (
                <Alert 
                    variant="error" 
                    className="mb-3"
                    onClose={() => viewModel.clearError()}
                >
                    {viewModel.submitError}
                </Alert>
            )}
            
            {/* Name Input with Validation */}
            <div className="form-group">
                <Label text="Name *" />
                <TextInput
                    value={settingsVM.nameVM.localOrCommanded()}
                    onChange={(value) => settingsVM.nameVM.onCommandedUpdate(value)}
                    validationVM={{
                        hasError: settingsVM.nameVM.hasValidationError,
                        errorMessage: settingsVM.nameVM.validationErrorMessage
                    }}
                    disabled={viewModel.isSubmitting}
                />
            </div>
            
            {/* Power Level with Range */}
            <div className="form-group">
                <Label text="Power Level" />
                <NumberInput
                    value={settingsVM.powerLevelVM.localOrCommanded()}
                    onChange={(value) => settingsVM.powerLevelVM.onCommandedUpdate(value)}
                    min={settingsVM.powerLevelVM.min}
                    max={settingsVM.powerLevelVM.max}
                    step={5}
                    disabled={viewModel.isSubmitting}
                />
                <span className="help-text">
                    Range: {settingsVM.powerLevelVM.min} - {settingsVM.powerLevelVM.max}
                </span>
            </div>
            
            {/* Transmitter Type Dropdown */}
            <div className="form-group">
                <Label text="Transmitter Type" />
                <Select
                    value={settingsVM.transmitterVM.commanded()}
                    onValueChange={(value) => settingsVM.transmitterVM.onCommandedUpdate(value)}
                    disabled={viewModel.isSubmitting}
                >
                    {Object.values(TransmitterType)
                        .filter(v => typeof v === 'number')
                        .map((option) => (
                            <SelectItem key={option} value={option}>
                                {TransmitterTypeLabel[option] ?? option.toString()}
                            </SelectItem>
                        ))}
                </Select>
            </div>
            
            {/* Submit Button */}
            <div className="form-actions">
                <Button
                    type="submit"
                    variant="primary"
                    disabled={!viewModel.isFormValid || viewModel.isSubmitting}
                    loading={viewModel.isSubmitting}
                >
                    Save Settings
                </Button>
            </div>
        </form>
    );
});
```

## Collection with Selection Pattern

### Complete List with Selection Management

```typescript
// ViewModel: PlatformListViewModel.ts
import { IFrameworkServices, IEntityInteractor } from '@tektonux/framework-api';
import { BaseViewModel } from '@tektonux/framework-shared-plugin';
import { action, computed, makeObservable, observable } from 'mobx';
import { Platform } from '@tektonux/phoenix-model';
import { PlatformEntityViewModel } from '@tektonux/phoenix-core';

export class PlatformListViewModel extends BaseViewModel {
    @observable selectedPlatformIds: Set<string> = new Set();
    @observable searchFilter: string = '';
    @observable sortField: 'name' | 'status' | 'team' = 'name';
    @observable sortDirection: 'asc' | 'desc' = 'asc';
    
    private readonly _platformInteractor: IEntityInteractor<Platform>;
    
    constructor(services: IFrameworkServices) {
        super(services);
        this._platformInteractor = this.getSharedEntityInteractor(Platform.class, Platform);
        makeObservable(this);
    }
    
    @computed get platformVMs(): Record<string, PlatformEntityViewModel> {
        return this.computeItemVMsFromItems(
            'platformVMs',
            () => this._platformInteractor.getAll(),
            item => {
                const vm = new PlatformEntityViewModel(this._services);
                vm.setEntityId(item.id);
                return vm;
            }
        );
    }
    
    @computed get filteredPlatforms(): PlatformEntityViewModel[] {
        const platforms = Object.values(this.platformVMs);
        
        // Apply search filter
        const filtered = this.searchFilter 
            ? platforms.filter(p => 
                p.nameVM.actual()?.toLowerCase().includes(this.searchFilter.toLowerCase())
              )
            : platforms;
        
        // Apply sorting
        return filtered.sort((a, b) => {
            let compareValue = 0;
            
            switch (this.sortField) {
                case 'name':
                    compareValue = (a.nameVM.actual() || '').localeCompare(b.nameVM.actual() || '');
                    break;
                case 'status':
                    compareValue = (a.statusVM.actual() || 0) - (b.statusVM.actual() || 0);
                    break;
                case 'team':
                    compareValue = (a.teamId.value() || '').localeCompare(b.teamId.value() || '');
                    break;
            }
            
            return this.sortDirection === 'asc' ? compareValue : -compareValue;
        });
    }
    
    @computed get selectedPlatforms(): PlatformEntityViewModel[] {
        return Array.from(this.selectedPlatformIds)
            .map(id => this.platformVMs[id])
            .filter(Boolean);
    }
    
    @computed get isAllSelected(): boolean {
        const filtered = this.filteredPlatforms;
        return filtered.length > 0 && 
               filtered.every(p => this.selectedPlatformIds.has(p.id));
    }
    
    @computed get isPartiallySelected(): boolean {
        const filtered = this.filteredPlatforms;
        return filtered.some(p => this.selectedPlatformIds.has(p.id)) && 
               !this.isAllSelected;
    }
    
    @action togglePlatformSelection(platformId: string): void {
        if (this.selectedPlatformIds.has(platformId)) {
            this.selectedPlatformIds.delete(platformId);
        } else {
            this.selectedPlatformIds.add(platformId);
        }
    }
    
    @action toggleAllSelection(): void {
        if (this.isAllSelected) {
            // Deselect all
            this.selectedPlatformIds.clear();
        } else {
            // Select all filtered
            this.filteredPlatforms.forEach(p => {
                this.selectedPlatformIds.add(p.id);
            });
        }
    }
    
    @action setSearchFilter(value: string): void {
        this.searchFilter = value;
    }
    
    @action setSorting(field: 'name' | 'status' | 'team'): void {
        if (this.sortField === field) {
            // Toggle direction
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }
    }
    
    @action async deleteSelected(): Promise<void> {
        const idsToDelete = Array.from(this.selectedPlatformIds);
        await this._platformInteractor.remove(...idsToDelete);
        this.selectedPlatformIds.clear();
    }
}

// View: PlatformListView.tsx
export const PlatformListView = observer(({ viewModel }: { viewModel: PlatformListViewModel }) => {
    return (
        <div className="platform-list">
            {/* Search and Bulk Actions */}
            <div className="list-controls">
                <TextInput
                    placeholder="Search platforms..."
                    value={viewModel.searchFilter}
                    onChange={viewModel.setSearchFilter}
                    leftIcon={<SearchIcon />}
                />
                
                {viewModel.selectedPlatforms.length > 0 && (
                    <div className="bulk-actions">
                        <span>{viewModel.selectedPlatforms.length} selected</span>
                        <Button 
                            variant="danger" 
                            scale="small"
                            onClick={() => viewModel.deleteSelected()}
                        >
                            Delete Selected
                        </Button>
                    </div>
                )}
            </div>
            
            {/* List Header */}
            <div className="list-header">
                <Checkbox
                    checked={viewModel.isAllSelected}
                    indeterminate={viewModel.isPartiallySelected}
                    onChange={() => viewModel.toggleAllSelection()}
                />
                
                <Button
                    variant="ghost"
                    onClick={() => viewModel.setSorting('name')}
                    rightIcon={viewModel.sortField === 'name' ? 
                        (viewModel.sortDirection === 'asc' ? <ArrowUp /> : <ArrowDown />) : 
                        null
                    }
                >
                    Name
                </Button>
                
                <Button
                    variant="ghost"
                    onClick={() => viewModel.setSorting('status')}
                    rightIcon={viewModel.sortField === 'status' ? 
                        (viewModel.sortDirection === 'asc' ? <ArrowUp /> : <ArrowDown />) : 
                        null
                    }
                >
                    Status
                </Button>
            </div>
            
            {/* List Items */}
            <div className="list-items">
                {viewModel.filteredPlatforms.map(platform => (
                    <div 
                        key={platform.id} 
                        className={cn(
                            "list-item",
                            viewModel.selectedPlatformIds.has(platform.id) && "selected"
                        )}
                    >
                        <Checkbox
                            checked={viewModel.selectedPlatformIds.has(platform.id)}
                            onChange={() => viewModel.togglePlatformSelection(platform.id)}
                        />
                        
                        <div className="item-content">
                            <span className="item-name">
                                {platform.nameVM.actualFormatted()}
                            </span>
                            <span className="item-status">
                                {platform.statusVM.actualFormatted()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
});
```

## Async Property Updates with Loading States

### Property-Level Loading Pattern

```typescript
// Using LatencyInput for property-level loading states
import { LatencyInput } from '@tektonux/framework-visual-react-components';
import { PropertyValueOverlay } from '@tektonux/framework-visual-react-components';

// View with property-level loading indicators
export const ConfigurationView = observer(({ viewModel }: { viewModel: ConfigViewModel }) => {
    return (
        <div className="configuration-form">
            {/* Input with latency/loading state */}
            <LatencyInput 
                viewModel={viewModel.settingsVM.powerLevelVM}
                level={viewModel.settingsVM.powerLevelVM.level}
            >
                <NumberInput
                    value={viewModel.settingsVM.powerLevelVM.localOrCommanded()}
                    onChange={(value) => viewModel.settingsVM.powerLevelVM.onCommandedUpdate(value)}
                    min={0}
                    max={100}
                />
            </LatencyInput>
            
            {/* Property overlay for tracing/debugging */}
            <PropertyValueOverlay 
                viewModel={viewModel.settingsVM.transmitterVM}
            >
                <Select
                    value={viewModel.settingsVM.transmitterVM.actualFormatted()}
                    onValueChange={(value) => {
                        viewModel.settingsVM.transmitterVM.onCommandedUpdate(value);
                    }}
                >
                    {/* Options */}
                </Select>
            </PropertyValueOverlay>
            
            {/* Manual loading state handling */}
            <div className="property-wrapper">
                <TextInput
                    value={viewModel.nameVM.localOrCommanded()}
                    onChange={(value) => viewModel.handleNameUpdate(value)}
                    disabled={viewModel.isNameUpdating}
                />
                {viewModel.isNameUpdating && <Spinner size="small" />}
            </div>
        </div>
    );
});

// ViewModel with manual loading state
export class ConfigViewModel extends BaseViewModel {
    @observable isNameUpdating: boolean = false;
    private readonly _settingsVM: SettingsEntityViewModel;
    
    constructor(services: IFrameworkServices) {
        super(services);
        this._settingsVM = this.createVisualPlugin('settingsVM', 
            () => new SettingsEntityViewModel(this._services));
        makeObservable(this);
    }
    
    get nameVM() {
        return this._settingsVM.nameVM;
    }
    
    @action async handleNameUpdate(value: string): Promise<void> {
        this.isNameUpdating = true;
        
        try {
            await this.nameVM.onCommandedUpdate(value);
            
            // Additional async operations if needed
            // await this.validateNameUniqueness(value);
            
        } catch (error) {
            runInAction(() => {
                this.error('Failed to update name', error);
            });
        } finally {
            runInAction(() => {
                this.isNameUpdating = false;
            });
        }
    }
}
```

## Scenario File Creation Pattern

### Adding Entities to Scenarios

```typescript
// Example scenario file structure for testing
// server/configuration/scenarios/my-test-scenario.json
[
  {
    "type": "Add",
    "time": 0,
    "data": {
      "id": "platform-1",
      "className": "quicktype.Platform",
      "name": {
        "value": "Alpha Platform"
      },
      "latitude": {
        "actual": 34.702035
      },
      "longitude": {
        "actual": -113.105874
      },
      "altitude": {
        "min": 0,
        "max": 50000,
        "actual": 10000,
        "commanded": 10000
      },
      "speed": {
        "min": 0,
        "max": 500,
        "actual": 250,
        "commanded": 250
      },
      "status": {
        "value": 1  // Enum value (numeric)
      },
      "teamId": {
        "value": "team-alpha"
      }
    }
  },
  {
    "type": "Update",
    "time": 5000,  // 5 seconds later
    "data": {
      "id": "platform-1",
      "speed": {
        "commanded": 300  // Update commanded speed
      }
    }
  },
  {
    "type": "Add",
    "time": 0,
    "data": {
      "id": "team-alpha",
      "className": "quicktype.Team",
      "name": {
        "value": "Alpha Team"
      },
      "platformIds": {
        "value": ["platform-1"]
      }
    }
  }
]

// Key patterns for scenario files:
// 1. ValueProperty: use "value" key
// 2. CommandedProperty: use "actual" and "commanded" keys
// 3. RangedCommandedProperty: use "min", "max", "actual", and "commanded" keys
// 4. Arrays: use "value" with array
// 5. Enums: use numeric values
// 6. Times are in milliseconds
// 7. className must match the generated model class
```

This cookbook provides the essential patterns you'll need for most development tasks in the Phoenix framework. Each pattern is designed to be copy-pasteable and adaptable to your specific use case.
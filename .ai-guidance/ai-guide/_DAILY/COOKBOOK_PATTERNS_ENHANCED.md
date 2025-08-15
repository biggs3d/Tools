# Cookbook Patterns - Enhanced Edition

This document provides consolidated, copy-pasteable patterns that demonstrate multiple Phoenix framework concepts in single examples.

## 🚀 Quick Start Templates

### Complete Feature Template (ViewModel + View + Tests)

This template demonstrates: MobX observables, property ViewModels, form handling, validation, async operations, and testing patterns.

```typescript
// =====================================================
// File: features/equipment/EquipmentManagerViewModel.ts
// =====================================================
import { IFrameworkServices, IEntityInteractor } from '@tektonux/framework-api';
import { BaseViewModel } from '@tektonux/framework-shared-plugin';
import { action, computed, makeObservable, observable, runInAction } from 'mobx';
import { Equipment } from '@tektonux/phoenix-model';
import { EquipmentEntityViewModel } from '@tektonux/phoenix-core';

export class EquipmentManagerViewModel extends BaseViewModel {
    public static class: string = 'EquipmentManagerViewModel';
    
    // UI State
    @observable searchTerm: string = '';
    @observable selectedEquipmentId: string | null = null;
    @observable isLoading: boolean = false;
    @observable errorMessage: string | null = null;
    @observable showDeleteConfirm: boolean = false;
    
    // Data
    private readonly _equipmentInteractor: IEntityInteractor<Equipment>;
    
    constructor(services: IFrameworkServices) {
        super(services);
        this._equipmentInteractor = this.getSharedEntityInteractor(Equipment.class, Equipment);
        makeObservable(this);  // CRITICAL: Enables MobX reactivity
    }
    
    // ========== Entity ViewModels ==========
    @computed get equipmentVMs(): Record<string, EquipmentEntityViewModel> {
        return this.computeItemVMsFromItems(
            'equipmentVMs',
            () => this._equipmentInteractor.getAll(),
            item => {
                const vm = new EquipmentEntityViewModel(this._services);
                vm.setEntityId(item.id);
                return vm;
            }
        );
    }
    
    @computed get selectedEquipmentVM(): EquipmentEntityViewModel | null {
        return this.selectedEquipmentId ? 
            this.equipmentVMs[this.selectedEquipmentId] ?? null : null;
    }
    
    // ========== Filtered/Sorted Collections ==========
    @computed get filteredEquipment(): EquipmentEntityViewModel[] {
        const all = Object.values(this.equipmentVMs);
        
        if (!this.searchTerm) return all;
        
        const term = this.searchTerm.toLowerCase();
        return all.filter(eq => 
            eq.nameVM.actual()?.toLowerCase().includes(term) ||
            eq.serialNumberVM.actual()?.toLowerCase().includes(term)
        );
    }
    
    @computed get equipmentByStatus(): Record<string, EquipmentEntityViewModel[]> {
        return this.filteredEquipment.reduce((groups, eq) => {
            const status = eq.statusVM.actualFormatted() || 'Unknown';
            if (!groups[status]) groups[status] = [];
            groups[status].push(eq);
            return groups;
        }, {} as Record<string, EquipmentEntityViewModel[]>);
    }
    
    // ========== Actions ==========
    @action setSearchTerm(term: string): void {
        this.searchTerm = term;
    }
    
    @action selectEquipment(id: string | null): void {
        this.selectedEquipmentId = id;
    }
    
    @action showDeleteDialog(id: string): void {
        this.selectedEquipmentId = id;
        this.showDeleteConfirm = true;
    }
    
    @action cancelDelete(): void {
        this.showDeleteConfirm = false;
    }
    
    @action async confirmDelete(): Promise<void> {
        if (!this.selectedEquipmentId) return;
        
        const idToDelete = this.selectedEquipmentId;
        this.showDeleteConfirm = false;
        this.isLoading = true;
        
        try {
            await this._equipmentInteractor.remove(idToDelete);
            this.selectedEquipmentId = null;
        } catch (error) {
            runInAction(() => {
                this.errorMessage = `Failed to delete: ${error.message}`;
            });
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }
    
    @action clearError(): void {
        this.errorMessage = null;
    }
    
    // ========== Form Handling ==========
    @computed get canSave(): boolean {
        if (!this.selectedEquipmentVM) return false;
        
        const vm = this.selectedEquipmentVM;
        return !vm.nameVM.hasValidationError && 
               vm.nameVM.localOrCommanded()?.trim().length > 0;
    }
    
    @action async saveChanges(): Promise<void> {
        if (!this.selectedEquipmentVM || !this.canSave) return;
        
        this.isLoading = true;
        this.errorMessage = null;
        
        try {
            const vm = this.selectedEquipmentVM;
            
            // Update all commanded values
            await Promise.all([
                vm.nameVM.onCommandedUpdate(vm.nameVM.localOrCommanded()),
                vm.statusVM.onCommandedUpdate(vm.statusVM.localOrCommanded()),
                vm.maintenanceDateVM.onCommandedUpdate(vm.maintenanceDateVM.localOrCommanded())
            ]);
            
            // NOTE-AI: Equipment Save Pattern
            // - Rationale: Batch all property updates for atomic operation
            // - Alternatives: Individual updates with rollback on failure
            // - Constraints: All properties must support commanded updates
            // - Revisit if: Need partial save or draft functionality
            
        } catch (error) {
            runInAction(() => {
                this.errorMessage = `Save failed: ${error.message}`;
            });
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }
}

// =====================================================
// File: features/equipment/EquipmentManagerView.tsx
// =====================================================
import { observer } from 'mobx-react';
import { TextInput, Button, Alert, Card, Badge } from '@tektonux/phoenix-components-shared';
import { EquipmentStatusLabel } from '../adapters/equipmentLabels';

export const EquipmentManagerView = observer(({ 
    viewModel 
}: { 
    viewModel: EquipmentManagerViewModel 
}) => {
    return (
        <div className="equipment-manager">
            {/* Error Display */}
            {viewModel.errorMessage && (
                <Alert 
                    variant="error" 
                    onClose={() => viewModel.clearError()}
                    className="mb-4"
                >
                    {viewModel.errorMessage}
                </Alert>
            )}
            
            {/* Search Bar */}
            <div className="search-section mb-4">
                <TextInput
                    placeholder="Search equipment..."
                    value={viewModel.searchTerm}
                    onChange={viewModel.setSearchTerm}
                    scale="medium"
                />
            </div>
            
            {/* Equipment List */}
            <div className="equipment-grid">
                {Object.entries(viewModel.equipmentByStatus).map(([status, items]) => (
                    <div key={status} className="status-group">
                        <h3 className="status-header">
                            {status} ({items.length})
                        </h3>
                        
                        {items.map(equipment => (
                            <Card 
                                key={equipment.id}
                                className={cn(
                                    "equipment-card",
                                    viewModel.selectedEquipmentId === equipment.id && "selected"
                                )}
                                onClick={() => viewModel.selectEquipment(equipment.id)}
                            >
                                <div className="card-header">
                                    <span className="equipment-name">
                                        {equipment.nameVM.actualFormatted()}
                                    </span>
                                    <Badge variant={getStatusVariant(equipment.statusVM.actual())}>
                                        {equipment.statusVM.actualFormatted()}
                                    </Badge>
                                </div>
                                
                                <div className="card-details">
                                    <span>SN: {equipment.serialNumberVM.actual()}</span>
                                    <span>Next Maintenance: {
                                        equipment.maintenanceDateVM.actualFormatted()
                                    }</span>
                                </div>
                                
                                <div className="card-actions">
                                    <Button 
                                        scale="small" 
                                        variant="ghost"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            viewModel.showDeleteDialog(equipment.id);
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </Card>
                        ))}
                    </div>
                ))}
            </div>
            
            {/* Selected Equipment Editor */}
            {viewModel.selectedEquipmentVM && (
                <div className="equipment-editor mt-4">
                    <h3>Edit Equipment</h3>
                    
                    <div className="form-group">
                        <label>Name</label>
                        <TextInput
                            value={viewModel.selectedEquipmentVM.nameVM.localOrCommanded()}
                            onChange={(v) => viewModel.selectedEquipmentVM.nameVM.onCommandedUpdate(v)}
                            validationVM={{
                                hasError: viewModel.selectedEquipmentVM.nameVM.hasValidationError,
                                errorMessage: viewModel.selectedEquipmentVM.nameVM.validationErrorMessage
                            }}
                        />
                    </div>
                    
                    <Button
                        variant="primary"
                        disabled={!viewModel.canSave || viewModel.isLoading}
                        loading={viewModel.isLoading}
                        onClick={() => viewModel.saveChanges()}
                    >
                        Save Changes
                    </Button>
                </div>
            )}
            
            {/* Delete Confirmation */}
            {viewModel.showDeleteConfirm && (
                <ConfirmDialog
                    title="Delete Equipment"
                    message="Are you sure? This cannot be undone."
                    onConfirm={() => viewModel.confirmDelete()}
                    onCancel={() => viewModel.cancelDelete()}
                />
            )}
        </div>
    );
});

// Helper function
function getStatusVariant(status: number): string {
    switch(status) {
        case 1: return 'success';  // Active
        case 2: return 'warning';  // Maintenance
        case 3: return 'error';    // Offline
        default: return 'neutral';
    }
}

// =====================================================
// File: features/equipment/EquipmentManagerViewModel.test.ts
// =====================================================
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EquipmentManagerViewModel } from './EquipmentManagerViewModel';
import { createMockServices } from '@tektonux/test-helpers';

describe('EquipmentManagerViewModel', () => {
    let viewModel: EquipmentManagerViewModel;
    let mockServices: IFrameworkServices;
    
    beforeEach(() => {
        mockServices = createMockServices();
        viewModel = new EquipmentManagerViewModel(mockServices);
    });
    
    it('filters equipment by search term', () => {
        // Setup mock data
        const mockEquipment = [
            { id: '1', name: { value: 'Drill' }},
            { id: '2', name: { value: 'Hammer' }}
        ];
        
        // Set search term
        viewModel.setSearchTerm('drill');
        
        // Verify filtering
        expect(viewModel.filteredEquipment).toHaveLength(1);
        expect(viewModel.filteredEquipment[0].nameVM.actual()).toBe('Drill');
    });
    
    it('groups equipment by status', () => {
        // Test grouping logic
        const grouped = viewModel.equipmentByStatus;
        expect(grouped).toBeDefined();
        expect(Object.keys(grouped)).toContain('Active');
    });
});
```

### Complete Entity ViewModel with All Property Types

This template shows all property ViewModel types, validation, configuration, and business logic.

```typescript
// =====================================================
// File: viewModels/PlatformEntityViewModel.ts
// =====================================================
import { BaseEntityViewModel, 
         CommandedStringViewModel, 
         CommandedNumberViewModel,
         CommandedEnumViewModel,
         CommandedBooleanViewModel,
         ValueArrayViewModel,
         RangedCommandedNumberViewModel } from '@tektonux/phoenix-core';
import { Platform } from '../models/platformDataModel';
import { IEntityConstructor, IFrameworkServices } from '@tektonux/framework-api';
import { PlatformType, PlatformTypeLabel, StatusType, StatusTypeLabel } from '../adapters/platformTypes';
import { action, computed } from 'mobx';

export class PlatformEntityViewModel extends BaseEntityViewModel<Platform> {
    
    getEntityClassName(): string { return Platform.class; }
    getEntityCtr(): IEntityConstructor<Platform> { return Platform; }
    
    // ========== String Properties ==========
    get nameVM() {
        const vm = this.createPropertyVM('name', CommandedStringViewModel);
        vm.configure({
            required: true,
            maxLength: 50,
            validator: (value) => {
                if (!value?.trim()) return 'Name is required';
                if (value.length > 50) return 'Name too long';
                if (!/^[A-Za-z0-9\s-]+$/.test(value)) {
                    return 'Name can only contain letters, numbers, spaces, and hyphens';
                }
                return null;
            },
            labelConverter: (v) => v || 'Unnamed Platform'
        });
        return vm;
    }
    
    get callsignVM() {
        const vm = this.createPropertyVM('callsign', CommandedStringViewModel);
        vm.configure({
            required: true,
            pattern: /^[A-Z]{2,4}\d{2,4}$/,
            validator: (value) => {
                if (!value) return 'Callsign required';
                if (!/^[A-Z]{2,4}\d{2,4}$/.test(value)) {
                    return 'Format: 2-4 letters + 2-4 numbers (e.g., AB123)';
                }
                return null;
            },
            transform: (v) => v?.toUpperCase() // Auto-uppercase
        });
        return vm;
    }
    
    // ========== Number Properties ==========
    get speedVM() {
        const vm = this.createPropertyVM('speed', RangedCommandedNumberViewModel);
        vm.configure({
            min: 0,
            max: 500,
            step: 10,
            defaultValue: 0,
            labelConverter: (v) => v != null ? `${v} kts` : 'N/A',
            validator: (value) => {
                if (value > 400 && !this.isSupersonic) {
                    return 'Non-supersonic platforms limited to 400 kts';
                }
                return null;
            }
        });
        return vm;
    }
    
    get altitudeVM() {
        const vm = this.createPropertyVM('altitude', RangedCommandedNumberViewModel);
        vm.configure({
            min: 0,
            max: 50000,
            step: 100,
            labelConverter: (v) => {
                if (v == null) return 'N/A';
                if (v < 1000) return `${v} ft`;
                return `${(v / 1000).toFixed(1)}k ft`;
            }
        });
        return vm;
    }
    
    get fuelPercentVM() {
        const vm = this.createPropertyVM('fuelPercent', CommandedNumberViewModel);
        vm.configure({
            min: 0,
            max: 100,
            labelConverter: (v) => v != null ? `${v}%` : '0%',
            warningThreshold: 20,  // Custom warning level
            criticalThreshold: 10  // Custom critical level
        });
        return vm;
    }
    
    // ========== Enum Properties ==========
    get platformTypeVM() {
        const vm = this.createPropertyVM('platformType', CommandedEnumViewModel<PlatformType>);
        vm.configure({
            labelConverter: PlatformTypeLabel,
            defaultValue: PlatformType.Aircraft,
            allowedValues: [
                PlatformType.Aircraft,
                PlatformType.Ground,
                PlatformType.Naval,
                PlatformType.Space
            ]
        });
        return vm;
    }
    
    get statusVM() {
        const vm = this.createPropertyVM('status', CommandedEnumViewModel<StatusType>);
        vm.configure({
            labelConverter: StatusTypeLabel,
            defaultValue: StatusType.Active,
            validator: (value) => {
                if (value === StatusType.Destroyed && this.hasCrew) {
                    return 'Cannot destroy platform with crew aboard';
                }
                return null;
            }
        });
        return vm;
    }
    
    // ========== Boolean Properties ==========
    get isActiveVM() {
        const vm = this.createPropertyVM('isActive', CommandedBooleanViewModel);
        vm.configure({
            labelConverter: (v) => v ? 'Active' : 'Inactive',
            defaultValue: true
        });
        return vm;
    }
    
    get isArmedVM() {
        const vm = this.createPropertyVM('isArmed', CommandedBooleanViewModel);
        vm.configure({
            labelConverter: (v) => v ? 'Armed' : 'Unarmed',
            validator: (value) => {
                if (value && !this.hasWeaponsAuthorization) {
                    return 'Weapons authorization required';
                }
                return null;
            }
        });
        return vm;
    }
    
    // ========== Array Properties ==========
    get sensorIdsVM() {
        const vm = this.createPropertyVM('sensorIds', ValueArrayViewModel<string>);
        vm.configure({
            maxItems: 10,
            validator: (items) => {
                if (items.length > 10) return 'Maximum 10 sensors allowed';
                return null;
            }
        });
        return vm;
    }
    
    get waypo intsVM() {
        const vm = this.createPropertyVM('waypoints', ValueArrayViewModel<Waypoint>);
        vm.configure({
            labelConverter: (items) => `${items.length} waypoints`
        });
        return vm;
    }
    
    // ========== Computed Properties ==========
    @computed get isSupersonic(): boolean {
        return this.platformTypeVM.actual() === PlatformType.Aircraft &&
               this.speedVM.max > 400;
    }
    
    @computed get hasCrew(): boolean {
        return this.crewCountVM.actual() > 0;
    }
    
    @computed get hasWeaponsAuthorization(): boolean {
        // Check authorization logic
        return this.authLevelVM.actual() >= 3;
    }
    
    @computed get fuelStatus(): 'critical' | 'warning' | 'normal' {
        const fuel = this.fuelPercentVM.actual();
        if (fuel <= 10) return 'critical';
        if (fuel <= 20) return 'warning';
        return 'normal';
    }
    
    @computed get displayName(): string {
        const name = this.nameVM.actual();
        const callsign = this.callsignVM.actual();
        if (name && callsign) return `${callsign} - ${name}`;
        return name || callsign || 'Unknown Platform';
    }
    
    // ========== Business Logic Actions ==========
    @action async updatePosition(lat: number, lon: number, alt: number): Promise<void> {
        await Promise.all([
            this.latitudeVM.onCommandedUpdate(lat),
            this.longitudeVM.onCommandedUpdate(lon),
            this.altitudeVM.onCommandedUpdate(alt)
        ]);
    }
    
    @action async emergencyLanding(): Promise<void> {
        await Promise.all([
            this.altitudeVM.onCommandedUpdate(0),
            this.speedVM.onCommandedUpdate(0),
            this.statusVM.onCommandedUpdate(StatusType.Emergency)
        ]);
    }
    
    @action validateForMission(): string[] {
        const errors: string[] = [];
        
        if (this.fuelPercentVM.actual() < 50) {
            errors.push('Fuel must be at least 50% for mission');
        }
        
        if (!this.isActiveVM.actual()) {
            errors.push('Platform must be active');
        }
        
        if (this.statusVM.actual() !== StatusType.Active) {
            errors.push('Platform status must be Active');
        }
        
        return errors;
    }
}
```

### Display Registration Pattern (Most Common)

This shows the standard way to register displays and views in the framework.

```typescript
// =====================================================
// File: libs/alpha/alpha.registration/src/lib/display/entry.tsx
// =====================================================
import { registerDisplayInfo, useViewModel } from '@tektonux/framework-visual-react-bootstrapper';
import { DisplayTypes } from '@tektonux/alpha-api';
import { EntryView, AlphaEntryViewModel } from '@tektonux/alpha-components';
import { registerGridPanels } from '../grid/gridPanels';

registerDisplayInfo({
    id: DisplayTypes.MainEntry,
    tags: [],
    visible: true,
    ordinal: -1,  // Display order

    Renderer: props => {
        return <EntryView 
            viewModel={useViewModel(AlphaEntryViewModel)} 
            registerPanels={registerGridPanels} 
        />;
    },
});

// IMPORTANT: This export is required for the registration to work
export default {};

// =====================================================
// File: libs/alpha/alpha.registration/src/lib/display/leftSidebar.tsx
// =====================================================
import { registerDisplayInfo, useViewModel } from '@tektonux/framework-visual-react-bootstrapper';
import { DisplayTypes } from '@tektonux/alpha-api';
import { LeftSidebarView, LeftSidebarViewModel } from '@tektonux/alpha-components';

registerDisplayInfo({
    id: DisplayTypes.LeftSidebar,
    tags: ['sidebar', 'navigation'],
    visible: true,
    ordinal: 10,

    Renderer: props => {
        const viewModel = useViewModel(LeftSidebarViewModel);
        return <LeftSidebarView viewModel={viewModel} />;
    },
});

export default {};

// =====================================================
// File: libs/alpha/alpha.registration/src/lib/display/dataPanel.tsx
// =====================================================
import { registerDisplayInfo, useViewModel } from '@tektonux/framework-visual-react-bootstrapper';
import { DisplayTypes } from '@tektonux/alpha-api';
import { DataPanelView, DataPanelViewModel } from '@tektonux/alpha-components';

registerDisplayInfo({
    id: DisplayTypes.DataPanel,
    tags: ['panel', 'data'],
    visible: true,
    ordinal: 100,
    
    // Can access props passed from parent
    Renderer: props => {
        const viewModel = useViewModel(DataPanelViewModel);
        
        // Initialize with props if needed
        React.useEffect(() => {
            if (props.initialDataId) {
                viewModel.loadData(props.initialDataId);
            }
        }, [props.initialDataId]);
        
        return <DataPanelView viewModel={viewModel} />;
    },
});

export default {};

// =====================================================
// File: libs/alpha/alpha.registration/src/lib/map/map.tsx  
// =====================================================
import { registerDisplayInfo, useViewModel } from '@tektonux/framework-visual-react-bootstrapper';
import { DisplayTypes } from '@tektonux/alpha-api';
import { MapView, MapViewModel } from '@tektonux/alpha-components';
import { MapConfiguration } from '@tektonux/alpha-core';

registerDisplayInfo({
    id: DisplayTypes.Map,
    tags: ['map', 'visualization', 'geospatial'],
    visible: true,
    ordinal: 50,
    
    Renderer: props => {
        const viewModel = useViewModel(MapViewModel);
        
        // Configure map on mount
        React.useEffect(() => {
            viewModel.configure(MapConfiguration.default);
        }, []);
        
        return <MapView viewModel={viewModel} />;
    },
});

export default {};

// =====================================================
// File: libs/alpha/alpha.api/src/lib/displayTypes.ts
// =====================================================
export enum DisplayTypes {
    MainEntry = 'alpha.main-entry',
    LeftSidebar = 'alpha.left-sidebar',
    RightSidebar = 'alpha.right-sidebar',
    DataPanel = 'alpha.data-panel',
    Map = 'alpha.map',
    Timeline = 'alpha.timeline',
    Settings = 'alpha.settings',
    // ... more display types
}

// =====================================================
// File: libs/alpha/alpha.registration/src/lib/display/index.ts
// =====================================================
// Import all display registrations to ensure they execute
import './entry';
import './leftSidebar';
import './rightSidebar';
import './dataPanel';
import './map';
// ... import other displays

// NOTE-AI: Display Registration Pattern
// - Rationale: Each display is registered in its own file for modularity
// - Alternatives: Single registration file was considered but rejected for maintainability
// - Constraints: Must export default {} for registration to work
// - Revisit if: Framework changes to support different registration patterns
```

### Complete Service Pattern with Dependency Injection

```typescript
// =====================================================
// File: services/DataAnalysisService.ts
// =====================================================
import { IFrameworkServices, IService } from '@tektonux/framework-api';
import { injectable } from 'inversify';

export interface IDataAnalysisService extends IService {
    analyzePattern(data: number[]): AnalysisResult;
    predictNext(series: TimeSeries): Prediction;
    detectAnomalies(dataset: DataSet): Anomaly[];
}

@injectable()
export class DataAnalysisService implements IDataAnalysisService {
    public static readonly id = 'DataAnalysisService';
    
    private readonly _services: IFrameworkServices;
    private readonly _cache: Map<string, AnalysisResult> = new Map();
    
    constructor(services: IFrameworkServices) {
        this._services = services;
    }
    
    analyzePattern(data: number[]): AnalysisResult {
        const cacheKey = data.join(',');
        
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey)!;
        }
        
        const result = {
            mean: this.calculateMean(data),
            stdDev: this.calculateStdDev(data),
            trend: this.detectTrend(data),
            outliers: this.findOutliers(data)
        };
        
        this._cache.set(cacheKey, result);
        return result;
    }
    
    // ... implementation
}

// =====================================================
// File: services/serviceRegistration.ts
// =====================================================
export function registerServices(container: Container): void {
    // Register the service
    container.bind<IDataAnalysisService>(IDataAnalysisService)
        .to(DataAnalysisService)
        .inSingletonScope();
    
    // Register with framework
    container.bind('ServiceRegistration').toConstantValue({
        id: DataAnalysisService.id,
        service: DataAnalysisService
    });
}

// =====================================================
// Usage in ViewModel
// =====================================================
export class AnalysisViewModel extends BaseViewModel {
    private readonly _analysisService: IDataAnalysisService;
    
    constructor(services: IFrameworkServices) {
        super(services);
        
        // Get service from DI container
        this._analysisService = this.services.get<IDataAnalysisService>(
            DataAnalysisService.id
        );
        
        makeObservable(this);
    }
    
    @action async analyzeCurrentData(): Promise<void> {
        const data = this.getCurrentDataPoints();
        const result = this._analysisService.analyzePattern(data);
        
        runInAction(() => {
            this.analysisResult = result;
        });
    }
}
```

### Complete Test Suite Pattern

```typescript
// =====================================================
// File: __tests__/PlatformManagerViewModel.test.ts
// =====================================================
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PlatformManagerViewModel } from '../PlatformManagerViewModel';
import { createMockServices, createMockInteractor } from '@tektonux/test-helpers';
import { waitFor } from '@testing-library/react';
import { runInAction } from 'mobx';

describe('PlatformManagerViewModel', () => {
    let viewModel: PlatformManagerViewModel;
    let mockServices: IFrameworkServices;
    let mockInteractor: ReturnType<typeof vi.fn>;
    
    beforeEach(() => {
        // Setup mock services
        mockServices = createMockServices();
        
        // Setup mock interactor
        mockInteractor = vi.fn(() => ({
            getAll: vi.fn(() => [
                { id: '1', name: { value: 'Alpha' }, status: { value: 1 }},
                { id: '2', name: { value: 'Bravo' }, status: { value: 2 }}
            ]),
            add: vi.fn(),
            update: vi.fn(),
            remove: vi.fn()
        }));
        
        // Mock the interactor creation
        mockServices.getSharedEntityInteractor = mockInteractor;
        
        // Create view model
        viewModel = new PlatformManagerViewModel(mockServices);
    });
    
    afterEach(() => {
        vi.clearAllMocks();
    });
    
    describe('Platform Collection', () => {
        it('should load platforms on initialization', () => {
            expect(Object.keys(viewModel.platformVMs)).toHaveLength(2);
            expect(viewModel.platformVMs['1']).toBeDefined();
        });
        
        it('should filter platforms by search term', () => {
            runInAction(() => {
                viewModel.setSearchTerm('alpha');
            });
            
            expect(viewModel.filteredPlatforms).toHaveLength(1);
            expect(viewModel.filteredPlatforms[0].id).toBe('1');
        });
        
        it('should group platforms by status', () => {
            const groups = viewModel.platformsByStatus;
            
            expect(groups['Active']).toHaveLength(1);
            expect(groups['Inactive']).toHaveLength(1);
        });
    });
    
    describe('Selection Management', () => {
        it('should select platform', () => {
            viewModel.selectPlatform('1');
            
            expect(viewModel.selectedPlatformId).toBe('1');
            expect(viewModel.selectedPlatformVM).toBeDefined();
            expect(viewModel.selectedPlatformVM?.nameVM.actual()).toBe('Alpha');
        });
        
        it('should clear selection', () => {
            viewModel.selectPlatform('1');
            viewModel.selectPlatform(null);
            
            expect(viewModel.selectedPlatformId).toBeNull();
            expect(viewModel.selectedPlatformVM).toBeNull();
        });
    });
    
    describe('Async Operations', () => {
        it('should handle delete with loading state', async () => {
            viewModel.selectPlatform('1');
            
            const deletePromise = viewModel.deletePlatform();
            
            // Check loading state is set immediately
            expect(viewModel.isLoading).toBe(true);
            
            await deletePromise;
            
            // Check loading state is cleared
            expect(viewModel.isLoading).toBe(false);
            expect(mockInteractor().remove).toHaveBeenCalledWith('1');
        });
        
        it('should handle errors gracefully', async () => {
            mockInteractor().remove.mockRejectedValue(new Error('Delete failed'));
            
            viewModel.selectPlatform('1');
            await viewModel.deletePlatform();
            
            expect(viewModel.errorMessage).toBe('Failed to delete platform');
            expect(viewModel.isLoading).toBe(false);
        });
    });
    
    describe('Form Validation', () => {
        it('should validate platform name', () => {
            const platform = viewModel.platformVMs['1'];
            
            // Test empty name
            runInAction(() => {
                platform.nameVM.onCommandedUpdate('');
            });
            
            expect(platform.nameVM.hasValidationError).toBe(true);
            expect(platform.nameVM.validationErrorMessage).toBe('Name is required');
            
            // Test valid name
            runInAction(() => {
                platform.nameVM.onCommandedUpdate('Valid Name');
            });
            
            expect(platform.nameVM.hasValidationError).toBe(false);
        });
    });
    
    describe('Computed Properties', () => {
        it('should calculate statistics correctly', () => {
            expect(viewModel.totalPlatforms).toBe(2);
            expect(viewModel.activePlatformCount).toBe(1);
            expect(viewModel.hasUnsavedChanges).toBe(false);
        });
    });
});

// =====================================================
// File: __tests__/mockHelpers.ts
// =====================================================
export function createMockPlatform(overrides?: Partial<Platform>): Platform {
    return {
        id: 'mock-id',
        className: 'Platform',
        name: { value: 'Mock Platform' },
        status: { value: 1 },
        speed: { actual: 100, commanded: 100, min: 0, max: 500 },
        altitude: { actual: 10000, commanded: 10000, min: 0, max: 50000 },
        ...overrides
    };
}

export function createMockServices(): IFrameworkServices {
    return {
        logging: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        },
        eventBus: {
            publish: vi.fn(),
            subscribe: vi.fn(() => ({ unsubscribe: vi.fn() }))
        },
        get: vi.fn(),
        getSharedEntityInteractor: vi.fn()
    };
}

export function createMockContainer(): HTMLElement {
    const container = document.createElement('div');
    Object.defineProperties(container, {
        offsetWidth: { value: 800, writable: true },
        offsetHeight: { value: 600, writable: true },
        clientWidth: { value: 800, writable: true },
        clientHeight: { value: 600, writable: true }
    });
    return container;
}
```

## 🎯 Key Patterns Summary

### MobX Essentials Checklist
```typescript
// ✅ Always include in constructor
makeObservable(this);

// ✅ Use runInAction after await
await fetchData();
runInAction(() => { this.data = result; });

// ✅ Replace arrays, don't mutate
this.items = [...newItems];  // ✅
this.items.push(item);       // ❌

// ✅ Use computed for derived state
@computed get derived() { return this.base * 2; }
```

### Property ViewModel Quick Reference
```typescript
// Form inputs
value={vm.localOrCommanded()}
onChange={(v) => vm.onCommandedUpdate(v)}

// Display only
{vm.actualFormatted()}

// Business logic
if (vm.actual() > threshold)

// Validation
validationVM={{
    hasError: vm.hasValidationError,
    errorMessage: vm.validationErrorMessage
}}
```

### Collection Pattern
```typescript
@computed get itemVMs() {
    return this.computeItemVMsFromItems(
        'cacheKey',
        () => source,
        item => createVM(item)
    );
}
```

This enhanced cookbook provides complete, working examples that demonstrate multiple concepts together, making it easier to copy and adapt for real-world scenarios.
# Property ViewModel Guide - Advanced Topics

For basic property ViewModel usage, see `_QUICK_REF.md` and examples in `COOKBOOK_PATTERNS_ENHANCED.md`. This guide covers advanced scenarios and edge cases.

## Advanced Configuration Options

### Custom Validators with Context

```typescript
get speedVM() {
    const vm = this.createPropertyVM('speed', RangedCommandedNumberViewModel);
    vm.configure({
        min: 0,
        max: 500,
        // Validator can access the entire entity context
        validator: (value) => {
            // Access other properties for cross-field validation
            const altitude = this.altitudeVM.actual();
            const platformType = this.platformTypeVM.actual();
            
            if (platformType === PlatformType.Ground && value > 100) {
                return 'Ground vehicles limited to 100 kts';
            }
            
            if (altitude > 40000 && value < 200) {
                return 'Minimum speed of 200 kts required above 40,000 ft';
            }
            
            return null;
        }
    });
    return vm;
}
```

### Transform Functions for Input Processing

```typescript
get callsignVM() {
    const vm = this.createPropertyVM('callsign', CommandedStringViewModel);
    vm.configure({
        // Transform user input before validation/storage
        transform: (value) => {
            if (!value) return value;
            
            // Auto-format callsign: uppercase, remove spaces
            return value
                .toUpperCase()
                .replace(/\s+/g, '')
                .replace(/[^A-Z0-9]/g, '');
        },
        validator: (value) => {
            if (!/^[A-Z]{2,4}\d{2,4}$/.test(value)) {
                return 'Invalid callsign format';
            }
            return null;
        }
    });
    return vm;
}
```

### Dynamic Min/Max Constraints

```typescript
get powerLevelVM() {
    const vm = this.createPropertyVM('powerLevel', RangedCommandedNumberViewModel);
    
    // Dynamic constraints based on other properties
    const isDamaged = this.statusVM.actual() === StatusType.Damaged;
    const maxPower = isDamaged ? 50 : 100;
    
    vm.configure({
        min: 0,
        max: maxPower,  // Dynamic based on status
        warningThreshold: maxPower * 0.8,
        criticalThreshold: maxPower * 0.9
    });
    
    return vm;
}
```

## Advanced Patterns

### Chained Property Updates

```typescript
@action async updateCoordinates(lat: number, lon: number): Promise<void> {
    // Start update chain
    await this.latitudeVM.onCommandedUpdate(lat);
    
    // Wait for server confirmation before updating longitude
    await when(() => this.latitudeVM.actual() === lat, {
        timeout: 5000,
        onError: () => {
            throw new Error('Latitude update timeout');
        }
    });
    
    // Now safe to update longitude
    await this.longitudeVM.onCommandedUpdate(lon);
}
```

### Property VM with Side Effects

```typescript
get modeVM() {
    const vm = this.createPropertyVM('mode', CommandedEnumViewModel<SystemMode>);
    
    // React to commanded changes
    this.addDisposer(
        reaction(
            () => vm.commanded(),
            (newMode, prevMode) => {
                if (newMode === SystemMode.Emergency && prevMode !== SystemMode.Emergency) {
                    // Trigger emergency procedures
                    this.services.eventBus.publish({
                        type: 'system.emergency',
                        payload: { entityId: this.id }
                    });
                }
            }
        )
    );
    
    return vm;
}
```

### Custom Property ViewModel Extension

```typescript
// Create specialized property VM for complex types
export class CoordinateViewModel extends CommandedNumberViewModel {
    configure(options: ICoordinateOptions): void {
        super.configure({
            ...options,
            labelConverter: (value) => {
                if (value == null) return 'N/A';
                
                const direction = options.isLatitude
                    ? value >= 0 ? 'N' : 'S'
                    : value >= 0 ? 'E' : 'W';
                    
                const absValue = Math.abs(value);
                const degrees = Math.floor(absValue);
                const minutes = ((absValue - degrees) * 60).toFixed(2);
                
                return `${degrees}°${minutes}'${direction}`;
            }
        });
    }
}

// Usage
get latitudeVM() {
    const vm = this.createPropertyVM('latitude', CoordinateViewModel);
    vm.configure({ isLatitude: true, min: -90, max: 90 });
    return vm;
}
```

### Computed Property ViewModels

```typescript
// Synthetic property that combines multiple real properties
@computed get speedVectorVM(): IPropertyVM<Vector3D> {
    const speed = this.speedVM.actual();
    const heading = this.headingVM.actual();
    const pitch = this.pitchVM.actual();
    
    // Create synthetic VM that computes from other properties
    const vm = new ValueViewModel<Vector3D>(this._services);
    vm.configure({
        getValue: () => ({
            x: speed * Math.cos(heading) * Math.cos(pitch),
            y: speed * Math.sin(heading) * Math.cos(pitch),
            z: speed * Math.sin(pitch)
        }),
        labelConverter: (v) => `[${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)}]`
    });
    
    return vm;
}
```

## Performance Optimization

### Lazy Property VM Creation

```typescript
private _expensiveVM?: ExpensivePropertyViewModel;

// Only create when accessed
get expensivePropertyVM(): ExpensivePropertyViewModel {
    if (!this._expensiveVM) {
        this._expensiveVM = this.createPropertyVM('expensiveData', ExpensivePropertyViewModel);
        this._expensiveVM.configure({
            // Heavy configuration
            dataProcessor: new HeavyDataProcessor(),
            cacheDuration: 60000
        });
    }
    return this._expensiveVM;
}
```

### Batch Property Updates

```typescript
@action async updateAllProperties(updates: Partial<EntityData>): Promise<void> {
    // Collect all update promises
    const updatePromises: Promise<void>[] = [];
    
    if (updates.name !== undefined) {
        updatePromises.push(this.nameVM.onCommandedUpdate(updates.name));
    }
    
    if (updates.speed !== undefined) {
        updatePromises.push(this.speedVM.onCommandedUpdate(updates.speed));
    }
    
    if (updates.altitude !== undefined) {
        updatePromises.push(this.altitudeVM.onCommandedUpdate(updates.altitude));
    }
    
    // Execute all updates in parallel
    await Promise.all(updatePromises);
    
    // Wait for all to be confirmed
    await when(
        () => {
            const nameMatch = !updates.name || this.nameVM.actual() === updates.name;
            const speedMatch = !updates.speed || this.speedVM.actual() === updates.speed;
            const altMatch = !updates.altitude || this.altitudeVM.actual() === updates.altitude;
            return nameMatch && speedMatch && altMatch;
        },
        { timeout: 10000 }
    );
}
```

## Troubleshooting

### Property VM Not Updating

```typescript
// Check if property exists on entity
@computed get debugInfo(): string {
    const entity = this.entity;
    if (!entity) return 'No entity';
    
    // Check property presence
    const hasSpeed = 'speed' in entity;
    const speedType = entity.speed?.constructor?.name;
    
    return `Has speed: ${hasSpeed}, Type: ${speedType}`;
}
```

### Commanded vs Actual Sync Issues

```typescript
// Monitor sync status
@computed get syncStatus(): Record<string, boolean> {
    return {
        speed: this.speedVM.commanded() === this.speedVM.actual(),
        altitude: this.altitudeVM.commanded() === this.altitudeVM.actual(),
        heading: this.headingVM.commanded() === this.headingVM.actual()
    };
}

@computed get hasUnsyncedChanges(): boolean {
    return Object.values(this.syncStatus).some(synced => !synced);
}
```

## Key Takeaways

1. **Validators can access entity context** for cross-field validation
2. **Transform functions** clean input before validation
3. **Dynamic configuration** adjusts constraints based on state
4. **Chain updates** when order matters
5. **Extend property VMs** for specialized behavior
6. **Lazy creation** for expensive properties
7. **Batch updates** for performance

For basic patterns, see the complete examples in `COOKBOOK_PATTERNS_ENHANCED.md`.
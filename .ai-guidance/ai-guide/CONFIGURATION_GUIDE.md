# Configuration Guide

This guide explains how to configure components and services in the Phoenix framework using the startup configuration files.

## Overview

The Phoenix framework uses JSON configuration files to initialize services, components, and application settings. These files are loaded at startup and can be environment-specific.

## Configuration Files

Configuration files are located in `/client/apps/myapp.app/public/config/`:

- `app.startup.config.json` - Default development configuration
- `dev.startup.config.json` - Development environment with full validation rules
- `offline.startup.config.json` - Offline mode with local map server
- `online.startup.config.json` - Production online configuration

## Configuration Structure

### Root Level Configuration

```json
{
    "serverUrl": "http://localhost:5288",
    "theme": "dark",
    "appMode": "Development",
    "useLocalMapServer": true,
    "services": [...],
    "graphicMap": {...},
    "path": "*",
    "routes": [...]
}
```

### Service Configuration

Services are configured in the `services` array:

```json
"services": [
    {
        "id": "ServiceName",
        "config": {
            // Service-specific configuration
        }
    }
]
```

### Component Configuration

Components can be configured at the root level of the config file. The configuration is accessed through the framework services.

## Accessing Configuration in ViewModels

### Method 1: Using the configure() Method

ViewModels that extend BaseViewModel can override the `configure()` method:

```typescript
interface MyComponentConfigSchema extends ISystemConfigurationSchema {
    enable3D?: boolean;
    terrainProvider?: {
        url?: string;
        requestVertexNormals?: boolean;
    };
}

export class MyViewModel extends BaseViewModel {
    @observable private _enable3D: boolean = true;
    
    override configure(config?: MyComponentConfigSchema): void {
        if (config != null) {
            if (config.enable3D != null) {
                this._enable3D = config.enable3D;
            }
        }
        super.configure(config);
    }
}
```

### Method 2: Accessing Config from Framework Services

Components can access the startup configuration through the framework services:

```typescript
constructor(services: IFrameworkServices) {
    super(services);
    
    // Access configuration from application service
    const appService = services.getService<IApplicationService>(ServiceTypes.ApplicationService);
    const config = appService?.getStartupConfig();
    
    if (config?.graphicMap) {
        this.configure(config.graphicMap);
    }
}
```

## Best Practices

1. **Type Safety**: Define TypeScript interfaces for configuration schemas
2. **Defaults**: Always provide sensible defaults for optional configuration
3. **Validation**: Validate configuration values in the configure method
4. **Environment-Specific**: Use different config files for different environments
5. **Documentation**: Document all configuration options in your component

## Adding New Configuration

1. Define the configuration interface:
```typescript
interface MyConfigSchema extends ISystemConfigurationSchema {
    myOption?: string;
    myFeature?: {
        enabled: boolean;
        value: number;
    };
}
```

2. Add to startup config files:
```json
"myComponent": {
    "myOption": "value",
    "myFeature": {
        "enabled": true,
        "value": 42
    }
}
```

3. Implement configuration in your ViewModel:
```typescript
override configure(config?: MyConfigSchema): void {
    // Apply configuration
}
```

## Scenario JSON Files

Scenario files are used to define entities and their properties for simulation and testing. They are located in `/server/configuration/scenarios/`.

### Scenario File Structure

Each scenario file is an array of event objects. Each event has:
- `type`: The operation type (typically "Add" for adding entities)
- `time`: When to execute this event (0 for immediate)
- `data`: The entity data

### Example: Adding a SensorVolume Entity

```json
{
  "type": "Add",
  "time": 0,
  "data": {
    "id": "sensor-example",
    "className": "quicktype.SensorVolume",
    "latitude": {
      "actual": 32.862645,
      "commanded": 32.862645
    },
    "longitude": {
      "actual": -114.435968,
      "commanded": -114.435968
    },
    "altitudeMeanSeaLevelMeters": {
      "min": 0,
      "max": 10000,
      "actual": 100,
      "commanded": 100
    },
    "angle": {
      "min": 2,
      "max": 25,
      "actual": 13.5,
      "commanded": 13.5
    },
    "range": {
      "min": 50,
      "max": 2000,
      "actual": 1000,
      "commanded": 1000
    },
    "coverage360": {
      "value": false
    },
    "diskDivisions": {
      "value": 16
    },
    "roundness": {
      "value": 8
    },
    "azimuthTrue": {
      "min": -30,
      "max": 30,
      "actual": 0,
      "commanded": 0
    },
    "volumeType": {
      "value": "RADAR"
    }
  }
}
```

### Property Type Guidelines

Based on the framework's property model system:

1. **ValueProperty** (read-only values): Keep the `value` wrapper
   ```json
   "coverage360": { "value": false }
   ```

2. **CommandedProperty** (user-controllable values): Use `actual` and `commanded` directly
   ```json
   "latitude": {
     "actual": 32.862645,
     "commanded": 32.862645
   }
   ```

3. **RangedCommandedProperty** (bounded numeric values): Include `min`, `max`, `actual`, and `commanded`
   ```json
   "angle": {
     "min": 2,
     "max": 25,
     "actual": 13.5,
     "commanded": 13.5
   }
   ```

### Important Notes

- Always include `id` and `className` in the data object
- Do NOT include `associatedEntities` or `timestamp` fields when they are empty/null
- Ensure all RangedCommandedProperty types have both `actual` and `commanded` values to avoid runtime binding errors
- The `className` should match the entity type (e.g., `quicktype.SensorVolume`, `quicktype.Platform`)

## Troubleshooting

- Configuration not loading? Check that your component is properly registered
- Values not updating? Ensure you're calling `makeObservable(this)` for reactive properties
- Type errors? Verify your configuration schema extends `ISystemConfigurationSchema`
- Scenario entity errors? Check that all CommandedProperty and RangedCommandedProperty types have both `actual` and `commanded` values
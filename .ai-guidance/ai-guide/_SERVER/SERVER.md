# Server-Side Architecture Guide

## 🏗️ Architecture Overview

The server simulation system uses a **Data-Oriented Design** pattern optimized for high-performance, real-time military/tactical simulations. Instead of traditional OOP with rich domain objects, we use a dictionary-based Entity/Property system that prioritizes network efficiency and reactive updates.

### Core Principles
1. **Entities as Dictionaries**: All entities are `IUpdate` objects with property dictionaries
2. **Builder Pattern Only**: Never create entities directly - always use builders
3. **Minimal Network Payloads**: Only send changed properties, not entire objects
4. **Pulse-Driven Updates**: External control over simulation timing
5. **Reactive Property Pattern**: ValueProperty/CommandedProperty for client reactivity

## 📊 Entity/Property Architecture

### The IUpdate Structure
```csharp
Update {
    Id: "track-123",
    ClassName: "quicktype.CwmiTrack",
    Type: typeof(CwmiTrack),
    UpdateProperties: Dictionary<string, object> {
        "Latitude": { "Commanded": 39.7, "Actual": 39.7 },
        "Longitude": { "Commanded": -104.9, "Actual": -104.9 },
        "ThreatCategory": { "Value": ThreatCategoryType.HOSTILE },
        "Name": { "Commanded": "Track-1", "Actual": "Track-1" }
    }
}
```

### Property Types (CRITICAL!)

#### ValueProperty Pattern
```csharp
// Single value properties (enums, types, categories)
// Structure: { "Value": x }
// Examples: ThreatCategory, PlatformType, TrackQuality, IffMode

// Safe access pattern:
if (update.UpdateProperties.TryGetValue("ThreatCategory", out var obj) &&
    obj is IDictionary<string, object> dict &&
    dict.TryGetValue("Value", out var val))
{
    var threat = (ThreatCategoryType)val;
}
```

#### CommandedProperty Pattern
```csharp
// Dual-value properties (commanded vs actual state)
// Structure: { "Commanded": x, "Actual": y }
// Examples: Latitude, Longitude, Altitude, Heading, Speed

// Safe access pattern:
if (update.UpdateProperties.TryGetValue("Latitude", out var obj) &&
    obj is IDictionary<string, object> dict)
{
    var actual = Convert.ToDouble(dict["Actual"] ?? 0);
    var commanded = Convert.ToDouble(dict["Commanded"] ?? actual);
}
```

### ⚠️ NEVER Access Properties Directly
```csharp
// ❌ WRONG - Will cause runtime errors!
var value = dict["Actual"];  // Throws if key missing
var track = new CwmiTrack { Name = "Track-1" };  // Can't create entities directly

// ✅ CORRECT - Always defensive
if (dict.TryGetValue("Actual", out var val)) { ... }
var builder = new TrackBuilder().WithName("Track-1");
```

## 🔨 Builder Pattern (Required for All Entities)

### Creating Entities
```csharp
// ✅ CORRECT - Use builders that return IUpdate objects
var trackBuilder = new TrackBuilder()
    .WithId($"track-{Guid.NewGuid():N}")
    .WithName("Track-1")
    .WithPosition(39.7, -104.9, 5000)
    .WithSpeed(450)
    .WithHeading(270)
    .WithThreatCategory(ThreatCategoryType.HOSTILE);
    
IUpdate trackUpdate = trackBuilder.Build();

// Store in dictionary, not entity collection
private readonly Dictionary<string, IUpdate> _tracks = new();
_tracks[trackUpdate.Id] = trackUpdate;
```

### Modifying Properties
```csharp
// Get the property dictionary
if (track.UpdateProperties.TryGetValue("Latitude", out var latObj) &&
    latObj is IDictionary<string, object> latDict)
{
    // Modify both Commanded and Actual
    latDict["Actual"] = (decimal)newLatitude;
    latDict["Commanded"] = (decimal)targetLatitude;
}

// Send updates to repository
await _repository.AddOrUpdateAsync(_tracks.Values, cancellationToken);
```

## 🚀 High-Volume Simulation Patterns

### Storage Pattern
```csharp
public class HighVolumeSimulation : SimulationBase
{
    // Store as Update dictionaries, not entity lists
    private readonly Dictionary<string, IUpdate> _tracks = new();
    private readonly Dictionary<string, IUpdate> _assets = new();
    private readonly Dictionary<string, IUpdate> _engagements = new();
    
    // Use value types for performance-critical data
    private readonly SimulationEntity[] _entities = new SimulationEntity[MAX_ENTITIES];
}
```

### Performance-Optimized Entity Structure
```csharp
// Use struct for high-volume data (minimal GC pressure)
public struct SimulationEntity
{
    public int EntityId;         // Value type, not string
    public double Latitude;      // 8 bytes
    public double Longitude;     // 8 bytes 
    public float Heading;        // 4 bytes
    public float Speed;          // 4 bytes
    public BehaviorType Type;    // 4 bytes enum
    // Total: ~108 bytes, cache-line friendly
}
```

### Async + Structs Pattern
```csharp
// Can't use ref in async methods
// Use copy-modify-writeback pattern
async Task UpdateEntityAsync(int index)
{
    var entity = _entities[index];  // Copy
    entity.Speed = 100;             // Modify
    entity.Heading = 270;
    _entities[index] = entity;      // Write back
}
```

### Batch Update Pattern
```csharp
private async Task SendBatchUpdatesAsync()
{
    var updates = new List<IUpdate>();
    
    lock (_tracks)
    {
        foreach (var kvp in _tracksToUpdate)
        {
            var track = _tracks[kvp.Key];
            
            // Create minimal update with only changed properties
            var update = new Update
            {
                Id = track.Id,
                ClassName = track.ClassName,
                UpdateProperties = new Dictionary<string, object>
                {
                    ["Latitude"] = track.UpdateProperties["Latitude"],
                    ["Longitude"] = track.UpdateProperties["Longitude"],
                    ["Heading"] = track.UpdateProperties["Heading"]
                }
            };
            updates.Add(update);
        }
    }
    
    // Send batch to repository
    await _repository.AddOrUpdateAsync(updates, cancellationToken);
}
```

## 🔄 Model Generation System

### Generated vs Regular Classes

#### Generated Data Models (Server Perspective)
```csharp
// Source: /model/*.model/src/*.ts (TypeScript definitions)
// Server accesses via: quicktype namespace
// Generated C# location: Embedded in server build via quicktype
// Import pattern:
using quicktype;  // All generated models are here

// Example generated classes:
public partial class CwmiTrack : IEntity
{
    // Properties are wrapped in ValueProperty/CommandedProperty
    // Access only through UpdateProperties dictionary at runtime
    // IntelliSense won't show these - they're dictionary-based!
}

public enum ThreatCategoryType 
{
    UNKNOWN,    // All enum values are UPPERCASE
    FRIENDLY,   // in generated code
    HOSTILE,
    NEUTRAL
}
```

#### Regular Service Classes
```csharp
// Located in: server/com.cwmi.testing.canary/sims/
// These are hand-written C# classes for business logic

public class SimulationEntity  // Regular struct for performance
public class TrackBuilder      // Regular builder pattern class
public class MovementCalculator // Regular service class

// These follow normal C# patterns - no dictionary magic!
```

### Model Generation Flow (Server Impact)
```bash
1. Edit source:           /model/*.model/src/*.ts
2. Run generation:        npm run generate-model
3. Server impact:         quicktype namespace updated
4. Server usage:          using quicktype;
                         var track = new TrackBuilder()...  # NOT new CwmiTrack()!
5. Access pattern:        track.UpdateProperties["Name"]    # NOT track.Name
```

### Server-Side Usage Examples
```csharp
// ✅ CORRECT - Server using generated models
using quicktype;

// Create via builder (generates IUpdate with UpdateProperties)
var builder = new TrackBuilder()
    .WithThreatCategory(ThreatCategoryType.HOSTILE);  // UPPERCASE enum

// Access via dictionary
if (update.UpdateProperties.TryGetValue("ThreatCategory", out var obj))
{
    var dict = obj as IDictionary<string, object>;
    var threat = (ThreatCategoryType)dict["Value"];
}

// ❌ WRONG - This won't compile!
var track = new CwmiTrack();  // Can't instantiate directly
track.Name = "Track-1";       // No such property at compile time
```

## ⚡ Performance Optimizations

### 1. Minimal Payload Updates
```csharp
// Only send changed properties, not entire entities
// At 2000 tracks @ 10Hz, this reduces network load by 90%+
var update = new Update
{
    Id = track.Id,
    UpdateProperties = new Dictionary<string, object>
    {
        ["Latitude"] = latDict,   // Only position
        ["Longitude"] = lonDict,  // changes sent
        ["Heading"] = headDict     // not entire track
    }
};
```

### 2. Adaptive Complexity
```csharp
// Switch algorithms based on entity count
if (_tracks.Count > 1000)
{
    // Simple, fast position updates
    await UpdatePositionsSimple();
}
else
{
    // Complex AI behaviors for smaller scenarios
    await _entityManager.UpdateWithBehaviors();
}
```

### 3. Thread Safety Patterns
```csharp
// ✅ CORRECT: Deep copy for thread safety
lock (_tracks)
{
    var headingCopy = new Dictionary<string, object?>
    {
        ["Commanded"] = originalDict["Commanded"],
        ["Actual"] = originalDict["Actual"]
    };
    update.UpdateProperties["Heading"] = headingCopy;
}

// ❌ WRONG: Sharing references causes race conditions
update.UpdateProperties["Heading"] = originalDict;  // Danger!
```

## 🎮 Simulation Control

### Configuration Files
```json
// /server/configuration/simulation.json
{
  "pluginName": "cwmi.HighVolumeTrackPlugin",
  "autoRun": true,  // Only ONE simulation should have this true
  "configPath": "sims/high-volume.json"
}

// /server/configuration/sims/high-volume.json
{
  "numberOfTracks": 2000,
  "tracksToUpdatePerCycle": 200,  // Stagger updates
  "maxUpdatesPerSecond": 20000,
  "useBehaviorSystem": false  // Disable for high volume
}
```

### Pulse-Driven Architecture
```csharp
public override async Task OnUpdateAsync(int deltaTimeMs)
{
    // External control calls this method
    // deltaTimeMs = time since last update
    
    // Update simulation state
    await UpdateSimulationAsync(deltaTimeMs);
    
    // Batch and send changes
    if (_updateCount++ % BATCH_INTERVAL == 0)
    {
        await SendBatchUpdatesAsync();
    }
}
```

## 📁 Key Files and Namespaces

### Core Simulation Files
```
/server/com.cwmi.testing.canary/sims/
├── core/
│   ├── SimulationBase.cs          # Base class for all simulations
│   ├── IRepositoryAdapter.cs      # Repository interface
│   └── TimeControlledSimulationBase.cs  # Time-based scenarios
├── simulations/
│   ├── HighVolumeTrackSimulation.cs  # Main high-volume example
│   └── TrackEngagementSimulation.cs  # Combat simulation
├── tracks/
│   ├── behaviors/              # Movement AI
│   ├── data/
│   │   ├── SimulationEntity.cs     # Performance struct
│   │   └── builders/
│   │       ├── TrackBuilder.cs     # Track creation
│   │       └── AssetBuilder.cs     # Asset creation
│   └── modules/                # Simulation subsystems
└── scenarios/                   # Orchestrated scenarios
    ├── core/
    │   ├── ScenarioContext.cs      # Scenario state
    │   └── ScenarioManager.cs      # Scenario orchestration
    └── definitions/
        └── ConvoyProtectionScenario.cs  # Example scenario
```

### Namespace Organization
```csharp
using quicktype;  // Generated model classes
using com.cwmi.testing.canary.sims.core;  // Core simulation
using com.cwmi.testing.canary.sims.tracks.data.builders;  // Builders
using behaviors = com.cwmi.testing.canary.sims.tracks.behaviors;  // Alias to avoid conflicts
```

## 🐛 Common Pitfalls and Solutions

| Issue | Solution |
|-------|----------|
| "Cannot find property" runtime error | Check /model/*.model/src/ for correct property name/casing, then verify builder is populating it |
| Entities not updating in UI | Check both Commanded AND Actual values |
| Thread safety violations | Deep copy dictionaries, never share refs |
| High GC pressure | Use structs for high-volume data |
| Enum mismatch errors | All enums are UPPERCASE in generated code |
| Can't create entities | Must use Builder pattern, not constructors |
| Updates not batching | Ensure using IUpdate collections, not entities |

## 📈 Performance Benchmarks

- **2000 tracks @ 10Hz**: ~20,000 updates/second
- **Network payload reduction**: 90% via partial updates
- **GC pressure**: <5% with struct-based entities
- **CPU usage**: ~15% single core for position updates
- **Memory**: ~50MB for 2000 active tracks

## 🔍 Debugging Tips

### First: Check the Source Model
```bash
# ALWAYS check the source TypeScript model first!
# This tells you exactly what properties exist and their types
grep "propertyName" /model/*.model/src/*.ts

# Example: Is it "Latitude" or "latitude"? Check:
cat /model/cwmi.model/src/tracks.ts | grep -i latitude
```

### Property Type Verification
```typescript
// In /model/*.model/src/*.ts, look for:
Latitude: CommandedProperty<number>;  // → Use Commanded/Actual pattern
ThreatCategory: ValueProperty<ThreatCategoryType>;  // → Use Value pattern
Name: string;  // → Might be CommandedProperty in generated code
```

### Runtime Debugging
```csharp
// Log what's actually in the UpdateProperties
foreach (var prop in track.UpdateProperties)
{
    _logger.LogDebug($"{prop.Key}: {JsonSerializer.Serialize(prop.Value)}");
}

// Defensive property access with logging
if (!track.UpdateProperties.ContainsKey("Latitude"))
{
    _logger.LogError($"Property 'Latitude' not found. Available: {string.Join(", ", track.UpdateProperties.Keys)}");
    // This reveals typos, casing issues, or missing property population
}
```

## 🤖 AI Assistant Guide

### Quick Context for New Sessions

When starting work on server-side code:

1. **First Question to Ask**: "Are we working with generated entities or regular classes?"
   - Generated entities = Dictionary-based, use Builders
   - Regular classes = Normal C# patterns

2. **Pattern Recognition Checklist**:
   ```
   ✓ See IUpdate? → Use dictionary access patterns
   ✓ See quicktype namespace? → Generated model territory  
   ✓ See UpdateProperties? → ValueProperty/CommandedProperty patterns
   ✓ See new CwmiTrack()? → ❌ STOP! Need TrackBuilder instead
   ```

3. **When You See Compilation Errors**:
   - "Cannot convert Dictionary to CommandedProperty" → Wrong property pattern
   - "CwmiTrack does not contain Name" → Use UpdateProperties["Name"]
   - Enum value errors → Check if it should be UPPERCASE

### AI Implementation Patterns

#### Pattern 1: Reading Entity Properties
```csharp
// When you need to read a track's position:
// 1. Check NEXT_SESSION_GUIDE.md for property type (Value vs Commanded)
// 2. Use this safe pattern:

if (track.UpdateProperties.TryGetValue("Latitude", out var latObj) &&
    latObj is IDictionary<string, object> latDict &&
    latDict.TryGetValue("Actual", out var actualLat))
{
    var latitude = Convert.ToDouble(actualLat);
    // Use the value
}
```

#### Pattern 2: Creating New Entities
```csharp
// ALWAYS check for existing Builder classes first
// Path: /server/com.cwmi.testing.canary/sims/tracks/data/builders/

var builder = new TrackBuilder()  // or AssetBuilder, EngagementBuilder
    .WithId($"track-{Guid.NewGuid():N}")
    .WithName("Track-1")
    .WithPosition(lat, lon, alt);
    
var update = builder.Build();
_tracks[update.Id] = update;
```

#### Pattern 3: Modifying Scenario Code
```csharp
// When migrating old scenario code:
// OLD: track.Latitude = 39.7;
// NEW: 
var latDict = track.UpdateProperties["Latitude"] as IDictionary<string, object>;
latDict["Actual"] = (decimal)39.7;
latDict["Commanded"] = (decimal)39.7;
```

### Common AI Mistakes to Avoid

1. **Don't assume property access patterns** - Always check if it's ValueProperty or CommandedProperty
2. **Don't create entities directly** - Search for builders in /tracks/data/builders/
3. **Don't trust IntelliSense** - Generated models won't show dictionary properties
4. **Don't modify without locking** - Thread safety is critical in simulations
5. **Don't send full entities** - Create minimal Update objects for network efficiency

### Useful Grep Patterns for AI

```bash
# Find all builder classes
grep -r "class.*Builder" --include="*.cs" server/

# Find property type definitions
grep -r "AddValueProperty\|AddCommandedProperty" --include="*.cs"

# Find existing Update patterns
grep -r "UpdateProperties\[" --include="*.cs" server/

# Check enum values
grep -r "ThreatCategoryType\." --include="*.cs" server/
```

### Session Startup Checklist

```markdown
□ Read NEXT_SESSION_GUIDE.md for current issues
□ Check error count: ./tools/build-helpers/count-server-errors.sh
□ Identify if working with generated or regular code
□ Look for NOTE-AI comments in relevant files
□ Find working examples in HighVolumeTrackSimulation.cs
```

### File Navigation Tips

- **Working example**: Always check `HighVolumeTrackSimulation.cs` first
- **Builder patterns**: Look in `/tracks/data/builders/`
- **Entity definitions**: Check `/model/*.model/src/` (TypeScript source)
- **Generated code**: `client/libs/*/model/` (don't edit!)
- **Scenarios**: `/scenarios/definitions/` for examples

### Quick Validation Commands

```bash
# After making changes
dotnet build
./tools/build-helpers/show-server-errors.sh 10

# If you modified models
npm run generate-model
dotnet build
```

### NOTE-AI: Architecture Decision Context
- **Rationale**: Dictionary-based entities optimize for network efficiency in high-volume military simulations
- **Trade-off**: Lost compile-time safety for 90% network payload reduction
- **Alternative considered**: Traditional DTOs (too much overhead at 20k updates/sec)
- **Revisit if**: Moving away from real-time requirements or volume drops below 100 entities
- **Key insight**: This is essentially Entity-Component-System (ECS) pattern in C#

---

*Last Updated: November 2024 - Entity/Property Architecture Documentation*
*Target Audience: AI assistants working on server simulation code*
*Primary Reference: HighVolumeTrackSimulation.cs for working patterns*
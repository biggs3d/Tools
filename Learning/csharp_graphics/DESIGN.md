# City Builder Simulation - Design Document

## Core Problem Definition

A minimalistic grid-based city builder simulation featuring:

- Strategic tile placement mechanics (roads and buildings)
- Node-based pathfinding for autonomous vehicles
- Data-driven simulation with observable emergent behaviors
- Clean state management between menu and gameplay

## Architecture Overview

### Technology Stack

- **Language**: C# (.NET 8.0)
- **Graphics**: raylib-cs (4.5.0+)
- **Architecture**: Entity-Component-System (ECS) lite pattern
- **State Management**: Finite State Machine with event-driven transitions

### Core Design Principles

1. **Separation of Concerns**: Simulation logic independent from rendering
2. **Data-Driven**: All game entities and behaviors defined through configuration
3. **Event-Driven**: User inputs and system updates through message passing
4. **Testability**: Core simulation runs without graphics dependencies
5. **Dependency Injection**: No singletons; systems are injected for testability
6. **Fixed Timestep**: Deterministic simulation at 30Hz, interpolated rendering at 60Hz

## System Architecture

### 1. Game State Management

```
GameStateManager
├── MenuState
│   ├── Main Menu
│   ├── Settings
│   └── Credits
├── PlayState
│   ├── Simulation Loop
│   ├── Input Handler
│   └── Render Pipeline
└── TransitionState
    └── Loading/Saving
```

**Key Design Decisions:**

- States use dependency injection (no singletons) with clear Enter/Update/Exit lifecycle
- State transitions triggered by events through a central EventBus
- Each state owns its UI and input handling
- GameStateManager creates fresh state instances on transitions

### 2. Grid System

```
Grid (Chunked sparse storage, unlimited size)
├── Dictionary<Vector2Int, TileChunk> chunks (16x16 tile chunks)
├── TileType enum (Empty, Road, Highway (future), Hub, Residential, Commercial, Industrial etc.)
├── ProceduralTerrain terrain
├── PathfindingService (dynamic connectivity)
├── Placement Rules Engine
└── Starting Hub (LandingPad or UndergroundEntrance)
```

**Layered Architecture:**

1. **Terrain Layer** (Procedural, infinite)
    - Generated on-demand using noise functions
    - Cached in chunks for visited areas
    - Determines buildability and movement costs
2. **Infrastructure Layer** (Player-placed tiles)
    - Sparse dictionary storage for roads/buildings
    - Must respect terrain constraints
3. **Entity Layer** (Vehicles, effects)
    - Dynamic objects moving over infrastructure

**Storage Strategy:**

- Two-tier system: `Dictionary<Vector2Int, TileChunk>` → `Tile[256]` arrays
- Chunks are 16x16 tiles, created on-demand when first tile placed
- Within chunks: direct array indexing (no hashing)
- Chunk lookup: O(1), Tile access within chunk: O(1) array access
- Cache-friendly iteration for rendering and simulation
- Memory scales with occupied chunks, not individual tiles

**Tile Properties:**

```csharp
class Tile {
    TileType Type
    bool IsWalkable
    byte NeighborMask  // Bit flags for N,E,S,W connections
    object CustomData  // For building-specific data
}

class TileChunk {
    public const int Size = 16;
    public readonly Tile[] Tiles = new Tile[Size * Size];
    public Vector2Int ChunkCoord { get; }
    
    public Tile GetTile(int localX, int localY) 
        => Tiles[localY * Size + localX];
}

// Proper Vector2Int implementation
public readonly record struct Vector2Int(int X, int Y);
// Auto-generates Equals, GetHashCode, ToString

enum TerrainType {
    Water,      // Not buildable, requires bridge
    Sand,       // Buildable, visual variety only around larger bodies of water
    Grass,      // Buildable, default terrain
    Forest      // Buildable, visual variety only
    Mountain,   // Not buildable, blocks view
}

class TerrainTile {
    TerrainType Type
    float Elevation  // From noise function
    byte MovementCost // 1-10, affects pathfinding
    bool CanBuild
}

[Flags]
enum NeighborMask : byte { 
    None = 0, North = 1, East = 2, South = 4, West = 8 
}
```

**Starting Configuration:**

- Map begins with one "Hub" tile (LandingPad or UndergroundEntrance)
- Hub serves as the entry/exit point for all vehicles
- Vehicles spawn from hub, return when idle
- First road must connect to the hub

**Placement Rules:**

- Roads must connect to existing roads or the hub
- Buildings require adjacent road access
- Only one hub per map (special starting tile)
- Hub cannot be removed once placed
- Cannot build on water, rock, or mountains
- Sand tiles increase movement cost for vehicles
- Bridges needed to cross water with roads
- Forest tiles are purely aesthetic (buildable)

### 3. Core Systems

```
GameLoop
├── EventBus (pub-sub for decoupled communication)
├── AssetManager (texture/sound loading and caching)
├── InputManager (centralized input polling)
├── Camera2D (viewport and culling)
└── Fixed Timestep (30Hz sim, 60Hz render)
```

**EventBus Implementation:**
```csharp
public class EventBus {
    private Dictionary<Type, List<Action<object>>> _subscribers = new();
    
    public void Subscribe<T>(Action<T> handler) where T : class {
        var type = typeof(T);
        if (!_subscribers.ContainsKey(type)) 
            _subscribers[type] = new();
        _subscribers[type].Add(obj => handler((T)obj));
    }
    
    public void Publish<T>(T eventData) where T : class {
        if (_subscribers.TryGetValue(typeof(T), out var handlers))
            foreach (var handler in handlers) 
                handler(eventData);
    }
}
```

**Asset Manager:**
```csharp
public sealed class AssetManager : IDisposable {
    private Dictionary<string, Texture2D> _textures = new();
    private Dictionary<string, Sound> _sounds = new();
    
    public Texture2D GetTexture(string path) {
        if (!_textures.ContainsKey(path))
            _textures[path] = Raylib.LoadTexture(path);
        return _textures[path];
    }
    
    public void Dispose() {
        foreach (var tex in _textures.Values)
            Raylib.UnloadTexture(tex);
        foreach (var snd in _sounds.Values)
            Raylib.UnloadSound(snd);
    }
}
```

**Camera System:**
```csharp
public class CameraController {
    public Camera2D Camera { get; private set; }
    public Rectangle ViewBounds => new(
        Camera.target.X - Camera.offset.X / Camera.zoom,
        Camera.target.Y - Camera.offset.Y / Camera.zoom,
        Raylib.GetScreenWidth() / Camera.zoom,
        Raylib.GetScreenHeight() / Camera.zoom
    );
    
    public bool IsChunkVisible(Vector2Int chunkCoord) {
        var chunkWorldPos = new Vector2(
            chunkCoord.X * TileChunk.Size * TILE_SIZE,
            chunkCoord.Y * TileChunk.Size * TILE_SIZE
        );
        var chunkBounds = new Rectangle(
            chunkWorldPos.X, chunkWorldPos.Y,
            TileChunk.Size * TILE_SIZE,
            TileChunk.Size * TILE_SIZE
        );
        return Raylib.CheckCollisionRecs(ViewBounds, chunkBounds);
    }
}
```

### 4. Node-Based Simulation

```
SimulationManager
├── Vehicle Pool (object pooling for GC efficiency)
├── Delivery System
├── PathfindingService (A* with caching)
├── Fixed Update Loop (30Hz deterministic)
└── Spatial Partitioning (for collision detection)
```

**Fixed Timestep Implementation:**
```csharp
public class SimulationManager {
    private const float FIXED_TIMESTEP = 1f / 30f; // 30Hz
    private float _accumulator = 0f;
    
    public void Update(float deltaTime) {
        _accumulator += deltaTime;
        
        while (_accumulator >= FIXED_TIMESTEP) {
            FixedUpdate(FIXED_TIMESTEP);
            _accumulator -= FIXED_TIMESTEP;
        }
        
        // Interpolation factor for smooth rendering
        float alpha = _accumulator / FIXED_TIMESTEP;
        InterpolatePositions(alpha);
    }
    
    private void FixedUpdate(float dt) {
        // Deterministic simulation logic here
        foreach (var vehicle in _activeVehicles)
            vehicle.UpdateMovement(dt);
    }
}
```

**Pathfinding Service:**
```csharp
public class PathfindingService {
    private Dictionary<(Vector2Int, Vector2Int), Path> _pathCache;
    private readonly GridSystem _grid;
    
    public Path FindPath(Vector2Int start, Vector2Int goal) {
        var key = (start, goal);
        if (_pathCache.TryGetValue(key, out var cached))
            return cached;
            
        var path = AStar(start, goal);
        _pathCache[key] = path;
        return path;
    }
    
    public void InvalidateCache(Rectangle dirtyRegion) {
        // Remove cached paths that intersect dirty region
        _pathCache = _pathCache.Where(kvp => 
            !kvp.Value.IntersectsWith(dirtyRegion))
            .ToDictionary(kvp => kvp.Key, kvp => kvp.Value);
    }
    
    private List<Vector2Int> GetNeighbors(Vector2Int pos) {
        // Calculate walkable neighbors from grid state
        // No need to store in tiles
        var neighbors = new List<Vector2Int>();
        // Check N,E,S,W positions...
        return neighbors;
    }
}
```

**Vehicle Behavior:**

```csharp
class Vehicle {
    Vector2 Position
    Vector2 TargetPosition
    Path CurrentPath
    DeliveryTask Task
    float Speed
    VehicleState State (Idle, Moving, Loading, Unloading)
}
```

**Delivery System:**

- Buildings generate delivery requests at intervals
- Vehicles claim tasks from a priority queue
- Path recalculation on grid changes
- Visual feedback for active deliveries

### 5. Procedural Terrain System

```
TerrainGenerator
├── Noise Functions (Simplex/Perlin with seed)
├── TerrainChunkManager (16x16 terrain chunks)
├── RiverGenerator (curve-based water placement)
└── Chunk caching with LRU eviction
```

**Terrain Generation:**

```csharp
class TerrainGenerator {
    float seed
    SimplexNoise elevationNoise
    SimplexNoise vegetationNoise  // For forest placement
    RiverGenerator riverGen
    
    TerrainTile GenerateTile(int x, int y) {
        float elevation = elevationNoise.GetValue(x * 0.01f, y * 0.01f);
        float vegetation = vegetationNoise.GetValue(x * 0.05f, y * 0.05f);
        
        // Check for river curves
        if (riverGen.IsRiverAt(x, y)) return Water;
        
        // Map to terrain type based on elevation
        if (elevation < -0.2) return Water;  // Lakes/ocean
        if (elevation < -0.1) return Sand;   // Beaches around water
        if (elevation > 0.7) return Mountain;
        if (vegetation > 0.3) return Forest;  // Scattered forests
        return Grass;
    }
}
```

**Chunk System:**

- Generate terrain in 16x16 chunks
- Cache generated chunks in memory
- Unload distant chunks to save memory
- Seamless generation as camera moves

### 6. Rendering Pipeline

```
RenderManager
├── TerrainRenderer (chunk-based background)
├── TileRenderer (batched infrastructure)
├── VehicleRenderer (interpolated positions)
├── UIRenderer (immediate mode with RayGUI)
└── EffectsRenderer (pooled particles)
```

**Optimized Render Loop:**
```csharp
public void Draw() {
    Raylib.BeginDrawing();
    Raylib.ClearBackground(Color.BLACK);
    
    // World space rendering
    Raylib.BeginMode2D(_camera.Camera);
        // Only render visible chunks
        foreach (var chunk in GetVisibleChunks()) {
            _terrainRenderer.DrawChunk(chunk);
            _tileRenderer.DrawChunk(chunk);
        }
        _vehicleRenderer.DrawInterpolated(_interpolationAlpha);
        _effectsRenderer.Draw();
    Raylib.EndMode2D();
    
    // Screen space UI (not affected by camera)
    _uiRenderer.Draw();
    _debugOverlay.Draw(); // FPS, chunk count, etc.
    
    Raylib.EndDrawing();
}
```

**Layer Order (back to front):**
1. Terrain chunks (cached render textures)
2. Grid overlay (optional, F1 toggle)
3. Infrastructure tiles (batched by texture)
4. Vehicles (interpolated positions)
5. Particle effects
6. UI overlay (RayGUI immediate mode)
7. Debug info (FPS, memory, chunks)

## Data Structures

### Configuration Files

**tiles.json:**

```json
{
  "tiles": {
    "landing_pad": {
      "texture": "landing_pad.png",
      "walkable": true,
      "buildCost": 0,
      "isHub": true,
      "connections": [
        "road"
      ]
    },
    "underground_entrance": {
      "texture": "underground.png",
      "walkable": true,
      "buildCost": 0,
      "isHub": true,
      "connections": [
        "road"
      ]
    },
    "road": {
      "texture": "road.png",
      "walkable": true,
      "buildCost": 10,
      "connections": [
        "road",
        "building_entrance",
        "landing_pad",
        "underground_entrance"
      ]
    },
    "building_residential": {
      "texture": "house.png",
      "walkable": false,
      "buildCost": 50,
      "deliveryInterval": 30,
      "deliveryTypes": [
        "food",
        "goods"
      ]
    }
  }
}
```

**simulation.json:**

```json
{
  "vehicles": {
    "truck": {
      "speed": 2.0,
      "capacity": 10,
      "texture": "truck.png"
    }
  },
  "deliveryTypes": {
    "food": {
      "priority": 1,
      "reward": 5
    },
    "goods": {
      "priority": 2,
      "reward": 3
    }
  }
}
```

## Event System

### Input Events

- `TilePlaceRequest(x, y, tileType)`
- `TileRemoveRequest(x, y)`
- `StateChangeRequest(newState)`
- `PauseToggle()`

### Simulation Events

- `DeliveryCreated(building, type)`
- `VehicleArrived(vehicle, destination)`
- `PathBlocked(vehicle, obstaclePosition)`
- `ResourceChanged(type, amount)`

### Rendering Events

- `TileUpdated(x, y)`
- `VehicleMoved(vehicle, oldPos, newPos)`
- `EffectTriggered(type, position)`

## Performance Considerations

### Optimization Strategies

1. **Chunked Storage**: Two-tier dictionary→array for cache-friendly access
2. **Spatial Partitioning**: Grid-based hash for vehicle collision detection
3. **Path Caching**: Cache hub→destination templates, invalidate dirty regions
4. **Object Pooling**: Reuse Lists, Paths, and vehicle instances (reduce GC)
5. **Viewport Culling**: Only process/render visible chunks
6. **Batch Rendering**: Sort by texture, use texture atlases
7. **Fixed Timestep**: 30Hz simulation, 60Hz interpolated rendering
8. **Dirty Rectangles**: Only recalculate paths in modified regions

### Target Metrics

- 60 FPS with 100 active vehicles
- < 100ms path calculation for any route
- < 32MB memory footprint
- Instant tile placement feedback

## Implementation Phases

### Phase 1: Core Foundation

- [x] Project setup with raylib-cs
- [ ] Basic game state manager
- [ ] Menu screen with transitions
- [ ] Grid rendering and camera

### Phase 2: Tile System

- [ ] Tile placement/removal
- [ ] Placement validation rules
- [ ] Road connectivity visualization
- [ ] Basic building types

### Phase 3: Simulation

- [ ] Vehicle spawning and movement
- [ ] A* pathfinding implementation
- [ ] Delivery task system
- [ ] Basic economy (resources/costs)

### Phase 4: Polish

- [ ] Particle effects
- [ ] Sound effects
- [ ] Save/load system
- [ ] Performance optimizations

## Technical Constraints

### Dependencies

- .NET 8.0 SDK
- raylib-cs NuGet package
- System.Text.Json for configuration
- System.Numerics for vector math

### Platform Considerations

- Primary: Windows 10/11
- Secondary: Linux (Ubuntu 22.04+)
- OpenGL 3.3 minimum requirement

## Success Metrics

1. **Gameplay**: Player can build a functioning road network with 5+ buildings
2. **Simulation**: Vehicles successfully complete deliveries autonomously
3. **Performance**: Maintains 60 FPS with typical gameplay load
4. **Code Quality**: 80% unit test coverage on simulation logic
5. **User Experience**: State transitions feel smooth and responsive

## Risk Mitigation

### Technical Risks

- **Pathfinding Performance**: Start with simple grid-based A*, optimize later
- **raylib-cs Compatibility**: Test on target platforms early
- **State Management Complexity**: Keep states simple, avoid nested states

### Design Risks

- **Scope Creep**: Strictly follow phase plan, defer features to "future work"
- **Simulation Complexity**: Start with deterministic behaviors, add randomness carefully
- **Visual Clarity**: Test with colorblind modes, ensure good contrast

## Future Enhancements

### Potential Features (Post-MVP)

- Traffic simulation with congestion
- Building upgrades and tech tree
- Day/night cycle with lighting
- Terrain types affecting movement
- Multiplayer support
- Procedural map generation
- Economic supply chains
- Citizens with needs/happiness

## Development Notes

### Code Organization

```
/learning/csharp_graphics/
├── src/
│   ├── Core/           # Game state, main loop
│   ├── Grid/           # Tile system, placement
│   ├── Simulation/     # Vehicles, pathfinding
│   ├── Rendering/      # Graphics, UI
│   ├── Data/           # Configuration, save/load
│   └── Utils/          # Helpers, extensions
├── assets/
│   ├── textures/
│   ├── sounds/
│   └── configs/
├── tests/
└── DESIGN.md
```

### Coding Standards

- Use C# 12 features where beneficial
- Prefer composition over inheritance
- All public APIs must have XML documentation
- Unit test all simulation logic
- Keep Update loops under 16ms

### Testing Strategy

- Unit tests for simulation logic (no graphics)
- Integration tests for state transitions
- Manual testing for visual elements
- Performance profiling for optimization

---

*This design document represents the initial architecture. It will evolve as implementation reveals new insights and
requirements.*
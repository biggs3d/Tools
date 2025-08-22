# City Builder Simulation - Design Document

## Core Vision

A minimalistic grid-based city builder featuring:

- **Shape/color-based resource system** - Visual, intuitive resource management
- **Terrain-based gathering** - Strategic placement based on map features
- **Factory production chains** - Combine basic shapes into complex resources
- **Autonomous vehicle logistics** - Node-based pathfinding and delivery
- **Orbital delivery contracts** - Timed challenges for progression

## Shape-Based Resource System

### Resource Tiers

#### Tier 1: Basic Resources (Gathered from terrain)

| Resource       | Shape       | Color  | Source          | Building Type       |
|----------------|-------------|--------|-----------------|---------------------|
| Water Resource | Teardrop 💧 | Blue   | Water tiles     | Round building      |
| Ore Resource   | Square ■    | Red    | Ore deposits    | Square building     |
| Stone Resource | Triangle ▲  | Yellow | Rock formations | Triangular building |

#### Tier 2: Factory Resources (Two inputs)

| Output         | Shape     | Color  | Recipe        | Purpose               |
|----------------|-----------|--------|---------------|-----------------------|
| Green Hexagon  | Hexagon ⬢ | Green  | Blue + Yellow | Mid-tier construction |
| Orange Circle  | Circle ●  | Orange | Yellow + Red  | Mid-tier construction |
| Purple Diamond | Diamond ♦ | Purple | Blue + Red    | Mid-tier construction |

#### Tier 3: Advanced Resources (Complex recipes)

| Output         | Shape        | Color  | Recipe          | Purpose                    |
|----------------|--------------|--------|-----------------|----------------------------|
| Black Beam     | Horizontal ▬ | Black  | Green + Purple  | Advanced construction      |
| White Pillar   | Vertical ▮   | White  | Purple + Orange | Advanced construction      |
| Silver Trusses | X-shape ✖    | Silver | Black + White   | Hub upgrades/Map expansion |

### Building Types

1. **Gathering Buildings** - Extract basic resources from terrain
    - Must be placed adjacent to appropriate terrain type
    - Production rate scales with building level

2. **Conversion Factories** - Transform resources via recipes
    - Require specific input combinations
    - Output single resource type

3. **Storage Buildings** - Buffer resources between producers/consumers
    - Passive buffers (Phase 1)
    - Future: Service buildings with area effects

4. **Usage Buildings**
    - **Residential** - Consume resources, provide population
    - **Research** - Convert resources to tech points
    - **Hub** - Accept Silver Trusses for map expansion

## Architecture Overview

### Technology Stack

- **Language**: C# (.NET 8.0)
- **Graphics**: raylib-cs (4.5.0+)
- **Architecture**: Entity-Component-System (ECS) lite pattern
- **State Management**: Finite State Machine with event-driven transitions

### Core Systems (Implemented)

```
GameLoop
├── EventBus (pub-sub for decoupled communication) ✅
├── AssetManager (texture/sound loading and caching) ✅
├── GridSystem (chunked sparse storage, unlimited size) ✅
├── BuildingManager (tracks all buildings and resources) ✅
├── TaskMatcher (optimized supply chain matching) ✅
├── PathfindingService (A* with caching) ✅
└── Fixed Timestep (30Hz sim, 60Hz render) ✅
```

### Grid System (Implemented)

```csharp
// Current implementation uses integer resources
public enum ResourceType {
    None = 0,
    BlueTeardrop = 1,    // From water
    RedSquare = 2,       // From ore
    YellowTriangle = 3,  // From rock
    GreenHexagon = 4,    // Blue + Yellow
    OrangeCircle = 5,    // Yellow + Red
    PurpleDiamond = 6,   // Blue + Red
    BlackBeam = 7,       // Green + Purple
    WhitePillar = 8,     // Purple + Orange
    SilverTruss = 9,     // Black + White
    Count = 10
}

// Integer-based inventory for clean resource counts
public struct InventorySlot {
    public int Current;
    public int Max;
    public int InTransit;
    public int ProductionRate;  // per tick
    public int ConsumptionRate; // per tick
}
```

## Gameplay Progression

### Phase 1: Core Loop ✅ COMPLETE

- Shape-based resources implemented
- Integer inventory system
- Basic building placeholders
- Texture loading system

### Phase 2: Terrain & Gathering (Current)

1. Add terrain types to tiles (Water, Ore, Rock, Normal)
2. Implement terrain-checking for gathering buildings
3. Visual feedback for resource production

### Phase 3: Production Chains

1. Recipe-based factory system
2. First factory: Blue + Red → Purple Diamond
3. Resource flow visualization

### Phase 4: Contracts & Progression

1. Orbital delivery contracts with timers
2. Research tree (3 branches: Efficiency, Logistics, Innovation)
3. Hub expansion with Silver Trusses

### Phase 5: Polish

1. Building animations (idle, active, blocked states)
2. Floating resource icons
3. Inventory bar visualization

## Design Decisions

### Finalized Decisions

- **Building Upgrades**: Through build menu, Lvl2 = 2 grid spaces
- **Storage**: Passive buffers initially
- **Resource Amounts**: Integer values only
- **No Processing Buildings**: Just gathering and conversion
- **Visual States**: Pulsing outlines for needed resources

### Pending Decisions

- **Cyclic Gameplay**: Orbital deliveries vs seasonal effects
- **Failure States**: Soft failure with visual feedback
- **Building Level Effects**: Production time scales with level (config-driven)

## Visual Design

### Current Assets

- 9 shape textures (32x32) in `assets/textures/shapes/`
- ResourceTextures helper class for loading
- Color-coded vehicle cargo display

### Planned Visuals

- **Building States**:
    - Idle: Pulsing resource outline
    - Active: Subtle glow
    - Blocked: Warning icon
    - No-Demand: "Zzz" symbol

- **Resource Display**:
    - Stacked bars for inventory
    - Floating icons on production
    - Shape symbols in UI

## Performance Targets

- 60 FPS with 100+ vehicles
- < 100ms pathfinding
- Instant tile placement
- Smooth chunk streaming

## File Structure

```
/CityBuilder/
├── src/
│   ├── Core/           # Game state, main loop, ResourceTextures ✅
│   ├── Grid/           # Tile system, chunks ✅
│   ├── Simulation/     # Buildings, vehicles, resources ✅
│   ├── Rendering/      # Graphics, UI
│   └── States/         # Menu, gameplay states ✅
├── assets/
│   └── textures/
│       └── shapes/     # 9 resource PNGs ✅
└── tests/              # Unit tests (need updating)
```

## Next Session Priorities

1. **Terrain System**
    - Add TerrainType enum (Water, Ore, Rock, Normal)
    - Modify tile placement to respect terrain
    - Generate basic terrain patterns

2. **Gathering Buildings**
    - Round building checks for adjacent water
    - Square building checks for ore deposits
    - Triangle building checks for rock formations

3. **Visual Integration**
    - Display shape textures on vehicles
    - Show resource icons on buildings
    - Implement inventory bars

## Quick Decision Framework

When adding features, ask:

1. **Does it reinforce the shape/color identity?** If no, reconsider.
2. **Can a new player understand it in 10 seconds?** If no, simplify.
3. **Does it add a meaningful choice?** If no, cut it.
4. **Can it be added without breaking existing systems?** If no, defer it.

Remember: The shape/color system IS the game. Everything else supports that core identity.
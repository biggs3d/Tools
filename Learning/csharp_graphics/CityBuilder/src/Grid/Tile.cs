namespace CityBuilder.Grid;

/// <summary>
/// Represents a single tile in the game grid
/// </summary>
public struct Tile
{
    /// <summary>
    /// The type of tile (road, building, etc.)
    /// </summary>
    public TileType Type { get; set; }
    
    /// <summary>
    /// The terrain type of this tile (water, ore, rock, etc.)
    /// </summary>
    public TerrainType Terrain { get; set; }
    
    /// <summary>
    /// Bit flags indicating which neighbors this tile connects to
    /// </summary>
    public NeighborMask NeighborMask { get; set; }
    
    /// <summary>
    /// Whether units can walk through this tile (derived from type)
    /// </summary>
    public readonly bool IsWalkable => IsWalkableType(Type);
    
    /// <summary>
    /// Creates an empty tile
    /// </summary>
    public static readonly Tile Empty = new Tile 
    { 
        Type = TileType.Empty,
        Terrain = TerrainType.Normal,
        NeighborMask = NeighborMask.None
    };
    
    /// <summary>
    /// Creates a road tile
    /// </summary>
    public static Tile CreateRoad() => new Tile
    {
        Type = TileType.Road,
        Terrain = TerrainType.Normal,
        NeighborMask = NeighborMask.None
    };
    
    /// <summary>
    /// Creates a building tile
    /// </summary>
    public static Tile CreateBuilding(TileType buildingType) => new Tile
    {
        Type = buildingType,
        Terrain = TerrainType.Normal,
        NeighborMask = NeighborMask.None
    };
    
    /// <summary>
    /// Determines if a tile type is walkable
    /// </summary>
    private static bool IsWalkableType(TileType type)
    {
        return type == TileType.Road ||
               type == TileType.Highway ||
               type == TileType.Bridge ||
               type == TileType.LandingPad ||
               type == TileType.UndergroundEntrance;
    }
}

/// <summary>
/// Represents terrain data for procedural generation
/// </summary>
public struct TerrainTile
{
    /// <summary>
    /// The type of terrain
    /// </summary>
    public TerrainType Type { get; set; }
    
    /// <summary>
    /// Elevation value from noise function
    /// </summary>
    public float Elevation { get; set; }
    
    /// <summary>
    /// Movement cost for pathfinding (1-10)
    /// </summary>
    public byte MovementCost { get; set; }
    
    /// <summary>
    /// Whether this terrain can be built upon
    /// </summary>
    public bool CanBuild { get; set; }
    
    /// <summary>
    /// Creates a default normal terrain tile
    /// </summary>
    public static readonly TerrainTile Normal = new TerrainTile
    {
        Type = TerrainType.Normal,
        Elevation = 0f,
        MovementCost = 1,
        CanBuild = true
    };
}
namespace CityBuilder.Grid;

/// <summary>
/// Defines all possible tile types in the game
/// </summary>
public enum TileType : byte
{
    Empty = 0,
    
    // Infrastructure
    Road = 1,
    Highway = 2,  // Future feature
    Bridge = 3,   // Future feature
    
    // Hub types (entry/exit points)
    LandingPad = 10,
    UndergroundEntrance = 11,
    
    // Buildings
    Residential = 20,
    Commercial = 21,
    Industrial = 22,
    
    // Services (future)
    Police = 30,
    Fire = 31,
    Hospital = 32,
    School = 33,
    
    // Utilities (future)
    PowerPlant = 40,
    WaterTower = 41,
    
    // Special
    Park = 50,
    Monument = 51
}

/// <summary>
/// Terrain types for the base layer
/// </summary>
public enum TerrainType : byte
{
    Grass = 0,      // Default, buildable
    Water = 1,      // Not buildable without bridge
    Sand = 2,       // Buildable, visual variety
    Forest = 3,     // Buildable, visual variety
    Mountain = 4    // Not buildable
}

/// <summary>
/// Bit flags for tile neighbor connections
/// </summary>
[Flags]
public enum NeighborMask : byte
{
    None = 0,
    North = 1,
    East = 2,
    South = 4,
    West = 8,
    All = North | East | South | West
}
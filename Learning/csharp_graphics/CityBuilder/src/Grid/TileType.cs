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
    
    // Gathering Buildings (extract basic resources from terrain)
    WaterGatherer = 20,    // Round building - extracts Blue Teardrops from water
    OreExtractor = 21,     // Square building - mines Red Squares from ore
    RockHarvester = 22,    // Triangle building - gathers Yellow Triangles from rock
    
    // Factory Buildings (combine resources)
    FactoryTier2 = 25,     // Combines two basic resources
    FactoryTier3 = 26,     // Combines tier 2 resources
    
    // Usage Buildings  
    Residential = 30,      // Consumes resources, provides population
    Research = 31,         // Converts resources to tech points
    
    // Services (future)
    Police = 40,
    Fire = 41,
    Hospital = 42,
    School = 43,
    
    // Utilities (future)
    PowerPlant = 50,
    WaterTower = 51,
    
    // Special
    Park = 60,
    Monument = 61
}

/// <summary>
/// Terrain types for the base layer
/// </summary>
public enum TerrainType : byte
{
    Normal = 0,         // Default, buildable terrain
    Water = 1,          // For blue teardrops (gathering)
    OreDeposit = 2,     // For red squares (gathering)
    RockFormation = 3,  // For yellow triangles (gathering)
    Sand = 4,           // Buildable, visual variety
    Forest = 5,         // Buildable, visual variety
    Mountain = 6        // Not buildable
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
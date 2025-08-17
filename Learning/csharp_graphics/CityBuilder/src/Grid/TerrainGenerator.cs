namespace CityBuilder.Grid;

/// <summary>
/// Generates procedural terrain using noise functions
/// </summary>
public class TerrainGenerator
{
    private readonly int _seed;
    private readonly Random _random;
    
    // Noise scale factors
    private const float ElevationScale = 0.01f;
    private const float VegetationScale = 0.05f;
    private const float DetailScale = 0.1f;
    
    // Terrain thresholds
    private const float WaterLevel = -0.2f;
    private const float SandLevel = -0.1f;
    private const float MountainLevel = 0.7f;
    private const float ForestThreshold = 0.3f;
    
    public TerrainGenerator(int seed = 0)
    {
        _seed = seed;
        _random = new Random(seed);
    }
    
    /// <summary>
    /// Generates a terrain tile at the given world tile coordinates
    /// </summary>
    public TerrainTile GenerateTile(int worldX, int worldY)
    {
        // Generate elevation using simple noise (we'll use a basic implementation for now)
        float elevation = GenerateNoise(worldX * ElevationScale, worldY * ElevationScale, 0);
        
        // Generate vegetation noise for forest placement
        float vegetation = GenerateNoise(worldX * VegetationScale, worldY * VegetationScale, 1000);
        
        // Add some detail noise for variety
        float detail = GenerateNoise(worldX * DetailScale, worldY * DetailScale, 2000) * 0.1f;
        elevation += detail;
        
        // Determine terrain type based on elevation and vegetation
        TerrainType type;
        bool canBuild;
        byte movementCost;
        
        if (elevation < WaterLevel)
        {
            type = TerrainType.Water;
            canBuild = false;
            movementCost = 10; // Can't normally move through water
        }
        else if (elevation < SandLevel)
        {
            type = TerrainType.Sand;
            canBuild = true;
            movementCost = 2; // Slightly slower on sand
        }
        else if (elevation > MountainLevel)
        {
            type = TerrainType.Mountain;
            canBuild = false;
            movementCost = 10; // Can't move through mountains
        }
        else if (vegetation > ForestThreshold)
        {
            type = TerrainType.Forest;
            canBuild = true;
            movementCost = 1; // Normal movement through forest
        }
        else
        {
            type = TerrainType.Grass;
            canBuild = true;
            movementCost = 1; // Normal movement
        }
        
        return new TerrainTile
        {
            Type = type,
            Elevation = elevation,
            MovementCost = movementCost,
            CanBuild = canBuild
        };
    }
    
    /// <summary>
    /// Simple noise function implementation
    /// This is a placeholder - in production, you'd use SimplexNoise or Perlin noise
    /// </summary>
    private float GenerateNoise(float x, float y, int offset)
    {
        // This is a very basic pseudo-noise function
        // In a real implementation, you'd use SimplexNoise NuGet package
        
        int ix = (int)Math.Floor(x);
        int iy = (int)Math.Floor(y);
        
        float fx = x - ix;
        float fy = y - iy;
        
        // Generate corner values
        float a = PseudoRandom(ix + offset, iy + offset);
        float b = PseudoRandom(ix + 1 + offset, iy + offset);
        float c = PseudoRandom(ix + offset, iy + 1 + offset);
        float d = PseudoRandom(ix + 1 + offset, iy + 1 + offset);
        
        // Interpolate
        float ux = fx * fx * (3 - 2 * fx); // Smooth curve
        float uy = fy * fy * (3 - 2 * fy);
        
        float ab = Lerp(a, b, ux);
        float cd = Lerp(c, d, ux);
        
        return Lerp(ab, cd, uy);
    }
    
    /// <summary>
    /// Generates a pseudo-random value for given coordinates
    /// </summary>
    private float PseudoRandom(int x, int y)
    {
        // Simple hash function for deterministic "random" values
        int hash = x * 374761393 + y * 668265263 + _seed;
        hash = (hash ^ (hash >> 13)) * 1274126177;
        hash = hash ^ (hash >> 16);
        
        // Convert to float in range [-1, 1]
        return (hash & 0xFFFFFF) / (float)0x7FFFFF - 1f;
    }
    
    /// <summary>
    /// Linear interpolation
    /// </summary>
    private float Lerp(float a, float b, float t)
    {
        return a + (b - a) * t;
    }
    
    /// <summary>
    /// Checks if a position should have a river
    /// For now, rivers are not implemented
    /// </summary>
    public bool IsRiverAt(int worldX, int worldY)
    {
        // TODO: Implement river generation
        return false;
    }
}
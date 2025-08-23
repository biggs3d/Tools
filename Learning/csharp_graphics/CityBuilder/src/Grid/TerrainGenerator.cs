namespace CityBuilder.Grid;

/// <summary>
/// Generates procedural terrain using noise functions with resource deposits
/// </summary>
public class TerrainGenerator
{
    private readonly int _seed;
    private readonly Random _random;
    
    // Noise scale factors
    private const float ElevationScale = 0.03f;    // Larger features
    private const float ResourceScale = 0.08f;     // Medium features for resources
    private const float DetailScale = 0.15f;       // Small detail noise
    
    // Terrain thresholds
    private const float WaterLevel = -0.3f;        // Lakes and ponds
    private const float MountainLevel = 0.6f;      // Impassable mountains
    private const float ForestThreshold = 0.2f;    // Forest placement
    
    // Resource thresholds (using secondary noise)
    private const float OreThreshold = 0.4f;       // Ore deposit placement
    private const float RockThreshold = 0.35f;     // Rock formation placement
    
    // Center-biased generation radius
    private const float SafeZoneRadius = 10f;      // Safe area around origin (reduced for testing)
    private const float ResourceZoneMin = 5f;      // Min distance for resources (reduced for testing)
    private const float ResourceZoneMax = 100f;    // Max distance for good resources
    
    public TerrainGenerator(int seed = 0)
    {
        _seed = seed;
        _random = new Random(seed);
        Console.WriteLine($"TerrainGenerator initialized with seed {seed}");
        Console.WriteLine($"Resource zone: {ResourceZoneMin} to {ResourceZoneMax} tiles from origin");
    }
    
    /// <summary>
    /// Generates a terrain tile at the given world tile coordinates
    /// </summary>
    public TerrainTile GenerateTile(int worldX, int worldY)
    {
        // Distance from origin (for center-biased generation)
        float distanceFromOrigin = MathF.Sqrt(worldX * worldX + worldY * worldY);
        
        // Generate base elevation
        float elevation = GenerateNoise(worldX * ElevationScale, worldY * ElevationScale, 0);
        
        // Generate resource noise (separate layer for ore/rock placement)
        float resourceNoise = GenerateNoise(worldX * ResourceScale, worldY * ResourceScale, 1000);
        
        // Generate vegetation noise
        float vegetation = GenerateNoise(worldX * ResourceScale, worldY * ResourceScale, 2000);
        
        // Add detail noise
        float detail = GenerateNoise(worldX * DetailScale, worldY * DetailScale, 3000) * 0.1f;
        elevation += detail;
        
        // Bias elevation based on distance (flatten center, more extreme at edges)
        if (distanceFromOrigin < SafeZoneRadius)
        {
            // Flatten the safe zone - make it mostly normal terrain
            elevation = elevation * 0.3f;
        }
        else
        {
            // Gradually increase variation outside safe zone
            float distanceFactor = Math.Min((distanceFromOrigin - SafeZoneRadius) / 50f, 1.5f);
            elevation = elevation * (1f + distanceFactor);
        }
        
        // Determine terrain type
        TerrainType type;
        bool canBuild;
        byte movementCost;
        
        // Check for water first (lakes and ponds)
        if (elevation < WaterLevel && distanceFromOrigin > SafeZoneRadius * 0.5f)
        {
            type = TerrainType.Water;
            canBuild = false;
            movementCost = 10;
        }
        // Check for mountains (impassable terrain)
        else if (elevation > MountainLevel && distanceFromOrigin > SafeZoneRadius)
        {
            type = TerrainType.Mountain;
            canBuild = false;
            movementCost = 10;
        }
        // Check for resource deposits (in appropriate zones)
        else if (distanceFromOrigin >= ResourceZoneMin && distanceFromOrigin <= ResourceZoneMax)
        {
            // Default values (will be overridden if resource found)
            type = TerrainType.Normal;
            canBuild = true;
            movementCost = 1;
            
            // Ore deposits - use resource noise and some randomness
            if (resourceNoise > OreThreshold && elevation > -0.1f && elevation < 0.4f)
            {
                // Create ore clusters
                float oreClusterNoise = GenerateNoise(worldX * 0.2f, worldY * 0.2f, 4000);
                if (oreClusterNoise > 0.2f)
                {
                    type = TerrainType.OreDeposit;
                    canBuild = false; // Can't build on ore
                    movementCost = 1;
                    if (_random.NextDouble() < 0.01) // Log 1% of ore tiles to avoid spam
                        Console.WriteLine($"Generated ore deposit at ({worldX}, {worldY})");
                }
            }
            // Rock formations - different noise pattern
            else if (resourceNoise > RockThreshold && resourceNoise <= OreThreshold && elevation > 0f)
            {
                // Create rock clusters
                float rockClusterNoise = GenerateNoise(worldX * 0.25f, worldY * 0.25f, 5000);
                if (rockClusterNoise > 0.15f)
                {
                    type = TerrainType.RockFormation;
                    canBuild = false; // Can't build on rocks
                    movementCost = 2;
                }
            }
            // Forest areas
            else if (vegetation > ForestThreshold && elevation > 0f)
            {
                type = TerrainType.Forest;
                canBuild = true;
                movementCost = 1;
            }
        }
        // Outside resource zone - more variety
        else if (distanceFromOrigin > ResourceZoneMax)
        {
            if (vegetation > ForestThreshold && elevation > 0f && elevation < MountainLevel)
            {
                type = TerrainType.Forest;
                canBuild = true;
                movementCost = 1;
            }
            else if (elevation < -0.05f && elevation > WaterLevel)
            {
                type = TerrainType.Sand;
                canBuild = true;
                movementCost = 2;
            }
            else
            {
                type = TerrainType.Normal;
                canBuild = true;
                movementCost = 1;
            }
        }
        // Safe zone - mostly normal terrain
        else
        {
            type = TerrainType.Normal;
            canBuild = true;
            movementCost = 1;
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
    /// Creates deliberate water bodies (rivers, lakes)
    /// </summary>
    public bool IsSpecialWaterAt(int worldX, int worldY)
    {
        // GUARANTEED small pond very close to origin for testing
        float pondNearOriginX = 8f;
        float pondNearOriginY = 0f;
        float pondNearOriginRadius = 3f;
        float pondNearOriginDist = MathF.Sqrt(MathF.Pow(worldX - pondNearOriginX, 2) + MathF.Pow(worldY - pondNearOriginY, 2));
        if (pondNearOriginDist < pondNearOriginRadius)
        {
            return true; // No noise, guaranteed water
        }
        
        // Lake in positive quadrant
        float lakeCenterX = 15f;
        float lakeCenterY = -10f;
        float lakeRadius = 8f;
        float lakeDistance = MathF.Sqrt(MathF.Pow(worldX - lakeCenterX, 2) + MathF.Pow(worldY - lakeCenterY, 2));
        if (lakeDistance < lakeRadius)
        {
            // Add some noise to make it less circular
            float lakeNoise = GenerateNoise(worldX * 0.1f, worldY * 0.1f, 6000);
            return lakeDistance < lakeRadius * (0.8f + lakeNoise * 0.3f);
        }
        
        // Pond in negative quadrant
        float pondCenterX = -12f;
        float pondCenterY = 8f;
        float pondRadius = 6f;
        float pondDistance = MathF.Sqrt(MathF.Pow(worldX - pondCenterX, 2) + MathF.Pow(worldY - pondCenterY, 2));
        if (pondDistance < pondRadius)
        {
            float pondNoise = GenerateNoise(worldX * 0.15f, worldY * 0.15f, 7000);
            return pondDistance < pondRadius * (0.7f + pondNoise * 0.4f);
        }
        
        return false;
    }
    
    /// <summary>
    /// Creates guaranteed ore deposits near origin
    /// </summary>
    public bool IsGuaranteedOreAt(int worldX, int worldY)
    {
        // Guaranteed ore patch to the north
        float oreCenterX = 0f;
        float oreCenterY = -8f;
        float oreRadius = 2.5f;
        float oreDist = MathF.Sqrt(MathF.Pow(worldX - oreCenterX, 2) + MathF.Pow(worldY - oreCenterY, 2));
        return oreDist < oreRadius;
    }
    
    /// <summary>
    /// Creates guaranteed rock formations near origin
    /// </summary>
    public bool IsGuaranteedRockAt(int worldX, int worldY)
    {
        // Guaranteed rock formation to the west
        float rockCenterX = -8f;
        float rockCenterY = -3f;
        float rockRadius = 2.5f;
        float rockDist = MathF.Sqrt(MathF.Pow(worldX - rockCenterX, 2) + MathF.Pow(worldY - rockCenterY, 2));
        return rockDist < rockRadius;
    }
    
    /// <summary>
    /// Simple noise function implementation
    /// </summary>
    private float GenerateNoise(float x, float y, int offset)
    {
        int ix = (int)Math.Floor(x);
        int iy = (int)Math.Floor(y);
        
        float fx = x - ix;
        float fy = y - iy;
        
        // Generate corner values
        float a = PseudoRandom(ix + offset, iy + offset);
        float b = PseudoRandom(ix + 1 + offset, iy + offset);
        float c = PseudoRandom(ix + offset, iy + 1 + offset);
        float d = PseudoRandom(ix + 1 + offset, iy + 1 + offset);
        
        // Smooth interpolation
        float ux = fx * fx * (3 - 2 * fx);
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
}
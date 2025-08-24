using Raylib_cs;
using CityBuilder.Grid;

namespace CityBuilder.Core;

/// <summary>
/// Helper class for loading and managing building textures
/// </summary>
public static class BuildingTextures
{
    private static readonly Dictionary<TileType, string> BuildingTextureFiles = new()
    {
        { TileType.WaterGatherer, "assets/textures/buildings/water_gatherer.png" },
        { TileType.OreExtractor, "assets/textures/buildings/ore_extractor.png" },
        { TileType.RockHarvester, "assets/textures/buildings/rock_harvester.png" },
        { TileType.FactoryTier2, "assets/textures/buildings/factory_purple_diamond.png" },
        { TileType.Residential, "assets/textures/buildings/residential.png" }
    };
    
    private static readonly Dictionary<TileType, Texture2D> _buildingTextures = new();
    private static bool _initialized = false;
    
    /// <summary>
    /// Initialize and load all building textures
    /// </summary>
    public static void LoadAll(AssetManager assetManager)
    {
        if (_initialized) return;
        
        Console.WriteLine("Loading building textures...");
        
        foreach (var (tileType, path) in BuildingTextureFiles)
        {
            var texture = assetManager.GetTexture(path);
            _buildingTextures[tileType] = texture;
            Console.WriteLine($"  Loaded {tileType}: {path}");
        }
        
        _initialized = true;
        Console.WriteLine($"Loaded {_buildingTextures.Count} building textures");
    }
    
    /// <summary>
    /// Get the texture for a specific building type
    /// </summary>
    public static Texture2D? GetTexture(TileType buildingType)
    {
        return _buildingTextures.TryGetValue(buildingType, out var texture) ? texture : null;
    }
    
    /// <summary>
    /// Check if a texture exists for the given building type
    /// </summary>
    public static bool HasTexture(TileType buildingType)
    {
        return _buildingTextures.ContainsKey(buildingType);
    }
    
    /// <summary>
    /// Get all loaded building textures
    /// </summary>
    public static IReadOnlyDictionary<TileType, Texture2D> GetAllTextures()
    {
        return _buildingTextures;
    }
    
    /// <summary>
    /// Helper to get texture path for a building type (for UI/debugging)
    /// </summary>
    public static string? GetTexturePath(TileType buildingType)
    {
        return BuildingTextureFiles.TryGetValue(buildingType, out var path) ? path : null;
    }
}
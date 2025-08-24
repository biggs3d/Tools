using Raylib_cs;
using CityBuilder.Simulation;

namespace CityBuilder.Core;

/// <summary>
/// Manages textures for the shape-based resources
/// </summary>
public static class ResourceTextures
{
    private const string ShapeTexturesPath = "assets/textures/shapes/";
    private static readonly Dictionary<ResourceType, Texture2D> _resourceTextures = new();
    private static bool _initialized = false;
    
    /// <summary>
    /// Gets the texture path for a specific resource type
    /// </summary>
    public static string GetTexturePath(ResourceType resource)
    {
        return resource switch
        {
            ResourceType.BlueTeardrop => $"{ShapeTexturesPath}blue_teardrop.png",
            ResourceType.RedSquare => $"{ShapeTexturesPath}red_square.png",
            ResourceType.YellowTriangle => $"{ShapeTexturesPath}yellow_triangle.png",
            ResourceType.GreenHexagon => $"{ShapeTexturesPath}green_hexagon.png",
            ResourceType.OrangeCircle => $"{ShapeTexturesPath}orange_circle.png",
            ResourceType.PurpleDiamond => $"{ShapeTexturesPath}purple_diamond.png",
            ResourceType.BlackBeam => $"{ShapeTexturesPath}black_beam.png",
            ResourceType.WhitePillar => $"{ShapeTexturesPath}white_pillar.png",
            ResourceType.SilverTruss => $"{ShapeTexturesPath}silver_truss.png",
            _ => ""
        };
    }
    
    /// <summary>
    /// Gets the display color for a resource type (matches the actual colors)
    /// </summary>
    public static Color GetResourceColor(ResourceType resource)
    {
        return resource switch
        {
            ResourceType.BlueTeardrop => new Color(0, 191, 255, 255),     // Blue
            ResourceType.RedSquare => new Color(255, 0, 0, 255),          // Red
            ResourceType.YellowTriangle => new Color(255, 255, 0, 255),   // Yellow
            ResourceType.GreenHexagon => new Color(0, 255, 0, 255),       // Green
            ResourceType.OrangeCircle => new Color(255, 165, 0, 255),     // Orange
            ResourceType.PurpleDiamond => new Color(128, 0, 128, 255),    // Purple
            ResourceType.BlackBeam => new Color(50, 50, 50, 255),         // Dark gray (not pure black for visibility)
            ResourceType.WhitePillar => new Color(240, 240, 240, 255),    // Off-white (not pure white for visibility)
            ResourceType.SilverTruss => new Color(192, 192, 192, 255),    // Silver
            _ => Color.Gray
        };
    }
    
    /// <summary>
    /// Gets a short display string for a resource
    /// </summary>
    public static string GetResourceSymbol(ResourceType resource)
    {
        return resource switch
        {
            ResourceType.BlueTeardrop => "💧",
            ResourceType.RedSquare => "■",
            ResourceType.YellowTriangle => "▲",
            ResourceType.GreenHexagon => "⬢",
            ResourceType.OrangeCircle => "●",
            ResourceType.PurpleDiamond => "♦",
            ResourceType.BlackBeam => "▬",
            ResourceType.WhitePillar => "▮",
            ResourceType.SilverTruss => "✖",
            _ => "?"
        };
    }
    
    /// <summary>
    /// Initialize and load all resource textures
    /// </summary>
    public static void LoadAll(AssetManager assetManager)
    {
        if (_initialized) return;
        
        Console.WriteLine("Loading resource textures...");
        
        // Load each resource texture
        foreach (ResourceType resourceType in Enum.GetValues<ResourceType>())
        {
            if (resourceType == ResourceType.None) continue;
            
            var path = GetTexturePath(resourceType);
            if (!string.IsNullOrEmpty(path))
            {
                var texture = assetManager.GetTexture(path);
                _resourceTextures[resourceType] = texture;
                Console.WriteLine($"  Loaded {resourceType}: {path}");
            }
        }
        
        _initialized = true;
        Console.WriteLine($"Loaded {_resourceTextures.Count} resource textures");
    }
    
    /// <summary>
    /// Loads a resource texture using the AssetManager
    /// </summary>
    public static Texture2D LoadResourceTexture(AssetManager assetManager, ResourceType resource)
    {
        // Try to get from cache first
        if (_resourceTextures.TryGetValue(resource, out var cachedTexture))
        {
            return cachedTexture;
        }
        
        // Fallback to loading on demand
        var path = GetTexturePath(resource);
        return string.IsNullOrEmpty(path) ? new Texture2D() : assetManager.GetTexture(path);
    }
    
    /// <summary>
    /// Get texture from cache (requires LoadAll to be called first)
    /// </summary>
    public static Texture2D? GetTexture(ResourceType resource)
    {
        return _resourceTextures.TryGetValue(resource, out var texture) ? texture : null;
    }
}
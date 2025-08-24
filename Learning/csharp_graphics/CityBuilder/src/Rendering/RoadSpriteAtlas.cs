using Raylib_cs;
using CityBuilder.Grid;
using CityBuilder.Core;
using System.Numerics;

namespace CityBuilder.Rendering;

/// <summary>
/// Manages road sprite atlas with 16 tiles (4x4 grid of 32x32 sprites)
/// Maps NeighborMask to appropriate sprite positions
/// </summary>
public class RoadSpriteAtlas
{
    private Texture2D _atlasTexture;
    private readonly int _tileSize = 32;
    private readonly int _atlasColumns = 4;
    private readonly int _atlasRows = 4;
    
    // Maps neighbor connections to atlas positions (x, y in grid)
    // Using standard road tile conventions:
    // 0 = no connection, 15 = all connections
    private readonly Dictionary<NeighborMask, Vector2Int> _spriteMap;
    
    public RoadSpriteAtlas()
    {
        // NOTE: top row: T south, T west, T north, T east
        //       second row: L south-west, L north-west, L north-east, L south-east
        //       third row: straight vertical, straight horizontal, crossroads, dot
        //       bottom row: deadends south, west, north, east

        _spriteMap = new Dictionary<NeighborMask, Vector2Int>
        {
            // Row 0 (top row) - T-junctions
            { NeighborMask.East | NeighborMask.West | NeighborMask.South, new Vector2Int(0, 0) },   // T-junction opening south
            { NeighborMask.North | NeighborMask.South | NeighborMask.West, new Vector2Int(1, 0) },  // T-junction opening west
            { NeighborMask.East | NeighborMask.West | NeighborMask.North, new Vector2Int(2, 0) },   // T-junction opening north
            { NeighborMask.North | NeighborMask.South | NeighborMask.East, new Vector2Int(3, 0) },  // T-junction opening east
            
            // Row 1 - L-shapes (corners)
            { NeighborMask.South | NeighborMask.West, new Vector2Int(0, 1) },     // L-shape SW
            { NeighborMask.North | NeighborMask.West, new Vector2Int(1, 1) },     // L-shape NW
            { NeighborMask.North | NeighborMask.East, new Vector2Int(2, 1) },     // L-shape NE
            { NeighborMask.South | NeighborMask.East, new Vector2Int(3, 1) },     // L-shape SE
            
            // Row 2 - Straights, crossroads, and dot
            { NeighborMask.North | NeighborMask.South, new Vector2Int(0, 2) },    // Vertical straight line
            { NeighborMask.East | NeighborMask.West, new Vector2Int(1, 2) },      // Horizontal straight line
            { NeighborMask.All, new Vector2Int(2, 2) },                           // Four-way crossroads
            { NeighborMask.None, new Vector2Int(3, 2) },                          // Isolated road (dot)
            
            // Row 3 (bottom row) - Dead ends
            { NeighborMask.South, new Vector2Int(0, 3) },                         // Dead end pointing south
            { NeighborMask.West, new Vector2Int(1, 3) },                          // Dead end pointing west
            { NeighborMask.North, new Vector2Int(2, 3) },                         // Dead end pointing north
            { NeighborMask.East, new Vector2Int(3, 3) }                           // Dead end pointing east
        };
    }
    
    /// <summary>
    /// Load the road atlas texture
    /// </summary>
    public void LoadTexture(string path)
    {
        _atlasTexture = Raylib.LoadTexture(path);
        
        if (_atlasTexture.Width != _atlasColumns * _tileSize || 
            _atlasTexture.Height != _atlasRows * _tileSize)
        {
            Console.WriteLine($"Warning: Road atlas expected {_atlasColumns * _tileSize}x{_atlasRows * _tileSize}, " +
                            $"but got {_atlasTexture.Width}x{_atlasTexture.Height}");
        }
    }
    
    /// <summary>
    /// Unload the texture when done
    /// </summary>
    public void UnloadTexture()
    {
        if (_atlasTexture.Id != 0)
        {
            Raylib.UnloadTexture(_atlasTexture);
        }
    }
    
    /// <summary>
    /// Get the source rectangle for a road tile based on its connections
    /// </summary>
    public Rectangle GetSourceRect(NeighborMask connections)
    {
        // Get sprite position from map, default to isolated road if not found
        if (!_spriteMap.TryGetValue(connections, out var spritePos))
        {
            // For unmapped combinations, try to find closest match
            spritePos = FindClosestMatch(connections);
        }
        
        return new Rectangle(
            spritePos.X * _tileSize,
            spritePos.Y * _tileSize,
            _tileSize,
            _tileSize
        );
    }
    
    /// <summary>
    /// Draw a road tile at the specified position
    /// </summary>
    public void DrawRoad(Vector2 position, NeighborMask connections, float scale = 1.0f)
    {
        if (_atlasTexture.Id == 0)
        {
            Console.WriteLine("Warning: Road atlas texture not loaded!");
            return;
        }
        
        var sourceRect = GetSourceRect(connections);
        var destRect = new Rectangle(
            position.X,
            position.Y,
            _tileSize * scale,
            _tileSize * scale
        );
        
        Raylib.DrawTexturePro(
            _atlasTexture,
            sourceRect,
            destRect,
            Vector2.Zero,
            0f,
            Color.White
        );
    }
    
    /// <summary>
    /// Draw a road tile with tinting
    /// </summary>
    public void DrawRoadTinted(Vector2 position, NeighborMask connections, Color tint, float scale = 1.0f)
    {
        if (_atlasTexture.Id == 0)
        {
            Console.WriteLine("Warning: Road atlas texture not loaded!");
            return;
        }
        
        var sourceRect = GetSourceRect(connections);
        var destRect = new Rectangle(
            position.X,
            position.Y,
            _tileSize * scale,
            _tileSize * scale
        );
        
        Raylib.DrawTexturePro(
            _atlasTexture,
            sourceRect,
            destRect,
            Vector2.Zero,
            0f,
            tint
        );
    }
    
    /// <summary>
    /// Find the closest matching sprite for unmapped connection combinations
    /// </summary>
    private Vector2Int FindClosestMatch(NeighborMask connections)
    {
        // Count the number of connections
        int connectionCount = 0;
        if ((connections & NeighborMask.North) != 0) connectionCount++;
        if ((connections & NeighborMask.East) != 0) connectionCount++;
        if ((connections & NeighborMask.South) != 0) connectionCount++;
        if ((connections & NeighborMask.West) != 0) connectionCount++;
        
        // Default fallbacks based on connection count
        switch (connectionCount)
        {
            case 0:
                return new Vector2Int(0, 0); // Isolated
            
            case 1:
                return new Vector2Int(1, 0); // Single connection (use north as default)
            
            case 2:
                // Check if it's a straight line
                if ((connections & (NeighborMask.North | NeighborMask.South)) == (NeighborMask.North | NeighborMask.South))
                    return new Vector2Int(1, 1); // Vertical straight
                if ((connections & (NeighborMask.East | NeighborMask.West)) == (NeighborMask.East | NeighborMask.West))
                    return new Vector2Int(2, 2); // Horizontal straight
                // Otherwise it's an L-shape, default to NE
                return new Vector2Int(3, 0);
            
            case 3:
                return new Vector2Int(3, 1); // T-junction (use east as default)
            
            default:
                return new Vector2Int(3, 3); // Four-way intersection
        }
    }
    
    /// <summary>
    /// Get debug info about the sprite mapping
    /// </summary>
    public string GetDebugInfo(NeighborMask connections)
    {
        var spritePos = _spriteMap.ContainsKey(connections) 
            ? _spriteMap[connections] 
            : FindClosestMatch(connections);
            
        return $"Connections: {connections} -> Atlas[{spritePos.X}, {spritePos.Y}]";
    }
}
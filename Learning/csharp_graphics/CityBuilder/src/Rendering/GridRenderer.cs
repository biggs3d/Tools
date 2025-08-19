using System.Numerics;
using Raylib_cs;
using CityBuilder.Grid;

namespace CityBuilder.Rendering;

/// <summary>
/// Handles rendering of the grid system including terrain and tiles
/// </summary>
public class GridRenderer
{
    private readonly GridSystem _gridSystem;
    private readonly Dictionary<TerrainType, Color> _terrainColors;
    private readonly Dictionary<TileType, Color> _tileColors;
    
    public GridRenderer(GridSystem gridSystem)
    {
        _gridSystem = gridSystem ?? throw new ArgumentNullException(nameof(gridSystem));
        
        // Initialize terrain colors
        _terrainColors = new Dictionary<TerrainType, Color>
        {
            { TerrainType.Grass, new Color(50, 120, 50, 255) },
            { TerrainType.Water, new Color(30, 90, 180, 255) },
            { TerrainType.Sand, new Color(194, 178, 128, 255) },
            { TerrainType.Forest, new Color(30, 80, 30, 255) },
            { TerrainType.Mountain, new Color(130, 130, 130, 255) }
        };
        
        // Initialize tile colors
        _tileColors = new Dictionary<TileType, Color>
        {
            { TileType.Empty, Color.Blank },
            { TileType.Road, new Color(80, 80, 80, 255) },
            { TileType.LandingPad, new Color(150, 150, 180, 255) },
            { TileType.UndergroundEntrance, new Color(60, 60, 90, 255) },
            { TileType.Residential, new Color(100, 200, 100, 255) },
            { TileType.Commercial, new Color(100, 100, 200, 255) },
            { TileType.Industrial, new Color(200, 150, 100, 255) },
            { TileType.Park, new Color(80, 160, 80, 255) }
        };
    }
    
    /// <summary>
    /// Renders all visible chunks
    /// </summary>
    public void Draw(Camera2D camera, int screenWidth, int screenHeight, bool showGrid)
    {
        // Get visible chunks
        var visibleChunks = _gridSystem.GetVisibleChunks(camera, screenWidth, screenHeight);
        
        foreach (var chunk in visibleChunks)
        {
            DrawChunk(chunk);
        }
        
        // Draw grid overlay if enabled
        if (showGrid)
        {
            DrawGridOverlay(camera, screenWidth, screenHeight);
        }
    }
    
    /// <summary>
    /// Draws a single chunk
    /// </summary>
    private void DrawChunk(TileChunk chunk)
    {
        int worldStartX = chunk.ChunkCoord.X * TileChunk.Size * GridSystem.TileSize;
        int worldStartY = chunk.ChunkCoord.Y * TileChunk.Size * GridSystem.TileSize;
        
        for (int localY = 0; localY < TileChunk.Size; localY++)
        {
            for (int localX = 0; localX < TileChunk.Size; localX++)
            {
                // Calculate world position
                int worldX = worldStartX + localX * GridSystem.TileSize;
                int worldY = worldStartY + localY * GridSystem.TileSize;
                
                var rect = new Rectangle(
                    worldX,
                    worldY,
                    GridSystem.TileSize,
                    GridSystem.TileSize
                );
                
                // Draw terrain
                var terrain = chunk.GetTerrain(localX, localY);
                if (_terrainColors.TryGetValue(terrain.Type, out var terrainColor))
                {
                    Raylib.DrawRectangleRec(rect, terrainColor);
                }
                
                // Draw tile on top of terrain
                var tile = chunk.GetTile(localX, localY);
                if (tile.Type != TileType.Empty)
                {
                    if (_tileColors.TryGetValue(tile.Type, out var tileColor))
                    {
                        // Draw tile with slight inset for visual separation
                        var tileRect = new Rectangle(
                            rect.X + 1,
                            rect.Y + 1,
                            rect.Width - 2,
                            rect.Height - 2
                        );
                        Raylib.DrawRectangleRec(tileRect, tileColor);
                        
                        // Draw road connections
                        if (tile.Type == TileType.Road)
                        {
                            DrawRoadConnections(worldX, worldY, tile.NeighborMask);
                        }
                    }
                }
            }
        }
    }
    
    /// <summary>
    /// Draws road connection lines
    /// </summary>
    private void DrawRoadConnections(int worldX, int worldY, NeighborMask mask)
    {
        int centerX = worldX + GridSystem.TileSize / 2;
        int centerY = worldY + GridSystem.TileSize / 2;
        var roadColor = new Color(100, 100, 100, 255);
        int thickness = 4;
        
        if ((mask & NeighborMask.North) != 0)
        {
            Raylib.DrawLineEx(
                new Vector2(centerX, centerY),
                new Vector2(centerX, worldY),
                thickness,
                roadColor);
        }
        
        if ((mask & NeighborMask.East) != 0)
        {
            Raylib.DrawLineEx(
                new Vector2(centerX, centerY),
                new Vector2(worldX + GridSystem.TileSize, centerY),
                thickness,
                roadColor);
        }
        
        if ((mask & NeighborMask.South) != 0)
        {
            Raylib.DrawLineEx(
                new Vector2(centerX, centerY),
                new Vector2(centerX, worldY + GridSystem.TileSize),
                thickness,
                roadColor);
        }
        
        if ((mask & NeighborMask.West) != 0)
        {
            Raylib.DrawLineEx(
                new Vector2(centerX, centerY),
                new Vector2(worldX, centerY),
                thickness,
                roadColor);
        }
        
        // Draw center dot for intersection
        Raylib.DrawCircle(centerX, centerY, 3, roadColor);
    }
    
    /// <summary>
    /// Draws the grid overlay
    /// </summary>
    private void DrawGridOverlay(Camera2D camera, int screenWidth, int screenHeight)
    {
        var gridColor = new Color(255, 255, 255, 30);
        
        // Calculate visible tile range
        float viewLeft = camera.Target.X - camera.Offset.X / camera.Zoom;
        float viewTop = camera.Target.Y - camera.Offset.Y / camera.Zoom;
        float viewRight = viewLeft + screenWidth / camera.Zoom;
        float viewBottom = viewTop + screenHeight / camera.Zoom;
        
        int startTileX = (int)Math.Floor(viewLeft / GridSystem.TileSize) - 1;
        int endTileX = (int)Math.Ceiling(viewRight / GridSystem.TileSize) + 1;
        int startTileY = (int)Math.Floor(viewTop / GridSystem.TileSize) - 1;
        int endTileY = (int)Math.Ceiling(viewBottom / GridSystem.TileSize) + 1;
        
        // Draw vertical lines
        for (int x = startTileX; x <= endTileX; x++)
        {
            int worldX = x * GridSystem.TileSize;
            Raylib.DrawLine(
                worldX,
                startTileY * GridSystem.TileSize,
                worldX,
                endTileY * GridSystem.TileSize,
                gridColor);
        }
        
        // Draw horizontal lines
        for (int y = startTileY; y <= endTileY; y++)
        {
            int worldY = y * GridSystem.TileSize;
            Raylib.DrawLine(
                startTileX * GridSystem.TileSize,
                worldY,
                endTileX * GridSystem.TileSize,
                worldY,
                gridColor);
        }
    }
    
    /// <summary>
    /// Draws chunk boundaries for debugging
    /// </summary>
    public void DrawChunkBoundaries(Camera2D camera, int screenWidth, int screenHeight)
    {
        var boundaryColor = new Color(255, 0, 0, 50);
        
        var visibleChunks = _gridSystem.GetVisibleChunks(camera, screenWidth, screenHeight);
        
        foreach (var chunk in visibleChunks)
        {
            int worldX = chunk.ChunkCoord.X * TileChunk.Size * GridSystem.TileSize;
            int worldY = chunk.ChunkCoord.Y * TileChunk.Size * GridSystem.TileSize;
            int size = TileChunk.Size * GridSystem.TileSize;
            
            Raylib.DrawRectangleLines(worldX, worldY, size, size, boundaryColor);
            
            // Draw chunk coordinates
            string chunkText = $"C({chunk.ChunkCoord.X},{chunk.ChunkCoord.Y})";
            Raylib.DrawText(chunkText, worldX + 5, worldY + 5, 12, Color.Red);
        }
    }
}
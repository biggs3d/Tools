using System.Numerics;
using Raylib_cs;
using CityBuilder.Grid;
using CityBuilder.Core;

namespace CityBuilder.Rendering;

/// <summary>
/// Handles rendering of the grid system including terrain and tiles
/// </summary>
public class GridRenderer
{
    private readonly GridSystem _gridSystem;
    private readonly Dictionary<TerrainType, Color> _terrainColors;
    private readonly Dictionary<TileType, Color> _tileColors;
    private readonly RoadSpriteAtlas _roadAtlas;
    
    public GridRenderer(GridSystem gridSystem)
    {
        _gridSystem = gridSystem ?? throw new ArgumentNullException(nameof(gridSystem));
        _roadAtlas = new RoadSpriteAtlas();
        
        // Initialize terrain colors
        _terrainColors = new Dictionary<TerrainType, Color>
        {
            { TerrainType.Normal, new Color(50, 120, 50, 255) },        // Green grass
            { TerrainType.Water, new Color(30, 90, 180, 255) },         // Blue water
            { TerrainType.OreDeposit, new Color(180, 80, 40, 255) },    // Brown/rust for ore
            { TerrainType.RockFormation, new Color(150, 150, 130, 255) }, // Gray/yellow for rock
            { TerrainType.Sand, new Color(194, 178, 128, 255) },        // Sandy color
            { TerrainType.Forest, new Color(30, 80, 30, 255) },         // Dark green
            { TerrainType.Mountain, new Color(100, 100, 100, 255) }     // Dark gray
        };
        
        // Load road atlas texture
        _roadAtlas.LoadTexture("assets/textures/transportation/roads.png");
        
        // Initialize tile colors - matching cargo colors for visual consistency
        _tileColors = new Dictionary<TileType, Color>
        {
            { TileType.Empty, Color.Blank },
            { TileType.Road, new Color(80, 80, 80, 255) },
            { TileType.LandingPad, new Color(150, 150, 180, 255) },
            { TileType.UndergroundEntrance, new Color(60, 60, 90, 255) },
            // Gathering buildings - colored by what they gather
            { TileType.WaterGatherer, new Color(60, 120, 200, 255) },   // Blue - gathers water
            { TileType.OreExtractor, new Color(200, 60, 60, 255) },     // Red - extracts ore
            { TileType.RockHarvester, new Color(200, 200, 60, 255) },   // Yellow - harvests rock
            // Factory buildings
            { TileType.FactoryTier2, new Color(150, 100, 200, 255) },   // Purple - combines resources
            { TileType.FactoryTier3, new Color(100, 100, 100, 255) },   // Gray - advanced factory
            // Usage buildings
            { TileType.Residential, new Color(120, 200, 120, 255) },    // Green - consumes resources
            { TileType.Research, new Color(80, 160, 160, 255) },        // Cyan - research center
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
                        
                        // Draw road using sprite atlas
                        if (tile.Type == TileType.Road)
                        {
                            // Use sprite atlas instead of programmatic drawing
                            _roadAtlas.DrawRoad(
                                new Vector2(worldX, worldY), 
                                tile.NeighborMask,
                                1.0f // Scale to match tile size
                            );
                        }
                        
                        // Draw building textures or icons
                        if (tile.Type == TileType.WaterGatherer || 
                            tile.Type == TileType.OreExtractor || 
                            tile.Type == TileType.RockHarvester ||
                            tile.Type == TileType.FactoryTier2 ||
                            tile.Type == TileType.FactoryTier3 ||
                            tile.Type == TileType.Residential ||
                            tile.Type == TileType.Research)
                        {
                            // Try to draw texture first, fallback to icon
                            var texture = BuildingTextures.GetTexture(tile.Type);
                            if (texture.HasValue)
                            {
                                // Draw the building texture scaled to tile size
                                Raylib.DrawTexturePro(
                                    texture.Value,
                                    new Rectangle(0, 0, texture.Value.Width, texture.Value.Height),
                                    tileRect,
                                    new Vector2(0, 0),
                                    0f,
                                    Color.White
                                );
                            }
                            else
                            {
                                // Fallback to icon drawing if texture not found
                                DrawBuildingIcon(rect, tile.Type);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // DrawRoadConnections method removed - now using RoadSpriteAtlas for texture-based rendering
    
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
    
    /// <summary>
    /// Clean up resources
    /// </summary>
    public void Dispose()
    {
        _roadAtlas?.UnloadTexture();
    }
    
    /// <summary>
    /// Draws building type icons for accessibility
    /// </summary>
    private void DrawBuildingIcon(Rectangle rect, TileType buildingType)
    {
        // Draw a simple shape to identify building type
        var centerX = rect.X + rect.Width / 2;
        var centerY = rect.Y + rect.Height / 2;
        var iconSize = GridSystem.TileSize / 4;
        
        switch (buildingType)
        {
            case TileType.WaterGatherer:
                // Draw circle for water gatherer (round building)
                Raylib.DrawCircle((int)centerX, (int)centerY, iconSize, new Color(30, 60, 120, 200));
                Raylib.DrawText("W", (int)(centerX - 4), (int)(centerY - 6), 12, Color.White);
                break;
                
            case TileType.OreExtractor:
                // Draw square for ore extractor
                Raylib.DrawRectangle((int)(centerX - iconSize), (int)(centerY - iconSize), 
                    iconSize * 2, iconSize * 2, new Color(120, 30, 30, 200));
                Raylib.DrawText("O", (int)(centerX - 4), (int)(centerY - 6), 12, Color.White);
                break;
                
            case TileType.RockHarvester:
                // Draw triangle for rock harvester - will draw using lines
                Raylib.DrawText("R", (int)(centerX - 4), (int)(centerY - 6), 12, Color.Yellow);
                break;
                
            case TileType.FactoryTier2:
                // Draw factory icon
                Raylib.DrawCircle((int)centerX, (int)centerY, iconSize, new Color(100, 50, 150, 200));
                Raylib.DrawText("F", (int)(centerX - 4), (int)(centerY - 6), 12, Color.White);
                break;
                
            case TileType.Residential:
                // Draw house icon (triangle roof)
                Vector2[] points = new Vector2[]
                {
                    new Vector2(centerX, centerY - iconSize),
                    new Vector2(centerX - iconSize, centerY + iconSize/2),
                    new Vector2(centerX + iconSize, centerY + iconSize/2)
                };
                // DrawTriangle doesn't exist in Raylib-cs, use lines instead
                Raylib.DrawLine((int)points[0].X, (int)points[0].Y, (int)points[1].X, (int)points[1].Y, Color.DarkGreen);
                Raylib.DrawLine((int)points[1].X, (int)points[1].Y, (int)points[2].X, (int)points[2].Y, Color.DarkGreen);
                Raylib.DrawLine((int)points[2].X, (int)points[2].Y, (int)points[0].X, (int)points[0].Y, Color.DarkGreen);
                Raylib.DrawText("H", (int)(centerX - 4), (int)(centerY - 6), 12, Color.White);
                break;
        }
    }
}
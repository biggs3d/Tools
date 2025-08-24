using System;
using System.Numerics;
using Raylib_cs;
using CityBuilder.Core;
using CityBuilder.Grid;
using CityBuilder.Simulation.Buildings;

namespace CityBuilder.States;

/// <summary>
/// Handles building placement mode with visual feedback
/// </summary>
public class BuildingPlacementMode
{
    private TileType? _selectedBuildingType = null;
    private readonly GridSystem _gridSystem;
    private readonly Dictionary<KeyboardKey, TileType> _buildingHotkeys;
    
    public bool IsActive => _selectedBuildingType.HasValue;
    public TileType? SelectedBuilding => _selectedBuildingType;
    
    public BuildingPlacementMode(GridSystem gridSystem)
    {
        _gridSystem = gridSystem ?? throw new ArgumentNullException(nameof(gridSystem));
        
        // Setup building hotkeys
        _buildingHotkeys = new Dictionary<KeyboardKey, TileType>
        {
            { KeyboardKey.One, TileType.WaterGatherer },
            { KeyboardKey.Two, TileType.OreExtractor },
            { KeyboardKey.Three, TileType.RockHarvester },
            { KeyboardKey.Four, TileType.FactoryTier2 },
            { KeyboardKey.Five, TileType.Residential }
        };
    }
    
    /// <summary>
    /// Update building selection and handle placement
    /// </summary>
    public void Update(Camera2D camera)
    {
        // Check for building selection
        foreach (var (key, buildingType) in _buildingHotkeys)
        {
            if (Raylib.IsKeyPressed(key))
            {
                if (_selectedBuildingType == buildingType)
                {
                    // Deselect if same key pressed
                    _selectedBuildingType = null;
                    Console.WriteLine("Building placement mode deactivated");
                }
                else
                {
                    // Select new building
                    _selectedBuildingType = buildingType;
                    var definition = BuildingRegistry.GetDefinition(buildingType);
                    Console.WriteLine($"Selected building: {definition?.Name ?? buildingType.ToString()}");
                }
            }
        }
        
        // Cancel placement mode with ESC or right click
        if (Raylib.IsKeyPressed(KeyboardKey.Q) || 
            (_selectedBuildingType.HasValue && Raylib.IsMouseButtonPressed(MouseButton.Right)))
        {
            _selectedBuildingType = null;
            Console.WriteLine("Building placement cancelled");
        }
        
        // Handle placement if building selected
        if (_selectedBuildingType.HasValue && Raylib.IsMouseButtonPressed(MouseButton.Left))
        {
            var mousePos = Raylib.GetMousePosition();
            var worldPos = Raylib.GetScreenToWorld2D(mousePos, camera);
            var tilePos = GridSystem.WorldToTile(worldPos);
            
            if (TryPlaceBuilding(tilePos, _selectedBuildingType.Value))
            {
                // Keep building selected for multiple placements (hold shift to place multiple)
                if (!Raylib.IsKeyDown(KeyboardKey.LeftShift))
                {
                    _selectedBuildingType = null;
                }
            }
        }
    }
    
    /// <summary>
    /// Try to place a building at the specified position
    /// </summary>
    private bool TryPlaceBuilding(Vector2Int position, TileType buildingType)
    {
        var definition = BuildingRegistry.GetDefinition(buildingType);
        if (definition == null) return false;
        
        // Check if placement is valid
        bool canPlace = definition.CanPlaceAt(position, pos => _gridSystem.GetTerrainAt(pos).Type);
        
        if (_gridSystem.PlaceTileAt(position, buildingType))
        {
            Console.WriteLine($"Placed {definition.Name} at {position}");
            
            // Warn if suboptimal placement
            if (definition.IsGatherer)
            {
                int adjacentResources = 0;
                if (buildingType == TileType.WaterGatherer)
                    adjacentResources = CountAdjacentTerrain(position, TerrainType.Water);
                else if (buildingType == TileType.OreExtractor)
                    adjacentResources = CountAdjacentTerrain(position, TerrainType.OreDeposit);
                else if (buildingType == TileType.RockHarvester)
                    adjacentResources = CountAdjacentTerrain(position, TerrainType.RockFormation);
                
                if (adjacentResources == 0)
                {
                    Console.WriteLine($"WARNING: {definition.Name} has no adjacent resources!");
                }
            }
            
            return true;
        }
        
        return false;
    }
    
    /// <summary>
    /// Draw placement preview at cursor position
    /// </summary>
    public void DrawPreview(Camera2D camera)
    {
        if (!_selectedBuildingType.HasValue) return;
        
        try 
        {
            var mousePos = Raylib.GetMousePosition();
            var worldPos = Raylib.GetScreenToWorld2D(mousePos, camera);
            var tilePos = GridSystem.WorldToTile(worldPos);
            var worldTilePos = GridSystem.TileToWorld(tilePos);
            
            var definition = BuildingRegistry.GetDefinition(_selectedBuildingType.Value);
            if (definition == null) return;
            
            // Check if placement would be valid
            bool canPlace = _gridSystem.GetTileAt(tilePos).Type == TileType.Empty;
            bool hasResources = true;
            
            // Check for resource availability if gatherer
            if (definition.IsGatherer && canPlace)
            {
                int adjacentResources = 0;
                if (_selectedBuildingType == TileType.WaterGatherer)
                    adjacentResources = CountAdjacentTerrain(tilePos, TerrainType.Water);
                else if (_selectedBuildingType == TileType.OreExtractor)
                    adjacentResources = CountAdjacentTerrain(tilePos, TerrainType.OreDeposit);
                else if (_selectedBuildingType == TileType.RockHarvester)
                    adjacentResources = CountAdjacentTerrain(tilePos, TerrainType.RockFormation);
                
                hasResources = adjacentResources > 0;
            }
        
        // Draw preview with appropriate color
        Color previewColor;
        if (!canPlace)
        {
            previewColor = new Color(255, 0, 0, 100); // Red for invalid
        }
        else if (!hasResources)
        {
            previewColor = new Color(255, 200, 0, 100); // Yellow for warning
        }
        else
        {
            previewColor = new Color(0, 255, 0, 100); // Green for valid
        }
        
        // Draw preview rectangle
        var rect = new Rectangle(
            worldTilePos.X,
            worldTilePos.Y,
            GridSystem.TileSize,
            GridSystem.TileSize
        );
        
        Raylib.DrawRectangleRec(rect, previewColor);
        
        // Draw building texture preview if available
        var texture = BuildingTextures.GetTexture(_selectedBuildingType.Value);
        if (texture.HasValue)
        {
            // Draw semi-transparent building preview
            Raylib.DrawTexturePro(
                texture.Value,
                new Rectangle(0, 0, texture.Value.Width, texture.Value.Height),
                rect,
                new Vector2(0, 0),
                0f,
                new Color(255, 255, 255, 150)
            );
        }
        
        // Draw placement indicators
        if (!canPlace)
        {
            // Draw X for invalid placement
            Raylib.DrawLine(
                (int)rect.X, (int)rect.Y,
                (int)(rect.X + rect.Width), (int)(rect.Y + rect.Height),
                Color.Red
            );
            Raylib.DrawLine(
                (int)(rect.X + rect.Width), (int)rect.Y,
                (int)rect.X, (int)(rect.Y + rect.Height),
                Color.Red
            );
        }
        else if (!hasResources && definition.IsGatherer)
        {
            // Draw warning symbol for no resources
            var centerX = rect.X + rect.Width / 2;
            var centerY = rect.Y + rect.Height / 2;
            Raylib.DrawText("!", (int)(centerX - 4), (int)(centerY - 8), 16, Color.Yellow);
        }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in DrawPreview: {ex.Message}");
        }
    }
    
    /// <summary>
    /// Count adjacent terrain tiles of a specific type
    /// </summary>
    private int CountAdjacentTerrain(Vector2Int position, TerrainType terrainType)
    {
        int count = 0;
        Vector2Int[] neighbors = {
            new Vector2Int(position.X - 1, position.Y),
            new Vector2Int(position.X + 1, position.Y),
            new Vector2Int(position.X, position.Y - 1),
            new Vector2Int(position.X, position.Y + 1)
        };
        
        foreach (var neighbor in neighbors)
        {
            if (_gridSystem.GetTerrainAt(neighbor).Type == terrainType)
            {
                count++;
            }
        }
        
        return count;
    }
    
    /// <summary>
    /// Get display information for UI
    /// </summary>
    public string GetStatusText()
    {
        if (!_selectedBuildingType.HasValue) 
            return "Press 1-5 to select building";
        
        var definition = BuildingRegistry.GetDefinition(_selectedBuildingType.Value);
        return $"Placing: {definition?.Name ?? _selectedBuildingType.ToString()} (Q to cancel)";
    }
}
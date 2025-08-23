using CityBuilder.Core;
using CityBuilder.Grid;
using Raylib_cs;

namespace CityBuilder.Simulation.Buildings;

/// <summary>
/// Definition for Water Gatherer buildings that extract Blue Teardrops from water
/// </summary>
public class WaterGathererDefinition : BuildingDefinitionBase
{
    public override TileType TileType => TileType.WaterGatherer;
    public override string Name => "Water Gatherer";
    public override Color RenderColor => new Color(60, 120, 200, 255);
    public override char IconChar => 'W';
    public override bool IsGatherer => true;
    
    public override void InitializeInventory(InventorySlot[] inventory)
    {
        // Produces Blue Teardrops
        inventory[(int)ResourceType.BlueTeardrop] = new InventorySlot
        {
            Max = 100,
            ProductionRate = 0, // Will be set based on adjacent water
            Current = 0
        };
    }
    
    public override void UpdateProductionFromTerrain(Vector2Int position, InventorySlot[] inventory, Func<Vector2Int, TerrainType> getTerrainAt)
    {
        // Count adjacent water tiles
        int waterTiles = CountAdjacentTerrain(position, TerrainType.Water, getTerrainAt);
        
        // Set production rate: 1 resource per tick per adjacent water tile
        inventory[(int)ResourceType.BlueTeardrop].ProductionRate = waterTiles;
        
        if (waterTiles > 0)
        {
            Console.WriteLine($"Water Gatherer at {position}: {waterTiles} adjacent water tiles, producing {waterTiles} teardrops/tick");
        }
    }
    
    public override bool CanPlaceAt(Vector2Int position, Func<Vector2Int, TerrainType> getTerrainAt)
    {
        // Can place anywhere, but warn if no water nearby
        int waterTiles = CountAdjacentTerrain(position, TerrainType.Water, getTerrainAt);
        if (waterTiles == 0)
        {
            Console.WriteLine($"Warning: Water Gatherer at {position} has no adjacent water!");
        }
        return true; // Allow placement, production will be 0 if no water
    }
    
    public override string GetDescription()
    {
        return "Gathers Blue Teardrops from adjacent water tiles. Production rate increases with more water access.";
    }
}
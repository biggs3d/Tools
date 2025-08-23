using CityBuilder.Core;
using CityBuilder.Grid;
using Raylib_cs;

namespace CityBuilder.Simulation.Buildings;

/// <summary>
/// Definition for Ore Extractor buildings that mine Red Squares from ore deposits
/// </summary>
public class OreExtractorDefinition : BuildingDefinitionBase
{
    public override TileType TileType => TileType.OreExtractor;
    public override string Name => "Ore Extractor";
    public override Color RenderColor => new Color(200, 60, 60, 255);
    public override char IconChar => 'O';
    public override bool IsGatherer => true;
    
    public override void InitializeInventory(InventorySlot[] inventory)
    {
        // Produces Red Squares
        inventory[(int)ResourceType.RedSquare] = new InventorySlot
        {
            Max = 100,
            ProductionRate = 0, // Will be set based on adjacent ore
            Current = 0
        };
    }
    
    public override void UpdateProductionFromTerrain(Vector2Int position, InventorySlot[] inventory, Func<Vector2Int, TerrainType> getTerrainAt)
    {
        // Count adjacent ore deposit tiles
        int oreTiles = CountAdjacentTerrain(position, TerrainType.OreDeposit, getTerrainAt);
        
        // Set production rate: 1 resource per tick per adjacent ore tile
        inventory[(int)ResourceType.RedSquare].ProductionRate = oreTiles;
        
        if (oreTiles > 0)
        {
            Console.WriteLine($"Ore Extractor at {position}: {oreTiles} adjacent ore tiles, producing {oreTiles} squares/tick");
        }
    }
    
    public override bool CanPlaceAt(Vector2Int position, Func<Vector2Int, TerrainType> getTerrainAt)
    {
        // Can place anywhere, but warn if no ore nearby
        int oreTiles = CountAdjacentTerrain(position, TerrainType.OreDeposit, getTerrainAt);
        if (oreTiles == 0)
        {
            Console.WriteLine($"Warning: Ore Extractor at {position} has no adjacent ore!");
        }
        return true; // Allow placement, production will be 0 if no ore
    }
    
    public override string GetDescription()
    {
        return "Mines Red Squares from adjacent ore deposits. Production rate increases with more ore access.";
    }
}
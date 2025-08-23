using CityBuilder.Core;
using CityBuilder.Grid;
using Raylib_cs;

namespace CityBuilder.Simulation.Buildings;

/// <summary>
/// Definition for Rock Harvester buildings that gather Yellow Triangles from rock formations
/// </summary>
public class RockHarvesterDefinition : BuildingDefinitionBase
{
    public override TileType TileType => TileType.RockHarvester;
    public override string Name => "Rock Harvester";
    public override Color RenderColor => new Color(200, 200, 60, 255);
    public override char IconChar => 'R';
    public override bool IsGatherer => true;
    
    public override void InitializeInventory(InventorySlot[] inventory)
    {
        // Produces Yellow Triangles
        inventory[(int)ResourceType.YellowTriangle] = new InventorySlot
        {
            Max = 100,
            ProductionRate = 0, // Will be set based on adjacent rock
            Current = 0
        };
    }
    
    public override void UpdateProductionFromTerrain(Vector2Int position, InventorySlot[] inventory, Func<Vector2Int, TerrainType> getTerrainAt)
    {
        // Count adjacent rock formation tiles
        int rockTiles = CountAdjacentTerrain(position, TerrainType.RockFormation, getTerrainAt);
        
        // Set production rate: 1 resource per tick per adjacent rock tile
        inventory[(int)ResourceType.YellowTriangle].ProductionRate = rockTiles;
        
        if (rockTiles > 0)
        {
            Console.WriteLine($"Rock Harvester at {position}: {rockTiles} adjacent rock tiles, producing {rockTiles} triangles/tick");
        }
    }
    
    public override bool CanPlaceAt(Vector2Int position, Func<Vector2Int, TerrainType> getTerrainAt)
    {
        // Can place anywhere, but warn if no rock nearby
        int rockTiles = CountAdjacentTerrain(position, TerrainType.RockFormation, getTerrainAt);
        if (rockTiles == 0)
        {
            Console.WriteLine($"Warning: Rock Harvester at {position} has no adjacent rock!");
        }
        return true; // Allow placement, production will be 0 if no rock
    }
    
    public override string GetDescription()
    {
        return "Harvests Yellow Triangles from adjacent rock formations. Production rate increases with more rock access.";
    }
}
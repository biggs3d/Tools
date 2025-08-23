using CityBuilder.Core;
using CityBuilder.Grid;
using Raylib_cs;

namespace CityBuilder.Simulation.Buildings;

/// <summary>
/// Definition for Residential buildings that consume resources
/// </summary>
public class ResidentialDefinition : BuildingDefinitionBase
{
    public override TileType TileType => TileType.Residential;
    public override string Name => "Residential";
    public override Color RenderColor => new Color(120, 200, 120, 255);
    public override char IconChar => 'H';
    
    public override void InitializeInventory(InventorySlot[] inventory)
    {
        // Consumes Purple Diamonds (for now)
        inventory[(int)ResourceType.PurpleDiamond] = new InventorySlot
        {
            Max = 30,
            ConsumptionRate = 1,
            Current = 0
        };
    }
    
    public override bool CanPlaceAt(Vector2Int position, Func<Vector2Int, TerrainType> getTerrainAt)
    {
        // Residential can be placed anywhere
        return true;
    }
    
    public override string GetDescription()
    {
        return "Houses residents who consume refined resources. Currently consumes Purple Diamonds.";
    }
}
using CityBuilder.Core;
using CityBuilder.Grid;
using Raylib_cs;

namespace CityBuilder.Simulation.Buildings;

/// <summary>
/// Definition for Tier 2 Factory that combines basic resources
/// Example: Blue Teardrop + Red Square = Purple Diamond
/// </summary>
public class FactoryTier2Definition : BuildingDefinitionBase
{
    public override TileType TileType => TileType.FactoryTier2;
    public override string Name => "Factory (Tier 2)";
    public override Color RenderColor => new Color(150, 100, 200, 255);
    public override char IconChar => 'F';
    public override bool IsFactory => true;
    
    public override void InitializeInventory(InventorySlot[] inventory)
    {
        // Consumes Blue Teardrops and Red Squares
        inventory[(int)ResourceType.BlueTeardrop] = new InventorySlot
        {
            Max = 50,
            ConsumptionRate = 1,
            Current = 0
        };
        
        inventory[(int)ResourceType.RedSquare] = new InventorySlot
        {
            Max = 50,
            ConsumptionRate = 1,
            Current = 0
        };
        
        // Produces Purple Diamonds
        inventory[(int)ResourceType.PurpleDiamond] = new InventorySlot
        {
            Max = 50,
            ProductionRate = 1,
            Current = 0
        };
    }
    
    public override bool HasRequiredInputs(InventorySlot[] inventory)
    {
        // Need both inputs to produce
        return inventory[(int)ResourceType.BlueTeardrop].Current > 0 &&
               inventory[(int)ResourceType.RedSquare].Current > 0;
    }
    
    public override bool CanPlaceAt(Vector2Int position, Func<Vector2Int, TerrainType> getTerrainAt)
    {
        // Factories can be placed anywhere
        return true;
    }
    
    public override string GetDescription()
    {
        return "Combines Blue Teardrops and Red Squares to produce Purple Diamonds. Requires both inputs to operate.";
    }
}
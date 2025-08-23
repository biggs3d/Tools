using CityBuilder.Core;
using CityBuilder.Grid;
using Raylib_cs;

namespace CityBuilder.Simulation.Buildings;

/// <summary>
/// Base class for building definitions with common functionality
/// </summary>
public abstract class BuildingDefinitionBase : IBuildingDefinition
{
    public abstract TileType TileType { get; }
    public abstract string Name { get; }
    public abstract Color RenderColor { get; }
    public abstract char IconChar { get; }
    
    public virtual bool IsGatherer => false;
    public virtual bool IsFactory => false;
    
    /// <summary>
    /// Check if this building can be placed at the given position
    /// Must be implemented by each building type
    /// </summary>
    public abstract bool CanPlaceAt(Vector2Int position, Func<Vector2Int, TerrainType> getTerrainAt);
    
    /// <summary>
    /// Default implementation - override in derived classes
    /// </summary>
    public abstract void InitializeInventory(InventorySlot[] inventory);
    
    /// <summary>
    /// Default implementation does nothing - gatherers override this
    /// </summary>
    public virtual void UpdateProductionFromTerrain(Vector2Int position, InventorySlot[] inventory, Func<Vector2Int, TerrainType> getTerrainAt)
    {
        // Base implementation does nothing
    }
    
    /// <summary>
    /// Default implementation returns true - factories override this
    /// </summary>
    public virtual bool HasRequiredInputs(InventorySlot[] inventory)
    {
        return true;
    }
    
    public abstract string GetDescription();
    
    /// <summary>
    /// Helper method to count adjacent terrain tiles of a specific type
    /// </summary>
    protected int CountAdjacentTerrain(Vector2Int position, TerrainType targetTerrain, Func<Vector2Int, TerrainType> getTerrainAt)
    {
        int count = 0;
        var directions = new[] {
            new Vector2Int(0, 1),   // North
            new Vector2Int(1, 0),   // East
            new Vector2Int(0, -1),  // South
            new Vector2Int(-1, 0)   // West
        };
        
        foreach (var dir in directions)
        {
            var checkPos = new Vector2Int(position.X + dir.X, position.Y + dir.Y);
            if (getTerrainAt(checkPos) == targetTerrain)
            {
                count++;
            }
        }
        
        return count;
    }
}
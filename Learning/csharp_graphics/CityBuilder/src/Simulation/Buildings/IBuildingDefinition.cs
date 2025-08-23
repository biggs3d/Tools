using CityBuilder.Core;
using CityBuilder.Grid;
using Raylib_cs;

namespace CityBuilder.Simulation.Buildings;

/// <summary>
/// Defines the behavior and properties of a building type
/// </summary>
public interface IBuildingDefinition
{
    /// <summary>
    /// The tile type this definition handles
    /// </summary>
    TileType TileType { get; }
    
    /// <summary>
    /// Display name for UI
    /// </summary>
    string Name { get; }
    
    /// <summary>
    /// Color for rendering the building
    /// </summary>
    Color RenderColor { get; }
    
    /// <summary>
    /// Icon character for simple display
    /// </summary>
    char IconChar { get; }
    
    /// <summary>
    /// Check if this building can be placed at the given position
    /// </summary>
    bool CanPlaceAt(Vector2Int position, Func<Vector2Int, TerrainType> getTerrainAt);
    
    /// <summary>
    /// Initialize the inventory slots for this building type
    /// </summary>
    void InitializeInventory(InventorySlot[] inventory);
    
    /// <summary>
    /// Update production rates based on terrain (for gatherers)
    /// </summary>
    void UpdateProductionFromTerrain(Vector2Int position, InventorySlot[] inventory, Func<Vector2Int, TerrainType> getTerrainAt);
    
    /// <summary>
    /// Check if building has required inputs for production
    /// </summary>
    bool HasRequiredInputs(InventorySlot[] inventory);
    
    /// <summary>
    /// Get description of what this building does
    /// </summary>
    string GetDescription();
    
    /// <summary>
    /// Whether this building type is a gatherer (depends on terrain)
    /// </summary>
    bool IsGatherer { get; }
    
    /// <summary>
    /// Whether this building type is a factory (combines resources)
    /// </summary>
    bool IsFactory { get; }
}
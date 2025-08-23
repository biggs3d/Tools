using CityBuilder.Core;
using CityBuilder.Grid;
using CityBuilder.Simulation.Buildings;

namespace CityBuilder.Simulation;

/// <summary>
/// Data for a building that participates in the supply chain
/// </summary>
public class BuildingData
{
    /// <summary>
    /// Type of building (determines production/consumption patterns)
    /// </summary>
    public TileType Type { get; set; }
    
    /// <summary>
    /// The definition that controls this building's behavior
    /// </summary>
    public IBuildingDefinition? Definition { get; private set; }
    
    /// <summary>
    /// Location in the grid
    /// </summary>
    public Vector2Int Location { get; set; }
    
    /// <summary>
    /// Fixed-size array indexed by ResourceType enum - MUCH faster than dictionaries
    /// </summary>
    public InventorySlot[] Inventory { get; }
    
    /// <summary>
    /// Hysteresis thresholds to prevent task flickering
    /// </summary>
    public float RequestThreshold { get; set; } = 0.3f;      // Create request when below this
    public float RequestCancelThreshold { get; set; } = 0.5f; // Cancel request when above this
    public float OfferThreshold { get; set; } = 0.7f;        // Create offer when above this
    public float OfferCancelThreshold { get; set; } = 0.5f;  // Cancel offer when below this
    
    /// <summary>
    /// Track update frequency (not every tick for performance)
    /// </summary>
    public float LastUpdateTime { get; set; }
    public const float UpdateInterval = 1.0f; // Update at 1Hz, not 30Hz
    
    /// <summary>
    /// Unique identifier for this building
    /// </summary>
    public Guid Id { get; } = Guid.NewGuid();
    
    public BuildingData(TileType type, Vector2Int location)
    {
        Type = type;
        Location = location;
        Inventory = new InventorySlot[(int)ResourceType.Count];
        
        // Get the definition from the registry
        Definition = BuildingRegistry.GetDefinition(type);
        
        // Initialize inventory based on building definition
        InitializeInventory();
    }
    
    private void InitializeInventory()
    {
        // Clear all slots first
        for (int i = 0; i < Inventory.Length; i++)
        {
            Inventory[i] = new InventorySlot();
        }
        
        // Let the definition set up the inventory
        Definition?.InitializeInventory(Inventory);
    }
    
    /// <summary>
    /// Updates production rate based on adjacent terrain (for gathering buildings)
    /// </summary>
    public void UpdateProductionFromTerrain(Func<Vector2Int, TerrainType> getTerrainAt)
    {
        Definition?.UpdateProductionFromTerrain(Location, Inventory, getTerrainAt);
    }
    
    /// <summary>
    /// Gets the priority for updating this building (hubs are highest priority)
    /// </summary>
    public int GetUpdatePriority()
    {
        return Type switch
        {
            TileType.LandingPad => 0,
            TileType.UndergroundEntrance => 0,
            _ => 1
        };
    }
    
    /// <summary>
    /// Updates the building's production and consumption
    /// </summary>
    public void Update(float deltaTime)
    {
        // Skip hub - it has infinite resources
        if (Type == TileType.LandingPad || Type == TileType.UndergroundEntrance)
            return;
            
        // For now, update every tick (later we can accumulate time and update in batches)
        // Update each resource slot
        for (int i = 0; i < Inventory.Length; i++)
        {
            var slot = Inventory[i];
            
            // Can only produce if we have materials to consume
            bool canProduce = true;
            if (slot.ProductionRate > 0)
            {
                // Check if we have required inputs using the definition
                canProduce = Definition?.HasRequiredInputs(Inventory) ?? true;
            }
            
            // Consume first (1 tick worth)
            slot.Consume(1);
            
            // Then produce (if we can)
            if (canProduce)
            {
                slot.Produce(1);
            }
            
            Inventory[i] = slot;
        }
    }
    
    /// <summary>
    /// Gets the effective inventory considering in-transit resources
    /// </summary>
    public int GetEffectiveInventory(ResourceType resource)
    {
        return Inventory[(int)resource].Effective;
    }
    
    /// <summary>
    /// Checks if this building needs a delivery of the specified resource
    /// </summary>
    public bool NeedsDelivery(ResourceType resource)
    {
        var slot = Inventory[(int)resource];
        if (slot.ConsumptionRate <= 0) return false;
        
        return slot.EffectiveFillRatio < RequestThreshold;
    }
    
    /// <summary>
    /// Checks if this building can offer a pickup of the specified resource
    /// </summary>
    public bool CanOffer(ResourceType resource)
    {
        var slot = Inventory[(int)resource];
        if (slot.ProductionRate <= 0) return false;
        
        return slot.EffectiveFillRatio > OfferThreshold;
    }
    
    /// <summary>
    /// Gets the amount this building wants to request
    /// </summary>
    public int GetRequestAmount(ResourceType resource)
    {
        var slot = Inventory[(int)resource];
        // Request enough to fill to 80%
        return Math.Max(0, (int)(slot.Max * 0.8f) - slot.Effective);
    }
    
    /// <summary>
    /// Gets the amount this building can offer
    /// </summary>
    public int GetOfferAmount(ResourceType resource)
    {
        var slot = Inventory[(int)resource];
        // Offer excess above 50%
        return Math.Max(0, slot.Available - (int)(slot.Max * 0.5f));
    }
}
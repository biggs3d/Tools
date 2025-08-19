using CityBuilder.Core;
using CityBuilder.Grid;

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
        
        // Initialize inventory based on building type
        InitializeInventory();
    }
    
    private void InitializeInventory()
    {
        // Clear all slots first
        for (int i = 0; i < Inventory.Length; i++)
        {
            Inventory[i] = new InventorySlot();
        }
        
        // Set up production and consumption based on building type
        switch (Type)
        {
            case TileType.Industrial:
                // Produces raw materials
                Inventory[(int)ResourceType.RawMaterials] = new InventorySlot
                {
                    Max = 100,
                    ProductionRate = 1.0f,
                    Current = 0
                };
                // Produces some waste
                Inventory[(int)ResourceType.Waste] = new InventorySlot
                {
                    Max = 20,
                    ProductionRate = 0.1f,
                    Current = 0
                };
                break;
                
            case TileType.Commercial:
                // Consumes raw materials
                Inventory[(int)ResourceType.RawMaterials] = new InventorySlot
                {
                    Max = 50,
                    ConsumptionRate = 1.0f,
                    Current = 25 // Start with some
                };
                // Produces goods
                Inventory[(int)ResourceType.Goods] = new InventorySlot
                {
                    Max = 50,
                    ProductionRate = 0.5f,
                    Current = 0
                };
                // Produces waste
                Inventory[(int)ResourceType.Waste] = new InventorySlot
                {
                    Max = 20,
                    ProductionRate = 0.1f,
                    Current = 0
                };
                break;
                
            case TileType.Residential:
                // Consumes goods
                Inventory[(int)ResourceType.Goods] = new InventorySlot
                {
                    Max = 30,
                    ConsumptionRate = 0.3f,
                    Current = 15 // Start with some
                };
                // Produces waste
                Inventory[(int)ResourceType.Waste] = new InventorySlot
                {
                    Max = 20,
                    ProductionRate = 0.2f,
                    Current = 0
                };
                break;
                
            case TileType.LandingPad:
            case TileType.UndergroundEntrance:
                // Hub has infinite capacity (import/export point)
                for (int i = 1; i < (int)ResourceType.Count; i++)
                {
                    Inventory[i] = new InventorySlot
                    {
                        Max = float.MaxValue,
                        Current = 1000 // Infinite supply for imports
                    };
                }
                break;
        }
    }
    
    /// <summary>
    /// Updates production and consumption for this building
    /// </summary>
    public void Update(float deltaTime)
    {
        // Skip hub - it has infinite resources
        if (Type == TileType.LandingPad || Type == TileType.UndergroundEntrance)
            return;
            
        // Update each resource slot
        for (int i = 0; i < Inventory.Length; i++)
        {
            var slot = Inventory[i];
            
            // Can only produce if we have materials to consume
            bool canProduce = true;
            if (slot.ProductionRate > 0)
            {
                // Check if we have required inputs
                canProduce = HasRequiredInputs();
            }
            
            // Consume first
            slot.Consume(deltaTime);
            
            // Then produce (if we can)
            if (canProduce)
            {
                slot.Produce(deltaTime);
            }
            
            Inventory[i] = slot;
        }
    }
    
    /// <summary>
    /// Checks if building has required inputs for production
    /// </summary>
    private bool HasRequiredInputs()
    {
        // Commercial needs raw materials to produce goods
        if (Type == TileType.Commercial)
        {
            return Inventory[(int)ResourceType.RawMaterials].Current > 0;
        }
        
        // Industrial and Residential don't need inputs for their production
        return true;
    }
    
    /// <summary>
    /// Gets the effective inventory considering in-transit resources
    /// </summary>
    public float GetEffectiveInventory(ResourceType resource)
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
    public float GetRequestAmount(ResourceType resource)
    {
        var slot = Inventory[(int)resource];
        // Request enough to fill to 80%
        return Math.Max(0, slot.Max * 0.8f - slot.Effective);
    }
    
    /// <summary>
    /// Gets the amount this building can offer
    /// </summary>
    public float GetOfferAmount(ResourceType resource)
    {
        var slot = Inventory[(int)resource];
        // Offer excess above 50%
        return Math.Max(0, slot.Available - slot.Max * 0.5f);
    }
}
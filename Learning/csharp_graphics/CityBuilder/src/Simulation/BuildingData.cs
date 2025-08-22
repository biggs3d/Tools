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
        // TODO: This is placeholder logic - will be replaced with proper
        // terrain-based gathering and recipe-based conversion
        switch (Type)
        {
            case TileType.Industrial:
                // Placeholder: Will become terrain-based gatherer
                // For now, produces basic resources
                Inventory[(int)ResourceType.BlueTeardrop] = new InventorySlot
                {
                    Max = 100,
                    ProductionRate = 1,
                    Current = 0
                };
                break;
                
            case TileType.Commercial:
                // Placeholder: Will become conversion factory
                // For now, converts blue teardrops to purple diamonds
                Inventory[(int)ResourceType.BlueTeardrop] = new InventorySlot
                {
                    Max = 50,
                    ConsumptionRate = 1,
                    Current = 25 // Start with some
                };
                Inventory[(int)ResourceType.PurpleDiamond] = new InventorySlot
                {
                    Max = 50,
                    ProductionRate = 1,
                    Current = 0
                };
                break;
                
            case TileType.Residential:
                // Placeholder: Will consume various resources based on level
                // For now, consumes purple diamonds
                Inventory[(int)ResourceType.PurpleDiamond] = new InventorySlot
                {
                    Max = 30,
                    ConsumptionRate = 1,
                    Current = 15 // Start with some
                };
                break;
                
            case TileType.LandingPad:
            case TileType.UndergroundEntrance:
                // Hub accepts all resources (especially Silver Trusses for upgrades)
                // Acts as the sink for the orbital delivery contracts
                for (int i = 1; i < (int)ResourceType.Count; i++)
                {
                    Inventory[i] = new InventorySlot
                    {
                        Max = int.MaxValue,
                        Current = 100 // Some initial resources for testing
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
            
        // For now, update every tick (later we can accumulate time and update in batches)
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
    /// Checks if building has required inputs for production
    /// </summary>
    private bool HasRequiredInputs()
    {
        // TODO: Implement recipe-based checking
        // For now, Commercial (placeholder factory) needs blue teardrops to produce purple diamonds
        if (Type == TileType.Commercial)
        {
            return Inventory[(int)ResourceType.BlueTeardrop].Current > 0;
        }
        
        // Gatherers don't need inputs (they check terrain instead)
        return true;
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
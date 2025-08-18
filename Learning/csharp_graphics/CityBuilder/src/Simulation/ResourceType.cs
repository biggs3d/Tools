namespace CityBuilder.Simulation;

/// <summary>
/// Types of resources that can be produced, consumed, and transported in the supply chain
/// </summary>
public enum ResourceType
{
    None = 0,
    RawMaterials = 1,  // Produced by Industrial buildings
    Goods = 2,         // Produced by Commercial, consumed by Residential
    Waste = 3,         // Produced by all, collected to Hub
    Energy = 4,        // Future: power plant → all buildings
    Water = 5,         // Future: water treatment → all buildings
    
    // Keep this at the end for array sizing
    Count = 6
}

/// <summary>
/// Fixed-size inventory slot for a single resource type
/// Using struct for performance (no heap allocation, cache-friendly)
/// </summary>
public struct InventorySlot
{
    /// <summary>
    /// Current amount of this resource in inventory
    /// </summary>
    public float Current;
    
    /// <summary>
    /// Maximum capacity for this resource
    /// </summary>
    public float Max;
    
    /// <summary>
    /// Amount reserved for pending deliveries (prevents double-booking)
    /// </summary>
    public float InTransit;
    
    /// <summary>
    /// Units produced per second (0 if not produced)
    /// </summary>
    public float ProductionRate;
    
    /// <summary>
    /// Units consumed per second (0 if not consumed)
    /// </summary>
    public float ConsumptionRate;
    
    /// <summary>
    /// Gets the available amount (not reserved)
    /// </summary>
    public readonly float Available => Current - InTransit;
    
    /// <summary>
    /// Gets the effective inventory considering in-transit resources
    /// For consumers: Current + InTransit (what's coming)
    /// For producers: Current - InTransit (what's leaving)
    /// </summary>
    public readonly float Effective => ConsumptionRate > 0 
        ? Current + InTransit 
        : Current - InTransit;
    
    /// <summary>
    /// Gets the fill percentage (0-1)
    /// </summary>
    public readonly float FillRatio => Max > 0 ? Current / Max : 0;
    
    /// <summary>
    /// Gets the effective fill percentage considering in-transit
    /// </summary>
    public readonly float EffectiveFillRatio => Max > 0 ? Effective / Max : 0;
    
    /// <summary>
    /// Produces resources based on the production rate
    /// </summary>
    public void Produce(float deltaTime)
    {
        if (ProductionRate > 0)
        {
            Current = Math.Min(Current + ProductionRate * deltaTime, Max);
        }
    }
    
    /// <summary>
    /// Consumes resources based on the consumption rate
    /// </summary>
    public void Consume(float deltaTime)
    {
        if (ConsumptionRate > 0)
        {
            Current = Math.Max(Current - ConsumptionRate * deltaTime, 0);
        }
    }
    
    /// <summary>
    /// Reserves amount for a pending delivery
    /// </summary>
    public bool Reserve(float amount)
    {
        if (amount <= Available)
        {
            InTransit += amount;
            return true;
        }
        return false;
    }
    
    /// <summary>
    /// Releases a reservation (e.g., if delivery cancelled)
    /// </summary>
    public void ReleaseReservation(float amount)
    {
        InTransit = Math.Max(InTransit - amount, 0);
    }
    
    /// <summary>
    /// Completes a pickup (removes from inventory)
    /// </summary>
    public bool Pickup(float amount)
    {
        if (amount <= Current)
        {
            Current -= amount;
            InTransit = Math.Max(InTransit - amount, 0);
            return true;
        }
        return false;
    }
    
    /// <summary>
    /// Completes a delivery (adds to inventory)
    /// </summary>
    public void Deliver(float amount)
    {
        Current = Math.Min(Current + amount, Max);
        InTransit = Math.Max(InTransit - amount, 0);
    }
}
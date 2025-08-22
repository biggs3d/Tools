namespace CityBuilder.Simulation;

/// <summary>
/// Shape/color-based resources for the supply chain system
/// </summary>
public enum ResourceType
{
    None = 0,
    
    // Tier 1: Basic gathered resources (from terrain)
    BlueTeardrop = 1,    // Gathered from water tiles
    RedSquare = 2,       // Mined from ore deposits
    YellowTriangle = 3,  // Gathered from rock formations
    
    // Tier 2: Factory-created resources (two inputs)
    GreenHexagon = 4,    // Blue Teardrop + Yellow Triangle
    OrangeCircle = 5,    // Yellow Triangle + Red Square
    PurpleDiamond = 6,   // Blue Teardrop + Red Square
    
    // Tier 3: Advanced resources (complex recipes)
    BlackBeam = 7,       // Green Hexagon + Purple Diamond (horizontal rectangle)
    WhitePillar = 8,     // Purple Diamond + Orange Circle (vertical rectangle)
    SilverTruss = 9,     // Black Beam + White Pillar (X-shape, for hub upgrades)
    
    // Keep this at the end for array sizing
    Count = 10
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
    public int Current;
    
    /// <summary>
    /// Maximum capacity for this resource
    /// </summary>
    public int Max;
    
    /// <summary>
    /// Amount reserved for pending deliveries (prevents double-booking)
    /// </summary>
    public int InTransit;
    
    /// <summary>
    /// Units produced per tick (0 if not produced)
    /// </summary>
    public int ProductionRate;
    
    /// <summary>
    /// Units consumed per tick (0 if not consumed)
    /// </summary>
    public int ConsumptionRate;
    
    /// <summary>
    /// Gets the available amount (not reserved)
    /// </summary>
    public readonly int Available => Current - InTransit;
    
    /// <summary>
    /// Gets the effective inventory considering in-transit resources
    /// For consumers: Current + InTransit (what's coming)
    /// For producers: Current - InTransit (what's leaving)
    /// </summary>
    public readonly int Effective => ConsumptionRate > 0 
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
    public void Produce(int ticksElapsed = 1)
    {
        if (ProductionRate > 0)
        {
            Current = Math.Min(Current + ProductionRate * ticksElapsed, Max);
        }
    }
    
    /// <summary>
    /// Consumes resources based on the consumption rate
    /// </summary>
    public void Consume(int ticksElapsed = 1)
    {
        if (ConsumptionRate > 0)
        {
            Current = Math.Max(Current - ConsumptionRate * ticksElapsed, 0);
        }
    }
    
    /// <summary>
    /// Reserves amount for a pending delivery
    /// </summary>
    public bool Reserve(int amount)
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
    public void ReleaseReservation(int amount)
    {
        InTransit = Math.Max(InTransit - amount, 0);
    }
    
    /// <summary>
    /// Completes a pickup (removes from inventory)
    /// </summary>
    public bool Pickup(int amount)
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
    public void Deliver(int amount)
    {
        Current = Math.Min(Current + amount, Max);
        InTransit = Math.Max(InTransit - amount, 0);
    }
    
    /// <summary>
    /// Marks that resources are incoming (for consumers)
    /// </summary>
    public void ExpectIncoming(int amount)
    {
        InTransit += amount;
    }
    
    /// <summary>
    /// Cancels expected incoming resources
    /// </summary>
    public void CancelIncoming(int amount)
    {
        InTransit = Math.Max(InTransit - amount, 0);
    }
    
    /// <summary>
    /// Receives incoming resources
    /// </summary>
    public void ReceiveIncoming(int amount)
    {
        Current = Math.Min(Current + amount, Max);
        InTransit = Math.Max(InTransit - amount, 0);
    }
    
    /// <summary>
    /// Releases reserved resources (for failed pickups)
    /// </summary>
    public void ReleaseReserved(int amount)
    {
        InTransit = Math.Max(InTransit - amount, 0);
    }
    
    /// <summary>
    /// Completes a reservation (actually removes the resources)
    /// </summary>
    public void CompleteReservation(int amount)
    {
        Current = Math.Max(Current - amount, 0);
        InTransit = Math.Max(InTransit - amount, 0);
    }
}
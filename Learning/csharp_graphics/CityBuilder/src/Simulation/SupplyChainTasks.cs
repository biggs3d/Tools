using CityBuilder.Core;

namespace CityBuilder.Simulation;

/// <summary>
/// Request for a resource delivery (building needs resources)
/// </summary>
public class PickupRequest
{
    public Guid Id { get; } = Guid.NewGuid();
    public BuildingData Building { get; set; } = null!;
    public ResourceType Resource { get; set; }
    public int Amount { get; set; }
    public float WaitTime { get; set; }
    public DateTime CreatedAt { get; } = DateTime.UtcNow;
}

/// <summary>
/// Offer to provide resources (building has excess)
/// </summary>
public class DeliveryOffer
{
    public Guid Id { get; } = Guid.NewGuid();
    public BuildingData Building { get; set; } = null!;
    public ResourceType Resource { get; set; }
    public int Amount { get; set; }
    public float WaitTime { get; set; }
    public DateTime CreatedAt { get; } = DateTime.UtcNow;
}

/// <summary>
/// Extended delivery task with resource information
/// </summary>
public class ResourceDeliveryTask : DeliveryTask
{
    /// <summary>
    /// Type of resource being delivered
    /// </summary>
    public ResourceType Resource { get; }
    
    /// <summary>
    /// Amount of resource (respects vehicle capacity)
    /// </summary>
    public int Amount { get; }
    
    /// <summary>
    /// Is this an export to the hub?
    /// </summary>
    public bool IsExport { get; }
    
    /// <summary>
    /// Is this an import from the hub?
    /// </summary>
    public bool IsImport { get; }
    
    /// <summary>
    /// Source building (null for hub imports)
    /// </summary>
    public BuildingData? SourceBuilding { get; }
    
    /// <summary>
    /// Destination building (null for hub exports)
    /// </summary>
    public BuildingData? DestinationBuilding { get; }
    
    private static int _nextId = 1;
    
    public ResourceDeliveryTask(
        Vector2Int pickupLocation,
        Vector2Int deliveryLocation,
        ResourceType resource,
        int amount,
        bool isExport = false,
        bool isImport = false,
        BuildingData? sourceBuilding = null,
        BuildingData? destinationBuilding = null,
        float createdTime = 0)
        : base(_nextId++, pickupLocation, deliveryLocation, resource.ToString(), 1, createdTime)
    {
        Resource = resource;
        Amount = amount;
        IsExport = isExport;
        IsImport = isImport;
        SourceBuilding = sourceBuilding;
        DestinationBuilding = destinationBuilding;
    }
}

/// <summary>
/// Event when a new pickup request is created
/// </summary>
public class PickupRequestCreated
{
    public PickupRequest Request { get; set; } = null!;
}

/// <summary>
/// Event when a new delivery offer is created
/// </summary>
public class DeliveryOfferCreated
{
    public DeliveryOffer Offer { get; set; } = null!;
}

/// <summary>
/// Event when a task is completed
/// </summary>
public class ResourceDeliveryCompleted
{
    public ResourceDeliveryTask Task { get; set; } = null!;
    public bool Success { get; set; }
}

/// <summary>
/// Event when a task is cancelled
/// </summary>
public class ResourceDeliveryCancelled
{
    public ResourceDeliveryTask Task { get; set; } = null!;
    public string Reason { get; set; } = "";
}
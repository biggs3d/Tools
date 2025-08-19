using System.Collections.Generic;
using System.Linq;
using CityBuilder.Core;

namespace CityBuilder.Simulation;

/// <summary>
/// Matches supply offers with demand requests to create delivery tasks
/// Uses O(1) dictionary lookups for performance
/// </summary>
public class TaskMatcher
{
    // O(1) lookup by resource type - MUCH faster than linear search
    private readonly Dictionary<ResourceType, Queue<PickupRequest>> _requestsByResource;
    private readonly Dictionary<ResourceType, Queue<DeliveryOffer>> _offersByResource;
    private readonly EventBus _eventBus;
    
    /// <summary>
    /// Hub location for imports/exports
    /// </summary>
    public Vector2Int HubLocation { get; set; }
    
    /// <summary>
    /// Minimum wait time before importing from hub (seconds)
    /// </summary>
    public float ImportWaitTime { get; set; } = 5.0f;
    
    /// <summary>
    /// Default vehicle capacity if not specified
    /// </summary>
    public float DefaultVehicleCapacity { get; set; } = 20.0f;
    
    public TaskMatcher(EventBus eventBus)
    {
        _eventBus = eventBus;
        _requestsByResource = new Dictionary<ResourceType, Queue<PickupRequest>>();
        _offersByResource = new Dictionary<ResourceType, Queue<DeliveryOffer>>();
        
        // Initialize queues for each resource type
        for (int i = 1; i < (int)ResourceType.Count; i++)
        {
            var resourceType = (ResourceType)i;
            _requestsByResource[resourceType] = new Queue<PickupRequest>();
            _offersByResource[resourceType] = new Queue<DeliveryOffer>();
        }
        
        // Subscribe to events
        _eventBus.Subscribe<PickupRequestCreated>(OnPickupRequestCreated);
        _eventBus.Subscribe<DeliveryOfferCreated>(OnDeliveryOfferCreated);
    }
    
    private void OnPickupRequestCreated(PickupRequestCreated e)
    {
        _requestsByResource[e.Request.Resource].Enqueue(e.Request);
    }
    
    private void OnDeliveryOfferCreated(DeliveryOfferCreated e)
    {
        _offersByResource[e.Offer.Resource].Enqueue(e.Offer);
    }
    
    /// <summary>
    /// Tries to match tasks for a vehicle with specific capacity
    /// </summary>
    public ResourceDeliveryTask? MatchTasks(float vehicleCapacity)
    {
        // 1. Try to match producer → consumer (most efficient)
        var task = TryMatchProducerToConsumer(vehicleCapacity);
        if (task != null) return task;
        
        // 2. No direct match - try hub export (producer → hub)
        task = TryMatchProducerToHub(vehicleCapacity);
        if (task != null) return task;
        
        // 3. Still nothing - try hub import (hub → consumer)
        task = TryMatchHubToConsumer(vehicleCapacity);
        if (task != null) return task;
        
        return null; // No tasks available
    }
    
    /// <summary>
    /// Tries to match tasks without vehicle capacity specified
    /// </summary>
    public ResourceDeliveryTask? MatchTasks()
    {
        return MatchTasks(DefaultVehicleCapacity);
    }
    
    private ResourceDeliveryTask? TryMatchProducerToConsumer(float vehicleCapacity)
    {
        foreach (var resourceType in _offersByResource.Keys)
        {
            if (_requestsByResource.TryGetValue(resourceType, out var requests) && 
                requests.Count > 0 && _offersByResource[resourceType].Count > 0)
            {
                var offer = _offersByResource[resourceType].Dequeue();
                var request = requests.Dequeue();
                
                // Handle vehicle capacity limits
                float amount = Math.Min(offer.Amount, Math.Min(request.Amount, vehicleCapacity));
                
                // Reserve the resources
                offer.Building.Inventory[(int)resourceType].Reserve(amount);
                request.Building.Inventory[(int)resourceType].InTransit += amount;
                
                // Re-queue partial tasks if needed
                if (offer.Amount > amount)
                {
                    offer.Amount -= amount;
                    _offersByResource[resourceType].Enqueue(offer);
                }
                if (request.Amount > amount)
                {
                    request.Amount -= amount;
                    requests.Enqueue(request);
                }
                
                return new ResourceDeliveryTask(
                    offer.Building.Location,
                    request.Building.Location,
                    resourceType,
                    amount,
                    false, // not export
                    false, // not import
                    offer.Building,
                    request.Building);
            }
        }
        
        return null;
    }
    
    private ResourceDeliveryTask? TryMatchProducerToHub(float vehicleCapacity)
    {
        foreach (var (resource, offers) in _offersByResource)
        {
            if (offers.Count > 0)
            {
                var offer = offers.Dequeue();
                float amount = Math.Min(offer.Amount, vehicleCapacity);
                
                offer.Building.Inventory[(int)resource].Reserve(amount);
                
                if (offer.Amount > amount)
                {
                    offer.Amount -= amount;
                    offers.Enqueue(offer);
                }
                
                return new ResourceDeliveryTask(
                    offer.Building.Location,
                    HubLocation,
                    resource,
                    amount,
                    true,  // is export
                    false, // not import
                    offer.Building,
                    null);
            }
        }
        
        return null;
    }
    
    private ResourceDeliveryTask? TryMatchHubToConsumer(float vehicleCapacity)
    {
        foreach (var (resource, requests) in _requestsByResource)
        {
            if (requests.Count > 0 && requests.Peek().WaitTime >= ImportWaitTime)
            {
                var request = requests.Dequeue();
                float amount = Math.Min(request.Amount, vehicleCapacity);
                
                request.Building.Inventory[(int)resource].InTransit += amount;
                
                if (request.Amount > amount)
                {
                    request.Amount -= amount;
                    requests.Enqueue(request);
                }
                
                return new ResourceDeliveryTask(
                    HubLocation,
                    request.Building.Location,
                    resource,
                    amount,
                    false, // not export
                    true,  // is import
                    null,
                    request.Building);
            }
        }
        
        return null;
    }
    
    /// <summary>
    /// Release reservation when task completes or cancels
    /// </summary>
    public void ReleaseReservation(ResourceDeliveryTask task)
    {
        // Release source reservation
        if (task.SourceBuilding != null)
        {
            task.SourceBuilding.Inventory[(int)task.Resource].ReleaseReservation(task.Amount);
        }
        
        // Release destination reservation
        if (task.DestinationBuilding != null)
        {
            task.DestinationBuilding.Inventory[(int)task.Resource].InTransit = 
                Math.Max(0, task.DestinationBuilding.Inventory[(int)task.Resource].InTransit - task.Amount);
        }
    }
    
    /// <summary>
    /// Complete a delivery (transfer resources)
    /// </summary>
    public void CompleteDelivery(ResourceDeliveryTask task)
    {
        // Pickup from source
        if (task.SourceBuilding != null)
        {
            task.SourceBuilding.Inventory[(int)task.Resource].Pickup(task.Amount);
        }
        
        // Deliver to destination
        if (task.DestinationBuilding != null)
        {
            task.DestinationBuilding.Inventory[(int)task.Resource].Deliver(task.Amount);
        }
        
        _eventBus.Publish(new ResourceDeliveryCompleted { Task = task, Success = true });
    }
    
    /// <summary>
    /// Cancel a delivery task
    /// </summary>
    public void CancelDelivery(ResourceDeliveryTask task, string reason)
    {
        ReleaseReservation(task);
        _eventBus.Publish(new ResourceDeliveryCancelled { Task = task, Reason = reason });
    }
    
    /// <summary>
    /// Update wait times for all pending tasks
    /// </summary>
    public void UpdateWaitTimes(float deltaTime)
    {
        foreach (var queue in _requestsByResource.Values)
        {
            foreach (var request in queue)
            {
                request.WaitTime += deltaTime;
            }
        }
        
        foreach (var queue in _offersByResource.Values)
        {
            foreach (var offer in queue)
            {
                offer.WaitTime += deltaTime;
            }
        }
    }
    
    /// <summary>
    /// Get statistics about pending tasks
    /// </summary>
    public (int totalRequests, int totalOffers) GetPendingCounts()
    {
        int requests = _requestsByResource.Values.Sum(q => q.Count);
        int offers = _offersByResource.Values.Sum(q => q.Count);
        return (requests, offers);
    }
    
    /// <summary>
    /// Clear all pending tasks (e.g., on game reset)
    /// </summary>
    public void ClearAll()
    {
        foreach (var queue in _requestsByResource.Values)
        {
            queue.Clear();
        }
        
        foreach (var queue in _offersByResource.Values)
        {
            queue.Clear();
        }
    }
}
using System;
using System.Collections.Generic;
using System.Linq;
using CityBuilder.Core;
using CityBuilder.Grid;

namespace CityBuilder.Simulation
{
    /// <summary>
    /// Manages all buildings in the simulation and their supply chain interactions
    /// </summary>
    public class BuildingManager
    {
        private readonly Dictionary<Vector2Int, BuildingData> _buildings;
        private readonly List<PickupRequest> _activeRequests;
        private readonly List<DeliveryOffer> _activeOffers;
        private readonly EventBus _eventBus;
        private readonly GridSystem _gridSystem;
        private readonly TaskMatcher _taskMatcher;
        private Vector2Int? _hubLocation;
        
        public IReadOnlyDictionary<Vector2Int, BuildingData> Buildings => _buildings;
        public IReadOnlyList<PickupRequest> ActiveRequests => _activeRequests;
        public IReadOnlyList<DeliveryOffer> ActiveOffers => _activeOffers;
        public Vector2Int? HubLocation => _hubLocation;
        
        public BuildingManager(GridSystem gridSystem, EventBus eventBus)
        {
            _gridSystem = gridSystem ?? throw new ArgumentNullException(nameof(gridSystem));
            _eventBus = eventBus ?? throw new ArgumentNullException(nameof(eventBus));
            _buildings = new Dictionary<Vector2Int, BuildingData>();
            _activeRequests = new List<PickupRequest>();
            _activeOffers = new List<DeliveryOffer>();
            _taskMatcher = new TaskMatcher(_eventBus);
            
            SubscribeToEvents();
            ScanExistingBuildings();
        }
        
        private void SubscribeToEvents()
        {
            _eventBus.Subscribe<TilePlacedEvent>(OnTilePlaced);
            _eventBus.Subscribe<TileRemovedEvent>(OnTileRemoved);
        }
        
        private void OnTilePlaced(TilePlacedEvent e)
        {
            var position = e.TileCoord;
            var type = e.TileType;
            
            // Check if this is a building type
            if (type == TileType.Residential || 
                type == TileType.Commercial || 
                type == TileType.Industrial ||
                type == TileType.LandingPad ||
                type == TileType.UndergroundEntrance)
            {
                if (!_buildings.ContainsKey(position))
                {
                    var building = new BuildingData(type, position);
                    _buildings[position] = building;
                    
                    // Update hub location if this is a hub
                    if (type == TileType.LandingPad || type == TileType.UndergroundEntrance)
                    {
                        _hubLocation = position;
                        Console.WriteLine($"Hub registered at {position}");
                    }
                    
                    Console.WriteLine($"Building registered: {type} at {position}");
                }
            }
        }
        
        private void OnTileRemoved(TileRemovedEvent e)
        {
            var position = e.TileCoord;
            
            if (_buildings.TryGetValue(position, out var building))
            {
                // Remove any active requests/offers for this building
                _activeRequests.RemoveAll(r => r.Building == building);
                _activeOffers.RemoveAll(o => o.Building == building);
                
                _buildings.Remove(position);
                
                // Clear hub location if this was the hub
                if (_hubLocation == position)
                {
                    _hubLocation = null;
                    FindHubLocation();
                }
                
                Console.WriteLine($"Building removed at {position}");
            }
        }
        
        private void ScanExistingBuildings()
        {
            _buildings.Clear();
            
            foreach (var chunk in _gridSystem.GetAllChunks())
            {
                for (int y = 0; y < TileChunk.Size; y++)
                {
                    for (int x = 0; x < TileChunk.Size; x++)
                    {
                        var worldX = chunk.ChunkCoord.X * TileChunk.Size + x;
                        var worldY = chunk.ChunkCoord.Y * TileChunk.Size + y;
                        var position = new Vector2Int(worldX, worldY);
                        var tile = _gridSystem.GetTileAt(position);
                        
                        if (tile.Type == TileType.Residential || 
                            tile.Type == TileType.Commercial || 
                            tile.Type == TileType.Industrial ||
                            tile.Type == TileType.LandingPad ||
                            tile.Type == TileType.UndergroundEntrance)
                        {
                            var building = new BuildingData(tile.Type, position);
                            _buildings[position] = building;
                            
                            if (tile.Type == TileType.LandingPad || tile.Type == TileType.UndergroundEntrance)
                            {
                                _hubLocation = position;
                            }
                        }
                    }
                }
            }
            
            Console.WriteLine($"BuildingManager initialized with {_buildings.Count} buildings, Hub: {_hubLocation}");
        }
        
        private void FindHubLocation()
        {
            _hubLocation = null;
            foreach (var building in _buildings.Values)
            {
                if (building.Type == TileType.LandingPad || building.Type == TileType.UndergroundEntrance)
                {
                    _hubLocation = building.Location;
                    break;
                }
            }
        }
        
        /// <summary>
        /// Updates all buildings and generates supply chain tasks
        /// </summary>
        public void Update(float deltaTime, float totalTime)
        {
            // Update building inventories
            foreach (var building in _buildings.Values)
            {
                building.Update(deltaTime);
                
                // Check if it's time to update supply chain tasks for this building
                if (totalTime - building.LastUpdateTime >= BuildingData.UpdateInterval)
                {
                    building.LastUpdateTime = totalTime;
                    UpdateBuildingTasks(building);
                }
            }
            
            // Clean up expired requests and offers
            CleanupExpiredTasks(totalTime);
        }
        
        private void UpdateBuildingTasks(BuildingData building)
        {
            // Skip hub buildings
            if (building.Type == TileType.LandingPad || building.Type == TileType.UndergroundEntrance)
                return;
            
            // Check each resource type
            for (int i = 1; i < (int)ResourceType.Count; i++) // Skip None
            {
                var resource = (ResourceType)i;
                var slot = building.Inventory[i];
                
                // Check if we need to request this resource
                if (slot.ConsumptionRate > 0)
                {
                    var existingRequest = _activeRequests.FirstOrDefault(r => 
                        r.Building == building && r.Resource == resource);
                    
                    if (building.NeedsDelivery(resource))
                    {
                        if (existingRequest == null)
                        {
                            // Create new request
                            var request = new PickupRequest
                            {
                                Building = building,
                                Resource = resource,
                                Amount = building.GetRequestAmount(resource),
                                WaitTime = 0
                            };
                            
                            _activeRequests.Add(request);
                            _eventBus.Publish(new PickupRequestCreated { Request = request });
                        }
                    }
                    else if (existingRequest != null && slot.EffectiveFillRatio > building.RequestCancelThreshold)
                    {
                        // Cancel request if we're above cancel threshold
                        _activeRequests.Remove(existingRequest);
                    }
                }
                
                // Check if we can offer this resource
                if (slot.ProductionRate > 0)
                {
                    var existingOffer = _activeOffers.FirstOrDefault(o => 
                        o.Building == building && o.Resource == resource);
                    
                    if (building.CanOffer(resource))
                    {
                        if (existingOffer == null)
                        {
                            // Create new offer
                            var offer = new DeliveryOffer
                            {
                                Building = building,
                                Resource = resource,
                                Amount = building.GetOfferAmount(resource),
                                WaitTime = 0
                            };
                            
                            _activeOffers.Add(offer);
                            _eventBus.Publish(new DeliveryOfferCreated { Offer = offer });
                        }
                    }
                    else if (existingOffer != null && slot.EffectiveFillRatio < building.OfferCancelThreshold)
                    {
                        // Cancel offer if we're below cancel threshold
                        _activeOffers.Remove(existingOffer);
                    }
                }
            }
        }
        
        private void CleanupExpiredTasks(float totalTime)
        {
            const float MaxWaitTime = 30f; // Tasks expire after 30 seconds
            
            _activeRequests.RemoveAll(r => 
                (totalTime - (float)(DateTime.UtcNow - r.CreatedAt).TotalSeconds) > MaxWaitTime);
            
            _activeOffers.RemoveAll(o => 
                (totalTime - (float)(DateTime.UtcNow - o.CreatedAt).TotalSeconds) > MaxWaitTime);
        }
        
        /// <summary>
        /// Generates delivery tasks by matching requests with offers
        /// </summary>
        public List<ResourceDeliveryTask> GenerateDeliveryTasks(float totalTime)
        {
            var tasks = new List<ResourceDeliveryTask>();
            
            // Match internal supply chain tasks
            var matches = _taskMatcher.MatchRequestsAndOffers(_activeRequests, _activeOffers);
            
            foreach (var match in matches)
            {
                var task = new ResourceDeliveryTask(
                    match.Offer.Building.Location,
                    match.Request.Building.Location,
                    match.Resource,
                    match.Amount,
                    isExport: false,
                    isImport: false,
                    sourceBuilding: match.Offer.Building,
                    destinationBuilding: match.Request.Building,
                    createdTime: totalTime
                );
                
                tasks.Add(task);
                
                // Reserve the resources
                match.Offer.Building.Inventory[(int)match.Resource].Reserve(match.Amount);
                match.Request.Building.Inventory[(int)match.Resource].ExpectIncoming(match.Amount);
                
                // Remove the matched request and offer
                _activeRequests.Remove(match.Request);
                _activeOffers.Remove(match.Offer);
            }
            
            // Handle hub imports/exports if hub exists
            if (_hubLocation.HasValue && _buildings.TryGetValue(_hubLocation.Value, out var hub))
            {
                // Import tasks for buildings that need resources
                foreach (var request in _activeRequests.ToList())
                {
                    if (tasks.Count >= 5) break; // Limit tasks per update
                    
                    var task = new ResourceDeliveryTask(
                        _hubLocation.Value,
                        request.Building.Location,
                        request.Resource,
                        Math.Min(request.Amount, 20f), // Limit per vehicle
                        isExport: false,
                        isImport: true,
                        sourceBuilding: null,
                        destinationBuilding: request.Building,
                        createdTime: totalTime
                    );
                    
                    tasks.Add(task);
                    request.Building.Inventory[(int)request.Resource].ExpectIncoming(task.Amount);
                    _activeRequests.Remove(request);
                }
                
                // Export tasks for buildings with excess (especially waste)
                foreach (var offer in _activeOffers.ToList())
                {
                    if (tasks.Count >= 8) break; // Limit tasks per update
                    
                    // Prioritize waste removal
                    if (offer.Resource != ResourceType.Waste && tasks.Count >= 6)
                        continue;
                    
                    var task = new ResourceDeliveryTask(
                        offer.Building.Location,
                        _hubLocation.Value,
                        offer.Resource,
                        Math.Min(offer.Amount, 20f), // Limit per vehicle
                        isExport: true,
                        isImport: false,
                        sourceBuilding: offer.Building,
                        destinationBuilding: null,
                        createdTime: totalTime
                    );
                    
                    tasks.Add(task);
                    offer.Building.Inventory[(int)offer.Resource].Reserve(task.Amount);
                    _activeOffers.Remove(offer);
                }
            }
            
            return tasks;
        }
        
        /// <summary>
        /// Called when a delivery is completed
        /// </summary>
        public void OnDeliveryCompleted(ResourceDeliveryTask task, bool success)
        {
            if (!success)
            {
                // Release reserved resources if delivery failed
                if (task.SourceBuilding != null)
                {
                    task.SourceBuilding.Inventory[(int)task.Resource].ReleaseReserved(task.Amount);
                }
                if (task.DestinationBuilding != null)
                {
                    task.DestinationBuilding.Inventory[(int)task.Resource].CancelIncoming(task.Amount);
                }
            }
            else
            {
                // Transfer resources
                if (task.SourceBuilding != null)
                {
                    task.SourceBuilding.Inventory[(int)task.Resource].CompleteReservation(task.Amount);
                }
                if (task.DestinationBuilding != null)
                {
                    task.DestinationBuilding.Inventory[(int)task.Resource].ReceiveIncoming(task.Amount);
                }
            }
            
            _eventBus.Publish(new ResourceDeliveryCompleted { Task = task, Success = success });
        }
        
        /// <summary>
        /// Gets building at the specified location
        /// </summary>
        public BuildingData? GetBuildingAt(Vector2Int location)
        {
            return _buildings.TryGetValue(location, out var building) ? building : null;
        }
        
        /// <summary>
        /// Resets the building manager
        /// </summary>
        public void Reset()
        {
            _buildings.Clear();
            _activeRequests.Clear();
            _activeOffers.Clear();
            _hubLocation = null;
            ScanExistingBuildings();
        }
    }
}
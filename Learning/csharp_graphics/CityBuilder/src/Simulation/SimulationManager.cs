using System;
using System.Collections.Generic;
using System.Linq;
using CityBuilder.Core;
using CityBuilder.Grid;
using CityBuilder.Simulation.Buildings;

namespace CityBuilder.Simulation
{
    public class SimulationManager
    {
        private readonly GridSystem _gridSystem;
        private readonly PathfindingService _pathfindingService;
        private readonly VehiclePool _vehiclePool;
        private readonly Queue<DeliveryTask> _pendingTasks;
        private readonly List<DeliveryTask> _activeTasks;
        private readonly List<Vector2Int> _buildingLocations;
        private readonly EventBus _eventBus;
        private readonly GameSettings _gameSettings;
        private readonly BuildingManager _buildingManager;
        private readonly Random _random;
        
        private float _accumulator;
        private float _taskGenerationTimer;
        private int _nextTaskId;
        private Vector2Int? _hubLocation;
        private float _totalTime;
        private bool _useSupplyChain = true;
        
        public IReadOnlyList<Vehicle> ActiveVehicles => _vehiclePool.ActiveVehicles;
        public int PendingTaskCount => _pendingTasks.Count;
        public int ActiveTaskCount => _activeTasks.Count;
        public bool IsPaused { get; set; }
        
        public SimulationManager(GridSystem gridSystem, EventBus eventBus, GameSettings gameSettings)
        {
            _gridSystem = gridSystem ?? throw new ArgumentNullException(nameof(gridSystem));
            _eventBus = eventBus ?? throw new ArgumentNullException(nameof(eventBus));
            _gameSettings = gameSettings ?? throw new ArgumentNullException(nameof(gameSettings));
            
            _pathfindingService = new PathfindingService(gridSystem);
            _vehiclePool = new VehiclePool(GameConstants.VehiclePoolInitialSize, GameConstants.MaxVehicles, gameSettings);
            _buildingManager = new BuildingManager(gridSystem, eventBus);
            _pendingTasks = new Queue<DeliveryTask>();
            _activeTasks = new List<DeliveryTask>();
            _buildingLocations = new List<Vector2Int>();
            _random = new Random();
            
            _accumulator = 0f;
            _taskGenerationTimer = 0f;
            _nextTaskId = 0;
            _totalTime = 0f;
            
            SubscribeToEvents();
            FindHubLocation();
            ScanForBuildings();
            _hubLocation = _buildingManager.HubLocation;
            Console.WriteLine($"SimulationManager initialized. Hub: {_hubLocation}, Buildings: {_buildingLocations.Count}");
            Console.WriteLine($"Supply chain mode: {(_useSupplyChain ? "ENABLED" : "DISABLED")}");
        }
        
        private void SubscribeToEvents()
        {
            _eventBus.Subscribe<TilePlacedEvent>(OnTilePlaced);
            _eventBus.Subscribe<TileRemovedEvent>(OnTileRemoved);
        }
        
        private void OnTilePlaced(TilePlacedEvent e)
        {
            var position = e.TileCoord;
            var dirtyRegion = new Rectangle(
                position.X * GameConstants.TileSize, 
                position.Y * GameConstants.TileSize, 
                GameConstants.TileSize, 
                GameConstants.TileSize
            );
            _pathfindingService.InvalidateCache(dirtyRegion);
            
            // Update building locations list
            if (BuildingRegistry.IsBuilding(e.TileType))
            {
                if (!_buildingLocations.Contains(position))
                    _buildingLocations.Add(position);
            }
            
            if (e.TileType == TileType.LandingPad || e.TileType == TileType.UndergroundEntrance)
            {
                _hubLocation = position;
                Console.WriteLine($"Hub location set to {position}");
            }
        }
        
        private void OnTileRemoved(TileRemovedEvent e)
        {
            var position = e.TileCoord;
            var dirtyRegion = new Rectangle(
                position.X * GameConstants.TileSize, 
                position.Y * GameConstants.TileSize, 
                GameConstants.TileSize, 
                GameConstants.TileSize
            );
            _pathfindingService.InvalidateCache(dirtyRegion);
            
            _buildingLocations.Remove(position);
            
            if (_hubLocation == position)
            {
                _hubLocation = null;
                FindHubLocation();
            }
        }
        
        private void FindHubLocation()
        {
            foreach (var chunk in _gridSystem.GetAllChunks())
            {
                for (int y = 0; y < TileChunk.Size; y++)
                {
                    for (int x = 0; x < TileChunk.Size; x++)
                    {
                        var worldX = chunk.ChunkCoord.X * TileChunk.Size + x;
                        var worldY = chunk.ChunkCoord.Y * TileChunk.Size + y;
                        var tile = _gridSystem.GetTileAt(new Vector2Int(worldX, worldY));
                        
                        if (tile.Type == TileType.LandingPad || tile.Type == TileType.UndergroundEntrance)
                        {
                            _hubLocation = new Vector2Int(worldX, worldY);
                            return;
                        }
                    }
                }
            }
        }
        
        private void ScanForBuildings()
        {
            _buildingLocations.Clear();
            foreach (var chunk in _gridSystem.GetAllChunks())
            {
                for (int y = 0; y < TileChunk.Size; y++)
                {
                    for (int x = 0; x < TileChunk.Size; x++)
                    {
                        var worldX = chunk.ChunkCoord.X * TileChunk.Size + x;
                        var worldY = chunk.ChunkCoord.Y * TileChunk.Size + y;
                        var tile = _gridSystem.GetTileAt(new Vector2Int(worldX, worldY));
                        
                        if (BuildingRegistry.IsBuilding(tile.Type))
                        {
                            _buildingLocations.Add(new Vector2Int(worldX, worldY));
                        }
                    }
                }
            }
        }
        
        private Vector2Int? FindNearestRoadTile(Vector2Int buildingLocation)
        {
            // Check all four adjacent tiles for roads
            var adjacentOffsets = new Vector2Int[]
            {
                new Vector2Int(0, -1),  // North
                new Vector2Int(1, 0),   // East
                new Vector2Int(0, 1),   // South
                new Vector2Int(-1, 0)   // West
            };
            
            foreach (var offset in adjacentOffsets)
            {
                var adjacentPos = new Vector2Int(
                    buildingLocation.X + offset.X,
                    buildingLocation.Y + offset.Y
                );
                
                var tile = _gridSystem.GetTileAt(adjacentPos);
                if (tile.IsWalkable)
                {
                    return adjacentPos;
                }
            }
            
            // If no immediately adjacent road, search in expanding radius
            for (int radius = 2; radius <= 5; radius++)
            {
                for (int dx = -radius; dx <= radius; dx++)
                {
                    for (int dy = -radius; dy <= radius; dy++)
                    {
                        // Only check perimeter of the square
                        if (Math.Abs(dx) != radius && Math.Abs(dy) != radius)
                            continue;
                        
                        var checkPos = new Vector2Int(
                            buildingLocation.X + dx,
                            buildingLocation.Y + dy
                        );
                        
                        var tile = _gridSystem.GetTileAt(checkPos);
                        if (tile.IsWalkable)
                        {
                            return checkPos;
                        }
                    }
                }
            }
            
            return null;  // No road found within reasonable distance
        }
        
        public void Update(float deltaTime)
        {
            if (IsPaused)
                return;
            
            _accumulator += deltaTime;
            
            while (_accumulator >= GameConstants.FixedTimestep)
            {
                FixedUpdate(GameConstants.FixedTimestep);
                _accumulator -= GameConstants.FixedTimestep;
            }
            
            float alpha = _accumulator / GameConstants.FixedTimestep;
            _vehiclePool.UpdateInterpolation(alpha);
        }
        
        private void FixedUpdate(float deltaTime)
        {
            _totalTime += deltaTime;
            _taskGenerationTimer += deltaTime;
            
            _vehiclePool.Update(deltaTime);
            
            // Update building manager if using supply chain
            if (_useSupplyChain)
            {
                _buildingManager.Update(deltaTime, _totalTime);
                
                // Generate supply chain tasks periodically
                if (_taskGenerationTimer >= GameConstants.TaskGenerationInterval)
                {
                    GenerateSupplyChainTasks();
                    _taskGenerationTimer = 0f;
                }
            }
            else
            {
                // Use simple random task generation
                if (_taskGenerationTimer >= GameConstants.TaskGenerationInterval)
                {
                    GenerateRandomTask();
                    _taskGenerationTimer = 0f;
                }
            }
            
            AssignTasksToVehicles();
            UpdateVehiclePaths();
        }
        
        private void GenerateSupplyChainTasks()
        {
            var tasks = _buildingManager.GenerateDeliveryTasks(_totalTime);
            
            foreach (var task in tasks)
            {
                // Find nearest road tile for pickup and delivery locations
                var pickupRoad = FindNearestRoadTile(task.PickupLocation);
                var deliveryRoad = FindNearestRoadTile(task.DeliveryLocation);
                
                if (pickupRoad.HasValue && deliveryRoad.HasValue)
                {
                    // Create a wrapper task with road locations
                    var deliveryTask = new ResourceDeliveryTask(
                        pickupRoad.Value,
                        deliveryRoad.Value,
                        task.Resource,
                        task.Amount,
                        task.IsExport,
                        task.IsImport,
                        task.SourceBuilding,
                        task.DestinationBuilding,
                        _totalTime
                    );
                    
                    _pendingTasks.Enqueue(deliveryTask);
                    _eventBus.Publish(new DeliveryCreatedEvent { Task = deliveryTask });
                }
            }
        }
        
        private void GenerateRandomTask()
        {
            if (!_hubLocation.HasValue || _buildingLocations.Count == 0)
                return;
            
            var buildingLocation = _buildingLocations[_random.Next(_buildingLocations.Count)];
            
            // Find the nearest road tile to the building for actual delivery
            var nearestRoad = FindNearestRoadTile(buildingLocation);
            if (!nearestRoad.HasValue)
            {
                // No accessible road near this building
                return;
            }
            
            var task = new DeliveryTask(
                _nextTaskId++,
                _hubLocation.Value,
                nearestRoad.Value,  // Use road tile as delivery location
                "goods",
                1,
                _totalTime
            );
            
            _pendingTasks.Enqueue(task);
            _eventBus.Publish(new DeliveryCreatedEvent { Task = task });
        }
        
        private void AssignTasksToVehicles()
        {
            while (_pendingTasks.Count > 0)
            {
                var idleVehicle = _vehiclePool.ActiveVehicles
                    .FirstOrDefault(v => v.State == VehicleState.Idle);
                
                if (idleVehicle == null)
                {
                    if (_vehiclePool.ActiveCount < GameConstants.MaxVehicles)
                    {
                        idleVehicle = _vehiclePool.Acquire();
                        if (idleVehicle != null && _hubLocation.HasValue)
                        {
                            idleVehicle.Initialize(_hubLocation.Value);
                        }
                    }
                }
                
                if (idleVehicle == null)
                    break;
                
                var task = _pendingTasks.Dequeue();
                var path = _pathfindingService.FindPath(idleVehicle.TilePosition, task.PickupLocation);
                
                if (path != null)
                {
                    task.IsAssigned = true;
                    _activeTasks.Add(task);
                    idleVehicle.AssignTask(task, path);
                }
                else
                {
                    _pendingTasks.Enqueue(task);
                    break;
                }
            }
        }
        
        private void UpdateVehiclePaths()
        {
            foreach (var vehicle in _vehiclePool.ActiveVehicles)
            {
                // Only set delivery path after loading time is complete
                if (vehicle.State == VehicleState.Loading && 
                    vehicle.CurrentTask != null &&
                    vehicle.StateTimer >= GameConstants.VehicleLoadingTime)
                {
                    var path = _pathfindingService.FindPath(
                        vehicle.TilePosition,
                        vehicle.CurrentTask.DeliveryLocation
                    );
                    
                    if (path != null)
                    {
                        vehicle.SetDeliveryPath(path);
                    }
                }
                // Only set return path after unloading time is complete
                else if (vehicle.State == VehicleState.Unloading && 
                         _hubLocation.HasValue &&
                         vehicle.StateTimer >= GameConstants.VehicleUnloadingTime)
                {
                    var path = _pathfindingService.FindPath(
                        vehicle.TilePosition,
                        _hubLocation.Value
                    );
                    
                    if (path != null)
                    {
                        vehicle.SetReturnPath(path);
                        
                        if (vehicle.CurrentTask != null)
                        {
                            vehicle.CurrentTask.IsCompleted = true;
                            _activeTasks.Remove(vehicle.CurrentTask);
                            
                            // Notify building manager if this is a supply chain task
                            if (_useSupplyChain && vehicle.CurrentTask is ResourceDeliveryTask resourceTask)
                            {
                                _buildingManager.OnDeliveryCompleted(resourceTask, true);
                            }
                            
                            _eventBus.Publish(new DeliveryCompletedEvent { Task = vehicle.CurrentTask });
                        }
                    }
                }
            }
        }
        
        public void SpawnVehicle()
        {
            if (!_hubLocation.HasValue)
            {
                Console.WriteLine("Cannot spawn vehicle: No hub location found");
                return;
            }
            
            var vehicle = _vehiclePool.Acquire();
            if (vehicle != null)
            {
                vehicle.Initialize(_hubLocation.Value);
                Console.WriteLine($"Vehicle {vehicle.Id} spawned at hub {_hubLocation.Value}");
            }
            else
            {
                Console.WriteLine("Failed to acquire vehicle from pool");
            }
        }
        
        public void ToggleSupplyChainMode()
        {
            _useSupplyChain = !_useSupplyChain;
            Console.WriteLine($"Supply chain mode: {(_useSupplyChain ? "ENABLED" : "DISABLED")}");
            
            // Clear existing tasks when switching modes
            _pendingTasks.Clear();
            _activeTasks.Clear();
            
            if (_useSupplyChain)
            {
                _buildingManager.Reset();
            }
        }
        
        public void Reset()
        {
            _vehiclePool.ReleaseAll();
            _pendingTasks.Clear();
            _activeTasks.Clear();
            _buildingLocations.Clear();
            _pathfindingService.ClearCache();
            _buildingManager.Reset();
            _accumulator = 0f;
            _taskGenerationTimer = 0f;
            _nextTaskId = 0;
            _totalTime = 0f;
            FindHubLocation();
            ScanForBuildings();
            _hubLocation = _buildingManager.HubLocation;
        }
    }
    
    public class DeliveryCreatedEvent
    {
        public DeliveryTask? Task { get; set; }
    }
    
    public class DeliveryCompletedEvent
    {
        public DeliveryTask? Task { get; set; }
    }
}
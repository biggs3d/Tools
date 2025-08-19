using System;
using System.Linq;
using Xunit;
using CityBuilder.Core;
using CityBuilder.Grid;
using CityBuilder.Simulation;

namespace CityBuilder.Tests.Integration
{
    public class SimulationE2ETests
    {
        [Fact]
        public void E2E_VehicleMovement_CompleteDeliveryFlow()
        {
            // Arrange - Create the world
            var eventBus = new EventBus();
            var gridSystem = new GridSystem(eventBus);
            var gameSettings = new GameSettings();
            var simulationManager = new SimulationManager(gridSystem, eventBus, gameSettings);
            
            Console.WriteLine("=== E2E Simulation Test Starting ===");
            
            // Place hub at origin
            var hubPlaced = gridSystem.PlaceTileAt(new Vector2Int(0, 0), TileType.LandingPad);
            Assert.True(hubPlaced, "Hub should be placed successfully");
            Console.WriteLine($"Hub placed at (0,0): {hubPlaced}");
            
            // Build a road path from hub to building location
            for (int x = 1; x <= 6; x++)
            {
                var roadPlaced = gridSystem.PlaceTileAt(new Vector2Int(x, 0), TileType.Road);
                Assert.True(roadPlaced, $"Road at ({x},0) should be placed");
            }
            Console.WriteLine("Road path created from (1,0) to (6,0)");
            
            // Place a building adjacent to the road (not on it)
            var buildingPlaced = gridSystem.PlaceTileAt(new Vector2Int(6, 1), TileType.Residential);
            Assert.True(buildingPlaced, "Building should be placed");
            Console.WriteLine("Residential building placed at (6,1) adjacent to road");
            
            // Spawn a vehicle manually
            simulationManager.SpawnVehicle();
            Assert.Equal(1, simulationManager.ActiveVehicles.Count);
            var vehicle = simulationManager.ActiveVehicles.First();
            Console.WriteLine($"Vehicle spawned: ID={vehicle.Id}, State={vehicle.State}, Position={vehicle.Position}");
            
            // Simulate time passing to generate tasks
            Console.WriteLine("\n=== Simulating 11 seconds for task generation ===");
            float totalTime = 0;
            float deltaTime = 1f / 30f; // 30Hz simulation
            
            while (totalTime < 11f)
            {
                simulationManager.Update(deltaTime);
                totalTime += deltaTime;
                
                // Log state changes
                if ((int)(totalTime * 10) % 10 == 0) // Every second
                {
                    var v = simulationManager.ActiveVehicles.First();
                    Console.WriteLine($"T={totalTime:F1}s: Vehicle State={v.State}, Pos=({v.Position.X:F1},{v.Position.Y:F1}), Tasks: {simulationManager.PendingTaskCount} pending, {simulationManager.ActiveTaskCount} active");
                }
            }
            
            // Assert vehicle has picked up a task
            Assert.True(simulationManager.ActiveTaskCount > 0, "Should have active tasks");
            Assert.NotEqual(VehicleState.Idle, vehicle.State);
            Console.WriteLine($"\nAfter task generation: Vehicle State={vehicle.State}");
            
            // Simulate loading time (2 seconds)
            Console.WriteLine("\n=== Simulating loading time ===");
            totalTime = 0;
            while (totalTime < 3f)
            {
                simulationManager.Update(deltaTime);
                totalTime += deltaTime;
                
                if ((int)(totalTime * 2) % 2 == 0)
                {
                    var v = simulationManager.ActiveVehicles.First();
                    Console.WriteLine($"Loading T={totalTime:F1}s: State={v.State}, StateTimer={v.StateTimer:F1}");
                }
            }
            
            // Vehicle should now be moving
            Assert.True(vehicle.State == VehicleState.MovingToDelivery || 
                       vehicle.State == VehicleState.MovingToPickup,
                       $"Vehicle should be moving, but is {vehicle.State}");
            
            Console.WriteLine($"\nFinal vehicle state: {vehicle.State}");
            Console.WriteLine($"Vehicle has path: {vehicle.CurrentPath != null}");
            if (vehicle.CurrentPath != null)
            {
                Console.WriteLine($"Path nodes: {vehicle.CurrentPath.Nodes?.Count ?? 0}");
            }
        }
        
        [Fact]
        public void E2E_PathfindingService_DirectTest()
        {
            // Direct test of pathfinding
            var eventBus = new EventBus();
            var gridSystem = new GridSystem(eventBus);
            
            // Place hub
            gridSystem.PlaceTileAt(new Vector2Int(0, 0), TileType.LandingPad);
            
            // Create road path
            for (int x = 0; x <= 5; x++)
            {
                gridSystem.PlaceTileAt(new Vector2Int(x, 0), TileType.Road);
            }
            
            var pathfinding = new PathfindingService(gridSystem);
            var path = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(5, 0));
            
            Assert.NotNull(path);
            Console.WriteLine($"Path found with {path?.Nodes?.Count ?? 0} nodes");
            
            if (path?.Nodes != null)
            {
                foreach (var node in path.Nodes)
                {
                    Console.WriteLine($"  Node: ({node.X}, {node.Y})");
                }
            }
        }
        
        [Fact]
        public void E2E_VehiclePool_AcquireAndInitialize()
        {
            var gameSettings = new GameSettings();
            var pool = new VehiclePool(5, 20, gameSettings);
            var vehicle = pool.Acquire();
            
            Assert.NotNull(vehicle);
            Assert.Equal(VehicleState.Idle, vehicle.State);
            
            vehicle.Initialize(new Vector2Int(5, 5));
            Console.WriteLine($"Vehicle initialized at tile (5,5)");
            Console.WriteLine($"Vehicle world position: {vehicle.Position}");
            Console.WriteLine($"Expected world position: ({5 * 32 + 16}, {5 * 32 + 16})");
            
            Assert.Equal(5 * 32 + 16, vehicle.Position.X);
            Assert.Equal(5 * 32 + 16, vehicle.Position.Y);
        }
        
        [Fact]
        public void E2E_DeliveryTask_Creation()
        {
            var task = new DeliveryTask(
                1,
                new Vector2Int(0, 0),
                new Vector2Int(5, 0),
                "goods",
                1,
                0f
            );
            
            Assert.Equal(new Vector2Int(0, 0), task.PickupLocation);
            Assert.Equal(new Vector2Int(5, 0), task.DeliveryLocation);
            Console.WriteLine($"Task created: Pickup at {task.PickupLocation}, Deliver to {task.DeliveryLocation}");
        }
    }
}
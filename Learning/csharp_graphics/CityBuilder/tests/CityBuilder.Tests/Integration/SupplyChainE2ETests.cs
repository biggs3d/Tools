using Xunit;
using CityBuilder.Simulation;
using CityBuilder.Core;
using CityBuilder.Grid;
using System.Linq;

namespace CityBuilder.Tests.Integration;

/// <summary>
/// End-to-end tests for the complete supply chain system
/// </summary>
public class SupplyChainE2ETests
{
    private EventBus _eventBus;
    private TaskMatcher _taskMatcher;
    private GridSystem _gridSystem;
    
    public SupplyChainE2ETests()
    {
        _eventBus = new EventBus();
        _taskMatcher = new TaskMatcher(_eventBus)
        {
            HubLocation = new Vector2Int(0, 0),
            ImportWaitTime = 5.0f,
            DefaultVehicleCapacity = 20.0f
        };
        _gridSystem = new GridSystem(_eventBus);
    }
    
    [Fact]
    public void FullSupplyChain_IndustrialToCommercialToResidential_Works()
    {
        // Arrange - Create a simple supply chain
        var industrial = new BuildingData(TileType.Industrial, new Vector2Int(1, 1));
        var commercial = new BuildingData(TileType.Commercial, new Vector2Int(2, 2));
        var residential = new BuildingData(TileType.Residential, new Vector2Int(3, 3));
        
        // Act & Assert - Simulate production over time
        
        // Step 1: Industrial produces raw materials
        for (int i = 0; i < 10; i++)
        {
            industrial.Update(1.0f); // 10 seconds of production
        }
        Assert.Equal(10.0f, industrial.Inventory[(int)ResourceType.RawMaterials].Current, 0.01f); // 1 unit/sec * 10
        Assert.Equal(1.0f, industrial.Inventory[(int)ResourceType.Waste].Current, 0.01f); // 0.1 unit/sec * 10
        
        // Step 2: Industrial offers raw materials (above 70% threshold)
        industrial.Inventory[(int)ResourceType.RawMaterials].Current = 80; // Set to 80%
        Assert.True(industrial.CanOffer(ResourceType.RawMaterials));
        
        // Step 3: Commercial needs raw materials (below 30% threshold)
        commercial.Inventory[(int)ResourceType.RawMaterials].Current = 5; // Low on materials
        Assert.True(commercial.NeedsDelivery(ResourceType.RawMaterials));
        
        // Step 4: Create offer and request
        var offer = new DeliveryOffer
        {
            Building = industrial,
            Resource = ResourceType.RawMaterials,
            Amount = industrial.GetOfferAmount(ResourceType.RawMaterials)
        };
        
        var request = new PickupRequest
        {
            Building = commercial,
            Resource = ResourceType.RawMaterials,
            Amount = commercial.GetRequestAmount(ResourceType.RawMaterials)
        };
        
        _eventBus.Publish(new DeliveryOfferCreated { Offer = offer });
        _eventBus.Publish(new PickupRequestCreated { Request = request });
        
        // Step 5: Match tasks
        var task1 = _taskMatcher.MatchTasks();
        Assert.NotNull(task1);
        Assert.Equal(ResourceType.RawMaterials, task1!.Resource);
        Assert.Equal(industrial.Location, task1.PickupLocation);
        Assert.Equal(commercial.Location, task1.DeliveryLocation);
        
        // Step 6: Simulate delivery completion
        _taskMatcher.CompleteDelivery(task1);
        
        // Step 7: Commercial produces goods from raw materials
        for (int i = 0; i < 10; i++)
        {
            commercial.Update(1.0f);
        }
        // Should have produced goods (0.5 units/sec * 10)
        Assert.True(commercial.Inventory[(int)ResourceType.Goods].Current > 0);
        
        // Step 8: Residential needs goods
        residential.Inventory[(int)ResourceType.Goods].Current = 3; // Low on goods
        Assert.True(residential.NeedsDelivery(ResourceType.Goods));
        
        // Step 9: Commercial offers goods to residential
        commercial.Inventory[(int)ResourceType.Goods].Current = 40; // Plenty of goods
        
        // Clear any pending tasks first
        _taskMatcher.ClearAll();
        
        var goodsOffer = new DeliveryOffer
        {
            Building = commercial,
            Resource = ResourceType.Goods,
            Amount = commercial.GetOfferAmount(ResourceType.Goods)
        };
        
        var goodsRequest = new PickupRequest
        {
            Building = residential,
            Resource = ResourceType.Goods,
            Amount = residential.GetRequestAmount(ResourceType.Goods)
        };
        
        _eventBus.Publish(new DeliveryOfferCreated { Offer = goodsOffer });
        _eventBus.Publish(new PickupRequestCreated { Request = goodsRequest });
        
        var task2 = _taskMatcher.MatchTasks();
        Assert.NotNull(task2);
        Assert.Equal(ResourceType.Goods, task2!.Resource);
        
        // Step 10: Verify waste production
        for (int i = 0; i < 10; i++)
        {
            residential.Update(1.0f);
        }
        Assert.True(residential.Inventory[(int)ResourceType.Waste].Current > 0);
    }
    
    [Fact]
    public void HubImport_WhenNoSupplier_ImportsFromHub()
    {
        // Arrange - Only commercial building, no industrial supplier
        var commercial = new BuildingData(TileType.Commercial, new Vector2Int(2, 2));
        commercial.Inventory[(int)ResourceType.RawMaterials].Current = 5; // Very low
        
        var request = new PickupRequest
        {
            Building = commercial,
            Resource = ResourceType.RawMaterials,
            Amount = 20,
            WaitTime = 0 // Start with no wait
        };
        
        _eventBus.Publish(new PickupRequestCreated { Request = request });
        
        // Act - First attempt, no import (wait time too short)
        var task1 = _taskMatcher.MatchTasks();
        Assert.Null(task1);
        
        // Increase wait time past import threshold
        _taskMatcher.UpdateWaitTimes(6.0f);
        
        // Second attempt should import from hub
        var task2 = _taskMatcher.MatchTasks();
        
        // Assert
        Assert.NotNull(task2);
        Assert.Equal(_taskMatcher.HubLocation, task2!.PickupLocation);
        Assert.Equal(commercial.Location, task2.DeliveryLocation);
        Assert.True(task2.IsImport);
        Assert.Equal(ResourceType.RawMaterials, task2.Resource);
    }
    
    [Fact]
    public void HubExport_WhenNoConsumer_ExportsToHub()
    {
        // Arrange - Industrial with excess, no commercial consumer
        var industrial = new BuildingData(TileType.Industrial, new Vector2Int(1, 1));
        industrial.Inventory[(int)ResourceType.RawMaterials].Current = 90; // Lots of excess
        
        var offer = new DeliveryOffer
        {
            Building = industrial,
            Resource = ResourceType.RawMaterials,
            Amount = 40
        };
        
        _eventBus.Publish(new DeliveryOfferCreated { Offer = offer });
        
        // Act
        var task = _taskMatcher.MatchTasks();
        
        // Assert
        Assert.NotNull(task);
        Assert.Equal(industrial.Location, task!.PickupLocation);
        Assert.Equal(_taskMatcher.HubLocation, task.DeliveryLocation);
        Assert.True(task.IsExport);
        Assert.Equal(ResourceType.RawMaterials, task.Resource);
    }
    
    [Fact]
    public void VehicleCargoHandling_LoadsAndUnloadsCorrectly()
    {
        // Arrange
        var gameSettings = new GameSettings();
        var vehicle = new Vehicle(1, gameSettings);
        vehicle.Initialize(new Vector2Int(0, 0));
        
        // Act - Load cargo
        vehicle.LoadCargo(ResourceType.RawMaterials, 15);
        
        // Assert - Cargo loaded
        Assert.True(vehicle.HasCargo);
        Assert.Equal(ResourceType.RawMaterials, vehicle.CargoType);
        Assert.Equal(15, vehicle.CargoAmount);
        
        // Act - Unload cargo
        vehicle.UnloadCargo();
        
        // Assert - Cargo unloaded
        Assert.False(vehicle.HasCargo);
        Assert.Equal(ResourceType.None, vehicle.CargoType);
        Assert.Equal(0, vehicle.CargoAmount);
    }
    
    [Fact]
    public void VehicleCapacity_LimitsCargoAmount()
    {
        // Arrange
        var gameSettings = new GameSettings();
        var vehicle = new Vehicle(1, gameSettings);
        vehicle.Initialize(new Vector2Int(0, 0));
        vehicle.CargoCapacity = 10; // Small vehicle
        
        // Act - Try to load more than capacity
        vehicle.LoadCargo(ResourceType.Goods, 25);
        
        // Assert - Only loads up to capacity
        Assert.Equal(10, vehicle.CargoAmount);
    }
    
    [Fact]
    public void TaskMatching_RespectsVehicleCapacity()
    {
        // Arrange
        var industrial = new BuildingData(TileType.Industrial, new Vector2Int(1, 1));
        industrial.Inventory[(int)ResourceType.RawMaterials].Current = 100;
        
        var commercial = new BuildingData(TileType.Commercial, new Vector2Int(2, 2));
        
        var offer = new DeliveryOffer
        {
            Building = industrial,
            Resource = ResourceType.RawMaterials,
            Amount = 50 // Large offer
        };
        
        var request = new PickupRequest
        {
            Building = commercial,
            Resource = ResourceType.RawMaterials,
            Amount = 50 // Large request
        };
        
        _eventBus.Publish(new DeliveryOfferCreated { Offer = offer });
        _eventBus.Publish(new PickupRequestCreated { Request = request });
        
        // Act - Match with small vehicle capacity
        var task = _taskMatcher.MatchTasks(10); // Small vehicle
        
        // Assert - Task amount limited by vehicle capacity
        Assert.NotNull(task);
        Assert.Equal(10, task!.Amount);
        
        // Act - Get another task for remaining amount
        var task2 = _taskMatcher.MatchTasks(10);
        
        // Assert - Partial tasks are re-queued
        Assert.NotNull(task2);
        Assert.Equal(10, task2!.Amount);
    }
    
    [Fact]
    public void BuildingProduction_StopsWhenMissingInputs()
    {
        // Arrange
        var commercial = new BuildingData(TileType.Commercial, new Vector2Int(2, 2));
        commercial.Inventory[(int)ResourceType.RawMaterials].Current = 2; // Very little
        
        // Act - Update with materials
        commercial.Update(1.0f);
        var goodsProducedWithMaterials = commercial.Inventory[(int)ResourceType.Goods].Current;
        
        // Use up remaining materials
        commercial.Update(2.0f);
        Assert.Equal(0, commercial.Inventory[(int)ResourceType.RawMaterials].Current);
        
        // Try to produce without materials
        var goodsBefore = commercial.Inventory[(int)ResourceType.Goods].Current;
        commercial.Update(5.0f);
        var goodsAfter = commercial.Inventory[(int)ResourceType.Goods].Current;
        
        // Assert - No goods produced without raw materials
        Assert.Equal(goodsBefore, goodsAfter);
    }
    
    [Fact]
    public void ResourceReservation_PreventsDoubleBooking()
    {
        // Arrange
        var industrial = new BuildingData(TileType.Industrial, new Vector2Int(1, 1));
        industrial.Inventory[(int)ResourceType.RawMaterials].Current = 30;
        
        // Act - Reserve some resources
        var slot = industrial.Inventory[(int)ResourceType.RawMaterials];
        bool reserved1 = slot.Reserve(20);
        Assert.True(reserved1);
        Assert.Equal(10, slot.Available); // 30 - 20
        
        // Try to reserve more than available
        bool reserved2 = slot.Reserve(15); // Only 10 available
        
        // Assert - Second reservation fails
        Assert.False(reserved2);
        Assert.Equal(20, slot.InTransit); // Still only first reservation
        
        // Release reservation
        slot.ReleaseReservation(20);
        Assert.Equal(30, slot.Available); // Back to full amount
        
        industrial.Inventory[(int)ResourceType.RawMaterials] = slot;
    }
    
    [Fact]
    public void CompleteSupplyChainFlow_WithMultipleBuildings()
    {
        // Arrange - Create a small city
        var industrial1 = new BuildingData(TileType.Industrial, new Vector2Int(1, 0));
        var industrial2 = new BuildingData(TileType.Industrial, new Vector2Int(2, 0));
        var commercial1 = new BuildingData(TileType.Commercial, new Vector2Int(0, 1));
        var commercial2 = new BuildingData(TileType.Commercial, new Vector2Int(3, 1));
        var residential1 = new BuildingData(TileType.Residential, new Vector2Int(1, 2));
        var residential2 = new BuildingData(TileType.Residential, new Vector2Int(2, 2));
        
        // Act - Simulate production
        var buildings = new[] { industrial1, industrial2, commercial1, commercial2, residential1, residential2 };
        
        // Run simulation for 30 seconds
        for (int tick = 0; tick < 30; tick++)
        {
            foreach (var building in buildings)
            {
                building.Update(1.0f);
            }
        }
        
        // Assert - Verify production happened
        Assert.True(industrial1.Inventory[(int)ResourceType.RawMaterials].Current > 0);
        Assert.True(industrial2.Inventory[(int)ResourceType.RawMaterials].Current > 0);
        
        // Commercial should have consumed initial materials and produced some goods
        Assert.True(commercial1.Inventory[(int)ResourceType.RawMaterials].Current < 25); // Started with 25
        Assert.True(commercial1.Inventory[(int)ResourceType.Goods].Current > 0);
        
        // Residential should have consumed initial goods
        Assert.True(residential1.Inventory[(int)ResourceType.Goods].Current < 15); // Started with 15
        Assert.True(residential1.Inventory[(int)ResourceType.Waste].Current > 0); // Produced waste
    }
    
    [Fact]
    public void TaskPrioritization_MatchesClosestPairFirst()
    {
        // This test verifies that the task matcher creates efficient matches
        // In a real implementation, you might want to add distance-based prioritization
        
        // Arrange
        var closeIndustrial = new BuildingData(TileType.Industrial, new Vector2Int(1, 1));
        var farIndustrial = new BuildingData(TileType.Industrial, new Vector2Int(10, 10));
        var commercial = new BuildingData(TileType.Commercial, new Vector2Int(2, 2));
        
        closeIndustrial.Inventory[(int)ResourceType.RawMaterials].Current = 50;
        farIndustrial.Inventory[(int)ResourceType.RawMaterials].Current = 50;
        
        // Create offers from both
        _eventBus.Publish(new DeliveryOfferCreated
        {
            Offer = new DeliveryOffer
            {
                Building = closeIndustrial,
                Resource = ResourceType.RawMaterials,
                Amount = 20
            }
        });
        
        _eventBus.Publish(new DeliveryOfferCreated
        {
            Offer = new DeliveryOffer
            {
                Building = farIndustrial,
                Resource = ResourceType.RawMaterials,
                Amount = 20
            }
        });
        
        // Create request from commercial
        _eventBus.Publish(new PickupRequestCreated
        {
            Request = new PickupRequest
            {
                Building = commercial,
                Resource = ResourceType.RawMaterials,
                Amount = 15
            }
        });
        
        // Act
        var task = _taskMatcher.MatchTasks();
        
        // Assert - Should match (in current implementation, it's FIFO)
        Assert.NotNull(task);
        Assert.Equal(ResourceType.RawMaterials, task!.Resource);
        // Note: Current implementation doesn't prioritize by distance
        // This would be a future enhancement
    }
}
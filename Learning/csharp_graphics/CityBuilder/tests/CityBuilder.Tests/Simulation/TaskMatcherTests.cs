using Xunit;
using CityBuilder.Simulation;
using CityBuilder.Core;
using CityBuilder.Grid;

namespace CityBuilder.Tests.Simulation;

public class TaskMatcherTests
{
    private EventBus _eventBus;
    private TaskMatcher _matcher;
    
    public TaskMatcherTests()
    {
        _eventBus = new EventBus();
        _matcher = new TaskMatcher(_eventBus)
        {
            HubLocation = new Vector2Int(0, 0),
            ImportWaitTime = 5.0f,
            DefaultVehicleCapacity = 20.0f
        };
    }
    
    [Fact]
    public void MatchTasks_MatchesProducerToConsumer()
    {
        // Arrange
        var producer = new BuildingData(TileType.Industrial, new Vector2Int(1, 1));
        producer.Inventory[(int)ResourceType.RawMaterials].Current = 50;
        
        var consumer = new BuildingData(TileType.Commercial, new Vector2Int(2, 2));
        
        var offer = new DeliveryOffer
        {
            Building = producer,
            Resource = ResourceType.RawMaterials,
            Amount = 30
        };
        
        var request = new PickupRequest
        {
            Building = consumer,
            Resource = ResourceType.RawMaterials,
            Amount = 20
        };
        
        _eventBus.Publish(new DeliveryOfferCreated { Offer = offer });
        _eventBus.Publish(new PickupRequestCreated { Request = request });
        
        // Act
        var task = _matcher.MatchTasks();
        
        // Assert
        Assert.NotNull(task);
        Assert.Equal(ResourceType.RawMaterials, task!.Resource);
        Assert.Equal(20, task.Amount); // Min of offer, request, and capacity
        Assert.Equal(producer.Location, task.PickupLocation);
        Assert.Equal(consumer.Location, task.DeliveryLocation);
        Assert.False(task.IsExport);
        Assert.False(task.IsImport);
    }
    
    [Fact]
    public void MatchTasks_RespectsVehicleCapacity()
    {
        // Arrange
        var producer = new BuildingData(TileType.Industrial, new Vector2Int(1, 1));
        producer.Inventory[(int)ResourceType.RawMaterials].Current = 100;
        
        var consumer = new BuildingData(TileType.Commercial, new Vector2Int(2, 2));
        
        var offer = new DeliveryOffer
        {
            Building = producer,
            Resource = ResourceType.RawMaterials,
            Amount = 50
        };
        
        var request = new PickupRequest
        {
            Building = consumer,
            Resource = ResourceType.RawMaterials,
            Amount = 40
        };
        
        _eventBus.Publish(new DeliveryOfferCreated { Offer = offer });
        _eventBus.Publish(new PickupRequestCreated { Request = request });
        
        // Act
        var task = _matcher.MatchTasks(15); // Small vehicle capacity
        
        // Assert
        Assert.NotNull(task);
        Assert.Equal(15, task!.Amount); // Limited by vehicle capacity
    }
    
    [Fact]
    public void MatchTasks_RequeuesPartialTasks()
    {
        // Arrange
        var producer = new BuildingData(TileType.Industrial, new Vector2Int(1, 1));
        producer.Inventory[(int)ResourceType.RawMaterials].Current = 100;
        
        var consumer = new BuildingData(TileType.Commercial, new Vector2Int(2, 2));
        
        var offer = new DeliveryOffer
        {
            Building = producer,
            Resource = ResourceType.RawMaterials,
            Amount = 50
        };
        
        var request = new PickupRequest
        {
            Building = consumer,
            Resource = ResourceType.RawMaterials,
            Amount = 40
        };
        
        _eventBus.Publish(new DeliveryOfferCreated { Offer = offer });
        _eventBus.Publish(new PickupRequestCreated { Request = request });
        
        // Act
        var task1 = _matcher.MatchTasks(15); // Take 15 units
        var task2 = _matcher.MatchTasks(15); // Should match remaining
        
        // Assert
        Assert.NotNull(task1);
        Assert.NotNull(task2);
        Assert.Equal(15, task1!.Amount);
        Assert.Equal(15, task2!.Amount); // Another 15 from remaining
        
        // Third match should get the last bit
        var task3 = _matcher.MatchTasks(15);
        Assert.NotNull(task3);
        Assert.Equal(10, task3!.Amount); // 40 total request - 30 already = 10
    }
    
    [Fact]
    public void MatchTasks_ExportsToHub_WhenNoConsumer()
    {
        // Arrange
        var producer = new BuildingData(TileType.Industrial, new Vector2Int(1, 1));
        producer.Inventory[(int)ResourceType.RawMaterials].Current = 50;
        
        var offer = new DeliveryOffer
        {
            Building = producer,
            Resource = ResourceType.RawMaterials,
            Amount = 30
        };
        
        _eventBus.Publish(new DeliveryOfferCreated { Offer = offer });
        
        // Act
        var task = _matcher.MatchTasks();
        
        // Assert
        Assert.NotNull(task);
        Assert.Equal(ResourceType.RawMaterials, task!.Resource);
        Assert.Equal(20, task.Amount); // Limited by default capacity
        Assert.Equal(producer.Location, task.PickupLocation);
        Assert.Equal(_matcher.HubLocation, task.DeliveryLocation);
        Assert.True(task.IsExport);
        Assert.False(task.IsImport);
    }
    
    [Fact]
    public void MatchTasks_ImportsFromHub_AfterWaitTime()
    {
        // Arrange
        var consumer = new BuildingData(TileType.Commercial, new Vector2Int(2, 2));
        
        var request = new PickupRequest
        {
            Building = consumer,
            Resource = ResourceType.RawMaterials,
            Amount = 25,
            WaitTime = 6.0f // Above import threshold
        };
        
        _eventBus.Publish(new PickupRequestCreated { Request = request });
        
        // Act
        var task = _matcher.MatchTasks();
        
        // Assert
        Assert.NotNull(task);
        Assert.Equal(ResourceType.RawMaterials, task!.Resource);
        Assert.Equal(20, task.Amount); // Limited by default capacity
        Assert.Equal(_matcher.HubLocation, task.PickupLocation);
        Assert.Equal(consumer.Location, task.DeliveryLocation);
        Assert.False(task.IsExport);
        Assert.True(task.IsImport);
    }
    
    [Fact]
    public void MatchTasks_NoImport_BeforeWaitTime()
    {
        // Arrange
        var consumer = new BuildingData(TileType.Commercial, new Vector2Int(2, 2));
        
        var request = new PickupRequest
        {
            Building = consumer,
            Resource = ResourceType.RawMaterials,
            Amount = 25,
            WaitTime = 2.0f // Below import threshold
        };
        
        _eventBus.Publish(new PickupRequestCreated { Request = request });
        
        // Act
        var task = _matcher.MatchTasks();
        
        // Assert
        Assert.Null(task); // No task because wait time too short
    }
    
    [Fact]
    public void UpdateWaitTimes_IncreasesAllWaitTimes()
    {
        // Arrange
        var request = new PickupRequest
        {
            Building = new BuildingData(TileType.Commercial, new Vector2Int(1, 1)),
            Resource = ResourceType.RawMaterials,
            Amount = 25,
            WaitTime = 2.0f
        };
        
        _eventBus.Publish(new PickupRequestCreated { Request = request });
        
        // Act
        _matcher.UpdateWaitTimes(3.5f);
        
        // Now should be eligible for import
        var task = _matcher.MatchTasks();
        
        // Assert
        Assert.NotNull(task);
        Assert.True(task!.IsImport); // Should import after wait time increased
    }
    
    [Fact]
    public void CompleteDelivery_TransfersResources()
    {
        // Arrange
        var producer = new BuildingData(TileType.Industrial, new Vector2Int(1, 1));
        producer.Inventory[(int)ResourceType.RawMaterials].Current = 50;
        producer.Inventory[(int)ResourceType.RawMaterials].InTransit = 20;
        
        var consumer = new BuildingData(TileType.Commercial, new Vector2Int(2, 2));
        consumer.Inventory[(int)ResourceType.RawMaterials].Current = 10;
        consumer.Inventory[(int)ResourceType.RawMaterials].InTransit = 20;
        
        var task = new ResourceDeliveryTask(
            producer.Location,
            consumer.Location,
            ResourceType.RawMaterials,
            20,
            false,
            false,
            producer,
            consumer);
        
        // Act
        _matcher.CompleteDelivery(task);
        
        // Assert
        Assert.Equal(30, producer.Inventory[(int)ResourceType.RawMaterials].Current); // 50 - 20
        Assert.Equal(0, producer.Inventory[(int)ResourceType.RawMaterials].InTransit); // 20 - 20
        Assert.Equal(30, consumer.Inventory[(int)ResourceType.RawMaterials].Current); // 10 + 20
        Assert.Equal(0, consumer.Inventory[(int)ResourceType.RawMaterials].InTransit); // 20 - 20
    }
    
    [Fact]
    public void ReleaseReservation_RestoresAvailability()
    {
        // Arrange
        var producer = new BuildingData(TileType.Industrial, new Vector2Int(1, 1));
        producer.Inventory[(int)ResourceType.RawMaterials].Current = 50;
        producer.Inventory[(int)ResourceType.RawMaterials].InTransit = 20;
        
        var consumer = new BuildingData(TileType.Commercial, new Vector2Int(2, 2));
        consumer.Inventory[(int)ResourceType.RawMaterials].InTransit = 20;
        
        var task = new ResourceDeliveryTask(
            producer.Location,
            consumer.Location,
            ResourceType.RawMaterials,
            20,
            false,
            false,
            producer,
            consumer);
        
        // Act
        _matcher.ReleaseReservation(task);
        
        // Assert
        Assert.Equal(50, producer.Inventory[(int)ResourceType.RawMaterials].Current); // Unchanged
        Assert.Equal(0, producer.Inventory[(int)ResourceType.RawMaterials].InTransit); // Released
        Assert.Equal(0, consumer.Inventory[(int)ResourceType.RawMaterials].InTransit); // Released
    }
    
    [Fact]
    public void GetPendingCounts_ReturnsCorrectCounts()
    {
        // Arrange
        _eventBus.Publish(new DeliveryOfferCreated
        {
            Offer = new DeliveryOffer
            {
                Building = new BuildingData(TileType.Industrial, new Vector2Int(1, 1)),
                Resource = ResourceType.RawMaterials,
                Amount = 10
            }
        });
        
        _eventBus.Publish(new PickupRequestCreated
        {
            Request = new PickupRequest
            {
                Building = new BuildingData(TileType.Commercial, new Vector2Int(2, 2)),
                Resource = ResourceType.Goods,
                Amount = 5
            }
        });
        
        _eventBus.Publish(new PickupRequestCreated
        {
            Request = new PickupRequest
            {
                Building = new BuildingData(TileType.Residential, new Vector2Int(3, 3)),
                Resource = ResourceType.Goods,
                Amount = 3
            }
        });
        
        // Act
        var (requests, offers) = _matcher.GetPendingCounts();
        
        // Assert
        Assert.Equal(2, requests);
        Assert.Equal(1, offers);
    }
    
    [Fact]
    public void ClearAll_RemovesAllPendingTasks()
    {
        // Arrange
        _eventBus.Publish(new DeliveryOfferCreated
        {
            Offer = new DeliveryOffer
            {
                Building = new BuildingData(TileType.Industrial, new Vector2Int(1, 1)),
                Resource = ResourceType.RawMaterials,
                Amount = 10
            }
        });
        
        _eventBus.Publish(new PickupRequestCreated
        {
            Request = new PickupRequest
            {
                Building = new BuildingData(TileType.Commercial, new Vector2Int(2, 2)),
                Resource = ResourceType.Goods,
                Amount = 5
            }
        });
        
        // Act
        _matcher.ClearAll();
        var (requests, offers) = _matcher.GetPendingCounts();
        
        // Assert
        Assert.Equal(0, requests);
        Assert.Equal(0, offers);
    }
}
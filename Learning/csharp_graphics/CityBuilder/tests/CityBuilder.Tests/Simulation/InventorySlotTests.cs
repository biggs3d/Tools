using Xunit;
using CityBuilder.Simulation;

namespace CityBuilder.Tests.Simulation;

public class InventorySlotTests
{
    [Fact]
    public void Produce_IncreasesCurrentByProductionRate()
    {
        // Arrange
        var slot = new InventorySlot
        {
            Current = 10,
            Max = 100,
            ProductionRate = 5.0f
        };
        
        // Act
        slot.Produce(2.0f); // 2 seconds at 5 units/second = 10 units
        
        // Assert
        Assert.Equal(20, slot.Current);
    }
    
    [Fact]
    public void Produce_ClampsToMax()
    {
        // Arrange
        var slot = new InventorySlot
        {
            Current = 95,
            Max = 100,
            ProductionRate = 10.0f
        };
        
        // Act
        slot.Produce(1.0f); // Would produce 10, but should clamp to 100
        
        // Assert
        Assert.Equal(100, slot.Current);
    }
    
    [Fact]
    public void Consume_DecreasesCurrentByConsumptionRate()
    {
        // Arrange
        var slot = new InventorySlot
        {
            Current = 50,
            Max = 100,
            ConsumptionRate = 3.0f
        };
        
        // Act
        slot.Consume(5.0f); // 5 seconds at 3 units/second = 15 units
        
        // Assert
        Assert.Equal(35, slot.Current);
    }
    
    [Fact]
    public void Consume_ClampsToZero()
    {
        // Arrange
        var slot = new InventorySlot
        {
            Current = 5,
            Max = 100,
            ConsumptionRate = 10.0f
        };
        
        // Act
        slot.Consume(1.0f); // Would consume 10, but only have 5
        
        // Assert
        Assert.Equal(0, slot.Current);
    }
    
    [Fact]
    public void Reserve_IncreasesInTransit()
    {
        // Arrange
        var slot = new InventorySlot
        {
            Current = 50,
            InTransit = 0
        };
        
        // Act
        bool success = slot.Reserve(20);
        
        // Assert
        Assert.True(success);
        Assert.Equal(20, slot.InTransit);
        Assert.Equal(30, slot.Available); // 50 - 20
    }
    
    [Fact]
    public void Reserve_FailsWhenInsufficientAvailable()
    {
        // Arrange
        var slot = new InventorySlot
        {
            Current = 50,
            InTransit = 30 // Only 20 available
        };
        
        // Act
        bool success = slot.Reserve(25); // More than available
        
        // Assert
        Assert.False(success);
        Assert.Equal(30, slot.InTransit); // Unchanged
    }
    
    [Fact]
    public void Pickup_RemovesFromCurrentAndInTransit()
    {
        // Arrange
        var slot = new InventorySlot
        {
            Current = 50,
            InTransit = 20
        };
        
        // Act
        bool success = slot.Pickup(15);
        
        // Assert
        Assert.True(success);
        Assert.Equal(35, slot.Current); // 50 - 15
        Assert.Equal(5, slot.InTransit); // 20 - 15
    }
    
    [Fact]
    public void Deliver_AddsToCurrentAndReducesInTransit()
    {
        // Arrange
        var slot = new InventorySlot
        {
            Current = 30,
            Max = 100,
            InTransit = 20
        };
        
        // Act
        slot.Deliver(15);
        
        // Assert
        Assert.Equal(45, slot.Current); // 30 + 15
        Assert.Equal(5, slot.InTransit); // 20 - 15
    }
    
    [Fact]
    public void Deliver_ClampsToMax()
    {
        // Arrange
        var slot = new InventorySlot
        {
            Current = 90,
            Max = 100,
            InTransit = 20
        };
        
        // Act
        slot.Deliver(20); // Would exceed max
        
        // Assert
        Assert.Equal(100, slot.Current); // Clamped to max
        Assert.Equal(0, slot.InTransit); // Still reduced by 20
    }
    
    [Fact]
    public void FillRatio_CalculatesCorrectly()
    {
        // Arrange
        var slot = new InventorySlot
        {
            Current = 25,
            Max = 100
        };
        
        // Assert
        Assert.Equal(0.25f, slot.FillRatio);
    }
    
    [Fact]
    public void EffectiveFillRatio_ConsidersInTransit()
    {
        // Arrange - Consumer scenario
        var consumerSlot = new InventorySlot
        {
            Current = 20,
            Max = 100,
            InTransit = 30, // Incoming
            ConsumptionRate = 1.0f
        };
        
        // Assert - Consumer sees effective as current + incoming
        Assert.Equal(0.5f, consumerSlot.EffectiveFillRatio); // (20 + 30) / 100
        
        // Arrange - Producer scenario
        var producerSlot = new InventorySlot
        {
            Current = 80,
            Max = 100,
            InTransit = 30, // Outgoing
            ProductionRate = 1.0f
        };
        
        // Assert - Producer sees effective as current - outgoing
        Assert.Equal(0.5f, producerSlot.EffectiveFillRatio); // (80 - 30) / 100
    }
    
    [Fact]
    public void ReleaseReservation_ReducesInTransit()
    {
        // Arrange
        var slot = new InventorySlot
        {
            InTransit = 30
        };
        
        // Act
        slot.ReleaseReservation(10);
        
        // Assert
        Assert.Equal(20, slot.InTransit);
    }
    
    [Fact]
    public void ReleaseReservation_ClampsToZero()
    {
        // Arrange
        var slot = new InventorySlot
        {
            InTransit = 5
        };
        
        // Act
        slot.ReleaseReservation(10); // More than in transit
        
        // Assert
        Assert.Equal(0, slot.InTransit); // Clamped to 0
    }
}
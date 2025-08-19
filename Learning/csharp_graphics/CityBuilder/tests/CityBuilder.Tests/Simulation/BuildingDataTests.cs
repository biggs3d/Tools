using Xunit;
using CityBuilder.Simulation;
using CityBuilder.Grid;
using CityBuilder.Core;

namespace CityBuilder.Tests.Simulation;

public class BuildingDataTests
{
    [Fact]
    public void Industrial_ProducesRawMaterials()
    {
        // Arrange
        var building = new BuildingData(TileType.Industrial, new Vector2Int(0, 0));
        
        // Act
        building.Update(10.0f); // 10 seconds
        
        // Assert
        var rawMats = building.Inventory[(int)ResourceType.RawMaterials];
        Assert.Equal(10.0f, rawMats.Current); // 1.0 units/sec * 10 sec
        
        var waste = building.Inventory[(int)ResourceType.Waste];
        Assert.Equal(1.0f, waste.Current); // 0.1 units/sec * 10 sec
    }
    
    [Fact]
    public void Commercial_ConsumesRawMaterials_ProducesGoods()
    {
        // Arrange
        var building = new BuildingData(TileType.Commercial, new Vector2Int(0, 0));
        // Commercial starts with 25 raw materials
        
        // Act
        building.Update(5.0f); // 5 seconds
        
        // Assert
        var rawMats = building.Inventory[(int)ResourceType.RawMaterials];
        Assert.Equal(20.0f, rawMats.Current); // 25 - (1.0 * 5)
        
        var goods = building.Inventory[(int)ResourceType.Goods];
        Assert.Equal(2.5f, goods.Current); // 0.5 units/sec * 5 sec
        
        var waste = building.Inventory[(int)ResourceType.Waste];
        Assert.Equal(0.5f, waste.Current); // 0.1 units/sec * 5 sec
    }
    
    [Fact]
    public void Commercial_StopsProducingGoods_WhenNoRawMaterials()
    {
        // Arrange
        var building = new BuildingData(TileType.Commercial, new Vector2Int(0, 0));
        building.Inventory[(int)ResourceType.RawMaterials].Current = 1; // Very low
        
        // Act
        building.Update(2.0f); // Consume all raw materials
        
        // Assert
        var rawMats = building.Inventory[(int)ResourceType.RawMaterials];
        Assert.Equal(0, rawMats.Current); // All consumed
        
        // Update again with no raw materials
        var goodsBefore = building.Inventory[(int)ResourceType.Goods].Current;
        building.Update(5.0f);
        var goodsAfter = building.Inventory[(int)ResourceType.Goods].Current;
        
        // Goods should not increase when no raw materials
        Assert.Equal(goodsBefore, goodsAfter);
    }
    
    [Fact]
    public void Residential_ConsumesGoods_ProducesWaste()
    {
        // Arrange
        var building = new BuildingData(TileType.Residential, new Vector2Int(0, 0));
        // Residential starts with 15 goods
        
        // Act
        building.Update(10.0f); // 10 seconds
        
        // Assert
        var goods = building.Inventory[(int)ResourceType.Goods];
        Assert.Equal(12.0f, goods.Current); // 15 - (0.3 * 10)
        
        var waste = building.Inventory[(int)ResourceType.Waste];
        Assert.Equal(2.0f, waste.Current); // 0.2 units/sec * 10 sec
    }
    
    [Fact]
    public void Hub_HasInfiniteCapacity()
    {
        // Arrange
        var hub = new BuildingData(TileType.LandingPad, new Vector2Int(0, 0));
        
        // Assert
        for (int i = 1; i < (int)ResourceType.Count; i++)
        {
            Assert.Equal(float.MaxValue, hub.Inventory[i].Max);
            Assert.Equal(1000, hub.Inventory[i].Current); // Start with supply
        }
    }
    
    [Fact]
    public void NeedsDelivery_TrueWhenBelowThreshold()
    {
        // Arrange
        var building = new BuildingData(TileType.Residential, new Vector2Int(0, 0));
        building.RequestThreshold = 0.3f;
        
        // Set goods to 20% (below 30% threshold)
        building.Inventory[(int)ResourceType.Goods].Current = 6; // 20% of 30 max
        
        // Act & Assert
        Assert.True(building.NeedsDelivery(ResourceType.Goods));
    }
    
    [Fact]
    public void NeedsDelivery_FalseWhenAboveThreshold()
    {
        // Arrange
        var building = new BuildingData(TileType.Residential, new Vector2Int(0, 0));
        building.RequestThreshold = 0.3f;
        
        // Goods start at 50% (15 of 30)
        
        // Act & Assert
        Assert.False(building.NeedsDelivery(ResourceType.Goods));
    }
    
    [Fact]
    public void CanOffer_TrueWhenAboveThreshold()
    {
        // Arrange
        var building = new BuildingData(TileType.Industrial, new Vector2Int(0, 0));
        building.OfferThreshold = 0.7f;
        
        // Fill raw materials to 80%
        building.Inventory[(int)ResourceType.RawMaterials].Current = 80; // 80% of 100
        
        // Act & Assert
        Assert.True(building.CanOffer(ResourceType.RawMaterials));
    }
    
    [Fact]
    public void CanOffer_FalseForNonProducedResources()
    {
        // Arrange
        var building = new BuildingData(TileType.Residential, new Vector2Int(0, 0));
        
        // Residential doesn't produce raw materials
        
        // Act & Assert
        Assert.False(building.CanOffer(ResourceType.RawMaterials));
    }
    
    [Fact]
    public void GetRequestAmount_CalculatesCorrectly()
    {
        // Arrange
        var building = new BuildingData(TileType.Residential, new Vector2Int(0, 0));
        var slot = building.Inventory[(int)ResourceType.Goods];
        slot.Current = 6; // 20% of 30 max
        slot.Max = 30;
        building.Inventory[(int)ResourceType.Goods] = slot;
        
        // Act
        float requestAmount = building.GetRequestAmount(ResourceType.Goods);
        
        // Assert
        // Should request enough to reach 80% (24 units) - current (6) = 18
        Assert.Equal(18, requestAmount);
    }
    
    [Fact]
    public void GetOfferAmount_CalculatesCorrectly()
    {
        // Arrange
        var building = new BuildingData(TileType.Industrial, new Vector2Int(0, 0));
        var slot = building.Inventory[(int)ResourceType.RawMaterials];
        slot.Current = 80; // 80% of 100
        slot.Max = 100;
        building.Inventory[(int)ResourceType.RawMaterials] = slot;
        
        // Act
        float offerAmount = building.GetOfferAmount(ResourceType.RawMaterials);
        
        // Assert
        // Should offer excess above 50% (50 units) = 80 - 50 = 30
        Assert.Equal(30, offerAmount);
    }
    
    [Fact]
    public void GetEffectiveInventory_ConsidersInTransit()
    {
        // Arrange
        var building = new BuildingData(TileType.Commercial, new Vector2Int(0, 0));
        var slot = building.Inventory[(int)ResourceType.RawMaterials];
        slot.Current = 20;
        slot.InTransit = 10; // Incoming delivery
        slot.ConsumptionRate = 1.0f; // This is a consumed resource
        building.Inventory[(int)ResourceType.RawMaterials] = slot;
        
        // Act
        float effective = building.GetEffectiveInventory(ResourceType.RawMaterials);
        
        // Assert
        // For consumed resources: current + in transit
        Assert.Equal(30, effective);
    }
    
    [Fact]
    public void Update_ClampsToMaxCapacity()
    {
        // Arrange
        var building = new BuildingData(TileType.Industrial, new Vector2Int(0, 0));
        building.Inventory[(int)ResourceType.RawMaterials].Current = 95;
        
        // Act
        building.Update(10.0f); // Would produce 10 more
        
        // Assert
        var rawMats = building.Inventory[(int)ResourceType.RawMaterials];
        Assert.Equal(100, rawMats.Current); // Clamped to max
    }
    
    [Fact]
    public void HasRequiredInputs_Commercial_NeedsRawMaterials()
    {
        // Arrange
        var building = new BuildingData(TileType.Commercial, new Vector2Int(0, 0));
        
        // Test with raw materials
        building.Inventory[(int)ResourceType.RawMaterials].Current = 10;
        building.Update(1.0f);
        var goodsWithMaterials = building.Inventory[(int)ResourceType.Goods].Current;
        
        // Test without raw materials
        building.Inventory[(int)ResourceType.RawMaterials].Current = 0;
        building.Inventory[(int)ResourceType.Goods].Current = 0;
        building.Update(1.0f);
        var goodsWithoutMaterials = building.Inventory[(int)ResourceType.Goods].Current;
        
        // Assert
        Assert.True(goodsWithMaterials > 0);
        Assert.Equal(0, goodsWithoutMaterials);
    }
}
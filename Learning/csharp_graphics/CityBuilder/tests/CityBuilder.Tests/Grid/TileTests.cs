using Xunit;
using CityBuilder.Grid;

namespace CityBuilder.Tests.Grid;

public class TileTests
{
    [Theory]
    [InlineData(TileType.Road, true)]
    [InlineData(TileType.Highway, true)]
    [InlineData(TileType.Bridge, true)]
    [InlineData(TileType.LandingPad, true)]
    [InlineData(TileType.UndergroundEntrance, true)]
    [InlineData(TileType.Empty, false)]
    [InlineData(TileType.Residential, false)]
    [InlineData(TileType.Commercial, false)]
    [InlineData(TileType.Industrial, false)]
    [InlineData(TileType.Park, false)]
    public void IsWalkable_DerivedCorrectlyFromType(TileType type, bool expectedWalkable)
    {
        // Arrange
        var tile = new Tile { Type = type, NeighborMask = NeighborMask.None };
        
        // Act & Assert
        Assert.Equal(expectedWalkable, tile.IsWalkable);
    }
    
    [Fact]
    public void Empty_StaticTile_HasCorrectProperties()
    {
        // Act
        var empty = Tile.Empty;
        
        // Assert
        Assert.Equal(TileType.Empty, empty.Type);
        Assert.False(empty.IsWalkable);
        Assert.Equal(NeighborMask.None, empty.NeighborMask);
    }
    
    [Fact]
    public void CreateRoad_ReturnsRoadTile()
    {
        // Act
        var road = Tile.CreateRoad();
        
        // Assert
        Assert.Equal(TileType.Road, road.Type);
        Assert.True(road.IsWalkable);
        Assert.Equal(NeighborMask.None, road.NeighborMask);
    }
    
    [Theory]
    [InlineData(TileType.Residential)]
    [InlineData(TileType.Commercial)]
    [InlineData(TileType.Industrial)]
    public void CreateBuilding_ReturnsBuildingTile(TileType buildingType)
    {
        // Act
        var building = Tile.CreateBuilding(buildingType);
        
        // Assert
        Assert.Equal(buildingType, building.Type);
        Assert.False(building.IsWalkable);
        Assert.Equal(NeighborMask.None, building.NeighborMask);
    }
    
    [Fact]
    public void NeighborMask_FlagsWorkCorrectly()
    {
        // Arrange
        var tile = new Tile 
        { 
            Type = TileType.Road, 
            NeighborMask = NeighborMask.North | NeighborMask.East 
        };
        
        // Assert
        Assert.True((tile.NeighborMask & NeighborMask.North) != 0);
        Assert.True((tile.NeighborMask & NeighborMask.East) != 0);
        Assert.False((tile.NeighborMask & NeighborMask.South) != 0);
        Assert.False((tile.NeighborMask & NeighborMask.West) != 0);
    }
    
    [Fact]
    public void TerrainTile_Grass_HasCorrectDefaults()
    {
        // Act
        var grass = TerrainTile.Grass;
        
        // Assert
        Assert.Equal(TerrainType.Grass, grass.Type);
        Assert.Equal(0f, grass.Elevation);
        Assert.Equal(1, grass.MovementCost);
        Assert.True(grass.CanBuild);
    }
}
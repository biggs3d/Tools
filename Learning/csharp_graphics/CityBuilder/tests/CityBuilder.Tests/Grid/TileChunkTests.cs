using Xunit;
using CityBuilder.Grid;
using CityBuilder.Core;

namespace CityBuilder.Tests.Grid;

public class TileChunkTests
{
    [Fact]
    public void Constructor_InitializesWithEmptyTilesAndGrassTerrain()
    {
        // Arrange & Act
        var chunk = new TileChunk(new Vector2Int(0, 0));
        
        // Assert
        Assert.Equal(new Vector2Int(0, 0), chunk.ChunkCoord);
        Assert.False(chunk.HasContent);
        Assert.Equal(0, chunk.TilesFilled);
        
        // Check all tiles are empty
        for (int y = 0; y < TileChunk.Size; y++)
        {
            for (int x = 0; x < TileChunk.Size; x++)
            {
                var tile = chunk.GetTile(x, y);
                Assert.Equal(TileType.Empty, tile.Type);
                
                var terrain = chunk.GetTerrain(x, y);
                Assert.Equal(TerrainType.Grass, terrain.Type);
            }
        }
    }
    
    [Theory]
    [InlineData(0, 0)]
    [InlineData(15, 15)]
    [InlineData(7, 8)]
    public void GetTile_ReturnsCorrectTile(int localX, int localY)
    {
        // Arrange
        var chunk = new TileChunk(new Vector2Int(1, 1));
        var roadTile = Tile.CreateRoad();
        chunk.SetTile(localX, localY, roadTile);
        
        // Act
        var retrievedTile = chunk.GetTile(localX, localY);
        
        // Assert
        Assert.Equal(TileType.Road, retrievedTile.Type);
    }
    
    [Theory]
    [InlineData(-1, 0)]
    [InlineData(0, -1)]
    [InlineData(16, 0)]
    [InlineData(0, 16)]
    public void GetTile_ThrowsForInvalidCoordinates(int localX, int localY)
    {
        // Arrange
        var chunk = new TileChunk(new Vector2Int(0, 0));
        
        // Act & Assert
        Assert.Throws<ArgumentOutOfRangeException>(() => chunk.GetTile(localX, localY));
    }
    
    [Fact]
    public void SetTile_UpdatesTilesFilled()
    {
        // Arrange
        var chunk = new TileChunk(new Vector2Int(0, 0));
        
        // Act - Add tiles
        chunk.SetTile(0, 0, Tile.CreateRoad());
        Assert.Equal(1, chunk.TilesFilled);
        Assert.True(chunk.HasContent);
        
        chunk.SetTile(1, 1, Tile.CreateBuilding(TileType.Residential));
        Assert.Equal(2, chunk.TilesFilled);
        
        // Replace existing tile (count shouldn't change)
        chunk.SetTile(0, 0, Tile.CreateBuilding(TileType.Commercial));
        Assert.Equal(2, chunk.TilesFilled);
        
        // Remove a tile
        chunk.SetTile(1, 1, Tile.Empty);
        Assert.Equal(1, chunk.TilesFilled);
        
        // Remove last tile
        chunk.SetTile(0, 0, Tile.Empty);
        Assert.Equal(0, chunk.TilesFilled);
        Assert.False(chunk.HasContent);
    }
    
    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(1, 0, 1)]
    [InlineData(15, 0, 15)]
    [InlineData(0, 1, 16)]
    [InlineData(15, 15, 255)]
    public void LocalToIndex_ConvertsCorrectly(int localX, int localY, int expectedIndex)
    {
        // Act
        var index = TileChunk.LocalToIndex(localX, localY);
        
        // Assert
        Assert.Equal(expectedIndex, index);
    }
    
    [Theory]
    [InlineData(0, 0, 0)]
    [InlineData(1, 1, 0)]
    [InlineData(15, 15, 0)]
    [InlineData(255, 15, 15)]
    public void IndexToLocal_ConvertsCorrectly(int index, int expectedX, int expectedY)
    {
        // Act
        var (localX, localY) = TileChunk.IndexToLocal(index);
        
        // Assert
        Assert.Equal(expectedX, localX);
        Assert.Equal(expectedY, localY);
    }
    
    [Fact]
    public void SetTerrain_UpdatesTerrainCorrectly()
    {
        // Arrange
        var chunk = new TileChunk(new Vector2Int(0, 0));
        var waterTerrain = new TerrainTile
        {
            Type = TerrainType.Water,
            Elevation = -0.5f,
            MovementCost = 10,
            CanBuild = false
        };
        
        // Act
        chunk.SetTerrain(5, 5, waterTerrain);
        var retrieved = chunk.GetTerrain(5, 5);
        
        // Assert
        Assert.Equal(TerrainType.Water, retrieved.Type);
        Assert.Equal(-0.5f, retrieved.Elevation);
        Assert.Equal(10, retrieved.MovementCost);
        Assert.False(retrieved.CanBuild);
    }
}
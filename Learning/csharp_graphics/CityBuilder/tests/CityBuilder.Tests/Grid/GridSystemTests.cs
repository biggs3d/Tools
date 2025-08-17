using Xunit;
using CityBuilder.Grid;
using CityBuilder.Core;
using System.Numerics;

namespace CityBuilder.Tests.Grid;

public class GridSystemTests
{
    private readonly EventBus _eventBus;
    private readonly GridSystem _gridSystem;
    
    public GridSystemTests()
    {
        _eventBus = new EventBus();
        _gridSystem = new GridSystem(_eventBus);
    }
    
    [Fact]
    public void Constructor_InitializesEmpty()
    {
        // Assert
        Assert.Equal(0, _gridSystem.ChunkCount);
        Assert.Equal(0, _gridSystem.TotalTilesPlaced);
        Assert.Null(_gridSystem.HubLocation);
    }
    
    [Fact]
    public void GetOrCreateChunk_CreatesNewChunk()
    {
        // Act
        var chunk = _gridSystem.GetOrCreateChunk(new Vector2Int(0, 0));
        
        // Assert
        Assert.NotNull(chunk);
        Assert.Equal(new Vector2Int(0, 0), chunk.ChunkCoord);
        Assert.Equal(1, _gridSystem.ChunkCount);
    }
    
    [Fact]
    public void GetOrCreateChunk_ReturnsSameChunkOnSecondCall()
    {
        // Act
        var chunk1 = _gridSystem.GetOrCreateChunk(new Vector2Int(1, 1));
        var chunk2 = _gridSystem.GetOrCreateChunk(new Vector2Int(1, 1));
        
        // Assert
        Assert.Same(chunk1, chunk2);
        Assert.Equal(1, _gridSystem.ChunkCount);
    }
    
    [Theory]
    [InlineData(0, 0, 0, 0, 0, 0, 0)]           // Origin
    [InlineData(32, 32, 1, 1, 0, 1, 1)]         // One tile over
    [InlineData(511, 511, 15, 15, 0, 15, 15)]   // Last tile in chunk 0
    [InlineData(512, 512, 16, 16, 1, 0, 0)]     // First tile in chunk 1
    [InlineData(-1, -1, -1, -1, -1, 15, 15)]    // Negative coordinates
    [InlineData(-32, -32, -1, -1, -1, 15, 15)]  // One tile negative
    [InlineData(-512, -512, -16, -16, -1, 0, 0)]// Full chunk negative
    public void Coordinate_Conversions_WorkCorrectly(
        float worldX, float worldY,
        int expectedTileX, int expectedTileY,
        int expectedChunkX, int expectedLocalX, int expectedLocalY)
    {
        // World to Tile
        var tileCoord = GridSystem.WorldToTile(new Vector2(worldX, worldY));
        Assert.Equal(new Vector2Int(expectedTileX, expectedTileY), tileCoord);
        
        // Tile to Chunk and Local
        var (chunkCoord, localX, localY) = GridSystem.TileToChunkLocal(tileCoord);
        Assert.Equal(new Vector2Int(expectedChunkX, expectedChunkX), chunkCoord);
        Assert.Equal(expectedLocalX, localX);
        Assert.Equal(expectedLocalY, localY);
    }
    
    [Fact]
    public void PlaceTileAt_RequiresHubBeforeRoads()
    {
        // Act - Try to place road without hub
        bool roadPlaced = _gridSystem.PlaceTileAt(new Vector2Int(0, 0), TileType.Road);
        
        // Assert
        Assert.False(roadPlaced);
        Assert.Equal(0, _gridSystem.TotalTilesPlaced);
        
        // Act - Place hub
        bool hubPlaced = _gridSystem.PlaceTileAt(new Vector2Int(0, 0), TileType.LandingPad);
        Assert.True(hubPlaced);
        Assert.Equal(new Vector2Int(0, 0), _gridSystem.HubLocation);
        
        // Act - Now road should work adjacent to hub
        bool roadPlaced2 = _gridSystem.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
        Assert.True(roadPlaced2);
        Assert.Equal(2, _gridSystem.TotalTilesPlaced);
    }
    
    [Fact]
    public void PlaceTileAt_OnlyOneHubAllowed()
    {
        // Arrange - Place first hub
        _gridSystem.PlaceTileAt(new Vector2Int(0, 0), TileType.LandingPad);
        
        // Act - Try to place second hub
        bool secondHub = _gridSystem.PlaceTileAt(new Vector2Int(5, 5), TileType.UndergroundEntrance);
        
        // Assert
        Assert.False(secondHub);
        Assert.Equal(new Vector2Int(0, 0), _gridSystem.HubLocation);
    }
    
    [Fact]
    public void PlaceTileAt_BuildingsRequireAdjacentRoad()
    {
        // Arrange - Place hub and road
        _gridSystem.PlaceTileAt(new Vector2Int(0, 0), TileType.LandingPad);
        _gridSystem.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
        
        // Act - Try to place building not adjacent to road
        bool farBuilding = _gridSystem.PlaceTileAt(new Vector2Int(5, 5), TileType.Residential);
        Assert.False(farBuilding);
        
        // Act - Place building adjacent to road
        bool adjacentBuilding = _gridSystem.PlaceTileAt(new Vector2Int(1, 1), TileType.Residential);
        Assert.True(adjacentBuilding);
    }
    
    [Fact]
    public void RemoveTileAt_CannotRemoveHub()
    {
        // Arrange
        _gridSystem.PlaceTileAt(new Vector2Int(0, 0), TileType.LandingPad);
        
        // Act
        bool removed = _gridSystem.RemoveTileAt(new Vector2Int(0, 0));
        
        // Assert
        Assert.False(removed);
        Assert.NotNull(_gridSystem.HubLocation);
    }
    
    [Fact]
    public void RemoveTileAt_CanRemoveNormalTiles()
    {
        // Arrange
        _gridSystem.PlaceTileAt(new Vector2Int(0, 0), TileType.LandingPad);
        _gridSystem.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
        
        // Act
        bool removed = _gridSystem.RemoveTileAt(new Vector2Int(1, 0));
        
        // Assert
        Assert.True(removed);
        Assert.Equal(1, _gridSystem.TotalTilesPlaced); // Only hub remains
    }
    
    [Fact]
    public void GetTileAt_ReturnsEmptyForUnplacedTiles()
    {
        // Act
        var tile = _gridSystem.GetTileAt(new Vector2Int(10, 10));
        
        // Assert
        Assert.Equal(TileType.Empty, tile.Type);
    }
    
    [Fact]
    public void PlaceTileAt_UpdatesRoadConnections()
    {
        // Arrange - Place hub and connected roads
        _gridSystem.PlaceTileAt(new Vector2Int(0, 0), TileType.LandingPad);
        _gridSystem.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
        _gridSystem.PlaceTileAt(new Vector2Int(2, 0), TileType.Road);
        
        // Act - Check middle road has connections
        var middleRoad = _gridSystem.GetTileAt(new Vector2Int(1, 0));
        
        // Assert
        Assert.True((middleRoad.NeighborMask & NeighborMask.West) != 0); // Connected to hub
        Assert.True((middleRoad.NeighborMask & NeighborMask.East) != 0); // Connected to other road
    }
    
    [Fact]
    public void WorldToChunk_HandlesNegativeCoordinates()
    {
        // Test negative world positions
        var chunk1 = GridSystem.WorldToChunk(new Vector2(-1, -1));
        Assert.Equal(new Vector2Int(-1, -1), chunk1);
        
        var chunk2 = GridSystem.WorldToChunk(new Vector2(-512, -512));
        Assert.Equal(new Vector2Int(-1, -1), chunk2);
        
        var chunk3 = GridSystem.WorldToChunk(new Vector2(-513, -513));
        Assert.Equal(new Vector2Int(-2, -2), chunk3);
    }
    
    [Fact]
    public void Events_AreFiredOnTileOperations()
    {
        // Arrange
        TilePlacedEvent? placedEvent = null;
        TileRemovedEvent? removedEvent = null;
        ChunkCreatedEvent? chunkEvent = null;
        
        _eventBus.Subscribe<TilePlacedEvent>(e => placedEvent = e);
        _eventBus.Subscribe<TileRemovedEvent>(e => removedEvent = e);
        _eventBus.Subscribe<ChunkCreatedEvent>(e => chunkEvent = e);
        
        // Act - Place tile
        _gridSystem.PlaceTileAt(new Vector2Int(0, 0), TileType.LandingPad);
        
        // Assert
        Assert.NotNull(placedEvent);
        Assert.Equal(new Vector2Int(0, 0), placedEvent.TileCoord);
        Assert.Equal(TileType.LandingPad, placedEvent.TileType);
        Assert.NotNull(chunkEvent); // Chunk was created
        
        // Act - Remove tile (place road then remove it)
        _gridSystem.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
        _gridSystem.RemoveTileAt(new Vector2Int(1, 0));
        
        // Assert
        Assert.NotNull(removedEvent);
        Assert.Equal(new Vector2Int(1, 0), removedEvent.TileCoord);
    }
}
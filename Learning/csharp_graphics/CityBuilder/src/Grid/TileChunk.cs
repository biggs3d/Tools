using CityBuilder.Core;

namespace CityBuilder.Grid;

/// <summary>
/// Represents a 16x16 chunk of tiles for efficient storage and rendering
/// </summary>
public class TileChunk
{
    /// <summary>
    /// Size of the chunk in tiles (16x16)
    /// </summary>
    public const int Size = 16;
    
    /// <summary>
    /// Total number of tiles in a chunk
    /// </summary>
    public const int TileCount = Size * Size;
    
    /// <summary>
    /// The chunk's coordinate in chunk space
    /// </summary>
    public Vector2Int ChunkCoord { get; }
    
    /// <summary>
    /// Infrastructure tiles (roads, buildings)
    /// </summary>
    public readonly Tile[] Tiles;
    
    /// <summary>
    /// Terrain tiles (procedurally generated)
    /// </summary>
    public readonly TerrainTile[] Terrain;
    
    /// <summary>
    /// Indicates if this chunk has any non-empty tiles
    /// </summary>
    public bool HasContent { get; private set; }
    
    /// <summary>
    /// Number of non-empty tiles in this chunk
    /// </summary>
    public int TilesFilled { get; private set; }
    
    public TileChunk(Vector2Int chunkCoord)
    {
        ChunkCoord = chunkCoord;
        Tiles = new Tile[TileCount];
        Terrain = new TerrainTile[TileCount];
        HasContent = false;
        TilesFilled = 0;
        
        // Initialize with empty tiles
        for (int i = 0; i < TileCount; i++)
        {
            Tiles[i] = Tile.Empty;
            Terrain[i] = TerrainTile.Grass; // Default terrain
        }
    }
    
    /// <summary>
    /// Gets a tile at the given local coordinates
    /// </summary>
    public Tile GetTile(int localX, int localY)
    {
        ValidateLocalCoordinates(localX, localY);
        return Tiles[localY * Size + localX];
    }
    
    /// <summary>
    /// Sets a tile at the given local coordinates
    /// </summary>
    public void SetTile(int localX, int localY, Tile tile)
    {
        ValidateLocalCoordinates(localX, localY);
        int index = localY * Size + localX;
        
        // Update tile count
        bool wasEmpty = Tiles[index].Type == TileType.Empty;
        bool isEmpty = tile.Type == TileType.Empty;
        
        if (wasEmpty && !isEmpty)
        {
            TilesFilled++;
            HasContent = true;
        }
        else if (!wasEmpty && isEmpty)
        {
            TilesFilled--;
            if (TilesFilled == 0)
                HasContent = false;
        }
        
        Tiles[index] = tile;
    }
    
    /// <summary>
    /// Gets terrain at the given local coordinates
    /// </summary>
    public TerrainTile GetTerrain(int localX, int localY)
    {
        ValidateLocalCoordinates(localX, localY);
        return Terrain[localY * Size + localX];
    }
    
    /// <summary>
    /// Sets terrain at the given local coordinates
    /// </summary>
    public void SetTerrain(int localX, int localY, TerrainTile terrain)
    {
        ValidateLocalCoordinates(localX, localY);
        Terrain[localY * Size + localX] = terrain;
    }
    
    /// <summary>
    /// Converts local chunk coordinates to array index
    /// </summary>
    public static int LocalToIndex(int localX, int localY)
    {
        return localY * Size + localX;
    }
    
    /// <summary>
    /// Converts array index to local chunk coordinates
    /// </summary>
    public static (int localX, int localY) IndexToLocal(int index)
    {
        return (index % Size, index / Size);
    }
    
    /// <summary>
    /// Checks if the given local coordinates are valid
    /// </summary>
    public static bool IsValidLocalCoordinate(int localX, int localY)
    {
        return localX >= 0 && localX < Size && localY >= 0 && localY < Size;
    }
    
    private void ValidateLocalCoordinates(int localX, int localY)
    {
        if (!IsValidLocalCoordinate(localX, localY))
        {
            throw new ArgumentOutOfRangeException(
                $"Local coordinates ({localX}, {localY}) are out of chunk bounds (0-{Size - 1})");
        }
    }
}
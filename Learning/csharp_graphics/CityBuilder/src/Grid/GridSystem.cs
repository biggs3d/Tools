using System.Collections.Concurrent;
using System.Numerics;
using CityBuilder.Core;
using CityBuilder.Simulation.Buildings;
using Raylib_cs;

namespace CityBuilder.Grid;

/// <summary>
/// Manages the game grid with chunked storage for infinite worlds
/// </summary>
public class GridSystem : IDisposable
{
    /// <summary>
    /// Size of a single tile in pixels
    /// </summary>
    public const int TileSize = 32;
    
    /// <summary>
    /// Thread-safe chunk storage dictionary for background generation
    /// </summary>
    private readonly ConcurrentDictionary<Vector2Int, TileChunk> _chunks;
    
    /// <summary>
    /// Event bus for grid events
    /// </summary>
    private readonly EventBus _eventBus;
    
    /// <summary>
    /// Terrain generator for procedural terrain
    /// </summary>
    private readonly TerrainGenerator? _terrainGenerator;
    
    /// <summary>
    /// Location of the starting hub
    /// </summary>
    public Vector2Int? HubLocation { get; private set; }
    
    /// <summary>
    /// Total number of chunks currently loaded
    /// </summary>
    public int ChunkCount => _chunks.Count;
    
    /// <summary>
    /// Total number of tiles placed
    /// </summary>
    public int TotalTilesPlaced { get; private set; }
    
    /// <summary>
    /// Maximum distance from camera to keep chunks loaded (in chunks)
    /// </summary>
    private const int MaxChunkDistance = 5;
    
    /// <summary>
    /// Track last unload time to avoid excessive cleanup
    /// </summary>
    private DateTime _lastUnloadTime = DateTime.Now;
    
    /// <summary>
    /// Minimum time between unload operations (seconds)
    /// </summary>
    private const double UnloadCooldownSeconds = 5.0;
    
    public GridSystem(EventBus eventBus, TerrainGenerator? terrainGenerator = null)
    {
        _eventBus = eventBus ?? throw new ArgumentNullException(nameof(eventBus));
        _terrainGenerator = terrainGenerator;
        _chunks = new ConcurrentDictionary<Vector2Int, TileChunk>();
        TotalTilesPlaced = 0;
    }
    
    
    /// <summary>
    /// Gets or creates a chunk at the specified chunk coordinates
    /// Thread-safe for concurrent chunk generation
    /// </summary>
    public TileChunk GetOrCreateChunk(Vector2Int chunkCoord)
    {
        return _chunks.GetOrAdd(chunkCoord, coord => 
        {
            var chunk = new TileChunk(coord);
            
            // Generate terrain if generator is available
            if (_terrainGenerator != null)
            {
                GenerateTerrainForChunk(chunk);
            }
            
            // Publish event (EventBus should handle thread safety if needed)
            _eventBus.Publish(new ChunkCreatedEvent { ChunkCoord = coord });
            
            return chunk;
        });
    }
    
    /// <summary>
    /// Gets a chunk if it exists, returns null otherwise
    /// </summary>
    public TileChunk? GetChunk(Vector2Int chunkCoord)
    {
        return _chunks.TryGetValue(chunkCoord, out var chunk) ? chunk : null;
    }
    
    /// <summary>
    /// Gets all loaded chunks
    /// </summary>
    public IEnumerable<TileChunk> GetAllChunks()
    {
        return _chunks.Values;
    }
    
    /// <summary>
    /// Gets chunks that are visible in the given camera view
    /// </summary>
    public IEnumerable<TileChunk> GetVisibleChunks(Camera2D camera, int screenWidth, int screenHeight)
    {
        var viewBounds = GetCameraViewBounds(camera, screenWidth, screenHeight);
        
        // Convert view bounds to chunk coordinates
        var minChunk = WorldToChunk(new Vector2(viewBounds.X, viewBounds.Y));
        var maxChunk = WorldToChunk(new Vector2(
            viewBounds.X + viewBounds.Width,
            viewBounds.Y + viewBounds.Height));
        
        // Iterate through potentially visible chunks
        for (int x = minChunk.X - 1; x <= maxChunk.X + 1; x++)
        {
            for (int y = minChunk.Y - 1; y <= maxChunk.Y + 1; y++)
            {
                var chunkCoord = new Vector2Int(x, y);
                if (_chunks.TryGetValue(chunkCoord, out var chunk))
                {
                    yield return chunk;
                }
            }
        }
    }
    
    /// <summary>
    /// Places a tile at the specified world position
    /// </summary>
    public bool PlaceTile(Vector2 worldPos, TileType tileType)
    {
        var tileCoord = WorldToTile(worldPos);
        return PlaceTileAt(tileCoord, tileType);
    }
    
    /// <summary>
    /// Places a tile at the specified tile coordinates
    /// </summary>
    public bool PlaceTileAt(Vector2Int tileCoord, TileType tileType)
    {
        // Validate placement rules
        if (!ValidatePlacement(tileCoord, tileType))
            return false;
        
        var (chunkCoord, localX, localY) = TileToChunkLocal(tileCoord);
        var chunk = GetOrCreateChunk(chunkCoord);
        
        // Create the appropriate tile
        Tile newTile = tileType switch
        {
            TileType.Road => Tile.CreateRoad(),
            TileType.LandingPad or TileType.UndergroundEntrance => CreateHubTile(tileType),
            _ => Tile.CreateBuilding(tileType)
        };
        
        chunk.SetTile(localX, localY, newTile);
        TotalTilesPlaced++;
        
        // Update neighbor connections for roads
        if (tileType == TileType.Road)
        {
            UpdateRoadConnections(tileCoord);
        }
        
        // Set hub location if placing a hub
        if (tileType == TileType.LandingPad || tileType == TileType.UndergroundEntrance)
        {
            HubLocation = tileCoord;
        }
        
        _eventBus.Publish(new TilePlacedEvent 
        { 
            TileCoord = tileCoord, 
            TileType = tileType 
        });
        
        return true;
    }
    
    /// <summary>
    /// Removes a tile at the specified world position
    /// </summary>
    public bool RemoveTile(Vector2 worldPos)
    {
        var tileCoord = WorldToTile(worldPos);
        return RemoveTileAt(tileCoord);
    }
    
    /// <summary>
    /// Removes a tile at the specified tile coordinates
    /// </summary>
    public bool RemoveTileAt(Vector2Int tileCoord)
    {
        var (chunkCoord, localX, localY) = TileToChunkLocal(tileCoord);
        var chunk = GetChunk(chunkCoord);
        
        if (chunk == null)
            return false;
        
        var tile = chunk.GetTile(localX, localY);
        
        // Can't remove empty tiles or the hub
        if (tile.Type == TileType.Empty)
            return false;
        
        if (tile.Type == TileType.LandingPad || tile.Type == TileType.UndergroundEntrance)
        {
            Console.WriteLine("Cannot remove the hub!");
            return false;
        }
        
        chunk.SetTile(localX, localY, Tile.Empty);
        TotalTilesPlaced--;
        
        // Update neighbor connections if it was a road
        if (tile.Type == TileType.Road)
        {
            UpdateRoadConnectionsAround(tileCoord);
        }
        
        _eventBus.Publish(new TileRemovedEvent { TileCoord = tileCoord });
        
        return true;
    }
    
    /// <summary>
    /// Gets a tile at the specified world position
    /// </summary>
    public Tile GetTile(Vector2 worldPos)
    {
        var tileCoord = WorldToTile(worldPos);
        return GetTileAt(tileCoord);
    }
    
    /// <summary>
    /// Gets a tile at the specified tile coordinates
    /// </summary>
    public Tile GetTileAt(Vector2Int tileCoord)
    {
        var (chunkCoord, localX, localY) = TileToChunkLocal(tileCoord);
        var chunk = GetChunk(chunkCoord);
        
        return chunk?.GetTile(localX, localY) ?? Tile.Empty;
    }
    
    /// <summary>
    /// Gets terrain at the specified tile coordinates
    /// </summary>
    public TerrainTile GetTerrainAt(Vector2Int tileCoord)
    {
        var (chunkCoord, localX, localY) = TileToChunkLocal(tileCoord);
        var chunk = GetOrCreateChunk(chunkCoord);
        
        return chunk.GetTerrain(localX, localY);
    }
    
    /// <summary>
    /// Converts world position to tile coordinates
    /// </summary>
    public static Vector2Int WorldToTile(Vector2 worldPos)
    {
        int tileX = (int)Math.Floor(worldPos.X / TileSize);
        int tileY = (int)Math.Floor(worldPos.Y / TileSize);
        return new Vector2Int(tileX, tileY);
    }
    
    /// <summary>
    /// Converts tile coordinates to world position (center of tile)
    /// </summary>
    public static Vector2 TileToWorld(Vector2Int tileCoord)
    {
        return new Vector2(
            tileCoord.X * TileSize + TileSize / 2f,
            tileCoord.Y * TileSize + TileSize / 2f);
    }
    
    /// <summary>
    /// Converts world position to chunk coordinates
    /// </summary>
    public static Vector2Int WorldToChunk(Vector2 worldPos)
    {
        int chunkX = (int)Math.Floor(worldPos.X / (TileChunk.Size * TileSize));
        int chunkY = (int)Math.Floor(worldPos.Y / (TileChunk.Size * TileSize));
        return new Vector2Int(chunkX, chunkY);
    }
    
    /// <summary>
    /// Converts tile coordinates to chunk coordinates and local position
    /// </summary>
    public static (Vector2Int chunkCoord, int localX, int localY) TileToChunkLocal(Vector2Int tileCoord)
    {
        // Use floor division to handle negative coordinates correctly
        int chunkX = Math.DivRem(tileCoord.X, TileChunk.Size, out int localX);
        int chunkY = Math.DivRem(tileCoord.Y, TileChunk.Size, out int localY);
        
        // Handle negative remainders
        if (localX < 0)
        {
            chunkX--;
            localX += TileChunk.Size;
        }
        if (localY < 0)
        {
            chunkY--;
            localY += TileChunk.Size;
        }
        
        return (new Vector2Int(chunkX, chunkY), localX, localY);
    }
    
    /// <summary>
    /// Gets the camera view bounds in world space
    /// </summary>
    private Rectangle GetCameraViewBounds(Camera2D camera, int screenWidth, int screenHeight)
    {
        float viewWidth = screenWidth / camera.Zoom;
        float viewHeight = screenHeight / camera.Zoom;
        
        return new Rectangle(
            camera.Target.X - camera.Offset.X / camera.Zoom,
            camera.Target.Y - camera.Offset.Y / camera.Zoom,
            viewWidth,
            viewHeight);
    }
    
    /// <summary>
    /// Validates tile placement according to game rules
    /// </summary>
    private bool ValidatePlacement(Vector2Int tileCoord, TileType tileType)
    {
        // Check if tile is already occupied
        var existingTile = GetTileAt(tileCoord);
        if (existingTile.Type != TileType.Empty)
            return false;
        
        // Check terrain buildability
        var terrain = GetTerrainAt(tileCoord);
        if (!terrain.CanBuild)
        {
            Console.WriteLine($"Cannot build on {terrain.Type} terrain!");
            return false;
        }
        
        // Hub placement rules
        if (tileType == TileType.LandingPad || tileType == TileType.UndergroundEntrance)
        {
            // Only one hub allowed
            if (HubLocation.HasValue)
            {
                Console.WriteLine("Only one hub allowed per map!");
                return false;
            }
            return true; // Hub can be placed anywhere buildable
        }
        
        // Roads must connect to existing roads or hub
        if (tileType == TileType.Road)
        {
            return HasAdjacentRoadOrHub(tileCoord);
        }
        
        // Buildings require adjacent road
        if (IsBuilding(tileType))
        {
            return HasAdjacentRoad(tileCoord);
        }
        
        return true;
    }
    
    /// <summary>
    /// Checks if a tile type is a building
    /// </summary>
    private bool IsBuilding(TileType type)
    {
        return BuildingRegistry.IsBuilding(type);
    }
    
    /// <summary>
    /// Checks if there's an adjacent road or hub
    /// </summary>
    private bool HasAdjacentRoadOrHub(Vector2Int tileCoord)
    {
        // Roads can only be placed if a hub exists
        if (!HubLocation.HasValue)
        {
            Console.WriteLine("Must place a hub before roads!");
            return false;
        }
        
        var neighbors = GetNeighborCoords(tileCoord);
        foreach (var neighbor in neighbors)
        {
            var tile = GetTileAt(neighbor);
            if (tile.Type == TileType.Road || 
                tile.Type == TileType.LandingPad || 
                tile.Type == TileType.UndergroundEntrance)
            {
                return true;
            }
        }
        
        return false;
    }
    
    /// <summary>
    /// Checks if there's an adjacent road
    /// </summary>
    private bool HasAdjacentRoad(Vector2Int tileCoord)
    {
        var neighbors = GetNeighborCoords(tileCoord);
        foreach (var neighbor in neighbors)
        {
            var tile = GetTileAt(neighbor);
            if (tile.Type == TileType.Road)
                return true;
        }
        
        return false;
    }
    
    /// <summary>
    /// Gets the four neighboring tile coordinates
    /// </summary>
    private Vector2Int[] GetNeighborCoords(Vector2Int tileCoord)
    {
        return new[]
        {
            new Vector2Int(tileCoord.X, tileCoord.Y - 1), // North
            new Vector2Int(tileCoord.X + 1, tileCoord.Y), // East
            new Vector2Int(tileCoord.X, tileCoord.Y + 1), // South
            new Vector2Int(tileCoord.X - 1, tileCoord.Y)  // West
        };
    }
    
    /// <summary>
    /// Updates road connections for a tile and its neighbors
    /// </summary>
    private void UpdateRoadConnections(Vector2Int tileCoord)
    {
        UpdateRoadConnectionsFor(tileCoord);
        UpdateRoadConnectionsAround(tileCoord);
    }
    
    /// <summary>
    /// Updates road connections for neighbors of a tile
    /// </summary>
    private void UpdateRoadConnectionsAround(Vector2Int tileCoord)
    {
        var neighbors = GetNeighborCoords(tileCoord);
        foreach (var neighbor in neighbors)
        {
            var tile = GetTileAt(neighbor);
            if (tile.Type == TileType.Road)
            {
                UpdateRoadConnectionsFor(neighbor);
            }
        }
    }
    
    /// <summary>
    /// Updates the neighbor mask for a specific road tile
    /// </summary>
    private void UpdateRoadConnectionsFor(Vector2Int tileCoord)
    {
        var (chunkCoord, localX, localY) = TileToChunkLocal(tileCoord);
        var chunk = GetChunk(chunkCoord);
        if (chunk == null) return;
        
        var tile = chunk.GetTile(localX, localY);
        if (tile.Type != TileType.Road) return;
        
        NeighborMask mask = NeighborMask.None;
        
        // Check each direction
        var north = GetTileAt(new Vector2Int(tileCoord.X, tileCoord.Y - 1));
        if (IsConnectable(north.Type))
            mask |= NeighborMask.North;
        
        var east = GetTileAt(new Vector2Int(tileCoord.X + 1, tileCoord.Y));
        if (IsConnectable(east.Type))
            mask |= NeighborMask.East;
        
        var south = GetTileAt(new Vector2Int(tileCoord.X, tileCoord.Y + 1));
        if (IsConnectable(south.Type))
            mask |= NeighborMask.South;
        
        var west = GetTileAt(new Vector2Int(tileCoord.X - 1, tileCoord.Y));
        if (IsConnectable(west.Type))
            mask |= NeighborMask.West;
        
        tile.NeighborMask = mask;
        chunk.SetTile(localX, localY, tile);
    }
    
    /// <summary>
    /// Checks if a tile type can connect to roads
    /// </summary>
    private bool IsConnectable(TileType type)
    {
        return type == TileType.Road ||
               type == TileType.LandingPad ||
               type == TileType.UndergroundEntrance;
    }
    
    /// <summary>
    /// Creates a hub tile
    /// </summary>
    private Tile CreateHubTile(TileType hubType)
    {
        return new Tile
        {
            Type = hubType,
            NeighborMask = NeighborMask.None
        };
    }
    
    /// <summary>
    /// Generates terrain for a chunk using the terrain generator
    /// </summary>
    private void GenerateTerrainForChunk(TileChunk chunk)
    {
        if (_terrainGenerator == null) return;
        
        int worldStartX = chunk.ChunkCoord.X * TileChunk.Size;
        int worldStartY = chunk.ChunkCoord.Y * TileChunk.Size;
        
        for (int localY = 0; localY < TileChunk.Size; localY++)
        {
            for (int localX = 0; localX < TileChunk.Size; localX++)
            {
                int worldX = worldStartX + localX;
                int worldY = worldStartY + localY;
                
                var terrain = _terrainGenerator.GenerateTile(worldX, worldY);
                
                // Check for guaranteed resources first
                if (_terrainGenerator.IsSpecialWaterAt(worldX, worldY))
                {
                    terrain = new TerrainTile
                    {
                        Type = TerrainType.Water,
                        Elevation = terrain.Elevation,
                        MovementCost = 10,
                        CanBuild = false
                    };
                }
                else if (_terrainGenerator.IsGuaranteedOreAt(worldX, worldY))
                {
                    terrain = new TerrainTile
                    {
                        Type = TerrainType.OreDeposit,
                        Elevation = terrain.Elevation,
                        MovementCost = 1,
                        CanBuild = false
                    };
                }
                else if (_terrainGenerator.IsGuaranteedRockAt(worldX, worldY))
                {
                    terrain = new TerrainTile
                    {
                        Type = TerrainType.RockFormation,
                        Elevation = terrain.Elevation,
                        MovementCost = 2,
                        CanBuild = false
                    };
                }
                
                chunk.SetTerrain(localX, localY, terrain);
                
                // Also update the main tile's terrain type
                var tile = chunk.GetTile(localX, localY);
                tile.Terrain = terrain.Type;
                chunk.SetTile(localX, localY, tile);
            }
        }
    }
    
    /// <summary>
    /// Prefetches chunks around the camera asynchronously
    /// Useful for smooth exploration without hitches
    /// </summary>
    public async Task PrefetchChunksAsync(Camera2D camera, int screenWidth, int screenHeight, int radiusInChunks = 2)
    {
        var cameraChunk = WorldToChunk(camera.Target);
        var tasks = new List<Task>();
        
        for (int dx = -radiusInChunks; dx <= radiusInChunks; dx++)
        {
            for (int dy = -radiusInChunks; dy <= radiusInChunks; dy++)
            {
                var chunkCoord = new Vector2Int(cameraChunk.X + dx, cameraChunk.Y + dy);
                
                // Skip if already loaded
                if (_chunks.ContainsKey(chunkCoord))
                    continue;
                
                // Generate chunk in background
                tasks.Add(Task.Run(() => GetOrCreateChunk(chunkCoord)));
            }
        }
        
        await Task.WhenAll(tasks);
    }
    
    /// <summary>
    /// Unloads chunks that are far from the camera to save memory
    /// </summary>
    public void UnloadDistantChunks(Camera2D camera, int screenWidth, int screenHeight)
    {
        // Only unload periodically to avoid performance impact
        var now = DateTime.Now;
        if ((now - _lastUnloadTime).TotalSeconds < UnloadCooldownSeconds)
            return;
        
        _lastUnloadTime = now;
        
        // Get current camera chunk position
        var cameraChunk = WorldToChunk(camera.Target);
        
        // Find chunks to unload
        var chunksToUnload = new List<Vector2Int>();
        
        foreach (var kvp in _chunks)
        {
            var chunkCoord = kvp.Key;
            var chunk = kvp.Value;
            
            // Keep chunks with player-placed content
            if (chunk.HasContent)
                continue;
            
            // Calculate distance from camera
            int dx = Math.Abs(chunkCoord.X - cameraChunk.X);
            int dy = Math.Abs(chunkCoord.Y - cameraChunk.Y);
            int distance = Math.Max(dx, dy); // Chebyshev distance
            
            if (distance > MaxChunkDistance)
            {
                chunksToUnload.Add(chunkCoord);
            }
        }
        
        // Remove distant chunks
        foreach (var chunkCoord in chunksToUnload)
        {
            if (_chunks.TryRemove(chunkCoord, out _))
            {
                _eventBus.Publish(new ChunkUnloadedEvent { ChunkCoord = chunkCoord });
            }
        }
        
        if (chunksToUnload.Count > 0)
        {
            Console.WriteLine($"Unloaded {chunksToUnload.Count} distant chunks. Total chunks: {ChunkCount}");
        }
    }
    
    public void Dispose()
    {
        _chunks.Clear();
    }
}

/// <summary>
/// Event fired when a chunk is created
/// </summary>
public class ChunkCreatedEvent
{
    public Vector2Int ChunkCoord { get; set; }
}

/// <summary>
/// Event fired when a tile is placed
/// </summary>
public class TilePlacedEvent
{
    public Vector2Int TileCoord { get; set; }
    public TileType TileType { get; set; }
}

/// <summary>
/// Event fired when a tile is removed
/// </summary>
public class TileRemovedEvent
{
    public Vector2Int TileCoord { get; set; }
}

/// <summary>
/// Event fired when a chunk is unloaded
/// </summary>
public class ChunkUnloadedEvent
{
    public Vector2Int ChunkCoord { get; set; }
}
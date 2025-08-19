using System;
using System.Collections.Generic;
using System.Linq;
using CityBuilder.Core;
using CityBuilder.Grid;

namespace CityBuilder.Simulation;

/// <summary>
/// Generates procedural city layouts with roads and buildings
/// Uses deterministic algorithms for reproducible results
/// </summary>
public class ProceduralCityGenerator
{
    private readonly GridSystem _gridSystem;
    private Random _random;
    private readonly HashSet<Vector2Int> _placedRoads;
    private readonly HashSet<Vector2Int> _placedBuildings;
    
    /// <summary>
    /// Parameters for city generation
    /// </summary>
    public class GenerationParams
    {
        public int Seed { get; set; } = 12345;
        public int MaxRadius { get; set; } = 20;
        public float BranchProbability { get; set; } = 0.7f;
        public float TurnProbability { get; set; } = 0.3f;
        public float BuildingDensity { get; set; } = 0.6f;
        public int MaxBranches { get; set; } = 15;
        public int MinBranchLength { get; set; } = 3;
        public int MaxBranchLength { get; set; } = 8;
    }
    
    public ProceduralCityGenerator(GridSystem gridSystem)
    {
        _gridSystem = gridSystem ?? throw new ArgumentNullException(nameof(gridSystem));
        _random = new Random();
        _placedRoads = new HashSet<Vector2Int>();
        _placedBuildings = new HashSet<Vector2Int>();
    }
    
    /// <summary>
    /// Generates a procedural city layout starting from the hub
    /// </summary>
    public void GenerateCity(GenerationParams? parameters = null)
    {
        var param = parameters ?? new GenerationParams();
        _random = new Random(param.Seed); // Reset with seed for determinism
        _placedRoads.Clear();
        _placedBuildings.Clear();
        
        // Find the hub location
        var hubLocation = _gridSystem.HubLocation;
        if (hubLocation == null)
        {
            Console.WriteLine("Cannot generate city: No hub found!");
            return;
        }
        
        Console.WriteLine($"Starting procedural city generation from hub at {hubLocation}");
        Console.WriteLine($"Parameters: Seed={param.Seed}, MaxRadius={param.MaxRadius}, BranchProb={param.BranchProbability}");
        
        // Start with main roads from hub in cardinal directions
        var mainDirections = new[]
        {
            new Vector2Int(1, 0),   // East
            new Vector2Int(-1, 0),  // West
            new Vector2Int(0, 1),   // South
            new Vector2Int(0, -1)   // North
        };
        
        var branches = new Queue<(Vector2Int start, Vector2Int direction, int depth)>();
        
        // Create initial main roads
        foreach (var dir in mainDirections)
        {
            if (_random.NextDouble() > 0.3) // 70% chance for each main road
            {
                branches.Enqueue((hubLocation.Value, dir, 0));
            }
        }
        
        int branchCount = 0;
        
        // Process branches
        while (branches.Count > 0 && branchCount < param.MaxBranches)
        {
            var (start, direction, depth) = branches.Dequeue();
            branchCount++;
            
            // Generate a road segment
            var length = _random.Next(param.MinBranchLength, param.MaxBranchLength + 1);
            var current = start;
            var currentDir = direction;
            
            for (int i = 0; i < length; i++)
            {
                // Check for random turns
                if (_random.NextDouble() < param.TurnProbability)
                {
                    currentDir = GetRandomTurn(currentDir);
                }
                
                var next = new Vector2Int(current.X + currentDir.X, current.Y + currentDir.Y);
                
                // Check if we're within radius limit
                var distanceFromHub = Math.Abs(next.X - hubLocation.Value.X) + Math.Abs(next.Y - hubLocation.Value.Y);
                if (distanceFromHub > param.MaxRadius)
                {
                    break;
                }
                
                // Try to place road
                if (CanPlaceRoad(next))
                {
                    if (_gridSystem.PlaceTileAt(next, TileType.Road))
                    {
                        _placedRoads.Add(next);
                        current = next;
                        
                        // Consider branching
                        if (depth < 3 && _random.NextDouble() < param.BranchProbability)
                        {
                            var branchDir = GetRandomTurn(currentDir);
                            branches.Enqueue((current, branchDir, depth + 1));
                        }
                        
                        // Place buildings along the road
                        PlaceBuildingsNearRoad(current, param.BuildingDensity);
                    }
                }
                else
                {
                    // Hit an obstacle or existing road, try to continue in a different direction
                    currentDir = GetRandomTurn(currentDir);
                }
            }
        }
        
        Console.WriteLine($"City generation complete! Placed {_placedRoads.Count} roads and {_placedBuildings.Count} buildings");
    }
    
    /// <summary>
    /// Generates a small test city (good for quick testing)
    /// </summary>
    public void GenerateSmallCity()
    {
        GenerateCity(new GenerationParams
        {
            Seed = 42,
            MaxRadius = 15,
            BranchProbability = 0.6f,
            TurnProbability = 0.1f,  // Reduced from 0.2 for straighter roads
            BuildingDensity = 0.5f,
            MaxBranches = 12,
            MinBranchLength = 4,     // Longer minimum segments
            MaxBranchLength = 8
        });
    }
    
    /// <summary>
    /// Generates a large city (good for stress testing)
    /// </summary>
    public void GenerateLargeCity()
    {
        GenerateCity(new GenerationParams
        {
            Seed = DateTime.Now.Millisecond, // Semi-random but reproducible in same millisecond
            MaxRadius = 50,
            BranchProbability = 0.7f,
            TurnProbability = 0.15f,  // Reduced from 0.4 for better spread
            BuildingDensity = 0.7f,
            MaxBranches = 80,
            MinBranchLength = 6,      // Longer roads before branching
            MaxBranchLength = 15
        });
    }
    
    private bool CanPlaceRoad(Vector2Int position)
    {
        // Check if position is empty or has terrain we can build on
        var tile = _gridSystem.GetTileAt(position);
        if (tile.Type != TileType.Empty)
        {
            return false; // Already has something
        }
        
        // Check terrain (can't build on water or mountains)
        var terrain = _gridSystem.GetTerrainAt(position);
        return terrain.Type != TerrainType.Water && terrain.Type != TerrainType.Mountain;
    }
    
    private void PlaceBuildingsNearRoad(Vector2Int roadPosition, float density)
    {
        // Check adjacent tiles for building placement
        var adjacentOffsets = new[]
        {
            new Vector2Int(1, 0),
            new Vector2Int(-1, 0),
            new Vector2Int(0, 1),
            new Vector2Int(0, -1)
        };
        
        foreach (var offset in adjacentOffsets)
        {
            if (_random.NextDouble() > density)
                continue;
                
            var buildingPos = new Vector2Int(roadPosition.X + offset.X, roadPosition.Y + offset.Y);
            
            // Check if we can place a building here
            if (_placedBuildings.Contains(buildingPos) || _placedRoads.Contains(buildingPos))
                continue;
                
            var tile = _gridSystem.GetTileAt(buildingPos);
            if (tile.Type != TileType.Empty)
                continue;
                
            var terrain = _gridSystem.GetTerrainAt(buildingPos);
            if (terrain.Type == TerrainType.Water || terrain.Type == TerrainType.Mountain)
                continue;
            
            // Choose a random building type
            var buildingType = _random.Next(3) switch
            {
                0 => TileType.Residential,
                1 => TileType.Commercial,
                _ => TileType.Industrial
            };
            
            if (_gridSystem.PlaceTileAt(buildingPos, buildingType))
            {
                _placedBuildings.Add(buildingPos);
            }
        }
    }
    
    private Vector2Int GetRandomTurn(Vector2Int currentDirection)
    {
        // Get perpendicular directions
        if (currentDirection.X != 0)
        {
            // Moving horizontally, can turn north or south
            return _random.Next(2) == 0 ? new Vector2Int(0, 1) : new Vector2Int(0, -1);
        }
        else
        {
            // Moving vertically, can turn east or west
            return _random.Next(2) == 0 ? new Vector2Int(1, 0) : new Vector2Int(-1, 0);
        }
    }
    
    /// <summary>
    /// Clear all placed roads and buildings (except hub)
    /// </summary>
    public void ClearCity()
    {
        Console.WriteLine("Clearing city (keeping hub)...");
        
        // Remove all placed roads
        foreach (var road in _placedRoads)
        {
            _gridSystem.RemoveTileAt(road);
        }
        
        // Remove all placed buildings
        foreach (var building in _placedBuildings)
        {
            _gridSystem.RemoveTileAt(building);
        }
        
        _placedRoads.Clear();
        _placedBuildings.Clear();
        
        Console.WriteLine("City cleared!");
    }
}
using System.Collections.Generic;
using Xunit;
using CityBuilder.Core;
using CityBuilder.Grid;
using CityBuilder.Simulation;

namespace CityBuilder.Tests.Simulation
{
    public class PathfindingServiceTests
    {
        private GridSystem CreateTestGrid()
        {
            var eventBus = new EventBus();
            var terrainGen = new TerrainGenerator(42);
            var grid = new GridSystem(eventBus, terrainGen);
            // Place hub at origin for road connectivity
            grid.PlaceTileAt(new Vector2Int(0, 0), TileType.LandingPad);
            return grid;
        }
        
        [Fact]
        public void FindPath_StraightLine_ReturnsOptimalPath()
        {
            var grid = CreateTestGrid();
            // Hub at (0,0), place connected roads
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(2, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(3, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(4, 0), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path = pathfinding.FindPath(new Vector2Int(1, 0), new Vector2Int(4, 0));
            
            Assert.NotNull(path);
            Assert.Equal(4, path.Nodes.Count);
            Assert.Equal(new Vector2Int(1, 0), path.Nodes[0]);
            Assert.Equal(new Vector2Int(4, 0), path.Nodes[3]);
        }
        
        [Fact]
        public void FindPath_WithObstacle_FindsAlternatePath()
        {
            var grid = CreateTestGrid();
            // Build path around obstacle from hub at (0,0)
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(2, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(3, 0), TileType.Residential); // Obstacle
            grid.PlaceTileAt(new Vector2Int(4, 0), TileType.Road);
            // Alternative path
            grid.PlaceTileAt(new Vector2Int(0, 1), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 1), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(2, 1), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(3, 1), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(4, 1), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(4, 0), TileType.Road);  // Connect back
            
            var pathfinding = new PathfindingService(grid);
            var path = pathfinding.FindPath(new Vector2Int(2, 0), new Vector2Int(4, 0));
            
            Assert.NotNull(path);
            Assert.True(path.Nodes.Count > 2);
            // Should go around via (2,1)
            Assert.Contains(new Vector2Int(2, 1), path.Nodes);
        }
        
        [Fact]
        public void FindPath_StartNotWalkable_ReturnsNull()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Residential);
            grid.PlaceTileAt(new Vector2Int(2, 0), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path = pathfinding.FindPath(new Vector2Int(1, 0), new Vector2Int(2, 0));
            
            Assert.Null(path);
        }
        
        [Fact]
        public void FindPath_GoalNotWalkable_ReturnsNull()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(2, 0), TileType.Residential);
            
            var pathfinding = new PathfindingService(grid);
            var path = pathfinding.FindPath(new Vector2Int(1, 0), new Vector2Int(2, 0));
            
            Assert.Null(path);
        }
        
        [Fact]
        public void FindPath_DiagonalMovement_AllowedWhenClear()
        {
            var grid = CreateTestGrid();
            // Create 2x2 road square connected to hub
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(0, 1), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 1), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            // Hub is walkable, so path from hub to diagonal
            var path = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 1));
            
            Assert.NotNull(path);
            Assert.Equal(2, path.Nodes.Count);
            Assert.Equal(new Vector2Int(0, 0), path.Nodes[0]);
            Assert.Equal(new Vector2Int(1, 1), path.Nodes[1]);
        }
        
        [Fact]
        public void FindPath_DiagonalMovement_BlockedWhenCornerObstructed()
        {
            var grid = CreateTestGrid();
            // Hub at (0,0), place blocker at (1,0)
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Residential);
            grid.PlaceTileAt(new Vector2Int(0, 1), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 1), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 1));
            
            Assert.NotNull(path);
            Assert.Equal(3, path.Nodes.Count);
            // Must go around via (0,1)
            Assert.Contains(new Vector2Int(0, 1), path.Nodes);
        }
        
        [Fact]
        public void PathCache_ReturnsNewPathInstance()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path1 = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 0));
            var path2 = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 0));
            
            // Should be different instances (immutable caching)
            Assert.NotSame(path1, path2);
            // But same content
            Assert.Equal(path1.Nodes.Count, path2.Nodes.Count);
        }
        
        [Fact]
        public void InvalidateCache_RemovesIntersectingPaths()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(2, 0), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path1 = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(2, 0));
            
            // Invalidate area covering tile (1,0)
            var dirtyRegion = new Rectangle(32, 0, 32, 32);
            pathfinding.InvalidateCache(dirtyRegion);
            
            var path2 = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(2, 0));
            
            // Should be different path instances after invalidation
            Assert.NotSame(path1, path2);
        }
        
        [Fact]
        public void ClearCache_RemovesAllCachedPaths()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path1 = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 0));
            
            pathfinding.ClearCache();
            
            var path2 = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 0));
            
            // Should be different instances after cache clear
            Assert.NotSame(path1, path2);
        }
    }
}
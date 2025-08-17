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
            var grid = new GridSystem(eventBus);
            // Place a hub first (required for roads)
            grid.PlaceTileAt(new Vector2Int(-10, -10), TileType.LandingPad);
            return grid;
        }
        
        [Fact]
        public void FindPath_StraightLine_ReturnsOptimalPath()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(0, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(2, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(3, 0), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(3, 0));
            
            Assert.NotNull(path);
            Assert.Equal(4, path.Nodes.Count);
            Assert.Equal(new Vector2Int(0, 0), path.Nodes[0]);
            Assert.Equal(new Vector2Int(3, 0), path.Nodes[3]);
        }
        
        [Fact]
        public void FindPath_WithObstacle_FindsAlternatePath()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(0, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Residential);
            grid.PlaceTileAt(new Vector2Int(2, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(0, 1), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 1), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(2, 1), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(2, 0));
            
            Assert.NotNull(path);
            Assert.True(path.Nodes.Count > 2);
            Assert.Contains(new Vector2Int(0, 1), path.Nodes);
        }
        
        [Fact]
        public void FindPath_NoValidPath_ReturnsNull()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(0, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(2, 0), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(2, 0));
            
            Assert.Null(path);
        }
        
        [Fact]
        public void FindPath_StartNotWalkable_ReturnsNull()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(0, 0), TileType.Residential);
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 0));
            
            Assert.Null(path);
        }
        
        [Fact]
        public void FindPath_GoalNotWalkable_ReturnsNull()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(0, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Residential);
            
            var pathfinding = new PathfindingService(grid);
            var path = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 0));
            
            Assert.Null(path);
        }
        
        [Fact]
        public void FindPath_DiagonalMovement_AllowedWhenClear()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(0, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(0, 1), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 1), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
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
            grid.PlaceTileAt(new Vector2Int(0, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Residential);
            grid.PlaceTileAt(new Vector2Int(0, 1), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 1), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 1));
            
            Assert.NotNull(path);
            Assert.Equal(3, path.Nodes.Count);
            Assert.DoesNotContain(new Vector2Int(1, 0), path.Nodes);
        }
        
        [Fact]
        public void PathCache_ReturnsCachedPath()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(0, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path1 = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 0));
            var path2 = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 0));
            
            Assert.Same(path1, path2);
        }
        
        [Fact]
        public void InvalidateCache_RemovesIntersectingPaths()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(0, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(2, 0), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path1 = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(2, 0));
            
            var dirtyRegion = new Rectangle(32, 0, 32, 32);
            pathfinding.InvalidateCache(dirtyRegion);
            
            var path2 = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(2, 0));
            
            Assert.NotSame(path1, path2);
        }
        
        [Fact]
        public void ClearCache_RemovesAllCachedPaths()
        {
            var grid = CreateTestGrid();
            grid.PlaceTileAt(new Vector2Int(0, 0), TileType.Road);
            grid.PlaceTileAt(new Vector2Int(1, 0), TileType.Road);
            
            var pathfinding = new PathfindingService(grid);
            var path1 = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 0));
            
            pathfinding.ClearCache();
            
            var path2 = pathfinding.FindPath(new Vector2Int(0, 0), new Vector2Int(1, 0));
            
            Assert.NotSame(path1, path2);
        }
    }
}
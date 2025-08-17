using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using CityBuilder.Core;
using CityBuilder.Grid;

namespace CityBuilder.Simulation
{
    public class PathfindingService
    {
        private readonly GridSystem _gridSystem;
        private readonly ConcurrentDictionary<(Vector2Int, Vector2Int), PathData> _pathCache;
        private readonly LinkedList<(Vector2Int, Vector2Int)> _lruList;
        private readonly object _lruLock = new object();
        
        // Static readonly arrays to avoid per-call allocations
        private static readonly Vector2Int[] CardinalOffsets = new[]
        {
            new Vector2Int(0, -1),  // North
            new Vector2Int(1, 0),   // East
            new Vector2Int(0, 1),   // South
            new Vector2Int(-1, 0)   // West
        };
        
        private static readonly Vector2Int[] DiagonalOffsets = new[]
        {
            new Vector2Int(-1, -1), // Northwest
            new Vector2Int(1, -1),  // Northeast
            new Vector2Int(1, 1),   // Southeast
            new Vector2Int(-1, 1)   // Southwest
        };
        
        public PathfindingService(GridSystem gridSystem)
        {
            _gridSystem = gridSystem ?? throw new ArgumentNullException(nameof(gridSystem));
            _pathCache = new ConcurrentDictionary<(Vector2Int, Vector2Int), PathData>();
            _lruList = new LinkedList<(Vector2Int, Vector2Int)>();
        }
        
        public Path? FindPath(Vector2Int start, Vector2Int goal)
        {
            var key = (start, goal);
            
            // Try to get from cache first
            if (_pathCache.TryGetValue(key, out var cachedPathData))
            {
                UpdateLRU(key);
                // Return a new Path instance with cloned nodes
                return cachedPathData.CreatePath();
            }
            
            // Calculate new path
            var pathData = AStar(start, goal);
            
            if (pathData != null)
            {
                // Add to cache with LRU eviction
                AddToCache(key, pathData);
                // Return a new Path instance
                return pathData.CreatePath();
            }
            
            return null;
        }
        
        private void AddToCache((Vector2Int, Vector2Int) key, PathData pathData)
        {
            lock (_lruLock)
            {
                // Remove oldest if at capacity
                if (_pathCache.Count >= GameConstants.PathCacheMaxSize && _lruList.Count > 0)
                {
                    var oldest = _lruList.First!.Value;
                    _lruList.RemoveFirst();
                    _pathCache.TryRemove(oldest, out _);
                }
                
                // Add new entry
                if (_pathCache.TryAdd(key, pathData))
                {
                    _lruList.AddLast(key);
                }
            }
        }
        
        private void UpdateLRU((Vector2Int, Vector2Int) key)
        {
            lock (_lruLock)
            {
                var node = _lruList.Find(key);
                if (node != null)
                {
                    _lruList.Remove(node);
                    _lruList.AddLast(node);
                }
            }
        }
        
        public void InvalidateCache(Rectangle dirtyRegion)
        {
            var toRemove = _pathCache
                .Where(kvp => kvp.Value.IntersectsWith(dirtyRegion))
                .Select(kvp => kvp.Key)
                .ToList();
            
            foreach (var key in toRemove)
            {
                _pathCache.TryRemove(key, out _);
                lock (_lruLock)
                {
                    _lruList.Remove(key);
                }
            }
        }
        
        public void ClearCache()
        {
            _pathCache.Clear();
            lock (_lruLock)
            {
                _lruList.Clear();
            }
        }
        
        private PathData? AStar(Vector2Int start, Vector2Int goal)
        {
            if (!IsWalkable(start) || !IsWalkable(goal))
                return null;
            
            var openSet = new SortedSet<PathNode>(new PathNodeComparer());
            var closedSet = new HashSet<Vector2Int>();
            var nodeMap = new Dictionary<Vector2Int, PathNode>();
            
            var startNode = new PathNode(start) { GCost = 0 };
            startNode.HCost = PathNode.Heuristic(start, goal);
            nodeMap[start] = startNode;
            openSet.Add(startNode);
            
            while (openSet.Count > 0)
            {
                var current = openSet.Min!;
                openSet.Remove(current);
                
                if (current.Position == goal)
                {
                    return ReconstructPath(current);
                }
                
                closedSet.Add(current.Position);
                
                foreach (var neighbor in GetWalkableNeighbors(current.Position))
                {
                    if (closedSet.Contains(neighbor))
                        continue;
                    
                    float tentativeGCost = current.GCost + GetMovementCost(current.Position, neighbor);
                    
                    if (!nodeMap.TryGetValue(neighbor, out var neighborNode))
                    {
                        neighborNode = new PathNode(neighbor);
                        nodeMap[neighbor] = neighborNode;
                    }
                    else if (tentativeGCost >= neighborNode.GCost)
                    {
                        continue;
                    }
                    else
                    {
                        openSet.Remove(neighborNode);
                    }
                    
                    neighborNode.Parent = current;
                    neighborNode.GCost = tentativeGCost;
                    neighborNode.HCost = PathNode.Heuristic(neighbor, goal);
                    openSet.Add(neighborNode);
                }
            }
            
            return null;
        }
        
        private PathData ReconstructPath(PathNode endNode)
        {
            var nodes = new List<Vector2Int>();
            var current = endNode;
            
            while (current != null)
            {
                nodes.Add(current.Position);
                current = current.Parent;
            }
            
            nodes.Reverse();
            return new PathData(nodes);
        }
        
        private List<Vector2Int> GetWalkableNeighbors(Vector2Int position)
        {
            var neighbors = new List<Vector2Int>(8); // Pre-size for max neighbors
            
            // Check cardinal directions
            foreach (var offset in CardinalOffsets)
            {
                var neighbor = new Vector2Int(position.X + offset.X, position.Y + offset.Y);
                if (IsWalkable(neighbor))
                {
                    neighbors.Add(neighbor);
                }
            }
            
            // Check diagonal directions
            foreach (var offset in DiagonalOffsets)
            {
                var neighbor = new Vector2Int(position.X + offset.X, position.Y + offset.Y);
                var adjacent1 = new Vector2Int(position.X + offset.X, position.Y);
                var adjacent2 = new Vector2Int(position.X, position.Y + offset.Y);
                
                // Only allow diagonal if both adjacent cells are walkable (no corner cutting)
                if (IsWalkable(neighbor) && IsWalkable(adjacent1) && IsWalkable(adjacent2))
                {
                    neighbors.Add(neighbor);
                }
            }
            
            return neighbors;
        }
        
        private bool IsWalkable(Vector2Int position)
        {
            var tile = _gridSystem.GetTileAt(position);
            return tile.IsWalkable;
        }
        
        private float GetMovementCost(Vector2Int from, Vector2Int to)
        {
            var dx = Math.Abs(to.X - from.X);
            var dy = Math.Abs(to.Y - from.Y);
            
            return (dx + dy == 1) 
                ? GameConstants.CardinalMovementCost 
                : GameConstants.DiagonalMovementCost;
        }
        
        private class PathNodeComparer : IComparer<PathNode>
        {
            public int Compare(PathNode? x, PathNode? y)
            {
                if (x == null && y == null) return 0;
                if (x == null) return 1;
                if (y == null) return -1;
                
                // Compare by FCost first
                int result = x.FCost.CompareTo(y.FCost);
                if (result != 0) return result;
                
                // Then by HCost
                result = x.HCost.CompareTo(y.HCost);
                if (result != 0) return result;
                
                // Finally by position (deterministic tie-breaker)
                result = x.Position.X.CompareTo(y.Position.X);
                if (result != 0) return result;
                
                return x.Position.Y.CompareTo(y.Position.Y);
            }
        }
    }
}
using System.Collections.Generic;
using CityBuilder.Core;

namespace CityBuilder.Simulation
{
    /// <summary>
    /// Immutable path data that can be safely cached and shared
    /// </summary>
    public class PathData
    {
        private readonly List<Vector2Int> _nodes;
        
        public IReadOnlyList<Vector2Int> Nodes => _nodes;
        public float TotalLength { get; }
        
        public PathData(List<Vector2Int> nodes)
        {
            _nodes = nodes ?? new List<Vector2Int>();
            TotalLength = CalculateTotalLength();
        }
        
        private float CalculateTotalLength()
        {
            float length = 0;
            for (int i = 1; i < _nodes.Count; i++)
            {
                var dx = _nodes[i].X - _nodes[i - 1].X;
                var dy = _nodes[i].Y - _nodes[i - 1].Y;
                length = (dx == 0 || dy == 0) 
                    ? length + GameConstants.CardinalMovementCost
                    : length + GameConstants.DiagonalMovementCost;
            }
            return length;
        }
        
        public bool IntersectsWith(Rectangle region)
        {
            foreach (var node in _nodes)
            {
                var nodePos = new System.Numerics.Vector2(
                    node.X * GameConstants.TileSize, 
                    node.Y * GameConstants.TileSize
                );
                if (region.x <= nodePos.X && nodePos.X <= region.x + region.width &&
                    region.y <= nodePos.Y && nodePos.Y <= region.y + region.height)
                {
                    return true;
                }
            }
            return false;
        }
        
        /// <summary>
        /// Creates a new Path instance with mutable traversal state
        /// </summary>
        public Path CreatePath()
        {
            // Clone the node list so the Path can't affect the cached data
            return new Path(new List<Vector2Int>(_nodes));
        }
    }
}
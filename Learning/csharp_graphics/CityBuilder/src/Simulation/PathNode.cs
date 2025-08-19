using System;
using CityBuilder.Core;

namespace CityBuilder.Simulation
{
    internal class PathNode : IComparable<PathNode>
    {
        public Vector2Int Position { get; }
        public PathNode? Parent { get; set; }
        public float GCost { get; set; }
        public float HCost { get; set; }
        public float FCost => GCost + HCost;
        
        public PathNode(Vector2Int position)
        {
            Position = position;
            GCost = float.MaxValue;
            HCost = 0;
            Parent = null;
        }
        
        public int CompareTo(PathNode? other)
        {
            if (other == null) return -1;
            return FCost.CompareTo(other.FCost);
        }
        
        public static float Heuristic(Vector2Int a, Vector2Int b)
        {
            var dx = MathF.Abs(a.X - b.X);
            var dy = MathF.Abs(a.Y - b.Y);
            return dx + dy + (MathF.Sqrt(2) - 2) * MathF.Min(dx, dy);
        }
    }
}
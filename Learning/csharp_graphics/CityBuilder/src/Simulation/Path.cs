using System.Collections.Generic;
using System.Numerics;
using CityBuilder.Core;

namespace CityBuilder.Simulation
{
    public class Path
    {
        private readonly List<Vector2Int> _nodes;
        private int _currentIndex;
        
        public IReadOnlyList<Vector2Int> Nodes => _nodes;
        public bool IsComplete => _currentIndex >= _nodes.Count;
        public Vector2Int? CurrentNode => IsComplete ? null : _nodes[_currentIndex];
        public Vector2Int? NextNode => _currentIndex + 1 < _nodes.Count ? _nodes[_currentIndex + 1] : null;
        public float TotalLength { get; }
        
        public Vector2Int? PeekNext() => NextNode;
        
        public Path(List<Vector2Int> nodes)
        {
            _nodes = nodes ?? new List<Vector2Int>();
            _currentIndex = 0;
            TotalLength = CalculateTotalLength();
        }
        
        public void Advance()
        {
            if (!IsComplete)
                _currentIndex++;
        }
        
        public void Reset()
        {
            _currentIndex = 0;
        }
        
        public bool IntersectsWith(Rectangle region)
        {
            foreach (var node in _nodes)
            {
                var nodePos = new Vector2(node.X * 32, node.Y * 32);
                if (region.x <= nodePos.X && nodePos.X <= region.x + region.width &&
                    region.y <= nodePos.Y && nodePos.Y <= region.y + region.height)
                {
                    return true;
                }
            }
            return false;
        }
        
        private float CalculateTotalLength()
        {
            float length = 0;
            for (int i = 1; i < _nodes.Count; i++)
            {
                var dx = _nodes[i].X - _nodes[i - 1].X;
                var dy = _nodes[i].Y - _nodes[i - 1].Y;
                length += MathF.Sqrt(dx * dx + dy * dy);
            }
            return length;
        }
    }
    
    public struct Rectangle
    {
        public float x, y, width, height;
        
        public Rectangle(float x, float y, float width, float height)
        {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
        }
    }
}
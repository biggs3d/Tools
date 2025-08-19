namespace CityBuilder.Core;

/// <summary>
/// Immutable 2D integer vector with proper equality and hashing for dictionary keys
/// </summary>
public readonly record struct Vector2Int(int X, int Y)
{
    public static Vector2Int Zero => new(0, 0);
    public static Vector2Int One => new(1, 1);
    public static Vector2Int Up => new(0, -1);
    public static Vector2Int Down => new(0, 1);
    public static Vector2Int Left => new(-1, 0);
    public static Vector2Int Right => new(1, 0);
    
    public static Vector2Int operator +(Vector2Int a, Vector2Int b) => new(a.X + b.X, a.Y + b.Y);
    public static Vector2Int operator -(Vector2Int a, Vector2Int b) => new(a.X - b.X, a.Y - b.Y);
    public static Vector2Int operator *(Vector2Int a, int scalar) => new(a.X * scalar, a.Y * scalar);
    public static Vector2Int operator /(Vector2Int a, int scalar) => new(a.X / scalar, a.Y / scalar);
    
    public float Magnitude => MathF.Sqrt(X * X + Y * Y);
    public int ManhattanDistance(Vector2Int other) => Math.Abs(X - other.X) + Math.Abs(Y - other.Y);
    
    public override string ToString() => $"({X}, {Y})";
}
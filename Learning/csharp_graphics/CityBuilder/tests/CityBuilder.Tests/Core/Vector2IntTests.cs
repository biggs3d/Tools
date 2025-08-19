using Xunit;
using CityBuilder.Core;

namespace CityBuilder.Tests.Core;

public class Vector2IntTests
{
    [Fact]
    public void Constructor_SetsCorrectValues()
    {
        var vec = new Vector2Int(5, 10);
        Assert.Equal(5, vec.X);
        Assert.Equal(10, vec.Y);
    }
    
    [Fact]
    public void StaticProperties_ReturnCorrectValues()
    {
        Assert.Equal(new Vector2Int(0, 0), Vector2Int.Zero);
        Assert.Equal(new Vector2Int(1, 1), Vector2Int.One);
        Assert.Equal(new Vector2Int(0, -1), Vector2Int.Up);
        Assert.Equal(new Vector2Int(0, 1), Vector2Int.Down);
        Assert.Equal(new Vector2Int(-1, 0), Vector2Int.Left);
        Assert.Equal(new Vector2Int(1, 0), Vector2Int.Right);
    }
    
    [Theory]
    [InlineData(1, 2, 3, 4, 4, 6)]
    [InlineData(-1, -2, 3, 4, 2, 2)]
    [InlineData(0, 0, 5, 5, 5, 5)]
    public void Addition_ReturnsCorrectResult(int x1, int y1, int x2, int y2, int expectedX, int expectedY)
    {
        var vec1 = new Vector2Int(x1, y1);
        var vec2 = new Vector2Int(x2, y2);
        var result = vec1 + vec2;
        
        Assert.Equal(expectedX, result.X);
        Assert.Equal(expectedY, result.Y);
    }
    
    [Theory]
    [InlineData(5, 7, 2, 3, 3, 4)]
    [InlineData(0, 0, 1, 1, -1, -1)]
    public void Subtraction_ReturnsCorrectResult(int x1, int y1, int x2, int y2, int expectedX, int expectedY)
    {
        var vec1 = new Vector2Int(x1, y1);
        var vec2 = new Vector2Int(x2, y2);
        var result = vec1 - vec2;
        
        Assert.Equal(expectedX, result.X);
        Assert.Equal(expectedY, result.Y);
    }
    
    [Theory]
    [InlineData(2, 3, 4, 8, 12)]
    [InlineData(-2, 3, -2, 4, -6)]
    public void Multiplication_ReturnsCorrectResult(int x, int y, int scalar, int expectedX, int expectedY)
    {
        var vec = new Vector2Int(x, y);
        var result = vec * scalar;
        
        Assert.Equal(expectedX, result.X);
        Assert.Equal(expectedY, result.Y);
    }
    
    [Theory]
    [InlineData(10, 20, 5, 2, 4)]
    [InlineData(-8, 4, 2, -4, 2)]
    public void Division_ReturnsCorrectResult(int x, int y, int divisor, int expectedX, int expectedY)
    {
        var vec = new Vector2Int(x, y);
        var result = vec / divisor;
        
        Assert.Equal(expectedX, result.X);
        Assert.Equal(expectedY, result.Y);
    }
    
    [Theory]
    [InlineData(3, 4, 5.0f)]
    [InlineData(0, 5, 5.0f)]
    [InlineData(5, 0, 5.0f)]
    public void Magnitude_CalculatesCorrectly(int x, int y, float expectedMagnitude)
    {
        var vec = new Vector2Int(x, y);
        Assert.Equal(expectedMagnitude, vec.Magnitude, 0.001f);
    }
    
    [Theory]
    [InlineData(0, 0, 3, 4, 7)]
    [InlineData(1, 1, 4, 5, 7)]
    [InlineData(-2, -3, 2, 3, 10)]
    public void ManhattanDistance_CalculatesCorrectly(int x1, int y1, int x2, int y2, int expectedDistance)
    {
        var vec1 = new Vector2Int(x1, y1);
        var vec2 = new Vector2Int(x2, y2);
        Assert.Equal(expectedDistance, vec1.ManhattanDistance(vec2));
    }
    
    [Fact]
    public void Equality_WorksCorrectly()
    {
        var vec1 = new Vector2Int(5, 10);
        var vec2 = new Vector2Int(5, 10);
        var vec3 = new Vector2Int(5, 11);
        
        Assert.Equal(vec1, vec2);
        Assert.NotEqual(vec1, vec3);
        Assert.True(vec1 == vec2);
        Assert.True(vec1 != vec3);
    }
    
    [Fact]
    public void GetHashCode_SameForEqualVectors()
    {
        var vec1 = new Vector2Int(42, 84);
        var vec2 = new Vector2Int(42, 84);
        
        Assert.Equal(vec1.GetHashCode(), vec2.GetHashCode());
    }
    
    [Fact]
    public void GetHashCode_DifferentForDifferentVectors()
    {
        var vec1 = new Vector2Int(42, 84);
        var vec2 = new Vector2Int(84, 42);
        
        // While not guaranteed, these should be different for good distribution
        Assert.NotEqual(vec1.GetHashCode(), vec2.GetHashCode());
    }
    
    [Fact]
    public void ToString_ReturnsCorrectFormat()
    {
        var vec = new Vector2Int(123, -456);
        Assert.Equal("(123, -456)", vec.ToString());
    }
    
    [Fact]
    public void CanBeUsedAsDictionaryKey()
    {
        var dict = new Dictionary<Vector2Int, string>();
        var key1 = new Vector2Int(1, 2);
        var key2 = new Vector2Int(1, 2);
        var key3 = new Vector2Int(2, 1);
        
        dict[key1] = "first";
        Assert.Equal("first", dict[key2]); // Same coordinates should retrieve same value
        
        dict[key3] = "second";
        Assert.Equal(2, dict.Count);
        Assert.Equal("second", dict[key3]);
    }
}
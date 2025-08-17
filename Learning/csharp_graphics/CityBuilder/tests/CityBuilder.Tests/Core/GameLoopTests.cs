using Xunit;
using CityBuilder.Core;

namespace CityBuilder.Tests.Core;

public class GameLoopTests
{
    [Fact]
    public void FixedTimestep_Is30Hz()
    {
        var gameLoop = new GameLoop();
        Assert.Equal(1f / 30f, gameLoop.FixedTimestep, 0.0001f);
    }
    
    [Fact]
    public void InterpolationAlpha_StartsAtZero()
    {
        var gameLoop = new GameLoop();
        Assert.Equal(0f, gameLoop.InterpolationAlpha);
    }
    
    [Fact]
    public void Pause_PreventFixedUpdates()
    {
        var gameLoop = new GameLoop();
        gameLoop.IsPaused = true;
        Assert.True(gameLoop.IsPaused);
    }
    
    [Fact]
    public void ResetAccumulator_ResetsInterpolation()
    {
        var gameLoop = new GameLoop();
        gameLoop.ResetAccumulator();
        Assert.Equal(0f, gameLoop.InterpolationAlpha);
    }
    
    [Fact]
    public void Events_CanBeSubscribedAndUnsubscribed()
    {
        var gameLoop = new GameLoop();
        int updateCount = 0;
        int fixedUpdateCount = 0;
        int drawCount = 0;
        
        void OnUpdate(float dt) => updateCount++;
        void OnFixedUpdate(float dt) => fixedUpdateCount++;
        void OnDraw(float alpha) => drawCount++;
        
        // Subscribe
        gameLoop.OnUpdate += OnUpdate;
        gameLoop.OnFixedUpdate += OnFixedUpdate;
        gameLoop.OnDraw += OnDraw;
        
        // Unsubscribe should work without errors
        gameLoop.OnUpdate -= OnUpdate;
        gameLoop.OnFixedUpdate -= OnFixedUpdate;
        gameLoop.OnDraw -= OnDraw;
        
        // No exceptions should be thrown
        Assert.Equal(0, updateCount);
        Assert.Equal(0, fixedUpdateCount);
        Assert.Equal(0, drawCount);
    }
}
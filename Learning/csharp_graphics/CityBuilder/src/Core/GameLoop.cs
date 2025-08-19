using Raylib_cs;

namespace CityBuilder.Core;

/// <summary>
/// Main game loop with fixed timestep simulation and interpolated rendering
/// </summary>
public class GameLoop
{
    private const float FIXED_TIMESTEP = 1f / 30f; // 30Hz simulation
    private const int MAX_UPDATES_PER_FRAME = 5; // Prevent spiral of death
    
    private float _accumulator = 0f;
    private float _interpolationAlpha = 0f;
    private bool _isRunning = false;
    private bool _isPaused = false;
    
    public float InterpolationAlpha => _interpolationAlpha;
    public float FixedTimestep => FIXED_TIMESTEP;
    public bool IsPaused 
    { 
        get => _isPaused; 
        set => _isPaused = value; 
    }
    
    public delegate void UpdateDelegate(float deltaTime);
    public delegate void FixedUpdateDelegate(float fixedDeltaTime);
    public delegate void DrawDelegate(float interpolationAlpha);
    
    public event UpdateDelegate? OnUpdate;
    public event FixedUpdateDelegate? OnFixedUpdate;
    public event DrawDelegate? OnDraw;
    
    /// <summary>
    /// Start the game loop
    /// </summary>
    public void Run()
    {
        _isRunning = true;
        
        while (_isRunning && !Raylib.WindowShouldClose())
        {
            float deltaTime = Raylib.GetFrameTime();
            
            // Variable timestep update (for input, animations, etc.)
            OnUpdate?.Invoke(deltaTime);
            
            if (!_isPaused)
            {
                // Fixed timestep simulation
                _accumulator += deltaTime;
                
                // Prevent spiral of death
                if (_accumulator > FIXED_TIMESTEP * MAX_UPDATES_PER_FRAME)
                {
                    _accumulator = FIXED_TIMESTEP * MAX_UPDATES_PER_FRAME;
                }
                
                // Run fixed updates
                while (_accumulator >= FIXED_TIMESTEP)
                {
                    OnFixedUpdate?.Invoke(FIXED_TIMESTEP);
                    _accumulator -= FIXED_TIMESTEP;
                }
                
                // Calculate interpolation factor for smooth rendering
                _interpolationAlpha = _accumulator / FIXED_TIMESTEP;
            }
            else
            {
                _interpolationAlpha = 0f;
            }
            
            // Render with interpolation
            Raylib.BeginDrawing();
            OnDraw?.Invoke(_interpolationAlpha);
            Raylib.EndDrawing();
        }
    }
    
    /// <summary>
    /// Stop the game loop
    /// </summary>
    public void Stop()
    {
        _isRunning = false;
    }
    
    /// <summary>
    /// Reset the accumulator (useful when changing states)
    /// </summary>
    public void ResetAccumulator()
    {
        _accumulator = 0f;
        _interpolationAlpha = 0f;
    }
}
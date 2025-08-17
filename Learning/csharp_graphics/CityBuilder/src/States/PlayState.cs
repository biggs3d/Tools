using Raylib_cs;
using CityBuilder.Core;
using System.Numerics;

namespace CityBuilder.States;

/// <summary>
/// Main gameplay state with grid, camera, and simulation
/// </summary>
public class PlayState : BaseGameState
{
    
    private Camera2D _camera;
    private bool _showGrid = true;
    private bool _isPaused = false;
    
    // Temporary grid visualization
    private const int TILE_SIZE = 32;
    private const int GRID_SIZE = 50;
    
    public PlayState(EventBus eventBus, AssetManager assetManager)
        : base(eventBus, assetManager)
    {
    }
    
    public override void Enter()
    {
        Console.WriteLine("Entered Play State");
        
        // Initialize camera centered on grid
        _camera = new Camera2D
        {
            Target = new Vector2(0, 0),
            Offset = new Vector2(Raylib.GetScreenWidth() / 2f, Raylib.GetScreenHeight() / 2f),
            Rotation = 0f,
            Zoom = 1f
        };
        
        _isPaused = false;
        _showGrid = true;
    }
    
    public override void Update(float deltaTime)
    {
        if (!_isPaused)
        {
            HandleCameraInput(deltaTime);
        }
        
        HandleGameInput();
    }
    
    public override void FixedUpdate(float fixedDeltaTime)
    {
        if (!_isPaused)
        {
            // Future: Update simulation, vehicles, deliveries
        }
    }
    
    public override void Draw(float interpolationAlpha)
    {
        Raylib.ClearBackground(new Color(30, 30, 40, 255));
        
        // Begin world-space rendering
        Raylib.BeginMode2D(_camera);
        
        DrawGrid();
        DrawPlaceholderTerrain();
        
        // Future: Draw tiles, vehicles, effects
        
        Raylib.EndMode2D();
        
        // Draw UI overlay (screen space)
        DrawUI();
    }
    
    public override void Exit()
    {
        base.Exit(); // Handles event cleanup
        Console.WriteLine("Exited Play State");
    }
    
    private void HandleCameraInput(float deltaTime)
    {
        float moveSpeed = 300f * deltaTime / _camera.Zoom;
        
        // WASD or Arrow keys for camera movement
        if (Raylib.IsKeyDown(KeyboardKey.W) || Raylib.IsKeyDown(KeyboardKey.Up))
            _camera.Target.Y -= moveSpeed;
        if (Raylib.IsKeyDown(KeyboardKey.S) || Raylib.IsKeyDown(KeyboardKey.Down))
            _camera.Target.Y += moveSpeed;
        if (Raylib.IsKeyDown(KeyboardKey.A) || Raylib.IsKeyDown(KeyboardKey.Left))
            _camera.Target.X -= moveSpeed;
        if (Raylib.IsKeyDown(KeyboardKey.D) || Raylib.IsKeyDown(KeyboardKey.Right))
            _camera.Target.X += moveSpeed;
        
        // Mouse wheel zoom
        float wheel = Raylib.GetMouseWheelMove();
        if (wheel != 0)
        {
            _camera.Zoom += wheel * 0.1f;
            _camera.Zoom = Math.Clamp(_camera.Zoom, 0.25f, 4f);
        }
        
        // Middle mouse drag
        if (Raylib.IsMouseButtonDown(MouseButton.Middle))
        {
            Vector2 delta = Raylib.GetMouseDelta();
            _camera.Target.X -= delta.X / _camera.Zoom;
            _camera.Target.Y -= delta.Y / _camera.Zoom;
        }
    }
    
    private void HandleGameInput()
    {
        // Toggle grid
        if (Raylib.IsKeyPressed(KeyboardKey.F1))
        {
            _showGrid = !_showGrid;
            Console.WriteLine($"Grid display: {_showGrid}");
        }
        
        // Pause
        if (Raylib.IsKeyPressed(KeyboardKey.P) || Raylib.IsKeyPressed(KeyboardKey.Space))
        {
            _isPaused = !_isPaused;
            EventBus.Publish(new PauseToggleEvent { IsPaused = _isPaused });
            Console.WriteLine($"Game paused: {_isPaused}");
        }
        
        // Return to menu
        if (Raylib.IsKeyPressed(KeyboardKey.Escape))
        {
            EventBus.Publish(new StateChangeRequest(typeof(MenuState)));
        }
    }
    
    private void DrawGrid()
    {
        if (!_showGrid) return;
        
        Color gridColor = new Color(50, 50, 60, 100);
        
        int startX = -GRID_SIZE * TILE_SIZE / 2;
        int endX = GRID_SIZE * TILE_SIZE / 2;
        int startY = -GRID_SIZE * TILE_SIZE / 2;
        int endY = GRID_SIZE * TILE_SIZE / 2;
        
        // Vertical lines
        for (int x = startX; x <= endX; x += TILE_SIZE)
        {
            Raylib.DrawLine(x, startY, x, endY, gridColor);
        }
        
        // Horizontal lines
        for (int y = startY; y <= endY; y += TILE_SIZE)
        {
            Raylib.DrawLine(startX, y, endX, y, gridColor);
        }
        
        // Draw origin marker
        Raylib.DrawCircle(0, 0, 5, Color.Red);
    }
    
    private void DrawPlaceholderTerrain()
    {
        // Draw a checkerboard pattern as placeholder terrain
        int startTileX = -GRID_SIZE / 2;
        int endTileX = GRID_SIZE / 2;
        int startTileY = -GRID_SIZE / 2;
        int endTileY = GRID_SIZE / 2;
        
        for (int x = startTileX; x < endTileX; x++)
        {
            for (int y = startTileY; y < endTileY; y++)
            {
                Rectangle rect = new Rectangle(
                    x * TILE_SIZE,
                    y * TILE_SIZE,
                    TILE_SIZE,
                    TILE_SIZE
                );
                
                // Checkerboard pattern
                Color color = ((x + y) % 2 == 0) 
                    ? new Color(40, 60, 40, 255)  // Dark green
                    : new Color(50, 70, 50, 255); // Light green
                    
                Raylib.DrawRectangleRec(rect, color);
            }
        }
    }
    
    private void DrawUI()
    {
        // Draw HUD
        int screenWidth = Raylib.GetScreenWidth();
        int screenHeight = Raylib.GetScreenHeight();
        
        // Top bar background
        Raylib.DrawRectangle(0, 0, screenWidth, 40, new Color(0, 0, 0, 180));
        
        // Game info
        Raylib.DrawText($"FPS: {Raylib.GetFPS()}", 10, 10, 20, Color.Green);
        Raylib.DrawText($"Zoom: {_camera.Zoom:F2}x", 100, 10, 20, Color.White);
        Raylib.DrawText($"Camera: ({_camera.Target.X:F0}, {_camera.Target.Y:F0})", 200, 10, 20, Color.White);
        
        // Controls help
        string controls = "WASD: Move Camera | Scroll: Zoom | F1: Toggle Grid | P: Pause | ESC: Menu";
        int controlsWidth = Raylib.MeasureText(controls, 16);
        Raylib.DrawText(controls, screenWidth / 2 - controlsWidth / 2, screenHeight - 30, 16, Color.Gray);
        
        // Pause overlay
        if (_isPaused)
        {
            // Darken screen
            Raylib.DrawRectangle(0, 0, screenWidth, screenHeight, new Color(0, 0, 0, 120));
            
            // Pause text
            string pauseText = "PAUSED";
            int pauseWidth = Raylib.MeasureText(pauseText, 60);
            Raylib.DrawText(pauseText, screenWidth / 2 - pauseWidth / 2, screenHeight / 2 - 30, 60, Color.White);
            
            string resumeText = "Press P or SPACE to resume";
            int resumeWidth = Raylib.MeasureText(resumeText, 20);
            Raylib.DrawText(resumeText, screenWidth / 2 - resumeWidth / 2, screenHeight / 2 + 40, 20, Color.Gray);
        }
    }
}

/// <summary>
/// Event for toggling pause state
/// </summary>
public class PauseToggleEvent
{
    public bool IsPaused { get; set; }
}
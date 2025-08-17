using System;
using Raylib_cs;
using CityBuilder.Core;
using CityBuilder.Grid;
using CityBuilder.Rendering;
using CityBuilder.Simulation;
using System.Numerics;

namespace CityBuilder.States;

/// <summary>
/// Main gameplay state with grid, camera, and simulation
/// </summary>
public class PlayState : BaseGameState
{
    private Camera2D _camera;
    private bool _showGrid = false;
    private bool _showChunkBounds = false;
    private bool _isPaused = false;
    
    // Grid system
    private GridSystem _gridSystem = null!;
    private GridRenderer _gridRenderer = null!;
    private TerrainGenerator _terrainGenerator = null!;
    
    // Simulation
    private SimulationManager _simulationManager = null!;
    
    // Settings
    private readonly GameSettings _gameSettings;
    
    public PlayState(EventBus eventBus, AssetManager assetManager, GameSettings gameSettings)
        : base(eventBus, assetManager)
    {
        _gameSettings = gameSettings ?? throw new ArgumentNullException(nameof(gameSettings));
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
        
        // Initialize grid system with terrain generator
        _terrainGenerator = new TerrainGenerator(seed: 42);
        _gridSystem = new GridSystem(EventBus, _terrainGenerator);
        _gridRenderer = new GridRenderer(_gridSystem);
        
        // Initialize simulation with settings
        _simulationManager = new SimulationManager(_gridSystem, EventBus, _gameSettings);
        
        // Place initial hub at origin
        _gridSystem.PlaceTileAt(new Vector2Int(0, 0), TileType.LandingPad);
        Console.WriteLine("Hub placed at origin");
        
        // Don't spawn vehicle here - hub location not set yet in SimulationManager
        // Vehicle will spawn when first task is generated
        
        _isPaused = false;
        _showGrid = false;
        _showChunkBounds = false;
    }
    
    public override void Update(float deltaTime)
    {
        if (!_isPaused)
        {
            HandleCameraInput(deltaTime);
            HandlePlacementInput();
            
            // Update simulation
            _simulationManager.Update(deltaTime);
            
            // Unload distant chunks periodically
            _gridSystem.UnloadDistantChunks(_camera, 
                Raylib.GetScreenWidth(), 
                Raylib.GetScreenHeight());
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
        
        // Draw the grid system
        _gridRenderer.Draw(_camera, 
            Raylib.GetScreenWidth(), 
            Raylib.GetScreenHeight(), 
            _showGrid);
        
        // Debug: Show chunk boundaries
        if (_showChunkBounds)
        {
            _gridRenderer.DrawChunkBoundaries(_camera,
                Raylib.GetScreenWidth(),
                Raylib.GetScreenHeight());
        }
        
        // Draw placement preview
        DrawPlacementPreview();
        
        // Draw vehicles
        DrawVehicles();
        
        Raylib.EndMode2D();
        
        // Draw UI overlay (screen space)
        DrawUI();
    }
    
    public override void Exit()
    {
        base.Exit(); // Handles event cleanup
        _gridSystem?.Dispose();
        Console.WriteLine("Exited Play State");
    }
    
    private void HandleCameraInput(float deltaTime)
    {
        float baseSpeed = 300f * deltaTime / _camera.Zoom;
        
        // Check for SHIFT key to triple the speed
        float speedMultiplier = (Raylib.IsKeyDown(KeyboardKey.LeftShift) || Raylib.IsKeyDown(KeyboardKey.RightShift)) ? 3f : 1f;
        float moveSpeed = baseSpeed * speedMultiplier;
        
        // WASD or Arrow keys for camera movement
        if (Raylib.IsKeyDown(KeyboardKey.W) || Raylib.IsKeyDown(KeyboardKey.Up))
            _camera.Target.Y -= moveSpeed;
        if (Raylib.IsKeyDown(KeyboardKey.S) || Raylib.IsKeyDown(KeyboardKey.Down))
            _camera.Target.Y += moveSpeed;
        if (Raylib.IsKeyDown(KeyboardKey.A) || Raylib.IsKeyDown(KeyboardKey.Left))
            _camera.Target.X -= moveSpeed;
        if (Raylib.IsKeyDown(KeyboardKey.D) || Raylib.IsKeyDown(KeyboardKey.Right))
            _camera.Target.X += moveSpeed;
        
        // Mouse wheel zoom with safety validation
        float wheel = Raylib.GetMouseWheelMove();
        if (wheel != 0)
        {
            _camera.Zoom += wheel * 0.1f;
            // Ensure zoom never goes below a safe minimum to prevent division by zero
            _camera.Zoom = Math.Clamp(_camera.Zoom, 0.1f, 4f);
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
        
        // Toggle chunk boundaries (debug)
        if (Raylib.IsKeyPressed(KeyboardKey.F2))
        {
            _showChunkBounds = !_showChunkBounds;
            Console.WriteLine($"Chunk boundaries: {_showChunkBounds}");
        }
        
        // Pause
        if (Raylib.IsKeyPressed(KeyboardKey.P) || Raylib.IsKeyPressed(KeyboardKey.Space))
        {
            _isPaused = !_isPaused;
            _simulationManager.IsPaused = _isPaused;
            EventBus.Publish(new PauseToggleEvent { IsPaused = _isPaused });
            Console.WriteLine($"Game paused: {_isPaused}");
        }
        
        // Spawn vehicle (V key for testing)
        if (Raylib.IsKeyPressed(KeyboardKey.V))
        {
            _simulationManager.SpawnVehicle();
            Console.WriteLine($"Spawn vehicle requested. Active vehicles: {_simulationManager.ActiveVehicles.Count}");
        }
        
        // Return to menu
        if (Raylib.IsKeyPressed(KeyboardKey.Escape))
        {
            EventBus.Publish(new StateChangeRequest(typeof(MenuState)));
        }
    }
    
    private void HandlePlacementInput()
    {
        // Get mouse position in world space
        var mousePos = Raylib.GetMousePosition();
        var worldPos = Raylib.GetScreenToWorld2D(mousePos, _camera);
        var tilePos = GridSystem.WorldToTile(worldPos);
        
        // Left click to place road
        if (Raylib.IsMouseButtonPressed(MouseButton.Left))
        {
            if (_gridSystem.PlaceTileAt(tilePos, TileType.Road))
            {
                Console.WriteLine($"Placed road at {tilePos}");
            }
        }
        
        // Right click to remove tile
        if (Raylib.IsMouseButtonPressed(MouseButton.Right))
        {
            if (_gridSystem.RemoveTileAt(tilePos))
            {
                Console.WriteLine($"Removed tile at {tilePos}");
            }
        }
        
        // Number keys for building placement
        if (Raylib.IsKeyPressed(KeyboardKey.One))
        {
            if (_gridSystem.PlaceTileAt(tilePos, TileType.Residential))
            {
                Console.WriteLine($"Placed residential at {tilePos}");
            }
        }
        else if (Raylib.IsKeyPressed(KeyboardKey.Two))
        {
            if (_gridSystem.PlaceTileAt(tilePos, TileType.Commercial))
            {
                Console.WriteLine($"Placed commercial at {tilePos}");
            }
        }
        else if (Raylib.IsKeyPressed(KeyboardKey.Three))
        {
            if (_gridSystem.PlaceTileAt(tilePos, TileType.Industrial))
            {
                Console.WriteLine($"Placed industrial at {tilePos}");
            }
        }
    }
    
    private void DrawPlacementPreview()
    {
        // Get mouse position in world space
        var mousePos = Raylib.GetMousePosition();
        var worldPos = Raylib.GetScreenToWorld2D(mousePos, _camera);
        var tilePos = GridSystem.WorldToTile(worldPos);
        
        // Draw preview rectangle
        var worldTilePos = GridSystem.TileToWorld(tilePos);
        var rect = new Raylib_cs.Rectangle(
            worldTilePos.X - GridSystem.TileSize / 2f,
            worldTilePos.Y - GridSystem.TileSize / 2f,
            GridSystem.TileSize,
            GridSystem.TileSize
        );
        
        // Check if placement would be valid
        var existingTile = _gridSystem.GetTileAt(tilePos);
        var previewColor = existingTile.Type == TileType.Empty 
            ? new Color(100, 255, 100, 100)  // Green for valid
            : new Color(255, 100, 100, 100); // Red for occupied
        
        Raylib.DrawRectangleRec(rect, previewColor);
        Raylib.DrawRectangleLinesEx(rect, 2, Color.White);
    }
    
    private void DrawVehicles()
    {
        foreach (var vehicle in _simulationManager.ActiveVehicles)
        {
            // Draw vehicle as a colored circle
            Color vehicleColor = vehicle.State switch
            {
                VehicleState.Idle => Color.Gray,
                VehicleState.MovingToPickup => Color.Blue,
                VehicleState.Loading => Color.Yellow,
                VehicleState.MovingToDelivery => Color.Green,
                VehicleState.Unloading => Color.Orange,
                VehicleState.ReturningToHub => Color.Purple,
                _ => Color.White
            };
            
            Raylib.DrawCircleV(vehicle.InterpolatedPosition, 8, vehicleColor);
            Raylib.DrawCircleLinesV(vehicle.InterpolatedPosition, 8, Color.Black);
            
            // Draw vehicle ID for debugging
            Raylib.DrawText($"V{vehicle.Id}", 
                (int)vehicle.InterpolatedPosition.X - 8, 
                (int)vehicle.InterpolatedPosition.Y - 20, 
                10, Color.White);
        }
    }
    
    private void DrawUI()
    {
        // Draw HUD
        int screenWidth = Raylib.GetScreenWidth();
        int screenHeight = Raylib.GetScreenHeight();
        
        // Top bar background
        Raylib.DrawRectangle(0, 0, screenWidth, 60, new Color(0, 0, 0, 180));
        
        // Game info - First row
        Raylib.DrawText($"FPS: {Raylib.GetFPS()}", 10, 10, 20, Color.Green);
        Raylib.DrawText($"Zoom: {_camera.Zoom:F2}x", 100, 10, 20, Color.White);
        Raylib.DrawText($"Camera: ({_camera.Target.X:F0}, {_camera.Target.Y:F0})", 200, 10, 20, Color.White);
        Raylib.DrawText($"Chunks: {_gridSystem.ChunkCount}", 380, 10, 20, Color.White);
        Raylib.DrawText($"Tiles: {_gridSystem.TotalTilesPlaced}", 480, 10, 20, Color.White);
        
        // Simulation info - Second row
        Raylib.DrawText($"Vehicles: {_simulationManager.ActiveVehicles.Count}", 10, 35, 20, Color.SkyBlue);
        Raylib.DrawText($"Tasks: {_simulationManager.PendingTaskCount} pending, {_simulationManager.ActiveTaskCount} active", 
            150, 35, 20, Color.SkyBlue);
        
        // Controls help
        string controls = "WASD/SHIFT: Move | Click: Place Road | Right-Click: Remove | 1-3: Buildings | V: Spawn Vehicle | F1: Grid | F2: Chunks | ESC: Menu";
        int controlsWidth = Raylib.MeasureText(controls, 14);
        Raylib.DrawText(controls, screenWidth / 2 - controlsWidth / 2, screenHeight - 30, 14, Color.Gray);
        
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
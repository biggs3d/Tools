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
    private ProceduralCityGenerator _cityGenerator = null!;
    
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
        
        // Initialize procedural city generator
        _cityGenerator = new ProceduralCityGenerator(_gridSystem);
        
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
        
        // Stress test: Spawn 10 vehicles (T key)
        if (Raylib.IsKeyPressed(KeyboardKey.T))
        {
            for (int i = 0; i < 10; i++)
            {
                _simulationManager.SpawnVehicle();
            }
            Console.WriteLine($"Spawned 10 vehicles for stress test. Total: {_simulationManager.ActiveVehicles.Count}");
        }
        
        // Super stress test: Spawn 100 vehicles (Shift+T)
        if (Raylib.IsKeyPressed(KeyboardKey.T) && 
            (Raylib.IsKeyDown(KeyboardKey.LeftShift) || Raylib.IsKeyDown(KeyboardKey.RightShift)))
        {
            for (int i = 0; i < 100; i++)
            {
                _simulationManager.SpawnVehicle();
            }
            Console.WriteLine($"Spawned 100 vehicles for SUPER stress test! Total: {_simulationManager.ActiveVehicles.Count}");
        }
        
        // Toggle supply chain mode (C key)
        if (Raylib.IsKeyPressed(KeyboardKey.C))
        {
            _simulationManager.ToggleSupplyChainMode();
        }
        
        // Generate procedural city (G key)
        if (Raylib.IsKeyPressed(KeyboardKey.G))
        {
            if (Raylib.IsKeyDown(KeyboardKey.LeftShift) || Raylib.IsKeyDown(KeyboardKey.RightShift))
            {
                // Shift+G: Generate large city
                Console.WriteLine("Generating LARGE procedural city...");
                _cityGenerator.GenerateLargeCity();
            }
            else if (Raylib.IsKeyDown(KeyboardKey.LeftControl) || Raylib.IsKeyDown(KeyboardKey.RightControl))
            {
                // Ctrl+G: Clear city
                _cityGenerator.ClearCity();
            }
            else
            {
                // G: Generate small city
                Console.WriteLine("Generating small procedural city...");
                _cityGenerator.GenerateSmallCity();
            }
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
        // First draw all delivery task markers
        DrawDeliveryTaskMarkers();
        
        // Then draw vehicles on top
        foreach (var vehicle in _simulationManager.ActiveVehicles)
        {
            // Draw vehicle as a colored circle
            Color vehicleColor;
            
            // Show cargo color when carrying resources
            if (vehicle.State == VehicleState.MovingToDelivery && vehicle.HasCargo)
            {
                vehicleColor = GetCargoColor(vehicle.CargoType);
            }
            else
            {
                vehicleColor = vehicle.State switch
                {
                    VehicleState.Idle => Color.Gray,
                    VehicleState.MovingToPickup => Color.Blue,
                    VehicleState.Loading => Color.Yellow,
                    VehicleState.MovingToDelivery => Color.Green, // Fallback if no cargo
                    VehicleState.Unloading => Color.Orange,
                    VehicleState.ReturningToHub => Color.Purple,
                    _ => Color.White
                };
            }
            
            Raylib.DrawCircleV(vehicle.InterpolatedPosition, 8, vehicleColor);
            Raylib.DrawCircleLinesV(vehicle.InterpolatedPosition, 8, Color.Black);
            
            // Draw vehicle ID and cargo info for debugging
            string vehicleLabel = $"V{vehicle.Id}";
            if (vehicle.HasCargo)
            {
                // Show cargo type abbreviation
                string cargoAbbr = vehicle.CargoType switch
                {
                    ResourceType.BlueTeardrop => "💧",
                    ResourceType.RedSquare => "■",
                    ResourceType.YellowTriangle => "▲",
                    ResourceType.PurpleDiamond => "♦",
                    ResourceType.GreenHexagon => "⬢",
                    ResourceType.OrangeCircle => "●",
                    _ => "?"
                };
                vehicleLabel += $":{cargoAbbr}";
            }
            
            Raylib.DrawText(vehicleLabel, 
                (int)vehicle.InterpolatedPosition.X - 12, 
                (int)vehicle.InterpolatedPosition.Y - 20, 
                10, Color.White);
        }
    }
    
    private void DrawDeliveryTaskMarkers()
    {
        // Draw pickup/dropoff markers for active vehicles with tasks
        foreach (var vehicle in _simulationManager.ActiveVehicles)
        {
            if (vehicle.CurrentTask != null)
            {
                var pickupWorld = GridSystem.TileToWorld(vehicle.CurrentTask.PickupLocation);
                var deliveryWorld = GridSystem.TileToWorld(vehicle.CurrentTask.DeliveryLocation);
                
                // Draw pickup marker (blue diamond)
                if (vehicle.State == VehicleState.MovingToPickup || vehicle.State == VehicleState.Loading)
                {
                    DrawDiamond(pickupWorld + new Vector2(16, 16), 12, Color.Blue);
                    Raylib.DrawText("P", (int)(pickupWorld.X + 12), (int)(pickupWorld.Y + 10), 12, Color.White);
                }
                
                // Draw delivery marker (green diamond)
                if (vehicle.State == VehicleState.MovingToDelivery || vehicle.State == VehicleState.Unloading)
                {
                    DrawDiamond(deliveryWorld + new Vector2(16, 16), 12, Color.Green);
                    Raylib.DrawText("D", (int)(deliveryWorld.X + 12), (int)(deliveryWorld.Y + 10), 12, Color.White);
                }
                
                // Draw path line from vehicle to target
                if (vehicle.State == VehicleState.MovingToPickup)
                {
                    Raylib.DrawLineEx(vehicle.InterpolatedPosition, pickupWorld + new Vector2(16, 16), 2, new Color(0, 0, 255, 100));
                }
                else if (vehicle.State == VehicleState.MovingToDelivery)
                {
                    Raylib.DrawLineEx(vehicle.InterpolatedPosition, deliveryWorld + new Vector2(16, 16), 2, new Color(0, 255, 0, 100));
                }
            }
        }
    }
    
    private void DrawDiamond(Vector2 center, float size, Color color)
    {
        // Draw a diamond shape (rotated square)
        Vector2[] points = new Vector2[]
        {
            new Vector2(center.X, center.Y - size),      // Top
            new Vector2(center.X + size, center.Y),      // Right
            new Vector2(center.X, center.Y + size),      // Bottom
            new Vector2(center.X - size, center.Y)       // Left
        };
        
        // Draw filled diamond
        Raylib.DrawTriangle(points[0], points[1], points[2], color);
        Raylib.DrawTriangle(points[0], points[2], points[3], color);
        
        // Draw outline
        for (int i = 0; i < 4; i++)
        {
            Raylib.DrawLineEx(points[i], points[(i + 1) % 4], 2, Color.Black);
        }
    }
    
    private float CalculateAveragePathLength()
    {
        int totalNodes = 0;
        int vehiclesWithPaths = 0;
        
        foreach (var vehicle in _simulationManager.ActiveVehicles)
        {
            if (vehicle.CurrentPath != null && vehicle.CurrentPath.Nodes.Count > 0)
            {
                totalNodes += vehicle.CurrentPath.Nodes.Count;
                vehiclesWithPaths++;
            }
        }
        
        return vehiclesWithPaths > 0 ? (float)totalNodes / vehiclesWithPaths : 0f;
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
        
        // Performance info when > 10 vehicles
        if (_simulationManager.ActiveVehicles.Count > 10)
        {
            float avgPathLength = CalculateAveragePathLength();
            Raylib.DrawText($"Avg Path: {avgPathLength:F1} nodes", 500, 35, 20, Color.Yellow);
            
            // FPS warning if drops below 60
            if (Raylib.GetFPS() < 60)
            {
                Raylib.DrawText("PERFORMANCE WARNING", screenWidth - 200, 10, 20, Color.Red);
            }
        }
        
        // Controls help - split into two lines for all the new controls
        string controls1 = "WASD/SHIFT: Move | Click: Place Road | 1-3: Buildings | F1: Grid | P: Pause | C: Supply Chain | ESC: Menu";
        string controls2 = "V: Vehicle | T: 10 Vehicles | Shift+T: 100 | G: Gen City | Shift+G: Large City | Ctrl+G: Clear";
        int controls1Width = Raylib.MeasureText(controls1, 14);
        int controls2Width = Raylib.MeasureText(controls2, 14);
        Raylib.DrawText(controls1, screenWidth / 2 - controls1Width / 2, screenHeight - 50, 14, Color.Gray);
        Raylib.DrawText(controls2, screenWidth / 2 - controls2Width / 2, screenHeight - 30, 14, Color.Gray);
        
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
    
    /// <summary>
    /// Get color based on cargo type for visual distinction
    /// </summary>
    private Color GetCargoColor(ResourceType cargoType)
    {
        return cargoType switch
        {
            ResourceType.BlueTeardrop => new Color(0, 191, 255, 255),     // Blue
            ResourceType.RedSquare => new Color(255, 0, 0, 255),          // Red
            ResourceType.YellowTriangle => new Color(255, 255, 0, 255),   // Yellow
            ResourceType.PurpleDiamond => new Color(128, 0, 128, 255),    // Purple
            ResourceType.GreenHexagon => new Color(0, 255, 0, 255),       // Green
            ResourceType.OrangeCircle => new Color(255, 165, 0, 255),     // Orange
            ResourceType.BlackBeam => new Color(0, 0, 0, 255),            // Black
            ResourceType.WhitePillar => new Color(255, 255, 255, 255),    // White
            ResourceType.SilverTruss => new Color(192, 192, 192, 255),    // Silver
            _ => Color.Green // Default fallback
        };
    }
}

/// <summary>
/// Event for toggling pause state
/// </summary>
public class PauseToggleEvent
{
    public bool IsPaused { get; set; }
}
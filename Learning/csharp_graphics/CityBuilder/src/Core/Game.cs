using Raylib_cs;
using CityBuilder.States;
using CityBuilder.Simulation.Buildings;

namespace CityBuilder.Core;

/// <summary>
/// Main game class that manages the entire game lifecycle
/// </summary>
public class Game : IDisposable
{
    private readonly int _screenWidth;
    private readonly int _screenHeight;
    private readonly string _title;
    
    private GameLoop? _gameLoop;
    private EventBus? _eventBus;
    private AssetManager? _assetManager;
    private StateManager? _stateManager;
    private GameSettings? _gameSettings;
    
    private bool _disposed;
    private bool _shouldExit;
    
    public Game(int screenWidth = 1280, int screenHeight = 720, string title = "City Builder")
    {
        _screenWidth = screenWidth;
        _screenHeight = screenHeight;
        _title = title;
    }
    
    /// <summary>
    /// Initialize the game and all core systems
    /// </summary>
    public void Initialize()
    {
        // Initialize Raylib
        Raylib.InitWindow(_screenWidth, _screenHeight, _title);
        Raylib.SetTargetFPS(60);
        
        // Load settings
        _gameSettings = GameSettings.Load();
        
        // Initialize building registry
        BuildingRegistry.Initialize();
        
        // Create core systems
        _eventBus = new EventBus();
        _assetManager = new AssetManager();
        _gameLoop = new GameLoop();
        _stateManager = new StateManager(_eventBus, _gameLoop);
        
        // Subscribe to exit event
        _eventBus.Subscribe<GameExitRequest>(OnGameExitRequested);
        
        // Register states with factory methods
        _stateManager.RegisterState(() => new MenuState(_eventBus, _assetManager));
        _stateManager.RegisterState(() => new PlayState(_eventBus, _assetManager, _gameSettings));
        _stateManager.RegisterState(() => new SettingsState(_eventBus, _assetManager, _gameSettings));
        
        // Start with menu
        _stateManager.ChangeState<MenuState>();
        
        Console.WriteLine("Game initialized successfully");
    }
    
    /// <summary>
    /// Run the main game loop
    /// </summary>
    public void Run()
    {
        if (_gameLoop == null)
        {
            throw new InvalidOperationException("Game must be initialized before running");
        }
        
        // Override the default game loop run to check for exit
        _gameLoop.OnUpdate += CheckForExit;
        
        Console.WriteLine("Starting game loop");
        _gameLoop.Run();
        Console.WriteLine("Game loop ended");
    }
    
    /// <summary>
    /// Stop the game
    /// </summary>
    public void Stop()
    {
        _shouldExit = true;
        _gameLoop?.Stop();
    }
    
    private void CheckForExit(float deltaTime)
    {
        if (_shouldExit || Raylib.WindowShouldClose())
        {
            _gameLoop?.Stop();
        }
    }
    
    private void OnGameExitRequested(GameExitRequest request)
    {
        Console.WriteLine("Game exit requested");
        Stop();
    }
    
    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }
    
    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;
        
        if (disposing)
        {
            Console.WriteLine("Disposing game resources...");
            
            // Stop the game loop if running
            _gameLoop?.Stop();
            
            // Dispose managed resources in reverse order of creation
            _stateManager?.Dispose();
            _assetManager?.Dispose();
            
            // Clear event bus
            _eventBus?.Clear();
            
            // Close Raylib window
            if (Raylib.IsWindowReady())
            {
                Raylib.CloseWindow();
            }
            
            Console.WriteLine("Game resources disposed");
        }
        
        _disposed = true;
    }
}
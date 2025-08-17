using CityBuilder.Core;

namespace CityBuilder.States;

/// <summary>
/// Manages game state transitions using dependency injection
/// </summary>
public class StateManager : IDisposable
{
    private IGameState? _currentState;
    private readonly Dictionary<Type, Func<IGameState>> _stateFactories;
    private readonly EventBus _eventBus;
    private readonly GameLoop _gameLoop;
    
    public IGameState? CurrentState => _currentState;
    
    public StateManager(EventBus eventBus, GameLoop gameLoop)
    {
        _eventBus = eventBus;
        _gameLoop = gameLoop;
        _stateFactories = new Dictionary<Type, Func<IGameState>>();
        
        // Subscribe to game loop events
        _gameLoop.OnUpdate += Update;
        _gameLoop.OnFixedUpdate += FixedUpdate;
        _gameLoop.OnDraw += Draw;
        
        // Subscribe to state change events
        _eventBus.Subscribe<StateChangeRequest>(OnStateChangeRequested);
    }
    
    /// <summary>
    /// Register a state factory for dependency injection
    /// </summary>
    public void RegisterState<T>(Func<T> factory) where T : IGameState
    {
        _stateFactories[typeof(T)] = () => factory();
    }
    
    /// <summary>
    /// Change to a new state
    /// </summary>
    public void ChangeState<T>() where T : IGameState
    {
        var stateType = typeof(T);
        
        if (!_stateFactories.ContainsKey(stateType))
        {
            throw new InvalidOperationException($"State {stateType.Name} not registered");
        }
        
        // Exit current state
        _currentState?.Exit();
        
        // Create and enter new state
        _currentState = _stateFactories[stateType]();
        _gameLoop.ResetAccumulator(); // Reset timestep accumulator on state change
        _currentState.Enter();
        
        Console.WriteLine($"Changed state to: {stateType.Name}");
    }
    
    /// <summary>
    /// Change to a specific state instance (useful for passing data)
    /// </summary>
    public void ChangeState(IGameState newState)
    {
        _currentState?.Exit();
        _currentState = newState;
        _gameLoop.ResetAccumulator();
        _currentState.Enter();
        
        Console.WriteLine($"Changed state to: {newState.GetType().Name}");
    }
    
    private void Update(float deltaTime)
    {
        _currentState?.Update(deltaTime);
    }
    
    private void FixedUpdate(float fixedDeltaTime)
    {
        _currentState?.FixedUpdate(fixedDeltaTime);
    }
    
    private void Draw(float interpolationAlpha)
    {
        _currentState?.Draw(interpolationAlpha);
    }
    
    private void OnStateChangeRequested(StateChangeRequest request)
    {
        if (request.StateType != null && _stateFactories.ContainsKey(request.StateType))
        {
            var newState = _stateFactories[request.StateType]();
            ChangeState(newState);
        }
        else if (request.StateInstance != null)
        {
            ChangeState(request.StateInstance);
        }
    }
    
    public void Dispose()
    {
        // Unsubscribe from events to prevent memory leaks
        _gameLoop.OnUpdate -= Update;
        _gameLoop.OnFixedUpdate -= FixedUpdate;
        _gameLoop.OnDraw -= Draw;
        
        _eventBus.Unsubscribe<StateChangeRequest>(OnStateChangeRequested);
        
        // Dispose current state if it implements IDisposable
        if (_currentState is IDisposable disposableState)
        {
            disposableState.Dispose();
        }
    }
}

/// <summary>
/// Event for requesting state changes through the EventBus
/// </summary>
public class StateChangeRequest
{
    public Type? StateType { get; set; }
    public IGameState? StateInstance { get; set; }
    
    public StateChangeRequest(Type stateType)
    {
        StateType = stateType;
    }
    
    public StateChangeRequest(IGameState stateInstance)
    {
        StateInstance = stateInstance;
    }
}
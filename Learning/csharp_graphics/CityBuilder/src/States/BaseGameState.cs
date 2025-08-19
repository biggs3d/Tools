using CityBuilder.Core;

namespace CityBuilder.States;

/// <summary>
/// Base class for game states that handles common cleanup
/// </summary>
public abstract class BaseGameState : IGameState, IDisposable
{
    protected readonly EventBus EventBus;
    protected readonly AssetManager AssetManager;
    private readonly List<(Type, Delegate)> _subscriptions = new();
    private bool _disposed;
    
    protected BaseGameState(EventBus eventBus, AssetManager assetManager)
    {
        EventBus = eventBus;
        AssetManager = assetManager;
    }
    
    /// <summary>
    /// Subscribe to an event and track for automatic cleanup
    /// </summary>
    protected void Subscribe<T>(Action<T> handler) where T : class
    {
        EventBus.Subscribe(handler);
        _subscriptions.Add((typeof(T), handler));
    }
    
    /// <summary>
    /// Unsubscribe from a specific event
    /// </summary>
    protected void Unsubscribe<T>(Action<T> handler) where T : class
    {
        EventBus.Unsubscribe(handler);
        _subscriptions.RemoveAll(s => s.Item1 == typeof(T) && s.Item2.Equals(handler));
    }
    
    public abstract void Enter();
    public abstract void Update(float deltaTime);
    public abstract void FixedUpdate(float fixedDeltaTime);
    public abstract void Draw(float interpolationAlpha);
    
    public virtual void Exit()
    {
        // Automatically unsubscribe from all tracked events
        foreach (var (type, handler) in _subscriptions)
        {
            var unsubscribeMethod = EventBus.GetType()
                .GetMethod("Unsubscribe")!
                .MakeGenericMethod(type);
            unsubscribeMethod.Invoke(EventBus, new[] { handler });
        }
        _subscriptions.Clear();
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
            // Exit will unsubscribe from all events
            Exit();
            OnDispose();
        }
        
        _disposed = true;
    }
    
    /// <summary>
    /// Override to add custom disposal logic
    /// </summary>
    protected virtual void OnDispose()
    {
    }
}
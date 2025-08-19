namespace CityBuilder.Core;

/// <summary>
/// Simple pub-sub event system for decoupled communication between game systems
/// </summary>
public class EventBus
{
    private readonly Dictionary<Type, List<Delegate>> _subscribers = new();
    private readonly object _lock = new();
    
    /// <summary>
    /// Subscribe to events of type T
    /// </summary>
    public void Subscribe<T>(Action<T> handler) where T : class
    {
        lock (_lock)
        {
            var type = typeof(T);
            if (!_subscribers.ContainsKey(type))
            {
                _subscribers[type] = new List<Delegate>();
            }
            _subscribers[type].Add(handler);
        }
    }
    
    /// <summary>
    /// Unsubscribe from events of type T
    /// </summary>
    public void Unsubscribe<T>(Action<T> handler) where T : class
    {
        lock (_lock)
        {
            var type = typeof(T);
            if (_subscribers.TryGetValue(type, out var handlers))
            {
                handlers.Remove(handler);
                if (handlers.Count == 0)
                {
                    _subscribers.Remove(type);
                }
            }
        }
    }
    
    /// <summary>
    /// Publish an event to all subscribers
    /// </summary>
    public void Publish<T>(T eventData) where T : class
    {
        List<Delegate>? handlers = null;
        
        lock (_lock)
        {
            if (_subscribers.TryGetValue(typeof(T), out var subs))
            {
                handlers = new List<Delegate>(subs); // Copy to avoid lock during invocation
            }
        }
        
        if (handlers != null)
        {
            foreach (var handler in handlers)
            {
                try
                {
                    ((Action<T>)handler)(eventData);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error in event handler: {ex.Message}");
                }
            }
        }
    }
    
    /// <summary>
    /// Clear all subscriptions
    /// </summary>
    public void Clear()
    {
        lock (_lock)
        {
            _subscribers.Clear();
        }
    }
}
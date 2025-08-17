namespace CityBuilder.States;

/// <summary>
/// Interface for all game states (Menu, Play, Pause, etc.)
/// States should implement IDisposable if they manage resources or event subscriptions
/// </summary>
public interface IGameState
{
    /// <summary>
    /// Called when entering this state
    /// </summary>
    void Enter();
    
    /// <summary>
    /// Variable timestep update for input and animations
    /// </summary>
    void Update(float deltaTime);
    
    /// <summary>
    /// Fixed timestep update for simulation logic
    /// </summary>
    void FixedUpdate(float fixedDeltaTime);
    
    /// <summary>
    /// Draw the state with interpolation for smooth rendering
    /// </summary>
    void Draw(float interpolationAlpha);
    
    /// <summary>
    /// Called when exiting this state
    /// </summary>
    void Exit();
}
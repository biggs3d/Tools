using Xunit;
using Moq;
using CityBuilder.States;
using CityBuilder.Core;

namespace CityBuilder.Tests.States;

public class StateManagerTests : IDisposable
{
    private readonly EventBus _eventBus;
    private readonly GameLoop _gameLoop;
    private readonly StateManager _stateManager;
    private readonly Mock<IGameState> _mockState1;
    private readonly Mock<IGameState> _mockState2;
    
    public StateManagerTests()
    {
        _eventBus = new EventBus();
        _gameLoop = new GameLoop();
        _stateManager = new StateManager(_eventBus, _gameLoop);
        _mockState1 = new Mock<IGameState>();
        _mockState2 = new Mock<IGameState>();
    }
    
    [Fact]
    public void RegisterState_StoresFactory()
    {
        _stateManager.RegisterState(() => _mockState1.Object);
        
        // Should not throw when changing to registered state
        var exception = Record.Exception(() => _stateManager.ChangeState<IGameState>());
        Assert.Null(exception);
    }
    
    [Fact]
    public void ChangeState_ToUnregisteredState_Throws()
    {
        Assert.Throws<InvalidOperationException>(() => _stateManager.ChangeState<IGameState>());
    }
    
    [Fact]
    public void ChangeState_CallsExitOnCurrentState()
    {
        _stateManager.RegisterState(() => _mockState1.Object);
        _stateManager.RegisterState(() => _mockState2.Object);
        
        _stateManager.ChangeState<IGameState>();
        _stateManager.ChangeState<IGameState>();
        
        _mockState1.Verify(s => s.Exit(), Times.Once);
    }
    
    [Fact]
    public void ChangeState_CallsEnterOnNewState()
    {
        _stateManager.RegisterState(() => _mockState1.Object);
        _stateManager.ChangeState<IGameState>();
        
        _mockState1.Verify(s => s.Enter(), Times.Once);
    }
    
    [Fact]
    public void CurrentState_ReturnsActiveState()
    {
        _stateManager.RegisterState(() => _mockState1.Object);
        _stateManager.ChangeState<IGameState>();
        
        Assert.Equal(_mockState1.Object, _stateManager.CurrentState);
    }
    
    [Fact]
    public void ChangeState_WithInstance_Works()
    {
        _stateManager.ChangeState(_mockState1.Object);
        
        Assert.Equal(_mockState1.Object, _stateManager.CurrentState);
        _mockState1.Verify(s => s.Enter(), Times.Once);
    }
    
    [Fact]
    public void StateChangeRequest_ViaEventBus_ChangesState()
    {
        _stateManager.RegisterState(() => _mockState1.Object);
        
        _eventBus.Publish(new StateChangeRequest(typeof(IGameState)));
        
        Assert.Equal(_mockState1.Object, _stateManager.CurrentState);
    }
    
    [Fact]
    public void Dispose_UnsubscribesFromEvents()
    {
        var mockDisposableState = new Mock<IGameState>();
        var disposable = mockDisposableState.As<IDisposable>();
        
        _stateManager.ChangeState(mockDisposableState.Object);
        _stateManager.Dispose();
        
        disposable.Verify(d => d.Dispose(), Times.Once);
    }
    
    [Fact]
    public void Dispose_DisposesCurrentStateIfDisposable()
    {
        var mockDisposableState = new Mock<IGameState>();
        var disposable = mockDisposableState.As<IDisposable>();
        
        _stateManager.ChangeState(mockDisposableState.Object);
        _stateManager.Dispose();
        
        disposable.Verify(d => d.Dispose(), Times.Once);
    }
    
    public void Dispose()
    {
        _stateManager?.Dispose();
        _eventBus?.Clear();
    }
}

// Test state implementation for integration tests
public class TestState : BaseGameState
{
    public bool EnterCalled { get; private set; }
    public bool ExitCalled { get; private set; }
    public int UpdateCallCount { get; private set; }
    public int FixedUpdateCallCount { get; private set; }
    public int DrawCallCount { get; private set; }
    
    public TestState(EventBus eventBus, AssetManager assetManager) 
        : base(eventBus, assetManager)
    {
    }
    
    public override void Enter()
    {
        EnterCalled = true;
    }
    
    public override void Update(float deltaTime)
    {
        UpdateCallCount++;
    }
    
    public override void FixedUpdate(float fixedDeltaTime)
    {
        FixedUpdateCallCount++;
    }
    
    public override void Draw(float interpolationAlpha)
    {
        DrawCallCount++;
    }
    
    public override void Exit()
    {
        base.Exit();
        ExitCalled = true;
    }
}
using Xunit;
using CityBuilder.Core;
using System.Collections.Concurrent;

namespace CityBuilder.Tests.Core;

public class EventBusTests
{
    private class TestEvent
    {
        public string Message { get; set; } = "";
        public int Value { get; set; }
    }
    
    private class AnotherTestEvent
    {
        public bool Flag { get; set; }
    }
    
    [Fact]
    public void Subscribe_And_Publish_SingleHandler_Works()
    {
        var eventBus = new EventBus();
        string? receivedMessage = null;
        
        eventBus.Subscribe<TestEvent>(e => receivedMessage = e.Message);
        eventBus.Publish(new TestEvent { Message = "Hello World" });
        
        Assert.Equal("Hello World", receivedMessage);
    }
    
    [Fact]
    public void Subscribe_MultipleHandlers_AllReceiveEvent()
    {
        var eventBus = new EventBus();
        var receivedMessages = new List<string>();
        
        eventBus.Subscribe<TestEvent>(e => receivedMessages.Add("Handler1: " + e.Message));
        eventBus.Subscribe<TestEvent>(e => receivedMessages.Add("Handler2: " + e.Message));
        eventBus.Subscribe<TestEvent>(e => receivedMessages.Add("Handler3: " + e.Message));
        
        eventBus.Publish(new TestEvent { Message = "Test" });
        
        Assert.Equal(3, receivedMessages.Count);
        Assert.Contains("Handler1: Test", receivedMessages);
        Assert.Contains("Handler2: Test", receivedMessages);
        Assert.Contains("Handler3: Test", receivedMessages);
    }
    
    [Fact]
    public void Unsubscribe_RemovesHandler()
    {
        var eventBus = new EventBus();
        int callCount = 0;
        Action<TestEvent> handler = e => callCount++;
        
        eventBus.Subscribe(handler);
        eventBus.Publish(new TestEvent());
        Assert.Equal(1, callCount);
        
        eventBus.Unsubscribe(handler);
        eventBus.Publish(new TestEvent());
        Assert.Equal(1, callCount); // Should not increase
    }
    
    [Fact]
    public void Publish_WithNoSubscribers_DoesNotThrow()
    {
        var eventBus = new EventBus();
        var exception = Record.Exception(() => eventBus.Publish(new TestEvent()));
        Assert.Null(exception);
    }
    
    [Fact]
    public void DifferentEventTypes_AreIsolated()
    {
        var eventBus = new EventBus();
        bool testEventReceived = false;
        bool anotherEventReceived = false;
        
        eventBus.Subscribe<TestEvent>(e => testEventReceived = true);
        eventBus.Subscribe<AnotherTestEvent>(e => anotherEventReceived = true);
        
        eventBus.Publish(new TestEvent());
        
        Assert.True(testEventReceived);
        Assert.False(anotherEventReceived);
    }
    
    [Fact]
    public void Clear_RemovesAllSubscriptions()
    {
        var eventBus = new EventBus();
        int callCount = 0;
        
        eventBus.Subscribe<TestEvent>(e => callCount++);
        eventBus.Subscribe<AnotherTestEvent>(e => callCount++);
        
        eventBus.Clear();
        
        eventBus.Publish(new TestEvent());
        eventBus.Publish(new AnotherTestEvent());
        
        Assert.Equal(0, callCount);
    }
    
    [Fact]
    public void HandlerException_DoesNotPreventOtherHandlers()
    {
        var eventBus = new EventBus();
        bool handler1Called = false;
        bool handler3Called = false;
        
        eventBus.Subscribe<TestEvent>(e => handler1Called = true);
        eventBus.Subscribe<TestEvent>(e => throw new Exception("Handler 2 error"));
        eventBus.Subscribe<TestEvent>(e => handler3Called = true);
        
        eventBus.Publish(new TestEvent());
        
        Assert.True(handler1Called);
        Assert.True(handler3Called);
    }
    
    [Fact]
    public void ThreadSafety_ConcurrentSubscribeAndPublish()
    {
        var eventBus = new EventBus();
        var receivedEvents = new ConcurrentBag<int>();
        var tasks = new List<Task>();
        
        // Start multiple threads subscribing and publishing
        for (int i = 0; i < 10; i++)
        {
            int threadId = i;
            
            // Subscribe tasks
            tasks.Add(Task.Run(() =>
            {
                eventBus.Subscribe<TestEvent>(e => receivedEvents.Add(threadId * 1000 + e.Value));
            }));
            
            // Publish tasks
            tasks.Add(Task.Run(() =>
            {
                Thread.Sleep(10); // Small delay to ensure some subscriptions happen first
                eventBus.Publish(new TestEvent { Value = threadId });
            }));
        }
        
        Task.WaitAll(tasks.ToArray());
        
        // Should have received some events (exact count depends on timing)
        Assert.True(receivedEvents.Count > 0);
    }
    
    [Fact]
    public void Subscribe_InsideHandler_DoesNotCauseDeadlock()
    {
        var eventBus = new EventBus();
        bool secondHandlerCalled = false;
        
        eventBus.Subscribe<TestEvent>(e =>
        {
            if (e.Value == 1)
            {
                // Subscribe another handler from within a handler
                eventBus.Subscribe<TestEvent>(e2 =>
                {
                    if (e2.Value == 2)
                        secondHandlerCalled = true;
                });
            }
        });
        
        eventBus.Publish(new TestEvent { Value = 1 });
        eventBus.Publish(new TestEvent { Value = 2 });
        
        Assert.True(secondHandlerCalled);
    }
    
    [Fact]
    public void Unsubscribe_InsideHandler_Works()
    {
        var eventBus = new EventBus();
        int callCount = 0;
        Action<TestEvent>? handler = null;
        
        handler = e =>
        {
            callCount++;
            if (e.Value == 1)
            {
                eventBus.Unsubscribe(handler!);
            }
        };
        
        eventBus.Subscribe(handler);
        
        eventBus.Publish(new TestEvent { Value = 1 });
        eventBus.Publish(new TestEvent { Value = 2 });
        
        Assert.Equal(1, callCount); // Should only be called once
    }
}
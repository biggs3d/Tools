using Raylib_cs;
using CityBuilder.Core;
using System.Numerics;

namespace CityBuilder.States;

/// <summary>
/// Main menu state with basic UI
/// </summary>
public class MenuState : BaseGameState
{
    
    private readonly string[] _menuItems = { "Start Game", "Settings", "Credits", "Exit" };
    private int _selectedIndex = 0;
    private float _animationTime = 0f;
    
    public MenuState(EventBus eventBus, AssetManager assetManager) 
        : base(eventBus, assetManager)
    {
    }
    
    public override void Enter()
    {
        Console.WriteLine("Entered Menu State");
        _selectedIndex = 0;
        _animationTime = 0f;
    }
    
    public override void Update(float deltaTime)
    {
        _animationTime += deltaTime;
        
        // Handle menu navigation
        if (Raylib.IsKeyPressed(KeyboardKey.Up) || Raylib.IsKeyPressed(KeyboardKey.W))
        {
            _selectedIndex--;
            if (_selectedIndex < 0) _selectedIndex = _menuItems.Length - 1;
        }
        
        if (Raylib.IsKeyPressed(KeyboardKey.Down) || Raylib.IsKeyPressed(KeyboardKey.S))
        {
            _selectedIndex++;
            if (_selectedIndex >= _menuItems.Length) _selectedIndex = 0;
        }
        
        // Handle selection
        if (Raylib.IsKeyPressed(KeyboardKey.Enter) || Raylib.IsKeyPressed(KeyboardKey.Space))
        {
            HandleMenuSelection();
        }
        
        // Mouse support
        Vector2 mousePos = Raylib.GetMousePosition();
        int centerX = Raylib.GetScreenWidth() / 2;
        int startY = 250;
        int itemHeight = 60;
        
        for (int i = 0; i < _menuItems.Length; i++)
        {
            Rectangle itemRect = new Rectangle(centerX - 150, startY + i * itemHeight, 300, 50);
            if (Raylib.CheckCollisionPointRec(mousePos, itemRect))
            {
                _selectedIndex = i;
                if (Raylib.IsMouseButtonPressed(MouseButton.Left))
                {
                    HandleMenuSelection();
                }
            }
        }
    }
    
    public override void FixedUpdate(float fixedDeltaTime)
    {
        // Menu doesn't need fixed timestep simulation
    }
    
    public override void Draw(float interpolationAlpha)
    {
        Raylib.ClearBackground(new Color(20, 20, 30, 255));
        
        int screenWidth = Raylib.GetScreenWidth();
        int screenHeight = Raylib.GetScreenHeight();
        
        // Draw title with animation
        float titleY = 80 + MathF.Sin(_animationTime * 2) * 5;
        string title = "CITY BUILDER";
        int titleWidth = Raylib.MeasureText(title, 60);
        Raylib.DrawText(title, screenWidth / 2 - titleWidth / 2, (int)titleY, 60, Color.White);
        
        // Draw subtitle
        string subtitle = "Strategic Grid-Based Simulation";
        int subtitleWidth = Raylib.MeasureText(subtitle, 20);
        Raylib.DrawText(subtitle, screenWidth / 2 - subtitleWidth / 2, 150, 20, Color.Gray);
        
        // Draw menu items
        int centerX = screenWidth / 2;
        int startY = 250;
        int itemHeight = 60;
        
        for (int i = 0; i < _menuItems.Length; i++)
        {
            bool isSelected = i == _selectedIndex;
            int fontSize = isSelected ? 32 : 28;
            Color color = isSelected ? Color.Yellow : Color.White;
            
            // Draw selection background
            if (isSelected)
            {
                float pulseAlpha = (MathF.Sin(_animationTime * 4) + 1) * 0.5f;
                Color bgColor = new Color(255, 255, 0, (int)(30 * pulseAlpha));
                Rectangle bgRect = new Rectangle(centerX - 170, startY + i * itemHeight - 5, 340, 50);
                Raylib.DrawRectangleRec(bgRect, bgColor);
                
                // Draw selection arrows
                string arrow = ">";
                Raylib.DrawText(arrow, centerX - 200, startY + i * itemHeight, fontSize, color);
                Raylib.DrawText("<", centerX + 180, startY + i * itemHeight, fontSize, color);
            }
            
            // Draw menu text
            int textWidth = Raylib.MeasureText(_menuItems[i], fontSize);
            Raylib.DrawText(_menuItems[i], centerX - textWidth / 2, startY + i * itemHeight, fontSize, color);
        }
        
        // Draw instructions
        string instructions = "↑↓ Navigate    ENTER Select    ESC Back";
        int instructionsWidth = Raylib.MeasureText(instructions, 16);
        Raylib.DrawText(instructions, screenWidth / 2 - instructionsWidth / 2, screenHeight - 50, 16, Color.Gray);
        
        // Draw version
        Raylib.DrawText("v0.1.0 Prototype", 10, screenHeight - 30, 14, Color.DarkGray);
    }
    
    public override void Exit()
    {
        base.Exit(); // Handles event cleanup
        Console.WriteLine("Exited Menu State");
    }
    
    private void HandleMenuSelection()
    {
        switch (_selectedIndex)
        {
            case 0: // Start Game
                Console.WriteLine("Start Game selected");
                EventBus.Publish(new StateChangeRequest(typeof(PlayState)));
                break;
            case 1: // Settings
                Console.WriteLine("Settings selected (not implemented)");
                break;
            case 2: // Credits
                Console.WriteLine("Credits selected (not implemented)");
                break;
            case 3: // Exit
                Console.WriteLine("Exit selected");
                EventBus.Publish(new GameExitRequest());
                break;
        }
    }
}

/// <summary>
/// Event to request game exit
/// </summary>
public class GameExitRequest
{
}
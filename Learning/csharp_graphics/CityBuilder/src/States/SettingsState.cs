using System;
using CityBuilder.Core;
using Raylib_cs;

namespace CityBuilder.States;

/// <summary>
/// Settings menu state
/// </summary>
public class SettingsState : BaseGameState
{
    private readonly GameSettings _settings;
    
    private int _selectedOption = 0;
    private readonly string[] _options = new[]
    {
        "Driving Side",
        "Sound Volume",
        "Music Volume",
        "Back to Menu"
    };
    
    public SettingsState(EventBus eventBus, AssetManager assetManager, GameSettings settings)
        : base(eventBus, assetManager)
    {
        _settings = settings ?? throw new ArgumentNullException(nameof(settings));
    }
    
    public override void Enter()
    {
        Console.WriteLine("Entered Settings State");
        _selectedOption = 0;
    }
    
    public override void Update(float deltaTime)
    {
        HandleInput();
    }
    
    public override void FixedUpdate(float fixedDeltaTime)
    {
        // Settings menu doesn't need fixed timestep updates
    }
    
    private void HandleInput()
    {
        // Navigate menu
        if (Raylib.IsKeyPressed(KeyboardKey.Up))
        {
            _selectedOption = (_selectedOption - 1 + _options.Length) % _options.Length;
        }
        else if (Raylib.IsKeyPressed(KeyboardKey.Down))
        {
            _selectedOption = (_selectedOption + 1) % _options.Length;
        }
        
        // Adjust settings
        if (_selectedOption == 0) // Driving Side
        {
            if (Raylib.IsKeyPressed(KeyboardKey.Left) || Raylib.IsKeyPressed(KeyboardKey.Right))
            {
                _settings.IsRightHandDriving = !_settings.IsRightHandDriving;
                _settings.Save();
                Console.WriteLine($"Driving side changed to: {(_settings.IsRightHandDriving ? "Right" : "Left")}-hand");
            }
        }
        else if (_selectedOption == 1) // Sound Volume
        {
            if (Raylib.IsKeyPressed(KeyboardKey.Left))
            {
                _settings.SoundVolume = Math.Max(0f, _settings.SoundVolume - 0.1f);
                _settings.Save();
            }
            else if (Raylib.IsKeyPressed(KeyboardKey.Right))
            {
                _settings.SoundVolume = Math.Min(1f, _settings.SoundVolume + 0.1f);
                _settings.Save();
            }
        }
        else if (_selectedOption == 2) // Music Volume
        {
            if (Raylib.IsKeyPressed(KeyboardKey.Left))
            {
                _settings.MusicVolume = Math.Max(0f, _settings.MusicVolume - 0.1f);
                _settings.Save();
            }
            else if (Raylib.IsKeyPressed(KeyboardKey.Right))
            {
                _settings.MusicVolume = Math.Min(1f, _settings.MusicVolume + 0.1f);
                _settings.Save();
            }
        }
        
        // Select option
        if (Raylib.IsKeyPressed(KeyboardKey.Enter) || Raylib.IsKeyPressed(KeyboardKey.Space))
        {
            if (_selectedOption == 3) // Back
            {
                EventBus.Publish(new StateChangeRequest(typeof(MenuState)));
            }
        }
        
        // Quick escape
        if (Raylib.IsKeyPressed(KeyboardKey.Escape))
        {
            EventBus.Publish(new StateChangeRequest(typeof(MenuState)));
        }
    }
    
    public override void Draw(float interpolationAlpha)
    {
        Raylib.ClearBackground(new Color(20, 20, 30, 255));
        
        int screenWidth = Raylib.GetScreenWidth();
        int screenHeight = Raylib.GetScreenHeight();
        
        // Title
        const string title = "SETTINGS";
        int titleWidth = Raylib.MeasureText(title, 40);
        Raylib.DrawText(title, (screenWidth - titleWidth) / 2, 100, 40, Color.White);
        
        // Draw options
        int startY = 200;
        int spacing = 50;
        
        for (int i = 0; i < _options.Length; i++)
        {
            Color color = i == _selectedOption ? Color.Yellow : Color.Gray;
            string optionText = _options[i];
            
            // Add current value for settings
            if (i == 0) // Driving Side
            {
                optionText += $": {(_settings.IsRightHandDriving ? "Right-hand" : "Left-hand")}";
            }
            else if (i == 1) // Sound Volume
            {
                optionText += $": {(int)(_settings.SoundVolume * 100)}%";
            }
            else if (i == 2) // Music Volume
            {
                optionText += $": {(int)(_settings.MusicVolume * 100)}%";
            }
            
            int textWidth = Raylib.MeasureText(optionText, 24);
            Raylib.DrawText(optionText, (screenWidth - textWidth) / 2, startY + i * spacing, 24, color);
            
            // Draw arrow indicators for selected option
            if (i == _selectedOption && i < 3)
            {
                Raylib.DrawText("<", (screenWidth - textWidth) / 2 - 30, startY + i * spacing, 24, Color.Yellow);
                Raylib.DrawText(">", (screenWidth + textWidth) / 2 + 10, startY + i * spacing, 24, Color.Yellow);
            }
        }
        
        // Instructions
        const string instructions = "↑↓ Navigate • ←→ Change Value • Enter/Space Select • ESC Back";
        int instructionsWidth = Raylib.MeasureText(instructions, 16);
        Raylib.DrawText(instructions, (screenWidth - instructionsWidth) / 2, screenHeight - 50, 16, Color.DarkGray);
    }
    
    public override void Exit()
    {
        base.Exit(); // Handles event cleanup
        Console.WriteLine("Exited Settings State");
    }
}
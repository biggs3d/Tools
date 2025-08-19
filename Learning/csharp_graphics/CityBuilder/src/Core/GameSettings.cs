using System;
using System.IO;
using System.Text.Json;

namespace CityBuilder.Core;

/// <summary>
/// Game settings that persist between sessions
/// </summary>
public class GameSettings
{
    private const string SettingsFile = "settings.json";
    
    /// <summary>
    /// Whether to use right-hand driving (vehicles on left side of road)
    /// or left-hand driving (vehicles on right side of road)
    /// </summary>
    public bool IsRightHandDriving { get; set; } = true;
    
    /// <summary>
    /// Sound effects volume (0.0 to 1.0)
    /// </summary>
    public float SoundVolume { get; set; } = 0.7f;
    
    /// <summary>
    /// Music volume (0.0 to 1.0)
    /// </summary>
    public float MusicVolume { get; set; } = 0.5f;
    
    /// <summary>
    /// Whether to show FPS counter
    /// </summary>
    public bool ShowFPS { get; set; } = false;
    
    /// <summary>
    /// Whether to enable vsync
    /// </summary>
    public bool VSync { get; set; } = true;
    
    /// <summary>
    /// Load settings from file or create defaults
    /// </summary>
    public static GameSettings Load()
    {
        try
        {
            if (File.Exists(SettingsFile))
            {
                string json = File.ReadAllText(SettingsFile);
                var settings = JsonSerializer.Deserialize<GameSettings>(json);
                if (settings != null)
                {
                    Console.WriteLine($"Settings loaded: Driving={settings.IsRightHandDriving switch { true => "Right", false => "Left" }}-hand");
                    return settings;
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to load settings: {ex.Message}");
        }
        
        // Return defaults if file doesn't exist or failed to load
        var defaultSettings = new GameSettings();
        defaultSettings.Save(); // Save defaults
        return defaultSettings;
    }
    
    /// <summary>
    /// Save settings to file
    /// </summary>
    public void Save()
    {
        try
        {
            var options = new JsonSerializerOptions
            {
                WriteIndented = true
            };
            string json = JsonSerializer.Serialize(this, options);
            File.WriteAllText(SettingsFile, json);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to save settings: {ex.Message}");
        }
    }
}
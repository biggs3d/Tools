using Raylib_cs;

namespace CityBuilder.Core;

/// <summary>
/// Manages loading and caching of game assets (textures, sounds, etc.)
/// </summary>
public sealed class AssetManager : IDisposable
{
    private readonly Dictionary<string, Texture2D> _textures = new();
    private readonly Dictionary<string, Sound> _sounds = new();
    private readonly Dictionary<string, Font> _fonts = new();
    private Texture2D? _placeholderTexture;
    private bool _disposed;
    
    /// <summary>
    /// Load or retrieve a cached texture
    /// </summary>
    public Texture2D GetTexture(string path)
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(AssetManager));
            
        if (!_textures.ContainsKey(path))
        {
            if (!File.Exists(path))
            {
                Console.WriteLine($"Warning: Texture not found: {path}");
                return GetPlaceholderTexture();
            }
            
            _textures[path] = Raylib.LoadTexture(path);
            Console.WriteLine($"Loaded texture: {path}");
        }
        
        return _textures[path];
    }
    
    /// <summary>
    /// Load or retrieve a cached sound
    /// </summary>
    public Sound GetSound(string path)
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(AssetManager));
            
        if (!_sounds.ContainsKey(path))
        {
            if (!File.Exists(path))
            {
                Console.WriteLine($"Warning: Sound not found: {path}");
                return new Sound(); // Return empty sound
            }
            
            _sounds[path] = Raylib.LoadSound(path);
            Console.WriteLine($"Loaded sound: {path}");
        }
        
        return _sounds[path];
    }
    
    /// <summary>
    /// Load or retrieve a cached font
    /// </summary>
    public Font GetFont(string path, int fontSize = 32)
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(AssetManager));
            
        var key = $"{path}_{fontSize}";
        if (!_fonts.ContainsKey(key))
        {
            if (!File.Exists(path))
            {
                Console.WriteLine($"Using default font for: {path}");
                _fonts[key] = Raylib.GetFontDefault();
            }
            else
            {
                _fonts[key] = Raylib.LoadFontEx(path, fontSize, null, 0);
                Console.WriteLine($"Loaded font: {path} at size {fontSize}");
            }
        }
        
        return _fonts[key];
    }
    
    /// <summary>
    /// Preload multiple assets at once
    /// </summary>
    public void PreloadTextures(params string[] paths)
    {
        foreach (var path in paths)
        {
            GetTexture(path);
        }
    }
    
    /// <summary>
    /// Unload a specific texture from cache
    /// </summary>
    public void UnloadTexture(string path)
    {
        if (_textures.TryGetValue(path, out var texture))
        {
            Raylib.UnloadTexture(texture);
            _textures.Remove(path);
        }
    }
    
    /// <summary>
    /// Get the number of cached assets
    /// </summary>
    public (int textures, int sounds, int fonts) GetCacheStats()
    {
        return (_textures.Count, _sounds.Count, _fonts.Count);
    }
    
    /// <summary>
    /// Get or create a placeholder texture for missing assets
    /// </summary>
    private Texture2D GetPlaceholderTexture()
    {
        if (_placeholderTexture == null)
        {
            // Create a 2x2 magenta texture as placeholder
            Image img = Raylib.GenImageColor(2, 2, Color.Magenta);
            _placeholderTexture = Raylib.LoadTextureFromImage(img);
            Raylib.UnloadImage(img);
            Console.WriteLine("Created placeholder texture");
        }
        
        return _placeholderTexture.Value;
    }
    
    public void Dispose()
    {
        if (_disposed) return;
        
        foreach (var texture in _textures.Values)
        {
            Raylib.UnloadTexture(texture);
        }
        _textures.Clear();
        
        foreach (var sound in _sounds.Values)
        {
            Raylib.UnloadSound(sound);
        }
        _sounds.Clear();
        
        foreach (var font in _fonts.Values)
        {
            // Skip unloading default font
            if (font.Texture.Id != Raylib.GetFontDefault().Texture.Id)
            {
                Raylib.UnloadFont(font);
            }
        }
        _fonts.Clear();
        
        // Dispose placeholder texture if created
        if (_placeholderTexture.HasValue)
        {
            Raylib.UnloadTexture(_placeholderTexture.Value);
        }
        
        _disposed = true;
        Console.WriteLine("AssetManager disposed");
    }
}
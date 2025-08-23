using System;
using System.Collections.Generic;
using CityBuilder.Grid;

namespace CityBuilder.Simulation.Buildings;

/// <summary>
/// Central registry for all building type definitions
/// </summary>
public static class BuildingRegistry
{
    private static readonly Dictionary<TileType, IBuildingDefinition> _definitions = new();
    private static bool _initialized = false;
    
    /// <summary>
    /// Initialize the registry with all building definitions
    /// </summary>
    public static void Initialize()
    {
        if (_initialized) return;
        
        // Register all building types
        Register(new WaterGathererDefinition());
        Register(new OreExtractorDefinition());
        Register(new RockHarvesterDefinition());
        Register(new FactoryTier2Definition());
        Register(new ResidentialDefinition());
        
        _initialized = true;
        Console.WriteLine($"BuildingRegistry initialized with {_definitions.Count} building types");
    }
    
    /// <summary>
    /// Register a building definition
    /// </summary>
    private static void Register(IBuildingDefinition definition)
    {
        _definitions[definition.TileType] = definition;
    }
    
    /// <summary>
    /// Get the definition for a tile type
    /// </summary>
    public static IBuildingDefinition? GetDefinition(TileType type)
    {
        return _definitions.TryGetValue(type, out var definition) ? definition : null;
    }
    
    /// <summary>
    /// Check if a tile type is a registered building
    /// </summary>
    public static bool IsBuilding(TileType type)
    {
        return _definitions.ContainsKey(type);
    }
    
    /// <summary>
    /// Get all registered building definitions
    /// </summary>
    public static IEnumerable<IBuildingDefinition> GetAllDefinitions()
    {
        return _definitions.Values;
    }
}
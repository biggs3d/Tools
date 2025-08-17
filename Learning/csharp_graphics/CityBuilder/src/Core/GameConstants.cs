namespace CityBuilder.Core
{
    /// <summary>
    /// Central location for all game constants and configuration values
    /// </summary>
    public static class GameConstants
    {
        // Tile dimensions
        public const int TileSize = 32;
        public const int TileCenterOffset = TileSize / 2;
        
        // Simulation parameters
        public const float FixedTimestep = 1f / 30f; // 30Hz simulation
        public const float TaskGenerationInterval = 10f; // Generate tasks every 10 seconds
        
        // Vehicle parameters
        public const float DefaultVehicleSpeed = 64f; // pixels per second
        public const float VehicleLoadingTime = 2f; // seconds
        public const float VehicleUnloadingTime = 1.5f; // seconds
        public const int MaxVehicles = 20;
        
        // Pathfinding parameters
        public const int PathCacheMaxSize = 1000; // Maximum cached paths
        public const float DiagonalMovementCost = 1.41421356f; // sqrt(2)
        public const float CardinalMovementCost = 1.0f;
        
        // Pool parameters
        public const int VehiclePoolInitialSize = 5;
        public const int VehiclePoolMaxSize = 100;
    }
}
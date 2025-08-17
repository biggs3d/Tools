using System;
using System.Numerics;
using CityBuilder.Core;

namespace CityBuilder.Simulation
{
    public class Vehicle
    {
        private readonly GameSettings _gameSettings;
        
        public int Id { get; }
        public Vector2 Position { get; private set; }
        public Vector2 PreviousPosition { get; private set; }
        public Vector2 InterpolatedPosition { get; private set; }
        public Vector2Int TilePosition => new Vector2Int(
            (int)MathF.Floor(Position.X / GameConstants.TileSize),
            (int)MathF.Floor(Position.Y / GameConstants.TileSize)
        );
        
        public VehicleState State { get; private set; }
        public Path? CurrentPath { get; private set; }
        public DeliveryTask? CurrentTask { get; private set; }
        public float Speed { get; set; }
        public float StateTimer { get; private set; }
        
        public Vector2Int? HomeHub { get; set; }
        
        public Vehicle(int id, GameSettings gameSettings)
        {
            Id = id;
            _gameSettings = gameSettings ?? throw new ArgumentNullException(nameof(gameSettings));
            Speed = GameConstants.DefaultVehicleSpeed;
            State = VehicleState.Idle;
            Position = Vector2.Zero;
            PreviousPosition = Position;
            InterpolatedPosition = Position;
        }
        
        public void Initialize(Vector2Int hubPosition)
        {
            HomeHub = hubPosition;
            var worldPos = new Vector2(
                hubPosition.X * GameConstants.TileSize + GameConstants.TileCenterOffset,
                hubPosition.Y * GameConstants.TileSize + GameConstants.TileCenterOffset
            );
            Position = worldPos;
            PreviousPosition = worldPos;
            InterpolatedPosition = worldPos;
            State = VehicleState.Idle;
        }
        
        public void AssignTask(DeliveryTask task, Path pickupPath)
        {
            if (State != VehicleState.Idle)
                throw new InvalidOperationException("Vehicle must be idle to accept new task");
            
            CurrentTask = task;
            CurrentPath = pickupPath;
            State = VehicleState.MovingToPickup;
            StateTimer = 0;
        }
        
        public void SetDeliveryPath(Path deliveryPath)
        {
            if (State != VehicleState.Loading)
                throw new InvalidOperationException("Vehicle must be loading to set delivery path");
            
            CurrentPath = deliveryPath;
            State = VehicleState.MovingToDelivery;
            StateTimer = 0;
        }
        
        public void SetReturnPath(Path returnPath)
        {
            if (State != VehicleState.Unloading)
                throw new InvalidOperationException("Vehicle must be unloading to set return path");
            
            CurrentPath = returnPath;
            CurrentTask = null;
            State = VehicleState.ReturningToHub;
            StateTimer = 0;
        }
        
        public void Update(float deltaTime)
        {
            StateTimer += deltaTime;
            PreviousPosition = Position;
            
            switch (State)
            {
                case VehicleState.Idle:
                    break;
                    
                case VehicleState.MovingToPickup:
                case VehicleState.MovingToDelivery:
                case VehicleState.ReturningToHub:
                    UpdateMovement(deltaTime);
                    break;
                    
                case VehicleState.Loading:
                    if (StateTimer >= GameConstants.VehicleLoadingTime)
                    {
                        OnLoadingComplete();
                    }
                    break;
                    
                case VehicleState.Unloading:
                    if (StateTimer >= GameConstants.VehicleUnloadingTime)
                    {
                        OnUnloadingComplete();
                    }
                    break;
            }
        }
        
        public void UpdateInterpolation(float alpha)
        {
            InterpolatedPosition = Vector2.Lerp(PreviousPosition, Position, alpha);
        }
        
        private void UpdateMovement(float deltaTime)
        {
            if (CurrentPath == null || CurrentPath.IsComplete)
            {
                OnPathComplete();
                return;
            }
            
            var currentNode = CurrentPath.CurrentNode;
            if (!currentNode.HasValue)
                return;
            
            // Calculate base target position (center of tile)
            var targetWorldPos = new Vector2(
                currentNode.Value.X * GameConstants.TileSize + GameConstants.TileCenterOffset,
                currentNode.Value.Y * GameConstants.TileSize + GameConstants.TileCenterOffset
            );
            
            // Apply lane offset based on driving direction and movement direction
            targetWorldPos = ApplyLaneOffset(targetWorldPos, currentNode.Value, CurrentPath.PeekNext());
            
            var direction = targetWorldPos - Position;
            var distance = direction.Length();
            
            if (distance <= 2f)
            {
                Position = targetWorldPos;
                CurrentPath.Advance();
            }
            else
            {
                var moveDistance = Speed * deltaTime;
                if (moveDistance >= distance)
                {
                    Position = targetWorldPos;
                    CurrentPath.Advance();
                }
                else
                {
                    direction = Vector2.Normalize(direction);
                    Position += direction * moveDistance;
                }
            }
        }
        
        private void OnPathComplete()
        {
            switch (State)
            {
                case VehicleState.MovingToPickup:
                    State = VehicleState.Loading;
                    StateTimer = 0;
                    CurrentPath = null;
                    break;
                    
                case VehicleState.MovingToDelivery:
                    State = VehicleState.Unloading;
                    StateTimer = 0;
                    CurrentPath = null;
                    break;
                    
                case VehicleState.ReturningToHub:
                    State = VehicleState.Idle;
                    StateTimer = 0;
                    CurrentPath = null;
                    CurrentTask = null;
                    break;
            }
        }
        
        private void OnLoadingComplete()
        {
        }
        
        private void OnUnloadingComplete()
        {
        }
        
        public void Reset()
        {
            State = VehicleState.Idle;
            CurrentPath = null;
            CurrentTask = null;
            StateTimer = 0;
            
            if (HomeHub.HasValue)
            {
                var worldPos = new Vector2(
                    HomeHub.Value.X * GameConstants.TileSize + GameConstants.TileCenterOffset,
                    HomeHub.Value.Y * GameConstants.TileSize + GameConstants.TileCenterOffset
                );
                Position = worldPos;
                PreviousPosition = worldPos;
                InterpolatedPosition = worldPos;
            }
        }
        
        private Vector2 ApplyLaneOffset(Vector2 basePosition, Vector2Int currentTile, Vector2Int? nextTile)
        {
            if (!nextTile.HasValue)
                return basePosition;
            
            // Calculate movement direction
            var dx = nextTile.Value.X - currentTile.X;
            var dy = nextTile.Value.Y - currentTile.Y;
            
            // Lane offset amount (1/4 of tile size for clear separation)
            float laneOffset = GameConstants.TileSize * 0.25f;
            
            // Apply offset perpendicular to movement direction
            // Right-hand driving: vehicles on left side of road (from their perspective)
            // Left-hand driving: vehicles on right side of road (from their perspective)
            Vector2 offset = Vector2.Zero;
            
            if (dx != 0) // Moving horizontally
            {
                // For horizontal movement, offset vertically
                float offsetDir = _gameSettings.IsRightHandDriving ? -1f : 1f;
                offset.Y = dx * offsetDir * laneOffset;
            }
            else if (dy != 0) // Moving vertically
            {
                // For vertical movement, offset horizontally
                float offsetDir = _gameSettings.IsRightHandDriving ? 1f : -1f;
                offset.X = dy * offsetDir * laneOffset;
            }
            
            return basePosition + offset;
        }
    }
}
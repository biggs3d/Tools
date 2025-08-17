using System;
using System.Numerics;
using CityBuilder.Core;

namespace CityBuilder.Simulation
{
    public class Vehicle
    {
        
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
        
        public Vehicle(int id)
        {
            Id = id;
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
            
            var targetWorldPos = new Vector2(
                currentNode.Value.X * GameConstants.TileSize + GameConstants.TileCenterOffset,
                currentNode.Value.Y * GameConstants.TileSize + GameConstants.TileCenterOffset
            );
            
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
    }
}
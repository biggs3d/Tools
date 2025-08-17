using System;
using System.Collections.Generic;
using CityBuilder.Core;

namespace CityBuilder.Simulation
{
    public class VehiclePool
    {
        private readonly Queue<Vehicle> _availableVehicles;
        private readonly List<Vehicle> _activeVehicles;
        private readonly GameSettings _gameSettings;
        private int _nextId;
        private readonly int _maxPoolSize;
        
        public IReadOnlyList<Vehicle> ActiveVehicles => _activeVehicles;
        public int AvailableCount => _availableVehicles.Count;
        public int ActiveCount => _activeVehicles.Count;
        public int TotalCount => AvailableCount + ActiveCount;
        
        public VehiclePool(int initialSize = 10, int maxSize = 100, GameSettings? gameSettings = null)
        {
            _maxPoolSize = maxSize;
            _gameSettings = gameSettings ?? new GameSettings(); // Use defaults if not provided
            _availableVehicles = new Queue<Vehicle>(initialSize);
            _activeVehicles = new List<Vehicle>(initialSize);
            _nextId = 0;
            
            for (int i = 0; i < initialSize; i++)
            {
                var vehicle = new Vehicle(_nextId++, _gameSettings);
                _availableVehicles.Enqueue(vehicle);
            }
        }
        
        public Vehicle? Acquire()
        {
            Vehicle? vehicle = null;
            
            if (_availableVehicles.Count > 0)
            {
                vehicle = _availableVehicles.Dequeue();
            }
            else if (TotalCount < _maxPoolSize)
            {
                vehicle = new Vehicle(_nextId++, _gameSettings);
            }
            
            if (vehicle != null)
            {
                _activeVehicles.Add(vehicle);
            }
            
            return vehicle;
        }
        
        public void Release(Vehicle vehicle)
        {
            if (vehicle == null)
                throw new ArgumentNullException(nameof(vehicle));
            
            if (!_activeVehicles.Remove(vehicle))
                throw new InvalidOperationException("Vehicle not found in active list");
            
            vehicle.Reset();
            _availableVehicles.Enqueue(vehicle);
        }
        
        public void ReleaseAll()
        {
            foreach (var vehicle in _activeVehicles)
            {
                vehicle.Reset();
                _availableVehicles.Enqueue(vehicle);
            }
            _activeVehicles.Clear();
        }
        
        public void Update(float deltaTime)
        {
            foreach (var vehicle in _activeVehicles)
            {
                vehicle.Update(deltaTime);
            }
        }
        
        public void UpdateInterpolation(float alpha)
        {
            foreach (var vehicle in _activeVehicles)
            {
                vehicle.UpdateInterpolation(alpha);
            }
        }
        
        public void Clear()
        {
            _activeVehicles.Clear();
            _availableVehicles.Clear();
            _nextId = 0;
        }
    }
}
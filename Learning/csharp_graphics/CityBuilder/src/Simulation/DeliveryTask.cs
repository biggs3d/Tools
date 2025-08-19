using System;
using CityBuilder.Core;

namespace CityBuilder.Simulation
{
    public class DeliveryTask
    {
        public int Id { get; }
        public Vector2Int PickupLocation { get; }
        public Vector2Int DeliveryLocation { get; }
        public string DeliveryType { get; }
        public int Priority { get; }
        public float CreatedTime { get; }
        public bool IsAssigned { get; set; }
        public bool IsCompleted { get; set; }
        
        public DeliveryTask(int id, Vector2Int pickup, Vector2Int delivery, string type, int priority, float createdTime)
        {
            Id = id;
            PickupLocation = pickup;
            DeliveryLocation = delivery;
            DeliveryType = type ?? "goods";
            Priority = priority;
            CreatedTime = createdTime;
            IsAssigned = false;
            IsCompleted = false;
        }
    }
}
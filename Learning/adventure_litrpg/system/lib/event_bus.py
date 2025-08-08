#!/usr/bin/env python3
"""
Event Bus System for LitRPG Adventure
Provides automatic synchronization between game components
"""

from typing import Dict, List, Callable, Any
from pathlib import Path
import json
import logging
from datetime import datetime

class EventBus:
    """Central event system for game state changes"""
    
    def __init__(self):
        self.listeners = {}
        self.event_history = []
        self.logger = logging.getLogger(__name__)
        
    def subscribe(self, event_name: str, callback: Callable):
        """Subscribe to an event"""
        if event_name not in self.listeners:
            self.listeners[event_name] = []
        self.listeners[event_name].append(callback)
        self.logger.debug(f"Subscribed {callback.__name__} to {event_name}")
        
    def unsubscribe(self, event_name: str, callback: Callable):
        """Unsubscribe from an event"""
        if event_name in self.listeners:
            self.listeners[event_name].remove(callback)
            
    def emit(self, event_name: str, data: Dict = None):
        """Emit an event to all subscribers"""
        if data is None:
            data = {}
            
        # Add metadata
        data['event'] = event_name
        data['timestamp'] = datetime.now().isoformat()
        
        # Record in history
        self.event_history.append(data)
        
        # Call all listeners
        if event_name in self.listeners:
            for callback in self.listeners[event_name]:
                try:
                    callback(data)
                    self.logger.debug(f"Called {callback.__name__} for {event_name}")
                except Exception as e:
                    self.logger.error(f"Error in {callback.__name__}: {e}")
                    
    def get_history(self, limit: int = 100) -> List[Dict]:
        """Get recent event history"""
        return self.event_history[-limit:]


class GameEventHandler:
    """Handles game-specific events and coordinates components"""
    
    def __init__(self, state_dir: str = "session/state"):
        self.bus = EventBus()
        self.state_dir = Path(state_dir)
        # Ensure state directory exists
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.setup_handlers()
        
    def setup_handlers(self):
        """Setup all event handlers"""
        # Level up events
        self.bus.subscribe('level_up', self.on_level_up)
        self.bus.subscribe('xp_gained', self.on_xp_gained)
        
        # Combat events
        self.bus.subscribe('combat_start', self.on_combat_start)
        self.bus.subscribe('combat_end', self.on_combat_end)
        self.bus.subscribe('enemy_defeated', self.on_enemy_defeated)
        self.bus.subscribe('damage_dealt', self.on_damage_dealt)
        self.bus.subscribe('damage_taken', self.on_damage_taken)
        
        # Item events
        self.bus.subscribe('item_acquired', self.on_item_acquired)
        self.bus.subscribe('item_used', self.on_item_used)
        self.bus.subscribe('item_equipped', self.on_item_equipped)
        
        # Status effect events
        self.bus.subscribe('status_applied', self.on_status_applied)
        self.bus.subscribe('status_removed', self.on_status_removed)
        
        # Story events
        self.bus.subscribe('quest_started', self.on_quest_started)
        self.bus.subscribe('quest_completed', self.on_quest_completed)
        self.bus.subscribe('area_entered', self.on_area_entered)
        
    def on_level_up(self, data: Dict):
        """Handle level up event"""
        # Update progression history
        progression_file = self.state_dir / "progression_history.json"
        if progression_file.exists():
            with open(progression_file, 'r') as f:
                history = json.load(f)
        else:
            history = {"checkpoints": [], "achievements": []}
            
        checkpoint = {
            "level": data.get("new_level"),
            "timestamp": data.get("timestamp"),
            "stats": data.get("stats", {}),
            "location": data.get("location", "Unknown"),
            "total_xp": data.get("total_xp", 0)
        }
        
        history["checkpoints"].append(checkpoint)
        
        # Check for achievements
        if data.get("new_level") == 5:
            history["achievements"].append({
                "name": "First Milestone",
                "description": "Reached Level 5",
                "timestamp": data.get("timestamp")
            })
        elif data.get("new_level") == 10:
            history["achievements"].append({
                "name": "Double Digits",
                "description": "Reached Level 10",
                "timestamp": data.get("timestamp")
            })
            
        # Save updated history
        with open(progression_file, 'w') as f:
            json.dump(history, f, indent=2)
            
        # Log the event
        self.log_event(f"LEVEL UP: Reached level {data.get('new_level')}")
        
    def on_xp_gained(self, data: Dict):
        """Handle XP gain event"""
        self.log_event(f"XP GAINED: +{data.get('amount', 0)} XP")
        
    def on_combat_start(self, data: Dict):
        """Handle combat start"""
        self.log_event(f"COMBAT: Engaged {data.get('enemy', 'unknown')}")
        
    def on_combat_end(self, data: Dict):
        """Handle combat end"""
        outcome = data.get('outcome', 'unknown')
        self.log_event(f"COMBAT END: {outcome}")
        
    def on_enemy_defeated(self, data: Dict):
        """Handle enemy defeat"""
        enemy = data.get('enemy', 'unknown')
        xp = data.get('xp', 0)
        self.log_event(f"VICTORY: Defeated {enemy} (+{xp} XP)")
        
    def on_damage_dealt(self, data: Dict):
        """Handle damage dealt"""
        amount = data.get('amount', 0)
        target = data.get('target', 'enemy')
        self.log_event(f"DAMAGE: Dealt {amount} to {target}")
        
    def on_damage_taken(self, data: Dict):
        """Handle damage taken"""
        amount = data.get('amount', 0)
        source = data.get('source', 'unknown')
        self.log_event(f"DAMAGE: Took {amount} from {source}")
        
    def on_item_acquired(self, data: Dict):
        """Handle item acquisition"""
        item = data.get('item', 'unknown')
        self.log_event(f"ITEM: Acquired {item}")
        
    def on_item_used(self, data: Dict):
        """Handle item use"""
        item = data.get('item', 'unknown')
        effect = data.get('effect', '')
        self.log_event(f"ITEM: Used {item} {effect}")
        
    def on_item_equipped(self, data: Dict):
        """Handle item equip"""
        item = data.get('item', 'unknown')
        slot = data.get('slot', '')
        self.log_event(f"EQUIP: {item} equipped to {slot}")
        
    def on_status_applied(self, data: Dict):
        """Handle status effect application"""
        status = data.get('status', 'unknown')
        duration = data.get('duration', 0)
        self.log_event(f"STATUS: {status} applied for {duration} turns")
        
    def on_status_removed(self, data: Dict):
        """Handle status effect removal"""
        status = data.get('status', 'unknown')
        self.log_event(f"STATUS: {status} removed")
        
    def on_quest_started(self, data: Dict):
        """Handle quest start"""
        quest = data.get('quest', 'unknown')
        self.log_event(f"QUEST: Started '{quest}'")
        
    def on_quest_completed(self, data: Dict):
        """Handle quest completion"""
        quest = data.get('quest', 'unknown')
        rewards = data.get('rewards', {})
        self.log_event(f"QUEST: Completed '{quest}'")
        
    def on_area_entered(self, data: Dict):
        """Handle area entry"""
        area = data.get('area', 'unknown')
        level = data.get('level', 1)
        self.log_event(f"AREA: Entered {area} (Level {level})")
        
    def log_event(self, message: str):
        """Log an event to the session log"""
        log_file = self.state_dir.parent / "narrative" / "session_log.md"
        
        # Ensure directory exists
        log_file.parent.mkdir(parents=True, exist_ok=True)
        
        # Append to log
        timestamp = datetime.now().strftime("%H:%M:%S")
        with open(log_file, 'a') as f:
            f.write(f"[{timestamp}] {message}\n")
            
    def emit(self, event_name: str, data: Dict = None):
        """Convenience method to emit events"""
        self.bus.emit(event_name, data)


# Global event handler instance
_event_handler = None

def get_event_handler() -> GameEventHandler:
    """Get or create the global event handler"""
    global _event_handler
    if _event_handler is None:
        _event_handler = GameEventHandler()
    return _event_handler

def emit_event(event_name: str, data: Dict = None):
    """Convenience function to emit events globally"""
    handler = get_event_handler()
    handler.emit(event_name, data)
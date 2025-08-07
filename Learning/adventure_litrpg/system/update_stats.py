#!/usr/bin/env python3
"""Helper script to update character stats properly"""

import json
import sys
from pathlib import Path

def update_stats(name="Steve"):
    """Update Steve's stats to current Level 4 status"""
    
    # Level 4 Berserker stats after allocation
    stats = {
        "name": name,
        "class": "berserker", 
        "level": 4,
        "hp": 110,
        "hp_max": 180,  # Increased from CON
        "mp": 30,
        "mp_max": 30,
        "stamina": 61,
        "stamina_max": 130,
        "xp": 315,
        "xp_to_next": 337,
        "gold": 196,
        
        # Stats with bonuses
        "strength": 18,  # +4 bonus
        "dexterity": 17,  # +3 bonus  
        "constitution": 16,  # +3 bonus
        "intelligence": 11,  # +0 bonus
        "wisdom": 11,  # +0 bonus
        "charisma": 10,  # +0 bonus
        
        # Equipment
        "equipment": {
            "weapon": "Greataxe of First Blood (1d12)",
            "armor": "Leather Armor (+2)",
            "accessory": None
        },
        
        # Inventory summary
        "inventory": [
            "Healing Potion x2",
            "Stamina Draught x1", 
            "Rage Elixir x1",
            "Antidote x1",
            "Bandit Ears x9 pairs",
            "Brute's Eye Patch",
            "Leader's Insignia"
        ],
        
        # Skills
        "skills": [
            "Intimidating Presence★★ (can convert enemies)",
            "Rampage (3x speed below 50% HP)",
            "Berserker's Recovery (2 HP/turn in combat)",
            "Unstoppable (immunity once per battle)"
        ],
        
        # Titles and achievements
        "titles": ["The Immediate", "Threshold Slayer"],
        "achievements": [
            "First Blood - Killed Threshold Beast <60 seconds",
            "Speed Runner - Level 4 in first hour",
            "Bandit's Bane - Eliminated Howling Scars gang"
        ],
        
        # Current status
        "current_area": "ironhold",
        "active_effects": [],
        "rage_meter": 0,
        
        # Story flags
        "flags": {
            "tutorial_complete": True,
            "threshold_beast_killed": True,
            "howling_scars_defeated": True,
            "garrett_allied": True,
            "kaya_introduced": True
        }
    }
    
    # Save to multiple locations for redundancy
    state_dir = Path(__file__).parent.parent / "session" / "state"
    state_dir.mkdir(parents=True, exist_ok=True)
    
    # Main game state
    game_state_path = state_dir / "game_state.json"
    with open(game_state_path, 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"✅ Updated game_state.json")
    
    # Character sheet backup
    char_sheet_path = state_dir / "steve_stats.json"
    with open(char_sheet_path, 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"✅ Created backup in steve_stats.json")
    print(f"\nLevel 4 {name} the {stats['class'].title()}")
    print(f"STR: {stats['strength']} (+{(stats['strength']-10)//2})")
    print(f"DEX: {stats['dexterity']} (+{(stats['dexterity']-10)//2})")
    print(f"CON: {stats['constitution']} (+{(stats['constitution']-10)//2})")
    print(f"INT: {stats['intelligence']} (+{(stats['intelligence']-10)//2})")
    print(f"WIS: {stats['wisdom']} (+{(stats['wisdom']-10)//2})")
    print(f"CHA: {stats['charisma']} (+{(stats['charisma']-10)//2})")
    print(f"\nHP: {stats['hp']}/{stats['hp_max']}")
    print(f"Gold: {stats['gold']}")

if __name__ == "__main__":
    update_stats()
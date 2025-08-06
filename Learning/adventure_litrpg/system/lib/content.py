#!/usr/bin/env python3
"""
Content loading utilities for the LitRPG system
Handles loading data from JSON files
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional, List

class ContentLoader:
    """Loads and caches game content from JSON files"""
    
    def __init__(self, content_dir: str = "content"):
        self.content_dir = Path(content_dir)
        self._cache = {}
        
    def _load_json(self, filename: str) -> Dict:
        """Load a JSON file with caching"""
        if filename not in self._cache:
            filepath = self.content_dir / filename
            if filepath.exists():
                with open(filepath, 'r') as f:
                    self._cache[filename] = json.load(f)
            else:
                self._cache[filename] = {}
        return self._cache[filename]
    
    def get_monster(self, monster_id: str, area_level: int = 1) -> Optional[Dict]:
        """
        Get monster data by ID, optionally scaled for area level
        Searches through common, elite, and boss categories
        """
        bestiary = self._load_json("bestiary.json")
        
        # Search in all categories
        for category in ["common_enemies", "elite_enemies", "bosses"]:
            if category in bestiary and monster_id in bestiary[category]:
                monster = bestiary[category][monster_id].copy()
                
                # Scale for area if needed
                if area_level > 1:
                    from .dice import scale_for_area
                    monster["hp"] = scale_for_area(monster["hp"], area_level, 1)
                    monster["damage"] = scale_for_area(monster["damage"], area_level, 1)
                    monster["xp"] = int(monster["xp"] * (1 + (area_level - 1) * 0.5))
                    monster["armor"] = monster.get("armor", 0) + (area_level // 3)
                
                monster["category"] = category
                monster["id"] = monster_id
                return monster
        
        return None
    
    def get_item(self, item_id: str) -> Optional[Dict]:
        """Get item data by ID from any category"""
        items = self._load_json("items.json")
        
        # Search all categories
        for category in ["weapons", "armor", "consumables", "special"]:
            if category in items and item_id in items[category]:
                item = items[category][item_id].copy()
                item["category"] = category
                item["id"] = item_id
                return item
        
        return None
    
    def get_spell(self, spell_id: str) -> Optional[Dict]:
        """Get spell data by ID from any category"""
        spells = self._load_json("spells.json")
        
        # Search all categories
        for category in ["basic_spells", "intermediate_spells", 
                        "advanced_spells", "ritual_magic"]:
            if category in spells and spell_id in spells[category]:
                spell = spells[category][spell_id].copy()
                spell["category"] = category
                spell["id"] = spell_id
                return spell
        
        return None
    
    def get_adventure_start(self, start_id: str = None) -> Optional[Dict]:
        """Get an adventure starting scenario, random if no ID specified"""
        starts = self._load_json("adventure_starts.json")
        
        if "adventure_starts" not in starts:
            return None
            
        if start_id:
            return starts["adventure_starts"].get(start_id)
        else:
            # Return a random start
            import random
            start_id = random.choice(list(starts["adventure_starts"].keys()))
            start = starts["adventure_starts"][start_id].copy()
            start["id"] = start_id
            return start
    
    def get_loot_table(self, enemy_category: str) -> List[Dict]:
        """
        Generate loot based on enemy category
        Returns a list of items that could drop
        """
        # Basic loot tables based on enemy type
        loot_tables = {
            "common_enemies": [
                {"item": "gold", "amount": "2d6", "chance": 0.8},
                {"item": "health_potion", "amount": 1, "chance": 0.1},
                {"item": "torch", "amount": 1, "chance": 0.2}
            ],
            "elite_enemies": [
                {"item": "gold", "amount": "4d6+10", "chance": 0.9},
                {"item": "health_potion", "amount": 1, "chance": 0.3},
                {"item": "mana_potion", "amount": 1, "chance": 0.2},
                {"item": "random_weapon", "amount": 1, "chance": 0.15}
            ],
            "bosses": [
                {"item": "gold", "amount": "10d10+50", "chance": 1.0},
                {"item": "health_potion", "amount": "1d3", "chance": 0.5},
                {"item": "mana_potion", "amount": "1d2", "chance": 0.4},
                {"item": "random_weapon", "amount": 1, "chance": 0.3},
                {"item": "random_armor", "amount": 1, "chance": 0.25}
            ]
        }
        
        # Generate actual loot
        import random
        loot = []
        table = loot_tables.get(enemy_category, loot_tables["common_enemies"])
        
        for entry in table:
            if random.random() < entry["chance"]:
                if entry["item"] == "random_weapon":
                    weapons = list(self._load_json("items.json").get("weapons", {}).keys())
                    if weapons:
                        item = random.choice(weapons)
                        loot.append({"item": item, "amount": 1})
                elif entry["item"] == "random_armor":
                    armors = list(self._load_json("items.json").get("armor", {}).keys())
                    if armors:
                        item = random.choice(armors)
                        loot.append({"item": item, "amount": 1})
                else:
                    amount = entry["amount"]
                    if isinstance(amount, str):
                        from .dice import roll_dice
                        amount = roll_dice(amount)
                    loot.append({"item": entry["item"], "amount": amount})
        
        return loot
    
    def get_all_items_by_category(self, category: str) -> Dict:
        """Get all items in a specific category"""
        items = self._load_json("items.json")
        return items.get(category, {})
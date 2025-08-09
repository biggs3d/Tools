#!/usr/bin/env python3
"""
Enhanced LitRPG Engine v2 - Handles mechanical numbers with improved architecture
Includes inventory, status effects, and area-based scaling
"""

import json
import random
import argparse
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List

# Determine base directory for project
BASE_DIR = Path(__file__).resolve().parents[1]  # adventure_litrpg root
SYSTEM_DIR = BASE_DIR / "system"
sys.path.insert(0, str(SYSTEM_DIR))  # Add system dir to path for imports

# Import our new utility modules
from lib.dice import roll_dice, roll_damage, roll_healing, parse_dice_string, scale_for_area
from lib.content import ContentLoader
from lib.event_bus import emit_event
from config import config as game_config, GAME_STATE_FILE

class LitRPGEngine:
    def __init__(self, state_file=None, config_file=None):
        # Use proper paths from config module
        if state_file is None:
            state_file = GAME_STATE_FILE
        if config_file is None:
            config_file = SYSTEM_DIR / "config.json"
            
        self.state_file = Path(state_file)
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        self.state = self.load_state()
        
        # Load configuration (still load from file but could transition to singleton)
        self.config = self.load_config(config_file)
        # Pass proper content directory path
        self.content = ContentLoader(content_dir=str(BASE_DIR / "content"))
        
    def load_config(self, config_file: str) -> Dict:
        """Load game configuration with defaults"""
        config_path = Path(config_file)
        defaults = {
            "game_constants": {
                "xp_base": 100,
                "xp_multiplier": 1.5,
                "crit_chance": 0.1,
                "crit_multiplier": 2.0,
                "dodge_chance": 0.1,
                "stamina_attack_cost": 10,
                "stamina_dodge_cost": 5,
                "mp_regen_rate": 0.1,
                "stamina_regen_rate": 0.2,
                "sneak_attack_bonus_per_level": 3
            },
            "area_scaling": {},
            "status_effects": {
                "poisoned": {"damage_per_turn": 5, "duration": 3},
                "burning": {"damage_per_turn": 8, "duration": 2},
                "frozen": {"duration": 2},
                "blessed": {"skill_bonus": 2, "duration": 5},
                "shield_spell": {"armor_bonus": 3, "duration": 3},
                "rage": {"damage_bonus": 5, "armor_penalty": 2, "duration": 3}
            },
            "recovery": {
                "short_rest": {"hp": 0.3, "mp": 0.5, "stamina": 1.0},
                "long_rest": {"hp": 1.0, "mp": 1.0, "stamina": 1.0}
            }
        }
        
        # Proper merge logic
        if config_path.exists():
            with open(config_path, 'r') as f:
                loaded = json.load(f)
                # Deep merge loaded into defaults
                merged = self._deep_merge(defaults, loaded)
                return merged
        return defaults
    
    def _deep_merge(self, base: Dict, override: Dict) -> Dict:
        """Deep merge two dictionaries"""
        result = base.copy()
        for key, value in override.items():
            if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value
        return result
    
    def load_state(self) -> Dict:
        """Load game state or return empty dict"""
        if self.state_file.exists():
            with open(self.state_file, 'r') as f:
                return json.load(f)
        return {}
    
    def save_state(self):
        """Save current state to file atomically"""
        # Atomic write to prevent corruption
        tmp_file = self.state_file.with_suffix('.tmp')
        with open(tmp_file, 'w') as f:
            json.dump(self.state, f, indent=2)
        tmp_file.replace(self.state_file)
    
    def init_new_game(self, name: str, class_name: str = "warrior") -> Dict:
        """Create a new character with enhanced features"""
        
        # Load class progression from config
        class_progression = self.config.get("class_progression", {})
        constants = self.config.get("game_constants", {})
        
        # Get class config or use custom template
        class_config = class_progression.get(class_name.lower(), class_progression.get("custom", {}))
        
        # Calculate starting stats based on class progression
        # Base stats = level 1 equivalent (10x the per-level gain as starting pool)
        base_hp = class_config.get("hp_per_level", 10) * 10
        base_mp = class_config.get("mp_per_level", 5) * 10  
        base_stamina = class_config.get("stamina_per_level", 7) * 10
        
        # Generate starting attributes based on primary stats
        primary_stats = class_config.get("primary_stats", ["strength", "constitution"])
        
        # Default attributes
        attributes = {
            "strength": 10,
            "dexterity": 10,
            "intelligence": 10,
            "constitution": 10,
            "wisdom": 10,
            "charisma": 10
        }
        
        # Boost primary stats
        for stat in primary_stats:
            if stat in attributes:
                attributes[stat] += 6  # Primary stats get +6
        
        # Build character config
        config = {
            "hp": base_hp,
            "mp": base_mp,
            "stamina": base_stamina,
            **attributes
        }
        constants = self.config.get("game_constants", {})
        
        self.state = {
            "character": {
                "name": name,
                "class": class_name,
                "level": 1,
                "xp": 0,
                "xp_next": constants.get("xp_base", 100),
                
                # Core resources
                "hp": config["hp"],
                "hp_max": config["hp"],
                "mp": config["mp"],
                "mp_max": config["mp"],
                "stamina": config["stamina"],
                "stamina_max": config["stamina"],
                
                # Attributes
                "strength": config["strength"],
                "dexterity": config["dexterity"],
                "intelligence": config["intelligence"],
                "constitution": config["constitution"],
                "wisdom": config["wisdom"],
                "charisma": config["charisma"],
                
                # Combat stats
                "damage_bonus": config["strength"] // 3,
                "armor": 0,
                "crit_chance": constants.get("crit_chance", 0.1),
                "dodge_chance": config["dexterity"] * constants.get("dodge_modifier", 0.01),
                
                # NEW: Inventory and equipment
                "gold": 50,
                "inventory": [],  # List of item IDs
                "equipment": {    # Currently equipped items
                    "weapon": None,
                    "armor": None,
                    "accessory": None
                },
                "skill_points": 0,
                "stat_points": 0
            },
            
            # NEW: Status effects tracking
            "status_effects": {},  # Effect name -> {"duration": turns, "power": value}
            
            # World state
            "current_area": "tutorial_village",
            "flags": {},
            "kills": 0,
            "session_start": datetime.now().isoformat()
        }
        
        self.save_state()
        return {
            "success": True,
            "message": f"Created {name} the {class_name}",
            "initial_stats": self.get_status()
        }
    
    def attack(self, weapon_damage: str = None, target_armor: int = 0,
               is_crit: bool = False, is_sneak: bool = False) -> Dict:
        """Enhanced attack with equipment support"""
        
        char = self.state["character"]
        constants = self.config.get("game_constants", {})
        
        # Get weapon damage from equipment if not specified
        if weapon_damage is None:
            weapon_id = char["equipment"].get("weapon")
            if weapon_id:
                weapon = self.content.get_item(weapon_id)
                if weapon:
                    weapon_damage = weapon.get("damage", "1d4")
            else:
                weapon_damage = "1d4"  # Unarmed
        
        # Roll damage
        damage = roll_damage(weapon_damage, char["damage_bonus"], 
                           is_crit, constants.get("crit_multiplier", 2.0))
        
        # Check for bloodlust (berserker passive)
        if "bloodlust" in self.state.get("status_effects", {}):
            hp_percent = char["hp"] / char["hp_max"]
            if hp_percent <= 0.5:  # Below 50% HP
                damage = int(damage * 1.1)  # +10% damage
        
        # Check for actual crit
        if not is_crit and random.random() < char["crit_chance"]:
            damage = int(damage * constants.get("crit_multiplier", 2.0))
            is_crit = True
        
        # Sneak attack bonus (for rogues)
        if is_sneak and char["class"].lower() == "rogue":
            bonus = char["level"] * constants.get("sneak_attack_bonus_per_level", 3)
            damage += bonus
        
        # Apply status effect bonuses
        if "rage" in self.state.get("status_effects", {}):
            damage += self.config["status_effects"]["rage"].get("damage_bonus", 5)
        
        # Apply armor reduction
        damage = max(1, damage - target_armor)
        
        # Stamina cost
        stamina_cost = constants.get("stamina_attack_cost", 10)
        char["stamina"] = max(0, char["stamina"] - stamina_cost)
        
        # Emit damage dealt event
        emit_event('damage_dealt', {
            'amount': damage,
            'target': 'enemy',
            'critical': is_crit,
            'sneak_attack': is_sneak
        })
        
        self.save_state()
        
        return {
            "damage": damage,
            "critical": is_crit,
            "stamina_remaining": char["stamina"],
            "sneak_attack": is_sneak,
            "weapon_used": weapon_damage
        }
    
    def take_damage(self, amount: int, damage_type: str = "physical") -> Dict:
        """Take damage with armor from equipment and status effects"""
        char = self.state["character"]
        
        # Get total armor value
        total_armor = char["armor"]
        armor_id = char["equipment"].get("armor")
        if armor_id:
            armor_item = self.content.get_item(armor_id)
            if armor_item:
                total_armor += armor_item.get("armor", 0)
        
        # Add shield spell bonus if active
        if "shield_spell" in self.state.get("status_effects", {}):
            total_armor += self.config["status_effects"]["shield_spell"].get("armor_bonus", 3)
        
        # Apply rage armor penalty if active
        if "rage" in self.state.get("status_effects", {}):
            total_armor -= self.config["status_effects"]["rage"].get("armor_penalty", 2)
            total_armor = max(0, total_armor)  # Can't go negative
        
        # Apply armor to physical damage
        if damage_type == "physical":
            amount = max(1, amount - total_armor)
        
        char["hp"] = max(0, char["hp"] - amount)
        
        # Emit damage taken event
        emit_event('damage_taken', {
            'amount': amount,
            'source': damage_type,
            'armor_reduced': total_armor if damage_type == "physical" else 0,
            'hp_remaining': char["hp"]
        })
        
        self.save_state()
        
        return {
            "damage_taken": amount,
            "hp_remaining": char["hp"],
            "hp_max": char["hp_max"],
            "is_alive": char["hp"] > 0,
            "health_percent": char["hp"] / char["hp_max"],
            "armor_reduced": total_armor if damage_type == "physical" else 0
        }
    
    def heal(self, amount: Any, resource: str = "hp") -> Dict:
        """Enhanced healing that accepts dice strings or integers"""
        char = self.state["character"]
        
        # Handle dice strings or integers
        if isinstance(amount, str):
            amount = roll_healing(amount)
        
        max_key = f"{resource}_max"
        old_value = char[resource]
        char[resource] = min(char[resource] + amount, char[max_key])
        actual_healed = char[resource] - old_value
        
        self.save_state()
        
        return {
            "healed": actual_healed,
            f"{resource}_current": char[resource],
            f"{resource}_max": char[max_key],
            "percent": char[resource] / char[max_key]
        }
    
    # Inventory Management
    def add_item(self, item_id: str, quantity: int = 1) -> Dict:
        """Add item to inventory"""
        char = self.state["character"]
        
        # Get item data to verify it exists
        item = self.content.get_item(item_id)
        if not item:
            return {"success": False, "error": f"Unknown item: {item_id}"}
        
        # Add to inventory (simple list for now, could be dict for stacking)
        for _ in range(quantity):
            char["inventory"].append(item_id)
        
        # Emit item acquired event
        emit_event('item_acquired', {
            'item': item.get('name', item_id),
            'quantity': quantity
        })
        
        self.save_state()
        
        return {
            "success": True,
            "item_added": item_id,
            "quantity": quantity,
            "inventory_size": len(char["inventory"])
        }
    
    def use_item(self, item_id: str) -> Dict:
        """Use a consumable item from inventory"""
        char = self.state["character"]
        
        # Check if item is in inventory
        if item_id not in char["inventory"]:
            return {"success": False, "error": f"You don't have {item_id}"}
        
        # Get item data
        item = self.content.get_item(item_id)
        if not item:
            return {"success": False, "error": f"Unknown item: {item_id}"}
        
        # Check if item is consumable
        if item.get("category") not in ["consumables", "custom_consumables"]:
            return {"success": False, "error": f"{item_id} is not consumable"}
        
        result = {"success": True, "item_used": item.get("name", item_id), "effects": []}
        
        # Apply item effects
        if "heal" in item:
            heal_amount = roll_healing(item["heal"])
            char["hp"] = min(char["hp"] + heal_amount, char["hp_max"])
            result["effects"].append(f"Healed {heal_amount} HP")
            
        if "restore" in item:
            # Restore MP or Stamina
            restore_amount = roll_healing(str(item["restore"]))
            if "mana" in item_id.lower() or "mp" in item_id.lower():
                char["mp"] = min(char["mp"] + restore_amount, char["mp_max"])
                result["effects"].append(f"Restored {restore_amount} MP")
            else:
                char["stamina"] = min(char["stamina"] + restore_amount, char["stamina_max"])
                result["effects"].append(f"Restored {restore_amount} Stamina")
                
        if item.get("effect") == "apply_status":
            # Apply status effect
            status = item.get("status")
            duration = item.get("duration", 3)
            if status:
                # Initialize status_effects if needed
                if "status_effects" not in self.state:
                    self.state["status_effects"] = {}
                    
                # Always apply the status (no special case here)
                self.state["status_effects"][status] = {
                    "duration": duration,
                    "power": item.get("power", "1d4")
                }
                result["effects"].append(f"Applied {status} for {duration} turns")
                emit_event('status_applied', {'status': status, 'duration': duration})
                    
        if item.get("cure") == "poison" or "antidote" in item_id.lower():
            # Remove poison status
            if "status_effects" in self.state and "poisoned" in self.state["status_effects"]:
                del self.state["status_effects"]["poisoned"]
                result["effects"].append("Cured poison")
                emit_event('status_removed', {'status': 'poisoned'})
            else:
                result["effects"].append("No poison to cure")
                
        # Remove item from inventory
        char["inventory"].remove(item_id)
        
        # Emit item used event
        emit_event('item_used', {
            'item': item.get('name', item_id),
            'effect': ', '.join(result["effects"])
        })
        
        self.save_state()
        return result
    
    def equip_item(self, item_id: str) -> Dict:
        """Equip an item from inventory"""
        char = self.state["character"]
        
        if item_id not in char["inventory"]:
            return {"success": False, "error": "Item not in inventory"}
        
        item = self.content.get_item(item_id)
        if not item:
            return {"success": False, "error": "Unknown item"}
        
        # Determine equipment slot
        slot = None
        if item["category"] == "weapons":
            slot = "weapon"
        elif item["category"] == "armor":
            slot = "armor"
        else:
            slot = "accessory"
        
        # Unequip current item if any
        old_item = char["equipment"].get(slot)
        if old_item:
            char["inventory"].append(old_item)
        
        # Equip new item
        char["equipment"][slot] = item_id
        char["inventory"].remove(item_id)
        
        # Emit item equipped event
        emit_event('item_equipped', {
            'item': item.get('name', item_id),
            'slot': slot,
            'unequipped': old_item
        })
        
        self.save_state()
        
        return {
            "success": True,
            "equipped": item_id,
            "slot": slot,
            "unequipped": old_item
        }
    
    # Status Effects
    def apply_status_effect(self, effect_name: str, duration: int = None, 
                           power: Any = None) -> Dict:
        """Apply a status effect to the character"""
        if "status_effects" not in self.state:
            self.state["status_effects"] = {}
        
        effect_config = self.config.get("status_effects", {}).get(effect_name, {})
        
        if not effect_config:
            return {"success": False, "error": f"Unknown status effect: {effect_name}"}
        
        # Use provided duration, or fall back to config (checking both keys for compatibility)
        if duration is None:
            duration = effect_config.get("duration", effect_config.get("duration_base", 5))
        
        self.state["status_effects"][effect_name] = {
            "duration": duration,
            "power": power or effect_config.get("damage_per_turn", 0)
        }
        
        self.save_state()
        
        return {
            "success": True,
            "effect_applied": effect_name,
            "duration": duration,
            "description": effect_config.get("description", "")
        }
    
    def tick_status_effects(self) -> Dict:
        """Process status effects for one turn"""
        if "status_effects" not in self.state:
            return {"effects_processed": 0}
        
        char = self.state["character"]
        effects_log = []
        
        for effect_name, effect_data in list(self.state["status_effects"].items()):
            effect_config = self.config.get("status_effects", {}).get(effect_name, {})
            
            # Apply damage over time effects
            # Use stored power if available, otherwise config value (don't use 'or' to preserve 0)
            damage_value = effect_data.get("power", effect_config.get("damage_per_turn", 0))
            if damage_value:
                # Handle both dice strings and numeric values
                if isinstance(damage_value, str):
                    damage = roll_dice(damage_value)
                else:
                    damage = int(damage_value)
                    
                if damage > 0:
                    char["hp"] = max(0, char["hp"] - damage)
                    effects_log.append({
                        "effect": effect_name,
                        "type": "damage",
                        "amount": damage
                    })
            
            # Apply healing over time effects (e.g., berserker_recovery)
            heal_value = effect_config.get("heal_per_turn", 0)
            if heal_value:
                if isinstance(heal_value, str):
                    healing = roll_dice(heal_value)
                else:
                    healing = int(heal_value)
                    
                if healing > 0:
                    char["hp"] = min(char["hp"] + healing, char["hp_max"])
                    effects_log.append({
                        "effect": effect_name,
                        "type": "healing",
                        "amount": healing
                    })
            
            # Reduce duration (skip for passive/infinite effects)
            if not effect_config.get("passive", False) and effect_data.get("duration", 0) > 0:
                effect_data["duration"] -= 1
                if effect_data["duration"] <= 0:
                    del self.state["status_effects"][effect_name]
                    effects_log.append({
                        "effect": effect_name,
                        "type": "expired"
                    })
                    emit_event('status_removed', {'status': effect_name})
        
        self.save_state()
        
        return {
            "effects_processed": len(effects_log),
            "log": effects_log,
            "hp_remaining": char["hp"],
            "active_effects": list(self.state.get("status_effects", {}).keys())
        }
    
    # Area-based combat
    def get_area_monster(self, monster_id: str) -> Dict:
        """Get a monster scaled for the current area"""
        area = self.state.get("current_area", "tutorial_village")
        area_config = self.config.get("area_scaling", {}).get(area, {})
        area_level = area_config.get("level", 1)
        player_level = self.state["character"]["level"]
        
        # content.get_monster already handles area scaling internally
        monster = self.content.get_monster(monster_id, area_level, player_level)
        
        # Only apply XP modifier if configured (not HP/damage which are already scaled)
        if monster and "xp_modifier" in area_config:
            monster["xp"] = int(monster["xp"] * area_config["xp_modifier"])
        
        return monster
    
    def change_area(self, area_name: str) -> Dict:
        """Move to a different area"""
        if area_name not in self.config.get("area_scaling", {}):
            return {"success": False, "error": f"Unknown area: {area_name}"}
        
        self.state["current_area"] = area_name
        
        area_config = self.config["area_scaling"][area_name]
        
        # Emit area entered event
        emit_event('area_entered', {
            'area': area_name,
            'level': area_config.get("level", 1),
            'description': area_config.get("description", "")
        })
        
        self.save_state()
        
        return {
            "success": True,
            "new_area": area_name,
            "area_level": area_config.get("level", 1),
            "description": area_config.get("description", "")
        }
    
    def cast_spell(self, mp_cost: int = None, spell_id: str = None, 
                   spell_power: str = None) -> Dict:
        """Enhanced spell casting with spell database support and automatic effects"""
        char = self.state["character"]
        spell = None
        spell_type = "damage"  # default
        
        # Look up spell if ID provided
        if spell_id:
            spell = self.content.get_spell(spell_id)
            if not spell:
                return {"success": False, "reason": "unknown_spell"}
            mp_cost = mp_cost or spell.get("mp_cost", 10)
            
            # Determine spell type and power
            if "healing" in spell:
                spell_type = "healing"
                spell_power = spell_power or spell.get("healing", "1d6")
            elif "damage" in spell:
                spell_type = "damage"
                spell_power = spell_power or spell.get("damage", "1d6")
            elif "effect" in spell or "shield" in spell_id.lower():
                spell_type = "buff"
                spell_power = spell_power or "0"
        else:
            mp_cost = mp_cost or 10
            spell_power = spell_power or "1d6"
        
        if char["mp"] < mp_cost:
            return {"success": False, "reason": "insufficient_mp"}
        
        char["mp"] -= mp_cost
        
        # Calculate spell effect
        if isinstance(spell_power, str) and spell_power != "0":
            effect_value = roll_dice(spell_power) + (char["intelligence"] // 2)
        else:
            effect_value = int(spell_power) if spell_power != "0" else 0
        
        # Apply spell effects based on type
        result = {
            "success": True,
            "type": spell_type,
            "mp_remaining": char["mp"],
            "mp_cost": mp_cost,
            "spell_id": spell_id
        }
        
        if spell_type == "healing":
            # Apply healing immediately
            old_hp = char["hp"]
            char["hp"] = min(char["hp_max"], char["hp"] + effect_value)
            actual_healed = char["hp"] - old_hp
            result.update({
                "healed": actual_healed,
                "hp": char["hp"],
                "hp_max": char["hp_max"]
            })
        elif spell_type == "buff":
            # Apply buff status effects
            if spell_id and "shield" in spell_id.lower():
                self.apply_status_effect("shield_spell")
                result["effect_applied"] = "shield_spell"
            elif spell_id and "bless" in spell_id.lower():
                self.apply_status_effect("blessed")
                result["effect_applied"] = "blessed"
        else:
            # Damage spell - return damage value for use on enemies
            result["effect_value"] = effect_value
        
        self.save_state()
        return result
    
    def gain_xp(self, amount: int) -> Dict:
        """Award XP with configurable progression"""
        char = self.state["character"]
        constants = self.config.get("game_constants", {})
        
        # Apply area XP modifier
        area = self.state.get("current_area", "tutorial_village")
        area_config = self.config.get("area_scaling", {}).get(area, {})
        amount = int(amount * area_config.get("xp_modifier", 1.0))
        
        char["xp"] += amount
        
        # Emit XP gained event
        emit_event('xp_gained', {
            'amount': amount,
            'total_xp': char["xp"],
            'current_level': char["level"]
        })
        
        level_ups = 0
        while char["xp"] >= char["xp_next"]:
            char["xp"] -= char["xp_next"]
            char["level"] += 1
            level_ups += 1
            
            # Class-specific level up bonuses
            class_prog = self.config.get("class_progression", {}).get(char["class"].lower(), {})
            
            char["hp_max"] += class_prog.get("hp_per_level", 10)
            char["mp_max"] += class_prog.get("mp_per_level", 5)
            char["stamina_max"] += class_prog.get("stamina_per_level", 5)
            
            # Restore resources on level up
            char["hp"] = char["hp_max"]
            char["mp"] = char["mp_max"]
            char["stamina"] = char["stamina_max"]
            
            # Emit level up event
            emit_event('level_up', {
                'new_level': char["level"],
                'stats': {
                    'hp_max': char["hp_max"],
                    'mp_max': char["mp_max"],
                    'stamina_max': char["stamina_max"]
                },
                'location': area,
                'total_xp': char["xp"] + char["xp_next"]
            })
            
            # Grant points
            char["skill_points"] += 1
            char["stat_points"] += 2
            
            # Next level requirement
            xp_base = constants.get("xp_base", 100)
            xp_scaling = constants.get("xp_multiplier", 1.5)
            char["xp_next"] = int(xp_base * (xp_scaling ** (char["level"] - 1)))
        
        self.save_state()
        
        return {
            "xp_gained": amount,
            "current_xp": char["xp"],
            "xp_to_next": char["xp_next"],
            "leveled_up": level_ups > 0,
            "new_level": char["level"] if level_ups > 0 else None,
            "skill_points": char["skill_points"],
            "stat_points": char["stat_points"]
        }
    
    def rest(self, rest_type: str = "short") -> Dict:
        """Rest with configurable recovery rates"""
        char = self.state["character"]
        
        # Use the proper recovery config structure
        recovery_config = self.config.get("recovery", {}).get(f"{rest_type}_rest", {})
        
        # Get recovery rates for each resource with fallbacks
        hp_recovery_rate = recovery_config.get("hp", 0.3 if rest_type == "short" else 1.0)
        mp_recovery_rate = recovery_config.get("mp", 0.5 if rest_type == "short" else 1.0)
        stamina_recovery_rate = recovery_config.get("stamina", 1.0)
        
        hp_recover = int(char["hp_max"] * hp_recovery_rate)
        mp_recover = int(char["mp_max"] * mp_recovery_rate)
        stamina_recover = int(char["stamina_max"] * stamina_recovery_rate)
        
        old_hp = char["hp"]
        old_mp = char["mp"]
        old_stamina = char["stamina"]
        
        char["hp"] = min(char["hp_max"], char["hp"] + hp_recover)
        char["mp"] = min(char["mp_max"], char["mp"] + mp_recover)
        char["stamina"] = min(char["stamina_max"], char["stamina"] + stamina_recover)
        
        # Clear some status effects on long rest
        if rest_type == "long" and "status_effects" in self.state:
            debuffs = ["poisoned", "burning", "frozen"]
            for debuff in debuffs:
                if debuff in self.state["status_effects"]:
                    del self.state["status_effects"][debuff]
        
        self.save_state()
        
        return {
            "hp_recovered": char["hp"] - old_hp,
            "mp_recovered": char["mp"] - old_mp,
            "stamina_recovered": char["stamina"] - old_stamina,
            "current_hp": char["hp"],
            "current_mp": char["mp"],
            "current_stamina": char["stamina"],
            "status_effects_cleared": rest_type == "long"
        }
    
    def modify_gold(self, amount: int) -> Dict:
        """Add or remove gold"""
        char = self.state["character"]
        old_gold = char["gold"]
        char["gold"] = max(0, char["gold"] + amount)
        
        self.save_state()
        
        return {
            "gold_change": amount,
            "gold_total": char["gold"],
            "transaction": "gain" if amount > 0 else "spend"
        }
    
    def skill_check(self, attribute: str, difficulty: int = 15) -> Dict:
        """Roll a skill check with status effect modifiers"""
        char = self.state["character"]
        
        # Get attribute modifier
        attr_value = char.get(attribute, 10)
        modifier = (attr_value - 10) // 2
        
        # Apply status effect bonuses
        if "blessed" in self.state.get("status_effects", {}):
            modifier += self.config["status_effects"]["blessed"].get("skill_bonus", 2)
        
        # Apply frozen penalty (reduces dexterity-based checks)
        if "frozen" in self.state.get("status_effects", {}) and attribute == "dexterity":
            modifier -= 3
        
        # Roll d20
        roll = random.randint(1, 20)
        total = roll + modifier
        
        # Critical success/failure
        is_crit_success = roll == 20
        is_crit_fail = roll == 1
        
        success = total >= difficulty or is_crit_success
        if is_crit_fail:
            success = False
        
        return {
            "success": success,
            "roll": roll,
            "modifier": modifier,
            "total": total,
            "difficulty": difficulty,
            "critical_success": is_crit_success,
            "critical_failure": is_crit_fail,
            "margin": total - difficulty
        }
    
    def set_flag(self, key: str, value: Any) -> Dict:
        """Set a story flag"""
        self.state["flags"][key] = value
        self.save_state()
        
        return {
            "flag_set": key,
            "value": value
        }
    
    def get_flag(self, key: str) -> Dict:
        """Get a story flag"""
        value = self.state.get("flags", {}).get(key, None)
        return {
            "flag": key,
            "value": value,
            "exists": value is not None
        }
    
    def get_status(self) -> Dict:
        """Get enhanced character status"""
        char = self.state["character"]
        
        # Get equipped items info
        equipment_info = {}
        for slot, item_id in char["equipment"].items():
            if item_id:
                item = self.content.get_item(item_id)
                if item:
                    equipment_info[slot] = f"{item_id} ({item.get('damage', item.get('armor', 'equipped'))})"
        
        return {
            "name": char["name"],
            "class": char["class"],
            "level": char["level"],
            "hp": f"{char['hp']}/{char['hp_max']}",
            "mp": f"{char['mp']}/{char['mp_max']}",
            "stamina": f"{char['stamina']}/{char['stamina_max']}",
            "xp": f"{char['xp']}/{char['xp_next']}",
            "gold": char["gold"],
            "health_percent": char["hp"] / char["hp_max"],
            "mana_percent": char["mp"] / char["mp_max"],
            "stamina_percent": char["stamina"] / char["stamina_max"],
            "current_area": self.state.get("current_area", "unknown"),
            "equipment": equipment_info,
            "inventory_count": len(char.get("inventory", [])),
            "active_effects": list(self.state.get("status_effects", {}).keys())
        }
    
    def enemy_attack(self, enemy_damage: str = "1d4") -> Dict:
        """Enemy attack with area scaling"""
        # Get area modifier for enemy damage
        area = self.state.get("current_area", "tutorial_village")
        area_config = self.config.get("area_scaling", {}).get(area, {})
        
        # Scale damage based on area
        if area_config.get("enemy_modifier", 1.0) > 1.0:
            enemy_damage = scale_for_area(enemy_damage, area_config.get("level", 1), 
                                        self.state["character"]["level"])
        
        # Roll damage
        damage = roll_dice(enemy_damage)
        
        # Check if player dodges
        char = self.state["character"]
        if random.random() < char["dodge_chance"]:
            # Apply stamina cost for dodging
            dodge_cost = self.config.get("game_constants", {}).get("stamina_dodge_cost", 5)
            char["stamina"] = max(0, char["stamina"] - dodge_cost)
            self.save_state()
            
            return {
                "dodged": True,
                "damage": 0,
                "stamina_cost": dodge_cost,
                "stamina_remaining": char["stamina"]
            }
        
        # Apply damage
        result = self.take_damage(damage)
        result["dodged"] = False
        result["area_scaled"] = area != "tutorial_village"
        
        return result

def create_parser():
    """Create argument parser with all commands"""
    
    # Load available classes from config for dynamic choices
    config_file = SYSTEM_DIR / "config.json"
    available_classes = ['warrior', 'mage', 'rogue']  # Defaults
    if config_file.exists():
        with open(config_file, 'r') as f:
            config = json.load(f)
            if 'class_progression' in config:
                available_classes = list(config['class_progression'].keys())
                # Remove 'custom' from choices as it's a template
                if 'custom' in available_classes:
                    available_classes.remove('custom')
    
    parser = argparse.ArgumentParser(
        description='LitRPG Game Engine - Mechanical number handler',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s init --name "Marcus" --class berserker
  %(prog)s attack --weapon "2d6+3" --armor 2
  %(prog)s cast --spell firebolt
  %(prog)s add-item --item health_potion --quantity 3
  %(prog)s equip --item longsword
  %(prog)s use-item --item antidote
  %(prog)s status-effect --apply poisoned --duration 5
  %(prog)s change-area --area darkwood_forest
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Init command
    init_parser = subparsers.add_parser('init', help='Initialize new character')
    init_parser.add_argument('--name', required=True, help='Character name')
    init_parser.add_argument('--class', choices=available_classes, 
                            default='warrior', 
                            help=f'Character class (available: {", ".join(available_classes)})')
    
    # Attack command
    attack_parser = subparsers.add_parser('attack', help='Perform attack')
    attack_parser.add_argument('--weapon', help='Weapon damage dice (e.g., 2d6+3)')
    attack_parser.add_argument('--armor', type=int, default=0, help='Target armor value')
    attack_parser.add_argument('--crit', action='store_true', help='Force critical hit')
    attack_parser.add_argument('--sneak', action='store_true', help='Sneak attack')
    
    # Damage command
    damage_parser = subparsers.add_parser('damage', help='Take damage')
    damage_parser.add_argument('--amount', type=int, required=True, help='Damage amount')
    damage_parser.add_argument('--type', default='physical', help='Damage type')
    
    # Heal command
    heal_parser = subparsers.add_parser('heal', help='Heal character')
    heal_parser.add_argument('--amount', required=True, help='Heal amount or dice')
    heal_parser.add_argument('--resource', choices=['hp', 'mp', 'stamina'], 
                           default='hp', help='Resource to heal')
    
    # Spell command
    spell_parser = subparsers.add_parser('cast', help='Cast a spell')
    spell_parser.add_argument('--spell', help='Spell ID from database')
    spell_parser.add_argument('--cost', type=int, help='Override MP cost')
    spell_parser.add_argument('--power', help='Override spell power')
    
    # XP command
    xp_parser = subparsers.add_parser('xp', help='Gain experience')
    xp_parser.add_argument('--amount', type=int, required=True, help='XP amount')
    
    # Rest command
    rest_parser = subparsers.add_parser('rest', help='Rest to recover')
    rest_parser.add_argument('--type', choices=['short', 'long'], 
                           default='short', help='Rest type')
    
    # Gold command
    gold_parser = subparsers.add_parser('gold', help='Modify gold')
    gold_parser.add_argument('--amount', type=int, required=True, 
                           help='Gold change (negative to spend)')
    
    # Skill check command
    check_parser = subparsers.add_parser('check', help='Skill check')
    check_parser.add_argument('--attribute', required=True, 
                            help='Attribute to check')
    check_parser.add_argument('--dc', type=int, default=15, 
                            help='Difficulty class')
    
    # Enemy attack command
    enemy_parser = subparsers.add_parser('enemy-attack', help='Enemy attacks')
    enemy_parser.add_argument('--damage', default='1d4', help='Enemy damage dice')
    
    # Item management
    item_parser = subparsers.add_parser('add-item', help='Add item to inventory')
    item_parser.add_argument('--item', required=True, help='Item ID')
    item_parser.add_argument('--quantity', type=int, default=1, help='Quantity')
    
    equip_parser = subparsers.add_parser('equip', help='Equip item')
    equip_parser.add_argument('--item', required=True, help='Item ID to equip')
    
    # Use consumable item
    use_parser = subparsers.add_parser('use-item', help='Use a consumable item')
    use_parser.add_argument('--item', required=True, help='Item ID to use')
    
    # Status effects
    effect_parser = subparsers.add_parser('status-effect', help='Manage status effects')
    effect_parser.add_argument('--apply', help='Effect to apply')
    effect_parser.add_argument('--duration', type=int, help='Effect duration')
    effect_parser.add_argument('--tick', action='store_true', help='Process effects for one turn')
    
    # Area management
    area_parser = subparsers.add_parser('change-area', help='Change area')
    area_parser.add_argument('--area', required=True, help='Area name')
    
    # Status command
    subparsers.add_parser('status', help='Get character status')
    
    # Flag command
    flag_parser = subparsers.add_parser('flag', help='Get or set story flags')
    flag_parser.add_argument('--get', help='Flag key to retrieve')
    flag_parser.add_argument('--set', help='Flag key to set')
    flag_parser.add_argument('--value', help='Flag value (required with --set)')
    
    return parser

def main():
    """Enhanced CLI with argparse"""
    parser = create_parser()
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    engine = LitRPGEngine()
    
    try:
        # Execute commands based on parsed arguments
        if args.command == 'init':
            result = engine.init_new_game(args.name, getattr(args, 'class'))
            
        elif args.command == 'attack':
            result = engine.attack(args.weapon, args.armor, args.crit, args.sneak)
            
        elif args.command == 'damage':
            result = engine.take_damage(args.amount, args.type)
            
        elif args.command == 'heal':
            result = engine.heal(args.amount, args.resource)
            
        elif args.command == 'cast':
            result = engine.cast_spell(args.cost, args.spell, args.power)
            
        elif args.command == 'xp':
            result = engine.gain_xp(args.amount)
            
        elif args.command == 'rest':
            result = engine.rest(args.type)
            
        elif args.command == 'gold':
            result = engine.modify_gold(args.amount)
            
        elif args.command == 'check':
            result = engine.skill_check(args.attribute, args.dc)
            
        elif args.command == 'enemy-attack':
            result = engine.enemy_attack(args.damage)
            
        elif args.command == 'add-item':
            result = engine.add_item(args.item, args.quantity)
            
        elif args.command == 'equip':
            result = engine.equip_item(args.item)
            
        elif args.command == 'use-item':
            result = engine.use_item(args.item)
            
        elif args.command == 'status-effect':
            if args.tick:
                result = engine.tick_status_effects()
            elif args.apply:
                result = engine.apply_status_effect(args.apply, args.duration)
            else:
                result = {"error": "Specify --apply or --tick"}
                
        elif args.command == 'change-area':
            result = engine.change_area(args.area)
            
        elif args.command == 'status':
            result = engine.get_status()
            
        elif args.command == 'flag':
            if args.get:
                # Get flag value
                result = engine.get_flag(args.get)
            elif args.set and args.value is not None:
                # Set flag value - convert string "true"/"false" to boolean
                value = args.value
                if value.lower() == "true":
                    value = True
                elif value.lower() == "false":
                    value = False
                result = engine.set_flag(args.set, value)
            else:
                result = {"error": "Specify --get or --set with --value"}
            
        else:
            result = {"error": f"Unknown command: {args.command}"}
        
        # Output as JSON for Claude to parse
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
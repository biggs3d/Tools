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

# Import our new utility modules
from lib.dice import roll_dice, roll_damage, roll_healing, parse_dice_string, scale_for_area
from lib.content import ContentLoader

class LitRPGEngine:
    def __init__(self, state_file="state/game_state.json", config_file="system/config.json"):
        self.state_file = Path(state_file)
        self.state_file.parent.mkdir(exist_ok=True)
        self.state = self.load_state()
        
        # Load configuration
        self.config = self.load_config(config_file)
        self.content = ContentLoader()
        
    def load_config(self, config_file: str) -> Dict:
        """Load game configuration"""
        config_path = Path(config_file)
        if config_path.exists():
            with open(config_path, 'r') as f:
                return json.load(f)
        return {"game_constants": {}, "area_scaling": {}}
    
    def load_state(self) -> Dict:
        """Load game state or return empty dict"""
        if self.state_file.exists():
            with open(self.state_file, 'r') as f:
                return json.load(f)
        return {}
    
    def save_state(self):
        """Save current state to file"""
        with open(self.state_file, 'w') as f:
            json.dump(self.state, f, indent=2)
    
    def init_new_game(self, name: str, class_name: str = "warrior") -> Dict:
        """Create a new character with enhanced features"""
        
        # Base stats by class
        class_configs = {
            "warrior": {
                "hp": 120, "mp": 30, "stamina": 100,
                "strength": 16, "dexterity": 12, "intelligence": 8,
                "constitution": 14, "wisdom": 10, "charisma": 10
            },
            "mage": {
                "hp": 60, "mp": 120, "stamina": 60,
                "strength": 8, "dexterity": 12, "intelligence": 16,
                "constitution": 10, "wisdom": 14, "charisma": 10
            },
            "rogue": {
                "hp": 80, "mp": 50, "stamina": 120,
                "strength": 10, "dexterity": 16, "intelligence": 12,
                "constitution": 10, "wisdom": 12, "charisma": 14
            }
        }
        
        config = class_configs.get(class_name.lower(), class_configs["warrior"])
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
                "crit_chance": constants.get("base_crit_chance", 0.05),
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
        stamina_cost = constants.get("base_stamina_cost_attack", 5)
        char["stamina"] = max(0, char["stamina"] - stamina_cost)
        
        self.save_state()
        
        return {
            "damage": damage,
            "critical": is_crit,
            "stamina_remaining": char["stamina"],
            "sneak_attack": is_sneak,
            "weapon_used": weapon_damage
        }
    
    def take_damage(self, amount: int, damage_type: str = "physical") -> Dict:
        """Take damage with armor from equipment"""
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
        
        # Apply armor to physical damage
        if damage_type == "physical":
            amount = max(1, amount - total_armor)
        
        char["hp"] = max(0, char["hp"] - amount)
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
        
        self.save_state()
        
        return {
            "success": True,
            "item_added": item_id,
            "quantity": quantity,
            "inventory_size": len(char["inventory"])
        }
    
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
        
        duration = duration or effect_config.get("duration_base", 5)
        
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
            if "damage_per_turn" in effect_config:
                damage = roll_dice(effect_config["damage_per_turn"])
                char["hp"] = max(0, char["hp"] - damage)
                effects_log.append({
                    "effect": effect_name,
                    "type": "damage",
                    "amount": damage
                })
            
            # Reduce duration
            effect_data["duration"] -= 1
            if effect_data["duration"] <= 0:
                del self.state["status_effects"][effect_name]
                effects_log.append({
                    "effect": effect_name,
                    "type": "expired"
                })
        
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
        
        monster = self.content.get_monster(monster_id, area_level)
        
        if monster:
            # Additional scaling based on area modifiers
            modifier = area_config.get("enemy_modifier", 1.0)
            if modifier != 1.0:
                # Parse and scale HP
                hp_dice = monster["hp"]
                num_dice, die_size, bonus = parse_dice_string(hp_dice)
                scaled_bonus = int(bonus * modifier)
                monster["hp"] = f"{num_dice}d{die_size}+{scaled_bonus}"
                
                # Scale XP
                monster["xp"] = int(monster["xp"] * area_config.get("xp_modifier", 1.0))
        
        return monster
    
    def change_area(self, area_name: str) -> Dict:
        """Move to a different area"""
        if area_name not in self.config.get("area_scaling", {}):
            return {"success": False, "error": f"Unknown area: {area_name}"}
        
        self.state["current_area"] = area_name
        self.save_state()
        
        area_config = self.config["area_scaling"][area_name]
        
        return {
            "success": True,
            "new_area": area_name,
            "area_level": area_config.get("level", 1),
            "description": area_config.get("description", "")
        }
    
    def cast_spell(self, mp_cost: int = None, spell_id: str = None, 
                   spell_power: str = None) -> Dict:
        """Enhanced spell casting with spell database support"""
        char = self.state["character"]
        
        # Look up spell if ID provided
        if spell_id:
            spell = self.content.get_spell(spell_id)
            if not spell:
                return {"success": False, "reason": "unknown_spell"}
            mp_cost = mp_cost or spell.get("mp_cost", 10)
            spell_power = spell_power or spell.get("damage", spell.get("healing", "1d6"))
        else:
            mp_cost = mp_cost or 10
            spell_power = spell_power or "1d6"
        
        if char["mp"] < mp_cost:
            return {"success": False, "reason": "insufficient_mp"}
        
        char["mp"] -= mp_cost
        
        # Calculate spell effect
        if isinstance(spell_power, str):
            effect_value = roll_dice(spell_power) + (char["intelligence"] // 2)
        else:
            effect_value = spell_power + (char["intelligence"] // 2)
        
        self.save_state()
        
        return {
            "success": True,
            "effect_value": effect_value,
            "mp_remaining": char["mp"],
            "mp_cost": mp_cost,
            "spell_id": spell_id
        }
    
    def gain_xp(self, amount: int) -> Dict:
        """Award XP with configurable progression"""
        char = self.state["character"]
        constants = self.config.get("game_constants", {})
        
        # Apply area XP modifier
        area = self.state.get("current_area", "tutorial_village")
        area_config = self.config.get("area_scaling", {}).get(area, {})
        amount = int(amount * area_config.get("xp_modifier", 1.0))
        
        char["xp"] += amount
        
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
            
            # Grant points
            char["skill_points"] += 1
            char["stat_points"] += 2
            
            # Next level requirement
            xp_base = constants.get("xp_base", 100)
            xp_scaling = constants.get("xp_scaling_factor", 1.5)
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
        constants = self.config.get("game_constants", {})
        
        if rest_type == "short":
            recovery = constants.get("rest_short_recovery", 0.25)
        else:
            recovery = constants.get("rest_long_recovery", 1.0)
        
        hp_recover = int(char["hp_max"] * recovery)
        mp_recover = int(char["mp_max"] * recovery)
        stamina_recover = int(char["stamina_max"] * recovery)
        
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
            modifier += self.config["status_effects"]["blessed"].get("bonus_to_rolls", 2)
        
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
    
    def get_flag(self, key: str) -> Any:
        """Get a story flag"""
        return self.state["flags"].get(key, None)
    
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
            return {
                "dodged": True,
                "damage": 0
            }
        
        # Apply damage
        result = self.take_damage(damage)
        result["dodged"] = False
        result["area_scaled"] = area != "tutorial_village"
        
        return result

def create_parser():
    """Create argument parser with all commands"""
    parser = argparse.ArgumentParser(
        description='LitRPG Game Engine - Mechanical number handler',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s init --name "Marcus" --class warrior
  %(prog)s attack --weapon "2d6+3" --armor 2
  %(prog)s cast --spell firebolt
  %(prog)s add-item --item health_potion --quantity 3
  %(prog)s equip --item longsword
  %(prog)s status-effect --apply poisoned --duration 5
  %(prog)s change-area --area darkwood_forest
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Init command
    init_parser = subparsers.add_parser('init', help='Initialize new character')
    init_parser.add_argument('--name', required=True, help='Character name')
    init_parser.add_argument('--class', choices=['warrior', 'mage', 'rogue'], 
                            default='warrior', help='Character class')
    
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
    flag_parser = subparsers.add_parser('flag', help='Set story flag')
    flag_parser.add_argument('--set', required=True, help='Flag key')
    flag_parser.add_argument('--value', required=True, help='Flag value')
    
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
            # Convert string "true"/"false" to boolean
            value = args.value
            if value.lower() == "true":
                value = True
            elif value.lower() == "false":
                value = False
            result = engine.set_flag(args.set, value)
            
        else:
            result = {"error": f"Unknown command: {args.command}"}
        
        # Output as JSON for Claude to parse
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
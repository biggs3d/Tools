#!/usr/bin/env python3
"""
Dice rolling utilities for the LitRPG system
Centralized dice parsing and rolling logic
"""

import random
import re
from typing import Tuple, Optional

def parse_dice_string(dice_str: str) -> Tuple[int, int, int]:
    """
    Parse a dice string like "2d6+3" or "1d20-2" or "d6"
    Returns: (num_dice, die_size, modifier)
    """
    # Handle simple formats like "d6" (implicitly 1d6)
    if dice_str.startswith('d'):
        dice_str = '1' + dice_str
    
    # Parse using regex for flexibility
    pattern = r'^(\d+)d(\d+)([+-]\d+)?$'
    match = re.match(pattern, dice_str.replace(' ', ''))
    
    if not match:
        raise ValueError(f"Invalid dice string format: {dice_str}")
    
    num_dice = int(match.group(1))
    die_size = int(match.group(2))
    modifier = int(match.group(3) or 0)
    
    return num_dice, die_size, modifier

def roll_dice(dice_str: str, verbose: bool = False) -> int:
    """
    Roll dice based on a string like "2d6+3"
    Returns the total result
    If verbose=True, returns a dict with breakdown
    """
    num_dice, die_size, modifier = parse_dice_string(dice_str)
    
    # Roll the dice
    rolls = [random.randint(1, die_size) for _ in range(num_dice)]
    total = sum(rolls) + modifier
    
    if verbose:
        return {
            "total": total,
            "rolls": rolls,
            "modifier": modifier,
            "dice_string": dice_str
        }
    
    return total

def roll_with_advantage(dice_str: str, advantage: bool = True) -> int:
    """
    Roll with advantage (roll twice, take higher) or disadvantage (take lower)
    Typically used for d20 rolls
    """
    roll1 = roll_dice(dice_str)
    roll2 = roll_dice(dice_str)
    
    if advantage:
        return max(roll1, roll2)
    else:
        return min(roll1, roll2)

def roll_damage(weapon_damage: str, damage_bonus: int = 0, 
                is_crit: bool = False, crit_multiplier: float = 2.0) -> int:
    """
    Roll damage for an attack, handling crits
    """
    base_damage = roll_dice(weapon_damage)
    total_damage = base_damage + damage_bonus
    
    if is_crit:
        total_damage = int(total_damage * crit_multiplier)
    
    return max(1, total_damage)  # Minimum 1 damage

def roll_healing(heal_str: str, heal_bonus: int = 0) -> int:
    """
    Roll healing amount from a string like "2d4+2"
    Can also accept a plain integer as string
    """
    # Check if it's just a number
    try:
        return int(heal_str) + heal_bonus
    except ValueError:
        # It's a dice string
        return roll_dice(heal_str) + heal_bonus

def check_critical(roll: int, crit_on: int = 20) -> bool:
    """
    Check if a d20 roll is a critical hit
    """
    return roll >= crit_on

def check_fumble(roll: int, fumble_on: int = 1) -> bool:
    """
    Check if a d20 roll is a critical failure
    """
    return roll <= fumble_on

# Area-based scaling function for enemy stats
def scale_for_area(base_value: str, area_level: int, 
                   player_level: int) -> str:
    """
    Scale a dice string based on area difficulty and player level
    Example: "2d6+3" in a level 5 area might become "3d6+8"
    """
    num_dice, die_size, modifier = parse_dice_string(base_value)
    
    # Scale based on area level
    level_diff = max(0, area_level - 1)
    
    # Add dice for higher level areas
    scaled_dice = num_dice + (level_diff // 3)
    
    # Increase modifier more aggressively
    scaled_modifier = modifier + (level_diff * 2)
    
    # Adjust for player level difference
    player_diff = area_level - player_level
    if player_diff > 2:
        # Area is much higher level - increase difficulty
        scaled_modifier += player_diff
    elif player_diff < -2:
        # Player is much higher level - slight reduction
        scaled_dice = max(1, scaled_dice - 1)
    
    return f"{scaled_dice}d{die_size}{'+' if scaled_modifier >= 0 else ''}{scaled_modifier}"
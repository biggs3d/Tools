#!/usr/bin/env python3
"""
XP and level progression calculator for LitRPG adventures
Handles level calculations, XP requirements, and stat increases
"""

from typing import Dict, Tuple

# XP required for each level (cumulative)
XP_TABLE = {
    1: 0,
    2: 100,
    3: 200,
    4: 400,
    5: 800,
    6: 1500,
    7: 2500,
    8: 4000,
    9: 6000,
    10: 9000,
    11: 13000,
    12: 18000,
    13: 25000,
    14: 35000,
    15: 50000,
    16: 70000,
    17: 95000,
    18: 130000,
    19: 175000,
    20: 235000
}

# Class-specific stat gains per level
CLASS_PROGRESSION = {
    "berserker": {
        "hp": 15,
        "mp": 2,
        "stamina": 10,
        "primary_stats": ["strength", "constitution"]
    },
    "warrior": {
        "hp": 12,
        "mp": 3,
        "stamina": 8,
        "primary_stats": ["strength", "constitution"]
    },
    "mage": {
        "hp": 6,
        "mp": 12,
        "stamina": 4,
        "primary_stats": ["intelligence", "wisdom"]
    },
    "rogue": {
        "hp": 8,
        "mp": 5,
        "stamina": 10,
        "primary_stats": ["dexterity", "charisma"]
    }
}


def calculate_level(current_xp: int) -> int:
    """
    Calculate level based on current XP
    
    Args:
        current_xp: Current experience points
        
    Returns:
        Current level
    """
    level = 1
    for lvl, required_xp in XP_TABLE.items():
        if current_xp >= required_xp:
            level = lvl
        else:
            break
    return level


def xp_to_next_level(current_xp: int) -> Tuple[int, int, float]:
    """
    Calculate XP needed for next level
    
    Args:
        current_xp: Current experience points
        
    Returns:
        Tuple of (xp_needed, xp_for_next_level, progress_percentage)
    """
    current_level = calculate_level(current_xp)
    
    if current_level >= 20:
        return (0, 0, 100.0)
    
    next_level = current_level + 1
    xp_for_next = XP_TABLE.get(next_level, 999999)
    xp_for_current = XP_TABLE.get(current_level, 0)
    
    xp_needed = xp_for_next - current_xp
    level_range = xp_for_next - xp_for_current
    progress_in_level = current_xp - xp_for_current
    
    if level_range > 0:
        progress_percent = (progress_in_level / level_range) * 100
    else:
        progress_percent = 0
    
    return (xp_needed, xp_for_next, progress_percent)


def award_xp(current_xp: int, amount: int, current_level: int = None) -> Dict:
    """
    Award XP and check for level up
    
    Args:
        current_xp: Current experience points
        amount: XP to award
        current_level: Current level (optional, will calculate if not provided)
        
    Returns:
        Dictionary with new XP, new level, and level up info
    """
    if current_level is None:
        current_level = calculate_level(current_xp)
    
    new_xp = current_xp + amount
    new_level = calculate_level(new_xp)
    
    result = {
        "old_xp": current_xp,
        "new_xp": new_xp,
        "xp_gained": amount,
        "old_level": current_level,
        "new_level": new_level,
        "leveled_up": new_level > current_level
    }
    
    if result["leveled_up"]:
        result["levels_gained"] = new_level - current_level
        xp_needed, xp_for_next, progress = xp_to_next_level(new_xp)
        result["xp_to_next"] = xp_needed
        result["progress_to_next"] = f"{progress:.1f}%"
    
    return result


def calculate_stat_increase(old_level: int, new_level: int, character_class: str = "berserker") -> Dict:
    """
    Calculate stat increases from leveling up
    
    Args:
        old_level: Previous level
        new_level: New level after level up
        character_class: Character's class
        
    Returns:
        Dictionary with stat increases
    """
    if new_level <= old_level:
        return {}
    
    levels_gained = new_level - old_level
    progression = CLASS_PROGRESSION.get(character_class, CLASS_PROGRESSION["warrior"])
    
    return {
        "hp_increase": progression["hp"] * levels_gained,
        "mp_increase": progression["mp"] * levels_gained,
        "stamina_increase": progression["stamina"] * levels_gained,
        "stat_points": levels_gained * 2,  # 2 stat points per level
        "skill_points": levels_gained,  # 1 skill point per level
        "primary_stats": progression["primary_stats"]
    }


def get_level_title(level: int) -> str:
    """
    Get a title based on level
    
    Args:
        level: Character level
        
    Returns:
        Appropriate title
    """
    titles = {
        1: "Novice",
        5: "Journeyman",
        10: "Expert",
        15: "Master",
        20: "Legend",
        25: "Mythic",
        30: "Divine"
    }
    
    for lvl in sorted(titles.keys(), reverse=True):
        if level >= lvl:
            return titles[lvl]
    
    return "Beginner"


def calculate_xp_reward(enemy_level: int, player_level: int, base_xp: int = 50) -> int:
    """
    Calculate XP reward based on enemy and player levels
    
    Args:
        enemy_level: Level of defeated enemy
        player_level: Player's current level
        base_xp: Base XP for same-level enemy
        
    Returns:
        Adjusted XP reward
    """
    level_diff = enemy_level - player_level
    
    # Higher level enemies give bonus XP
    if level_diff > 0:
        multiplier = 1 + (level_diff * 0.2)  # +20% per level above
    # Lower level enemies give reduced XP
    elif level_diff < 0:
        multiplier = max(0.1, 1 + (level_diff * 0.15))  # -15% per level below, min 10%
    else:
        multiplier = 1
    
    return int(base_xp * multiplier)


if __name__ == "__main__":
    # Test examples
    print("Testing XP system...")
    print(f"Level for 315 XP: {calculate_level(315)}")
    print(f"XP to next level: {xp_to_next_level(315)}")
    print()
    
    # Test awarding XP
    result = award_xp(315, 100, 4)
    print(f"Award 100 XP to level 4 character with 315 XP:")
    print(f"  Result: {result}")
    print()
    
    # Test level up
    result = award_xp(315, 500, 4)
    print(f"Award 500 XP (level up scenario):")
    print(f"  Result: {result}")
    print()
    
    # Test stat increases
    stats = calculate_stat_increase(4, 5, "berserker")
    print(f"Berserker level 4→5 stat increases: {stats}")
    print()
    
    # Test XP rewards
    print(f"Level 6 enemy vs Level 4 player: {calculate_xp_reward(6, 4)} XP")
    print(f"Level 3 enemy vs Level 4 player: {calculate_xp_reward(3, 4)} XP")
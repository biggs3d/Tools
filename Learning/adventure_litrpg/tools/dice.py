#!/usr/bin/env python3
"""
Simple dice roller for LitRPG adventures
Handles expressions like "2d6+3", "1d20", "hp-15", etc.
"""

import random
import re
from typing import Dict, Union

def roll(expression: str) -> Dict[str, Union[int, str, bool]]:
    """
    Roll dice or calculate expressions
    
    Examples:
        roll("2d6+3")    -> {result: 11, breakdown: "rolled 4,4 +3", critical: false}
        roll("1d20")     -> {result: 20, breakdown: "rolled 20", critical: true}
        roll("15")       -> {result: 15, breakdown: "15", critical: false}
        roll("hp-10")    -> {result: -10, breakdown: "-10 hp", critical: false}
    
    Args:
        expression: Dice notation (NdX+Y) or simple math
        
    Returns:
        Dictionary with result, breakdown, and critical flag
    """
    result = {
        "result": 0,
        "breakdown": "",
        "critical": False
    }
    
    try:
        # Handle simple numbers
        if expression.replace('-', '').replace('+', '').isdigit():
            value = int(expression)
            result["result"] = value
            result["breakdown"] = str(value)
            return result
        
        # Handle HP/MP/XP modifications (e.g., "hp-15")
        if any(x in expression.lower() for x in ['hp', 'mp', 'xp', 'gold']):
            # Extract the number
            match = re.search(r'[-+]?\d+', expression)
            if match:
                value = int(match.group())
                result["result"] = value
                result["breakdown"] = f"{value} {expression.replace(str(value), '').strip()}"
            return result
        
        # Parse dice notation (NdX+Y)
        pattern = r'(\d+)d(\d+)([+-]\d+)?'
        match = re.match(pattern, expression.lower())
        
        if match:
            num_dice = int(match.group(1))
            die_size = int(match.group(2))
            modifier = int(match.group(3) or 0)
            
            # Roll the dice
            rolls = [random.randint(1, die_size) for _ in range(num_dice)]
            total = sum(rolls) + modifier
            
            # Check for criticals (all max or all 1s)
            if die_size == 20 and num_dice == 1:
                if rolls[0] == 20:
                    result["critical"] = True
                elif rolls[0] == 1:
                    result["critical"] = False  # Could mark as "fumble" if needed
            
            # Build breakdown string
            breakdown = f"rolled {','.join(map(str, rolls))}"
            if modifier > 0:
                breakdown += f" +{modifier}"
            elif modifier < 0:
                breakdown += f" {modifier}"
            
            result["result"] = total
            result["breakdown"] = breakdown
            result["critical"] = result.get("critical", False)
            
        else:
            # Fallback: try to evaluate as simple math
            try:
                value = eval(expression.replace('d', '*'))  # Risky but simple
                result["result"] = int(value)
                result["breakdown"] = expression
            except:
                result["result"] = 0
                result["breakdown"] = f"Could not parse: {expression}"
    
    except Exception as e:
        result["breakdown"] = f"Error: {str(e)}"
    
    return result


def check(stat_bonus: int, dc: int, advantage: bool = False, disadvantage: bool = False) -> Dict:
    """
    Make a skill check (d20 + bonus vs DC)
    
    Args:
        stat_bonus: Character's stat modifier
        dc: Difficulty class to beat
        advantage: Roll twice, take higher
        disadvantage: Roll twice, take lower
        
    Returns:
        Dictionary with success, roll details, and margin
    """
    if advantage and disadvantage:
        advantage = disadvantage = False  # They cancel out
    
    if advantage:
        roll1 = random.randint(1, 20)
        roll2 = random.randint(1, 20)
        base_roll = max(roll1, roll2)
        breakdown = f"rolled {roll1},{roll2} (advantage), used {base_roll}"
    elif disadvantage:
        roll1 = random.randint(1, 20)
        roll2 = random.randint(1, 20)
        base_roll = min(roll1, roll2)
        breakdown = f"rolled {roll1},{roll2} (disadvantage), used {base_roll}"
    else:
        base_roll = random.randint(1, 20)
        breakdown = f"rolled {base_roll}"
    
    total = base_roll + stat_bonus
    success = total >= dc
    margin = total - dc
    
    return {
        "success": success,
        "total": total,
        "breakdown": f"{breakdown} +{stat_bonus} = {total} vs DC {dc}",
        "margin": margin,
        "critical": base_roll == 20,
        "fumble": base_roll == 1
    }


if __name__ == "__main__":
    # Test examples
    print("Testing dice roller...")
    print(f"2d6+3: {roll('2d6+3')}")
    print(f"1d20: {roll('1d20')}")
    print(f"3d4: {roll('3d4')}")
    print(f"hp-15: {roll('hp-15')}")
    print(f"Simple 10: {roll('10')}")
    print()
    print("Testing skill check...")
    print(f"Check with +5 vs DC 15: {check(5, 15)}")
    print(f"Check with advantage: {check(3, 12, advantage=True)}")
#!/usr/bin/env python3
"""
Unit tests for dice rolling utilities
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from lib.dice import parse_dice_string, roll_dice, roll_damage, roll_healing, scale_for_area
import unittest

class TestDiceUtils(unittest.TestCase):
    
    def test_parse_dice_string(self):
        """Test dice string parsing"""
        # Standard format
        self.assertEqual(parse_dice_string("2d6+3"), (2, 6, 3))
        self.assertEqual(parse_dice_string("1d20-2"), (1, 20, -2))
        self.assertEqual(parse_dice_string("3d8"), (3, 8, 0))
        
        # Short format
        self.assertEqual(parse_dice_string("d6"), (1, 6, 0))
        self.assertEqual(parse_dice_string("d20+5"), (1, 20, 5))
        
        # Invalid formats should raise
        with self.assertRaises(ValueError):
            parse_dice_string("invalid")
        with self.assertRaises(ValueError):
            parse_dice_string("2d")
    
    def test_roll_dice(self):
        """Test basic dice rolling"""
        # Test ranges
        for _ in range(100):
            result = roll_dice("1d6")
            self.assertGreaterEqual(result, 1)
            self.assertLessEqual(result, 6)
            
            result = roll_dice("2d6+3")
            self.assertGreaterEqual(result, 5)  # Min: 2*1 + 3
            self.assertLessEqual(result, 15)    # Max: 2*6 + 3
    
    def test_roll_damage(self):
        """Test damage rolling with crits"""
        # Normal damage
        for _ in range(50):
            damage = roll_damage("1d6", damage_bonus=2)
            self.assertGreaterEqual(damage, 3)  # Min: 1 + 2
            self.assertLessEqual(damage, 8)     # Max: 6 + 2
        
        # Critical damage
        for _ in range(50):
            damage = roll_damage("1d6", damage_bonus=2, is_crit=True)
            self.assertGreaterEqual(damage, 6)  # Min: (1 + 2) * 2
            self.assertLessEqual(damage, 16)    # Max: (6 + 2) * 2
        
        # Minimum damage is always 1
        damage = roll_damage("1d1", damage_bonus=-10)
        self.assertEqual(damage, 1)
    
    def test_roll_healing(self):
        """Test healing amount parsing"""
        # Integer string
        self.assertEqual(roll_healing("20"), 20)
        self.assertEqual(roll_healing("20", heal_bonus=5), 25)
        
        # Dice string
        for _ in range(50):
            healing = roll_healing("2d4+2")
            self.assertGreaterEqual(healing, 4)  # Min: 2*1 + 2
            self.assertLessEqual(healing, 10)    # Max: 2*4 + 2
    
    def test_scale_for_area(self):
        """Test area-based scaling"""
        # Base case - no scaling
        scaled = scale_for_area("2d6+3", area_level=1, player_level=1)
        self.assertEqual(scaled, "2d6+3")
        
        # Higher level area
        scaled = scale_for_area("2d6+3", area_level=5, player_level=3)
        # Should increase dice and modifier
        num_dice, die_size, modifier = parse_dice_string(scaled)
        self.assertGreater(num_dice, 2)  # More dice
        self.assertGreater(modifier, 3)  # Higher modifier
        
        # Player overlevel
        scaled = scale_for_area("3d6+3", area_level=1, player_level=5)
        # Should reduce slightly
        num_dice, die_size, modifier = parse_dice_string(scaled)
        self.assertLessEqual(num_dice, 3)

if __name__ == '__main__':
    unittest.main()
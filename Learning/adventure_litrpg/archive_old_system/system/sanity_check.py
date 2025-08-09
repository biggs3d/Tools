#!/usr/bin/env python3
"""
Sanity Check Script for LitRPG Adventure System
Compares narrative files with game state and reports inconsistencies
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple
import re

# Setup paths
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR / "system"))

from config import GAME_STATE_FILE, PROGRESSION_HISTORY_FILE, NPC_RELATIONSHIPS_FILE

class SanityChecker:
    def __init__(self):
        self.issues = []
        self.warnings = []
        self.suggestions = []
        
    def load_json(self, filepath: Path) -> Dict:
        """Safely load a JSON file"""
        if filepath.exists():
            with open(filepath, 'r') as f:
                return json.load(f)
        return {}
    
    def check_game_state(self) -> Dict:
        """Load and validate game state"""
        state = self.load_json(GAME_STATE_FILE)
        
        if not state:
            self.issues.append("game_state.json is missing or empty!")
            return {}
            
        if "character" not in state:
            self.issues.append("game_state.json missing 'character' section")
            return {}
            
        char = state["character"]
        
        # Check for required fields
        required_fields = ["name", "class", "level", "hp", "hp_max", "mp", "mp_max", 
                          "stamina", "stamina_max", "xp", "xp_next"]
        for field in required_fields:
            if field not in char:
                self.issues.append(f"Character missing required field: {field}")
                
        # Check for logical consistency
        if char.get("hp", 0) > char.get("hp_max", 0):
            self.issues.append(f"HP ({char['hp']}) exceeds HP_MAX ({char['hp_max']})")
            
        if char.get("mp", 0) > char.get("mp_max", 0):
            self.issues.append(f"MP ({char['mp']}) exceeds MP_MAX ({char['mp_max']})")
            
        if char.get("stamina", 0) > char.get("stamina_max", 0):
            self.issues.append(f"Stamina ({char['stamina']}) exceeds max ({char['stamina_max']})")
            
        return state
    
    def check_narrative_files(self) -> Dict:
        """Check narrative files for references to stats"""
        narrative_dir = BASE_DIR / "session" / "narrative"
        next_session = BASE_DIR / "NEXT_SESSION.md"
        
        narrative_data = {}
        
        # Check NEXT_SESSION.md for hardcoded stats
        if next_session.exists():
            with open(next_session, 'r') as f:
                content = f.read()
                
            # Look for hardcoded HP/MP/Stamina patterns
            hp_pattern = r'HP:\s*(\d+)/(\d+)'
            mp_pattern = r'MP:\s*(\d+)/(\d+)'
            stamina_pattern = r'Stamina:\s*(\d+)/(\d+)'
            
            if re.search(hp_pattern, content):
                self.warnings.append("NEXT_SESSION.md contains hardcoded HP values (should be narrative only)")
            if re.search(mp_pattern, content):
                self.warnings.append("NEXT_SESSION.md contains hardcoded MP values (should be narrative only)")
            if re.search(stamina_pattern, content):
                self.warnings.append("NEXT_SESSION.md contains hardcoded Stamina values (should be narrative only)")
                
        return narrative_data
    
    def check_progression_consistency(self, state: Dict):
        """Check progression history matches current level"""
        progression = self.load_json(PROGRESSION_HISTORY_FILE)
        
        if not progression:
            self.warnings.append("No progression_history.json found")
            return
            
        # Check for duplicate entries
        checkpoints = progression.get("checkpoints", [])
        seen_levels = set()
        for cp in checkpoints:
            level = cp.get("level")
            if level in seen_levels:
                self.issues.append(f"Duplicate checkpoint for level {level} in progression history")
            seen_levels.add(level)
            
        # Check if current level has a checkpoint
        if state and "character" in state:
            current_level = state["character"].get("level", 1)
            if current_level > 1 and current_level not in seen_levels:
                self.warnings.append(f"No checkpoint recorded for current level {current_level}")
    
    def check_class_support(self, state: Dict):
        """Check if character class is supported in config"""
        config_file = BASE_DIR / "system" / "config.json"
        config = self.load_json(config_file)
        
        if state and "character" in state:
            char_class = state["character"].get("class", "").lower()
            class_progression = config.get("class_progression", {})
            
            if char_class and char_class not in class_progression:
                self.issues.append(f"Class '{char_class}' not found in config.json class_progression")
                self.suggestions.append(f"Add '{char_class}' to config.json or change character class")
    
    def check_equipment_validity(self, state: Dict):
        """Check if equipped items exist in content files"""
        if not state or "character" not in state:
            return
            
        char = state["character"]
        equipment = char.get("equipment", {})
        inventory = char.get("inventory", [])
        
        # Load item definitions
        items_file = BASE_DIR / "content" / "items.json"
        custom_items_file = BASE_DIR / "content" / "custom_items.json"
        
        items = self.load_json(items_file)
        custom_items = self.load_json(custom_items_file)
        
        # Build list of all valid item IDs
        valid_items = set()
        for category in items.values():
            if isinstance(category, dict):
                valid_items.update(category.keys())
        for category in custom_items.values():
            if isinstance(category, dict):
                valid_items.update(category.keys())
                
        # Check equipped items
        for slot, item_id in equipment.items():
            if item_id and item_id not in valid_items:
                self.warnings.append(f"Equipped {slot}: '{item_id}' not found in item definitions")
                self.suggestions.append(f"Add '{item_id}' to custom_items.json or unequip it")
                
        # Check inventory items
        for item_id in inventory:
            if item_id and item_id not in valid_items:
                self.warnings.append(f"Inventory item '{item_id}' not found in item definitions")
    
    def suggest_fixes(self, state: Dict):
        """Generate suggestions for fixing issues"""
        if not state or "character" not in state:
            return
            
        char = state["character"]
        
        # Suggest HP/MP/Stamina fixes
        if char.get("hp", 0) > char.get("hp_max", 0):
            self.suggestions.append(f"Run: python system/game_engine.py damage --amount {char['hp'] - char['hp_max']}")
            
        if char.get("hp", 0) <= 0:
            self.suggestions.append("Character is at 0 HP! Run: python system/game_engine.py heal --amount 50")
            
        # Check for poison without antidotes
        if "poisoned" in state.get("status_effects", {}):
            if "antidote" not in char.get("inventory", []):
                self.suggestions.append("Character is poisoned! Add antidote: python system/game_engine.py add-item --item antidote")
            else:
                self.suggestions.append("Character is poisoned! Use: python system/game_engine.py use-item --item antidote")
    
    def run_check(self):
        """Run all sanity checks"""
        print("=" * 60)
        print("LitRPG Adventure System - Sanity Check")
        print("=" * 60)
        
        # Load and check game state
        state = self.check_game_state()
        
        # Check narrative files
        self.check_narrative_files()
        
        # Check progression
        self.check_progression_consistency(state)
        
        # Check class support
        self.check_class_support(state)
        
        # Check equipment
        self.check_equipment_validity(state)
        
        # Generate fix suggestions
        self.suggest_fixes(state)
        
        # Report results
        if state and "character" in state:
            char = state["character"]
            print("\n📊 Current State:")
            print(f"  Character: {char.get('name', 'Unknown')} (Level {char.get('level', '?')} {char.get('class', 'Unknown')})")
            print(f"  HP: {char.get('hp', '?')}/{char.get('hp_max', '?')}")
            print(f"  MP: {char.get('mp', '?')}/{char.get('mp_max', '?')}")
            print(f"  Stamina: {char.get('stamina', '?')}/{char.get('stamina_max', '?')}")
            print(f"  XP: {char.get('xp', '?')}/{char.get('xp_next', '?')}")
            
            if state.get("status_effects"):
                print(f"  Status Effects: {', '.join(state['status_effects'].keys())}")
        
        if self.issues:
            print("\n❌ Critical Issues:")
            for issue in self.issues:
                print(f"  - {issue}")
                
        if self.warnings:
            print("\n⚠️  Warnings:")
            for warning in self.warnings:
                print(f"  - {warning}")
                
        if self.suggestions:
            print("\n💡 Suggestions:")
            for suggestion in self.suggestions:
                print(f"  - {suggestion}")
                
        if not self.issues and not self.warnings:
            print("\n✅ All checks passed! System is consistent.")
        
        print("\n" + "=" * 60)
        
        # Return exit code
        return 1 if self.issues else 0

if __name__ == "__main__":
    checker = SanityChecker()
    sys.exit(checker.run_check())
#!/usr/bin/env python3
"""
Master Control Script for Adventure LitRPG Tools
One script to rule them all!
"""

import sys
import json
from pathlib import Path
from session_logger import SessionLogger
from progression_tracker import ProgressionTracker
from npc_matrix import NPCMatrix

class AdventureTools:
    def __init__(self):
        self.logger = SessionLogger()
        self.progression = ProgressionTracker()
        self.npcs = NPCMatrix()
        print("🎮 Adventure Tools Initialized!")
    
    def status_report(self):
        """Full status report of character and world"""
        print("\n" + "="*60)
        print("COMPLETE STATUS REPORT")
        print("="*60)
        
        # Character progression
        print("\n📊 CHARACTER PROGRESSION:")
        print(self.progression.visualize_progression())
        
        # NPC relationships
        print("\n🤝 RELATIONSHIPS:")
        print(self.npcs.visualize_relationships())
        
        # Current stats from game_state
        state_file = Path(__file__).parent.parent / "session" / "state" / "game_state.json"
        if state_file.exists():
            with open(state_file) as f:
                state = json.load(f)
                print(f"\n⚔️ CURRENT STATUS:")
                print(f"  Level: {state.get('level', 1)}")
                print(f"  HP: {state.get('hp', 100)}/{state.get('hp_max', 100)}")
                print(f"  Gold: {state.get('gold', 0)}")
                print(f"  Location: {state.get('current_area', 'unknown')}")
    
    def log_combat_start(self, description: str, enemies: list):
        """Start logging a combat encounter"""
        self.logger.start_combat(description, enemies)
        print(f"⚔️ Combat started: {description}")
    
    def log_combat_action(self, action_type: str, data: dict, narrative: str = None):
        """Log a combat action with narrative"""
        self.logger.log_event(action_type, data, narrative)
        if narrative:
            print(f"  → {narrative}")
    
    def log_combat_end(self, outcome: str, loot: dict = None):
        """End combat and save replay"""
        self.logger.end_combat(outcome, loot)
        print(f"✅ Combat ended: {outcome}")
    
    def update_npc(self, name: str, change: int, reason: str):
        """Update NPC relationship"""
        result = self.npcs.update_disposition(name, change, reason)
        print(f"🤝 {result}")
    
    def level_up(self, new_level: int, stats: dict, skills: list):
        """Record a level up"""
        self.progression.save_checkpoint(new_level, stats, skills, 
                                        f"Reached Level {new_level}!")
        print(f"🎉 LEVEL UP! Now Level {new_level}!")
    
    def quick_combat(self):
        """Quick combat test/demo"""
        print("\n🎮 DEMO: Quick Combat Sequence")
        
        self.log_combat_start("Bandit ambush on forest road", 
                            ["Level 5 Bandit", "Level 6 Scout"])
        
        self.log_combat_action("attack", 
                             {"damage": 18, "weapon": "greataxe"},
                             "Steve's axe crashes down with devastating force!")
        
        self.log_combat_action("damage",
                             {"damage": 8, "hp_percent": 0.85},
                             "The bandit's dagger finds a gap in the armor!")
        
        self.log_combat_action("rage_release",
                             {"ability": "Whirlwind"},
                             "RAGE EXPLODES! The axe becomes a circle of death!")
        
        self.log_combat_action("kill",
                             {"enemy": "Level 5 Bandit", "method": "bisection"},
                             "The bandit is split in two!")
        
        self.log_combat_end("victory", {"gold": 25, "items": ["poison dagger"]})
    
    def save_all(self):
        """Save all current data"""
        self.logger.save_session_chapter()
        self.progression.save()
        self.npcs.save()
        print("💾 All data saved!")

def main():
    """Main menu for adventure tools"""
    tools = AdventureTools()
    
    while True:
        print("\n" + "="*40)
        print("ADVENTURE LITRPG TOOLS")
        print("="*40)
        print("1. Full Status Report")
        print("2. Log Combat (demo)")
        print("3. Update NPC Relationship")
        print("4. Show Progression")
        print("5. Show Relationships")
        print("6. Save Everything")
        print("0. Exit")
        
        choice = input("\nChoice: ").strip()
        
        if choice == "1":
            tools.status_report()
        elif choice == "2":
            tools.quick_combat()
        elif choice == "3":
            name = input("NPC name: ")
            change = int(input("Disposition change (+/-): "))
            reason = input("Reason: ")
            tools.update_npc(name, change, reason)
        elif choice == "4":
            print(tools.progression.visualize_progression())
        elif choice == "5":
            print(tools.npcs.visualize_relationships())
        elif choice == "6":
            tools.save_all()
        elif choice == "0":
            break
        else:
            print("Invalid choice!")
    
    print("\n⚔️ May your rage burn eternal, warrior!")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Quick commands
        tools = AdventureTools()
        if sys.argv[1] == "status":
            tools.status_report()
        elif sys.argv[1] == "combat":
            tools.quick_combat()
        elif sys.argv[1] == "save":
            tools.save_all()
    else:
        main()
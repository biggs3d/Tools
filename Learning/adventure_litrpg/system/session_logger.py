#!/usr/bin/env python3
"""
Session Logger - Automatically captures combat and narrative moments
Transforms game events into visceral, novel-like chapters
"""

import json
import datetime
from pathlib import Path
from typing import Dict, List, Optional

class SessionLogger:
    def __init__(self):
        self.session_dir = Path(__file__).parent.parent / "session"
        self.chapters_dir = self.session_dir / "chapters"
        self.combat_dir = self.session_dir / "combat_replays"
        self.current_session = []
        self.combat_buffer = []
        self.session_start = datetime.datetime.now()
        
        # Create directories
        self.chapters_dir.mkdir(parents=True, exist_ok=True)
        self.combat_dir.mkdir(parents=True, exist_ok=True)
        
    def log_event(self, event_type: str, data: Dict, narrative: Optional[str] = None):
        """Log any game event with optional narrative description"""
        event = {
            "timestamp": datetime.datetime.now().isoformat(),
            "type": event_type,
            "data": data,
            "narrative": narrative
        }
        self.current_session.append(event)
        
        # If combat event, add to combat buffer
        if event_type in ["attack", "damage", "rage_release", "kill", "level_up"]:
            self.combat_buffer.append(event)
    
    def start_combat(self, description: str, enemies: List[str]):
        """Mark the beginning of a combat encounter"""
        self.combat_buffer = []
        self.log_event("combat_start", {
            "description": description,
            "enemies": enemies,
            "player_hp": self.get_current_hp()
        })
    
    def end_combat(self, outcome: str, loot: Optional[Dict] = None):
        """Mark the end of combat and save replay"""
        self.log_event("combat_end", {
            "outcome": outcome,
            "loot": loot,
            "player_hp": self.get_current_hp()
        })
        
        if self.combat_buffer:
            self.save_combat_replay()
    
    def save_combat_replay(self):
        """Save the combat as a visceral narrative replay"""
        if not self.combat_buffer:
            return
            
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        replay_file = self.combat_dir / f"combat_{timestamp}.md"
        
        with open(replay_file, 'w') as f:
            f.write("# Combat Replay\n\n")
            f.write(f"**Date**: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
            
            for event in self.combat_buffer:
                if event["narrative"]:
                    f.write(f"{event['narrative']}\n\n")
                else:
                    # Generate narrative from data
                    narrative = self.generate_narrative(event)
                    f.write(f"{narrative}\n\n")
        
        print(f"💾 Combat replay saved: {replay_file.name}")
        self.combat_buffer = []
    
    def generate_narrative(self, event: Dict) -> str:
        """Convert game data into visceral narrative"""
        event_type = event["type"]
        data = event["data"]
        
        narratives = {
            "attack": self.narrate_attack,
            "damage": self.narrate_damage,
            "rage_release": self.narrate_rage,
            "kill": self.narrate_kill,
            "level_up": self.narrate_level_up
        }
        
        return narratives.get(event_type, self.default_narrative)(data)
    
    def narrate_attack(self, data: Dict) -> str:
        """Generate visceral attack descriptions"""
        damage = data.get("damage", 0)
        weapon = data.get("weapon", "greataxe")
        critical = data.get("critical", False)
        
        if critical:
            return f"**CRITICAL HIT!** The {weapon} finds its mark with devastating precision! [{damage} damage!]"
        elif damage > 20:
            return f"The {weapon} crashes down with tremendous force, dealing {damage} damage!"
        elif damage > 10:
            return f"A solid strike with the {weapon} connects for {damage} damage."
        else:
            return f"The {weapon} grazes the target for {damage} damage."
    
    def narrate_damage(self, data: Dict) -> str:
        """Describe taking damage viscerally"""
        damage = data.get("damage", 0)
        hp_percent = data.get("hp_percent", 1.0)
        
        if damage > 20:
            return f"**DEVASTATING BLOW!** [{damage} damage taken] Blood sprays as the strike tears through armor!"
        elif hp_percent < 0.3:
            return f"[{damage} damage] Vision blurs, death creeping closer..."
        else:
            return f"[{damage} damage] The hit lands hard but the berserker endures!"
    
    def narrate_rage(self, data: Dict) -> str:
        """Describe rage release cinematically"""
        ability = data.get("ability", "Rage Release")
        return f"**{ability.upper()}!** Muscles bulge impossibly, veins standing out like cords! The rage DETONATES!"
    
    def narrate_kill(self, data: Dict) -> str:
        """Visceral kill descriptions"""
        enemy = data.get("enemy", "enemy")
        method = data.get("method", "greataxe")
        
        kills = [
            f"The {method} cleaves through {enemy} in a spray of crimson!",
            f"{enemy} falls, split nearly in two by the devastating strike!",
            f"The {method} finds its mark - {enemy} crumples, deleted from existence!",
            f"**EXECUTION!** {enemy} meets a violent end!"
        ]
        
        import random
        return random.choice(kills)
    
    def narrate_level_up(self, data: Dict) -> str:
        """Epic level up moments"""
        new_level = data.get("level", 1)
        return f"**LEVEL UP! → LEVEL {new_level}!** Power surges through every fiber! The legend grows!"
    
    def default_narrative(self, data: Dict) -> str:
        """Fallback narrative generation"""
        return f"[Event: {json.dumps(data, indent=2)}]"
    
    def get_current_hp(self) -> tuple:
        """Get current HP from game state"""
        try:
            state_file = self.session_dir / "state" / "game_state.json"
            with open(state_file) as f:
                state = json.load(f)
                return (state.get("hp", 100), state.get("hp_max", 100))
        except:
            return (100, 100)
    
    def save_session_chapter(self):
        """Save the entire session as a narrative chapter"""
        if not self.current_session:
            return
            
        session_num = len(list(self.chapters_dir.glob("session_*.md"))) + 1
        chapter_file = self.chapters_dir / f"session_{session_num:02d}.md"
        
        with open(chapter_file, 'w') as f:
            f.write(f"# Session {session_num}: {datetime.datetime.now().strftime('%Y-%m-%d')}\n\n")
            
            for event in self.current_session:
                if event.get("narrative"):
                    f.write(f"{event['narrative']}\n\n")
        
        print(f"📖 Session saved as chapter: {chapter_file.name}")
        self.current_session = []

# Example usage functions
def log_attack(damage: int, weapon: str = "greataxe", critical: bool = False, narrative: str = None):
    """Helper function to log attacks"""
    logger = SessionLogger()
    logger.log_event("attack", {
        "damage": damage,
        "weapon": weapon,
        "critical": critical
    }, narrative)

def log_combat_sequence():
    """Example of logging a full combat"""
    logger = SessionLogger()
    
    # Start combat
    logger.start_combat(
        "Ambushed by Razorback Brigands on the forest road",
        ["Level 6 Scout", "Level 5 Bandit x3"]
    )
    
    # Log events
    logger.log_event("attack", {"damage": 18, "weapon": "greataxe"}, 
                    "Steve launches himself off the wagon like a human cannonball!")
    
    logger.log_event("rage_release", {"ability": "Whirlwind of Gore"},
                    "The rage DETONATES! Steve spins like an Olympic hammer thrower!")
    
    logger.log_event("kill", {"enemy": "Level 6 Scout", "method": "bisection"},
                    "The axe doesn't just hit him - it goes THROUGH him!")
    
    # End combat
    logger.end_combat("victory", {"gold": 30, "ears": 3})
    
    # Save session
    logger.save_session_chapter()

if __name__ == "__main__":
    print("🎮 Session Logger initialized!")
    print("📝 Use logger.log_event() to capture moments")
    print("⚔️ Use logger.start_combat() and end_combat() for battles")
    print("📖 Use logger.save_session_chapter() to create narrative chapters")
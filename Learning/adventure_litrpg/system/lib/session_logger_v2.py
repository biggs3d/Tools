#!/usr/bin/env python3
"""
Session Logger v2 - Improved with singleton pattern and better error handling
Automatically captures combat and narrative moments with enhanced persistence
"""

import json
import datetime
from pathlib import Path
from typing import Dict, List, Optional
import random
from config import *

class SessionLoggerV2:
    """Singleton session logger with improved persistence and error handling"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if not self._initialized:
            self.current_session = []
            self.combat_buffer = []
            self.session_start = datetime.datetime.now()
            self.events_since_save = 0
            self._initialized = True
            
            # Ensure directories exist
            ensure_directories()
    
    def log_event(self, event_type: str, data: Dict, narrative: Optional[str] = None):
        """Log any game event with optional narrative description"""
        # Validate input
        if not isinstance(data, dict):
            raise ValueError(f"Event data must be a dictionary, got {type(data)}")
        
        event = {
            "timestamp": datetime.datetime.now().isoformat(),
            "type": event_type,
            "data": data,
            "narrative": narrative
        }
        
        self.current_session.append(event)
        self.events_since_save += 1
        
        # Auto-save if threshold reached
        if self.events_since_save >= AUTO_SAVE_INTERVAL:
            self.auto_save()
        
        # Prune old events if session gets too large
        if len(self.current_session) > MAX_SESSION_EVENTS:
            self.current_session = self.current_session[-MAX_SESSION_EVENTS:]
        
        # If combat event, add to combat buffer
        if event_type in ["attack", "damage", "rage_release", "kill", "level_up", "combat_start", "combat_end"]:
            self.combat_buffer.append(event)
    
    def auto_save(self):
        """Automatically save current session to temporary file"""
        temp_file = SESSION_DIR / "state" / ".session_autosave.json"
        try:
            with open(temp_file, 'w') as f:
                json.dump(self.current_session, f, indent=2)
            self.events_since_save = 0
        except Exception as e:
            print(f"⚠️ Auto-save failed: {e}")
    
    def start_combat(self, description: str, enemies: List[str]):
        """Mark the beginning of a combat encounter"""
        self.combat_buffer = []
        self.log_event("combat_start", {
            "description": description,
            "enemies": enemies,
            "player_hp": self.get_current_hp()
        }, f"⚔️ Combat begins: {description}")
    
    def end_combat(self, outcome: str, loot: Optional[Dict] = None):
        """Mark the end of combat and save replay"""
        self.log_event("combat_end", {
            "outcome": outcome,
            "loot": loot,
            "player_hp": self.get_current_hp()
        }, f"Combat ends: {outcome.upper()}!")
        
        if self.combat_buffer:
            replay_file = self.save_combat_replay()
            return replay_file
        return None
    
    def save_combat_replay(self) -> Optional[Path]:
        """Save the combat as a visceral narrative replay"""
        if not self.combat_buffer:
            return None
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        replay_file = COMBAT_REPLAYS_DIR / f"combat_{timestamp}.md"
        
        try:
            with open(replay_file, 'w') as f:
                # Add metadata header
                f.write("# Combat Replay\n\n")
                f.write(f"**Date**: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
                f.write(f"**Duration**: {len(self.combat_buffer)} events\n\n")
                f.write("---\n\n")
                
                for event in self.combat_buffer:
                    if event.get("narrative"):
                        f.write(f"{event['narrative']}\n\n")
                    else:
                        # Generate narrative from data
                        narrative = self.generate_narrative(event)
                        if narrative:
                            f.write(f"{narrative}\n\n")
            
            print(f"💾 Combat replay saved: {replay_file.name}")
            self.combat_buffer = []
            return replay_file
            
        except Exception as e:
            print(f"❌ Failed to save combat replay: {e}")
            return None
    
    def generate_narrative(self, event: Dict) -> str:
        """Convert game data into visceral narrative"""
        event_type = event.get("type", "unknown")
        data = event.get("data", {})
        
        narratives = {
            "attack": self.narrate_attack,
            "damage": self.narrate_damage,
            "rage_release": self.narrate_rage,
            "kill": self.narrate_kill,
            "level_up": self.narrate_level_up,
            "combat_start": self.narrate_combat_start,
            "combat_end": self.narrate_combat_end
        }
        
        narrator = narratives.get(event_type, self.default_narrative)
        return narrator(data)
    
    def narrate_attack(self, data: Dict) -> str:
        """Generate visceral attack descriptions"""
        damage = data.get("damage", 0)
        weapon = data.get("weapon", "greataxe")
        critical = data.get("critical", False)
        
        if critical:
            return f"**CRITICAL HIT!** The {weapon} finds its mark with devastating precision! [{damage} damage!]"
        
        for threshold_name, threshold_value in sorted(DAMAGE_THRESHOLDS.items(), key=lambda x: -x[1]):
            if damage >= threshold_value:
                templates = {
                    "devastating": f"**DEVASTATING!** The {weapon} obliterates the target! [{damage} damage!]",
                    "critical": f"The {weapon} crashes down with tremendous force! [{damage} damage]",
                    "heavy": f"A crushing blow from the {weapon}! [{damage} damage]",
                    "solid": f"A solid strike with the {weapon} connects. [{damage} damage]",
                    "light": f"The {weapon} finds its mark. [{damage} damage]",
                    "graze": f"The {weapon} grazes the target. [{damage} damage]"
                }
                return templates.get(threshold_name, f"Attack deals {damage} damage.")
        
        return f"The {weapon} deals {damage} damage."
    
    def narrate_damage(self, data: Dict) -> str:
        """Describe taking damage viscerally"""
        damage = data.get("damage", 0)
        hp_percent = data.get("hp_percent", 1.0)
        source = data.get("source", "enemy")
        
        if damage > 30:
            return f"**DEVASTATING BLOW from {source}!** [{damage} damage taken] Blood sprays as the strike tears through armor!"
        elif hp_percent < 0.3:
            return f"[{damage} damage from {source}] Vision blurs, death creeping closer... HP critical!"
        elif damage > 15:
            return f"[{damage} damage from {source}] The strike lands hard, sending you reeling!"
        else:
            return f"[{damage} damage from {source}] You grit your teeth and endure!"
    
    def narrate_rage(self, data: Dict) -> str:
        """Describe rage release cinematically"""
        ability = data.get("ability", "Rage Release")
        cost = data.get("cost", "unknown")
        return f"**{ability.upper()}!** [Cost: {cost}] Muscles bulge impossibly! The rage DETONATES!"
    
    def narrate_kill(self, data: Dict) -> str:
        """Visceral kill descriptions with variety"""
        enemy = data.get("enemy", "enemy")
        method = data.get("method", "greataxe")
        
        kills = [
            f"The {method} cleaves through {enemy} in a spray of crimson!",
            f"{enemy} falls, split nearly in two by the devastating {method} strike!",
            f"The {method} finds its mark - {enemy} crumples, deleted from existence!",
            f"**EXECUTION!** {enemy} meets a violent end at the hands of the {method}!",
            f"With a sickening crunch, the {method} ends {enemy}'s life!",
            f"{enemy} attempts to dodge, but the {method} is inevitable. They fall."
        ]
        
        # Use hash of enemy name for consistent but varied descriptions
        index = hash(enemy) % len(kills)
        return kills[index]
    
    def narrate_level_up(self, data: Dict) -> str:
        """Epic level up moments"""
        new_level = data.get("level", 1)
        skills = data.get("new_skills", [])
        
        narration = f"**LEVEL UP! → LEVEL {new_level}!** Power surges through every fiber! The legend grows!"
        if skills:
            narration += f"\nNew abilities unlocked: {', '.join(skills)}"
        return narration
    
    def narrate_combat_start(self, data: Dict) -> str:
        """Narrate combat beginning"""
        enemies = data.get("enemies", [])
        description = data.get("description", "Combat begins")
        
        if len(enemies) == 1:
            return f"⚔️ {description}. You face {enemies[0]}!"
        else:
            return f"⚔️ {description}. You face {', '.join(enemies[:-1])} and {enemies[-1]}!"
    
    def narrate_combat_end(self, data: Dict) -> str:
        """Narrate combat conclusion"""
        outcome = data.get("outcome", "unknown")
        loot = data.get("loot", {})
        
        if outcome == "victory":
            narration = "✨ VICTORY! The battlefield falls silent."
            if loot:
                narration += f" Loot gained: {', '.join(f'{k}: {v}' for k, v in loot.items())}"
        elif outcome == "defeat":
            narration = "💀 DEFEAT... Darkness claims you."
        else:
            narration = f"Combat ends: {outcome}"
        
        return narration
    
    def default_narrative(self, data: Dict) -> str:
        """Fallback narrative generation"""
        return f"[Event: {json.dumps(data, indent=2)}]"
    
    def get_current_hp(self) -> tuple:
        """Get current HP from game state with better error handling"""
        try:
            if GAME_STATE_FILE.exists():
                with open(GAME_STATE_FILE) as f:
                    state = json.load(f)
                    return (state.get("hp", DEFAULT_HP), state.get("hp_max", DEFAULT_HP))
        except FileNotFoundError:
            print(f"⚠️ Game state file not found, using defaults")
        except json.JSONDecodeError as e:
            print(f"⚠️ Invalid JSON in game state: {e}")
        except Exception as e:
            print(f"⚠️ Error reading game state: {e}")
        
        return (DEFAULT_HP, DEFAULT_HP)
    
    def save_session_chapter(self) -> Optional[Path]:
        """Save the entire session as a narrative chapter"""
        if not self.current_session:
            print("No events to save")
            return None
        
        session_num = len(list(CHAPTERS_DIR.glob("session_*.md"))) + 1
        chapter_file = CHAPTERS_DIR / f"session_{session_num:02d}.md"
        
        try:
            with open(chapter_file, 'w') as f:
                # Metadata header
                f.write(f"# Session {session_num}: {datetime.datetime.now().strftime('%Y-%m-%d')}\n\n")
                f.write(f"**Duration**: {len(self.current_session)} events\n")
                f.write(f"**Start Time**: {self.session_start.strftime('%H:%M')}\n\n")
                f.write("---\n\n")
                
                # Write all events with narratives
                for event in self.current_session:
                    if event.get("narrative"):
                        f.write(f"{event['narrative']}\n\n")
                    else:
                        # Generate narrative for events without one
                        narrative = self.generate_narrative(event)
                        if narrative:
                            f.write(f"{narrative}\n\n")
            
            print(f"📖 Session saved as chapter: {chapter_file.name}")
            self.current_session = []
            self.events_since_save = 0
            return chapter_file
            
        except Exception as e:
            print(f"❌ Failed to save session chapter: {e}")
            return None
    
    def load_last_session(self) -> bool:
        """Load the last auto-saved session if it exists"""
        autosave_file = SESSION_DIR / "state" / ".session_autosave.json"
        if autosave_file.exists():
            try:
                with open(autosave_file) as f:
                    self.current_session = json.load(f)
                print(f"✅ Loaded {len(self.current_session)} events from autosave")
                return True
            except Exception as e:
                print(f"⚠️ Could not load autosave: {e}")
        return False

# Global singleton instance
session_logger = SessionLoggerV2()

# Convenience functions that use the singleton
def log_attack(damage: int, weapon: str = "greataxe", critical: bool = False, narrative: str = None):
    """Helper function to log attacks"""
    session_logger.log_event("attack", {
        "damage": damage,
        "weapon": weapon,
        "critical": critical
    }, narrative)

def log_damage(damage: int, source: str = "enemy", hp_percent: float = 1.0, narrative: str = None):
    """Helper function to log damage taken"""
    session_logger.log_event("damage", {
        "damage": damage,
        "source": source,
        "hp_percent": hp_percent
    }, narrative)

def log_kill(enemy: str, method: str = "greataxe", narrative: str = None):
    """Helper function to log kills"""
    session_logger.log_event("kill", {
        "enemy": enemy,
        "method": method
    }, narrative)
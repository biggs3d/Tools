#!/usr/bin/env python3
"""
Stat & Skill Progression Tracker
Visualizes character growth and tracks all improvements
"""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List

class ProgressionTracker:
    def __init__(self):
        self.session_dir = Path(__file__).parent.parent / "session"
        self.progression_file = self.session_dir / "state" / "progression_history.json"
        self.skills_file = self.session_dir / "state" / "skills_tracking.json"
        self.load_or_create()
    
    def load_or_create(self):
        """Load existing progression or create new"""
        if self.progression_file.exists():
            with open(self.progression_file) as f:
                self.history = json.load(f)
        else:
            self.history = {
                "created": datetime.now().isoformat(),
                "checkpoints": [],
                "stat_history": [],
                "skill_history": [],
                "achievements": []
            }
        
        if self.skills_file.exists():
            with open(self.skills_file) as f:
                self.skills = json.load(f)
        else:
            self.skills = {
                "berserker": {
                    "available": [
                        {"name": "Bloodlust", "rank": 0, "max_rank": 5, "description": "Each kill +5% damage per rank"},
                        {"name": "Rampage", "rank": 1, "max_rank": 3, "description": "Speed multiplier when low HP"},
                        {"name": "Blood for Blood", "rank": 0, "max_rank": 1, "description": "Trade HP for damage"},
                        {"name": "Brutal Critical", "rank": 0, "max_rank": 2, "description": "Increased crit damage"},
                        {"name": "Intimidating Presence", "rank": 2, "max_rank": 3, "description": "Fear/convert enemies"},
                        {"name": "Berserker's Recovery", "rank": 1, "max_rank": 5, "description": "HP regen in combat"},
                        {"name": "Weapon Throw", "rank": 0, "max_rank": 1, "description": "Ranged attack"},
                        {"name": "Blood Sense", "rank": 0, "max_rank": 1, "description": "See weakpoints"},
                        {"name": "Unstoppable", "rank": 1, "max_rank": 2, "description": "Immunity to control"}
                    ],
                    "skill_points_spent": 5,
                    "skill_points_available": 0
                }
            }
    
    def save_checkpoint(self, level: int, stats: Dict, skills: List[str], narrative: str = ""):
        """Save a progression checkpoint"""
        checkpoint = {
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "stats": stats,
            "skills": skills,
            "narrative": narrative
        }
        
        self.history["checkpoints"].append(checkpoint)
        self.save()
        
    def record_stat_change(self, stat: str, old_value: int, new_value: int):
        """Track individual stat changes"""
        change = {
            "timestamp": datetime.now().isoformat(),
            "stat": stat,
            "old": old_value,
            "new": new_value,
            "change": new_value - old_value
        }
        
        self.history["stat_history"].append(change)
        self.save()
    
    def record_skill_acquisition(self, skill: str, rank: int = 1):
        """Track skill learning/upgrading"""
        acquisition = {
            "timestamp": datetime.now().isoformat(),
            "skill": skill,
            "rank": rank
        }
        
        self.history["skill_history"].append(acquisition)
        
        # Update skills tracking
        for skill_data in self.skills["berserker"]["available"]:
            if skill_data["name"] == skill:
                skill_data["rank"] = rank
                break
        
        self.save()
    
    def add_achievement(self, title: str, description: str):
        """Record a notable achievement"""
        achievement = {
            "timestamp": datetime.now().isoformat(),
            "title": title,
            "description": description
        }
        
        self.history["achievements"].append(achievement)
        self.save()
    
    def save(self):
        """Save all progression data"""
        self.progression_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(self.progression_file, 'w') as f:
            json.dump(self.history, f, indent=2)
        
        with open(self.skills_file, 'w') as f:
            json.dump(self.skills, f, indent=2)
    
    def visualize_progression(self) -> str:
        """Create ASCII visualization of stat progression"""
        if not self.history["checkpoints"]:
            return "No progression data yet!"
        
        output = ["=" * 50]
        output.append("CHARACTER PROGRESSION TIMELINE")
        output.append("=" * 50)
        
        # Show level progression
        levels = [cp["level"] for cp in self.history["checkpoints"]]
        output.append(f"\nLevel Journey: {' → '.join(map(str, levels))}")
        
        # Latest stats
        if self.history["checkpoints"]:
            latest = self.history["checkpoints"][-1]
            output.append(f"\nCurrent Stats (Level {latest['level']}):")
            
            stats = latest["stats"]
            stat_bars = {
                "STR": self.make_bar(stats.get("strength", 10), 20),
                "DEX": self.make_bar(stats.get("dexterity", 10), 20),
                "CON": self.make_bar(stats.get("constitution", 10), 20),
                "INT": self.make_bar(stats.get("intelligence", 10), 20),
                "WIS": self.make_bar(stats.get("wisdom", 10), 20),
                "CHA": self.make_bar(stats.get("charisma", 10), 20)
            }
            
            for stat, bar in stat_bars.items():
                value = stats.get(stat.lower() + ("" if stat == "STR" else ""), 10)
                if stat == "STR":
                    value = stats.get("strength", 10)
                output.append(f"  {stat}: {bar} {value}")
        
        # Skill summary
        output.append("\nAcquired Skills:")
        learned_skills = [s for s in self.skills["berserker"]["available"] if s["rank"] > 0]
        for skill in learned_skills:
            stars = "★" * skill["rank"] + "☆" * (skill["max_rank"] - skill["rank"])
            output.append(f"  • {skill['name']} {stars}")
        
        # Achievements
        if self.history["achievements"]:
            output.append("\nAchievements Unlocked:")
            for ach in self.history["achievements"][-5:]:  # Last 5
                output.append(f"  🏆 {ach['title']}")
        
        output.append("=" * 50)
        
        return "\n".join(output)
    
    def make_bar(self, value: int, max_value: int, width: int = 20) -> str:
        """Create ASCII progress bar"""
        filled = int((value / max_value) * width)
        return "▓" * filled + "░" * (width - filled)
    
    def get_stat_growth_rate(self) -> Dict[str, float]:
        """Calculate growth rate per level for each stat"""
        if len(self.history["checkpoints"]) < 2:
            return {}
        
        first = self.history["checkpoints"][0]
        last = self.history["checkpoints"][-1]
        level_diff = last["level"] - first["level"]
        
        if level_diff == 0:
            return {}
        
        growth_rates = {}
        for stat in ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]:
            start_val = first["stats"].get(stat, 10)
            end_val = last["stats"].get(stat, 10)
            growth_rates[stat] = (end_val - start_val) / level_diff
        
        return growth_rates

# Initialize Steve's current progression
def initialize_steve_progression():
    """Set up Steve's current Level 4 progression"""
    tracker = ProgressionTracker()
    
    # Level 1 start (coffee shop)
    tracker.save_checkpoint(
        level=1,
        stats={"strength": 14, "dexterity": 12, "constitution": 14, 
               "intelligence": 10, "wisdom": 11, "charisma": 10},
        skills=[],
        narrative="Fresh from the coffee shop, newly minted berserker"
    )
    
    # Level 3 (post-Threshold Beast)
    tracker.save_checkpoint(
        level=3,
        stats={"strength": 16, "dexterity": 15, "constitution": 15,
               "intelligence": 10, "wisdom": 11, "charisma": 10},
        skills=["Rampage", "Intimidating Presence"],
        narrative="Defeated Threshold Beast in record time"
    )
    
    # Level 4 (current)
    tracker.save_checkpoint(
        level=4,
        stats={"strength": 18, "dexterity": 17, "constitution": 16,
               "intelligence": 11, "wisdom": 11, "charisma": 10},
        skills=["Rampage", "Intimidating Presence★★", "Berserker's Recovery", "Unstoppable"],
        narrative="Eliminated Howling Scars gang, arrived at Ironhold"
    )
    
    # Add achievements
    tracker.add_achievement("Speed Demon", "Reached Level 3 in under 5 minutes")
    tracker.add_achievement("Threshold Slayer", "+10% damage vs higher level enemies")
    tracker.add_achievement("The Immediate", "Earned legendary title in first combat")
    tracker.add_achievement("Bandit's Bane", "Eliminated entire Howling Scars gang")
    
    print("✅ Steve's progression initialized!")
    print("\n" + tracker.visualize_progression())

if __name__ == "__main__":
    initialize_steve_progression()
#!/usr/bin/env python3
"""
NPC Relationship Matrix
Tracks how NPCs view Steve and their evolving relationships
"""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

class NPCMatrix:
    def __init__(self):
        self.session_dir = Path(__file__).parent.parent / "session"
        self.matrix_file = self.session_dir / "world" / "npc_relationships.json"
        self.load_or_create()
    
    def load_or_create(self):
        """Load existing NPC relationships or create new"""
        if self.matrix_file.exists():
            with open(self.matrix_file) as f:
                self.relationships = json.load(f)
        else:
            self.relationships = {
                "created": datetime.now().isoformat(),
                "npcs": {},
                "factions": {},
                "reputation": {
                    "ironhold": 0,
                    "merchants_guild": 0,
                    "adventurers_hall": 0,
                    "underworld": 0
                }
            }
            self.initialize_steve_npcs()
    
    def initialize_steve_npcs(self):
        """Set up Steve's initial NPC relationships"""
        self.add_npc(
            "Garrett Ironside",
            disposition=85,
            relationship="Battle Brother",
            faction="Merchants",
            notes=[
                "Fought together against Howling Scars",
                "Ex-Captain, Third Legion",
                "Planning Scarred Wolves raid together",
                "Rediscovered his combat spirit through Steve"
            ],
            last_interaction="Cleared bandit camp together"
        )
        
        self.add_npc(
            "Kaya",
            disposition=75,
            relationship="Mysterious Guide",
            faction="Unknown",
            notes=[
                "Golden eyes, appears/disappears at will",
                "Tutorial guide, knows about the Convergence",
                "Has memory crystal of Steve's fights",
                "Seems amused by Steve's speedrun approach",
                "Spanish phrases suggest cultural connection"
            ],
            last_interaction="Watched bandit camp clearing"
        )
        
        self.add_npc(
            "Melody",
            disposition=60,
            relationship="Fan",
            faction="Civilians",
            notes=[
                "Merchant's daughter",
                "Got Steve's autograph",
                "Part of growing fanbase"
            ],
            last_interaction="Autograph at Threshold Station"
        )
        
        self.add_npc(
            "Razorback Leader",
            disposition=-100,
            relationship="Deceased Enemy",
            faction="Howling Scars",
            notes=[
                "Level 6 bandit leader",
                "Killed by Steve and Garrett",
                "Had intel on Scarred Wolves"
            ],
            last_interaction="Killed in combat"
        )
        
        # Add faction relationships
        self.set_faction_standing("Merchants Guild", 25, "Eliminated major bandit threat")
        self.set_faction_standing("Howling Scars", -100, "Eliminated entire gang")
        self.set_faction_standing("Scarred Wolves", -10, "Unknown but will learn soon")
        self.set_faction_standing("Ironhold Guard", 15, "Cleared road threats")
    
    def add_npc(self, name: str, disposition: int = 0, relationship: str = "Acquaintance",
                faction: str = "Independent", notes: List[str] = None, 
                last_interaction: str = ""):
        """Add or update an NPC"""
        self.relationships["npcs"][name] = {
            "disposition": disposition,  # -100 to 100
            "relationship": relationship,
            "faction": faction,
            "notes": notes or [],
            "last_interaction": last_interaction,
            "history": []
        }
        self.save()
    
    def update_disposition(self, name: str, change: int, reason: str):
        """Change NPC's disposition toward Steve"""
        if name not in self.relationships["npcs"]:
            print(f"Warning: {name} not found in NPC matrix")
            return
        
        npc = self.relationships["npcs"][name]
        old_disposition = npc["disposition"]
        npc["disposition"] = max(-100, min(100, old_disposition + change))
        
        # Track history
        npc["history"].append({
            "timestamp": datetime.now().isoformat(),
            "change": change,
            "reason": reason,
            "new_disposition": npc["disposition"]
        })
        
        # Update relationship description based on disposition
        npc["relationship"] = self.get_relationship_level(npc["disposition"])
        
        self.save()
        
        return f"{name}: {old_disposition} → {npc['disposition']} ({reason})"
    
    def get_relationship_level(self, disposition: int) -> str:
        """Convert disposition number to relationship description"""
        if disposition >= 90:
            return "Devoted Ally"
        elif disposition >= 70:
            return "Close Friend"
        elif disposition >= 50:
            return "Friend"
        elif disposition >= 30:
            return "Friendly"
        elif disposition >= 10:
            return "Acquaintance"
        elif disposition >= -10:
            return "Neutral"
        elif disposition >= -30:
            return "Wary"
        elif disposition >= -50:
            return "Hostile"
        elif disposition >= -70:
            return "Enemy"
        else:
            return "Nemesis"
    
    def set_faction_standing(self, faction: str, standing: int, reason: str):
        """Set faction reputation"""
        self.relationships["factions"][faction] = {
            "standing": standing,
            "reason": reason,
            "updated": datetime.now().isoformat()
        }
        self.save()
    
    def add_note(self, name: str, note: str):
        """Add a note about an NPC"""
        if name in self.relationships["npcs"]:
            self.relationships["npcs"][name]["notes"].append(note)
            self.save()
    
    def save(self):
        """Save NPC matrix"""
        self.matrix_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.matrix_file, 'w') as f:
            json.dump(self.relationships, f, indent=2)
    
    def visualize_relationships(self) -> str:
        """Create visual representation of relationships"""
        output = ["=" * 60]
        output.append("NPC RELATIONSHIP MATRIX")
        output.append("=" * 60)
        
        # Sort NPCs by disposition
        npcs_sorted = sorted(
            self.relationships["npcs"].items(),
            key=lambda x: x[1]["disposition"],
            reverse=True
        )
        
        output.append("\n📊 Individual Relationships:")
        for name, data in npcs_sorted:
            disp = data["disposition"]
            rel = data["relationship"]
            
            # Create visual bar
            if disp >= 0:
                bar = "💚" * (disp // 20) + "🤍" * (5 - disp // 20)
            else:
                bar = "❤️" * (abs(disp) // 20) + "🤍" * (5 - abs(disp) // 20)
            
            output.append(f"  {name:<20} {bar} [{disp:+3}] {rel}")
            
            if data.get("last_interaction"):
                output.append(f"    └─ {data['last_interaction']}")
        
        # Faction standings
        output.append("\n🏛️ Faction Standings:")
        for faction, data in self.relationships["factions"].items():
            standing = data["standing"]
            if standing > 0:
                symbol = "✅"
            elif standing < 0:
                symbol = "⚔️"
            else:
                symbol = "◻️"
            
            output.append(f"  {symbol} {faction:<20} [{standing:+3}]")
        
        output.append("=" * 60)
        
        return "\n".join(output)
    
    def get_allies(self, min_disposition: int = 50) -> List[str]:
        """Get list of allies above threshold"""
        return [
            name for name, data in self.relationships["npcs"].items()
            if data["disposition"] >= min_disposition
        ]
    
    def get_enemies(self, max_disposition: int = -30) -> List[str]:
        """Get list of enemies below threshold"""
        return [
            name for name, data in self.relationships["npcs"].items()
            if data["disposition"] <= max_disposition
        ]
    
    def predict_reaction(self, npc_name: str) -> str:
        """Predict how an NPC will react to Steve"""
        if npc_name not in self.relationships["npcs"]:
            return "Unknown NPC - neutral reaction expected"
        
        npc = self.relationships["npcs"][npc_name]
        disp = npc["disposition"]
        
        if disp >= 70:
            return f"{npc_name} will actively help and support Steve"
        elif disp >= 30:
            return f"{npc_name} will be friendly and cooperative"
        elif disp >= -10:
            return f"{npc_name} will be neutral, focused on business"
        elif disp >= -50:
            return f"{npc_name} will be hostile but not immediately violent"
        else:
            return f"{npc_name} will attack on sight or flee in terror"

# Example usage
def demonstrate_npc_system():
    """Show how the NPC matrix works"""
    matrix = NPCMatrix()
    
    print(matrix.visualize_relationships())
    print("\n🤝 Current Allies:", matrix.get_allies())
    print("⚔️ Current Enemies:", matrix.get_enemies())
    
    # Example interaction
    print("\n📝 Example: Meeting Garrett again")
    print(matrix.predict_reaction("Garrett Ironside"))
    
    # Update based on event
    result = matrix.update_disposition("Garrett Ironside", 5, "Successful mission together")
    print(f"Relationship updated: {result}")

if __name__ == "__main__":
    demonstrate_npc_system()
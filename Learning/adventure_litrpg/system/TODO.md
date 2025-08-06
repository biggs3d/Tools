# TODO.md - LitRPG Adventure System Setup

## Repository Structure to Create

```
litrpg-adventure/
├── README.md                 # Overview and quick start guide
├── TODO.md                   # This file
├── .gitignore               # Ignore session data for sharing
│
├── system/                   # Core game system (DO NOT MODIFY DURING PLAY)
│   ├── game_engine.py       # Number cruncher (from artifact)
│   ├── dm_instructions.md   # Narrative guidelines (from artifact)
│   ├── session_zero.md      # Character creation templates
│   └── world_settings.json  # Configurable world parameters
│
├── content/                  # World content and databases
│   ├── bestiary.json        # Enemy templates with damage/HP
│   ├── items.json           # Weapons, armor, consumables
│   ├── spells.json          # Spell costs and damage formulas
│   ├── locations.json       # Major locations and connections
│   ├── factions.json        # Groups and reputation levels
│   └── random_tables.json   # Names, events, loot tables
│
├── prompts/                  # Specialized narrative prompts
│   ├── combat_narrative.md  # Combat description guidelines
│   ├── npc_personalities.md # NPC voice and behavior guides
│   ├── environment_desc.md  # Location atmosphere templates
│   └── loot_generation.md   # Meaningful treasure creation
│
├── session/                  # ACTIVE GAME DATA (git ignored)
│   ├── state/               # Current mechanical state
│   │   ├── game_state.json  # Character stats and flags
│   │   ├── inventory.json   # Detailed inventory
│   │   └── combat.json      # Active combat if any
│   │
│   ├── narrative/           # Story tracking
│   │   ├── current_scene.md # Where we are right now
│   │   ├── timeline.md      # Chronological major events
│   │   ├── threads.md       # Active plot lines
│   │   └── session_log.md   # Detailed play history
│   │
│   ├── world/               # World state tracking
│   │   ├── relationships.json   # NPC dispositions
│   │   ├── locations_visited.json # Location states
│   │   ├── knowledge.md     # Discovered lore and clues
│   │   └── reputation.json  # Faction standings
│   │
│   └── meta/                # Player preferences
│       ├── tone.md          # Preferred narrative style
│       ├── focus.md         # Combat/social/exploration
│       └── notes.md         # Player's personal notes
│
└── archives/                 # Completed adventures
    └── [timestamp]/         # Backed up complete sessions
```

## Setup Instructions for Claude Code

### Step 1: Initial Repository Creation

```bash
# First message to Claude Code:

Create the directory structure as specified in TODO.md. Then create the following 
initial files with the content I'll provide:

1. system/game_engine.py - Copy from the artifact
2. system/dm_instructions.md - Copy from the narrative artifact  
3. system/session_zero.md - Copy from the session zero artifact

After creating these, initialize empty JSON files for all databases and create 
placeholder .md files with appropriate headers.
```

### Step 2: Configure World Settings

```markdown
# system/world_settings.json to create:

{
  "world_name": "Ashfall",
  "tone": "dark_fantasy",
  "power_scale": "grounded_to_epic",
  "magic_level": "medium",
  "technology": "medieval",
  
  "difficulty": {
    "combat_scaling": 1.0,
    "resource_scarcity": "normal",
    "death_consequences": "narrative_saves",
    "healing_availability": "moderate"
  },
  
  "narrative_preferences": {
    "description_detail": "rich",
    "combat_detail": "cinematic", 
    "npc_depth": "full_personalities",
    "romance_allowed": true,
    "graphic_violence": "moderate"
  },
  
  "house_rules": {
    "critical_hit_multiplier": 2.0,
    "rest_healing": {
      "short": 0.25,
      "long": 1.0
    },
    "death_save_threshold": -10,
    "encumbrance": false
  }
}
```

### Step 3: Populate Core Databases

```markdown
# Request to Claude Code:

Please create starter content for the following databases:

1. **bestiary.json** - Include:
   - Goblin (weak enemy)
   - Bandit (human enemy)
   - Wolf (beast)
   - Corrupted Mage (elite enemy)
   - Stone Guardian (boss)

2. **items.json** - Include:
   - Basic weapons (sword, dagger, bow, staff)
   - Basic armor (leather, chain, robes)
   - Consumables (health potion, mana potion)
   - Special items (lockpicks, rope, torch)

3. **spells.json** - Include:
   - Firebolt (basic damage)
   - Heal (basic healing)
   - Shield (temporary defense)
   - Teleport (utility)

Use this format for enemies:
{
  "goblin": {
    "hp": "2d6+3",
    "damage": "1d4+1",
    "armor": 1,
    "xp": 25,
    "loot_table": "common_humanoid"
  }
}
```

### Step 4: Initialize Session Management

```python
# session_manager.py to create:

import json
import os
from datetime import datetime
from pathlib import Path
import shutil

class SessionManager:
    def __init__(self, session_name=None):
        self.session_name = session_name or datetime.now().strftime("%Y%m%d_%H%M%S")
        self.session_path = Path(f"session")
        self.ensure_directories()
    
    def ensure_directories(self):
        """Create all necessary subdirectories"""
        dirs = [
            "session/state",
            "session/narrative", 
            "session/world",
            "session/meta"
        ]
        for dir in dirs:
            Path(dir).mkdir(parents=True, exist_ok=True)
    
    def checkpoint(self, label="checkpoint"):
        """Create a backup of current session"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = Path(f"archives/{timestamp}_{label}")
        shutil.copytree("session", backup_dir)
        return f"Checkpoint created: {backup_dir}"
    
    def log_event(self, event_type, description, mechanical_result=None):
        """Add entry to session log"""
        log_file = Path("session/narrative/session_log.md")
        
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
        entry = f"\n### [{timestamp}] {event_type}\n"
        entry += f"**Description**: {description}\n"
        
        if mechanical_result:
            entry += f"**Result**: {mechanical_result}\n"
        
        entry += "---\n"
        
        with open(log_file, 'a') as f:
            f.write(entry)
    
    def update_thread(self, thread_id, status, notes):
        """Track plot threads"""
        threads_file = Path("session/narrative/threads.md")
        # Implementation for updating narrative threads
        pass
    
    def save_relationship(self, npc_name, disposition, notes=""):
        """Track NPC relationships"""
        rel_file = Path("session/world/relationships.json")
        
        try:
            with open(rel_file, 'r') as f:
                relationships = json.load(f)
        except:
            relationships = {}
        
        relationships[npc_name] = {
            "disposition": disposition,  # -100 to 100
            "last_interaction": datetime.now().isoformat(),
            "notes": notes
        }
        
        with open(rel_file, 'w') as f:
            json.dump(relationships, f, indent=2)
```

### Step 5: Create Narrative Templates

```markdown
# prompts/combat_narrative.md to create:

## Combat Description Templates

### Attack Outcomes by Damage Percentage
- **0-10% enemy HP**: "Your blade scratches across their [armor/hide]..."
- **11-25% enemy HP**: "A solid strike that draws [blood/sparks/ichor]..."
- **26-50% enemy HP**: "Your [weapon] bites deep, staggering your foe..."
- **51-75% enemy HP**: "A devastating blow that nearly drops them..."
- **76-100% enemy HP**: "Your strike finds the perfect opening..."
- **Killing blow**: "Your [weapon] [cleaves/pierces/crushes] through..."

### Environmental Combat Modifiers
- Rain: "Water streams into your eyes as you..."
- Darkness: "Fighting by sound and instinct..."
- Cramped: "The walls limit your swings..."
- High ground: "Your elevated position grants..."
```

### Step 6: Testing Checklist

```markdown
# Test these commands with Claude Code:

## System Tests
- [ ] Create new character (all classes)
- [ ] Load existing character
- [ ] Basic attack calculation
- [ ] Damage and healing
- [ ] Level up process
- [ ] Rest mechanics

## Narrative Tests  
- [ ] Combat scene generation
- [ ] NPC interaction
- [ ] Location description
- [ ] Item discovery
- [ ] Plot thread management

## Session Management
- [ ] Create checkpoint
- [ ] Log events properly
- [ ] Track relationships
- [ ] Update world state
- [ ] Archive old session

## Edge Cases
- [ ] Character death handling
- [ ] Invalid action attempts
- [ ] Missing file recovery
- [ ] State corruption recovery
```

### Step 7: Quick Start Script

```python
# quickstart.py - One command to begin

#!/usr/bin/env python3
"""
Quick start a new adventure or resume existing one
Usage: python quickstart.py [--new NAME CLASS | --load SAVE_FILE]
"""

import sys
import json
from pathlib import Path

def print_banner():
    print("""
    ╔══════════════════════════════════════════╗
    ║      LitRPG ADVENTURE SYSTEM v1.0        ║
    ║   Narrative First, Numbers That Matter   ║
    ╚══════════════════════════════════════════╝
    """)

def new_game():
    print("\n=== NEW ADVENTURE ===")
    name = input("Character name: ")
    print("\nAvailable classes:")
    print("1. Warrior - High HP, melee combat")
    print("2. Mage - Glass cannon, powerful spells")
    print("3. Rogue - Stealth, precision, cunning")
    
    class_choice = input("\nChoose (1-3): ")
    classes = {1: "warrior", 2: "mage", 3: "rogue"}
    
    return {
        "command": "new",
        "name": name,
        "class": classes.get(int(class_choice), "warrior")
    }

def load_game():
    saves = list(Path("session/state").glob("*.json"))
    if not saves:
        print("No save files found!")
        return None
    
    print("\n=== LOAD GAME ===")
    for i, save in enumerate(saves):
        print(f"{i+1}. {save.stem}")
    
    choice = input("\nChoose save: ")
    return {
        "command": "load",
        "file": saves[int(choice)-1]
    }

if __name__ == "__main__":
    print_banner()
    
    if "--new" in sys.argv:
        config = new_game()
    elif "--load" in sys.argv:
        config = load_game()
    else:
        print("1. New Adventure")
        print("2. Continue Adventure")
        choice = input("\nChoice: ")
        
        config = new_game() if choice == "1" else load_game()
    
    # Output config for Claude Code to read
    print(f"\n=== Configuration ===")
    print(json.dumps(config, indent=2))
    print("\nCopy the above configuration to start your adventure!")
```

### Step 8: Git Configuration

```gitignore
# .gitignore contents:

# Active session data (personal games)
session/state/*
session/narrative/session_log.md
session/narrative/current_scene.md
session/world/relationships.json
session/meta/notes.md

# But keep the structure
!session/**/README.md
!session/**/.gitkeep

# Archives of completed games
archives/

# Python
__pycache__/
*.py[cod]
*$py.class
.Python
env/
venv/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
```

### Step 9: README for Repository

```markdown
# README.md content:

# LitRPG Adventure System

A narrative-first LitRPG framework for Claude Code that balances storytelling 
freedom with mechanical progression.

## Quick Start

1. Clone this repository
2. Open in Claude Code
3. Say: "Initialize a new LitRPG adventure using the system files"
4. Follow the character creation prompts
5. Begin your adventure!

## Philosophy

- **Numbers for impact**: HP, damage, and XP matter
- **Narrative for everything else**: Movement, time, and world interaction flow naturally
- **Claude as DM**: The AI handles storytelling while Python handles math
- **Living world**: NPCs have lives, time passes, consequences ripple

## Commands

- `STATUS` - View character sheet
- `INVENTORY` - Check items
- `JOURNAL` - Review recent events
- `REST` - Recover resources
- `SAVE POINT` - Create checkpoint

## Customization

Edit `system/world_settings.json` to adjust:
- Combat difficulty
- Narrative tone
- Magic level
- Technology level
- Content boundaries

## Contributing

Share your:
- Custom content (enemies, items, spells)
- Narrative templates
- Session archives (epic adventures)
- System improvements

## License

MIT - Share and modify freely
```

## Final Initialization Message to Claude Code

```markdown
Please execute the following setup sequence:

1. Create all directories as specified in the structure
2. Copy the three main artifacts into system/
3. Create all empty JSON databases with proper structure
4. Initialize session subdirectories
5. Create the quickstart.py script
6. Generate a test character to verify everything works
7. Delete the test and prepare for actual play

Once complete, ask me: "System initialized! Would you like to create a new 
character or would you prefer to customize the world settings first?"

The adventure framework is now ready for narrative-first LitRPG gameplay.
```
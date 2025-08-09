# 🎮 LitRPG Session Startup Instructions

## Quick Reference for Running This Story

### What to Read at Session Start

**Simple approach: Read everything!**

1. **session.json** - Single source of truth for ALL game state:
   - Character stats, inventory, motivations
   - World lore, current scene, plot threads
   - Character personalities and speech patterns
   - Faction standings, relationships

2. **All *.md guide files** in this folder:
   - DM_PHILOSOPHY.md - Core principles and game loops
   - CHARACTER_VOICE_GUIDE.md - Speech patterns
   - MECHANICS_GUIDE.md - Combat and enemy creation
   - SESSION_CONTINUITY.md - Consistency maintenance
   - This file (STARTUP_INSTRUCTIONS.md)

3. **Latest raw/*.md file** - Recent narrative for voice:
   - Skim for dialogue style
   - Combat choreography patterns
   - Pacing reference

## Quick Start Process

```python
# 1. Load the game state
state = Read("session.json")

# 2. Check where we left off
current_scene = state["story"]["currentScene"]
dm_notes = state["meta"]["dmNotes"]

# 3. Review character voices
kaya_speech = state["characters"]["major"]["Kaya"]["speech"]
garrett_speech = state["characters"]["major"]["Garrett"]["speech"]

# 4. Read recent narrative for style
narrative = Read("raw/session_002_ironhold_arrival.md")  # or latest

# 5. Begin from current scene!
```

## During Play

- **Edit session.json directly** when mechanics change
- **Use dice.py** for rolls (located at `adventure_litrpg/tools/dice.py`)
- **Use xp.py** for progression (located at `adventure_litrpg/tools/xp.py`)
- **Append full narrative** to new raw/session_XXX.md file

## Key Reminders

### Character Voices MUST Be Consistent
- ✅ Kaya: Spanish phrases (*guerrero*, *mijo*, *coño*)
- ✅ Garrett: Military curses ("Seven hells"), dry humor
- ✅ Steve: Physics references, coffee shop contrasts
- ✅ Tom: Young enthusiasm, hero worship

### Combat Style
- Visceral descriptions ("axe went THROUGH him")
- Physics-based solutions (momentum, leverage)
- Environmental integration
- Damage as narrative beats

### The Philosophy
**"Numbers for impact, narrative for everything else"**

You're telling a story, not running a spreadsheet. The tools exist to serve the narrative, not constrain it.

## File Structure Reference

```
story/speedrun_berserker/
├── session.json              # ALL game state (single source of truth)
├── STARTUP_INSTRUCTIONS.md   # This file
├── DM_PHILOSOPHY.md         # Core philosophy & game loops
├── CHARACTER_VOICE_GUIDE.md # Speech patterns
├── MECHANICS_GUIDE.md       # Combat, enemies, game systems
├── SESSION_CONTINUITY.md    # Consistency maintenance
└── raw/                     # Full narrative archive
    ├── session_001_coffee_to_carnage.md
    ├── session_002_ironhold_arrival.md
    └── session_003_the_vanishing_act.md

Shared tools at: adventure_litrpg/tools/
├── dice.py                  # Dice rolling
└── xp.py                    # XP calculations
```

## Current Status Summary

**Steve "The Immediate"**
- Level 4 Berserker
- HP: 167/180
- Location: Ashwood Trail (just left Ironhold with Garrett)
- Mission: Clear 3 crisis zones before confronting Scarred Wolves
- Gold: 371
- Notable: Has Phoenix Tears (auto-revive)

**Ready to continue the adventure!**

---

*Remember: Read the narrative in raw/ for voice, but keep the facts in session.json. When in doubt, check how it was said before, not just what happened.*
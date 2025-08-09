# 🎮 LitRPG Session Startup Instructions

## For Claude/AI Agent: READ THIS FIRST!

### Required Reading at Session Start (IN THIS ORDER)

1. **session.json** - Contains EVERYTHING:
   - Current character stats, inventory, equipment
   - Story state, plot threads, session history  
   - Character personalities with speech patterns
   - World state, flags, relationships

2. **DM_GUIDE.md** - Your philosophy and mechanics guide:
   - Core principles (narrative > numbers)
   - Game loops and mechanics
   - How to handle combat, checks, progression

3. **CHARACTER_VOICE_GUIDE.md** - How everyone speaks:
   - Speech patterns for each character
   - Verbal tics and quirks
   - Example dialogue

4. **ENEMY_HANDLING.md** - Creating enemies on the fly:
   - Quick stat guidelines by level
   - No need for monster manual
   - Track only what matters

5. **SESSION_CONTINUITY.md** - Maintaining consistency:
   - What lives where
   - How to preserve voice
   - Red flags to avoid

6. **Latest raw/*.md file** - Recent verbatim narrative:
   - Actual dialogue for voice calibration
   - Combat choreography style
   - Pacing and emotional beats

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
├── session.json              # ALL game state (READ FIRST!)
├── STARTUP_INSTRUCTIONS.md   # This file
├── DM_GUIDE.md              # Philosophy & mechanics
├── CHARACTER_VOICE_GUIDE.md # Speech patterns
├── SESSION_CONTINUITY.md    # Consistency guide
├── ENEMY_HANDLING.md        # Enemy creation guide
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
# Next Session Guide

> **Note**: This file contains ONLY narrative continuity. For mechanical stats (HP, MP, Stamina, XP, etc.), always check `session/state/game_state.json` via `python3 system/game_engine.py status`

## Quick Continuity Checklist
- [x] Read this file first for narrative context
- [ ] Load mechanical state with `python3 system/game_engine.py status`
- [ ] Check `session/narrative/current_scene.md` for exact position
- [ ] Review `session/narrative/threads.md` for active plots
- [ ] Check `session/world/npc_relationships.json` for NPC attitudes

## Last Session Summary
**Date**: Session 1 - The Speedrun Begins  
**Duration**: ~1 hour in-world, Level 1→4  
**Major Events**:
- Isekai'd from coffee shop to game world via "Convergence"
- Selected Berserker class, defeated Threshold Beast in record time
- Eliminated entire Howling Scars bandit gang with Garrett
- Achieved Level 4 in first hour (world record pace)

## Current Situation
**Location**: Ironhold City Gates, just arrived with caravan  
**Immediate Context**: Standing at gates covered in blood, guards nervous but impressed  
**Tension Point**: Need clothes urgently, bounties to collect, city to explore

## Character Status
**Narrative State**:
- Condition: Wounded but stable after intense battle
- Appearance: Clothes destroyed, covered in dried blood
- Notable: Just achieved Level 4 in record time (first hour)

**Notable Inventory Events**:
- Gained substantial gold and bandit ear trophies
- Lost original coffee shop clothes (destroyed in combat)
- Wielding the Greataxe of First Blood earned from Threshold Beast
- Wearing damaged leather armor from bandits

## Active Narrative Threads
### Main Quest
**Thread**: Establishing reputation in new world  
**Current Objective**: Get paid, equipped, and registered as adventurer  
**Next Step**: Visit Merchants' Guild for bounties

### Side Threads
1. **Scarred Wolves Raid**: Garrett organizing assault on 40+ bandits, wants Steve involved
2. **Kaya's Mystery**: Golden-eyed guide appears/disappears, recording Steve's exploits
3. **The Convergence**: Why was Steve pulled into this world?

### Unresolved Mysteries
- What is Kaya really? Why is she helping Steve specifically?
- Are there other isekai'd people like Steve?
- What caused the "Convergence" that brought him here?

## NPCs to Remember
### Recently Met
- **Garrett**: Level 4 ex-Captain - Friendly - Wants to raid Scarred Wolves together
- **Kaya**: Mysterious guide - Helpful/Amused - Has memory crystal of fights

### Expecting Return
- **Merchants' Guild**: Owes 330g+ in various bounties
- **Ironhold Guards**: Will spread word of Howling Scars elimination

### Active Antagonists
- **Scarred Wolves**: Main bandit force - Unaware their subsidiary gang is dead - 40+ members

## World State Changes
**Time Passed**: Morning to near-noon  
**Environmental**: Clear day, good road conditions  
**Political/Social**: Roads temporarily safer, bandit threat reduced  
**Consequences Pending**: Scarred Wolves will learn about Howling Scars elimination

## DM Notes for Next Session
### Prepared Encounters
- If player goes to Merchants' Guild: Big payday, reputation boost, job offers
- If player goes to equipment shop: Friendly merchant, berserker-appropriate gear available
- If player goes to inn first: Overhears rumors about their exploits already spreading

### Potential Complications
- Other adventurers jealous of rapid advancement
- Scarred Wolves might send assassins once they learn
- Noble might try to hire/control the "Immediate"

### Rewards Ready
- For bounty collection: 330g minimum plus reputation
- Hidden discovery at Adventurers' Hall: Special berserker trainer interested in Steve

## Opening Options for Next Session

### Option A: Continue Immediately
"The guard's eyes widen as he recognizes the Razorback tattoos on the ears you're carrying. 'By the gods... you're the one? The whole gatehouse is talking about it - someone said a Level 3 wiped out the Howling Scars!' Behind you, Garrett chuckles..."

### Option B: Short Time Skip
"You wake in the Drunken Griffin Inn, finally clean, bandaged, and in fresh clothes. The events of yesterday feel like a fever dream - except for the Level 4 tag floating above your head and the 500+ gold in your purse. Garrett knocks on your door..."

### Option C: Scene Transition
"The Merchants' Guild erupts in chaos as you dump nine pairs of tattooed ears on the marble counter. 'THAT'S the Howling Scars lieutenant!' someone shouts. The guild master himself emerges from his office..."

## Important Reminders
- **Tone**: Fast-paced, visceral combat, humor through culture shock
- **Player Preferences**: Physics-based creative combat, speedrun mentality
- **Avoid**: Slow grinding, excessive downtime
- **Emphasize**: Reputation building, Steve's coffee shop → berserker contrast

## Technical Notes (Updated Session 2)

### State Migration Complete
- **Character data migrated** to nested structure (v2 format)
- **Original equipment preserved** in `session_data` for manual conversion:
  - Weapon: "Greataxe of First Blood (1d12)" 
  - Armor: "Leather Armor (+2)"
  - Inventory items need item ID conversion when ready
- **Backups created**: `.pre_migration` files saved

### System Updates Applied
- Engine now uses `session/state/game_state.json` consistently
- Status effects fixed (DOT damage working with dice strings)
- Config system unified with proper deep merge
- All tools reading nested character structure correctly

### Commands to Verify State
```bash
# Check current status (Steve at Level 4, HP 108/180)
python3 system/game_engine.py status

# View all relationships
python3 system/adventure_tools.py status

# Check specific flags
python3 system/game_engine.py flag --get howling_scars_defeated
```

### Files to Update Next Session
- session_log.md - Continue narrative
- current_scene.md - Update location/context
- CHARACTER_SHEET.md - Reflect any changes

---

**For Claude**: 
1. State is now in nested format - use `state['character']['hp']` not `state['hp']`
2. Steve's equipment needs conversion from strings to item IDs when appropriate
3. Status effects properly apply DOT damage and combat modifiers
4. When resuming, provide a "Previously on..." recap, then continue from the Current Situation above
5. Steve is at Ironhold's gates with Garrett, ready to collect bounties and explore the city
6. Maintain the fast pacing and Steve's mix of coffee shop normalcy with berserker instincts
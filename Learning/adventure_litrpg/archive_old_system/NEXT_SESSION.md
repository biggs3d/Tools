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
**Location**: Ashwood Trail, 10 minutes outside Ironhold's East Gate  
**Immediate Context**: Successfully ghosted out of the city, riding Henrik's vegetable wagon toward Sunken Mills  
**Tension Point**: Four-hour journey to first combat zone, darkness falling, creatures will be active

## Character Status
**Narrative State**:
- Condition: Energized and ready after food and rest at the inn
- Appearance: New berserker outfit and dark leather coat from Marcus's shop
- Notable: Known as "Speedrun Berserker" thanks to Kaya's memory crystals

**Notable Inventory Events**:
- Sold bandit trophies to Lord Pemberton's son via Hedda (+350g)
- Purchased Phoenix Tears (auto-revive at 25% HP)
- Acquired Scarred Wolves territory map (tactical advantage)
- Carrying smoke pellets x3 for escape/ambush
- Current gold: 371g
- Still wielding Greataxe of First Blood

## Active Narrative Threads
### Main Quest
**Thread**: Strategic leveling before confronting Scarred Wolves  
**Current Objective**: Leave Ironhold quietly and begin Ashwood Trail  
**Next Step**: Meet Garrett at East Gate with Henrik's wagon in one hour

### Side Threads
1. **Ashwood Trail Campaign**: Three crisis zones to clear (Sunken Mills, Crow's Rest, Iron Mines)
2. **Kaya's Mystery**: Left message that "real game begins when you leave tutorial city"
3. **Tom's Hero Worship**: Young aspiring berserker, son of deceased guard, now Steve's biggest fan
4. **Cromwell's Interest**: Guild Master intrigued by Steve walking out mid-pitch

### Unresolved Mysteries
- What is Kaya really? Why is she helping Steve specifically?
- Are there other isekai'd people like Steve?
- What caused the "Convergence" that brought him here?

## NPCs to Remember
### Currently With
- **Garrett**: Level 4 ex-Captain - Allied - Hidden in wagon, ready for combat
- **Henrik**: Wagon driver - Nervous but well-paid - Providing transport to Sunken Mills

### Recently Met
- **Hedda Grimstone**: Sharp-eyed rarity dealer - Professional/Impressed - Sold Phoenix Tears and tactical gear
- **Lord Pemberton Jr.**: Noble's son - Starstruck - Bought bandit trophies for 350g
- **Kaya**: Mysterious guide - Cryptic/Amused - Spreading Steve's reputation via memory crystals
- **Tom**: 13-year-old aspiring berserker - Hero worship - Has Steve's note and promise
- **Sara**: Drunken Griffin owner - Protective/Discrete - Provided cover story
- **Marcus**: Clothier - Professional/Friendly - Supplied berserker outfit
- **Cromwell**: Merchants' Guild Master - Intrigued/Calculating - Wants Steve under contract

### Expecting Return
- **Viktor 'The Red Wolf'**: Level 7 bandit leader - Will hear about Howling Scars by nightfall
- **Tom**: Expecting to see Steve again (has promise and note)
- **Cromwell**: Likely investigating Steve's background and movements

### Active Antagonists
- **Scarred Wolves**: Main bandit force - Unaware their subsidiary gang is dead - 40+ members

## World State Changes
**Time Passed**: Morning to late afternoon  
**Environmental**: Clear day, shadows lengthening, perfect for discrete departure  
**Political/Social**: Entire city buzzing about "Speedrun Berserker"  
**Consequences Pending**: Scarred Wolves learning about Howling Scars, Viktor planning response

## DM Notes for Next Session
### Prepared Encounters
- **Sunken Mills**: Flooded ruins, creatures Level 3-5 dragging travelers off road
- **Crow's Rest**: Giant ravens Level 4-6, terrorizing grain shipments, 200g bounty
- **Iron Mines**: Something awakened in deep tunnels, leads to mountain approach on Howling Ridge
- **Random Road Encounter**: Possible Scarred Wolves scouts or assassins if they mobilize quickly

### Potential Complications
- Other adventurers jealous of rapid advancement
- Scarred Wolves might send assassins once they learn
- Noble might try to hire/control the "Immediate"

### Rewards Ready
- Crow's Rest village: 200g for clearing giant ravens
- Strategic advantage: Mountain approach to Howling Ridge unexpected by bandits
- Level progression: Potential to reach Level 6-7 through intense combat
- Psychological warfare: Building fear in Scarred Wolves through destruction trail

## Opening Options for Next Session

### Option A: Ambush on the Road
"Two hours into the journey, Henrik suddenly reins in the horses. 'Roadblock ahead.' Three trees lie across the path—too convenient to be natural. Garrett's already rolling out of the wagon, warhammer ready. 'Scarred Wolves scouts, maybe? Or just opportunists?' The forest is too quiet..."

### Option B: Sunken Mills Approach
"The smell hits first—rot and stagnant water. Through the wagon's slats, you see the Sunken Mills in the dying light. Half the village is underwater, rooftops poking through like grave markers. Henrik stops well back. 'This is as far as I go.' Something large disturbs the water's surface, sending ripples toward shore..."

### Option C: Strategic Planning Session
"Garrett spreads your new map across the wagon bed, using a hooded lantern for light. 'Alright, with this intel we can hit their supply caches after clearing the Mills. But look here—' he points to a mark near the mines. 'Secondary entrance to their fort. We clear all three crisis points, we'll have a back door to Viktor himself...'"

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
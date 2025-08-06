# Next Session Guide

## Quick Continuity Checklist
- [ ] Read this file first for context
- [ ] Check `session/narrative/current_scene.md` for exact position
- [ ] Review `session/narrative/threads.md` for active plots
- [ ] Load character state with `python3 system/game_engine.py status`
- [ ] Check `session/world/relationships.json` for NPC attitudes

## Last Session Summary
**Date**: [Session date]  
**Duration**: [How long played]  
**Major Events**:
- [Key event 1]
- [Key event 2]
- [Key event 3]

## Current Situation
**Location**: [Where the character is]  
**Immediate Context**: [What just happened]  
**Tension Point**: [Current danger/decision/mystery]

## Character Status
**Mechanical State**:
- HP: [current]/[max]
- MP: [current]/[max]  
- Stamina: [current]/[max]
- Notable conditions: [poisoned/blessed/exhausted/etc.]

**Inventory Changes**:
- Gained: [New items]
- Lost: [Used/lost items]
- Key items: [Important possessions]

## Active Narrative Threads
### Main Quest
**Thread**: [Primary storyline]  
**Current Objective**: [What player is trying to do]  
**Next Step**: [Immediate goal]

### Side Threads
1. **[Thread Name]**: [Status and next development]
2. **[Thread Name]**: [Status and next development]

### Unresolved Mysteries
- [Question 1 that needs answering]
- [Question 2 that needs answering]

## NPCs to Remember
### Recently Met
- **[Name]**: [Role] - [Disposition] - [What they want]

### Expecting Return
- **[Name]**: [Why they're waiting] - [What happens if player doesn't return]

### Active Antagonists
- **[Name/Group]**: [Their current plan] - [Next move]

## World State Changes
**Time Passed**: [How much time in-world]  
**Environmental**: [Weather, season, time of day]  
**Political/Social**: [Town events, faction movements]  
**Consequences Pending**: [Results of player actions still rippling]

## DM Notes for Next Session
### Prepared Encounters
- If player goes to [Location]: [What happens]
- If player pursues [Thread]: [Development ready]

### Potential Complications
- [Thing that could go wrong]
- [Twist that could emerge]

### Rewards Ready
- For completing [Task]: [Reward]
- Hidden discovery at [Location]: [Secret]

## Opening Options for Next Session

### Option A: Continue Immediately
"[Opening line that drops player right back into the action...]"

### Option B: Short Time Skip
"[Opening that advances time slightly, like waking up the next morning...]"

### Option C: Scene Transition
"[Opening that moves to a new location or situation based on last choice...]"

## Important Reminders
- **Tone**: [Maintain this narrative tone]
- **Player Preferences**: [What they've expressed enjoying]
- **Avoid**: [Things player hasn't enjoyed]
- **Emphasize**: [Elements player has engaged with]

## Technical Notes
- Last checkpoint: [When saved]
- Files to update: [Which tracking files need attention]
- Flags to check: `python3 system/game_engine.py flag --get "[flag_name]"`

---

**For Claude**: When resuming, provide a "Previously on..." recap, then continue from the Current Situation above. Maintain all narrative threads and honor the world state changes. The player should feel like no time has passed for them, even if time has passed in the world.
# Session Continuity Guide

## How to Start a New Session

### 1. Context is Auto-Loaded
The start_session.sh script loads everything. Focus on the narrative flow.

### 2. Voice Calibration
Before starting, refresh character voices by reading their `speech` entries in session.json:
- **Pattern**: How they structure sentences
- **Quirks**: Unique phrases, curses, expressions  
- **Examples**: Actual dialogue to model from

### 3. Narrative Continuity
The `raw/` folder contains **verbatim narrative** - this preserves:
- Exact phrasing and word choices
- Emotional beats and pacing
- Character relationship dynamics
- Environmental descriptions
- Combat choreography style

## What Lives Where

### session.json
**Purpose**: Facts and mechanics
- Numbers (HP, gold, XP)
- Current state (location, equipment)
- Character traits and speech patterns
- Plot threads (active/resolved)
- Succinct session summaries

### raw/ folder  
**Purpose**: Full narrative for book/continuity
- Complete dialogue exchanges
- Detailed action sequences
- Environmental descriptions
- Internal monologues
- Emotional nuance

### Guide Files (*.md)
**Purpose**: DM guidance
- DM_PHILOSOPHY.md - Core philosophy and game loops
- CHARACTER_VOICE_GUIDE.md - Speech patterns
- MECHANICS_GUIDE.md - Combat and system rules
- This file - Consistency maintenance

## Maintaining Consistency

### For Established Characters
1. Check their `speech` entry in session.json
2. Review their recent dialogue in raw files
3. Note relationship changes (disposition shifts)
4. Keep verbal tics consistent

### For Steve (The Player Character)
- **Coffee Shop Steve**: Internal analytical voice ("This shouldn't work but...")
- **Berserker Steve**: External confident actions (less talk, more do)
- **Physics + Fury**: Unique combat solutions using momentum/leverage
- **Speedrun Mentality**: Always pushing limits, checking records

### For New Characters
1. Establish their social class/education
2. Give them 1-2 verbal quirks
3. Add them to session.json with speech patterns
4. Keep first impression consistent

## Combat Narration Style

Based on raw narrative, maintain:
- **Visceral descriptions**: "The axe went THROUGH him"
- **Physics-based combat**: Momentum, angles, leverage
- **Time dilation**: Slow-mo for critical moments
- **Environmental integration**: Using terrain/objects
- **Damage as narrative beats**: Not just numbers

## Common Phrases to Preserve

### Kaya's Spanish
- *guerrero* - warrior (for Steve)
- *mijo* - my son (affectionate)
- *coño* - mild curse
- *¡Qué bárbaro!* - amazement

### Garrett's Military
- "Seven hells" - signature curse
- Combat assessments mid-fight
- Dry observations about carnage

### Steve's Modern References
- Coffee shop comparisons
- Physics explanations
- Modern sports/activity analogies

## CRITICAL: Live Session Management

### During EVERY Scene/Action Loop
**UPDATE session.json IMMEDIATELY when:**
- HP changes (damage taken/healed)
- Items gained/lost (loot, destroyed equipment)
- Gold changes (spending, rewards)
- XP gained (combat, quest completion)
- Equipment changes (armor destroyed, weapons acquired)
- Rage meter changes
- Location changes
- Time progression
- NPC disposition shifts
- Plot threads advance

**Example**: Steve's shirt was destroyed, gained Miller's Crystal, Garrett took the journal - these should be updated RIGHT AFTER they happen, not at session end!

### Save to raw/ CONTINUOUSLY
**After EVERY major scene:**
- Append the FULL NARRATIVE to the current session file
- Include ALL dialogue EXACTLY as spoken
- Include ALL action descriptions and combat choreography
- NEVER summarize - write it like you're writing a novel
- Include internal thoughts, reactions, expressions
- **THIS IS THE ONLY RECORD** - when session closes, memory is gone!

## Session Ending Protocol

### 1. Final session.json check
- Verify all inventory changes tracked
- Confirm current HP/stats accurate
- Update currentScene with cliffhanger
- Add to sessionHistory (1-2 sentences)
- Double-check equipment status (what's destroyed?)

### 2. Complete raw/ narrative
- Ensure ENTIRE session is saved
- Verify dialogue is verbatim
- Check combat scenes are fully detailed
- Confirm character moments preserved

### 3. Update Voice Notes
- Add any new speech patterns discovered
- Note character relationship evolution
- Flag any personality shifts

## Red Flags for Consistency

Watch out for:
- ❌ Kaya without Spanish phrases
- ❌ Garrett being too emotional/flowery  
- ❌ Steve overthinking in combat (he acts on instinct now)
- ❌ Tom speaking like an adult
- ❌ Generic NPC dialogue without class markers
- ❌ **REPEATING RANDOM ENCOUNTERS** (save bandits for the stronghold climax!)
- ❌ **RECYCLING SIMILAR SCENES** (vary threats between destinations)

## Quick Continuity Test

Before each major scene, ask:
1. Would Kaya say it with a Spanish word?
2. Would Garrett add a dry observation?
3. Would Steve compare it to coffee shop life?
4. Does this match their last emotional state?
5. Are relationship dynamics consistent?

Remember: The raw files are your **primary source** for voice and style. The summaries in session.json are just facts. When in doubt, check how it was said before, not just what happened.
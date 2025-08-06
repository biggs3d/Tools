# Session Zero - LitRPG Adventure Initialization

## First Message to Claude Code

```markdown
I want to start a narrative-first LitRPG adventure using the game engine and DM 
instructions in this repository. 

Please:
1. Review all files in the `/system` folder to understand the game framework
2. Initialize the session folder structure as specified in TODO.md
3. Ask me for my character concept (name, class preference, background concept)
4. Generate an opening scene that drops me into immediate intrigue
5. Track all numbers through the Python engine but focus on cinematic narrative

This should feel like living in a LitRPG novel - visceral, immersive, with numbers 
that matter but don't constrain the story.

Let's begin!
```

## Character Creation Dialog

### Claude's Response Template:
```markdown
I've reviewed the game system and I'm ready to be your narrator for this LitRPG 
adventure. Before we begin your story, let's establish who you are in this world.

## Character Creation

**Available Classes:**
- **Warrior**: High HP, physical prowess, weapon mastery
- **Rogue**: Stealth, agility, precision strikes, cunning
- **Mage**: Arcane power, low HP, reality-bending potential
- **Ranger**: Survival, tracking, ranged combat, nature affinity
- **Paladin**: Holy warrior, healing, defensive abilities
- **Warlock**: Dark pacts, forbidden magic, high risk/reward

**Quick Start Options:**
1. "I'm [Name], a [Class]" - Jump straight into action
2. Provide a background concept - I'll weave it into your introduction
3. Answer a few questions to discover your character naturally

**Or describe any custom concept** - this world is flexible enough to accommodate 
unique ideas that fit the setting.

What calls to you?
```

### Player Provides Concept:
```markdown
"I'm Marcus, a former war mage who lost his powers in a magical catastrophe. 
Starting as a warrior but hoping to rediscover magic eventually."
```

### Claude's Initialization:
```markdown
Excellent concept! Let me initialize Marcus and drop you into the world...

[Creating character: Marcus, Level 1 Warrior with magical background]
[Initializing game state...]
[Generating opening scene based on your background...]

---

## Chapter 1: Ashes of Power

*The morning rain tastes of iron and regret.*

*You stand at the edge of the Ashfall Crater - that perfect circle of devastation 
where the Imperial Academy of War Magic once stood. Three years ago, you were 
Senior Battlemage Marcus Valorian, pride of the seventh legion. Then came the 
Resonance Cascade. The explosion that turned two hundred mages into glass statues 
and ripped the magic from your soul.*

*Your fingers flex around the sword hilt - still foreign after three years. Where 
once lightning danced between your fingers, now there's only calluses and scars.*

**[Character Initialized]**
**Marcus - Level 1 Warrior (Fallen Mage)**
**HP: 120/120 | MP: 30/30 | Stamina: 100/100**
**Gold: 50**

*You're not here for nostalgia. The merchant's letter was specific: "The Ashfall 
Crater has begun to glow at night. Purple light, like the old wards. Something's 
awakening in the ruins. Find out what. 500 gold if you survive."*

*As you descend the crater's slope, your boots crunch on the glass that used to 
be earth. Then you see it - a figure in academy robes standing perfectly still in 
the rain. Another glass statue... except this one just turned its head to look at you.*

*"Marcus," it says, voice like wind through broken bells. "You came back. Good. 
The Resonance isn't finished with you."*

*The glass mage raises a hand, and purple fire begins to gather...*

**[Combat Imminent - Corrupted Glass Mage]**

> What do you do?
```

## Session Management Commands

### For Claude to track during play:

```markdown
## Behind the Scenes Tracking

After each significant scene, I'll update:
- session/current_scene.md - Where we are now
- session/relationships.json - NPCs met and their dispositions  
- session/timeline.md - Major events in chronological order
- session/threads.md - Ongoing plot threads and mysteries
- session/knowledge.md - Lore and clues discovered

I'll naturally weave in:
- Previous choices affecting current situations
- NPCs remembering past interactions
- Reputation effects from your actions
- Environmental changes from prior events
- Foreshadowing based on active threads
```

## Quick Commands for Players

```markdown
## Anytime Commands You Can Use:

"STATUS" - Full character sheet and current conditions
"INVENTORY" - Detailed inventory and equipment
"JOURNAL" - Summary of recent events and active quests  
"RELATIONSHIPS" - NPC attitudes and faction standings
"REST" - Short rest (quick recovery) or long rest (full recovery)
"LEVEL UP" - When available, choose how to grow

## Meta Commands:

"TONE SHIFT" - Request different narrative tone (darker/lighter/etc)
"FOCUS" - Specify what aspect interests you (combat/social/exploration)
"RECAP" - Get reminded of recent events before continuing
"SAVE POINT" - Create a detailed checkpoint of current situation
```

## Opening Variations by Class

### Rogue Opening:
```markdown
*The guard's coin purse was supposed to be easy pickings. You didn't expect it 
to contain a glass eye that LOOKED BACK AT YOU. Now you're running through the 
midnight streets with something impossible in your pocket and bootfalls echoing 
behind you that sound like... breaking glass?*
```

### Mage Opening:
```markdown
*The acceptance letter to the New Academy burst into flames the moment you 
touched it - but the words rearranged in the smoke: "The old power stirs. Come 
to the Crater. Come alone. Come now." Your professor said to ignore it. You're 
already halfway there.*
```

### Paladin Opening:
```markdown
*Your holy symbol hasn't stopped burning for three days. Not with fire - with 
cold so intense it numbs your chest through the armor. The temple says it's 
impossible. The crater three miles away pulsing with unholy light suggests 
otherwise.*
```

## Environmental Details to Track

### Each Location Should Have:
```markdown
Location: [Name]
First Visited: [Session date/time]
Current State: [How it's changed]
Notable Features: [What can be interacted with]
Hidden Elements: [Discovered/Undiscovered]
Connected Areas: [Where you can go from here]
Active NPCs: [Who's here now]
Time-Sensitive Elements: [What changes with time]
```

## Combat Narration Guidelines

### Damage Thresholds:
- **1-10 damage**: "Glancing blow" / "Light wound"
- **11-25 damage**: "Solid hit" / "Bleeding wound"
- **26-50 damage**: "Devastating strike" / "Grievous injury"
- **51+ damage**: "Overwhelming force" / "Near-lethal blow"

### Health Status Descriptions:
- **100% HP**: Fresh, ready, untouched
- **75-99% HP**: Minor scrapes, breathing steady
- **50-74% HP**: Bloodied, bruised, feeling it
- **25-49% HP**: Badly wounded, vision blurring
- **1-24% HP**: Barely standing, death's door
- **0 HP**: Unconscious/dying (death saves or narrative rescue)

## Loot and Rewards Philosophy

### Meaningful Loot:
Every item found should have:
- **History**: Who owned it? Why is it here?
- **Utility**: Clear use or sellable value
- **Mystery**: Hidden properties to discover?
- **Choice**: Keep, sell, or gift to NPCs?

Example:
```markdown
*The glass mage shatters into a thousand singing fragments. Among the remains, 
you find:*

**[Academy Signet Ring]** - *Cracked but humming with residual power. The 
inscription reads "M. Thorne - Resonance Studies." Your old colleague.*

**[Vial of Liquid Glass]** - *Moves like mercury but feels warm. Definitely 
magical, possibly valuable, certainly dangerous.*

**[Page 47 of a Journal]** - *"...the Resonance wasn't an accident. They NEEDED 
us to fail. The crater isn't a wound, it's a door, and we were the key..."*

**[Gold: 12]** - *Even glass mages carried coin, apparently*
```

## Session Pacing

### Natural Rhythm:
1. **Hook** - Immediate intrigue or danger
2. **Investigation** - Exploring, learning, preparing
3. **Escalation** - Stakes rise, complications emerge
4. **Confrontation** - Combat, social conflict, or puzzle
5. **Revelation** - New information changes understanding
6. **Choice** - Player decision shapes what comes next
7. **Consequence** - Immediate results, new threads opened

### Session Length Management:
- **Quick Session (30 min)**: One complete scene/encounter
- **Standard Session (1-2 hours)**: 2-3 connected scenes
- **Long Session (2+ hours)**: Complete story arc with downtime
- **Break Points**: Always end with a choice or revelation

## World Consistency Rules

### Always Remember:
- NPCs have lives outside player interaction
- Time passes when player isn't somewhere
- Actions have ripple effects
- Weather continues, seasons change
- Other adventurers exist and act
- Villains advance their plans
- The world is indifferent to "main character" status

### Living World Examples:
```markdown
"You return to Riverside after a week in the ruins. The town is different - 
bunting hangs from windows, and people wear yellow ribbons. Maya runs up to 
you: 'You missed it! Thomas manifested his power - he saved a child from the 
river! The town's throwing a festival. Also, those cultists you mentioned? 
Three more children have gone missing from Eastbrook...'"
```
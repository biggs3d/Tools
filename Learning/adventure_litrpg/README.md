# LitRPG Adventure System 🎲⚔️

A simplified, narrative-first LitRPG framework for Claude Code. One JSON file, endless adventures.

## Quick Start

```bash
# Tell Claude to start your adventure
"Let's play the speedrun berserker story!"

# Or create a new adventure
"Start a new LitRPG adventure. I want to be a [character concept]"
```

## What Is This?

A radically simplified RPG system where Claude is your Dungeon Master.
We threw out 789 lines of complex procedures for one simple principle:

**"Numbers for impact, narrative for everything else."**

- **One file tracks everything** - session.json contains all state
- **Direct editing** - Claude edits files directly, no complex commands
- **Pure storytelling** - Create enemies, items, and NPCs on the fly
- **Minimal automation** - Just dice rolling and XP math

Think "living inside a Cradle novel" not "spreadsheet simulator."

## Structure

```
adventure_litrpg/
├── story/                    # Your adventures
│   └── speedrun_berserker/   # Active story
│       ├── session.json      # ALL game state (edit directly)
│       ├── DM_GUIDE.md       # Philosophy & mechanics
│       ├── STARTUP_INSTRUCTIONS.md  # Session checklist
│       └── raw/              # Verbatim narratives for book editing
├── tools/                    # Shared utilities
│   ├── dice.py              # Dice rolling
│   └── xp.py                # Level calculations
└── CLAUDE.md                # Instructions for Claude
```

## The Speedrun Berserker Story

Currently playing: **Steve "The Immediate"** - a coffee shop normie turned physics-exploiting rage machine.

- Level 4 Berserker
- Left Ironhold with Garrett, hunting Scarred Wolves
- Three crisis zones await

## Creating New Stories

1. Copy `story/speedrun_berserker/` as template
2. Clear the `raw/` folder
3. Reset `session.json` with new character
4. Customize the guides
5. Start playing!

## Core Philosophy

### What We Keep

- Health points for real danger
- Damage rolls for combat impact
- XP/levels for progression feel
- Inventory that matters

### What We Dropped

- Complex command systems
- Rigid turn structures
- Preset content libraries
- Movement/time tracking
- 30+ specialized tools

### What We Gained

- Creative freedom
- Faster gameplay
- Better narrative flow
- Character voice consistency
- Direct file editing

## How It Works

1. **Claude reads** session.json to know current state
2. **You describe** what you want to do
3. **Claude narrates** cinematically
4. **Numbers update** directly in JSON when needed
5. **Story continues** with consequences

## Example Play

> *The drowned villagers rise from the murky water, flesh bloated and gray. One still clutches a child's doll.*

**You**: "I'll use my momentum to slam through them with my axe!"

> *You explode forward, axe leading. Physics meets fury as you CLEAVE through the first one - the blade doesn't stop at
flesh, it goes THROUGH. The body splits, top half splashing back into the water.*
>
> *[Damage: 47! Drowned Villager destroyed]*
>
> *But there are two more, and they're reaching for you with waterlogged hands...*

## Key Features

- **Single source of truth** - One JSON file per story
- **Character voices** - Speech patterns saved with NPCs
- **Narrative archive** - Full sessions saved to raw/ for book editing
- **Physics-based combat** - Creative solutions always work
- **Living world** - NPCs have lives beyond you

## Tips

✅ **DO:**

- Let Claude edit files directly
- Focus on story over mechanics
- Try creative physics-based solutions
- Save memorable quotes in character entries

❌ **DON'T:**

- Worry about "optimal" builds
- Get bogged down in rules
- Forget this is collaborative storytelling

## Philosophy

Every response should feel like living inside your favorite LitRPG novel. Make it visceral. Make it memorable. Make them
feel like a legend.

---

*"Numbers for impact, narrative for everything else."* ¡Dale candela! 🔥
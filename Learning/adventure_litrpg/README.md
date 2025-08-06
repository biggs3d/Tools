# LitRPG Adventure System 🎲⚔️

A narrative-first LitRPG framework for Claude Code that balances compelling storytelling with meaningful progression mechanics. Live your own progression fantasy adventure!

## Quick Start

```bash
# Option 1: Interactive setup
python3 quickstart.py

# Option 2: Direct to Claude
"Start a new LitRPG adventure. I want to be a [character concept]"
```

## What Is This?

This system lets you play immersive, narrative-driven RPG adventures with Claude as your Dungeon Master. Unlike traditional tabletop systems:

- **Story drives everything** - No rigid movement or action rules
- **Numbers that matter** - HP, damage, and XP create real tension
- **Living world** - NPCs have lives, time passes, consequences ripple
- **Your choices shape the narrative** - No predetermined path
- **Cinematic combat** - Visceral descriptions, not just dice rolls

Think less "D&D with strict rules" and more "living inside a Cradle or Dungeon Crawler Carl novel."

## Core Philosophy

- **Numbers for Impact**: Python handles HP, damage, XP, skill checks
- **Narrative for Everything Else**: Movement, time, and interactions flow naturally
- **Creative Freedom First**: Every adventure can be unique
- **Collaborative Storytelling**: Claude enhances your ideas, doesn't restrict them

## Project Structure

```
adventure_litrpg/
├── system/                 # Core game files (don't modify during play)
│   ├── game_engine.py     # Handles all numerical calculations
│   ├── dm_instructions.md # Narrative guidelines for Claude
│   ├── session_zero.md    # Character creation guide
│   └── first_session_guide.md # Example play flows
├── content/               # Optional reference content
│   ├── adventure_starts.json # Opening scenarios
│   ├── bestiary.json     # Enemy templates
│   ├── items.json        # Equipment examples
│   └── spells.json       # Magic templates
├── session/              # Your active game (git-ignored)
│   ├── state/           # Character stats and flags
│   ├── narrative/       # Story tracking
│   ├── world/          # NPC relationships and world state
│   └── meta/           # Player preferences
├── quickstart.py        # Interactive session starter
├── CLAUDE.md           # Instructions for Claude Code
└── QUICK_REFERENCE.md  # Player command reference
```

## Player Commands

During your adventure, you can say:

- **STATUS** - View your character sheet
- **INVENTORY** - Check your items  
- **JOURNAL** - Review recent events
- **REST** - Recover resources
- **SAVE POINT** - Create a checkpoint

## How It Works

1. **You describe** what you want to do
2. **Claude narrates** the world's response cinematically
3. **Python calculates** any numerical outcomes (damage, healing, XP)
4. **The story continues** based on consequences

## Features

### Narrative First
- Rich, immersive descriptions
- NPCs with personalities and motivations
- Environmental storytelling
- Meaningful choices with consequences

### Progression That Matters
- Level up and grow stronger
- Earn new abilities
- Find powerful items
- Build reputation and relationships

### Living World
- Time passes when you're away
- NPCs have their own lives
- Your actions ripple outward
- The world exists beyond you

### Flexible System
- Create any character concept
- Adapt to any fantasy setting
- Support for various play styles
- No "wrong" way to play

## Example Opening

> *The autumn rain pounds against the tavern windows as you nurse your third ale. The Rusty Tankard isn't much, but it's dry. Your fingers unconsciously check your daggers - old habits from the thieves' guild you'd rather forget.*
>
> *Before you can order another drink, the tavern door SLAMS open. A young woman stumbles in, blood seeping through her fingers pressed against her side. "Please," she gasps, "they took my brother to the old mine. The cultists... they're going to..."*
>
> *She collapses.*
>
> **[HP: 80/80 | MP: 50/50 | Stamina: 120/120]**
>
> What do you do?

## Tips for Best Experience

✅ **DO:**
- Describe your intentions clearly
- Try creative solutions
- Interact with NPCs as real people
- Tell Claude your preferences
- Embrace both success and failure

❌ **DON'T:**
- Worry about "optimal" choices
- Try to break the system
- Rush through scenes
- Forget this is collaborative

## Customization

The `content/` directory contains starter templates, but Claude can:
- Create unique enemies on the fly
- Invent new items and spells
- Design original scenarios
- Adapt to any character concept

## Session Management

- **Starting**: Use `quickstart.py` or ask Claude directly
- **Continuing**: Sessions auto-save, just ask to continue
- **Checkpoints**: Create save points for important moments
- **Archives**: Completed adventures are preserved

## Requirements

- Python 3.6+ (for the game engine)
- Claude Code (for the DM/narrator)
- Imagination and a sense of adventure!

## Contributing

Feel free to:
- Share your adventure logs
- Contribute new content templates
- Suggest system improvements
- Create themed expansion packs

## Philosophy

Every session should feel like you're living inside your favorite LitRPG novel. The numbers create tension and progression, but the story is what you'll remember.

## License

MIT - Share, modify, and adventure freely!

---

*"May your adventures be epic, your loot be legendary, and your stories worth telling!"* 🗡️✨
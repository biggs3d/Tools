# LitRPG Adventure - Quick Reference Card

## 🎮 Starting Your Adventure

### Fresh Start
```bash
python3 quickstart.py
# OR tell Claude:
"Start a new LitRPG adventure. I want to be [character concept]"
```

### Continue Adventure
```bash
"Continue my LitRPG adventure from where we left off"
```

## ⚔️ During Play Commands

### Player Commands (say these anytime)
- **STATUS** - See your character sheet
- **INVENTORY** - Check your items
- **JOURNAL** - Review recent events
- **REST** - Short rest (partial recovery) or long rest (full recovery)
- **SAVE POINT** - Create a checkpoint

### Meta Commands
- **TONE SHIFT** - "Make this darker/lighter/more serious/more fun"
- **FOCUS** - "I want more combat/social/exploration/mystery"
- **RECAP** - "What happened last session?"
- **HELP** - "What can I do here?"

## 🎯 Common Actions Examples

### Combat
- "I attack with my sword"
- "I cast firebolt at the goblin"
- "I try to disarm them"
- "I look for environmental advantages"

### Exploration
- "I search the room carefully"
- "I examine the strange marking"
- "I listen at the door"
- "I check for traps"

### Social
- "I try to persuade them"
- "I intimidate the guard"
- "I haggle with the merchant"
- "I seduce the bartender for information"

### Creative
- "I want to try [creative solution]"
- "Can I combine these items?"
- "I attempt to [unconventional action]"

## 📊 Understanding the Numbers

### Health Status
- **75-100%**: You're fine, maybe some scratches
- **50-74%**: Bloodied, clearly in a fight
- **25-49%**: Badly hurt, need healing soon
- **1-24%**: Critical, near death

### Difficulty Checks (DC)
- **DC 10**: Easy - most people could do this
- **DC 15**: Moderate - requires skill or luck
- **DC 20**: Hard - impressive if you succeed
- **DC 25**: Very Hard - legendary achievement

### Damage Scale
- **1d4**: Light (dagger, small creature)
- **1d6**: Medium (sword, arrow)
- **1d8**: Heavy (longsword, spell)
- **2d6+**: Devastating (great weapons, powerful magic)

## 🎲 Behind the Scenes (What Claude Does)

### Automatic Tracking
- HP, MP, Stamina changes
- XP and level progression
- Gold and inventory
- Story flags and quest states
- NPC relationships
- World state changes

### Dice Rolls (Hidden but Fair)
- **Attack rolls**: d20 + modifiers vs difficulty
- **Damage rolls**: Weapon dice + bonuses
- **Skill checks**: d20 + attribute modifier vs DC
- **Critical hits**: Natural 20 = double damage
- **Critical fails**: Natural 1 = always fails

## 💡 Tips for Best Experience

### DO:
✅ Describe what you want to try  
✅ Ask questions about the world  
✅ Interact with NPCs as real people  
✅ Try creative solutions  
✅ Tell Claude your preferences  

### DON'T:
❌ Worry about "correct" actions  
❌ Try to break the system  
❌ Argue about dice rolls  
❌ Rush through scenes  
❌ Forget this is collaborative storytelling  

## 🔧 Troubleshooting

### "I'm lost in the story"
Say: "RECAP" or "Where am I and what's happening?"

### "Combat is too hard/easy"
Say: "Adjust difficulty" or "Make combat more/less challenging"

### "I don't like where this is going"
Say: "Let's refocus on [what you want]" or "Can we try a different approach?"

### "I made a mistake"
Say: "Can we rewind that last action?" (Claude is flexible!)

### "Session crashed/lost"
Check `archives/` folder for checkpoints
Or say: "Let's reconstruct from what we remember"

## 🎭 Remember: You're the Hero

This is YOUR story. Claude is here to make it epic, not to "win" against you. Every failure teaches something, every success was earned, and every choice matters.

**Most importantly**: Have fun! This is about living your own progression fantasy adventure! 🗡️✨
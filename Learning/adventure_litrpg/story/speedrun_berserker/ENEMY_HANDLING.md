# Enemy & Combat Handling Guide

## Core Philosophy
**Create enemies on the fly. Stats serve the story, not vice versa.**

## Where Enemies Live

### During Combat (Temporary)
Just track in your working memory or scratch notes:
```
Drowned Villager #1: HP 15/24
Drowned Villager #2: HP 8/30 (wounded)
Tentacle Beast: HP 45/45
```

### After Combat (If Recurring)
Add significant enemies to session.json under characters/minor:
```json
"drowned_captain": {
  "disposition": -100,
  "tags": ["Undead", "Boss", "Sunken Mills"],
  "note": "Former harbor master, wields anchor, will return if not burned"
}
```

## Enemy Creation Guidelines

### Quick Stats by Threat Level

**Fodder** (Level 1-2)
- HP: 1d6 to 2d6 (5-15 HP)
- Damage: 1d4
- Meant to die in one hit

**Standard** (Level 3-4) 
- HP: 3d8 to 4d8 (15-35 HP)
- Damage: 1d6 to 1d8
- Should take 2-3 hits

**Elite** (Level 5-6)
- HP: 5d10 to 6d10 (30-60 HP)  
- Damage: 2d6 to 2d8
- Genuine threat, 4-5 hits

**Boss** (Level 7+)
- HP: Whatever creates tension (80-150+)
- Damage: Can seriously hurt Steve
- Should feel like an achievement

### Scaling Formula for Steve's Current Level (4)

For appropriate challenge:
- **Easy**: Enemy Level = Steve Level - 1 (Level 3)
- **Standard**: Enemy Level = Steve Level (Level 4)
- **Hard**: Enemy Level = Steve Level + 1 (Level 5)
- **Deadly**: Enemy Level = Steve Level + 2+ (Level 6+)

## Sunken Mills Specific Enemies

Since Steve is heading there, here are thematic options:

### Created On-the-Fly Examples

**Drowned Villager**
- HP: 3d6+6 (16-24 HP)
- Damage: 1d6+2 (grabbing/drowning attacks)
- Special: Doesn't feel pain, keeps fighting at 0 HP for 1 round
- Weakness: Fire, head destruction

**Water Wraith** 
- HP: 4d8 (18-32 HP)
- Damage: 1d8 (chill touch)
- Special: Partially incorporeal, normal weapons do half damage
- Weakness: Magic, blessed weapons

**The Drowned Harbor Master** (Boss)
- HP: 8d10+20 (60-100 HP)
- Damage: 2d8+4 (massive anchor)
- Special: Summons drowned villagers, water control
- Personality: Still thinks he's protecting the town

## Combat Flow

1. **Describe enemy viscerally** (not just "3 zombies appear")
2. **Roll HP on the spot** using dice.py if needed
3. **Track damage narratively** ("bloodied", "staggering", "near death")
4. **Don't show exact HP** to player unless it adds drama
5. **Let physics work** - Steve's momentum tricks should matter

## Example Combat Creation

```python
# You think: "Steve enters flooded ruins, what attacks?"
# Create on the spot:

"From the murky water, three shapes rise. Once they were villagers - 
you can still see the waterlogged remains of a merchant's vest on one, 
a child's doll clutched in another's grip. Now they're something else. 
Flesh bloated and gray, eyes milky white, moving with jerky purpose."

# Roll secretly:
Merchant: 3d6+6 = 19 HP
Mother: 3d6+6 = 16 HP  
Fisherman: 3d6+6 = 22 HP

# Track simply during combat, no need to save anywhere
```

## The Golden Rules

1. **No monster manual required** - Create what fits the scene
2. **Stats are suggestions** - Adjust on the fly for drama
3. **Unique > Generic** - "Drowned Harbor Master" > "Zombie Lord"
4. **Physics matters** - Steve's tricks should work
5. **Save only what returns** - Most enemies die and are forgotten

## Reference (Optional)

If you need inspiration, there's an archived bestiary.json, but remember:
- Create enemies on the fly that fit your narrative
- Each adventure is its own unique world
- Stats serve the story, not vice versa

## For Next Session

When Steve reaches Sunken Mills, create enemies that:
- Fit the "drowned village" theme
- Use water/drowning as weapon
- Range from Level 3-5 (as mentioned in session.json)
- Have tragic backstories (former villagers)
- Can be defeated with physics/environment (Steve's specialty)

Remember: The story determines the stats, never the reverse!
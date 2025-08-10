# Mechanics Guide - Enemies, Combat, and Game Systems

## Core Philosophy
**Create mechanics on the fly. Stats serve the story, not vice versa.**

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

## Example Combat Creation - FULL NARRATIVE FLOW

### The Setup
Player: "I kick open the door to the mill's main floor."

### The Complete DM Response:

*Your boot connects with the waterlogged door and it EXPLODES inward, slamming against the wall with a crack like thunder. Water rushes out, thick as soup, carrying the smell of decades of rot.*

*The mill's main floor is flooded chest-deep. Massive grindstones sit like islands in the murky water. Waterwheel still turning somehow, groaning with each rotation, pulling things under and spitting them back up.*

*Then you see what those things are.*

*Bodies. Or what used to be bodies. Three villagers, drowned when the dam burst, now something else. They move through the water with purpose, not swimming but walking along the bottom, heads mostly submerged. Only their eyes break the surface - milky white, tracking you.*

[Quick mental creation: Level 4-5 enemies, undead, water-enhanced]

*The closest one - still wearing a merchant's vest, coins spilling from rotted pockets - suddenly SURGES up from the water. His mouth opens impossibly wide, water pouring out, and he screams. It sounds like drowning in reverse.*

**[Drowned Merchant - Level 4 - HP: ▓▓▓▓▓▓▓▓▓▓ 24/24]**
**[Drowned Mother - Level 4 - HP: ▓▓▓▓▓▓▓▓░░ 19/19]**
**[Drowned Miller - Level 5 Elite - HP: ▓▓▓▓▓▓▓▓▓▓ 35/35]**

### Round 1: Steve Acts

Player: "I leap onto the nearest grindstone and swing at the merchant as he surges up."

*You launch yourself through the air, berserker instincts overriding Coffee Shop Steve's voice screaming about water safety. The grindstone is slick with algae but your momentum carries you. Your axe comes around in a perfect arc, catching the afternoon light streaming through broken windows.*

[Rolling attack...]
```bash
python3 tools/dice.py "1d20+6"  # Result: 18
```
**[Attack Roll: 18 + 6 = 24 - Solid Hit!]**

*Your axe catches the merchant just as he reaches for you. The blade bites deep into his shoulder, through waterlogged flesh that parts like wet paper.*

[Rolling damage...]
```bash
python3 tools/dice.py "2d6+4"  # Result: 11
```

*Black water sprays instead of blood. The merchant staggers back, shoulder nearly severed, but doesn't fall. Doesn't even seem to feel it.*

**[Damage Dealt: 11]**
**[Drowned Merchant HP: ▓▓▓▓▓░░░░░ 13/24]**
**[RAGE: ▓▓░░░░░░░░ 15% - The violence begins to sing]**

### Enemies Respond

*The merchant's remaining arm shoots out, impossibly long, fingers wrapping around your ankle. He pulls, trying to drag you into the water. Behind him, the mother glides forward, something small and horrible cradled in her arms. The miller - biggest of them, still wearing his leather apron - dives under the surface. You lose sight of him in the murky water.*

[Merchant grapple attempt...]
```bash
python3 tools/dice.py "1d20+3"  # Result: 14 vs your STR
```

*You wrench your leg free just as his grip tightens, boot slipping off in his hand. He sinks back, your boot clutched like a prize.*

*The mother rises from the water at the grindstone's edge. The bundle in her arms unfolds - a doll? No. What used to be an infant, now something with too many joints, reaching for you with boneless fingers.*

"Shhhh," *she gurgles.* "Baby's hungry."

[Mother's disturbing child attack...]
```bash
python3 tools/dice.py "1d20+4"  # Result: 16
python3 tools/dice.py "1d6+2"  # Result: 6 damage
```

*The thing that was a baby latches onto your calf, teeth like broken glass piercing through your pants.*

**[Damage Taken: 6]**
**[Your HP: 162/168]**
**[RAGE: ▓▓▓░░░░░░░ 25% - Pain and fury mixing]**

*WHERE'S THE MILLER?*

*The grindstone suddenly shifts. He's under it, pushing UP. The massive stone tilts, trying to dump you into the water where they're strongest.*

[STR check to maintain balance...]
```bash
python3 tools/dice.py "1d20+4"  # Result: 15 vs DC 12 - Success
```

*You shift your weight, years of berserker instinct combined with coffee shop balance training (those trays were heavy). The stone rocks but you stay standing. The miller surfaces, frustrated, water streaming from his empty eye sockets.*

### Round 2: Escalation

Player: "I'm going to use the turning waterwheel! I'll grab the mother and feed her into the mechanism!"

*THAT'S the speedrun thinking. You feint left, then grab the mother by her waterlogged dress. She weighs nothing - bloated but hollow. The baby-thing detaches from your leg, shrieking.*

[Grapple check with advantage for creative tactics...]
```bash
python3 tools/dice.py "1d20+4"  # Result: 19 - Success!
```

*You spin, using momentum like you're throwing a hammer in the Olympics, and HURL her toward the waterwheel. She tries to grab the edge but her rotted fingers can't grip. The wheel catches her dress, then her body, pulling her into the mechanism.*

*The sound is indescribable. Wood and bone and meat grinding together. Black water sprays everywhere. The baby-thing shrieks once more, then silence.*

**[Environmental Kill! Drowned Mother - DESTROYED]**
**[RAGE: ▓▓▓▓▓░░░░░ 45% - Creative violence is SATISFYING]**

*The merchant and miller pause. Even undead recognize that was brutal. Water pours through the wheel, now chunky with... pieces.*

*The miller's expression changes. Was that... respect? Or hunger?*

"YOU RUIN EVERYTHING!" *he bellows, voice like grinding stone.* "THE MILL WAS MINE! THE WATER WAS MINE! NOW YOU'RE MINE!"

*All the water in the room suddenly RUSHES toward you, trying to pull you under. The merchant rides the wave, arms outstretched. This is their domain, their element.*

*But you're Steve the Immediate. And you're about to show them what physics can do.*

What's your response?

---

## Key Lessons from This Example

1. **Create enemies with personality** - Not just "3 zombies" but drowned villagers with history
2. **Use environment as character** - The mill, waterwheel, grindstones all matter
3. **Roll dice in the flow** - Show the commands but wrap them in narrative
4. **Track HP dramatically** - Visual bars and descriptions, not just numbers
5. **Reward creativity** - The waterwheel kill was more interesting than another axe swing
6. **Build tension** - Where's the miller? What's in the bundle? Keep them guessing
7. **Make enemies react** - They pause, show emotion, change tactics
8. **Every hit has weight** - Describe the impact, the spray, the sound
9. **Keep momentum** - Even when rolling, maintain narrative flow
10. **End on a cliffhanger** - Always leave them wanting the next response

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
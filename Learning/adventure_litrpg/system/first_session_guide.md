# Running Your First LitRPG Session - Complete Guide

## Pre-Session: Setting Up Claude Code

### Initial Message to Claude Code:
```markdown
I have a LitRPG adventure system in this repository. Please:

1. Read all files in /system to understand the framework
2. Review the game_engine.py to see what mechanics you'll be calculating
3. Study dm_instructions.md for narrative guidelines
4. Check session_zero.md for character creation templates

Then initialize a new adventure. I want to play a [character concept].

Remember: You're the narrator of a living LitRPG world. Use Python for numbers 
(HP, damage, XP) but let everything else flow from narrative logic. Make this 
feel like living inside a progression fantasy novel.
```

## Session Flow Example

### Turn 1: Character Creation
```markdown
You: "I want to be a disgraced noble turned rogue named Cassia"

Claude Code: Let me initialize Cassia and craft her introduction...

[Running: python system/game_engine.py init --name "Cassia" --class "rogue"]
[Creating: session/narrative/current_scene.md]
[Creating: session/narrative/session_log.md]

*The wine stains on your stolen servant's clothes still smell of last night's 
disaster. Your father's words echo: "You're no daughter of mine." The family 
dagger - the only thing you managed to grab - weighs heavy in your boot.*

*Three days ago, you were Lady Cassia Montrose, heir to the Northern Vineyards. 
Then you exposed your uncle's embezzlement at what should have been your 
betrothal feast. Turns out, Father knew. Was profiting. Now you're just another 
refugee fleeing toward the capital with a bounty on your head.*

**[Character Initialized]**
**Cassia - Level 1 Rogue (Fallen Noble)**
**HP: 80/80 | MP: 50/50 | Stamina: 120/120**
**Gold: 50 (stolen from house coffers)**

*The crossroads ahead splits three ways. The sign is worn but readable:*
- *North: "Capital - 3 days" (main road, guards check papers)*
- *East: "Darkwood - Dangerous" (no patrols, monster reports)*
- *South: "Riverside - 1 day" (small town, might have contacts)*

*Behind you, dust rises. Riders. Maybe bounty hunters, maybe just travelers. 
You have perhaps two minutes to decide.*

> What do you do?
```

### Turn 2: First Choice
```markdown
You: "I duck into the underbrush and observe the riders while deciding my path"

Claude Code: 
[Running: python system/game_engine.py check --attribute "dexterity" --dc 12]
[Result: Success - Roll 15+3=18]

*You slip into the thorny undergrowth with practiced silence - those childhood 
games of hiding from your tutors finally paying off. The thorns catch your 
cloak but you remain unseen.*

*Three riders thunder up to the crossroads. Your blood chills - you recognize 
the lead rider's scarred jaw. Marcus "The Collector" - your father's favorite 
problem solver. He's pointing at the ground... at your footprints.*

"Fresh tracks. The little bird came this way." His voice carries the same 
casual menace you remember from when he'd visit the estate. "You two, check 
the capital road. I'll take Darkwood. No one's stupid enough to go there."

*He's wrong about that. You've been stupid enough for worse.*

*As they split up, you notice Marcus's saddlebag bears your house seal. 
Inside could be orders, gold, or information about what your father's planning. 
But stealing from a bounty hunter while he's checking the very woods you need 
to escape through...*

[Stamina: 118/120 - maintaining stealth]

> Your move?
```

### Turn 3: Combat Encounter
```markdown
You: "I wait for him to pass, then attempt to cut his saddle straps so his 
bags will fall when he rides"

Claude Code:
[Running: python system/game_engine.py check --attribute "dexterity" --dc 15]
[Result: Success - Roll 16+3=19]

*Patience was never your virtue at court, but desperation teaches quickly. 
Marcus guides his horse into the woods, scanning for you. You ghost behind, 
your mother's dagger already out.*

*One clean cut. The leather parts like butter - this blade is sharper than it 
looks. The saddlebag drops with a muffled thump into the ferns.*

*But Marcus is no amateur. He wheels instantly, crossbow already in hand.*

"Clever little bird," he grins. "Your father said you'd gotten dangerous."

[Combat Initiated!]
[Enemy: Marcus "The Collector" - Veteran Bounty Hunter]

*The crossbow bolt whistles past your ear as you dive behind an oak. You hear 
him dismounting, drawing steel. "Could've made this easy, Lady Cassia. Now I 
have to bring you back bruised."*

*The trees are thick here, limiting his movement. Your noble training included 
fencing, but this won't be a gentleman's duel. You notice: loose rocks, low 
branches, and his horse is spooked...*

> Your action?
```

### Turn 4: Combat Resolution
```markdown
You: "I throw a rock at the horse to make it bolt, then attack while he's 
distracted"

Claude Code:
[Running: python system/game_engine.py check --attribute "dexterity" --dc 10]
[Result: Success - using thrown weapon]

*Your rock strikes the horse's flank. It rears with a panicked whinny and 
bolts deeper into Darkwood, taking Marcus's spare weapons and supplies.*

"Damn you!" He starts to turn—

*But you're already moving. The fencing lessons merge with street instincts 
you've developed over three days of running.*

[Running: python system/game_engine.py attack --weapon "1d4+2" --armor 3]
[Result: 7 damage (reduced by armor), Marcus is surprised]

*Your dagger finds the gap in his leather armor, drawing blood along his ribs. 
He staggers back, reassessing. You're not the pampered noble he expected.*

"First blood to you, little bird. But I've been doing this for twenty years—"

[Running: python system/game_engine.py enemy-attack --damage "1d6+3"]
[Result: 8 damage to you]
[Your HP: 72/80]

*His sword clips your shoulder as you dodge, sending hot pain down your arm. 
The cut isn't deep but it's bleeding. He's pressing forward now, trying to corner 
you against a tree.*

[Combat Status]
You: HP 72/80 | Stamina: 110/120
Marcus: Wounded, angry, experienced fighter
Environment: Dense trees, his dropped saddlebag 5 feet away, sounds of other 
riders possibly returning

> Continue fighting or try something else?
```

### Turn 5: Creative Solution
```markdown
You: "I grab the saddlebag and threaten to throw it into the ravine I can 
hear nearby. 'Your gold or my freedom, Marcus. Choose.'"

Claude Code:
[Running: python system/game_engine.py check --attribute "charisma" --dc 14]
[Result: Success - Roll 12+2=14]
[Updating: session/world/relationships.json - Marcus: "grudging respect"]

*You dive for the saddlebag, coming up with it clutched to your chest. The 
ravine's roar is maybe thirty feet through the brush.*

Marcus freezes. His eyes flick to the bag, calculating.

"That's not just gold in there, is it?" you guess, backing toward the ravine. 
"Father's real orders? Evidence of what he's planning?"

Something shifts in his expression. "You always were too smart for your own 
good. That's why he wants you silenced."

"Then let me disappear. Tell him I went into Darkwood and never came out. 
Probably eaten by something with too many teeth." You edge closer to the drop. 
"Or we both lose - you fail your job, I lose my leverage."

*A long moment passes. Blood drips from both your wounds. Finally, Marcus 
lowers his sword.*

"Darkwood it is then. But listen well, little bird - your uncle wasn't the 
only one stealing. That bag has names. Dates. Your father's enemies would pay 
handsomely for it. Consider it... severance pay for a lifetime of loyalty."

*He backs away, hands visible. "I'll tell them you're dead. But if I see you 
again..."*

"You won't."

*He disappears into the trees, whistling for his horse. You're left holding a 
bag that apparently contains political dynamite.*

[Running: python system/game_engine.py gain_xp --amount 100]
[Level Up! You've reached Level 2]
[+10 HP, +5 MP, +5 Stamina, +1 Skill Point, +2 Stat Points]

[Updating: session/narrative/threads.md - "Father's Conspiracy" thread added]
[Item Gained: Marcus's Saddlebag - contains mysterious documents]

> Examine the bag's contents or get moving first?
```

## Managing Ongoing Sessions

### Starting Session 2
```markdown
Claude Code, please load my previous session with Cassia. Give me a brief 
"Previously on..." recap, then continue from where we left off.
```

### Session Management Tips

#### Keep Claude Focused:
```markdown
"Remember: Cassia is a fallen noble, not a hardened thief yet. She's learning. 
Also, the documents in the bag are key to the larger conspiracy - don't forget 
about them."
```

#### Request Specific Scenes:
```markdown
"I'd like to reach a town soon where I can rest and examine the documents 
properly. Maybe introduce an NPC who could become an ally."
```

#### Adjust Tone Mid-Session:
```markdown
"This is getting quite dark. Could we have a moment of levity or hope? Maybe 
a kind stranger or funny situation?"
```

#### Create Save Points:
```markdown
"This feels like a good chapter break. Please create a detailed save point 
with current status, inventory, active threads, and relationships."
```

## Common Situations and Responses

### Player Attempts Something Impossible
**Player**: "I cast meteor storm"
**Claude**: *You reach for power beyond your understanding, trying to grasp the
complex weave of a spell far beyond your current abilities. The magic slips
through your mental fingers like smoke. [MP: 45/50 - lost 5 from failed attempt]*

### Player Forgets Plot Elements
**Player**: "Wait, what was in that bag again?"
**Claude**: [Checking session/narrative/threads.md]
*You still carry Marcus's saddlebag containing documents about your father's
conspiracy. You haven't had a safe moment to examine them properly yet.*

### Player Wants to Skip Ahead
**Player**: "Can we skip to arriving at the capital?"
**Claude**: *Three days of careful travel through back roads and merchant
caravans brings you to the capital's towering walls. You're footsore, hungry,
and your stolen servant's clothes are now thoroughly travel-worn. [Rest needed:
-10 to max stamina until you sleep in a real bed]*

*The gate guards are checking everyone's papers. You'll need a plan to get
inside without identification...*

### Combat Gets Repetitive
Instead of: "I attack again"
Claude makes it interesting: *Your blade work becomes desperate, fatigue making
your swings wilder. [Stamina: 40/120] The bandit notices your exhaustion and
grins, pressing his advantage...*

## Advanced Techniques

### Weaving Multiple Threads
Track in `session/narrative/threads.md`:
- Main: Father's conspiracy
- Personal: Reclaim birthright
- Romantic: Mysterious stranger's interest
- Side: Thieves guild recruitment
- Background: War brewing in the north

### Time Pressure Without Timers
"The festival starts at sunset. You have perhaps three hours to find the
contact, get the information, and escape before your uncle's men arrive."

### Meaningful Choices
Always provide:
- Immediate consequence
- Long-term implication
- Character development opportunity
- World state change

Example:
"Save the merchant (gain ally, lose target) or chase assassin (stay on mission,
merchant dies)?"

### Environmental Storytelling
Every location should tell a story:
"The abandoned watchtower's stairs are scratched with desperate fingernails.
Dark stains lead to a barricaded door. Whatever happened here, the defenders
lost."

## Troubleshooting

### If Claude Forgets Context
"Please check session/narrative/current_scene.md and session_log.md to remind
yourself where we are and what just happened."

### If Combat Feels Wrong
"Run the combat calculations through game_engine.py - I think the damage might
be off."

### If Story Loses Direction
"What are the current active threads? Let's pursue [specific thread]."

### If Session Crashes
"Load the most recent state from session/state/game_state.json and give me a
status report."

## Ending a Session

### Good Stopping Points
- After a major victory
- At a safe rest location
- Before a big decision
- After a revelation

### Session Wrap-Up
```markdown
"Let's end here. Please:
1. Save current state
2. Update all tracking files
3. Write a session summary  
4. Note any unresolved threads
5. Set up the next session's opening"
```

## Growing Your Adventure

### After 5 Sessions
- Consider adding custom content to databases
- Develop recurring NPCs into fuller characters
- Let early choices have major consequences
- Introduce faction politics

### After 10 Sessions
- Time for a major story arc conclusion
- Power level should feel notably different
- Consider prestige class evolution
- World should show scars of your actions

### Campaign Conclusion
- Archive the complete adventure
- Extract favorite NPCs for future campaigns
- Note successful narrative techniques
- Share epic moments with community

## Remember: You're Writing a Story Together

Every session should feel like you're living inside a LitRPG novel where:
- Your choices matter
- The numbers create tension
- The world exists beyond you
- Growth is earned, not given
- Every victory has a cost
- Every defeat teaches something

Now go forth and adventure!
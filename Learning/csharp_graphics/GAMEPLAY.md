# Thoughts

## Gameplay

### General Generated Gameplay Guidelines

- The game should be engaging and fun, with a balance of challenge and reward.
- Players should feel a sense of progression and achievement as they advance through the game.
- The game should encourage exploration and experimentation, allowing players to discover new strategies and tactics.
- The game should have a clear and intuitive user interface, making it easy for players to understand

### Manually Typed Details

- color/shape resource matching
- resources; thinking...
    - basic: blue teardrop, red square, yellow triangle
    - factory-created: green hexagon (point up), orange circle, purple diamond, black beam (horizontal rectangle), white
      pillar (vertical rectangle), silver trusses ("X" shape)
- there are resource gathering buildings
    - each building gathers a specific resource
        - round buildings gathers blue teardrop resources when next to water
        - square buildings mines red square resources when on particular locations ("ore") on the map
        - triangular buildings gathers yellow triangle resources when next to rock
    - buildings can be upgraded to gather resources faster or in larger quantities by placing multiple buildings of the
      same type next to each other; they combine their output x2, x3, etc.
        - hhmmm, is this a good idea? is there a better way(s)?
- there are resource processing buildings
    - each building processes a specific resource into a more valuable resource; for example, two small teardrop
      resources can be combined into one large teardrop resource (?)
    - processing buildings can be upgraded to process resources faster or in larger quantities
- there are resource storage buildings
    - each building stores a specific resource(s) if it's placed next to them, allowing resources to be used at a
      different rate than they are gathered
- there are resource conversion factory buildings
    - each building takes in two different resources and converts them into a third resource; for example:
        - a blue teardrop and a red square can be converted into a purple triangle (e.g. a rotated square)
        - a yellow triangle and a red square can be converted into an orange circle
        - a blue teardrop and a yellow triangle can be converted into a green hexagon
        - a green hexagon and a purple diamond can be converted into a black square
        - a purple diamond and an orange circle can be converted into a white rectangle
- there are resource usage buildings
    - residential buildings require resources to be built and maintained, higher tiered buildings require more and
      different resources (e.g. lvl 3 residential building requires 3x blue teardrop, 2x red square, and 1x yellow
      triangle)
    - research buildings require resources to build research points, upgraded research buildings change the needed
      resource combinations but unlock much faster research rates (and need at least one of the type to research that
      tier)
    - special buildings require combinations of the highest tier resources to be built, and they unlock special
      abilities or features in the game
        - e.g. transportation options: "trucks" moving two of a resource at a time, trains to move resources across the
          map, flying cargo, portals, etc.
    - hub building receives silver trusses to expand the map area as it upgrades (and push the story forward? build
      landing pads for deliveries from orbit?)
    - (FUTURE) military buildings require resources to be built and maintained, upgrades change the needed resource
      combinations but produce more powerful units
        - as the map expands, enemies can start spawning and attacking the player's buildings, requiring defenses to be
          built; spawn areas can be destroyed to stop the spawning
        - adds more complicated RTS elements to the game, but also adds more depth and strategy as the military units
          use transportation options to move around the map much faster than off-road (unless they fly)

## Visuals

### General Generated Art Guidelines

- The game should have a cohesive and appealing art style that fits the theme and tone of the game.
- The game should have clear and distinct visual cues to help players understand the game mechanics and objectives.
- The game should have a variety of environments and settings to keep the game visually interesting and engaging.
- The game should have smooth and responsive animations to enhance the player experience.
- The game should have a consistent color palette and design elements to create a unified visual identity.
- The game should have visual effects to enhance the gameplay experience, such as particle effects for resource
  gathering or building construction.
- The game should have a clear and readable font for all text elements, ensuring that players can easily understand
  instructions and information.
- The game should have a visually appealing and intuitive user interface, with clear icons and buttons for all game
  functions.

### Manually Typed Visual Details

- Start with simple 2D shapes and colors to represent resources and buildings, user can always update png files later
- I like your concept of stacked colored bars on a building to show inventory levels, maybe an outline of the shape(s)
  that building uses in their color(s) below the stacks?
- Buildings should have simple animations to show they are active (e.g. spinning, bouncing, pulsing, etc.); sprite
  sheets later on where a row of four across is looped? whatever's best for performance
- We need individual textures or atlas textures for the road pieces, all other transportation options, terrain types (
  water, rock, grass/sand/buildable, ore locations, etc.), resource types, buildings, etc.
- Maybe a simple animation to give the game some life, possibly slow-moving cloud shadows or something similar? birds (
  small) flying through the map if we have extra processing for boid flocking behavior?
- Other shadows of things like floating islands and flying whales haha
- (FUTURE) the whole art style could be redone in Unity's 3D engine, using low-poly models and simple textures to create
  a charming and stylized look with some orthographic or perspective camera angle; buildings could have more complex
  animations and effects, and the terrain could be more detailed and varied (as desired). Artist friend(s) might be
  interested in reskinning it even.

---
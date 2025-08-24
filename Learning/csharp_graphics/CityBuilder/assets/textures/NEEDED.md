# Texture Assets Needed

## Building Textures (32x32 or 64x64)

### Tier 2 Factories (Production Buildings)
- [ ] `buildings/factory_green_hexagon.png` - Blue + Yellow → Green (hexagon motif)
- [ ] `buildings/factory_orange_circle.png` - Yellow + Red → Orange (circular motif)

### Tier 3 Factories (Advanced Production)
- [ ] `buildings/factory_black_beam.png` - Green + Purple → Black (horizontal beam shape)
- [ ] `buildings/factory_white_pillar.png` - Purple + Orange → White (vertical pillar shape)
- [ ] `buildings/factory_silver_truss.png` - Black + White → Silver (X-shaped truss)

### Special Buildings
- [ ] `buildings/research_lab.png` - Converts resources to tech points
- [ ] `buildings/orbital_hub.png` - Accepts contracts and Silver Trusses for expansion
- [ ] `buildings/storage_depot.png` - Buffer storage for resources

### Building Upgrades (Visual Variants)
- [ ] `buildings/water_gatherer_lvl2.png` - Upgraded water gatherer (2x2 size)
- [ ] `buildings/ore_extractor_lvl2.png` - Upgraded ore extractor (2x2 size)
- [ ] `buildings/rock_harvester_lvl2.png` - Upgraded rock harvester (2x2 size)
- [ ] `buildings/residential_lvl2.png` - Upgraded residential (2x2 size)

## UI Elements

### Cursor States (32x32)
- [ ] `ui/cursor_valid.png` - Green outline/checkmark for valid placement
- [ ] `ui/cursor_invalid.png` - Red X or outline for invalid placement
- [ ] `ui/cursor_warning.png` - Yellow ! for suboptimal placement (e.g., gatherer with no resources nearby)

### Building State Overlays (16x16 or 32x32)
- [ ] `ui/state_idle.png` - Pulsing outline animation frames
- [ ] `ui/state_active.png` - Glow effect overlay
- [ ] `ui/state_blocked.png` - Warning/alert icon
- [ ] `ui/state_no_demand.png` - "Zzz" sleep indicator

### Resource Flow Indicators
- [ ] `ui/resource_produced.png` - Up arrow or + symbol for production
- [ ] `ui/resource_consumed.png` - Down arrow or - symbol for consumption
- [ ] `ui/resource_full.png` - Storage full indicator
- [ ] `ui/resource_empty.png` - Resource needed indicator

## Terrain Textures (32x32 tileable)

### Enhanced Terrain (to replace solid colors)
- [ ] `terrain/water_tile.png` - Animated water texture (multiple frames)
- [ ] `terrain/ore_deposit.png` - Rocky red/brown ore vein texture
- [ ] `terrain/rock_formation.png` - Gray/yellow stone texture
- [ ] `terrain/grass_tile.png` - Default terrain texture

## Vehicle Enhancements

### Vehicle States (16x16 or 24x24)
- [ ] `vehicles/truck_empty.png` - Empty delivery truck
- [ ] `vehicles/truck_loaded.png` - Truck with cargo indicator
- [ ] `vehicles/truck_variants/` - Different colored trucks for different routes

## Effects and Animations

### Production Effects (32x32 sprite sheets)
- [ ] `effects/sparkle_sheet.png` - Production complete sparkle
- [ ] `effects/smoke_sheet.png` - Factory smoke animation
- [ ] `effects/glow_sheet.png` - Building active glow

### Particle Effects
- [ ] `particles/resource_float.png` - Floating resource icon template
- [ ] `particles/dust.png` - Construction/destruction dust

## Contract/UI Icons (16x16)

### Menu Icons
- [ ] `icons/contract_timer.png` - Clock for timed contracts
- [ ] `icons/research_branch.png` - Tech tree branch icon
- [ ] `icons/population.png` - Resident/population counter
- [ ] `icons/efficiency.png` - Efficiency upgrade icon
- [ ] `icons/logistics.png` - Logistics upgrade icon
- [ ] `icons/innovation.png` - Innovation upgrade icon

## Priority Order

1. **High Priority** (needed for Phase 2-3)
   - Tier 2 factory variants
   - Cursor states for placement feedback
   - Building state overlays

2. **Medium Priority** (visual polish)
   - Terrain textures to replace solid colors
   - Resource flow indicators
   - Production effects

3. **Low Priority** (nice to have)
   - Building upgrade variants
   - Vehicle variants
   - Particle effects

## Notes

- All building textures should maintain the shape language (round=water, square=ore, triangle=rock)
- Use consistent color palette aligned with resource colors
- Consider colorblind-friendly design (shapes matter more than colors)
- Buildings should be easily distinguishable at zoom levels
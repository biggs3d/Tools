# LitRPG Adventure System - Architecture & Design Document

## Project Overview

A narrative-first LitRPG adventure framework combining compelling storytelling with meaningful mechanical progression. The system balances creative freedom with structured game mechanics, where Python handles the math while Claude handles the storytelling.

## Core Architecture Components

### 1. Game Engine (`system/game_engine.py`)
**Purpose**: Core mechanical calculations and state management
**Key Features**:
- Nested character state structure (v2 format)
- Combat calculations (attack, damage, healing)
- Status effect system with DOT damage
- Inventory and equipment management
- Area-based scaling
- XP and level progression
- Skill checks with modifiers
- Story flag system

**Design Issues**:
- Complex CLI interface with many commands
- State structure migration complexity
- Tight coupling between components

### 2. Configuration System (`system/config.json` + `system/config.py`)
**Purpose**: Centralized game constants and tunable parameters
**Key Features**:
- Game constants (stamina costs, crit chances, XP scaling)
- Area definitions with scaling modifiers
- Class progression templates
- Status effect definitions
- Recovery mechanics
- Death thresholds

**Design Issues**:
- Multiple config key naming conventions
- Deep merge complexity for overrides
- Path management across different tools

### 3. Narrative Chronicler (`system/narrative_chronicler.py`)
**Purpose**: Real-time narrative capture during play
**Key Features**:
- Scene-by-scene recording
- Automatic markdown generation
- Word count tracking
- Mechanics integration
- Auto-save after each scene

**Design Issues**:
- Manual chronicle requirement during play
- No automatic trigger integration
- Separate from main game flow

### 4. Session Management System
**Components**:
- `session_logger.py`: Combat replay and chapter generation
- `end_session.py`: Session archival workflow
- `claude_session_capture.py`: Full conversation preservation
- `NEXT_SESSION.md`: Narrative continuity guide

**Design Issues**:
- Multiple overlapping logging systems
- Manual coordination required
- State vs narrative separation complexity

### 5. Content System (`content/` directory)
**Purpose**: Reference data for items, spells, monsters
**Files**:
- `items.json`: Base equipment
- `custom_items.json`: Unique/legendary items
- `bestiary.json`: Monster templates
- `spells.json`: Magic system
- `adventure_starts.json`: Session beginnings

**Design Philosophy**: "Inspiration, not scripture" - content files are suggestions

### 6. Helper Tools Suite
**Components**:
- `adventure_tools.py`: Master control script
- `update_stats.py`: Stat synchronization
- `progression_tracker.py`: Character growth visualization
- `npc_matrix.py`: Relationship tracking
- `sanity_check.py`: Consistency validation
- `quickstart.py`: Interactive character creation
- `migrate_state.py`: Format migration utility

**Design Issues**:
- Tool proliferation and overlap
- Inconsistent interfaces
- Manual invocation requirements

### 7. Event System (`system/lib/event_bus.py`)
**Purpose**: Pub/sub architecture for component communication
**Status**: Partially implemented
**Intended Features**:
- Automatic state synchronization
- Level-up notifications
- Combat event tracking
- File update coordination

### 8. Directory Structure
```
adventure_litrpg/
├── system/           # Core mechanics (engine, tools, config)
├── content/          # Reference data (items, monsters, spells)
├── prompts/          # Narrative templates
├── session/          # Active game state
│   ├── state/        # Mechanical data (HP, XP, inventory)
│   ├── narrative/    # Story tracking
│   ├── chapters/     # Polished output
│   ├── chronicles/   # Raw play-by-play
│   ├── combat_replays/
│   ├── world/        # NPC relationships
│   └── meta/         # Player preferences
└── archives/         # Completed sessions
```

## Key Design Patterns

### 1. Separation of Concerns
- **Mechanical**: Python handles all numbers (HP, damage, XP)
- **Narrative**: Claude handles story, NPCs, world-building
- **State**: JSON files for persistence
- **Presentation**: Markdown for human readability

### 2. Data Flow Architecture
```
Player Input → Claude Interpretation → Python Calculation → State Update → Narrative Response
```

### 3. State Management Philosophy
- `game_state.json`: ONLY source for mechanical data
- `NEXT_SESSION.md`: ONLY narrative continuity
- No duplication between systems
- Atomic writes to prevent corruption

## Current Pain Points

### 1. Complexity Overload
- 789-line CLAUDE.md with multiple versions and patches
- Too many manual steps for session management
- Overlapping tools and systems
- Migration baggage from v1 → v2 → v3

### 2. Manual Coordination Burden
- DM must remember to chronicle scenes
- Multiple commands needed for simple actions
- Session ending requires 10+ manual steps
- Tool invocation not integrated with flow

### 3. Narrative Consistency Challenges
- State spread across multiple files
- No automatic narrative triggers
- Manual NPC tracking
- Story threads management overhead

### 4. System Brittleness
- Config key mismatches
- State structure migrations
- Path resolution issues
- Tool dependencies

## Opportunities for Simplification

### 1. Unified Command Interface
- Single entry point for all actions
- Automatic chronicle triggers
- Integrated session management
- Smart defaults and shortcuts

### 2. Event-Driven Architecture
- Full event bus implementation
- Automatic file synchronization
- Narrative hooks on state changes
- Plugin-style tool integration

### 3. Simplified State Model
- Single source of truth design
- Automatic backup/recovery
- Version-agnostic structure
- Clear mechanical vs narrative split

### 4. Streamlined CLAUDE.md
- Focus on philosophy, not implementation
- Remove version-specific patches
- Emphasize creative freedom
- Reduce to essential guidelines

### 5. Content System Evolution
- Dynamic content generation
- Procedural variations
- Narrative-driven attributes
- Less JSON, more imagination

## Architectural Strengths

### 1. Clear Mechanical Framework
- Dice rolling system works well
- Combat calculations are solid
- Level progression is balanced
- Status effects add depth

### 2. Narrative Freedom
- "Numbers for impact, narrative for everything else"
- Content files as inspiration
- Creative combat descriptions
- Living world philosophy

### 3. Session Preservation
- Multiple backup systems
- Chronicle and chapter generation
- Full conversation capture
- Archive system for history

### 4. Extensibility
- JSON-based configuration
- Plugin-style tools
- Custom content support
- Class system flexibility

## Design Recommendations

### 1. Immediate Simplifications
- Consolidate overlapping tools
- Reduce CLAUDE.md by 50%
- Automate session workflows
- Implement smart defaults

### 2. Core Refactoring
- Complete event bus implementation
- Unified command processor
- Single state manager
- Integrated chronicle system

### 3. Enhanced Creativity Support
- Procedural content helpers
- Narrative prompt templates
- Dynamic NPC generation
- Story thread automation

### 4. Developer Experience
- Clear separation of concerns
- Consistent naming conventions
- Comprehensive error handling
- Self-documenting code

## Technical Debt Summary

### High Priority
- State structure migrations (v1→v2)
- Config key inconsistencies
- Manual chronicle requirements
- Session management complexity

### Medium Priority
- Tool proliferation
- Path resolution issues
- Incomplete event system
- Documentation overhead

### Low Priority
- Performance optimizations
- Advanced combat features
- Multi-campaign support
- Cloud synchronization

## Success Metrics

### System Health
- Lines of documentation needed
- Manual steps per session
- Error frequency
- Recovery complexity

### Creative Freedom
- Time to first combat
- Narrative flexibility
- Custom content usage
- Story consistency

### Player Experience
- Session flow smoothness
- Immersion maintenance
- Progress visibility
- Achievement satisfaction

## Conclusion

The LitRPG Adventure System has solid mechanical foundations but suffers from accumulated complexity and manual overhead. The path forward involves aggressive simplification, automation of routine tasks, and stronger emphasis on the narrative-first philosophy that makes the system unique.

Key principle to preserve: **"Numbers for impact, narrative for everything else"**

Primary goal: **Reduce friction between imagination and implementation**
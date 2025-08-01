# Custom Console Research

This directory contains research and demos exploring how terminal UIs like Claude Code are created and how to build retro ASCII-style interfaces.

## Files

- `terminal_ui_research.md` - Comprehensive research on terminal UI technologies
- `retro-terminal-demo.js` - Pure ANSI terminal demo (no dependencies!)
- `neo-blessed-retro.js` - Advanced UI using neo-blessed (maintained fork)
- `package.json` - Dependencies for neo-blessed demo

## Running the Demos

1. Install dependencies (optional - only needed for neo-blessed):
   ```bash
   npm install
   ```

2. Run the pure ANSI retro demo (NO DEPENDENCIES! 🎉):
   ```bash
   npm run demo
   # or
   node retro-terminal-demo.js
   ```

3. Run the neo-blessed version:
   ```bash
   node neo-blessed-retro.js
   ```

## Key Findings

### Claude Code Terminal Creation
- Likely uses modern terminal emulator libraries (xterm.js for web, blessed/ink for CLI)
- Implements markdown rendering and syntax highlighting
- Uses WebSocket or IPC for process communication
- Handles both input capture and output streaming

### ASCII/Retro UI Techniques
- ANSI escape codes for colors and positioning
- Box drawing Unicode characters for UI elements
- Libraries like blessed provide high-level abstractions
- CRT effects can be added with CSS or visual overlays

## Technologies Explored

1. **Raw ANSI** - Direct terminal control with escape sequences
2. **Blessed** - NCurses-like library for Node.js
3. **Ink** - React components for CLI apps
4. **Terminal-kit** - Full-featured terminal library

## Cool Effects

- Phosphor glow (green CRT monitors)
- Scan lines
- ASCII art banners
- DOS-style menus
- BBS-inspired interfaces

## Lessons Learned

- **Original blessed is abandoned** (last update 2015) - use neo-blessed instead
- **Pure ANSI approach works great** - No dependencies, maximum compatibility
- **Terminal capabilities matter** - Some features depend on terminal emulator support
- **Simple is often better** - The raw ANSI demo is more reliable than complex libraries
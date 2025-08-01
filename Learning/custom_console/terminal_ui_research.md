# Terminal UI Research: Claude Code & ASCII Interfaces

## 1. How Claude Code Terminal is Created

Claude Code appears to use a modern terminal emulator approach, likely built with:

### Core Technologies
- **Terminal Emulator**: Likely uses libraries like:
  - `xterm.js` - Full featured terminal emulator for the web
  - `node-pty` - Provides PTY (pseudo-terminal) support for spawning processes
  - `blessed` or `ink` - For Node.js terminal UI rendering

### Architecture Pattern
```
┌─────────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend UI   │────▶│  WebSocket/  │────▶│   Backend   │
│  (Terminal UI)  │     │    IPC       │     │  (Process)  │
└─────────────────┘     └──────────────┘     └─────────────┘
```

### Key Components
1. **Input Handling**: Captures keyboard input, handles special keys
2. **Output Rendering**: Markdown parsing, syntax highlighting, ANSI escape codes
3. **Process Management**: Spawns child processes, manages stdio
4. **State Management**: Tracks command history, current context

### Modern Terminal Features
- Real-time streaming output
- Rich text formatting (markdown support)
- Progress indicators and spinners
- Interactive prompts
- Syntax highlighting

## 2. Creating ASCII/Retro Terminal UIs

### Classic Terminal Aesthetics
- Monospace fonts (DOS fonts, terminal fonts)
- Limited color palettes (16 colors, CGA/EGA)
- Box drawing characters
- ASCII art and ANSI art

### Technologies for ASCII UIs

#### 1. **blessed** - NCurses-like library for Node.js
```javascript
const blessed = require('blessed');

const screen = blessed.screen({
  smartCSR: true,
  title: 'Retro Terminal'
});

const box = blessed.box({
  top: 'center',
  left: 'center',
  width: '50%',
  height: '50%',
  content: '╔═══════════════╗\n' +
           '║ RETRO CONSOLE ║\n' +
           '╚═══════════════╝',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'green',
    bg: 'black',
    border: {
      fg: '#f0f0f0'
    }
  }
});
```

#### 2. **Ink** - React for CLI apps
```javascript
import React from 'react';
import {render, Box, Text} from 'ink';

const RetroUI = () => (
  <Box borderStyle="double" borderColor="green">
    <Text color="green">
      ████████╗███████╗██████╗ ███╗   ███╗
      ╚══██╔══╝██╔════╝██╔══██╗████╗ ████║
         ██║   █████╗  ██████╔╝██╔████╔██║
         ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║
         ██║   ███████╗██║  ██║██║ ╚═╝ ██║
         ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝
    </Text>
  </Box>
);

render(<RetroUI />);
```

#### 3. **ANSI Escape Codes** - Raw terminal control
```javascript
// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  // Foreground colors
  fg: {
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
  },
  
  // Background colors
  bg: {
    black: '\x1b[40m',
    red: '\x1b[41m',
    green: '\x1b[42m',
    yellow: '\x1b[43m',
    blue: '\x1b[44m',
    magenta: '\x1b[45m',
    cyan: '\x1b[46m',
    white: '\x1b[47m',
  }
};

// Clear screen and move cursor
console.log('\x1b[2J\x1b[H');

// Draw a box
console.log(colors.fg.green + '┌────────────────┐');
console.log('│ RETRO TERMINAL │');
console.log('└────────────────┘' + colors.reset);
```

### ASCII Art Elements

#### Box Drawing Characters
```
Single: ┌─┬─┐  Double: ╔═╦═╗  Mixed: ╓─╥─╖
        │ │ │          ║ ║ ║         ║ ║ ║
        ├─┼─┤          ╠═╬═╣         ╟─╫─╢
        │ │ │          ║ ║ ║         ║ ║ ║
        └─┴─┘          ╚═╩═╝         ╙─╨─╜
```

#### Classic UI Patterns
```
╔════════════════════════════════════════╗
║  F1:Help  F2:Save  F3:Load  ESC:Exit  ║
╠════════════════════════════════════════╣
║                                        ║
║     ▓▓▓ MAIN MENU ▓▓▓                ║
║                                        ║
║     1. New Game                        ║
║     2. Load Game                       ║
║     3. Settings                        ║
║     4. Exit                            ║
║                                        ║
║     Select: _                          ║
║                                        ║
╚════════════════════════════════════════╝
```

### Retro Effects

#### 1. CRT Shader Effect (CSS)
```css
@keyframes flicker {
  0% { opacity: 0.27861; }
  5% { opacity: 0.34769; }
  10% { opacity: 0.23604; }
  /* ... more keyframes ... */
}

.crt {
  animation: flicker 0.15s infinite;
  text-shadow: 0 0 5px rgba(0, 255, 0, 0.8);
  background: radial-gradient(ellipse at center, #0a0a0a 0%, #000000 100%);
}

.scanlines::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    transparent 50%,
    rgba(0, 0, 0, 0.03) 51%
  );
  background-size: 100% 4px;
  pointer-events: none;
}
```

#### 2. Phosphor Glow Effect
```javascript
// Add glow to text
const addPhosphorGlow = (text) => {
  return `\x1b[38;2;0;255;0m\x1b[48;2;0;30;0m${text}\x1b[0m`;
};
```

### Popular Retro Terminal Libraries

1. **cool-retro-term** - Terminal emulator mimicking old CRT displays
2. **cmatrix** - Matrix-style falling text
3. **asciinema** - Record and share terminal sessions
4. **terminalizer** - Record terminal and generate GIFs
5. **chalk** - Terminal string styling

### Implementation Ideas

#### 1. BBS-Style Interface
```
┌─[ RETRO BBS v1.0 ]──────────────────────┐
│ Connected at 2400 baud                  │
├─────────────────────────────────────────┤
│ [M]essages  [F]iles  [C]hat  [Q]uit    │
├─────────────────────────────────────────┤
│ Welcome to the Retro BBS!               │
│ You have 3 new messages.                │
│                                         │
│ Last caller: SYSOP @ 11:45 PM          │
│ Total calls today: 42                   │
└─────────────────────────────────────────┘
```

#### 2. DOS-Style Menu
```
 ██████╗ ██████╗ ███╗   ███╗███╗   ███╗ █████╗ ███╗   ██╗██████╗ 
██╔════╝██╔═══██╗████╗ ████║████╗ ████║██╔══██╗████╗  ██║██╔══██╗
██║     ██║   ██║██╔████╔██║██╔████╔██║███████║██╔██╗ ██║██║  ██║
██║     ██║   ██║██║╚██╔╝██║██║╚██╔╝██║██╔══██║██║╚██╗██║██║  ██║
╚██████╗╚██████╔╝██║ ╚═╝ ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║██████╔╝
 ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═════╝ 
                                                                   
          ╔═══════════════════════════════════╗
          ║  A) Run Diagnostics               ║
          ║  B) System Configuration          ║
          ║  C) File Manager                  ║
          ║  D) Exit to DOS                   ║
          ╚═══════════════════════════════════╝
                    
                  Select Option: _
```

## Resources & References

### Terminal UI Libraries
- [blessed](https://github.com/chjj/blessed) - NCurses-like library
- [Ink](https://github.com/vadimdemedes/ink) - React for CLIs
- [terminal-kit](https://github.com/cronvel/terminal-kit) - Full featured terminal lib
- [cli-spinners](https://github.com/sindresorhus/cli-spinners) - Spinner collection

### ASCII Art Tools
- [figlet](http://www.figlet.org/) - ASCII art text generator
- [jp2a](https://github.com/Talinx/jp2a) - JPEG to ASCII converter
- [ascii-art](https://www.npmjs.com/package/ascii-art) - Node.js ASCII art library

### Retro Terminal Emulators
- [cool-retro-term](https://github.com/Swordfish90/cool-retro-term)
- [Cathode](https://www.secretgeometry.com/apps/cathode/) (macOS)
- [eDEX-UI](https://github.com/GitSquared/edex-ui) - Sci-fi terminal

### Font Resources
- [DOS Fonts](https://www.dafont.com/bitmap.php)
- [Terminal Fonts](https://github.com/powerline/fonts)
- [Nerd Fonts](https://www.nerdfonts.com/) - Fonts with icons
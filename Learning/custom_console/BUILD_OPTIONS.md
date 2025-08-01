# Build Options for Retro Terminal

## Quick Start: Building Executables with PKG

### 1. Install PKG globally
```bash
npm install -g pkg
```

### 2. Simple build (all platforms)
```bash
# For Node 22 users, specify Node 18 targets:
pkg retro-terminal-demo.js --targets node18-linux-x64,node18-macos-x64,node18-win-x64

# Or use the shorthand for Node 18:
pkg retro-terminal-demo.js --targets latest-linux-x64,latest-macos-x64,latest-win-x64
```

This creates:
- `retro-terminal-demo-win.exe` (Windows)
- `retro-terminal-demo-linux` (Linux)
- `retro-terminal-demo-macos` (macOS)

### 3. Custom build with options
```bash
# Specific output directory and name
pkg retro-terminal-demo.js --out-path dist/ --output retro-terminal

# Single platform only
pkg retro-terminal-demo.js --targets node18-win-x64

# Multiple specific platforms
pkg retro-terminal-demo.js --targets node18-win-x64,node18-linux-x64
```

## Advanced PKG Configuration

Create a `package.json` with build settings:

```json
{
  "name": "retro-terminal",
  "version": "1.0.0",
  "main": "retro-terminal-demo.js",
  "bin": "retro-terminal-demo.js",
  "scripts": {
    "build": "pkg .",
    "build:win": "pkg . --targets node18-win-x64",
    "build:all": "npm run build:win && npm run build:linux && npm run build:mac",
    "build:linux": "pkg . --targets node18-linux-x64",
    "build:mac": "pkg . --targets node18-macos-x64"
  },
  "pkg": {
    "targets": [
      "node18-win-x64",
      "node18-linux-x64",
      "node18-macos-x64"
    ],
    "outputPath": "dist",
    "compress": "GZip"
  }
}
```

Then run:
```bash
npm run build:all
```

## Alternative: CAXA (Simpler but bigger)

```bash
npm install -g caxa

# Build for current platform
caxa --input . --output "retro-terminal" -- "{{caxa}}/node_modules/.bin/node" "{{caxa}}/retro-terminal-demo.js"
```

## Alternative: NEXE (More control)

```bash
npm install -g nexe

# Build with specific Node version
nexe retro-terminal-demo.js --target windows-x64-14.15.3
nexe retro-terminal-demo.js --target linux-x64-14.15.3
nexe retro-terminal-demo.js --target mac-x64-14.15.3
```

## NPM Global Package Distribution

### 1. Create proper package structure:
```
retro-terminal/
├── package.json
├── bin/
│   └── retro-terminal (executable script)
└── lib/
    └── retro-terminal-demo.js
```

### 2. Create `bin/retro-terminal`:
```bash
#!/usr/bin/env node
require('../lib/retro-terminal-demo.js');
```

### 3. Update package.json:
```json
{
  "name": "@yourusername/retro-terminal",
  "version": "1.0.0",
  "bin": {
    "retro-terminal": "./bin/retro-terminal"
  },
  "files": [
    "bin/",
    "lib/"
  ]
}
```

### 4. Publish:
```bash
npm login
npm publish
```

### 5. Users install with:
```bash
npm install -g @yourusername/retro-terminal
retro-terminal
```

## Web Version Build

### Simple standalone HTML:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Retro Terminal Web</title>
    <script src="https://cdn.jsdelivr.net/npm/xterm@5.1.0/lib/xterm.min.js"></script>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.1.0/css/xterm.css">
    <style>
        body {
            margin: 0;
            padding: 20px;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        #terminal-container {
            padding: 20px;
            border: 2px solid #0f0;
            border-radius: 8px;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
            background: #0a0a0a;
        }
    </style>
</head>
<body>
    <div id="terminal-container">
        <div id="terminal"></div>
    </div>
    <script>
        // Initialize xterm.js
        const term = new Terminal({
            cols: 80,
            rows: 30,
            cursorBlink: true,
            theme: {
                background: '#000000',
                foreground: '#00ff00',
                cursor: '#00ff00',
                selection: '#003300'
            },
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: 14
        });
        
        term.open(document.getElementById('terminal'));
        
        // Your retro terminal logic here
        function write(text) {
            term.write(text + '\r\n');
        }
        
        write('╔════════════════════════════════════════╗');
        write('║      RETRO TERMINAL WEB EDITION       ║');
        write('╚════════════════════════════════════════╝');
        write('');
        write('Loading...');
        
        // Add keyboard handling
        term.onKey(({ key, domEvent }) => {
            if (key === 'q' || key === 'Q') {
                write('\r\nThanks for using RETRO TERMINAL!');
            }
        });
    </script>
</body>
</html>
```

## Build Automation Script

Create `build-all.js`:
```javascript
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Create dist directory
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
}

// Build configurations
const builds = [
    { target: 'node18-win-x64', output: 'retro-terminal-win.exe' },
    { target: 'node18-linux-x64', output: 'retro-terminal-linux' },
    { target: 'node18-macos-x64', output: 'retro-terminal-macos' }
];

console.log('🔨 Building Retro Terminal for all platforms...\n');

builds.forEach(({ target, output }) => {
    try {
        console.log(`📦 Building ${target}...`);
        execSync(`pkg retro-terminal-demo.js --target ${target} --output dist/${output}`, {
            stdio: 'inherit'
        });
        console.log(`✅ Built ${output}\n`);
    } catch (error) {
        console.error(`❌ Failed to build ${target}\n`);
    }
});

console.log('🎉 Build complete! Check the dist/ directory.');
```

Run with:
```bash
node build-all.js
```

## Size Comparison

| Method | Size | Pros | Cons |
|--------|------|------|------|
| Raw .js file | ~15KB | Tiny, editable | Needs Node.js |
| PKG executable | ~40MB | No dependencies | Platform specific |
| Electron app | ~100MB+ | Full control | Overkill |
| Web version | ~200KB | Universal | Not "real" terminal |
| NPM package | ~20KB | Easy updates | Needs Node.js |

## Recommended Approach

1. **Primary**: Use PKG for downloadable executables
2. **Developers**: Publish to NPM
3. **Demo**: Host web version on GitHub Pages
4. **Source**: Keep .js files available for hackers

## Final Build Commands

```bash
# One-time setup
npm install -g pkg

# Build everything
pkg retro-terminal-demo.js --out-path dist/

# Test the builds
./dist/retro-terminal-demo-linux      # Linux/Mac
dist\retro-terminal-demo-win.exe     # Windows
```

That's it! Your retro terminal is ready for distribution! 🚀
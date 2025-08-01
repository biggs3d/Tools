#!/usr/bin/env node

/**
 * Retro Terminal Demo
 * A simple ASCII-based terminal UI showcase
 */

// ANSI escape codes for styling
const styles = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  // Colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

// Terminal control
const terminal = {
  clear: () => process.stdout.write('\x1b[2J\x1b[H'),
  moveTo: (x, y) => process.stdout.write(`\x1b[${y};${x}H`),
  hideCursor: () => process.stdout.write('\x1b[?25l'),
  showCursor: () => process.stdout.write('\x1b[?25h'),
  write: (text) => process.stdout.write(text),
};

// Box drawing characters
const box = {
  topLeft: '╔',
  topRight: '╗',
  bottomLeft: '╚',
  bottomRight: '╝',
  horizontal: '═',
  vertical: '║',
  cross: '╬',
  teeTop: '╦',
  teeBottom: '╩',
  teeLeft: '╠',
  teeRight: '╣',
};

// Draw a box with title
function drawBox(x, y, width, height, title = '') {
  terminal.moveTo(x, y);
  
  // Top border
  terminal.write(box.topLeft);
  if (title) {
    const titleStr = `${box.horizontal}[ ${title} ]${box.horizontal}`;
    terminal.write(titleStr);
    terminal.write(box.horizontal.repeat(width - titleStr.length - 2));
  } else {
    terminal.write(box.horizontal.repeat(width - 2));
  }
  terminal.write(box.topRight);
  
  // Sides
  for (let i = 1; i < height - 1; i++) {
    terminal.moveTo(x, y + i);
    terminal.write(box.vertical);
    terminal.moveTo(x + width - 1, y + i);
    terminal.write(box.vertical);
  }
  
  // Bottom border
  terminal.moveTo(x, y + height - 1);
  terminal.write(box.bottomLeft);
  terminal.write(box.horizontal.repeat(width - 2));
  terminal.write(box.bottomRight);
}

// ASCII art banner
const banner = [
  '██████╗ ███████╗████████╗██████╗  ██████╗ ',
  '██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔═══██╗',
  '██████╔╝█████╗     ██║   ██████╔╝██║   ██║',
  '██╔══██╗██╔══╝     ██║   ██╔══██╗██║   ██║',
  '██║  ██║███████╗   ██║   ██║  ██║╚██████╔╝',
  '╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ '
];

// Menu items
const menuItems = [
  { key: '1', label: 'System Status', action: showSystemStatus },
  { key: '2', label: 'Network Monitor', action: showNetworkMonitor },
  { key: '3', label: 'File Browser', action: showFileBrowser },
  { key: '4', label: 'Terminal Chat', action: showTerminalChat },
  { key: 'Q', label: 'Quit', action: quit }
];

// Show system status (mock)
function showSystemStatus() {
  terminal.clear();
  drawBox(2, 2, 60, 20, 'SYSTEM STATUS');
  
  const status = [
    `${styles.green}● ONLINE${styles.reset}`,
    '',
    'CPU Usage:    [████████░░░░░░░░░░░░] 42%',
    'Memory:       [██████████████░░░░░░] 73%',
    'Disk Space:   [████████████░░░░░░░░] 61%',
    '',
    'Uptime:       42 days, 13:37:00',
    'Load Average: 1.23, 1.45, 1.67',
    '',
    `${styles.yellow}Last Update: ${new Date().toLocaleTimeString()}${styles.reset}`
  ];
  
  status.forEach((line, i) => {
    terminal.moveTo(5, 5 + i);
    terminal.write(line);
  });
  
  terminal.moveTo(5, 19);
  terminal.write(`${styles.dim}Press any key to return...${styles.reset}`);
}

// Show network monitor (mock)
function showNetworkMonitor() {
  terminal.clear();
  drawBox(2, 2, 60, 20, 'NETWORK MONITOR');
  
  const connections = [
    'ESTABLISHED  192.168.1.100:22    → 10.0.0.5:45821',
    'LISTENING    0.0.0.0:80          → *:*',
    'TIME_WAIT    192.168.1.100:443   → 8.8.8.8:53',
    'ESTABLISHED  192.168.1.100:3306  → 172.16.0.10:52143'
  ];
  
  terminal.moveTo(5, 5);
  terminal.write('Active Connections:');
  terminal.moveTo(5, 6);
  terminal.write('─'.repeat(50));
  
  connections.forEach((conn, i) => {
    terminal.moveTo(5, 8 + i);
    terminal.write(conn);
  });
  
  // Network stats
  terminal.moveTo(5, 14);
  terminal.write(`${styles.cyan}↓ RX: 1.23 MB/s    ↑ TX: 456 KB/s${styles.reset}`);
  
  terminal.moveTo(5, 19);
  terminal.write(`${styles.dim}Press any key to return...${styles.reset}`);
}

// Show file browser (mock)
function showFileBrowser() {
  terminal.clear();
  drawBox(2, 2, 60, 20, 'FILE BROWSER');
  
  const files = [
    { name: '..', type: 'dir' },
    { name: 'documents', type: 'dir' },
    { name: 'downloads', type: 'dir' },
    { name: 'config.ini', type: 'file', size: '2.1K' },
    { name: 'readme.txt', type: 'file', size: '845B' },
    { name: 'system.log', type: 'file', size: '15.3M' }
  ];
  
  terminal.moveTo(5, 5);
  terminal.write('Current Directory: /home/user');
  terminal.moveTo(5, 6);
  terminal.write('─'.repeat(50));
  
  files.forEach((file, i) => {
    terminal.moveTo(5, 8 + i);
    if (file.type === 'dir') {
      terminal.write(`${styles.blue}[${file.name}]${styles.reset}`);
    } else {
      terminal.write(`${file.name.padEnd(20)} ${styles.dim}${file.size}${styles.reset}`);
    }
  });
  
  terminal.moveTo(5, 19);
  terminal.write(`${styles.dim}Press any key to return...${styles.reset}`);
}

// Show terminal chat (mock)
function showTerminalChat() {
  terminal.clear();
  drawBox(2, 2, 60, 20, 'TERMINAL CHAT');
  
  const messages = [
    { user: 'root', msg: 'System maintenance at 2AM', time: '23:45' },
    { user: 'alice', msg: 'Roger that', time: '23:46' },
    { user: 'bob', msg: 'Backup completed successfully', time: '23:51' },
    { user: 'system', msg: 'CPU temp warning: 78°C', time: '23:55' }
  ];
  
  messages.forEach((msg, i) => {
    terminal.moveTo(5, 5 + i * 2);
    terminal.write(`${styles.green}[${msg.time}] ${styles.cyan}${msg.user}:${styles.reset} ${msg.msg}`);
  });
  
  // Input line
  terminal.moveTo(5, 17);
  terminal.write('─'.repeat(50));
  terminal.moveTo(5, 18);
  terminal.write(`${styles.green}>${styles.reset} _`);
  
  terminal.moveTo(5, 19);
  terminal.write(`${styles.dim}Press any key to return...${styles.reset}`);
}

// Main menu
function showMainMenu() {
  terminal.clear();
  
  // Draw main box
  drawBox(2, 2, 60, 25, 'RETRO TERMINAL v1.0');
  
  // Draw banner
  banner.forEach((line, i) => {
    terminal.moveTo(8, 4 + i);
    terminal.write(`${styles.green}${line}${styles.reset}`);
  });
  
  // Draw menu
  terminal.moveTo(5, 12);
  terminal.write(`${styles.yellow}MAIN MENU${styles.reset}`);
  terminal.moveTo(5, 13);
  terminal.write('─'.repeat(50));
  
  menuItems.forEach((item, i) => {
    terminal.moveTo(5, 15 + i);
    terminal.write(`${styles.bright}${item.key})${styles.reset} ${item.label}`);
  });
  
  // Footer
  terminal.moveTo(5, 23);
  terminal.write(`${styles.dim}Select option: ${styles.reset}`);
  terminal.showCursor();
}

// Quit function
function quit() {
  terminal.clear();
  terminal.moveTo(1, 1);
  terminal.write(`${styles.green}Thanks for using RETRO TERMINAL!${styles.reset}\n`);
  terminal.showCursor();
  process.exit(0);
}

// Input handling
function handleInput(key) {
  const menuItem = menuItems.find(item => item.key.toLowerCase() === key.toLowerCase());
  if (menuItem) {
    terminal.hideCursor();
    menuItem.action();
    
    if (menuItem.key !== 'Q') {
      // Wait for keypress to return to menu
      process.stdin.once('data', () => {
        showMainMenu();
      });
    }
  }
}

// Main program
function main() {
  // Setup terminal
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  
  // Initial display
  showMainMenu();
  
  // Handle input
  process.stdin.on('data', (key) => {
    // Handle Ctrl+C
    if (key === '\u0003') {
      quit();
    }
    
    handleInput(key);
  });
  
  // Cleanup on exit
  process.on('exit', () => {
    terminal.showCursor();
    terminal.clear();
  });
}

// Run the program
main();
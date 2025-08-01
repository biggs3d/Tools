#!/usr/bin/env node

/**
 * Neo-Blessed Retro UI - Using the maintained fork
 */

const blessed = require('neo-blessed');

// Create screen
const screen = blessed.screen({
  smartCSR: true,
  title: 'RETRO TERMINAL v3.0'
});

// Main container
const container = blessed.box({
  parent: screen,
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  style: {
    fg: '#00ff00',
    bg: 'black'
  }
});

// ASCII Banner
const banner = blessed.box({
  parent: container,
  top: 1,
  left: 'center',
  width: 'shrink',
  height: 6,
  content: `
╦═╗╔═╗╔╦╗╦═╗╔═╗  ╔╦╗╔═╗╦═╗╔╦╗
╠╦╝║╣  ║ ╠╦╝║ ║   ║ ║╣ ╠╦╝║║║
╩╚═╚═╝ ╩ ╩╚═╚═╝   ╩ ╚═╝╩╚═╩ ╩
     [ NEO-BLESSED EDITION ]`,
  align: 'center',
  style: {
    fg: '#00ff00',
    bg: 'black'
  }
});

// Menu
const menu = blessed.list({
  parent: container,
  label: '│ COMMAND MENU │',
  top: 8,
  left: 2,
  width: '45%',
  height: 10,
  border: {
    type: 'line',
    fg: '#00ff00'
  },
  items: [
    '1) System Diagnostics',
    '2) Network Status',
    '3) Process Monitor',
    '4) File Manager',
    'Q) Exit System'
  ],
  keys: true,
  vi: true,
  mouse: true,
  style: {
    fg: '#00ff00',
    bg: 'black',
    border: {
      fg: '#00ff00'
    },
    selected: {
      bg: '#003300',
      fg: '#00ff00',
      bold: true
    }
  }
});

// Status display
const statusBox = blessed.box({
  parent: container,
  label: '│ SYSTEM STATUS │',
  top: 8,
  right: 2,
  width: '45%',
  height: 10,
  border: {
    type: 'line',
    fg: '#00ff00'
  },
  padding: 1,
  style: {
    fg: '#00ff00',
    bg: 'black'
  }
});

// Status content
const statusText = blessed.text({
  parent: statusBox,
  top: 0,
  left: 0,
  content: `CPU Load:    42% ████████░░░░░░
Memory:      73% ██████████████
Storage:     61% ████████████░░
Temperature: 65°C [NORMAL]

Network: CONNECTED
Uptime:  42 days, 13:37:00`,
  style: {
    fg: '#00ff00',
    bg: 'black'
  }
});

// Output area
const outputBox = blessed.box({
  parent: container,
  label: '│ OUTPUT │',
  bottom: 0,
  left: 2,
  right: 2,
  height: '30%',
  border: {
    type: 'line',
    fg: '#00ff00'
  },
  padding: 1,
  scrollable: true,
  alwaysScroll: true,
  mouse: true,
  style: {
    fg: '#00ff00',
    bg: 'black'
  }
});

// Output log functionality
let outputContent = [];
function addOutput(text) {
  const timestamp = new Date().toLocaleTimeString();
  outputContent.push(`[${timestamp}] ${text}`);
  if (outputContent.length > 100) {
    outputContent.shift(); // Keep only last 100 lines
  }
  outputBox.setContent(outputContent.join('\n'));
  outputBox.setScrollPerc(100);
  screen.render();
}

// Menu handlers
menu.on('select', (item, index) => {
  switch(index) {
    case 0:
      addOutput('Running system diagnostics...');
      setTimeout(() => {
        addOutput('CPU: OK | Memory: OK | Disk: OK');
        addOutput('All systems operational.');
      }, 1000);
      break;
    case 1:
      addOutput('Checking network status...');
      setTimeout(() => {
        addOutput('Network interface: eth0');
        addOutput('Status: CONNECTED');
        addOutput('Speed: 1000 Mbps');
      }, 500);
      break;
    case 2:
      addOutput('Loading process monitor...');
      break;
    case 3:
      addOutput('Opening file manager...');
      break;
    case 4:
      quit();
      break;
  }
});

// Keyboard shortcuts
screen.key(['1'], () => { menu.select(0); menu.emit('select', null, 0); });
screen.key(['2'], () => { menu.select(1); menu.emit('select', null, 1); });
screen.key(['3'], () => { menu.select(2); menu.emit('select', null, 2); });
screen.key(['4'], () => { menu.select(3); menu.emit('select', null, 3); });
screen.key(['q', 'Q'], quit);
screen.key(['escape', 'C-c'], quit);

// Quit function
function quit() {
  addOutput('System shutdown initiated...');
  setTimeout(() => {
    screen.destroy();
    process.exit(0);
  }, 500);
}

// Initialize
addOutput('System boot complete.');
addOutput('All subsystems initialized.');
addOutput('Ready for input...');

// Simulate some background activity
let activityCounter = 0;
setInterval(() => {
  const activities = [
    'Background scan completed',
    'Cache memory cleared',
    'Temperature check: OK',
    'Network packet received',
    'Watchdog timer reset'
  ];
  if (activityCounter < 20) { // Don't spam forever
    addOutput(activities[Math.floor(Math.random() * activities.length)]);
    activityCounter++;
  }
}, 5000);

// Focus and render
menu.focus();
screen.render();
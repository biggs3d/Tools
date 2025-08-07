#!/usr/bin/env node

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

async function createTestData() {
  const testDir = 'test-data';
  await mkdir(testDir, { recursive: true });
  
  console.log(`📁 Creating test data in ${testDir}/...`);
  
  // Code files
  await writeFile(join(testDir, 'app.js'), `
const express = require('express');
const app = express();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
`.trim());

  await writeFile(join(testDir, 'utils.ts'), `
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function calculateHash(input: string): string {
  // Simple hash function for testing
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}
`.trim());

  // Config files
  await writeFile(join(testDir, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    description: 'Test project for Gemini Bridge',
    main: 'app.js',
    scripts: {
      start: 'node app.js',
      test: 'jest'
    },
    dependencies: {
      express: '^4.18.0'
    }
  }, null, 2));

  // Documentation
  await writeFile(join(testDir, 'README.md'), `
# Test Project

This is a test project for validating the Gemini Bridge MCP server.

## Features

- Express.js API server
- TypeScript utilities
- Comprehensive testing

## Usage

\`\`\`bash
npm install
npm start
\`\`\`

## API Endpoints

- \`GET /api/health\` - Health check endpoint
`.trim());

  // Binary file (simulated)
  const binaryData = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 pixel
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, // Color type, etc.
    0x89, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x44, 0x41, // IDAT chunk start
    0x54, 0x78, 0x9C, 0x62, 0x00, 0x02, 0x00, 0x00, // Minimal PNG data
    0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, // End data
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
    0x42, 0x60, 0x82
  ]);
  await writeFile(join(testDir, 'logo.png'), binaryData);

  // Large text file for optimization testing
  const largeContent = Array(1000).fill('This is a line of text for testing large file handling.\n').join('');
  await writeFile(join(testDir, 'large-file.txt'), largeContent);

  // Mixed file types
  await writeFile(join(testDir, 'config.yaml'), `
app:
  name: test-app
  version: 1.0.0
  debug: true
database:
  host: localhost
  port: 5432
`.trim());

  await writeFile(join(testDir, 'styles.css'), `
body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
  background: #f5f5f5;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
`.trim());

  // Test subdirectory
  const subDir = join(testDir, 'components');
  await mkdir(subDir, { recursive: true });
  
  await writeFile(join(subDir, 'Button.jsx'), `
import React from 'react';

export function Button({ children, onClick, variant = 'primary' }) {
  return (
    <button 
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
`.trim());

  await writeFile(join(subDir, 'Modal.tsx'), `
import React, { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
`.trim());

  console.log('✅ Test data created successfully!');
  console.log('\nCreated files:');
  console.log('- JavaScript/TypeScript files for code analysis');
  console.log('- Configuration files (JSON, YAML)');
  console.log('- Documentation (Markdown)');
  console.log('- Binary file (PNG) for binary detection testing');
  console.log('- Large text file for optimization testing');
  console.log('- React components for frontend analysis');
  console.log('- CSS styles for design analysis');
  console.log(`\nUse these files to test the Gemini Bridge tools manually.`);
}

createTestData().catch(console.error);
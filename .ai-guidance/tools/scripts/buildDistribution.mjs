#!/usr/bin/env node
//@ts-check

import { execSync } from 'child_process';
import { cpSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import commandLineArgs from 'command-line-args';

const distPathFlagName = 'dist-path';
const composeFileFlagName = 'compose-file';
const options = commandLineArgs([
    { name: distPathFlagName, type: String, defaultValue: './distribution' },
    { name: composeFileFlagName, alias: 'f', type: String, multiple: true }
]);

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectPath = resolve(__dirname, '../..');
const distributionPath = resolve(projectPath, options[distPathFlagName]);
const distributionScriptsPath = resolve(distributionPath, 'scripts');

console.log('Building CWMI HMI Distribution...');

// Step 1: Generate model
console.log('Generating model...');
execSync('npm run generate-model', { cwd: projectPath, stdio: 'inherit' });

// Step 2: Build all workspaces
console.log('Building all workspaces...');
execSync('npm run build', { cwd: projectPath, stdio: 'inherit' });

// Step 3: Run the build-distribution command with compose files
console.log('Running build-distribution...');
let buildDistributionCmd = 'npx build-distribution';
buildDistributionCmd += ` --dist-path=${options[distPathFlagName]}`;

// Add default compose files
buildDistributionCmd += ' --compose-file=./client/tools/docker/compose.client.override.yml';
buildDistributionCmd += ' --compose-file=./server/tools/docker/compose.server.override.yml';

// Add additional compose files if provided
if (options[composeFileFlagName]) {
    for (const composeFile of options[composeFileFlagName]) {
        buildDistributionCmd += ` --compose-file=${composeFile}`;
    }
}

execSync(buildDistributionCmd, { cwd: projectPath, stdio: 'inherit' });

// Step 4: Copy shell scripts to distribution folder
console.log('Copying shell scripts to distribution...');
mkdirSync(distributionScriptsPath, { recursive: true });

const scriptsSourcePath = resolve(__dirname);
cpSync(resolve(scriptsSourcePath, 'loadImages.sh'), resolve(distributionScriptsPath, 'loadImages.sh'));
cpSync(resolve(scriptsSourcePath, 'runDistribution.sh'), resolve(distributionScriptsPath, 'runDistribution.sh'));

console.log('Distribution build completed successfully!');
console.log(`Distribution created at: ${distributionPath}`);
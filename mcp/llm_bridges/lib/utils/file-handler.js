import { readFile, readdir, stat, open } from 'fs/promises';
import { join, extname, relative, resolve, normalize } from 'path';
import { platform } from 'os';
import micromatch from 'micromatch';
import { CONFIG } from '../config.js';

// Normalize path for cross-platform compatibility
export function normalizePath(filePath) {
    // Handle WSL paths
    if (platform() === 'linux' && filePath.match(/^[A-Za-z]:[\\\/]/)) {
        // Convert Windows path to WSL path: C:\path → /mnt/c/path
        const driveLetter = filePath[0].toLowerCase();
        const pathWithoutDrive = filePath.slice(2).replace(/\\/g, '/');
        return `/mnt/${driveLetter}${pathWithoutDrive}`;
    }
    
    // Normalize slashes
    return normalize(filePath).replace(/\\/g, '/');
}

// Check if file is binary
export async function isBinaryFile(filePath) {
    try {
        const handle = await open(filePath, 'r');
        const buffer = Buffer.alloc(CONFIG.fileDiscovery.binaryCheckBytes);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        await handle.close();
        
        if (bytesRead === 0) return false;
        
        // Check for null bytes (common in binary files)
        for (let i = 0; i < bytesRead; i++) {
            if (buffer[i] === 0) return true;
        }
        
        // Check if file is mostly non-printable characters
        let nonPrintable = 0;
        for (let i = 0; i < bytesRead; i++) {
            const byte = buffer[i];
            if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
                nonPrintable++;
            }
        }
        
        return nonPrintable / bytesRead > 0.3;
    } catch (error) {
        return true; // Assume binary if we can't read it
    }
}

// Check if file should be excluded
export function shouldExcludeFile(filePath) {
    const ext = extname(filePath).toLowerCase();
    
    // Force include certain text files
    if (CONFIG.fileDiscovery.forceTextExtensions.includes(ext)) {
        return false;
    }
    
    // Exclude binary extensions
    return CONFIG.fileDiscovery.excludedExtensions.includes(ext);
}

// Check if directory should be excluded
export function shouldExcludeDir(dirName) {
    return CONFIG.fileDiscovery.excludedDirs.includes(dirName);
}

// Find files matching patterns
export async function findFiles(patterns, basePath = process.cwd()) {
    const normalizedBase = normalizePath(basePath);
    const allFiles = await collectAllFiles(normalizedBase);
    
    // If no patterns, return all files
    if (!patterns || patterns.length === 0) {
        return allFiles;
    }
    
    // Match files against patterns
    const normalizedPatterns = patterns.map(p => normalizePath(p));
    return micromatch(allFiles, normalizedPatterns, {
        cwd: normalizedBase,
        absolute: true,
    });
}

// Recursively collect all files in a directory
async function collectAllFiles(dirPath, depth = 0) {
    if (depth > CONFIG.fileDiscovery.maxRecursionDepth) {
        return [];
    }
    
    const files = [];
    
    try {
        const entries = await readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = join(dirPath, entry.name);
            
            if (entry.isDirectory()) {
                if (!shouldExcludeDir(entry.name)) {
                    const subFiles = await collectAllFiles(fullPath, depth + 1);
                    files.push(...subFiles);
                }
            } else if (entry.isFile()) {
                if (!shouldExcludeFile(fullPath)) {
                    files.push(fullPath);
                }
            }
        }
    } catch (error) {
        console.warn(`Failed to read directory ${dirPath}: ${error.message}`);
    }
    
    return files;
}

// Collect file contents with metadata
export async function collectFiles(filePaths) {
    const files = [];
    
    for (const filePath of filePaths) {
        try {
            const normalizedPath = normalizePath(filePath);
            const resolvedPath = resolve(normalizedPath);
            
            // Check file stats
            const stats = await stat(resolvedPath);
            
            if (!stats.isFile()) {
                console.warn(`Skipping non-file: ${filePath}`);
                continue;
            }
            
            if (stats.size > CONFIG.shared.maxFileSize) {
                console.warn(`Skipping large file (${stats.size} bytes): ${filePath}`);
                continue;
            }
            
            // Check if binary
            if (await isBinaryFile(resolvedPath)) {
                console.warn(`Skipping binary file: ${filePath}`);
                continue;
            }
            
            // Read file content
            const content = await readFile(resolvedPath, 'utf-8');
            
            files.push({
                path: normalizedPath,
                content,
                size: stats.size,
                extension: extname(filePath).toLowerCase(),
            });
        } catch (error) {
            console.warn(`Failed to read file ${filePath}: ${error.message}`);
        }
    }
    
    return files;
}
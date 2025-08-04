import { readFile, readdir, stat, open, realpath } from 'fs/promises';
import { join, extname, relative, resolve, normalize, isAbsolute } from 'path';
import { platform } from 'os';
import micromatch from 'micromatch';
import { CONFIG } from '../config.js';
import { BridgeError } from './error-handler.js';

// Normalize path for cross-platform compatibility
export function normalizePath(filePath) {
    // Handle Windows UNC paths first
    if (platform() === 'win32' && filePath.startsWith('\\\\')) {
        // UNC path - normalize slashes but preserve format
        return filePath.replace(/\\/g, '/');
    }
    
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
    let handle;
    try {
        handle = await open(filePath, 'r');
        const buffer = Buffer.alloc(CONFIG.fileDiscovery.binaryCheckBytes);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        
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
    } finally {
        if (handle) await handle.close().catch(() => {});
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
        nocase: platform() === 'win32' || platform() === 'darwin'
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
                    files.push(normalizePath(fullPath));
                }
            } else if (entry.isSymbolicLink()) {
                // Handle symlinks based on configuration
                if (CONFIG.fileDiscovery.followSymlinks) {
                    try {
                        const targetPath = await realpath(fullPath);
                        const targetStat = await stat(targetPath);
                        
                        if (targetStat.isFile() && !shouldExcludeFile(targetPath)) {
                            files.push(normalizePath(fullPath));
                        } else if (targetStat.isDirectory() && !shouldExcludeDir(entry.name)) {
                            const subFiles = await collectAllFiles(fullPath, depth + 1);
                            files.push(...subFiles);
                        }
                    } catch (error) {
                        console.warn(`Failed to resolve symlink ${fullPath}: ${error.message}`);
                    }
                } else {
                    console.warn(`Skipping symbolic link: ${fullPath}`);
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
    // Check file count limit
    if (filePaths.length > CONFIG.shared.maxFilesPerRequest) {
        throw new BridgeError(
            `Too many files: ${filePaths.length} files exceeds limit of ${CONFIG.shared.maxFilesPerRequest}`,
            'quota',
            `Please reduce the number of files to ${CONFIG.shared.maxFilesPerRequest} or less`
        );
    }
    
    const files = [];
    const projectRoot = process.cwd();
    
    for (const filePath of filePaths) {
        try {
            const normalizedPath = normalizePath(filePath);
            const resolvedPath = resolve(normalizedPath);
            
            // Handle symlinks by resolving to real path
            const realPath = await realpath(resolvedPath).catch(() => resolvedPath);
            
            // Security: Ensure real path is within project root
            const relativePath = relative(projectRoot, realPath);
            // If relative path starts with .. it's outside project root
            // Empty relative path means current directory which is OK
            if (!CONFIG.shared.allowExternalFiles && relativePath.startsWith('..')) {
                console.warn(`Skipping file outside project directory: ${filePath}`);
                continue;
            }
            
            // Additional check: ensure real path starts with project root
            // Handle case-insensitive filesystems on Windows/macOS
            const normalizedRoot = normalize(projectRoot);
            const normalizedReal = normalize(realPath);
            const isWindows = platform() === 'win32';
            const isMacOS = platform() === 'darwin';
            
            if (!CONFIG.shared.allowExternalFiles) {
                if (isWindows || isMacOS) {
                    // Case-insensitive comparison
                    if (!normalizedReal.toLowerCase().startsWith(normalizedRoot.toLowerCase())) {
                        console.warn(`Skipping file outside project directory: ${filePath}`);
                        continue;
                    }
                } else {
                    // Case-sensitive comparison for Linux
                    if (!normalizedReal.startsWith(normalizedRoot)) {
                        console.warn(`Skipping file outside project directory: ${filePath}`);
                        continue;
                    }
                }
            }
            
            // Check file stats on the real path
            const stats = await stat(realPath);
            
            if (!stats.isFile()) {
                console.warn(`Skipping non-file: ${filePath}`);
                continue;
            }
            
            if (stats.size > CONFIG.shared.maxFileSize) {
                console.warn(`Skipping large file (${stats.size} bytes): ${filePath}`);
                continue;
            }
            
            // Check if binary
            if (await isBinaryFile(realPath)) {
                console.warn(`Skipping binary file: ${filePath}`);
                continue;
            }
            
            // Read file content from real path
            const content = await readFile(realPath, 'utf-8');
            
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
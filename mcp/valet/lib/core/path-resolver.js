import { resolve, join, normalize } from 'path';
import { homedir, platform } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class PathResolver {
  constructor() {
    this.valetPath = null;
  }

  resolveValetPath() {
    if (this.valetPath) {
      return this.valetPath;
    }

    // First check for environment variable
    if (process.env.VALET_PATH) {
      this.valetPath = this.normalizePath(resolve(process.env.VALET_PATH));
      return this.valetPath;
    }

    // Try to find valet-data directory, prioritizing local directory
    const possiblePaths = [
      // Local valet-data directory within MCP server (preferred)
      resolve(__dirname, '../../valet-data'),
      // Legacy paths for backward compatibility
      resolve(__dirname, '../../../valet/valet-client'),
      join(homedir(), 'valet', 'valet-client'),
      resolve(process.cwd(), 'valet-client'),
      resolve(process.cwd(), '..', 'valet-client'),
    ];

    // Use the first path by default (local valet-data), normalized
    this.valetPath = this.normalizePath(possiblePaths[0]);
    return this.valetPath;
  }

  getDayPath(date) {
    return join(this.resolveValetPath(), 'days', `${date}.md`);
  }

  getPlannerPath(date) {
    return join(this.resolveValetPath(), 'days', `${date}-planner.json`);
  }

  getJournalPath(date) {
    return join(this.resolveValetPath(), 'days', `${date}-journal.json`);
  }

  getTodoPath() {
    return join(this.resolveValetPath(), '_global_todo.json');
  }

  getSettingsPath() {
    return join(this.resolveValetPath(), 'settings.json');
  }

  getUserPath() {
    return join(this.resolveValetPath(), 'USER.md');
  }

  getArchivePath() {
    return join(this.resolveValetPath(), 'archive');
  }

  getDaysPath() {
    return join(this.resolveValetPath(), 'days');
  }

  isValidDate(dateString) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(dateString) && !isNaN(new Date(dateString).getTime());
  }

  validatePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path: must be a non-empty string');
    }
    
    // Prevent path traversal attacks
    if (filePath.includes('..') || filePath.includes('\0')) {
      throw new Error('Invalid file path: contains illegal characters');
    }
    
    // Prevent access to sensitive system files
    const normalizedLower = filePath.toLowerCase();
    const sensitivePatterns = ['/etc/passwd', '/etc/shadow', 'windows/system32', '.ssh/', '.env'];
    if (sensitivePatterns.some(pattern => normalizedLower.includes(pattern))) {
      throw new Error('Access denied: cannot read sensitive system files');
    }
    
    return filePath;
  }

  normalizePath(filePath) {
    if (!filePath) return filePath;
    
    // Validate first for security
    this.validatePath(filePath);

    // Handle WSL paths when called from Windows
    if (platform() === 'win32' && filePath.startsWith('/mnt/')) {
      // Convert /mnt/c/path to C:/path
      const match = filePath.match(/^\/mnt\/([a-z])\/(.*)/i);
      if (match) {
        return `${match[1].toUpperCase()}:/${match[2]}`;
      }
    }

    // Handle Windows paths when called from WSL
    if (platform() !== 'win32' && /^[A-Z]:/i.test(filePath)) {
      // Convert C:/path to /mnt/c/path
      const match = filePath.match(/^([A-Z]):\/(.*)/i);
      if (match) {
        return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, '/')}`;
      }
    }

    // Normalize slashes
    return normalize(filePath).replace(/\\/g, '/');
  }

  sanitizePath(path) {
    // Enhanced path sanitization using the new validation
    return this.normalizePath(path);
  }
}
import { readFile, writeFile, access, mkdir, stat } from 'fs/promises';
import { constants } from 'fs';
import { dirname } from 'path';

export class FileHandler {
  constructor() {
    this.cache = new Map();
    this.cacheExpiry = new Map();
  }

  async ensureDirectory(path) {
    try {
      await mkdir(path, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  async fileExists(path) {
    try {
      await access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async readFileContent(path, useCache = true) {
    const cacheKey = `file:${path}`;
    
    if (useCache && this.cache.has(cacheKey)) {
      const expiry = this.cacheExpiry.get(cacheKey);
      if (expiry && Date.now() < expiry) {
        return this.cache.get(cacheKey);
      }
    }

    try {
      const content = await readFile(path, 'utf8');
      
      if (useCache) {
        this.cache.set(cacheKey, content);
        this.cacheExpiry.set(cacheKey, Date.now() + 30000); // 30 second cache
      }
      
      return content;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist
      }
      throw error;
    }
  }

  async writeFileContent(path, content, options = {}) {
    // Ensure directory exists
    await this.ensureDirectory(dirname(path));
    
    try {
      await writeFile(path, content, 'utf8');
      
      // Invalidate cache
      const cacheKey = `file:${path}`;
      this.cache.delete(cacheKey);
      this.cacheExpiry.delete(cacheKey);
      
      return true;
    } catch (error) {
      throw new Error(`Failed to write file ${path}: ${error.message}`);
    }
  }

  async getFileStats(path) {
    try {
      return await stat(path);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  parseMarkdownSections(content) {
    const sections = {};
    const lines = content.split('\n');
    let currentSection = null;
    let currentContent = [];

    for (const line of lines) {
      // Check for section headers (## Section Name)
      if (line.startsWith('## ')) {
        // Save previous section
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n').trim();
        }
        
        // Start new section
        currentSection = line.substring(3).trim().toLowerCase().replace(/\s+/g, '_');
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Save last section
    if (currentSection) {
      sections[currentSection] = currentContent.join('\n').trim();
    }

    return sections;
  }

  buildMarkdownFromSections(sections, template = null) {
    if (template) {
      // Use template to maintain structure
      let content = template;
      for (const [key, value] of Object.entries(sections)) {
        const sectionHeader = `## ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
        const regex = new RegExp(`(${sectionHeader}\\s*\\n)([\\s\\S]*?)(?=\\n## |$)`, 'g');
        content = content.replace(regex, `$1${value}\n\n`);
      }
      return content;
    }

    // Build from sections directly
    let content = '';
    for (const [key, value] of Object.entries(sections)) {
      const sectionHeader = `## ${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
      content += `${sectionHeader}\n\n${value}\n\n`;
    }
    return content;
  }

  clearCache() {
    this.cache.clear();
    this.cacheExpiry.clear();
  }

  sanitizeContent(content) {
    // Basic content sanitization
    return content
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\u0000/g, '') // Remove null bytes
      .trim();
  }
}
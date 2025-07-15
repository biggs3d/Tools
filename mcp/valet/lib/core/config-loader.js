import { readFile } from 'fs/promises';
import { join } from 'path';
import { PathResolver } from './path-resolver.js';

export class ConfigLoader {
  constructor() {
    this.config = null;
    this.pathResolver = new PathResolver();
  }

  async load() {
    try {
      const valetPath = this.pathResolver.resolveValetPath();
      const settingsPath = join(valetPath, 'settings.json');
      
      const content = await readFile(settingsPath, 'utf8');
      this.config = JSON.parse(content);
      
      // Add default MCP settings if not present
      if (!this.config.mcp) {
        this.config.mcp = {
          cache_ttl: 300,
          max_response_size: 50000,
          enable_compression: true,
          audit_log: true,
          rate_limits: {
            requests_per_minute: 60,
            embeddings_per_hour: 100
          }
        };
      }
      
      return this.config;
    } catch (error) {
      // If settings.json doesn't exist, create default config
      this.config = {
        version: "1.0.0",
        user: {
          name: "User",
          timezone: "UTC"
        },
        mcp: {
          cache_ttl: 300,
          max_response_size: 50000,
          enable_compression: true,
          audit_log: true,
          rate_limits: {
            requests_per_minute: 60,
            embeddings_per_hour: 100
          }
        },
        embeddings: {
          enabled: true,
          similarity_threshold: 0.7
        },
        git_monitoring: {
          enabled: false,
          include_in_briefing: false
        },
        languages: {
          spanish: {
            enabled: false,
            frequency: "occasional"
          }
        }
      };
      
      return this.config;
    }
  }

  get(key) {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config[key];
  }

  getAll() {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }
    return this.config;
  }
}
/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.19
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadDatabaseConfig, DatabaseType } from './config.js';
import { ConfigurationError } from './utils/error.utils.js';

describe('Config', () => {
    // Save the original process.env
    const originalEnv = { ...process.env };
    
    beforeEach(() => {
        // Clear environment variables before each test
        vi.resetModules();
        process.env = { ...originalEnv };
    });
    
    afterEach(() => {
        // Restore environment variables after each test
        process.env = originalEnv;
    });
    
    it('should default to InMemory provider', () => {
        // No environment variables set
        const config = loadDatabaseConfig();
        
        expect(config.type).toBe(DatabaseType.InMemory);
    });
    
    it('should configure InMemory provider from environment variables', () => {
        process.env.DATABASE_TYPE = 'in-memory';
        process.env.DATABASE_LOG_LEVEL = 'debug';
        
        const config = loadDatabaseConfig();
        
        expect(config.type).toBe(DatabaseType.InMemory);
        expect(config.logging?.level).toBe('debug');
    });
    
    it('should configure JsonFile provider from environment variables', () => {
        process.env.DATABASE_TYPE = 'json-file';
        process.env.DATABASE_JSON_FILE_DIRECTORY = '/tmp/test-json-db';
        process.env.DATABASE_JSON_FILE_USE_SINGLE_FILE = 'true';
        process.env.DATABASE_JSON_FILE_PRETTY_PRINT = 'true';
        process.env.DATABASE_JSON_FILE_WRITE_DEBOUNCE_MS = '500';
        
        const config = loadDatabaseConfig();
        
        expect(config.type).toBe(DatabaseType.JsonFile);
        expect(config.providerConfig?.jsonFile).toBeDefined();
        expect(config.providerConfig?.jsonFile?.directoryPath).toBe('/tmp/test-json-db');
        expect(config.providerConfig?.jsonFile?.useSingleFile).toBe(true);
        expect(config.providerConfig?.jsonFile?.prettyPrint).toBe(true);
        expect(config.providerConfig?.jsonFile?.writeDebounceMs).toBe(500);
    });
    
    it('should throw ConfigurationError when JsonFile provider is missing required config', () => {
        process.env.DATABASE_TYPE = 'json-file';
        // Missing DATABASE_JSON_FILE_DIRECTORY
        
        expect(() => {
            loadDatabaseConfig();
        }).toThrow(ConfigurationError);
    });
    
    it('should throw ConfigurationError for invalid database type', () => {
        process.env.DATABASE_TYPE = 'invalid-type';
        
        expect(() => {
            loadDatabaseConfig();
        }).toThrow(ConfigurationError);
    });
    
    it('should configure SQLite provider from environment variables', () => {
        process.env.DATABASE_TYPE = 'sqlite';
        process.env.DATABASE_SQLITE_FILE_PATH = '/tmp/test.db';
        
        const config = loadDatabaseConfig();
        
        expect(config.type).toBe(DatabaseType.SQLite);
        expect(config.providerConfig?.sqlite).toBeDefined();
        expect(config.providerConfig?.sqlite?.filePath).toBe('/tmp/test.db');
    });
    
    it('should throw ConfigurationError when SQLite provider is missing required config', () => {
        process.env.DATABASE_TYPE = 'sqlite';
        // Missing DATABASE_SQLITE_FILE_PATH
        
        expect(() => {
            loadDatabaseConfig();
        }).toThrow(ConfigurationError);
    });
    
    it('should configure MongoDB provider from environment variables', () => {
        process.env.DATABASE_TYPE = 'mongodb';
        process.env.DATABASE_MONGODB_CONNECTION_STRING = 'mongodb://localhost:27017';
        process.env.DATABASE_MONGODB_DATABASE_NAME = 'test-db';
        process.env.DATABASE_MONGODB_OPTIONS = '{"retryWrites":true}';
        
        const config = loadDatabaseConfig();
        
        expect(config.type).toBe(DatabaseType.MongoDB);
        expect(config.providerConfig?.mongoDB).toBeDefined();
        expect(config.providerConfig?.mongoDB?.connectionString).toBe('mongodb://localhost:27017');
        expect(config.providerConfig?.mongoDB?.databaseName).toBe('test-db');
        expect(config.providerConfig?.mongoDB?.options).toEqual({ retryWrites: true });
    });
    
    it('should throw ConfigurationError when MongoDB provider is missing required config', () => {
        process.env.DATABASE_TYPE = 'mongodb';
        // Missing CONNECTION_STRING and DATABASE_NAME
        
        expect(() => {
            loadDatabaseConfig();
        }).toThrow(ConfigurationError);
    });
    
    it('should configure GitSync provider from environment variables', () => {
        process.env.DATABASE_TYPE = 'git-sync';
        process.env.DATABASE_GITSYNC_REPO_PATH = '/tmp/repo';
        process.env.DATABASE_GITSYNC_BASE_PROVIDER = 'json-file';
        process.env.DATABASE_GITSYNC_BASE_PROVIDER_CONFIG = '{"directoryPath":"/tmp/repo/data"}';
        process.env.DATABASE_GITSYNC_REMOTE = 'origin';
        process.env.DATABASE_GITSYNC_BRANCH = 'main';
        process.env.DATABASE_GITSYNC_INTERVAL = '300000';
        process.env.DATABASE_GITSYNC_AUTO_COMMIT = 'true';
        process.env.DATABASE_GITSYNC_AUTO_SYNC = 'true';
        process.env.DATABASE_GITSYNC_AUTHOR_NAME = 'Test User';
        process.env.DATABASE_GITSYNC_AUTHOR_EMAIL = 'test@example.com';
        process.env.DATABASE_GITSYNC_CONFLICT_STRATEGY = 'merge';
        
        const config = loadDatabaseConfig();
        
        expect(config.type).toBe(DatabaseType.GitSync);
        expect(config.providerConfig?.gitSync).toBeDefined();
        expect(config.providerConfig?.gitSync?.repositoryPath).toBe('/tmp/repo');
        expect(config.providerConfig?.gitSync?.baseProviderType).toBe('json-file');
        expect(config.providerConfig?.gitSync?.baseProviderConfig).toEqual({ directoryPath: '/tmp/repo/data' });
        expect(config.providerConfig?.gitSync?.syncOptions?.remote).toBe('origin');
        expect(config.providerConfig?.gitSync?.syncOptions?.branch).toBe('main');
        expect(config.providerConfig?.gitSync?.syncOptions?.interval).toBe(300000);
        expect(config.providerConfig?.gitSync?.syncOptions?.autoCommit).toBe(true);
        expect(config.providerConfig?.gitSync?.syncOptions?.autoSync).toBe(true);
        expect(config.providerConfig?.gitSync?.syncOptions?.author?.name).toBe('Test User');
        expect(config.providerConfig?.gitSync?.syncOptions?.author?.email).toBe('test@example.com');
        expect(config.providerConfig?.gitSync?.conflictStrategy).toBe('merge');
    });
    
    it('should throw ConfigurationError when GitSync provider is missing required config', () => {
        process.env.DATABASE_TYPE = 'git-sync';
        // Missing REPO_PATH and BASE_PROVIDER
        
        expect(() => {
            loadDatabaseConfig();
        }).toThrow(ConfigurationError);
    });
});
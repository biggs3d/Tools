/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.19
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect } from 'vitest';
import { DatabaseProviderFactory } from './factory.js';
import { IDatabaseConfig, DatabaseType } from './config.js';
import { InMemoryProvider } from './providers/in-memory.provider.js';
import { JsonFileProvider } from './providers/json-file.provider.js';
import { SQLiteProvider } from './providers/sqlite.provider.js';
import { MongoDBProvider } from './providers/mongodb.provider.js';
import { IndexedDBProvider } from './providers/indexeddb.provider.js';
import { GitSyncProvider } from './providers/git-sync.provider.js';
import { ConfigurationError } from './utils/error.utils.js';

describe('DatabaseProviderFactory', () => {
    it('should create an InMemoryProvider when type is in-memory', () => {
        const config: IDatabaseConfig = {
            type: DatabaseType.InMemory
        };
        
        const provider = DatabaseProviderFactory.createProvider(config);
        expect(provider).toBeInstanceOf(InMemoryProvider);
    });
    
    it('should create a JsonFileProvider when type is json-file', () => {
        const config: IDatabaseConfig = {
            type: DatabaseType.JsonFile,
            providerConfig: {
                jsonFile: {
                    directoryPath: '/tmp/test-dir'
                }
            }
        };
        
        const provider = DatabaseProviderFactory.createProvider(config);
        expect(provider).toBeInstanceOf(JsonFileProvider);
    });
    
    it('should throw ConfigurationError when creating JsonFileProvider without config', () => {
        const config: IDatabaseConfig = {
            type: DatabaseType.JsonFile
        };
        
        expect(() => {
            DatabaseProviderFactory.createProvider(config);
        }).toThrow(ConfigurationError);
    });
    
    it('should create a SQLiteProvider when type is sqlite', () => {
        const config: IDatabaseConfig = {
            type: DatabaseType.SQLite,
            providerConfig: {
                sqlite: {
                    filePath: '/tmp/test.db'
                }
            }
        };
        
        const provider = DatabaseProviderFactory.createProvider(config);
        expect(provider).toBeInstanceOf(SQLiteProvider);
    });

    it('should create a MongoDBProvider when type is mongodb', () => {
        const config: IDatabaseConfig = {
            type: DatabaseType.MongoDB,
            providerConfig: {
                mongodb: {
                    uri: 'mongodb://localhost:27017',
                    databaseName: 'test-db'
                }
            }
        };
        
        const provider = DatabaseProviderFactory.createProvider(config);
        expect(provider).toBeInstanceOf(MongoDBProvider);
    });

    it('should create an IndexedDBProvider when type is indexeddb', () => {
        const config: IDatabaseConfig = {
            type: DatabaseType.IndexedDB,
            providerConfig: {
                indexeddb: {
                    databaseName: 'test-db',
                    version: 1
                }
            }
        };
        
        const provider = DatabaseProviderFactory.createProvider(config);
        expect(provider).toBeInstanceOf(IndexedDBProvider);
    });

    it('should create a GitSyncProvider when type is git-sync', () => {
        const config: IDatabaseConfig = {
            type: DatabaseType.GitSync,
            providerConfig: {
                gitSync: {
                    repositoryPath: '/tmp/git-repo',
                    baseProviderConfig: {
                        type: DatabaseType.JsonFile,
                        providerConfig: {
                            jsonFile: {
                                directoryPath: '/tmp/git-repo/data'
                            }
                        }
                    }
                }
            }
        };
        
        const provider = DatabaseProviderFactory.createProvider(config);
        expect(provider).toBeInstanceOf(GitSyncProvider);
    });
    
    it('should throw ConfigurationError for undefined configuration', () => {
        expect(() => {
            DatabaseProviderFactory.createProvider(undefined as any);
        }).toThrow(ConfigurationError);
    });
    
    it('should throw ConfigurationError for missing type', () => {
        const config = {} as IDatabaseConfig;
        
        expect(() => {
            DatabaseProviderFactory.createProvider(config);
        }).toThrow(ConfigurationError);
    });
});
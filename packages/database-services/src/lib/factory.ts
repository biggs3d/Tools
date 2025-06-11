import { IDatabaseProvider } from './database-provider.interface.js';
import { IDatabaseConfig, DatabaseType } from './config.js';
import { InMemoryProvider } from './providers/in-memory.provider.js';
import { JsonFileProvider } from './providers/json-file.provider.js';
import { SQLiteProvider } from './providers/sqlite.provider.js';
import { MongoDBProvider } from './providers/mongodb.provider.js';
import { IndexedDBProvider } from './providers/indexeddb.provider.js';
import { GitSyncProvider } from './providers/git-sync.provider.js';
import { ConfigurationError } from './utils/error.utils.js';
import { configureLogger } from './utils/logging.utils.js';

/**
 * Factory for creating database provider instances
 */
export class DatabaseProviderFactory {
    /**
     * Create a database provider instance based on configuration
     * @param config Database configuration
     * @returns An instance of IDatabaseProvider
     */
    static createProvider(config: IDatabaseConfig): IDatabaseProvider {
        if (!config || !config.type) {
            throw new ConfigurationError('Database configuration or type is missing');
        }
        
        // Configure logging if specified
        if (config.logging) {
            configureLogger({
                level: config.logging.level
            });
        }
        
        // Create the appropriate provider based on the type
        switch (config.type) {
        case DatabaseType.InMemory:
            return new InMemoryProvider();
                
        case DatabaseType.JsonFile:
            if (!config.providerConfig?.jsonFile) {
                throw new ConfigurationError('JsonFileProvider configuration is missing');
            }
            return new JsonFileProvider(config.providerConfig.jsonFile);
                
        case DatabaseType.SQLite:
            if (!config.providerConfig?.sqlite) {
                throw new ConfigurationError('SQLiteProvider configuration is missing');
            }
            return new SQLiteProvider(config.providerConfig.sqlite);
                
        case DatabaseType.MongoDB:
            if (!config.providerConfig?.mongoDB) {
                throw new ConfigurationError('MongoDBProvider configuration is missing');
            }
            return new MongoDBProvider(config.providerConfig.mongoDB);
                
        case DatabaseType.IndexedDB:
            if (!config.providerConfig?.indexedDB) {
                throw new ConfigurationError('IndexedDBProvider configuration is missing');
            }
            return new IndexedDBProvider(config.providerConfig.indexedDB);
                
        case DatabaseType.GitSync: {
            const gitSyncConfig = config.providerConfig?.gitSync;
            if (!gitSyncConfig) {
                throw new ConfigurationError('GitSyncProvider configuration is missing');
            }
                
            // Create a base provider configuration
            const baseProviderConfig: IDatabaseConfig = {
                type: gitSyncConfig.baseProviderType,
                logging: config.logging,
                providerConfig: {}
            };
                
            // Copy the base provider configuration
            if (gitSyncConfig.baseProviderConfig) {
                baseProviderConfig.providerConfig = {
                    [gitSyncConfig.baseProviderType]: gitSyncConfig.baseProviderConfig
                };
            }
                
            // Create the base provider
            const baseProvider = DatabaseProviderFactory.createProvider(baseProviderConfig);
                
            // Create the GitSyncProvider with the base provider
            return new GitSyncProvider(gitSyncConfig, baseProvider);
        }
                
        default:
            throw new ConfigurationError(`Unsupported database type: ${config.type}`);
        }
    }
}
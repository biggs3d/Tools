/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.17
 * https://github.com/biggs3d/McpMemoryServer
 */

import { DatabaseService } from './database.service.js';
import { IDatabaseProvider, QueryOptions } from './database-provider.interface.js';
import { 
    DatabaseError, 
    ConnectionError, 
    QueryError, 
    NotFoundError, 
    ConfigurationError,
    UnsupportedOperationError,
    TransactionError
} from './utils/error.utils.js';
import { 
    DatabaseType, 
    IDatabaseConfig, 
    loadDatabaseConfig,
    SQLiteProviderConfig,
    MongoDBProviderConfig,
    IndexedDBProviderConfig,
    GitSyncProviderConfig
} from './config.js';
import { DatabaseProviderFactory } from './factory.js';
import { InMemoryProvider } from './providers/in-memory.provider.js';
import { JsonFileProvider, JsonFileProviderConfig } from './providers/json-file.provider.js';
import { SQLiteProvider, SQLiteColumnDefinition, SQLiteIndexDefinition, SQLiteSchemaDefinition } from './providers/sqlite.provider.js';
import { MongoDBProvider } from './providers/mongodb.provider.js';
import { IndexedDBProvider, MigrationHandler } from './providers/indexeddb.provider.js';
import { GitSyncProvider, SyncError, MergeConflictError } from './providers/git-sync.provider.js';
import { 
    LogLevel, 
    logDebug, 
    logInfo, 
    logWarn, 
    logError, 
    configureLogger 
} from './utils/logging.utils.js';

/**
 * Main entry point for the database-services package.
 * Creates and returns a DatabaseService instance.
 */
export function createDatabaseService(config?: IDatabaseConfig): DatabaseService {
    return new DatabaseService(config);
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use createDatabaseService instead
 */
export function databaseServices(): string {
    return 'database-services';
}

// Export all modules for advanced usage
export {
    // Main service
    DatabaseService,
    
    // Interface and options
    type IDatabaseProvider,
    type QueryOptions,
    
    // Errors
    DatabaseError,
    ConnectionError,
    QueryError,
    NotFoundError,
    ConfigurationError,
    UnsupportedOperationError,
    TransactionError,
    SyncError,
    MergeConflictError,
    
    // Configuration
    DatabaseType,
    type IDatabaseConfig,
    loadDatabaseConfig,
    
    // Factory
    DatabaseProviderFactory,
    
    // Providers
    InMemoryProvider,
    JsonFileProvider,
    type JsonFileProviderConfig,
    
    SQLiteProvider,
    type SQLiteProviderConfig,
    type SQLiteColumnDefinition,
    type SQLiteIndexDefinition,
    type SQLiteSchemaDefinition,
    
    MongoDBProvider,
    type MongoDBProviderConfig,
    
    IndexedDBProvider,
    type IndexedDBProviderConfig,
    type MigrationHandler,
    
    GitSyncProvider,
    type GitSyncProviderConfig,
    
    // Logging
    LogLevel,
    logDebug,
    logInfo,
    logWarn,
    logError,
    configureLogger
};
import { ConfigurationError } from './utils/error.utils.js';
import { JsonFileProviderConfig } from './providers/json-file.provider.js';
import { LogLevel } from './utils/logging.utils.js';

/**
 * Supported database types
 */
export enum DatabaseType {
    InMemory = 'in-memory',
    JsonFile = 'json-file',
    SQLite = 'sqlite',
    MongoDB = 'mongodb',
    IndexedDB = 'indexeddb',
    CloudflareR2 = 'cloudflare-r2',
    GitSync = 'git-sync'
}

/**
 * Configuration for a MongoDB provider (future implementation)
 */
export interface MongoDBProviderConfig {
    connectionString: string;
    databaseName: string;
    options?: Record<string, any>;
}

/**
 * Configuration for an SQLite provider (future implementation)
 */
export interface SQLiteProviderConfig {
    filePath: string;
}

/**
 * Configuration for a GitSync provider (future implementation)
 */
export interface GitSyncProviderConfig {
    repositoryPath: string;
    baseProviderType: DatabaseType;
    baseProviderConfig: any;
    syncOptions?: {
        remote?: string;
        branch?: string;
        interval?: number;
        autoCommit?: boolean;
        autoSync?: boolean;
        author?: {
            name: string;
            email: string;
        };
    };
    conflictStrategy?: 'accept-local' | 'accept-remote' | 'merge';
}

/**
 * Type to represent the IDBDatabase interface for environments without DOM types
 * This is a simplified version of the actual interface for type checking
 */
export interface IDBDatabaseProxy {
    name: string;
    version: number;
    objectStoreNames: DOMStringList;
    onabort: ((this: IDBDatabase, ev: Event) => any) | null;
    onclose: ((this: IDBDatabase, ev: Event) => any) | null;
    onerror: ((this: IDBDatabase, ev: Event) => any) | null;
    onversionchange: ((this: IDBDatabase, ev: IDBVersionChangeEvent) => any) | null;
    close(): void;
    createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore;
    deleteObjectStore(name: string): void;
    transaction(storeNames: string | string[], mode?: IDBTransactionMode): IDBTransaction;
}

/**
 * Configuration for an IndexedDB provider
 */
export interface IndexedDBProviderConfig {
    databaseName: string;
    version: number;
    migrationStrategy?: Record<number, (db: IDBDatabaseProxy) => void>;
    autoCreateCollections?: boolean;
}

/**
 * Database configuration options
 */
export interface IDatabaseConfig {
    /** The type of database provider to use */
    type: DatabaseType;
    
    /** Logging configuration */
    logging?: {
        level?: LogLevel;
    };
    
    /** Auto-connect when DatabaseService is instantiated */
    autoConnect?: boolean;
    
    /** Provider-specific configuration */
    providerConfig?: {
        /** Configuration for JsonFileProvider */
        jsonFile?: JsonFileProviderConfig;
        
        /** Configuration for SQLiteProvider */
        sqlite?: SQLiteProviderConfig;
        
        /** Configuration for MongoDBProvider */
        mongoDB?: MongoDBProviderConfig;
        
        /** Configuration for IndexedDBProvider */
        indexedDB?: IndexedDBProviderConfig;
        
        /** Configuration for GitSyncProvider */
        gitSync?: GitSyncProviderConfig;
    };
}

/**
 * Load database configuration from environment variables
 */
export function loadDatabaseConfig(): IDatabaseConfig {
    // Determine database type from environment variables
    const dbType = process.env.DATABASE_TYPE as DatabaseType || DatabaseType.InMemory;
    
    // Validate database type
    if (!Object.values(DatabaseType).includes(dbType)) {
        throw new ConfigurationError(`Invalid database type: ${dbType}`);
    }
    
    // Build provider-specific configuration
    const providerConfig: IDatabaseConfig['providerConfig'] = {};
    
    if (dbType === DatabaseType.JsonFile) {
        const directoryPath = process.env.DATABASE_JSON_FILE_DIRECTORY;
        if (!directoryPath) {
            throw new ConfigurationError('DATABASE_JSON_FILE_DIRECTORY is required for JsonFileProvider');
        }
        
        providerConfig.jsonFile = {
            directoryPath,
            useSingleFile: process.env.DATABASE_JSON_FILE_USE_SINGLE_FILE === 'true',
            prettyPrint: process.env.DATABASE_JSON_FILE_PRETTY_PRINT === 'true',
            writeDebounceMs: process.env.DATABASE_JSON_FILE_WRITE_DEBOUNCE_MS 
                ? parseInt(process.env.DATABASE_JSON_FILE_WRITE_DEBOUNCE_MS, 10) 
                : undefined
        };
    }
    
    if (dbType === DatabaseType.SQLite) {
        const filePath = process.env.DATABASE_SQLITE_FILE_PATH;
        if (!filePath) {
            throw new ConfigurationError('DATABASE_SQLITE_FILE_PATH is required for SQLiteProvider');
        }
        
        providerConfig.sqlite = { filePath };
    }
    
    if (dbType === DatabaseType.MongoDB) {
        const connectionString = process.env.DATABASE_MONGODB_CONNECTION_STRING;
        const databaseName = process.env.DATABASE_MONGODB_DATABASE_NAME;
        
        if (!connectionString || !databaseName) {
            throw new ConfigurationError('MongoDB configuration requires CONNECTION_STRING and DATABASE_NAME');
        }
        
        providerConfig.mongoDB = {
            connectionString,
            databaseName,
            options: process.env.DATABASE_MONGODB_OPTIONS
                ? JSON.parse(process.env.DATABASE_MONGODB_OPTIONS)
                : undefined
        };
    }
    
    if (dbType === DatabaseType.IndexedDB) {
        const databaseName = process.env.DATABASE_INDEXEDDB_NAME;
        const version = process.env.DATABASE_INDEXEDDB_VERSION;
        
        if (!databaseName || !version) {
            throw new ConfigurationError('IndexedDB configuration requires DATABASE_NAME and VERSION');
        }
        
        providerConfig.indexedDB = {
            databaseName,
            version: parseInt(version, 10),
            autoCreateCollections: process.env.DATABASE_INDEXEDDB_AUTO_CREATE === 'true'
        };
    }
    
    if (dbType === DatabaseType.GitSync) {
        const repositoryPath = process.env.DATABASE_GITSYNC_REPO_PATH;
        const baseProviderType = process.env.DATABASE_GITSYNC_BASE_PROVIDER as DatabaseType;
        
        if (!repositoryPath || !baseProviderType) {
            throw new ConfigurationError('GitSync requires REPO_PATH and BASE_PROVIDER');
        }
        
        // For simplicity, assume base provider config is provided as a JSON string
        const baseProviderConfig = process.env.DATABASE_GITSYNC_BASE_PROVIDER_CONFIG
            ? JSON.parse(process.env.DATABASE_GITSYNC_BASE_PROVIDER_CONFIG)
            : {};
        
        providerConfig.gitSync = {
            repositoryPath,
            baseProviderType,
            baseProviderConfig,
            syncOptions: {
                remote: process.env.DATABASE_GITSYNC_REMOTE,
                branch: process.env.DATABASE_GITSYNC_BRANCH,
                interval: process.env.DATABASE_GITSYNC_INTERVAL
                    ? parseInt(process.env.DATABASE_GITSYNC_INTERVAL, 10)
                    : undefined,
                autoCommit: process.env.DATABASE_GITSYNC_AUTO_COMMIT === 'true',
                autoSync: process.env.DATABASE_GITSYNC_AUTO_SYNC === 'true',
                author: process.env.DATABASE_GITSYNC_AUTHOR_NAME
                    ? {
                        name: process.env.DATABASE_GITSYNC_AUTHOR_NAME,
                        email: process.env.DATABASE_GITSYNC_AUTHOR_EMAIL || 'noreply@example.com'
                    }
                    : undefined
            },
            conflictStrategy: process.env.DATABASE_GITSYNC_CONFLICT_STRATEGY as any || 'accept-local'
        };
    }
    
    // Build and return the complete configuration
    return {
        type: dbType,
        logging: {
            level: process.env.DATABASE_LOG_LEVEL as LogLevel || LogLevel.INFO
        },
        autoConnect: process.env.DATABASE_AUTO_CONNECT === 'true',
        providerConfig
    };
}
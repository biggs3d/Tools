/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.19
 * https://github.com/biggs3d/McpMemoryServer
 */

import { v4 as uuidv4 } from 'uuid';
import { IDatabaseProvider, QueryOptions } from '../database-provider.interface.js';
import { 
    ConnectionError, 
    QueryError, 
    ConfigurationError, 
    UnsupportedOperationError, 
    TransactionError 
} from '../utils/error.utils.js';
import { 
    validateCollectionName, 
    validateId, 
    validateConnected, 
    assertDefined, 
    assertNotEmpty 
} from '../utils/validation.utils.js';
import { logDebug, logError, logInfo, logWarn } from '../utils/logging.utils.js';
import { applyFilters, applySorting, applyPagination, deepClone } from '../utils/query.utils.js';

/**
 * Interface for IndexedDB migration strategy
 * Maps database version numbers to handler functions for upgrades
 */
export type MigrationHandler = (db: IDBDatabase) => void;

/**
 * Configuration options for the IndexedDBProvider
 */
export interface IndexedDBProviderConfig {
    /** Name of the IndexedDB database */
    databaseName: string;
    /** Database version (must be a positive integer) */
    version: number;
    /** Migration strategy for database upgrades */
    migrationStrategy?: Record<number, MigrationHandler>;
    /** Auto-create object stores (collections) on first use */
    autoCreateCollections?: boolean;
}

/**
 * IndexedDB database provider implementation.
 * Provides a client-side database for web applications.
 * Note: IndexedDB is only available in browser environments.
 */
export class IndexedDBProvider implements IDatabaseProvider {
    private db: IDBDatabase | null = null;
    private _isConnected: boolean = false;
    private activeTransaction: IDBTransaction | null = null;
    private config: Required<IndexedDBProviderConfig>;
    private isServerEnvironment: boolean;

    /**
     * Initialize the IndexedDBProvider with configuration
     * @param config Configuration for the IndexedDBProvider
     */
    constructor(config: IndexedDBProviderConfig) {
        assertDefined(config, 'config');
        assertNotEmpty(config.databaseName, 'databaseName');
        
        if (config.version <= 0 || !Number.isInteger(config.version)) {
            throw new ConfigurationError('Version must be a positive integer');
        }
        
        this.config = {
            databaseName: config.databaseName,
            version: config.version,
            migrationStrategy: config.migrationStrategy || {},
            autoCreateCollections: config.autoCreateCollections !== false // Default to true
        };
        
        // Check if we're in a server environment (Node.js)
        this.isServerEnvironment = typeof window === 'undefined' || 
                                   typeof indexedDB === 'undefined';
        
        // For testing purposes, if the environment is stubbed properly, don't consider it a server environment
        if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
            this.isServerEnvironment = false;
        }
        
        logDebug('IndexedDBProvider initialized', { 
            databaseName: this.config.databaseName,
            version: this.config.version
        });
    }

    /**
     * Connect to the IndexedDB database.
     */
    async connect(): Promise<void> {
        logInfo('IndexedDBProvider connecting', { 
            databaseName: this.config.databaseName,
            version: this.config.version 
        });
        
        if (this._isConnected) {
            logWarn('IndexedDBProvider is already connected');
            return;
        }
        
        // Check if running in server environment
        if (this.isServerEnvironment) {
            throw new ConnectionError('IndexedDB is only available in browser environments');
        }
        
        try {
            this.db = await this.openDatabase();
            this._isConnected = true;
            
            logInfo('IndexedDBProvider connected successfully');
        } catch (error) {
            logError('Failed to connect IndexedDBProvider', error);
            if (this.db) {
                this.db.close();
                this.db = null;
            }
            throw new ConnectionError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Disconnect from the IndexedDB database.
     */
    async disconnect(): Promise<void> {
        logInfo('IndexedDBProvider disconnecting');
        
        if (!this._isConnected || !this.db) {
            logWarn('IndexedDBProvider is already disconnected');
            return;
        }
        
        try {
            // Close the database connection
            this.db.close();
            
            this.db = null;
            this._isConnected = false;
            this.activeTransaction = null;
            
            logInfo('IndexedDBProvider disconnected successfully');
        } catch (error) {
            logError('Failed to disconnect IndexedDBProvider', error);
            throw new ConnectionError(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Check if the provider is connected.
     * @returns True if connected, false otherwise
     */
    isConnected(): boolean {
        return this._isConnected && this.db !== null;
    }

    /**
     * Create a new item in the specified collection.
     * @param collectionName The name of the collection
     * @param data The item data to create
     * @returns The created item with a generated id if not provided
     */
    async create<T_Item, T_Return = T_Item>(collectionName: string, data: T_Item): Promise<T_Return> {
        validateCollectionName(collectionName);
        validateConnected(this._isConnected);
        
        logDebug(`Creating item in collection: ${collectionName}`, { data });
        
        try {
            // Ensure collection exists
            await this.ensureCollectionExists(collectionName);
            
            // Clone the data to prevent external modifications
            const itemToStore = deepClone(data as any);
            
            // Generate an ID if not provided
            if (!itemToStore.id) {
                itemToStore.id = uuidv4();
                logDebug(`Generated ID for new item: ${itemToStore.id}`);
            }
            
            // Create the item in IndexedDB
            await this.addItem(collectionName, itemToStore);
            
            logDebug(`Stored item with ID: ${itemToStore.id}`);
            
            // Return a deep clone of the stored item
            return deepClone(itemToStore) as unknown as T_Return;
        } catch (error) {
            logError(`Failed to create item in collection: ${collectionName}`, error);
            throw new QueryError(`Failed to create item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Read an item by ID from the specified collection.
     * @param collectionName The name of the collection
     * @param id The ID of the item to read
     * @returns The item or null if not found
     */
    async read<T_Return>(collectionName: string, id: string): Promise<T_Return | null> {
        validateCollectionName(collectionName);
        validateId(id);
        validateConnected(this._isConnected);
        
        logDebug(`Reading item with ID ${id} from collection: ${collectionName}`);
        
        try {
            // Check if collection exists
            if (!await this.collectionExists(collectionName)) {
                logDebug(`Collection not found: ${collectionName}`);
                return null;
            }
            
            // Get the item from IndexedDB
            const item = await this.getItem(collectionName, id);
            
            if (!item) {
                logDebug(`Item with ID ${id} not found in collection: ${collectionName}`);
                return null;
            }
            
            logDebug(`Found item with ID: ${id}`);
            
            // Return a deep clone of the item
            return deepClone(item) as unknown as T_Return;
        } catch (error) {
            logError(`Failed to read item with ID ${id} from collection: ${collectionName}`, error);
            throw new QueryError(`Failed to read item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Update an existing item in the specified collection.
     * @param collectionName The name of the collection
     * @param id The ID of the item to update
     * @param data The partial data to update
     * @returns The updated item or null if not found
     */
    async update<T_Item, T_Return = T_Item>(collectionName: string, id: string, data: Partial<T_Item>): Promise<T_Return | null> {
        validateCollectionName(collectionName);
        validateId(id);
        validateConnected(this._isConnected);
        
        logDebug(`Updating item with ID ${id} in collection: ${collectionName}`, { data });
        
        try {
            // Check if collection exists
            if (!await this.collectionExists(collectionName)) {
                logDebug(`Collection not found: ${collectionName}`);
                return null;
            }
            
            // Get the existing item
            const existingItem = await this.getItem(collectionName, id);
            
            if (!existingItem) {
                logDebug(`Item with ID ${id} not found in collection: ${collectionName}`);
                return null;
            }
            
            // Clone the existing item and merge with update data
            const updatedItem = {
                ...deepClone(existingItem),
                ...deepClone(data as any),
                id, // Ensure the ID remains unchanged
            };
            
            // Update the item in IndexedDB
            await this.putItem(collectionName, updatedItem);
            
            logDebug(`Updated item with ID: ${id}`);
            
            // Return a deep clone of the updated item
            return deepClone(updatedItem) as unknown as T_Return;
        } catch (error) {
            logError(`Failed to update item with ID ${id} in collection: ${collectionName}`, error);
            throw new QueryError(`Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Delete an item by ID from the specified collection.
     * @param collectionName The name of the collection
     * @param id The ID of the item to delete
     * @returns True if deleted, false if not found
     */
    async delete(collectionName: string, id: string): Promise<boolean> {
        validateCollectionName(collectionName);
        validateId(id);
        validateConnected(this._isConnected);
        
        logDebug(`Deleting item with ID ${id} from collection: ${collectionName}`);
        
        try {
            // Check if collection exists
            if (!await this.collectionExists(collectionName)) {
                logDebug(`Collection not found: ${collectionName}`);
                return false;
            }
            
            // Check if item exists
            const existingItem = await this.getItem(collectionName, id);
            
            if (!existingItem) {
                logDebug(`Item with ID ${id} not found in collection: ${collectionName}`);
                return false;
            }
            
            // Delete the item from IndexedDB
            await this.deleteItem(collectionName, id);
            
            logDebug(`Deleted item with ID: ${id}`);
            
            return true;
        } catch (error) {
            logError(`Failed to delete item with ID ${id} from collection: ${collectionName}`, error);
            throw new QueryError(`Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Query items from the specified collection.
     * @param collectionName The name of the collection
     * @param queryOptions Query options for filtering, sorting, and pagination
     * @returns Array of items matching the query
     */
    async query<T_Return, T_CustomFilters = any>(
        collectionName: string, 
        queryOptions: QueryOptions<T_CustomFilters> = {}
    ): Promise<T_Return[]> {
        validateCollectionName(collectionName);
        validateConnected(this._isConnected);
        
        logDebug(`Querying collection: ${collectionName}`, { queryOptions });
        
        try {
            // Check if collection exists
            if (!await this.collectionExists(collectionName)) {
                logDebug(`Collection not found: ${collectionName}`);
                return [];
            }
            
            // Get all items from the collection
            const items = await this.getAllItems(collectionName);
            
            // Apply filters
            let filteredItems = applyFilters(items, queryOptions);
            
            // Apply sorting
            filteredItems = applySorting(filteredItems, queryOptions);
            
            // Apply pagination
            filteredItems = applyPagination(filteredItems, queryOptions);
            
            logDebug(`Query returned ${filteredItems.length} items`);
            
            // Return deep clones of the items
            return filteredItems.map(item => deepClone(item)) as unknown as T_Return[];
        } catch (error) {
            logError(`Failed to query collection: ${collectionName}`, error);
            throw new QueryError(`Failed to query items: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Begins a new transaction.
     * Subsequent operations will be part of this transaction.
     */
    async beginTransaction(): Promise<void> {
        validateConnected(this._isConnected);
        
        if (this.activeTransaction) {
            throw new TransactionError('Transaction already in progress');
        }
        
        // IndexedDB has automatic transactions for single operations
        // For manual transactions spanning multiple operations, 
        // we would need to keep the transaction open (not fully supported)
        throw new UnsupportedOperationError('Manual transactions spanning multiple operations are not supported in IndexedDB provider');
    }

    /**
     * Commits the current active transaction.
     */
    async commitTransaction(): Promise<void> {
        validateConnected(this._isConnected);
        
        if (!this.activeTransaction) {
            throw new TransactionError('No transaction in progress');
        }
        
        // Transaction is completed automatically
        throw new UnsupportedOperationError('Manual transactions spanning multiple operations are not supported in IndexedDB provider');
    }

    /**
     * Rolls back the current active transaction.
     */
    async rollbackTransaction(): Promise<void> {
        validateConnected(this._isConnected);
        
        if (!this.activeTransaction) {
            throw new TransactionError('No transaction in progress');
        }
        
        // Transaction abort is not typically exposed
        throw new UnsupportedOperationError('Manual transactions spanning multiple operations are not supported in IndexedDB provider');
    }

    /**
     * Ensures an index exists on a given field (or set of fields) for a collection.
     * @param collectionName The logical name of the collection or table.
     * @param indexDefinition Definition of the index.
     */
    async ensureIndex(collectionName: string, indexDefinition: { 
        name: string; 
        keyPath: string | string[]; 
        unique?: boolean; 
        multiEntry?: boolean;
    }): Promise<void> {
        validateCollectionName(collectionName);
        validateConnected(this._isConnected);
        
        try {
            // Validate index definition
            if (!indexDefinition.name || !indexDefinition.keyPath) {
                throw new ConfigurationError('Invalid index definition: name and keyPath are required');
            }
            
            // Check if the object store exists
            const storeExists = await this.collectionExists(collectionName);
            
            if (!storeExists) {
                // If auto-create is enabled, we'll need to create the store with the index
                if (this.config.autoCreateCollections) {
                    // This requires a database upgrade which is complex to do dynamically
                    // We'll throw an error with guidance
                    throw new ConfigurationError(
                        `Cannot create index "${indexDefinition.name}" on non-existent collection "${collectionName}". ` +
                        'Indexes must be defined during database creation or upgrade. Define this index in your migrationStrategy.'
                    );
                } else {
                    throw new QueryError(`Collection not found: ${collectionName}`);
                }
            }
            
            // The only way to add an index to an existing object store is to
            // create a new database version and add it in the upgrade handler
            // This is a limitation of IndexedDB
            throw new UnsupportedOperationError(
                `Cannot add index "${indexDefinition.name}" to existing collection "${collectionName}". ` +
                'In IndexedDB, indexes can only be added during database creation or version upgrades. ' +
                'Increment the database version and define this index in your migrationStrategy.'
            );
        } catch (error) {
            logError(`Failed to create index for collection: ${collectionName}`, error);
            throw error instanceof UnsupportedOperationError || error instanceof ConfigurationError 
                ? error 
                : new QueryError(`Failed to create index: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Ensures a collection/table exists.
     * In IndexedDB, this is an object store, which can only be created during database upgrades.
     * @param collectionName The logical name of the collection or table.
     * @param options Optional creation options.
     */
    async ensureSchema(collectionName: string, options?: { 
        keyPath?: string; 
        autoIncrement?: boolean;
    }): Promise<void> {
        validateCollectionName(collectionName);
        validateConnected(this._isConnected);
        
        try {
            // Check if the object store exists
            const storeExists = await this.collectionExists(collectionName);
            
            if (!storeExists) {
                // If auto-create is enabled and we have collection creation capability
                if (this.config.autoCreateCollections) {
                    // This requires a database upgrade which is complex to do dynamically
                    // We'll throw an error with guidance
                    throw new ConfigurationError(
                        `Cannot create collection "${collectionName}". ` +
                        'Object stores in IndexedDB must be created during database creation or upgrade. ' +
                        'Define this collection in your migrationStrategy.'
                    );
                } else {
                    throw new QueryError(`Collection not found: ${collectionName}`);
                }
            }
            
            // Object store already exists
            logDebug(`Collection already exists: ${collectionName}`);
        } catch (error) {
            logError(`Failed to ensure schema for collection: ${collectionName}`, error);
            throw error instanceof ConfigurationError 
                ? error 
                : new QueryError(`Failed to ensure schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Private helper methods

    /**
     * Opens an IndexedDB database
     * @returns Promise that resolves to the database
     */
    private openDatabase(): Promise<IDBDatabase> {
        return new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(this.config.databaseName, this.config.version);
            
            request.onerror = (event) => {
                const target = event.target as IDBRequest;
                const error = target.error;
                reject(error || new Error('Error opening database'));
            };
            
            request.onsuccess = (event) => {
                const db = (event.target as IDBRequest).result;
                resolve(db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBRequest).result;
                const oldVersion = event.oldVersion;
                
                logDebug(`Database upgrade from version ${oldVersion} to ${this.config.version}`);
                
                // Call migration handlers for each version
                for (let version = oldVersion + 1; version <= this.config.version; version++) {
                    if (this.config.migrationStrategy[version]) {
                        logDebug(`Running migration for version ${version}`);
                        this.config.migrationStrategy[version](db);
                    }
                }
            };
        });
    }

    /**
     * Checks if a collection (object store) exists
     * @param collectionName The name of the collection
     * @returns True if exists, false otherwise
     */
    private async collectionExists(collectionName: string): Promise<boolean> {
        if (!this.db) {
            throw new ConnectionError('Database is not connected');
        }
        
        return this.db.objectStoreNames.contains(collectionName);
    }

    /**
     * Ensures a collection (object store) exists, creating it if it doesn't
     * Note: In IndexedDB, object stores can only be created during database upgrades
     * @param collectionName The name of the collection
     */
    private async ensureCollectionExists(collectionName: string): Promise<void> {
        if (!await this.collectionExists(collectionName)) {
            if (this.config.autoCreateCollections) {
                // Cannot create object stores outside of upgradeneeded event
                // This is a limitation of IndexedDB
                throw new ConfigurationError(
                    `Collection "${collectionName}" does not exist and cannot be created dynamically. ` +
                    'Object stores in IndexedDB must be created during database creation or upgrade. ' +
                    'Define this collection in your migrationStrategy.'
                );
            } else {
                throw new QueryError(`Collection not found: ${collectionName}`);
            }
        }
    }

    /**
     * Adds an item to a collection
     * @param collectionName The name of the collection
     * @param item The item to add
     */
    private addItem(collectionName: string, item: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) {
                reject(new ConnectionError('Database is not connected'));
                return;
            }
            
            // Use an existing transaction or create a new one
            let transaction = this.activeTransaction;
            let needsNewTransaction = false;
            
            if (!transaction || !transaction.objectStoreNames.contains(collectionName)) {
                try {
                    transaction = this.db.transaction(collectionName, 'readwrite');
                    needsNewTransaction = true;
                } catch (error) {
                    reject(error);
                    return;
                }
            }
            
            const objectStore = transaction.objectStore(collectionName);
            const request = objectStore.add(item);
            
            request.onerror = (event) => {
                const target = event.target as IDBRequest;
                const error = target.error;
                reject(error || new Error('Error adding item'));
            };
            
            request.onsuccess = () => {
                resolve();
            };
            
            // If we created a new transaction, listen for completion
            if (needsNewTransaction) {
                transaction.oncomplete = () => {
                    // Transaction is complete
                };
                
                transaction.onerror = (event) => {
                    const target = event.target as IDBTransaction;
                    const error = target.error;
                    reject(error || new Error('Transaction error'));
                };
            }
        });
    }

    /**
     * Gets an item from a collection by ID
     * @param collectionName The name of the collection
     * @param id The ID of the item
     * @returns The item or undefined if not found
     */
    private getItem(collectionName: string, id: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (!this.db) {
                reject(new ConnectionError('Database is not connected'));
                return;
            }
            
            // Use an existing transaction or create a new one
            let transaction = this.activeTransaction;
            let needsNewTransaction = false;
            
            if (!transaction || !transaction.objectStoreNames.contains(collectionName)) {
                try {
                    transaction = this.db.transaction(collectionName, 'readonly');
                    needsNewTransaction = true;
                } catch (error) {
                    reject(error);
                    return;
                }
            }
            
            const objectStore = transaction.objectStore(collectionName);
            const request = objectStore.get(id);
            
            request.onerror = (event) => {
                const target = event.target as IDBRequest;
                const error = target.error;
                reject(error || new Error('Error getting item'));
            };
            
            request.onsuccess = (event) => {
                const target = event.target as IDBRequest;
                const result = target.result;
                resolve(result);
            };
            
            // If we created a new transaction, listen for completion
            if (needsNewTransaction) {
                transaction.oncomplete = () => {
                    // Transaction is complete
                };
                
                transaction.onerror = (event) => {
                    const target = event.target as IDBTransaction;
                    const error = target.error;
                    reject(error || new Error('Transaction error'));
                };
            }
        });
    }

    /**
     * Updates an item in a collection
     * @param collectionName The name of the collection
     * @param item The item to update
     */
    private putItem(collectionName: string, item: any): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) {
                reject(new ConnectionError('Database is not connected'));
                return;
            }
            
            // Use an existing transaction or create a new one
            let transaction = this.activeTransaction;
            let needsNewTransaction = false;
            
            if (!transaction || !transaction.objectStoreNames.contains(collectionName)) {
                try {
                    transaction = this.db.transaction(collectionName, 'readwrite');
                    needsNewTransaction = true;
                } catch (error) {
                    reject(error);
                    return;
                }
            }
            
            const objectStore = transaction.objectStore(collectionName);
            const request = objectStore.put(item);
            
            request.onerror = (event) => {
                const target = event.target as IDBRequest;
                const error = target.error;
                reject(error || new Error('Error updating item'));
            };
            
            request.onsuccess = () => {
                resolve();
            };
            
            // If we created a new transaction, listen for completion
            if (needsNewTransaction) {
                transaction.oncomplete = () => {
                    // Transaction is complete
                };
                
                transaction.onerror = (event) => {
                    const target = event.target as IDBTransaction;
                    const error = target.error;
                    reject(error || new Error('Transaction error'));
                };
            }
        });
    }

    /**
     * Deletes an item from a collection
     * @param collectionName The name of the collection
     * @param id The ID of the item
     */
    private deleteItem(collectionName: string, id: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (!this.db) {
                reject(new ConnectionError('Database is not connected'));
                return;
            }
            
            // Use an existing transaction or create a new one
            let transaction = this.activeTransaction;
            let needsNewTransaction = false;
            
            if (!transaction || !transaction.objectStoreNames.contains(collectionName)) {
                try {
                    transaction = this.db.transaction(collectionName, 'readwrite');
                    needsNewTransaction = true;
                } catch (error) {
                    reject(error);
                    return;
                }
            }
            
            const objectStore = transaction.objectStore(collectionName);
            const request = objectStore.delete(id);
            
            request.onerror = (event) => {
                const target = event.target as IDBRequest;
                const error = target.error;
                reject(error || new Error('Error deleting item'));
            };
            
            request.onsuccess = () => {
                resolve();
            };
            
            // If we created a new transaction, listen for completion
            if (needsNewTransaction) {
                transaction.oncomplete = () => {
                    // Transaction is complete
                };
                
                transaction.onerror = (event) => {
                    const target = event.target as IDBTransaction;
                    const error = target.error;
                    reject(error || new Error('Transaction error'));
                };
            }
        });
    }

    /**
     * Gets all items from a collection
     * @param collectionName The name of the collection
     * @returns Array of all items
     */
    private getAllItems(collectionName: string): Promise<any[]> {
        return new Promise<any[]>((resolve, reject) => {
            if (!this.db) {
                reject(new ConnectionError('Database is not connected'));
                return;
            }
            
            // Use an existing transaction or create a new one
            let transaction = this.activeTransaction;
            let needsNewTransaction = false;
            
            if (!transaction || !transaction.objectStoreNames.contains(collectionName)) {
                try {
                    transaction = this.db.transaction(collectionName, 'readonly');
                    needsNewTransaction = true;
                } catch (error) {
                    reject(error);
                    return;
                }
            }
            
            const objectStore = transaction.objectStore(collectionName);
            const request = objectStore.getAll();
            
            request.onerror = (event) => {
                const target = event.target as IDBRequest;
                const error = target.error;
                reject(error || new Error('Error getting all items'));
            };
            
            request.onsuccess = (event) => {
                const target = event.target as IDBRequest;
                const result = target.result || [];
                resolve(result);
            };
            
            // If we created a new transaction, listen for completion
            if (needsNewTransaction) {
                transaction.oncomplete = () => {
                    // Transaction is complete
                };
                
                transaction.onerror = (event) => {
                    const target = event.target as IDBTransaction;
                    const error = target.error;
                    reject(error || new Error('Transaction error'));
                };
            }
        });
    }
}
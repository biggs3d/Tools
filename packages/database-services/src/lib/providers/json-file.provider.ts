/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.19
 * https://github.com/biggs3d/McpMemoryServer
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IDatabaseProvider, QueryOptions } from '../database-provider.interface.js';
import { ConnectionError, QueryError } from '../utils/error.utils.js';
import { validateCollectionName, validateId, validateConnected, assertDefined, assertNotEmpty } from '../utils/validation.utils.js';
import { logDebug, logError, logInfo, logWarn } from '../utils/logging.utils.js';
import { applyFilters, applySorting, applyPagination, deepClone } from '../utils/query.utils.js';

/**
 * Configuration options for the JsonFileProvider
 */
export interface JsonFileProviderConfig {
    /** Directory path where JSON files will be stored */
    directoryPath: string;
    /** If true, all collections will be stored in a single database.json file */
    useSingleFile?: boolean;
    /** If true, the JSON will be formatted with indentation for readability */
    prettyPrint?: boolean;
    /** Time in milliseconds to debounce write operations */
    writeDebounceMs?: number;
}

/**
 * A file-based database provider that stores data in JSON files.
 * Each collection is stored in a separate file unless useSingleFile is set to true.
 */
export class JsonFileProvider implements IDatabaseProvider {
    private _isConnected: boolean = false;
    private storage: Map<string, Map<string, any>> = new Map();
    private pendingWrites: Set<string> = new Set();
    private writeTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private lockTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private config: Required<JsonFileProviderConfig>;

    /**
     * Initialize the JsonFileProvider with configuration
     * @param config Configuration for the JsonFileProvider
     */
    constructor(config: JsonFileProviderConfig) {
        assertDefined(config, 'config');
        assertNotEmpty(config.directoryPath, 'directoryPath');
        
        this.config = {
            directoryPath: config.directoryPath,
            useSingleFile: config.useSingleFile ?? false,
            prettyPrint: config.prettyPrint ?? false,
            writeDebounceMs: config.writeDebounceMs ?? 300
        };
        
        logDebug('JsonFileProvider initialized', { config: this.config });
    }

    /**
     * Connect to the JSON file database.
     * This creates the directory if it doesn't exist and loads data from existing files.
     */
    async connect(): Promise<void> {
        logInfo('JsonFileProvider connecting');
        
        if (this._isConnected) {
            logWarn('JsonFileProvider is already connected');
            return;
        }
        
        try {
            // Ensure directory exists
            await fs.mkdir(this.config.directoryPath, { recursive: true });
            
            // Load data from files
            await this.loadData();
            
            this._isConnected = true;
            logInfo('JsonFileProvider connected successfully');
        } catch (error) {
            logError('Failed to connect JsonFileProvider', error);
            throw new ConnectionError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Disconnect from the JSON file database.
     * This ensures all pending writes are completed.
     */
    async disconnect(): Promise<void> {
        logInfo('JsonFileProvider disconnecting');
        
        if (!this._isConnected) {
            logWarn('JsonFileProvider is already disconnected');
            return;
        }
        
        try {
            // Complete any pending writes
            await this.flushPendingWrites();
            
            // Clear timeouts
            for (const timeout of this.writeTimeouts.values()) {
                clearTimeout(timeout);
            }
            
            for (const timeout of this.lockTimeouts.values()) {
                clearTimeout(timeout);
            }
            
            this.writeTimeouts.clear();
            this.lockTimeouts.clear();
            this.pendingWrites.clear();
            this.storage.clear();
            
            this._isConnected = false;
            logInfo('JsonFileProvider disconnected successfully');
        } catch (error) {
            logError('Failed to disconnect JsonFileProvider', error);
            throw new ConnectionError(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Check if the provider is connected.
     * @returns True if connected, false otherwise
     */
    isConnected(): boolean {
        return this._isConnected;
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
            // Get or create the collection
            if (!this.storage.has(collectionName)) {
                this.storage.set(collectionName, new Map());
                logDebug(`Created new collection: ${collectionName}`);
            }
            
            const collection = this.storage.get(collectionName)!;
            
            // Clone the data to prevent external modifications
            const itemToStore = deepClone(data);
            
            // Generate an ID if not provided
            const itemWithId = itemToStore as any;
            if (!itemWithId.id) {
                itemWithId.id = uuidv4();
                logDebug(`Generated ID for new item: ${itemWithId.id}`);
            }
            
            // Store the item
            collection.set(itemWithId.id, itemWithId);
            logDebug(`Stored item with ID: ${itemWithId.id}`);
            
            // Schedule a write
            this.scheduleWrite(collectionName);
            
            // Return a deep clone of the stored item
            return deepClone(itemWithId) as unknown as T_Return;
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
            if (!this.storage.has(collectionName)) {
                logDebug(`Collection not found: ${collectionName}`);
                return null;
            }
            
            const collection = this.storage.get(collectionName)!;
            
            // Check if item exists
            if (!collection.has(id)) {
                logDebug(`Item with ID ${id} not found in collection: ${collectionName}`);
                return null;
            }
            
            // Return a deep clone of the stored item
            const item = collection.get(id);
            logDebug(`Found item with ID: ${id}`);
            
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
            if (!this.storage.has(collectionName)) {
                logDebug(`Collection not found: ${collectionName}`);
                return null;
            }
            
            const collection = this.storage.get(collectionName)!;
            
            // Check if item exists
            if (!collection.has(id)) {
                logDebug(`Item with ID ${id} not found in collection: ${collectionName}`);
                return null;
            }
            
            // Get the existing item
            const existingItem = deepClone(collection.get(id));
            
            // Merge the existing item with the update data
            const updatedItem = {
                ...existingItem,
                ...deepClone(data as any),
                id, // Ensure the ID remains unchanged
            };
            
            // Store the updated item
            collection.set(id, updatedItem);
            logDebug(`Updated item with ID: ${id}`);
            
            // Schedule a write
            this.scheduleWrite(collectionName);
            
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
            if (!this.storage.has(collectionName)) {
                logDebug(`Collection not found: ${collectionName}`);
                return false;
            }
            
            const collection = this.storage.get(collectionName)!;
            
            // Check if item exists
            if (!collection.has(id)) {
                logDebug(`Item with ID ${id} not found in collection: ${collectionName}`);
                return false;
            }
            
            // Delete the item
            const deleted = collection.delete(id);
            logDebug(`Deleted item with ID: ${id}, success: ${deleted}`);
            
            if (deleted) {
                // Schedule a write
                this.scheduleWrite(collectionName);
            }
            
            return deleted;
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
            if (!this.storage.has(collectionName)) {
                logDebug(`Collection not found: ${collectionName}`);
                return [];
            }
            
            const collection = this.storage.get(collectionName)!;
            
            // Get all items as an array
            let items = Array.from(collection.values());
            
            // Apply filters
            items = applyFilters(items, queryOptions);
            
            // Apply sorting
            items = applySorting(items, queryOptions);
            
            // Apply pagination
            items = applyPagination(items, queryOptions);
            
            logDebug(`Query returned ${items.length} items`);
            
            // Return deep clones of the items
            return items.map(item => deepClone(item)) as unknown as T_Return[];
        } catch (error) {
            logError(`Failed to query collection: ${collectionName}`, error);
            throw new QueryError(`Failed to query items: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Private methods for file operations

    /**
     * Load data from files into memory
     */
    private async loadData(): Promise<void> {
        try {
            this.storage.clear();
            
            if (this.config.useSingleFile) {
                await this.loadSingleFile();
            } else {
                await this.loadMultipleFiles();
            }
        } catch (error) {
            logError('Failed to load data', error);
            throw new ConnectionError(`Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Load data from a single database.json file
     */
    private async loadSingleFile(): Promise<void> {
        const dbFilePath = path.join(this.config.directoryPath, 'database.json');
        
        try {
            const data = await fs.readFile(dbFilePath, 'utf8');
            const collections = JSON.parse(data);
            
            // Populate storage with collections
            for (const [collectionName, items] of Object.entries(collections)) {
                const collection = new Map();
                
                // Convert items object to Map entries
                for (const [id, item] of Object.entries(items as Record<string, any>)) {
                    collection.set(id, item);
                }
                
                this.storage.set(collectionName, collection);
            }
            
            logDebug('Loaded data from single file', { 
                collections: this.storage.size, 
                path: dbFilePath 
            });
        } catch (error) {
            // If file doesn't exist, that's ok
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                logDebug('Database file does not exist yet, starting with empty data', { 
                    path: dbFilePath 
                });
                return;
            }
            
            throw error;
        }
    }

    /**
     * Load data from multiple collection files
     */
    private async loadMultipleFiles(): Promise<void> {
        try {
            const files = await fs.readdir(this.config.directoryPath);
            const jsonFiles = files.filter(file => file.endsWith('.json'));
            
            for (const file of jsonFiles) {
                const collectionName = path.basename(file, '.json');
                const filePath = path.join(this.config.directoryPath, file);
                
                try {
                    const data = await fs.readFile(filePath, 'utf8');
                    const items = JSON.parse(data);
                    
                    // Create a Map for the collection
                    const collection = new Map();
                    
                    // Add items to the collection
                    for (const [id, item] of Object.entries(items)) {
                        collection.set(id, item);
                    }
                    
                    this.storage.set(collectionName, collection);
                    
                    logDebug(`Loaded collection from file: ${collectionName}`, { 
                        items: collection.size, 
                        path: filePath 
                    });
                } catch (error) {
                    logWarn(`Failed to load collection file: ${file}`, error);
                }
            }
        } catch (error) {
            // If directory doesn't exist, that's handled in connect()
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return;
            }
            
            throw error;
        }
    }

    /**
     * Schedule a write operation for a collection
     * @param collectionName The name of the collection to write
     */
    private scheduleWrite(collectionName: string): void {
        this.pendingWrites.add(collectionName);
        
        // Clear any existing timeout for this collection
        const existingTimeout = this.writeTimeouts.get(collectionName);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }
        
        // Schedule a new write
        const timeout = setTimeout(() => {
            this.writeCollection(collectionName)
                .catch(error => {
                    logError(`Failed to write collection: ${collectionName}`, error);
                });
        }, this.config.writeDebounceMs);
        
        this.writeTimeouts.set(collectionName, timeout);
    }

    /**
     * Flush all pending writes
     */
    private async flushPendingWrites(): Promise<void> {
        const collections = Array.from(this.pendingWrites);
        this.pendingWrites.clear();
        
        // Clear all timeouts
        for (const collection of collections) {
            const timeout = this.writeTimeouts.get(collection);
            if (timeout) {
                clearTimeout(timeout);
                this.writeTimeouts.delete(collection);
            }
        }
        
        // Write all collections
        for (const collection of collections) {
            try {
                await this.writeCollection(collection);
            } catch (error) {
                logError(`Failed to flush collection: ${collection}`, error);
            }
        }
    }

    /**
     * Write a collection to disk
     * @param collectionName The name of the collection to write
     */
    private async writeCollection(collectionName: string): Promise<void> {
        if (!this.storage.has(collectionName)) {
            logWarn(`Cannot write non-existent collection: ${collectionName}`);
            return;
        }
        
        try {
            const collection = this.storage.get(collectionName)!;
            
            // Remove from pending writes
            this.pendingWrites.delete(collectionName);
            this.writeTimeouts.delete(collectionName);
            
            if (this.config.useSingleFile) {
                await this.writeSingleFile();
            } else {
                await this.writeCollectionFile(collectionName, collection);
            }
        } catch (error) {
            // Re-add to pending writes if failed
            this.pendingWrites.add(collectionName);
            throw error;
        }
    }

    /**
     * Write all collections to a single database.json file
     */
    private async writeSingleFile(): Promise<void> {
        const dbFilePath = path.join(this.config.directoryPath, 'database.json');
        const tmpFilePath = `${dbFilePath}.tmp`;
        const lockFilePath = `${dbFilePath}.lock`;
        
        // Try to obtain a lock
        try {
            await this.obtainLock(lockFilePath);
            
            // Convert storage Map to JSON-friendly object
            const data: Record<string, Record<string, any>> = {};
            
            for (const [collectionName, collection] of this.storage.entries()) {
                const items: Record<string, any> = {};
                
                for (const [id, item] of collection.entries()) {
                    items[id] = item;
                }
                
                data[collectionName] = items;
            }
            
            // Write to temp file first
            const json = this.config.prettyPrint 
                ? JSON.stringify(data, null, 2) 
                : JSON.stringify(data);
            
            await fs.writeFile(tmpFilePath, json, 'utf8');
            
            // Rename temp file to actual file
            await fs.rename(tmpFilePath, dbFilePath);
            
            logDebug('Wrote data to single file', { 
                collections: this.storage.size, 
                path: dbFilePath 
            });
        } finally {
            // Release lock
            await this.releaseLock(lockFilePath);
        }
    }

    /**
     * Write a collection to its own file
     * @param collectionName The name of the collection
     * @param collection The collection Map
     */
    private async writeCollectionFile(collectionName: string, collection: Map<string, any>): Promise<void> {
        const filePath = path.join(this.config.directoryPath, `${collectionName}.json`);
        const tmpFilePath = `${filePath}.tmp`;
        const lockFilePath = `${filePath}.lock`;
        
        // Try to obtain a lock
        try {
            await this.obtainLock(lockFilePath);
            
            // Convert collection Map to JSON-friendly object
            const data: Record<string, any> = {};
            
            for (const [id, item] of collection.entries()) {
                data[id] = item;
            }
            
            // Write to temp file first
            const json = this.config.prettyPrint 
                ? JSON.stringify(data, null, 2) 
                : JSON.stringify(data);
            
            await fs.writeFile(tmpFilePath, json, 'utf8');
            
            // Rename temp file to actual file
            await fs.rename(tmpFilePath, filePath);
            
            logDebug(`Wrote collection to file: ${collectionName}`, { 
                items: collection.size, 
                path: filePath 
            });
        } finally {
            // Release lock
            await this.releaseLock(lockFilePath);
        }
    }

    /**
     * Try to obtain a file lock
     * @param lockFilePath Path to the lock file
     */
    private async obtainLock(lockFilePath: string): Promise<void> {
        const maxRetries = 5;
        const retryDelayMs = 100;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                // Try to create the lock file
                await fs.writeFile(lockFilePath, `${process.pid}`, { 
                    flag: 'wx' // Fail if file exists
                });
                
                // Set a timeout to auto-release the lock after 10 seconds
                // This prevents indefinite locks if the process crashes
                const timeout = setTimeout(() => {
                    fs.unlink(lockFilePath).catch(() => {
                        // Ignore errors during cleanup
                    });
                    this.lockTimeouts.delete(lockFilePath);
                }, 10000);
                
                this.lockTimeouts.set(lockFilePath, timeout);
                
                return;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
                    // Lock file exists, wait and retry
                    await new Promise(resolve => setTimeout(resolve, retryDelayMs));
                } else {
                    // Other error, fail immediately
                    throw error;
                }
            }
        }
        
        throw new QueryError(`Failed to obtain lock after ${maxRetries} attempts: ${lockFilePath}`);
    }

    /**
     * Release a file lock
     * @param lockFilePath Path to the lock file
     */
    private async releaseLock(lockFilePath: string): Promise<void> {
        // Clear any auto-release timeout
        const timeout = this.lockTimeouts.get(lockFilePath);
        if (timeout) {
            clearTimeout(timeout);
            this.lockTimeouts.delete(lockFilePath);
        }
        
        try {
            await fs.unlink(lockFilePath);
        } catch (error) {
            // If file doesn't exist, that's fine
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                logWarn(`Failed to release lock: ${lockFilePath}`, error);
            }
        }
    }
}
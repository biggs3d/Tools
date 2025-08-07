import { v4 as uuidv4 } from 'uuid';
import { IDatabaseProvider, QueryOptions } from '../database-provider.interface.js';
import { ConnectionError, QueryError } from '../utils/error.utils.js';
import { validateCollectionName, validateId, validateConnected } from '../utils/validation.utils.js';
import { logDebug, logError, logInfo, logWarn } from '../utils/logging.utils.js';
import { applyFilters, applySorting, applyPagination, deepClone } from '../utils/query.utils.js';

/**
 * In-memory database provider implementation.
 * Useful for development, testing, and scenarios where persistence is not required.
 */
export class InMemoryProvider implements IDatabaseProvider {
    private storage: Map<string, Map<string, any>> = new Map();
    private _isConnected: boolean = false;

    /**
     * Initialize the InMemoryProvider
     * @param options Optional configuration
     */
    constructor(options: { label?: string } = {}) {
        const label = options.label || 'default';
        logDebug(`InMemoryProvider initialized with label: ${label}`);
    }

    /**
     * Connect to the in-memory database.
     * For this provider, it simply sets the connection state and initializes the storage.
     */
    async connect(): Promise<void> {
        logInfo('InMemoryProvider connecting');
        
        if (this._isConnected) {
            logWarn('InMemoryProvider is already connected');
            return;
        }
        
        try {
            // Initialize storage (clear any existing data for a fresh start)
            this.storage = new Map();
            this._isConnected = true;
            logInfo('InMemoryProvider connected successfully');
        } catch (error) {
            logError('Failed to connect InMemoryProvider', error);
            throw new ConnectionError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Disconnect from the in-memory database.
     * For this provider, it simply resets the connection state and clears the storage.
     */
    async disconnect(): Promise<void> {
        logInfo('InMemoryProvider disconnecting');
        
        if (!this._isConnected) {
            logWarn('InMemoryProvider is already disconnected');
            return;
        }
        
        try {
            // Clear storage on disconnect to free memory
            this.storage.clear();
            this._isConnected = false;
            logInfo('InMemoryProvider disconnected successfully');
        } catch (error) {
            logError('Failed to disconnect InMemoryProvider', error);
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
}
/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.19
 * https://github.com/biggs3d/McpMemoryServer
 */

import { v4 as uuidv4 } from 'uuid';
// @ts-ignore - Using installed mongodb types
import { MongoClient, Collection, Db, ObjectId, ClientSession, Filter, Sort, Document } from 'mongodb';
import { IDatabaseProvider, QueryOptions } from '../database-provider.interface.js';
import { 
    ConnectionError, 
    QueryError, 
    ConfigurationError, 
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

/**
 * Configuration options for the MongoDBProvider
 */
export interface MongoDBProviderConfig {
    /** MongoDB connection string */
    connectionString: string;
    /** Name of the database to use */
    databaseName: string;
    /** Additional MongoDB client options */
    options?: Record<string, any>;
}

/**
 * MongoDB database provider implementation.
 * Uses the MongoDB Node.js driver to store data in a MongoDB database.
 */
export class MongoDBProvider implements IDatabaseProvider {
    private client: MongoClient | null = null;
    private db: Db | null = null;
    private _isConnected: boolean = false;
    private activeSession: ClientSession | null = null;
    private config: Required<MongoDBProviderConfig>;

    /**
     * Initialize the MongoDBProvider with configuration
     * @param config Configuration for the MongoDBProvider
     */
    constructor(config: MongoDBProviderConfig) {
        assertDefined(config, 'config');
        assertNotEmpty(config.connectionString, 'connectionString');
        assertNotEmpty(config.databaseName, 'databaseName');
        
        this.config = {
            connectionString: config.connectionString,
            databaseName: config.databaseName,
            options: config.options || {}
        };
        
        logDebug('MongoDBProvider initialized', { 
            databaseName: this.config.databaseName,
            // Don't log the full connection string as it may contain credentials
            connectionString: this.maskConnectionString(this.config.connectionString)
        });
    }

    /**
     * Connect to the MongoDB database.
     */
    async connect(): Promise<void> {
        logInfo('MongoDBProvider connecting', { 
            databaseName: this.config.databaseName 
        });
        
        if (this._isConnected) {
            logWarn('MongoDBProvider is already connected');
            return;
        }
        
        try {
            this.client = new MongoClient(this.config.connectionString, this.config.options);
            await this.client.connect();
            
            this.db = this.client.db(this.config.databaseName);
            this._isConnected = true;
            
            logInfo('MongoDBProvider connected successfully');
        } catch (error) {
            logError('Failed to connect MongoDBProvider', error);
            if (this.client) {
                await this.client.close();
                this.client = null;
            }
            this.db = null;
            throw new ConnectionError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Disconnect from the MongoDB database.
     */
    async disconnect(): Promise<void> {
        logInfo('MongoDBProvider disconnecting');
        
        if (!this._isConnected || !this.client) {
            logWarn('MongoDBProvider is already disconnected');
            return;
        }
        
        try {
            // End any active session
            if (this.activeSession) {
                await this.activeSession.endSession();
                this.activeSession = null;
            }
            
            // Close the client connection
            await this.client.close();
            
            this.client = null;
            this.db = null;
            this._isConnected = false;
            
            logInfo('MongoDBProvider disconnected successfully');
        } catch (error) {
            logError('Failed to disconnect MongoDBProvider', error);
            throw new ConnectionError(`Failed to disconnect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Check if the provider is connected.
     * @returns True if connected, false otherwise
     */
    isConnected(): boolean {
        return this._isConnected && this.client !== null && this.db !== null;
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
            const collection = this.getCollection(collectionName);
            
            // Clone the data to prevent external modifications
            const itemToStore = { ...data as any };
            
            // Generate an ID if not provided
            if (!itemToStore.id) {
                itemToStore.id = uuidv4();
                logDebug(`Generated ID for new item: ${itemToStore.id}`);
            }
            
            // Map _id to the id field for MongoDB
            itemToStore._id = itemToStore.id;
            
            // Insert the document
            const options = this.activeSession ? { session: this.activeSession } : undefined;
            await collection.insertOne(itemToStore, options);
            
            // Get the inserted document and normalize IDs
            const result = await this.read<T_Return>(collectionName, itemToStore.id);
            
            if (!result) {
                throw new QueryError('Failed to retrieve the created item');
            }
            
            return result;
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
            const collection = this.getCollection(collectionName);
            
            // Create the filter
            const filter = this.createIdFilter(id);
            
            // Get the document
            const options = this.activeSession ? { session: this.activeSession } : undefined;
            const document = await collection.findOne(filter, options);
            
            if (!document) {
                logDebug(`Item with ID ${id} not found in collection: ${collectionName}`);
                return null;
            }
            
            // Normalize the document (convert _id to id string)
            const normalizedDocument = this.normalizeDocument(document);
            logDebug(`Found item with ID: ${id}`);
            
            return normalizedDocument as unknown as T_Return;
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
            const collection = this.getCollection(collectionName);
            
            // Create the filter
            const filter = this.createIdFilter(id);
            
            // Create the update document
            const updateData = { ...data as object };
            delete (updateData as any).id; // Don't update the id field
            delete (updateData as any)._id; // Don't update the _id field
            
            // No fields to update
            if (Object.keys(updateData).length === 0) {
                return await this.read<T_Return>(collectionName, id);
            }
            
            // Update the document
            const options = this.activeSession ? { session: this.activeSession } : undefined;
            const result = await collection.findOneAndUpdate(
                filter,
                { $set: updateData },
                { 
                    ...options,
                    returnDocument: 'after' 
                }
            );
            
            if (!result) {
                logDebug(`Item with ID ${id} not found in collection: ${collectionName}`);
                return null;
            }
            
            // Normalize the document
            const normalizedDocument = this.normalizeDocument(result);
            logDebug(`Updated item with ID: ${id}`);
            
            return normalizedDocument as unknown as T_Return;
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
            const collection = this.getCollection(collectionName);
            
            // Create the filter
            const filter = this.createIdFilter(id);
            
            // Delete the document
            const options = this.activeSession ? { session: this.activeSession } : undefined;
            const result = await collection.deleteOne(filter, options);
            
            const deleted = result.deletedCount > 0;
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
            const collection = this.getCollection(collectionName);
            
            // Build the MongoDB query
            const { filter, sort, skip, limit } = this.buildMongoQuery(queryOptions);
            
            // Create the find cursor
            const options = this.activeSession ? { session: this.activeSession } : undefined;
            let cursor = collection.find(filter, options);
            
            // Apply sorting
            if (sort) {
                cursor = cursor.sort(sort);
            }
            
            // Apply pagination
            if (skip !== undefined) {
                cursor = cursor.skip(skip);
            }
            
            if (limit !== undefined) {
                cursor = cursor.limit(limit);
            }
            
            // Execute the query
            const documents = await cursor.toArray();
            
            // Normalize the documents
            const normalizedDocuments = documents.map((doc: Document) => this.normalizeDocument(doc));
            
            logDebug(`Query returned ${normalizedDocuments.length} items`);
            
            return normalizedDocuments as unknown as T_Return[];
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
        
        if (this.activeSession) {
            throw new TransactionError('Transaction already in progress');
        }
        
        try {
            const client = this.client as MongoClient;
            const session = client.startSession();
            
            session.startTransaction();
            this.activeSession = session;
            
            logDebug('Transaction started');
        } catch (error) {
            logError('Failed to begin transaction', error);
            throw new TransactionError(`Failed to begin transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Commits the current active transaction.
     */
    async commitTransaction(): Promise<void> {
        validateConnected(this._isConnected);
        
        if (!this.activeSession) {
            throw new TransactionError('No transaction in progress');
        }
        
        try {
            await this.activeSession.commitTransaction();
            await this.activeSession.endSession();
            
            this.activeSession = null;
            logDebug('Transaction committed');
        } catch (error) {
            logError('Failed to commit transaction', error);
            throw new TransactionError(`Failed to commit transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Rolls back the current active transaction.
     */
    async rollbackTransaction(): Promise<void> {
        validateConnected(this._isConnected);
        
        if (!this.activeSession) {
            throw new TransactionError('No transaction in progress');
        }
        
        try {
            await this.activeSession.abortTransaction();
            await this.activeSession.endSession();
            
            this.activeSession = null;
            logDebug('Transaction rolled back');
        } catch (error) {
            logError('Failed to rollback transaction', error);
            throw new TransactionError(`Failed to rollback transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Ensures an index exists on a given field (or set of fields) for a collection.
     * @param collectionName The logical name of the collection or table.
     * @param indexDefinition Definition of the index.
     */
    async ensureIndex(collectionName: string, indexDefinition: { 
        name: string; 
        fields: Record<string, 1 | -1>; 
        options?: { unique?: boolean; [key: string]: any };
    }): Promise<void> {
        validateCollectionName(collectionName);
        validateConnected(this._isConnected);
        
        try {
            const collection = this.getCollection(collectionName);
            
            // Validate index definition
            if (!indexDefinition.name || !indexDefinition.fields || Object.keys(indexDefinition.fields).length === 0) {
                throw new ConfigurationError('Invalid index definition: name and fields are required');
            }
            
            // Create the index
            await collection.createIndex(
                indexDefinition.fields,
                {
                    name: indexDefinition.name,
                    ...indexDefinition.options
                }
            );
            
            logDebug(`Created index: ${indexDefinition.name} on collection: ${collectionName}`);
        } catch (error) {
            logError(`Failed to create index for collection: ${collectionName}`, error);
            throw new QueryError(`Failed to create index: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Ensures a collection exists.
     * In MongoDB, collections are created implicitly when first used,
     * but this method can be used to explicitly create a collection with options.
     * @param collectionName The logical name of the collection.
     * @param options Optional creation options.
     */
    async ensureSchema(collectionName: string, options?: { 
        validator?: object;
        validationLevel?: 'off' | 'strict' | 'moderate';
        validationAction?: 'error' | 'warn';
        [key: string]: any;
    }): Promise<void> {
        validateCollectionName(collectionName);
        validateConnected(this._isConnected);
        
        try {
            const db = this.db as Db;
            
            // Check if collection exists
            const collections = await db.listCollections({ name: collectionName }).toArray();
            
            if (collections.length === 0) {
                // Collection doesn't exist, create it
                await db.createCollection(collectionName, options);
                logDebug(`Created collection: ${collectionName}`);
            } else if (options) {
                // Collection exists, but we might want to modify its options
                // Note: MongoDB doesn't provide a direct way to modify collection options
                // For validation, we can use db.command() to modify the collection
                if (options.validator) {
                    await db.command({
                        collMod: collectionName,
                        validator: options.validator,
                        validationLevel: options.validationLevel || 'strict',
                        validationAction: options.validationAction || 'error'
                    });
                    logDebug(`Updated collection validator: ${collectionName}`);
                }
            }
        } catch (error) {
            logError(`Failed to ensure schema for collection: ${collectionName}`, error);
            throw new QueryError(`Failed to ensure schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Private helper methods

    /**
     * Gets a MongoDB collection
     * @param collectionName The name of the collection
     * @returns The MongoDB collection
     */
    private getCollection(collectionName: string): Collection {
        if (!this.db) {
            throw new ConnectionError('Database is not connected');
        }
        
        return this.db.collection(collectionName);
    }

    /**
     * Creates a filter for finding a document by ID
     * @param id The ID of the document
     * @returns A MongoDB filter object
     */
    private createIdFilter(id: string): Filter<Document> {
        // Check if ID is a valid ObjectId
        if (this.isValidObjectId(id)) {
            return { $or: [{ _id: new ObjectId(id) }, { _id: id }, { id }] };
        }
        
        // Regular string ID
        return { $or: [{ _id: id }, { id }] };
    }

    /**
     * Normalizes a MongoDB document by converting _id to a string
     * and ensuring the id field exists
     * @param document The MongoDB document
     * @returns Normalized document with id field
     */
    private normalizeDocument(document: Document | null): Document | null {
        if (!document) {
            return null;
        }
        
        const normalizedDoc: Document = { ...document };
        
        // Convert _id to string and ensure id field exists
        if (normalizedDoc._id) {
            // Handle ObjectId and other complex types
            if (normalizedDoc._id instanceof ObjectId) {
                const idStr = normalizedDoc._id.toString();
                
                // Only set id if it doesn't already exist
                if (!normalizedDoc.id) {
                    normalizedDoc.id = idStr;
                }
                
                // Convert _id to string (this is optional, but ensures consistent types)
                normalizedDoc._id = idStr;
            } else if (typeof normalizedDoc._id !== 'string' && normalizedDoc._id !== null) {
                // Convert any other non-string _id to string
                const idStr = String(normalizedDoc._id);
                
                // Only set id if it doesn't already exist
                if (!normalizedDoc.id) {
                    normalizedDoc.id = idStr;
                }
                
                // Convert _id to string
                normalizedDoc._id = idStr;
            } else if (!normalizedDoc.id && normalizedDoc._id !== null) {
                // If _id is already a string but id doesn't exist, set it
                normalizedDoc.id = normalizedDoc._id as string;
            }
        }
        
        return normalizedDoc;
    }

    /**
     * Checks if a string is a valid MongoDB ObjectId
     * @param id The string to check
     * @returns True if the string is a valid ObjectId, false otherwise
     */
    private isValidObjectId(id: string): boolean {
        if (!id || typeof id !== 'string') {
            return false;
        }
        
        try {
            // Use a more strict validation than just ObjectId.isValid
            // Ensure it's a 24-character hex string that MongoDB will accept as an ObjectId
            if (id.match(/^[0-9a-fA-F]{24}$/)) {
                const objectId = new ObjectId(id);
                return objectId.toString() === id;
            }
            
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     * Builds a MongoDB query from QueryOptions
     * @param queryOptions The query options
     * @returns MongoDB query components (filter, sort, skip, limit)
     */
    private buildMongoQuery(queryOptions: QueryOptions): {
        filter: Filter<Document>;
        sort?: Sort;
        skip?: number;
        limit?: number;
    } {
        // Build filter
        const filter: Filter<Document> = {};
        
        if (queryOptions.filters && Object.keys(queryOptions.filters).length > 0) {
            // Add all filters
            Object.entries(queryOptions.filters).forEach(([field, condition]) => {
                if (typeof condition !== 'object' || condition === null) {
                    // Simple equality filter
                    filter[field] = condition;
                } else {
                    // Operator-based filter
                    const { operator, value } = condition as { operator: string; value: any };
                    
                    switch (operator) {
                    case 'eq':
                        filter[field] = value;
                        break;
                            
                    case 'ne':
                        filter[field] = { $ne: value };
                        break;
                            
                    case 'gt':
                        filter[field] = { $gt: value };
                        break;
                            
                    case 'gte':
                        filter[field] = { $gte: value };
                        break;
                            
                    case 'lt':
                        filter[field] = { $lt: value };
                        break;
                            
                    case 'lte':
                        filter[field] = { $lte: value };
                        break;
                            
                    case 'in':
                        filter[field] = { $in: value };
                        break;
                            
                    case 'nin':
                        filter[field] = { $nin: value };
                        break;
                            
                    case 'regex':
                        filter[field] = { $regex: value, $options: 'i' };
                        break;
                            
                    default:
                        logWarn(`Unsupported operator: ${operator}`);
                    }
                }
            });
        }
        
        // Build sort specification
        let sort: Sort | undefined = undefined;
        
        if (queryOptions.sortBy && queryOptions.sortBy.length > 0) {
            sort = {};
            
            queryOptions.sortBy.forEach(sortField => {
                sort![sortField.field] = sortField.order === 'asc' ? 1 : -1;
            });
        }
        
        // Pagination
        const skip = queryOptions.offset;
        const limit = queryOptions.limit;
        
        return { filter, sort, skip, limit };
    }

    /**
     * Masks sensitive information in a connection string
     * @param connectionString The MongoDB connection string
     * @returns A masked version of the connection string
     */
    private maskConnectionString(connectionString: string): string {
        try {
            const url = new URL(connectionString);
            
            // If there's authentication info, mask it
            if (url.username || url.password) {
                url.username = url.username ? '***' : '';
                url.password = url.password ? '***' : '';
            }
            
            return url.toString();
        } catch (e) {
            // If parsing fails, return a generic masked string
            return connectionString.replace(/:\/\/[^@]*@/, '://***:***@');
        }
    }
}
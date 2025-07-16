/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.07.16
 * https://github.com/biggs3d/McpMemoryServer
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command, HeadObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { IDatabaseProvider, QueryOptions } from '../database-provider.interface.js';
import { ConnectionError, QueryError } from '../utils/error.utils.js';
import { validateCollectionName, validateId, validateConnected, assertDefined, assertNotEmpty } from '../utils/validation.utils.js';
import { logDebug, logError, logInfo, logWarn } from '../utils/logging.utils.js';
import { applyFilters, applySorting, applyPagination, deepClone } from '../utils/query.utils.js';

/**
 * Configuration options for the CloudflareR2Provider
 */
export interface CloudflareR2ProviderConfig {
    /** Cloudflare R2 endpoint URL */
    endpoint: string;
    /** R2 access key ID */
    accessKeyId: string;
    /** R2 secret access key */
    secretAccessKey: string;
    /** R2 bucket name */
    bucketName: string;
    /** Region (should be 'auto' for Cloudflare R2) */
    region?: string;
    /** Optional prefix for object keys */
    keyPrefix?: string;
}

/**
 * A Cloudflare R2 database provider that stores data as JSON objects in R2 buckets.
 * Each item is stored as a separate object with collection/id as the key structure.
 */
export class CloudflareR2Provider implements IDatabaseProvider {
    private _isConnected: boolean = false;
    private s3Client: S3Client | null = null;
    private config: Required<CloudflareR2ProviderConfig>;

    /**
     * Initialize the CloudflareR2Provider with configuration
     * @param config Configuration for the CloudflareR2Provider
     */
    constructor(config: CloudflareR2ProviderConfig) {
        assertDefined(config, 'config');
        assertNotEmpty(config.endpoint, 'endpoint');
        assertNotEmpty(config.accessKeyId, 'accessKeyId');
        assertNotEmpty(config.secretAccessKey, 'secretAccessKey');
        assertNotEmpty(config.bucketName, 'bucketName');
        
        this.config = {
            region: 'auto',
            keyPrefix: '',
            ...config
        };
    }

    /**
     * Connect to Cloudflare R2
     */
    async connect(config?: Partial<CloudflareR2ProviderConfig>): Promise<void> {
        try {
            // Merge any runtime config
            if (config) {
                Object.assign(this.config, config);
            }

            // Initialize S3 client configured for Cloudflare R2
            this.s3Client = new S3Client({
                region: this.config.region,
                endpoint: this.config.endpoint,
                credentials: {
                    accessKeyId: this.config.accessKeyId,
                    secretAccessKey: this.config.secretAccessKey
                },
                forcePathStyle: true // Required for R2 compatibility
            });

            // Test connection by attempting to list objects
            await this.s3Client.send(new ListObjectsV2Command({
                Bucket: this.config.bucketName,
                MaxKeys: 1
            }));

            this._isConnected = true;
            logInfo(`Connected to Cloudflare R2 bucket: ${this.config.bucketName}`);
        } catch (error) {
            this._isConnected = false;
            logError('Failed to connect to Cloudflare R2:', error);
            throw new ConnectionError(`Failed to connect to Cloudflare R2: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Disconnect from Cloudflare R2
     */
    async disconnect(): Promise<void> {
        if (this.s3Client) {
            this.s3Client.destroy();
            this.s3Client = null;
        }
        this._isConnected = false;
        logInfo('Disconnected from Cloudflare R2');
    }

    /**
     * Check if connected to R2
     */
    isConnected(): boolean {
        return this._isConnected;
    }

    /**
     * Generate object key from collection and item ID
     */
    private getObjectKey(collectionName: string, id: string): string {
        const prefix = this.config.keyPrefix ? `${this.config.keyPrefix}/` : '';
        return `${prefix}${collectionName}/${id}.json`;
    }

    /**
     * Create a new item in the specified collection
     * @param collectionName The name of the collection
     * @param item The item to create
     * @returns The created item with generated ID if none provided
     */
    async create<T_Item = any, T_Return = T_Item>(collectionName: string, item: T_Item): Promise<T_Return> {
        validateConnected(this._isConnected);
        validateCollectionName(collectionName);
        assertDefined(item, 'item');

        const id = (item as any).id || uuidv4();
        const itemWithId = { ...item, id } as T_Return;
        const key = this.getObjectKey(collectionName, id);

        try {
            const command = new PutObjectCommand({
                Bucket: this.config.bucketName,
                Key: key,
                Body: JSON.stringify(itemWithId),
                ContentType: 'application/json'
            });

            await this.s3Client!.send(command);
            
            logDebug(`Created item in R2: ${key}`);
            return deepClone(itemWithId);
        } catch (error) {
            logError(`Failed to create item in R2: ${key}`, error);
            throw new QueryError(`Failed to create item: ${error}`);
        }
    }

    /**
     * Read an item from the specified collection
     * @param collectionName The name of the collection
     * @param id The unique identifier of the item
     * @returns The item if found, null if not found
     */
    async read<T_Return = any>(collectionName: string, id: string): Promise<T_Return | null> {
        validateConnected(this._isConnected);
        validateCollectionName(collectionName);
        validateId(id);

        const key = this.getObjectKey(collectionName, id);

        try {
            const command = new GetObjectCommand({
                Bucket: this.config.bucketName,
                Key: key
            });

            const response = await this.s3Client!.send(command);
            
            if (!response.Body) {
                throw new QueryError(`Object not found: ${key}`);
            }

            const content = await response.Body.transformToString();
            const item = JSON.parse(content);
            
            logDebug(`Read item from R2: ${key}`);
            return deepClone(item);
        } catch (error) {
            if (error && typeof error === 'object' && 
                ((error as any).name === 'NoSuchKey' || (error as any).Code === 'NoSuchKey' || 
                 (error as any).name === 'NotFound' || (error as any).Code === 'NotFound')) {
                logDebug(`Item not found in R2: ${key}`);
                return null;
            }
            logError(`Failed to read item from R2: ${key}`, error);
            throw new QueryError(`Failed to read item: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Update an item in the specified collection
     * @param collectionName The name of the collection
     * @param id The unique identifier of the item
     * @param item The updated item data
     * @returns The updated item if successful, null if the item doesn't exist
     */
    async update<T_Item = any, T_Return = T_Item>(collectionName: string, id: string, item: Partial<T_Item>): Promise<T_Return | null> {
        validateConnected(this._isConnected);
        validateCollectionName(collectionName);
        validateId(id);
        assertDefined(item, 'item');

        // Check if item exists using HeadObject (more efficient than full read)
        const key = this.getObjectKey(collectionName, id);
        try {
            await this.s3Client!.send(new HeadObjectCommand({
                Bucket: this.config.bucketName,
                Key: key
            }));
        } catch (error) {
            if (error && typeof error === 'object' && 
                ((error as any).name === 'NoSuchKey' || (error as any).Code === 'NoSuchKey' || 
                 (error as any).name === 'NotFound' || (error as any).Code === 'NotFound')) {
                logDebug(`Item not found for update in R2: ${key}`);
                return null;
            }
            logError(`Failed to check item existence in R2: ${key}`, error);
            throw new QueryError(`Failed to check item existence: ${error instanceof Error ? error.message : String(error)}`);
        }

        const updatedItem = { ...item, id } as T_Return;

        try {
            const command = new PutObjectCommand({
                Bucket: this.config.bucketName,
                Key: key,
                Body: JSON.stringify(updatedItem),
                ContentType: 'application/json'
            });

            await this.s3Client!.send(command);
            
            logDebug(`Updated item in R2: ${key}`);
            return deepClone(updatedItem);
        } catch (error) {
            logError(`Failed to update item in R2: ${key}`, error);
            throw new QueryError(`Failed to update item: ${error}`);
        }
    }

    /**
     * Delete an item from the specified collection
     */
    async delete(collectionName: string, id: string): Promise<boolean> {
        validateConnected(this._isConnected);
        validateCollectionName(collectionName);
        validateId(id);

        const key = this.getObjectKey(collectionName, id);

        try {
            const command = new DeleteObjectCommand({
                Bucket: this.config.bucketName,
                Key: key
            });

            await this.s3Client!.send(command);
            
            logDebug(`Deleted item from R2: ${key}`);
            return true;
        } catch (error) {
            if (error && typeof error === 'object' && ((error as any).name === 'NoSuchKey' || (error as any).Code === 'NoSuchKey')) {
                return false;
            }
            logError(`Failed to delete item from R2: ${key}`, error);
            throw new QueryError(`Failed to delete item: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Query items in the specified collection with optional filtering
     * 
     * ⚠️ **Performance Warning**: This method is a wrapper around `list()` and
     * inherits the same performance limitations. All filtering, sorting, and
     * pagination are performed client-side after fetching all items.
     * 
     * @param collectionName The name of the collection
     * @param options Query options (applied client-side after fetching all items)
     * @returns Array of items matching the query criteria
     */
    async query<T_Return = any>(collectionName: string, options: QueryOptions = {}): Promise<T_Return[]> {
        return this.list<T_Return>(collectionName, options);
    }

    /**
     * List items in the specified collection with optional filtering
     * 
     * ⚠️ **Performance Warning**: This method fetches ALL objects in the collection
     * into memory before applying filters, sorting, and pagination. This approach
     * is not suitable for large collections (>1000 items) as it will be slow,
     * memory-intensive, and expensive in terms of API requests.
     * 
     * For large collections, consider:
     * - Using server-side filtering if supported
     * - Implementing pagination at the application level
     * - Using a database-native provider for complex queries
     * 
     * @param collectionName The name of the collection
     * @param options Query options (applied client-side after fetching all items)
     * @returns Array of items matching the query criteria
     */
    async list<T_Return = any>(collectionName: string, options: QueryOptions = {}): Promise<T_Return[]> {
        validateConnected(this._isConnected);
        validateCollectionName(collectionName);

        const prefix = this.config.keyPrefix ? `${this.config.keyPrefix}/` : '';
        const collectionPrefix = `${prefix}${collectionName}/`;
        const items: any[] = [];

        try {
            let continuationToken: string | undefined;
            
            do {
                const command = new ListObjectsV2Command({
                    Bucket: this.config.bucketName,
                    Prefix: collectionPrefix,
                    ContinuationToken: continuationToken
                });

                const response = await this.s3Client!.send(command);
                
                if (response.Contents) {
                    // Fetch all objects in parallel
                    const fetchPromises = response.Contents.map(async (obj) => {
                        if (obj.Key) {
                            try {
                                const getCommand = new GetObjectCommand({
                                    Bucket: this.config.bucketName,
                                    Key: obj.Key
                                });
                                const objResponse = await this.s3Client!.send(getCommand);
                                if (objResponse.Body) {
                                    const content = await objResponse.Body.transformToString();
                                    return JSON.parse(content);
                                }
                            } catch (error) {
                                logWarn(`Failed to fetch object ${obj.Key}:`, error);
                            }
                        }
                        return null;
                    });

                    const fetchedItems = await Promise.all(fetchPromises);
                    items.push(...fetchedItems.filter(item => item !== null));
                }

                continuationToken = response.NextContinuationToken;
            } while (continuationToken);

            // Apply query options
            let filteredItems = items;
            if (options.filters) {
                filteredItems = applyFilters(filteredItems, options);
            }
            if (options.sortBy) {
                filteredItems = applySorting(filteredItems, options);
            }
            if (options.limit || options.offset) {
                filteredItems = applyPagination(filteredItems, options);
            }

            logDebug(`Listed ${filteredItems.length} items from R2 collection: ${collectionName}`);
            return filteredItems.map(item => deepClone(item)) as T_Return[];
        } catch (error) {
            logError(`Failed to list items from R2 collection: ${collectionName}`, error);
            throw new QueryError(`Failed to list items: ${error}`);
        }
    }

    /**
     * List all collections (by finding unique prefixes)
     */
    async listCollections(): Promise<string[]> {
        validateConnected(this._isConnected);

        const prefix = this.config.keyPrefix ? `${this.config.keyPrefix}/` : '';
        const collections = new Set<string>();

        try {
            let continuationToken: string | undefined;
            
            do {
                const command = new ListObjectsV2Command({
                    Bucket: this.config.bucketName,
                    Prefix: prefix,
                    ContinuationToken: continuationToken
                });

                const response = await this.s3Client!.send(command);
                
                if (response.Contents) {
                    response.Contents.forEach(obj => {
                        if (obj.Key) {
                            const relativePath = obj.Key.substring(prefix.length);
                            const slashIndex = relativePath.indexOf('/');
                            if (slashIndex > 0) {
                                const collectionName = relativePath.substring(0, slashIndex);
                                collections.add(collectionName);
                            }
                        }
                    });
                }

                continuationToken = response.NextContinuationToken;
            } while (continuationToken);

            const collectionList = Array.from(collections);
            logDebug(`Found ${collectionList.length} collections in R2`);
            return collectionList;
        } catch (error) {
            logError('Failed to list collections from R2:', error);
            throw new QueryError(`Failed to list collections: ${error}`);
        }
    }

    /**
     * Delete all items in the specified collection
     */
    async deleteCollection(collectionName: string): Promise<void> {
        validateConnected(this._isConnected);
        validateCollectionName(collectionName);

        const prefix = this.config.keyPrefix ? `${this.config.keyPrefix}/` : '';
        const collectionPrefix = `${prefix}${collectionName}/`;

        try {
            let continuationToken: string | undefined;
            
            do {
                const listCommand = new ListObjectsV2Command({
                    Bucket: this.config.bucketName,
                    Prefix: collectionPrefix,
                    ContinuationToken: continuationToken
                });

                const response = await this.s3Client!.send(listCommand);
                
                if (response.Contents && response.Contents.length > 0) {
                    // Use bulk delete for better performance (up to 1000 objects per request)
                    const objectsToDelete = response.Contents
                        .filter(obj => obj.Key)
                        .map(obj => ({ Key: obj.Key! }));

                    if (objectsToDelete.length > 0) {
                        const deleteCommand = new DeleteObjectsCommand({
                            Bucket: this.config.bucketName,
                            Delete: {
                                Objects: objectsToDelete
                            }
                        });

                        await this.s3Client!.send(deleteCommand);
                    }
                }

                continuationToken = response.NextContinuationToken;
            } while (continuationToken);

            logInfo(`Deleted collection from R2: ${collectionName}`);
        } catch (error) {
            logError(`Failed to delete collection from R2: ${collectionName}`, error);
            throw new QueryError(`Failed to delete collection: ${error}`);
        }
    }

    /**
     * Check if collection exists (optimized to avoid listing all collections)
     * @param collectionName The name of the collection to check
     * @returns true if the collection has at least one item, false otherwise
     */
    async collectionExists(collectionName: string): Promise<boolean> {
        validateConnected(this._isConnected);
        validateCollectionName(collectionName);

        const prefix = this.config.keyPrefix ? `${this.config.keyPrefix}/` : '';
        const collectionPrefix = `${prefix}${collectionName}/`;

        try {
            const command = new ListObjectsV2Command({
                Bucket: this.config.bucketName,
                Prefix: collectionPrefix,
                MaxKeys: 1
            });

            const response = await this.s3Client!.send(command);
            return (response.KeyCount || 0) > 0;
        } catch (error) {
            logError(`Failed to check collection existence in R2: ${collectionName}`, error);
            throw new QueryError(`Failed to check collection existence: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Get collection statistics
     */
    async getCollectionStats(collectionName: string): Promise<{ count: number; size: number }> {
        validateConnected(this._isConnected);
        validateCollectionName(collectionName);

        const prefix = this.config.keyPrefix ? `${this.config.keyPrefix}/` : '';
        const collectionPrefix = `${prefix}${collectionName}/`;
        let count = 0;
        let size = 0;

        try {
            let continuationToken: string | undefined;
            
            do {
                const command = new ListObjectsV2Command({
                    Bucket: this.config.bucketName,
                    Prefix: collectionPrefix,
                    ContinuationToken: continuationToken
                });

                const response = await this.s3Client!.send(command);
                
                if (response.Contents) {
                    count += response.Contents.length;
                    size += response.Contents.reduce((total, obj) => total + (obj.Size || 0), 0);
                }

                continuationToken = response.NextContinuationToken;
            } while (continuationToken);

            return { count, size };
        } catch (error) {
            logError(`Failed to get collection stats from R2: ${collectionName}`, error);
            throw new QueryError(`Failed to get collection stats: ${error}`);
        }
    }
}
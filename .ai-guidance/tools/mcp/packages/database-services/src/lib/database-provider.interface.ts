/**
 * Defines the structure for query options.
 * @template T_CustomFilters Allows providers to define their own specific filter structures.
 */
export interface QueryOptions<T_CustomFilters = any> {
    filters?: {
        [key: string]: any | { // Basic value match
            // Standard operators
            operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'regex';
            value: any;
        }
    };
    sortBy?: Array<{ field: string; order: 'asc' | 'desc' }>;
    limit?: number;
    offset?: number;
    
    /** Provider-specific custom filter options. */
    customFilters?: T_CustomFilters;
}

/**
 * Interface defining the contract for database providers.
 */
export interface IDatabaseProvider {
    /**
     * Connects to the database.
     * Primary configuration should be passed to the provider's constructor.
     * This method is for final initialization or applying dynamic configuration overrides.
     * @param config Optional: Provider-specific configuration override or dynamic re-configuration parameters.
     *               If not provided, the provider should use configuration set during its instantiation or previous connect calls.
     * @throws {ConnectionError} if connection fails.
     * @throws {ConfigurationError} if essential configuration is missing or invalid.
     */
    connect(config?: any): Promise<void>;

    /**
     * Disconnects from the database, releasing any resources.
     * Should be idempotent (safe to call multiple times if already disconnected).
     */
    disconnect(): Promise<void>;

    /**
     * Checks if the database connection is currently active and usable.
     * @returns true if connected, false otherwise.
     */
    isConnected(): boolean;

    /**
     * Creates a new item in the specified collection/table.
     * @param collectionName The logical name of the collection or table.
     * @param data The item data to create. T_Item is the type of the input data.
     *             If data includes an 'id' field, providers may use it; otherwise, they should generate one.
     * @returns A promise that resolves to the created item. This item may include database-generated fields
     *          (e.g., auto-increment ID, timestamps). T_Return is the type of the returned item.
     * @throws {QueryError} if the operation fails (e.g., constraint violation, database error).
     * @throws {ConnectionError} if the provider is not connected.
     */
    create<T_Item, T_Return = T_Item>(collectionName: string, data: T_Item): Promise<T_Return>;

    /**
     * Reads an item by its unique identifier from the specified collection/table.
     * @param collectionName The logical name of the collection or table.
     * @param id The unique identifier of the item to retrieve.
     * @returns A promise that resolves to the found item, or null if no item matches the ID.
     *          T_Return is the type of the returned item.
     * @throws {QueryError} if the operation fails for reasons other than "not found" (e.g., database error).
     * @throws {ConnectionError} if the provider is not connected.
     */
    read<T_Return>(collectionName: string, id: string): Promise<T_Return | null>;

    /**
     * Updates an existing item by its unique identifier in the specified collection/table.
     * @param collectionName The logical name of the collection or table.
     * @param id The unique identifier of the item to update.
     * @param data A partial object containing the fields to update. T_Item is the base type of items in the collection.
     * @returns A promise that resolves to the updated item, or null if no item matches the ID.
     *          T_Return is the type of the returned item.
     * @throws {QueryError} if the update operation fails (e.g., database error, optimistic locking failure).
     * @throws {NotFoundError} if the item to update is not found (alternative to returning null).
     * @throws {ConnectionError} if the provider is not connected.
     */
    update<T_Item, T_Return = T_Item>(collectionName: string, id: string, data: Partial<T_Item>): Promise<T_Return | null>;

    /**
     * Deletes an item by its unique identifier from the specified collection/table.
     * @param collectionName The logical name of the collection or table.
     * @param id The unique identifier of the item to delete.
     * @returns A promise that resolves to true if the deletion was successful, or false if the item was not found.
     * @throws {QueryError} if the deletion fails for reasons other than "not found" (e.g., database error, foreign key constraint).
     * @throws {ConnectionError} if the provider is not connected.
     */
    delete(collectionName: string, id: string): Promise<boolean>;

    /**
     * Queries items from the specified collection/table based on given criteria.
     * @param collectionName The logical name of the collection or table.
     * @param queryOptions Defines the query using the QueryOptions interface.
     * @returns A promise that resolves to an array of found items. T_Return is the type of the items in the array.
     * @throws {QueryError} if the query execution fails.
     * @throws {ConnectionError} if the provider is not connected.
     */
    query<T_Return, T_CustomFilters = any>(collectionName: string, queryOptions: QueryOptions<T_CustomFilters>): Promise<T_Return[]>;

    // Optional: Transaction support (if applicable to the provider)
    /**
     * Begins a new transaction. Subsequent operations will be part of this transaction.
     * @throws {UnsupportedOperationError} if the provider does not support transactions.
     * @throws {TransactionError} if starting a transaction fails.
     */
    beginTransaction?(): Promise<void>;

    /**
     * Commits the current active transaction.
     * @throws {TransactionError} if committing fails or no transaction is active.
     */
    commitTransaction?(): Promise<void>;

    /**
     * Rolls back the current active transaction.
     * @throws {TransactionError} if rollback fails or no transaction is active.
     */
    rollbackTransaction?(): Promise<void>;

    // Optional: Schema/Index Management (if applicable and exposed)
    /**
     * Ensures an index exists on a given field (or set of fields) for a collection.
     * Implementation is provider-specific. May not be applicable to all providers (e.g., simple InMemory).
     * @param collectionName The logical name of the collection or table.
     * @param indexDefinition Definition of the index (e.g., field name, multiple fields, uniqueness).
     * @throws {UnsupportedOperationError} if not supported by the provider.
     */
    ensureIndex?(collectionName: string, indexDefinition: any): Promise<void>;

    /**
     * Ensures a collection/table exists and optionally conforms to a given schema.
     * Implementation is provider-specific. For SQL, this might involve table creation/alteration.
     * For NoSQL, it might create a collection or validate documents against a schema.
     * @param collectionName The logical name of the collection or table.
     * @param schemaDefinition Optional: Definition of the schema for the collection.
     * @throws {UnsupportedOperationError} if not supported by the provider.
     */
    ensureSchema?(collectionName: string, schemaDefinition?: any): Promise<void>;
}
/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.19
 * https://github.com/biggs3d/McpMemoryServer
 */

import { v4 as uuidv4 } from 'uuid';
// @ts-ignore - Using the installed @types/sqlite3
import sqlite3 from 'sqlite3';
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

// Define type for SQLite schema definition
export interface SQLiteColumnDefinition {
    name: string;
    type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'NULL';
    primaryKey?: boolean;
    notNull?: boolean;
    unique?: boolean;
    default?: any;
}

export interface SQLiteIndexDefinition {
    name: string;
    columns: string[];
    unique?: boolean;
}

export interface SQLiteSchemaDefinition {
    columns: SQLiteColumnDefinition[];
    indexes?: SQLiteIndexDefinition[];
}

/**
 * Configuration options for the SQLiteProvider
 */
export interface SQLiteProviderConfig {
    /** Path to the SQLite database file or ':memory:' for in-memory database */
    filePath: string;
    /** If true, foreign key constraints will be enforced */
    foreignKeys?: boolean;
}

/**
 * SQLite database provider implementation.
 * Uses the sqlite3 library to store data in a SQLite database.
 */
export class SQLiteProvider implements IDatabaseProvider {
    private db: sqlite3.Database | null = null;
    private _isConnected: boolean = false;
    private schemaMap: Map<string, SQLiteSchemaDefinition> = new Map();
    private inTransaction: boolean = false;
    private config: Required<SQLiteProviderConfig>;

    // Flag to indicate if SQLite is available in the current environment
    private isSQLiteAvailable: boolean = true;

    /**
     * Initialize the SQLiteProvider with configuration
     * @param config Configuration for the SQLiteProvider
     */
    constructor(config: SQLiteProviderConfig) {
        assertDefined(config, 'config');
        assertNotEmpty(config.filePath, 'filePath');
        
        this.config = {
            filePath: config.filePath,
            foreignKeys: config.foreignKeys ?? true
        };
        
        // Check if SQLite3 is available
        try {
            // This will throw an error if the SQLite3 module is not available
            // or incompatible with the current environment
            require('sqlite3');
        } catch (error) {
            this.isSQLiteAvailable = false;
            logWarn('SQLite3 module is not available or incompatible with this environment');
        }
        
        logDebug('SQLiteProvider initialized', { 
            config: this.config,
            isSQLiteAvailable: this.isSQLiteAvailable
        });
    }

    /**
     * Connect to the SQLite database.
     * This creates the database file if it doesn't exist.
     */
    async connect(): Promise<void> {
        logInfo('SQLiteProvider connecting to', { filePath: this.config.filePath });
        
        if (this._isConnected) {
            logWarn('SQLiteProvider is already connected');
            return;
        }
        
        // Check if SQLite is available
        if (!this.isSQLiteAvailable) {
            throw new ConnectionError('SQLite3 module is not available or incompatible with this environment');
        }
        
        try {
            this.db = await this.openDatabase();
            
            // Enable foreign keys if requested
            if (this.config.foreignKeys) {
                await this.execPromise('PRAGMA foreign_keys = ON;');
                logDebug('Foreign key constraints enabled');
            }
            
            this._isConnected = true;
            logInfo('SQLiteProvider connected successfully');
        } catch (error) {
            logError('Failed to connect SQLiteProvider', error);
            if (this.db) {
                this.db.close();
                this.db = null;
            }
            throw new ConnectionError(`Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Disconnect from the SQLite database.
     */
    async disconnect(): Promise<void> {
        logInfo('SQLiteProvider disconnecting');
        
        if (!this._isConnected || !this.db) {
            logWarn('SQLiteProvider is already disconnected');
            return;
        }
        
        try {
            // Close database connection
            await new Promise<void>((resolve, reject) => {
                this.db!.close((err: Error | null) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            
            this.db = null;
            this._isConnected = false;
            this.schemaMap.clear();
            logInfo('SQLiteProvider disconnected successfully');
        } catch (error) {
            logError('Failed to disconnect SQLiteProvider', error);
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
            // Clone the data to prevent external modifications
            const itemToStore = { ...data as any };
            
            // Ensure collection exists with columns for all properties in the data
            await this.ensureCollectionExists(collectionName, itemToStore);
            
            // Generate an ID if not provided
            if (!itemToStore.id) {
                itemToStore.id = uuidv4();
                logDebug(`Generated ID for new item: ${itemToStore.id}`);
            }
            
            // Extract non-primitive objects to be stored as JSON
            const { columns, values, placeholders } = this.extractColumnValues(itemToStore);
            
            // Construct the SQL query
            const sql = `INSERT INTO "${collectionName}" (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;
            
            // Execute the insert
            await this.runPromise(sql, values);
            logDebug(`Stored item with ID: ${itemToStore.id}`);
            
            // Return the created item
            return await this.read<T_Return>(collectionName, itemToStore.id) as T_Return;
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
            
            // Construct the SQL query
            const sql = `SELECT * FROM "${collectionName}" WHERE id = ?`;
            
            // Execute the query
            const row = await this.getPromise(sql, [id]);
            
            if (!row) {
                logDebug(`Item with ID ${id} not found in collection: ${collectionName}`);
                return null;
            }
            
            // Parse any JSON stored in string columns
            const parsedRow = this.parseRowJson(row);
            logDebug(`Found item with ID: ${id}`);
            
            return parsedRow as unknown as T_Return;
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
            
            // Check if item exists
            const existingItem = await this.read(collectionName, id);
            if (!existingItem) {
                logDebug(`Item with ID ${id} not found in collection: ${collectionName}`);
                return null;
            }
            
            // No fields to update
            if (Object.keys(data as object).length === 0) {
                return existingItem as unknown as T_Return;
            }
            
            // Prepare update data
            const updateData = { ...data as any };
            delete updateData.id; // Prevent updating ID
            
            // Ensure any new columns exist in the table
            await this.ensureColumnsExist(collectionName, updateData);
            
            // Extract non-primitive objects to be stored as JSON
            const { columns, values, placeholders } = this.extractColumnValues(updateData, ', ');
            
            // Add the ID to the values array for the WHERE clause
            values.push(id);
            
            // Construct the SQL query
            const sql = `UPDATE "${collectionName}" SET ${columns.map((col, i) => `${col} = ${placeholders[i]}`).join(', ')} WHERE id = ?`;
            
            // Execute the update
            const result = await this.runPromise(sql, values);
            
            if (result.changes === 0) {
                logDebug(`No changes made to item with ID ${id}`);
                return null;
            }
            
            logDebug(`Updated item with ID: ${id}`);
            
            // Return the updated item
            return await this.read<T_Return>(collectionName, id);
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
            
            // Construct the SQL query
            const sql = `DELETE FROM "${collectionName}" WHERE id = ?`;
            
            // Execute the delete
            const result = await this.runPromise(sql, [id]);
            
            const deleted = result.changes > 0;
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
            if (!await this.collectionExists(collectionName)) {
                logDebug(`Collection not found: ${collectionName}`);
                return [];
            }
            
            // Build the SQL query
            const { sql, parameters } = this.buildSelectQuery(collectionName, queryOptions);
            
            // Execute the query
            const rows = await this.allPromise(sql, parameters);
            
            // Parse any JSON stored in string columns
            const parsedRows = rows.map(row => this.parseRowJson(row));
            
            logDebug(`Query returned ${parsedRows.length} items`);
            
            return parsedRows as unknown as T_Return[];
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
        
        if (this.inTransaction) {
            throw new TransactionError('Transaction already in progress');
        }
        
        try {
            await this.execPromise('BEGIN TRANSACTION');
            this.inTransaction = true;
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
        
        if (!this.inTransaction) {
            throw new TransactionError('No transaction in progress');
        }
        
        try {
            await this.execPromise('COMMIT');
            this.inTransaction = false;
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
        
        if (!this.inTransaction) {
            throw new TransactionError('No transaction in progress');
        }
        
        try {
            await this.execPromise('ROLLBACK');
            this.inTransaction = false;
            logDebug('Transaction rolled back');
        } catch (error) {
            logError('Failed to rollback transaction', error);
            throw new TransactionError(`Failed to rollback transaction: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Ensures a collection/table exists and optionally conforms to a given schema.
     * @param collectionName The logical name of the collection or table.
     * @param schemaDefinition Optional: Definition of the schema for the collection.
     */
    async ensureSchema(collectionName: string, schemaDefinition?: SQLiteSchemaDefinition): Promise<void> {
        validateCollectionName(collectionName);
        validateConnected(this._isConnected);
        
        try {
            const exists = await this.collectionExists(collectionName);
            
            if (!exists) {
                // If no schema is provided, use a default schema with id column
                const schema = schemaDefinition || {
                    columns: [
                        { name: 'id', type: 'TEXT', primaryKey: true, notNull: true }
                    ]
                };
                
                // Create the table
                await this.createTable(collectionName, schema);
                
                // Store the schema
                this.schemaMap.set(collectionName, schema);
                
                logDebug(`Created collection: ${collectionName}`);
            } else if (schemaDefinition) {
                // Table exists, but we want to ensure the schema matches
                // This is a more complex operation that may require altering the table
                logWarn(`Collection ${collectionName} already exists, schema validation not implemented`);
                // Future implementation could check existing columns and add missing ones
            }
        } catch (error) {
            logError(`Failed to ensure schema for collection: ${collectionName}`, error);
            throw new QueryError(`Failed to ensure schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Ensures an index exists on a given field (or set of fields) for a collection.
     * @param collectionName The logical name of the collection or table.
     * @param indexDefinition Definition of the index.
     */
    async ensureIndex(collectionName: string, indexDefinition: SQLiteIndexDefinition): Promise<void> {
        validateCollectionName(collectionName);
        validateConnected(this._isConnected);
        
        try {
            // Check if collection exists
            if (!await this.collectionExists(collectionName)) {
                throw new QueryError(`Collection not found: ${collectionName}`);
            }
            
            // Validate index definition
            if (!indexDefinition.name || !indexDefinition.columns || indexDefinition.columns.length === 0) {
                throw new ConfigurationError('Invalid index definition: name and columns are required');
            }
            
            // Create the index
            const uniqueClause = indexDefinition.unique ? 'UNIQUE' : '';
            const columnsStr = indexDefinition.columns.map(col => `"${col}"`).join(', ');
            const sql = `CREATE ${uniqueClause} INDEX IF NOT EXISTS "${indexDefinition.name}" ON "${collectionName}" (${columnsStr})`;
            
            await this.execPromise(sql);
            logDebug(`Created index: ${indexDefinition.name} on collection: ${collectionName}`);
        } catch (error) {
            logError(`Failed to create index for collection: ${collectionName}`, error);
            throw new QueryError(`Failed to create index: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Private helper methods

    /**
     * Opens a database connection
     */
    private openDatabase(): Promise<sqlite3.Database> {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.config.filePath, (err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(db);
                }
            });
        });
    }

    /**
     * Executes a SQL statement that doesn't return results
     * @param sql SQL statement to execute
     * @param params Parameters for the SQL statement
     * @returns Promise that resolves when the statement is executed
     */
    private execPromise(sql: string, params: any[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new ConnectionError('Database is not connected'));
                return;
            }
            
            this.db.exec(sql, (err: Error | null) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Runs a SQL statement that doesn't return results
     * @param sql SQL statement to execute
     * @param params Parameters for the SQL statement
     * @returns Promise that resolves with the statement result
     */
    private runPromise(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new ConnectionError('Database is not connected'));
                return;
            }
            
            this.db.run(sql, params, function(this: any, err: Error | null) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this);
                }
            });
        });
    }

    /**
     * Executes a SQL query and returns the first row
     * @param sql SQL query to execute
     * @param params Parameters for the SQL query
     * @returns Promise that resolves with the first row or undefined if no rows
     */
    private getPromise(sql: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new ConnectionError('Database is not connected'));
                return;
            }
            
            this.db.get(sql, params, (err: Error | null, row: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Executes a SQL query and returns all rows
     * @param sql SQL query to execute
     * @param params Parameters for the SQL query
     * @returns Promise that resolves with all rows
     */
    private allPromise(sql: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new ConnectionError('Database is not connected'));
                return;
            }
            
            this.db.all(sql, params, (err: Error | null, rows: any[]) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Checks if a collection (table) exists
     * @param collectionName The name of the collection
     * @returns True if exists, false otherwise
     */
    private async collectionExists(collectionName: string): Promise<boolean> {
        try {
            const sql = 'SELECT name FROM sqlite_master WHERE type=\'table\' AND name = ?';
            const row = await this.getPromise(sql, [collectionName]);
            return Boolean(row);
        } catch (error) {
            logError(`Failed to check if collection exists: ${collectionName}`, error);
            throw new QueryError(`Failed to check if collection exists: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Ensures a collection (table) exists, creating it if it doesn't
     * This method now automatically adds columns for properties in the data
     * @param collectionName The name of the collection
     * @param data Optional data to use for schema inference
     */
    private async ensureCollectionExists(collectionName: string, data?: Record<string, any>): Promise<void> {
        const exists = await this.collectionExists(collectionName);
        
        if (!exists) {
            // If we have data, build a schema from it
            if (data && typeof data === 'object') {
                // Start with ID column
                const columns: SQLiteColumnDefinition[] = [
                    { name: 'id', type: 'TEXT', primaryKey: true, notNull: true }
                ];
                
                // Add columns for each property in the data
                for (const [key, value] of Object.entries(data)) {
                    // Skip id since we already have it
                    if (key === 'id') continue;
                    
                    // Determine column type based on value type
                    let type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'NULL' = 'TEXT';
                    
                    if (typeof value === 'number') {
                        // Use INTEGER for integers, REAL for floats
                        type = Number.isInteger(value) ? 'INTEGER' : 'REAL';
                    } else if (value === null) {
                        type = 'NULL';
                    } else if (typeof value === 'boolean') {
                        // SQLite doesn't have boolean, use INTEGER
                        type = 'INTEGER';
                    } else if (typeof value === 'object') {
                        // Store objects as JSON strings
                        type = 'TEXT';
                    }
                    
                    columns.push({ name: key, type });
                }
                
                // Create schema with inferred columns
                await this.ensureSchema(collectionName, { columns });
            } else {
                // No data, use default schema
                await this.ensureSchema(collectionName);
            }
        } else if (data) {
            // Table exists, check if we need to add new columns
            await this.ensureColumnsExist(collectionName, data);
        }
    }

    /**
     * Creates a table with the given schema
     * @param collectionName The name of the collection
     * @param schema The schema definition
     */
    private async createTable(collectionName: string, schema: SQLiteSchemaDefinition): Promise<void> {
        // Build the CREATE TABLE statement
        const columnDefs = schema.columns.map(col => {
            let def = `"${col.name}" ${col.type}`;
            
            if (col.primaryKey) {
                def += ' PRIMARY KEY';
            }
            
            if (col.notNull) {
                def += ' NOT NULL';
            }
            
            if (col.unique) {
                def += ' UNIQUE';
            }
            
            if (col.default !== undefined) {
                if (typeof col.default === 'string') {
                    def += ` DEFAULT '${col.default}'`;
                } else if (col.default === null) {
                    def += ' DEFAULT NULL';
                } else {
                    def += ` DEFAULT ${col.default}`;
                }
            }
            
            return def;
        }).join(', ');
        
        const sql = `CREATE TABLE IF NOT EXISTS "${collectionName}" (${columnDefs})`;
        
        await this.execPromise(sql);
        
        // Create any indexes
        if (schema.indexes && schema.indexes.length > 0) {
            for (const indexDef of schema.indexes) {
                await this.ensureIndex(collectionName, indexDef);
            }
        }
    }

    /**
     * Extracts columns and values from an object, JSON-stringifying objects
     * @param obj The object to extract from
     * @param paramPrefix Optional prefix for parameter placeholders
     * @returns Object with columns, values, and placeholders arrays
     */
    private extractColumnValues(obj: Record<string, any>, paramPrefix: string = ''): { 
        columns: string[]; 
        values: any[]; 
        placeholders: string[];
    } {
        const columns: string[] = [];
        const values: any[] = [];
        const placeholders: string[] = [];
        
        for (const [key, value] of Object.entries(obj)) {
            columns.push(`"${key}"`);
            
            // Handle non-primitive types by converting to JSON
            if (value !== null && typeof value === 'object') {
                values.push(JSON.stringify(value));
            } else {
                values.push(value);
            }
            
            placeholders.push(`?${paramPrefix}`);
        }
        
        return { columns, values, placeholders };
    }

    /**
     * Builds a SELECT query from QueryOptions
     * @param collectionName The name of the collection
     * @param queryOptions The query options
     * @returns Object with SQL query and parameters
     */
    private buildSelectQuery(collectionName: string, queryOptions: QueryOptions): { 
        sql: string; 
        parameters: any[];
    } {
        const parameters: any[] = [];
        const filterClauses: string[] = [];
        
        // Basic query
        let sql = `SELECT * FROM "${collectionName}"`;
        
        // Apply filters
        if (queryOptions.filters && Object.keys(queryOptions.filters).length > 0) {
            Object.entries(queryOptions.filters).forEach(([field, condition]) => {
                if (typeof condition !== 'object' || condition === null) {
                    // Simple equality filter
                    filterClauses.push(`"${field}" = ?`);
                    parameters.push(condition);
                } else {
                    // Operator-based filter
                    const { operator, value } = condition as { operator: string; value: any };
                    
                    switch (operator) {
                    case 'eq':
                        filterClauses.push(`"${field}" = ?`);
                        parameters.push(value);
                        break;
                            
                    case 'ne':
                        filterClauses.push(`"${field}" != ?`);
                        parameters.push(value);
                        break;
                            
                    case 'gt':
                        filterClauses.push(`"${field}" > ?`);
                        parameters.push(value);
                        break;
                            
                    case 'gte':
                        filterClauses.push(`"${field}" >= ?`);
                        parameters.push(value);
                        break;
                            
                    case 'lt':
                        filterClauses.push(`"${field}" < ?`);
                        parameters.push(value);
                        break;
                            
                    case 'lte':
                        filterClauses.push(`"${field}" <= ?`);
                        parameters.push(value);
                        break;
                            
                    case 'in':
                        if (Array.isArray(value) && value.length > 0) {
                            const placeholders = value.map(() => '?').join(', ');
                            filterClauses.push(`"${field}" IN (${placeholders})`);
                            parameters.push(...value);
                        } else {
                            // Empty IN list should return no results
                            filterClauses.push('0 = 1');
                        }
                        break;
                            
                    case 'nin':
                        if (Array.isArray(value) && value.length > 0) {
                            const placeholders = value.map(() => '?').join(', ');
                            filterClauses.push(`"${field}" NOT IN (${placeholders})`);
                            parameters.push(...value);
                        }
                        // Empty NOT IN list should return all results, so no additional filter
                        break;
                            
                    case 'regex':
                        // SQLite doesn't have regex built-in, use LIKE as a simple alternative
                        // or more complex REGEXP with a custom function
                        // Here we'll simulate common regex patterns with LIKE
                        if (typeof value === 'string') {
                            // Basic wildcard pattern matching
                            const likePattern = value
                                .replace(/^\/\^/, '') // Remove start anchor
                                .replace(/\$\/$/, '') // Remove end anchor
                                .replace(/\.\*/g, '%') // .* becomes %
                                .replace(/\./g, '_');  // . becomes _
                                
                            filterClauses.push(`"${field}" LIKE ?`);
                            parameters.push(likePattern);
                        }
                        break;
                            
                    default:
                        logWarn(`Unsupported operator: ${operator}`);
                    }
                }
            });
            
            if (filterClauses.length > 0) {
                sql += ` WHERE ${filterClauses.join(' AND ')}`;
            }
        }
        
        // Apply sorting
        if (queryOptions.sortBy && queryOptions.sortBy.length > 0) {
            const sortClauses = queryOptions.sortBy.map(sort => {
                const { field, order } = sort;
                return `"${field}" ${order === 'asc' ? 'ASC' : 'DESC'}`;
            });
            
            sql += ` ORDER BY ${sortClauses.join(', ')}`;
        }
        
        // Apply pagination
        if (queryOptions.limit !== undefined && queryOptions.limit > 0) {
            sql += ' LIMIT ?';
            parameters.push(queryOptions.limit);
            
            if (queryOptions.offset !== undefined && queryOptions.offset > 0) {
                sql += ' OFFSET ?';
                parameters.push(queryOptions.offset);
            }
        }
        
        return { sql, parameters };
    }

    /**
     * Adds missing columns to an existing table based on data properties
     * @param collectionName The table name
     * @param data The data to extract column info from
     */
    private async ensureColumnsExist(collectionName: string, data: Record<string, any>): Promise<void> {
        try {
            // Get existing table info
            const tableInfo = await this.allPromise(`PRAGMA table_info("${collectionName}")`, []);
            const existingColumns = new Set(tableInfo.map((col: any) => col.name));
            
            // Check if any columns in the data don't exist in the table
            const columnsToAdd: SQLiteColumnDefinition[] = [];
            
            for (const [key, value] of Object.entries(data)) {
                // Skip id and existing columns
                if (key === 'id' || existingColumns.has(key)) continue;
                
                // Determine column type based on value type
                let type: 'TEXT' | 'INTEGER' | 'REAL' | 'BLOB' | 'NULL' = 'TEXT';
                
                if (typeof value === 'number') {
                    type = Number.isInteger(value) ? 'INTEGER' : 'REAL';
                } else if (value === null) {
                    type = 'NULL';
                } else if (typeof value === 'boolean') {
                    type = 'INTEGER';
                } else if (typeof value === 'object') {
                    type = 'TEXT';
                }
                
                columnsToAdd.push({ name: key, type });
            }
            
            // Add any missing columns
            for (const column of columnsToAdd) {
                const sql = `ALTER TABLE "${collectionName}" ADD COLUMN "${column.name}" ${column.type}`;
                await this.execPromise(sql);
                logDebug(`Added column ${column.name} to ${collectionName}`);
            }
        } catch (error) {
            logError(`Failed to ensure columns for collection: ${collectionName}`, error);
            throw new QueryError(`Failed to add columns: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Parses JSON strings in a row object
     * @param row The database row
     * @returns Row with JSON strings parsed into objects
     */
    private parseRowJson(row: Record<string, any> | undefined): Record<string, any> | null {
        if (!row) {
            return null;
        }
        
        const result: Record<string, any> = {};
        
        for (const [key, value] of Object.entries(row)) {
            if (typeof value === 'string' && value.trim()) {
                try {
                    // Try to parse value as JSON
                    if ((value.startsWith('{') && value.endsWith('}')) || 
                        (value.startsWith('[') && value.endsWith(']'))) {
                        result[key] = JSON.parse(value);
                        continue;
                    }
                } catch (e) {
                    // If parsing fails, use the original string value
                }
            }
            
            // Use the original value
            result[key] = value;
        }
        
        return result;
    }
}
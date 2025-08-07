/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.19
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoDBProvider } from './mongodb.provider.js';
import { QueryOptions } from '../database-provider.interface.js';
import { TransactionError } from '../utils/error.utils.js';

describe('MongoDBProvider', () => {
    let provider: MongoDBProvider;
    let mongoServer: MongoMemoryServer;
    let mongoUri: string;

    // Start MongoDB memory server before all tests
    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        mongoUri = mongoServer.getUri();
    });

    // Stop MongoDB memory server after all tests
    afterAll(async () => {
        await mongoServer.stop();
    });

    // Create a fresh provider and clean collections for each test
    beforeEach(async () => {
        provider = new MongoDBProvider({
            connectionString: mongoUri,
            databaseName: 'test-db'
        });
        await provider.connect();
        
        // Ensure we have a clean state for each test by dropping collections
        if (provider['db']) {
            const collections = await provider['db'].listCollections().toArray();
            for (const collection of collections) {
                await provider['db'].collection(collection.name).drop().catch(() => {});
            }
        }
    });

    // Clean up after each test
    afterEach(async () => {
        await provider.disconnect();
    });

    it('should be properly initialized', () => {
        expect(provider).toBeInstanceOf(MongoDBProvider);
        expect(provider.isConnected()).toBe(true);
    });

    it('should disconnect properly', async () => {
        await provider.disconnect();
        expect(provider.isConnected()).toBe(false);
    });

    it('should create an item', async () => {
        const testItem = { name: 'Test Item', value: 123 };
        const result = await provider.create('test-collection', testItem);
        
        expect(result).toHaveProperty('id');
        expect(result.name).toBe(testItem.name);
        expect(result.value).toBe(testItem.value);
    });

    it('should read an item by ID', async () => {
        const testItem = { name: 'Test Item', value: 123 };
        const created = await provider.create('test-collection', testItem);
        
        const result = await provider.read('test-collection', created.id);
        
        expect(result).not.toBeNull();
        expect(result?.id).toBe(created.id);
        expect(result?.name).toBe(testItem.name);
        expect(result?.value).toBe(testItem.value);
    });

    it('should return null when reading a non-existent item', async () => {
        const result = await provider.read('test-collection', 'non-existent-id');
        expect(result).toBeNull();
    });

    it('should update an item', async () => {
        const testItem = { name: 'Test Item', value: 123 };
        const created = await provider.create('test-collection', testItem);
        
        const updateData = { value: 456 };
        const updated = await provider.update('test-collection', created.id, updateData);
        
        expect(updated).not.toBeNull();
        expect(updated?.id).toBe(created.id);
        expect(updated?.name).toBe(testItem.name);
        expect(updated?.value).toBe(updateData.value);
    });

    it('should return null when updating a non-existent item', async () => {
        const updateData = { value: 456 };
        const result = await provider.update('test-collection', 'non-existent-id', updateData);
        expect(result).toBeNull();
    });

    it('should delete an item', async () => {
        const testItem = { name: 'Test Item', value: 123 };
        const created = await provider.create('test-collection', testItem);
        
        const deleteResult = await provider.delete('test-collection', created.id);
        expect(deleteResult).toBe(true);
        
        const readResult = await provider.read('test-collection', created.id);
        expect(readResult).toBeNull();
    });

    it('should return false when deleting a non-existent item', async () => {
        const result = await provider.delete('test-collection', 'non-existent-id');
        expect(result).toBe(false);
    });

    it('should query items with filters', async () => {
        await provider.create('test-collection', { name: 'Item 1', value: 100, category: 'A' });
        await provider.create('test-collection', { name: 'Item 2', value: 200, category: 'B' });
        await provider.create('test-collection', { name: 'Item 3', value: 300, category: 'A' });
        
        const queryOptions: QueryOptions = {
            filters: {
                category: 'A'
            }
        };
        
        const results = await provider.query('test-collection', queryOptions);
        expect(results.length).toBe(2);
        expect(results.every(item => item.category === 'A')).toBe(true);
    });

    it('should query items with operator filters', async () => {
        // Create test data
        await provider.create('test-collection', { name: 'Item 1', value: 100 });
        await provider.create('test-collection', { name: 'Item 2', value: 200 });
        await provider.create('test-collection', { name: 'Item 3', value: 300 });
        
        // Query with 'gt' operator for value > 150
        const queryOptions: QueryOptions = {
            filters: {
                value: {
                    operator: 'gt',
                    value: 150
                }
            }
        };
        
        const results = await provider.query('test-collection', queryOptions);
        
        // Verify results only include items with value > 150
        expect(results.length).toBe(2);
        expect(results.every(item => item.value > 150)).toBe(true);
    });

    it('should query items with sorting', async () => {
        // Create test data in non-sorted order
        await provider.create('test-collection', { name: 'Item 1', value: 300 });
        await provider.create('test-collection', { name: 'Item 2', value: 100 });
        await provider.create('test-collection', { name: 'Item 3', value: 200 });
        
        // Query with ascending sort by value
        const queryOptions: QueryOptions = {
            sortBy: [
                { field: 'value', order: 'asc' }
            ]
        };
        
        const results = await provider.query('test-collection', queryOptions);
        
        // Verify results are sorted by value ascending
        expect(results.length).toBe(3);
        expect(results[0].value).toBe(100);
        expect(results[1].value).toBe(200);
        expect(results[2].value).toBe(300);
    });

    it('should query items with pagination', async () => {
        // Create test data
        await provider.create('test-collection', { name: 'Item 1', value: 100 });
        await provider.create('test-collection', { name: 'Item 2', value: 200 });
        await provider.create('test-collection', { name: 'Item 3', value: 300 });
        await provider.create('test-collection', { name: 'Item 4', value: 400 });
        await provider.create('test-collection', { name: 'Item 5', value: 500 });
        
        // Query with limit and offset, sorting by value
        const queryOptions: QueryOptions = {
            limit: 2,
            offset: 1,
            sortBy: [
                { field: 'value', order: 'asc' }
            ]
        };
        
        const results = await provider.query('test-collection', queryOptions);
        
        // Verify pagination: should return items with values 200 and 300
        expect(results.length).toBe(2);
        expect(results[0].value).toBe(200);
        expect(results[1].value).toBe(300);
    });

    it('should return empty array when querying a non-existent collection', async () => {
        const results = await provider.query('non-existent-collection', {});
        expect(results).toEqual([]);
    });

    it('should work with multiple collections', async () => {
        await provider.create('collection1', { name: 'Item 1', value: 100 });
        await provider.create('collection2', { name: 'Item A', code: 'X1' });
        
        const result1 = await provider.query('collection1', {});
        const result2 = await provider.query('collection2', {});
        
        expect(result1.length).toBe(1);
        expect(result2.length).toBe(1);
        expect(result1[0].name).toBe('Item 1');
        expect(result2[0].name).toBe('Item A');
    });

    it('should store and retrieve complex objects', async () => {
        const testItem = {
            name: 'Complex Item',
            metadata: {
                created: new Date().toISOString(),
                tags: ['test', 'mongodb', 'json'],
                config: {
                    enabled: true,
                    limit: 500
                }
            },
            items: [
                { id: 1, label: 'One' },
                { id: 2, label: 'Two' }
            ]
        };
        
        const created = await provider.create('test-collection', testItem);
        const retrieved = await provider.read('test-collection', created.id);
        
        expect(retrieved).not.toBeNull();
        expect(retrieved?.metadata).toEqual(testItem.metadata);
        expect(retrieved?.items).toEqual(testItem.items);
    });

    // Skip transaction tests if not in a replica set
    it.skip('should handle transactions properly', async () => {
        try {
            await provider.beginTransaction();
            
            // Create items in the transaction
            await provider.create('transaction-test', { name: 'Item 1' });
            await provider.create('transaction-test', { name: 'Item 2' });
            
            // Commit the transaction
            await provider.commitTransaction();
            
            // Verify items were saved
            const results = await provider.query('transaction-test', {});
            expect(results.length).toBe(2);
        } catch (error) {
            if (error instanceof Error && error.message.includes('transactions are not supported')) {
                console.warn('Skipping transaction test: MongoDB memory server does not support transactions');
                return;
            }
            throw error;
        }
    });
    
    it.skip('should rollback transactions', async () => {
        try {
            await provider.beginTransaction();
            
            // Create an item that should be rolled back
            await provider.create('rollback-test', { name: 'Will be rolled back' });
            
            // Rollback the transaction
            await provider.rollbackTransaction();
            
            // Verify the item was not saved
            const results = await provider.query('rollback-test', {});
            expect(results.length).toBe(0);
        } catch (error) {
            if (error instanceof Error && error.message.includes('transactions are not supported')) {
                console.warn('Skipping transaction test: MongoDB memory server does not support transactions');
                return;
            }
            throw error;
        }
    });

    // These tests should pass regardless of transaction support
    it('should throw when committing without an active transaction', async () => {
        await expect(provider.commitTransaction()).rejects.toThrow(TransactionError);
    });

    it('should throw when rolling back without an active transaction', async () => {
        await expect(provider.rollbackTransaction()).rejects.toThrow(TransactionError);
    });

    // Test indexing - fixed to avoid duplicate key errors
    it('should create and use indexes', async () => {
        // First ensure we're starting fresh to avoid conflicts
        if (provider['db']) {
            const collection = provider['db'].collection('indexed-collection');
            await collection.drop().catch(() => {});
        }
        
        // Create an index on the 'name' field
        await provider.ensureIndex('indexed-collection', {
            name: 'name_idx',
            fields: { name: 1 },
            options: { unique: true }
        });
        
        // Add some data
        await provider.create('indexed-collection', { name: 'Test 1', value: 100 });
        
        // This should succeed
        const results = await provider.query('indexed-collection', {
            filters: { name: 'Test 1' }
        });
        
        expect(results.length).toBe(1);
        
        // Creating a duplicate with the same name should fail due to unique index
        try {
            await provider.create('indexed-collection', { name: 'Test 1', value: 200 });
            // If we got here without an error, fail the test
            expect.fail('Should have thrown an error for duplicate key');
        } catch (error) {
            // Expected error for duplicate key
            expect(error).toBeDefined();
        }
        
        // We should be able to create an item with a different name
        const differentItem = await provider.create('indexed-collection', { name: 'Test 2', value: 200 });
        expect(differentItem.name).toBe('Test 2');
    });

    it('should ensure a collection exists', async () => {
        // Ensure schema creates the collection
        await provider.ensureSchema('validated-collection', {
            validator: {
                $jsonSchema: {
                    bsonType: 'object',
                    required: ['name'],
                    properties: {
                        name: {
                            bsonType: 'string',
                            description: 'Name is required and must be a string'
                        }
                    }
                }
            }
        });
        
        // This should succeed
        await provider.create('validated-collection', { name: 'Valid Item' });
        
        // This should work because MongoDB will just create a new collection without validation
        await provider.create('another-collection', { value: 123 });
    });
});
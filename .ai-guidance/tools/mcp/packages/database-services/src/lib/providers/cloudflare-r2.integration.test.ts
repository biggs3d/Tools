/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.07.16
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { CloudflareR2Provider, CloudflareR2ProviderConfig } from './cloudflare-r2.provider.js';
import { ConnectionError, QueryError } from '../utils/error.utils.js';
import { config } from 'dotenv';

// Load environment variables
config();

describe('CloudflareR2Provider Integration Tests', () => {
    let provider: CloudflareR2Provider;
    let r2Config: CloudflareR2ProviderConfig;

    beforeAll(async () => {
        // Skip if no real credentials are provided
        if (!process.env.CLOUDFLARE_R2_ENDPOINT || 
            !process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || 
            !process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
            !process.env.CLOUDFLARE_R2_BUCKET_NAME) {
            console.log('Skipping integration tests - missing R2 credentials');
            return;
        }

        r2Config = {
            endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
            accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
            bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME,
            keyPrefix: 'test-integration'
        };

        provider = new CloudflareR2Provider(r2Config);
    });

    afterAll(async () => {
        if (provider?.isConnected()) {
            // Clean up test data
            try {
                const collections = await provider.listCollections();
                for (const collection of collections) {
                    if (collection.startsWith('test-')) {
                        await provider.deleteCollection(collection);
                    }
                }
            } catch (error) {
                console.warn('Cleanup failed:', error);
            }
            await provider.disconnect();
        }
    });

    it.skipIf(!process.env.CLOUDFLARE_R2_ENDPOINT)('should connect to real R2 bucket', async () => {
        await provider.connect();
        expect(provider.isConnected()).toBe(true);
    });

    it.skipIf(!process.env.CLOUDFLARE_R2_ENDPOINT)('should perform basic CRUD operations', async () => {
        if (!provider.isConnected()) {
            await provider.connect();
        }

        const collection = 'test-crud';
        const testData = {
            name: 'Integration Test Item',
            value: 42,
            metadata: {
                created: new Date().toISOString(),
                tags: ['test', 'integration']
            }
        };

        // Create
        const created = await provider.create(collection, testData);
        expect(created).toBeDefined();
        expect(created.id).toBeDefined();
        expect(created.name).toBe(testData.name);

        // Read
        const read = await provider.read(collection, created.id);
        expect(read).toEqual(created);

        // Update
        const updateData = { ...testData, value: 100, updated: new Date().toISOString() };
        const updated = await provider.update(collection, created.id, updateData);
        expect(updated.value).toBe(100);
        expect(updated.updated).toBeDefined();

        // List
        const items = await provider.list(collection);
        expect(items).toHaveLength(1);
        expect(items[0].id).toBe(created.id);

        // Delete
        const deleted = await provider.delete(collection, created.id);
        expect(deleted).toBe(true);

        // Verify deletion
        const deletedItem = await provider.read(collection, created.id);
        expect(deletedItem).toBeNull();
    });

    it.skipIf(!process.env.CLOUDFLARE_R2_ENDPOINT)('should handle large objects', async () => {
        if (!provider.isConnected()) {
            await provider.connect();
        }

        const collection = 'test-large';
        const largeData = {
            items: Array.from({ length: 100 }, (_, i) => ({
                id: `item-${i}`,
                name: `Large Item ${i}`,
                data: `This is a large data item with index ${i}`.repeat(10),
                metadata: {
                    index: i,
                    created: new Date().toISOString()
                }
            }))
        };

        const created = await provider.create(collection, largeData);
        expect(created).toBeDefined();
        expect(created.items).toHaveLength(100);

        const retrieved = await provider.read(collection, created.id);
        expect(retrieved.items).toHaveLength(100);
        expect(retrieved.items[50].name).toBe('Large Item 50');

        // Clean up
        await provider.delete(collection, created.id);
    });

    it.skipIf(!process.env.CLOUDFLARE_R2_ENDPOINT)('should support filtering and sorting', async () => {
        if (!provider.isConnected()) {
            await provider.connect();
        }

        const collection = 'test-query';
        const testItems = [
            { name: 'Item A', value: 10, category: 'alpha' },
            { name: 'Item B', value: 30, category: 'beta' },
            { name: 'Item C', value: 20, category: 'alpha' },
            { name: 'Item D', value: 40, category: 'beta' }
        ];

        // Create test items
        const createdItems = [];
        for (const item of testItems) {
            const created = await provider.create(collection, item);
            createdItems.push(created);
        }

        // Test filtering
        const alphaItems = await provider.list(collection, {
            filters: { category: 'alpha' }
        });
        expect(alphaItems).toHaveLength(2);
        expect(alphaItems.every(item => item.category === 'alpha')).toBe(true);

        // Test value filtering
        const highValueItems = await provider.list(collection, {
            filters: { value: { operator: 'gt', value: 25 } }
        });
        expect(highValueItems).toHaveLength(2);
        expect(highValueItems.every(item => item.value > 25)).toBe(true);

        // Test sorting
        const sortedItems = await provider.list(collection, {
            sortBy: [{ field: 'value', order: 'desc' }]
        });
        expect(sortedItems[0].value).toBe(40);
        expect(sortedItems[1].value).toBe(30);
        expect(sortedItems[2].value).toBe(20);
        expect(sortedItems[3].value).toBe(10);

        // Test pagination
        const paginatedItems = await provider.list(collection, {
            sortBy: [{ field: 'value', order: 'asc' }],
            limit: 2,
            offset: 1
        });
        expect(paginatedItems).toHaveLength(2);
        expect(paginatedItems[0].value).toBe(20);
        expect(paginatedItems[1].value).toBe(30);

        // Clean up
        for (const item of createdItems) {
            await provider.delete(collection, item.id);
        }
    });

    it.skipIf(!process.env.CLOUDFLARE_R2_ENDPOINT)('should list collections correctly', async () => {
        if (!provider.isConnected()) {
            await provider.connect();
        }

        const collections = ['test-collection-1', 'test-collection-2', 'test-collection-3'];
        
        // Create items in different collections
        const createdItems = [];
        for (const collection of collections) {
            const item = await provider.create(collection, { name: `Item in ${collection}` });
            createdItems.push({ collection, item });
        }

        // List collections
        const foundCollections = await provider.listCollections();
        for (const collection of collections) {
            expect(foundCollections).toContain(collection);
        }

        // Clean up
        for (const { collection, item } of createdItems) {
            await provider.delete(collection, item.id);
        }
    });

    it.skipIf(!process.env.CLOUDFLARE_R2_ENDPOINT)('should get collection statistics', async () => {
        if (!provider.isConnected()) {
            await provider.connect();
        }

        const collection = 'test-stats';
        const items = [
            { name: 'Item 1', data: 'small' },
            { name: 'Item 2', data: 'medium'.repeat(10) },
            { name: 'Item 3', data: 'large'.repeat(100) }
        ];

        // Create items
        const createdItems = [];
        for (const item of items) {
            const created = await provider.create(collection, item);
            createdItems.push(created);
        }

        // Get stats
        const stats = await provider.getCollectionStats(collection);
        expect(stats.count).toBe(3);
        expect(stats.size).toBeGreaterThan(0);

        // Clean up
        for (const item of createdItems) {
            await provider.delete(collection, item.id);
        }
    });

    it.skipIf(!process.env.CLOUDFLARE_R2_ENDPOINT)('should handle errors gracefully', async () => {
        if (!provider.isConnected()) {
            await provider.connect();
        }

        // Test reading non-existent item
        const readResult = await provider.read('test-errors', 'non-existent-id');
        expect(readResult).toBeNull();

        // Test updating non-existent item
        const updateResult = await provider.update('test-errors', 'non-existent-id', { name: 'Test' });
        expect(updateResult).toBeNull();

        // Test deleting non-existent item (S3 API returns success even for non-existent keys)
        const deleted = await provider.delete('test-errors', 'non-existent-id');
        expect(deleted).toBe(true); // S3 delete is idempotent
    });
});
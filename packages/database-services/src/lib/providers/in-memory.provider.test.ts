/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.19
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InMemoryProvider } from './in-memory.provider.js';
import { QueryOptions } from '../database-provider.interface.js';

describe('InMemoryProvider', () => {
    let provider: InMemoryProvider;

    beforeEach(async () => {
        provider = new InMemoryProvider();
        await provider.connect();
    });

    afterEach(async () => {
        await provider.disconnect();
    });

    it('should be properly initialized', () => {
        expect(provider).toBeInstanceOf(InMemoryProvider);
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
        await provider.create('test-collection', { name: 'Item 1', value: 100 });
        await provider.create('test-collection', { name: 'Item 2', value: 200 });
        await provider.create('test-collection', { name: 'Item 3', value: 300 });
        
        const queryOptions: QueryOptions = {
            filters: {
                value: {
                    operator: 'gt',
                    value: 150
                }
            }
        };
        
        const results = await provider.query('test-collection', queryOptions);
        expect(results.length).toBe(2);
        expect(results.every(item => item.value > 150)).toBe(true);
    });

    it('should query items with sorting', async () => {
        await provider.create('test-collection', { name: 'Item 1', value: 300 });
        await provider.create('test-collection', { name: 'Item 2', value: 100 });
        await provider.create('test-collection', { name: 'Item 3', value: 200 });
        
        const queryOptions: QueryOptions = {
            sortBy: [
                { field: 'value', order: 'asc' }
            ]
        };
        
        const results = await provider.query('test-collection', queryOptions);
        expect(results.length).toBe(3);
        expect(results[0].value).toBe(100);
        expect(results[1].value).toBe(200);
        expect(results[2].value).toBe(300);
    });

    it('should query items with pagination', async () => {
        await provider.create('test-collection', { name: 'Item 1', value: 100 });
        await provider.create('test-collection', { name: 'Item 2', value: 200 });
        await provider.create('test-collection', { name: 'Item 3', value: 300 });
        await provider.create('test-collection', { name: 'Item 4', value: 400 });
        await provider.create('test-collection', { name: 'Item 5', value: 500 });
        
        const queryOptions: QueryOptions = {
            limit: 2,
            offset: 1,
            sortBy: [
                { field: 'value', order: 'asc' }
            ]
        };
        
        const results = await provider.query('test-collection', queryOptions);
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
});
/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.07.16
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CloudflareR2Provider, CloudflareR2ProviderConfig } from './cloudflare-r2.provider.js';
import { ConnectionError, QueryError } from '../utils/error.utils.js';

// Mock AWS SDK
const mockS3Client = {
    send: vi.fn(),
    destroy: vi.fn()
};

vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn(() => mockS3Client),
    PutObjectCommand: vi.fn(),
    GetObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    ListObjectsV2Command: vi.fn(),
    HeadObjectCommand: vi.fn()
}));

describe('CloudflareR2Provider', () => {
    let provider: CloudflareR2Provider;
    let config: CloudflareR2ProviderConfig;

    beforeEach(() => {
        config = {
            endpoint: 'https://test.r2.cloudflarestorage.com',
            accessKeyId: 'test-access-key',
            secretAccessKey: 'test-secret-key',
            bucketName: 'test-bucket',
            region: 'auto'
        };
        provider = new CloudflareR2Provider(config);
        vi.clearAllMocks();
    });

    afterEach(async () => {
        if (provider.isConnected()) {
            await provider.disconnect();
        }
    });

    describe('constructor', () => {
        it('should create provider with valid config', () => {
            expect(provider).toBeDefined();
            expect(provider.isConnected()).toBe(false);
        });

        it('should throw error with missing endpoint', () => {
            expect(() => new CloudflareR2Provider({
                ...config,
                endpoint: ''
            })).toThrow();
        });

        it('should throw error with missing credentials', () => {
            expect(() => new CloudflareR2Provider({
                ...config,
                accessKeyId: ''
            })).toThrow();
        });

        it('should throw error with missing bucket name', () => {
            expect(() => new CloudflareR2Provider({
                ...config,
                bucketName: ''
            })).toThrow();
        });
    });

    describe('connect', () => {
        it('should connect successfully', async () => {
            mockS3Client.send.mockResolvedValueOnce({});
            
            await provider.connect();
            
            expect(provider.isConnected()).toBe(true);
            expect(mockS3Client.send).toHaveBeenCalledTimes(1);
        });

        it('should throw ConnectionError on failure', async () => {
            mockS3Client.send.mockRejectedValueOnce(new Error('Connection failed'));
            
            await expect(provider.connect()).rejects.toThrow(ConnectionError);
            expect(provider.isConnected()).toBe(false);
        });
    });

    describe('disconnect', () => {
        it('should disconnect successfully', async () => {
            mockS3Client.send.mockResolvedValueOnce({});
            await provider.connect();
            
            await provider.disconnect();
            
            expect(provider.isConnected()).toBe(false);
            expect(mockS3Client.destroy).toHaveBeenCalledTimes(1);
        });
    });

    describe('create', () => {
        beforeEach(async () => {
            mockS3Client.send.mockResolvedValueOnce({});
            await provider.connect();
        });

        it('should create item successfully', async () => {
            const item = { name: 'Test Item', value: 42 };
            mockS3Client.send.mockResolvedValueOnce({});
            
            const result = await provider.create('test-collection', item);
            
            expect(result).toEqual(expect.objectContaining(item));
            expect(result.id).toBeDefined();
            expect(mockS3Client.send).toHaveBeenCalledTimes(2); // connect + create
        });

        it('should preserve existing ID', async () => {
            const item = { id: 'existing-id', name: 'Test Item' };
            mockS3Client.send.mockResolvedValueOnce({});
            
            const result = await provider.create('test-collection', item);
            
            expect(result.id).toBe('existing-id');
        });

        it('should throw error when not connected', async () => {
            await provider.disconnect();
            
            await expect(provider.create('test-collection', { name: 'Test' }))
                .rejects.toThrow('not connected');
        });
    });

    describe('read', () => {
        beforeEach(async () => {
            mockS3Client.send.mockResolvedValueOnce({});
            await provider.connect();
        });

        it('should read item successfully', async () => {
            const item = { id: 'test-id', name: 'Test Item' };
            mockS3Client.send.mockResolvedValueOnce({
                Body: {
                    transformToString: () => Promise.resolve(JSON.stringify(item))
                }
            });
            
            const result = await provider.read('test-collection', 'test-id');
            
            expect(result).toEqual(item);
        });

        it('should return null for non-existent item', async () => {
            const error = new Error('NoSuchKey');
            error.name = 'NoSuchKey';
            mockS3Client.send.mockRejectedValueOnce(error);
            
            const result = await provider.read('test-collection', 'non-existent');
            expect(result).toBeNull();
        });

        it('should throw error when not connected', async () => {
            await provider.disconnect();
            
            await expect(provider.read('test-collection', 'test-id'))
                .rejects.toThrow('not connected');
        });
    });

    describe('update', () => {
        beforeEach(async () => {
            mockS3Client.send.mockResolvedValueOnce({});
            await provider.connect();
        });

        it('should update item successfully', async () => {
            const updatedItem = { name: 'New Name', value: 100 };
            
            // Mock HeadObject call to check if item exists
            mockS3Client.send.mockResolvedValueOnce({}); // HeadObject success
            
            // Mock update call
            mockS3Client.send.mockResolvedValueOnce({});
            
            const result = await provider.update('test-collection', 'test-id', updatedItem);
            
            expect(result).toEqual(expect.objectContaining(updatedItem));
            expect(result.id).toBe('test-id');
        });

        it('should return null for non-existent item', async () => {
            const error = new Error('NoSuchKey');
            error.name = 'NoSuchKey';
            mockS3Client.send.mockRejectedValueOnce(error); // HeadObject fails
            
            const result = await provider.update('test-collection', 'non-existent', { name: 'Test' });
            expect(result).toBeNull();
        });
    });

    describe('delete', () => {
        beforeEach(async () => {
            mockS3Client.send.mockResolvedValueOnce({});
            await provider.connect();
        });

        it('should delete item successfully', async () => {
            mockS3Client.send.mockResolvedValueOnce({});
            
            await provider.delete('test-collection', 'test-id');
            
            expect(mockS3Client.send).toHaveBeenCalledTimes(2); // connect + delete
        });

        it('should throw error when not connected', async () => {
            await provider.disconnect();
            
            await expect(provider.delete('test-collection', 'test-id'))
                .rejects.toThrow('not connected');
        });
    });

    describe('list', () => {
        beforeEach(async () => {
            mockS3Client.send.mockResolvedValueOnce({});
            await provider.connect();
        });

        it('should list items successfully', async () => {
            const items = [
                { id: 'item1', name: 'Item 1' },
                { id: 'item2', name: 'Item 2' }
            ];
            
            // Mock list objects response
            mockS3Client.send.mockResolvedValueOnce({
                Contents: [
                    { Key: 'test-collection/item1.json' },
                    { Key: 'test-collection/item2.json' }
                ]
            });
            
            // Mock get object responses
            mockS3Client.send.mockResolvedValueOnce({
                Body: {
                    transformToString: () => Promise.resolve(JSON.stringify(items[0]))
                }
            });
            mockS3Client.send.mockResolvedValueOnce({
                Body: {
                    transformToString: () => Promise.resolve(JSON.stringify(items[1]))
                }
            });
            
            const result = await provider.list('test-collection');
            
            expect(result).toHaveLength(2);
            expect(result).toEqual(expect.arrayContaining(items));
        });

        it('should return empty array for empty collection', async () => {
            mockS3Client.send.mockResolvedValueOnce({
                Contents: []
            });
            
            const result = await provider.list('test-collection');
            
            expect(result).toEqual([]);
        });

        it('should apply filters correctly', async () => {
            const items = [
                { id: 'item1', name: 'Item 1', value: 10 },
                { id: 'item2', name: 'Item 2', value: 20 }
            ];
            
            // Mock list objects response
            mockS3Client.send.mockResolvedValueOnce({
                Contents: [
                    { Key: 'test-collection/item1.json' },
                    { Key: 'test-collection/item2.json' }
                ]
            });
            
            // Mock get object responses
            mockS3Client.send.mockResolvedValueOnce({
                Body: {
                    transformToString: () => Promise.resolve(JSON.stringify(items[0]))
                }
            });
            mockS3Client.send.mockResolvedValueOnce({
                Body: {
                    transformToString: () => Promise.resolve(JSON.stringify(items[1]))
                }
            });
            
            const result = await provider.list('test-collection', {
                filters: { value: { operator: 'gt', value: 15 } }
            });
            
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('item2');
        });
    });

    describe('listCollections', () => {
        beforeEach(async () => {
            mockS3Client.send.mockResolvedValueOnce({});
            await provider.connect();
        });

        it('should list collections successfully', async () => {
            mockS3Client.send.mockResolvedValueOnce({
                Contents: [
                    { Key: 'collection1/item1.json' },
                    { Key: 'collection1/item2.json' },
                    { Key: 'collection2/item1.json' }
                ]
            });
            
            const result = await provider.listCollections();
            
            expect(result).toEqual(expect.arrayContaining(['collection1', 'collection2']));
        });

        it('should return empty array when no collections exist', async () => {
            mockS3Client.send.mockResolvedValueOnce({
                Contents: []
            });
            
            const result = await provider.listCollections();
            
            expect(result).toEqual([]);
        });
    });

    describe('validation', () => {
        beforeEach(async () => {
            mockS3Client.send.mockResolvedValueOnce({});
            await provider.connect();
        });

        it('should validate collection names', async () => {
            await expect(provider.create('', { name: 'test' }))
                .rejects.toThrow('Collection name');
            
            await expect(provider.create('invalid/name', { name: 'test' }))
                .rejects.toThrow('Collection name');
        });

        it('should validate item IDs', async () => {
            await expect(provider.read('test-collection', ''))
                .rejects.toThrow('ID');
            
            await expect(provider.read('test-collection', 'invalid/id'))
                .rejects.toThrow('ID');
        });
    });
});
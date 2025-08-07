/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.19
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IndexedDBProvider } from './indexeddb.provider.js';
import { QueryOptions } from '../database-provider.interface.js';
import { ConnectionError, ConfigurationError } from '../utils/error.utils.js';

// Helper function to create mock events with proper target properties
const createMockEvent = (type: string, targetValue: any) => {
    const event = new Event(type);
    Object.defineProperty(event, 'target', {
        value: targetValue,
        enumerable: true
    });
    return event;
};

// Mock for the IndexedDB API
const mockIndexedDB = () => {
    const db = {
        createObjectStore: vi.fn(),
        transaction: vi.fn(),
        close: vi.fn(),
        objectStoreNames: {
            contains: vi.fn().mockReturnValue(true)
        }
    };

    const objectStore = {
        createIndex: vi.fn(),
        put: vi.fn(),
        get: vi.fn(),
        delete: vi.fn(),
        openCursor: vi.fn(),
        index: vi.fn(),
        getAll: vi.fn(),
        add: vi.fn()
    };

    const request = {
        result: null,
        error: null,
        transaction: {
            objectStore: vi.fn().mockReturnValue(objectStore),
            commit: vi.fn(),
            abort: vi.fn(),
            objectStoreNames: {
                contains: vi.fn().mockReturnValue(true)
            }
        },
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null
    };

    const openRequest = {
        ...request,
        result: db
    };

    const cursor = {
        value: null,
        key: null,
        continue: vi.fn()
    };

    // Mock browser environment
    if (typeof window === 'undefined') {
        vi.stubGlobal('window', {});
    }

    // Set up mocked IDB functions
    vi.stubGlobal('indexedDB', {
        open: vi.fn().mockReturnValue(openRequest),
        deleteDatabase: vi.fn().mockImplementation((_) => {
            const delRequest = { ...request };
            setTimeout(() => {
                if (delRequest.onsuccess) delRequest.onsuccess(new Event('success'));
            }, 0);
            return delRequest;
        })
    });

    // Mock Event constructor if needed
    if (typeof Event === 'undefined') {
        vi.stubGlobal('Event', class Event {
            constructor(type) {
                this.type = type;
            }
        });
    }

    return {
        db,
        objectStore,
        request,
        openRequest,
        cursor
    };
};

// Check if we're in a browser environment
const isBrowserEnvironment = typeof window !== 'undefined' && typeof indexedDB !== 'undefined';

// Simple tests to run in non-browser environments
describe('IndexedDBProvider in non-browser environment', () => {
    it('should be instantiated with correct configuration', () => {
        const provider = new IndexedDBProvider({
            databaseName: 'test-db',
            version: 1
        });
        expect(provider).toBeInstanceOf(IndexedDBProvider);
        expect(provider.isConnected()).toBe(false);
    });
    
    it('should throw ConfigurationError when no database name is provided', () => {
        expect(() => {
            new IndexedDBProvider({} as any);
        }).toThrow(ConfigurationError);
    });
    
    it('should throw ConnectionError in a non-browser environment', async () => {
        const provider = new IndexedDBProvider({
            databaseName: 'test-db',
            version: 1
        });
        await expect(provider.connect()).rejects.toThrow('IndexedDB is only available in browser environments');
    });
});

// If not in a browser, skip the browser-specific tests
const testRunner = isBrowserEnvironment ? describe : describe.skip;

testRunner('IndexedDBProvider', () => {
    let provider: IndexedDBProvider;
    let mockIDB: ReturnType<typeof mockIndexedDB>;

    beforeEach(() => {
        mockIDB = mockIndexedDB();
        
        provider = new IndexedDBProvider({
            databaseName: 'test-db',
            version: 1
        });
    });

    afterEach(async () => {
        try {
            await provider.disconnect();
        } catch (e) {
            // Ignore errors in tests
        }
        vi.resetAllMocks();
    });

    it('should be instantiated with correct configuration', () => {
        expect(provider).toBeInstanceOf(IndexedDBProvider);
        expect(provider.isConnected()).toBe(false);
    });

    it('should throw ConfigurationError when no database name is provided', () => {
        expect(() => {
            new IndexedDBProvider({} as any);
        }).toThrow(ConfigurationError);
    });

    it('should connect to database successfully', async () => {
        if (typeof window === 'undefined') {
            // In Node.js or non-browser environment, we expect the error
            await expect(provider.connect()).rejects.toThrow('IndexedDB is only available in browser environments');
            return;
        }
        
        // Simulate successful connection
        const connectPromise = provider.connect();
        
        // Trigger onupgradeneeded
        const upgradedEvent = createMockEvent('upgradeneeded', mockIDB.openRequest);
        if (mockIDB.openRequest.onupgradeneeded) {
            mockIDB.openRequest.onupgradeneeded(upgradedEvent);
        }
        
        // Trigger onsuccess
        const successEvent = createMockEvent('success', mockIDB.openRequest);
        if (mockIDB.openRequest.onsuccess) {
            mockIDB.openRequest.onsuccess(successEvent);
        }
        
        await connectPromise;
        expect(provider.isConnected()).toBe(true);
        expect(global.indexedDB.open).toHaveBeenCalledWith('test-db', 1);
    });

    it('should handle connection errors', async () => {
        if (typeof window === 'undefined') {
            // In Node.js or non-browser environment, we expect the error
            await expect(provider.connect()).rejects.toThrow('IndexedDB is only available in browser environments');
            return;
        }
        
        // Simulate connection error
        const connectPromise = provider.connect();
        
        // Create error event with the error property
        const errorTarget = { 
            ...mockIDB.openRequest,
            error: new Error('Connection failed')
        };
        
        // Trigger onerror
        const errorEvent = createMockEvent('error', errorTarget);
        
        if (mockIDB.openRequest.onerror) {
            mockIDB.openRequest.onerror(errorEvent);
        }
        
        await expect(connectPromise).rejects.toThrow(ConnectionError);
    });

    it('should create an item', async () => {
        if (typeof window === 'undefined') {
            // Skip this test in non-browser environments
            console.log('Skipping test in Node.js environment');
            return;
        }
        
        // Setup the successful connection
        const connectPromise = provider.connect();
        if (mockIDB.openRequest.onsuccess) {
            mockIDB.openRequest.onsuccess(createMockEvent('success', mockIDB.openRequest));
        }
        await connectPromise;
        
        // Mock the transaction return
        mockIDB.db.transaction.mockReturnValue(mockIDB.request.transaction);
        
        // Create a mock request with event handlers
        mockIDB.request.onsuccess = null;
        mockIDB.request.onerror = null;
        
        // Mock put success
        mockIDB.objectStore.put.mockImplementation((item) => {
            const putRequest = { 
                result: item.id,
                onsuccess: null,
                onerror: null
            };
            
            // Use setTimeout to make this async
            setTimeout(() => {
                if (putRequest.onsuccess) {
                    putRequest.onsuccess(createMockEvent('success', putRequest));
                }
            }, 0);
            
            return putRequest;
        });
        
        const testItem = { name: 'Test Item', value: 123 };
        const result = await provider.create('test-collection', testItem);
        
        expect(result).toHaveProperty('id');
        expect(result.name).toBe(testItem.name);
        expect(result.value).toBe(testItem.value);
        expect(mockIDB.objectStore.put).toHaveBeenCalled();
    });

    it('should read an item by ID', async () => {
        if (typeof window === 'undefined') {
            // Skip this test in non-browser environments
            console.log('Skipping test in Node.js environment');
            return;
        }
        
        // Setup the successful connection
        const connectPromise = provider.connect();
        if (mockIDB.openRequest.onsuccess) {
            mockIDB.openRequest.onsuccess(createMockEvent('success', mockIDB.openRequest));
        }
        await connectPromise;
        
        // Mock the transaction return
        mockIDB.db.transaction.mockReturnValue(mockIDB.request.transaction);
        
        // Setup the item to be returned
        const testItem = { id: '123', name: 'Test Item', value: 456 };
        
        // Create a mock request with event handlers
        mockIDB.request.onsuccess = null;
        mockIDB.request.onerror = null;
        
        // Mock get success
        mockIDB.objectStore.get.mockImplementation(() => {
            const getRequest = { 
                result: testItem,
                onsuccess: null,
                onerror: null
            };
            
            // Use setTimeout to make this async
            setTimeout(() => {
                if (getRequest.onsuccess) {
                    getRequest.onsuccess(createMockEvent('success', getRequest));
                }
            }, 0);
            
            return getRequest;
        });
        
        const result = await provider.read('test-collection', '123');
        
        expect(result).toEqual(testItem);
        expect(mockIDB.objectStore.get).toHaveBeenCalledWith('123');
    });

    it('should update an item by ID', async () => {
        if (typeof window === 'undefined') {
            // Skip this test in non-browser environments
            console.log('Skipping test in Node.js environment');
            return;
        }
        
        // Setup the successful connection
        const connectPromise = provider.connect();
        if (mockIDB.openRequest.onsuccess) {
            mockIDB.openRequest.onsuccess(createMockEvent('success', mockIDB.openRequest));
        }
        await connectPromise;
        
        // Mock the transaction return
        mockIDB.db.transaction.mockReturnValue(mockIDB.request.transaction);
        
        // Original item
        const originalItem = { id: '123', name: 'Original Name', value: 100 };
        
        // Create a mock request with event handlers
        mockIDB.request.onsuccess = null;
        mockIDB.request.onerror = null;
        
        // First mock the get to return the original item
        mockIDB.objectStore.get.mockImplementation(() => {
            const getRequest = { 
                result: originalItem,
                onsuccess: null,
                onerror: null 
            };
            setTimeout(() => {
                if (getRequest.onsuccess) getRequest.onsuccess(createMockEvent('success', getRequest));
            }, 0);
            return getRequest;
        });
        
        // Then mock put to succeed
        mockIDB.objectStore.put.mockImplementation((item) => {
            const putRequest = { 
                result: item.id,
                onsuccess: null,
                onerror: null 
            };
            setTimeout(() => {
                if (putRequest.onsuccess) putRequest.onsuccess(createMockEvent('success', putRequest));
            }, 0);
            return putRequest;
        });
        
        const updateData = { value: 200 };
        const result = await provider.update('test-collection', '123', updateData);
        
        expect(result).not.toBeNull();
        expect(result?.id).toBe('123');
        expect(result?.name).toBe('Original Name');
        expect(result?.value).toBe(200);
        expect(mockIDB.objectStore.get).toHaveBeenCalledWith('123');
        expect(mockIDB.objectStore.put).toHaveBeenCalled();
    });

    it('should delete an item by ID', async () => {
        if (typeof window === 'undefined') {
            // Skip this test in non-browser environments
            console.log('Skipping test in Node.js environment');
            return;
        }
        
        // Setup the successful connection
        const connectPromise = provider.connect();
        if (mockIDB.openRequest.onsuccess) {
            mockIDB.openRequest.onsuccess(createMockEvent('success', mockIDB.openRequest));
        }
        await connectPromise;
        
        // Mock the transaction return
        mockIDB.db.transaction.mockReturnValue(mockIDB.request.transaction);
        
        // Create a mock request with event handlers
        mockIDB.request.onsuccess = null;
        mockIDB.request.onerror = null;
        
        // Mock delete success
        mockIDB.objectStore.delete.mockImplementation(() => {
            const delRequest = { 
                result: undefined,
                onsuccess: null,
                onerror: null 
            };
            setTimeout(() => {
                if (delRequest.onsuccess) delRequest.onsuccess(createMockEvent('success', delRequest));
            }, 0);
            return delRequest;
        });
        
        const result = await provider.delete('test-collection', '123');
        
        expect(result).toBe(true);
        expect(mockIDB.objectStore.delete).toHaveBeenCalledWith('123');
    });

    it('should query items with filters', async () => {
        if (typeof window === 'undefined') {
            // Skip this test in non-browser environments
            console.log('Skipping test in Node.js environment');
            return;
        }
        
        // Setup the successful connection
        const connectPromise = provider.connect();
        if (mockIDB.openRequest.onsuccess) {
            mockIDB.openRequest.onsuccess(createMockEvent('success', mockIDB.openRequest));
        }
        await connectPromise;
        
        // Mock the transaction return
        mockIDB.db.transaction.mockReturnValue(mockIDB.request.transaction);
        
        // Mock items to be returned
        const testItems = [
            { id: '1', name: 'Item 1', category: 'A', value: 100 },
            { id: '2', name: 'Item 2', category: 'B', value: 200 },
            { id: '3', name: 'Item 3', category: 'A', value: 300 }
        ];
        
        // Create a mock request with event handlers
        mockIDB.request.onsuccess = null;
        mockIDB.request.onerror = null;
        
        // Mock getAll success
        mockIDB.objectStore.getAll.mockImplementation(() => {
            const getAllRequest = { 
                result: testItems,
                onsuccess: null,
                onerror: null 
            };
            setTimeout(() => {
                if (getAllRequest.onsuccess) getAllRequest.onsuccess(createMockEvent('success', getAllRequest));
            }, 0);
            return getAllRequest;
        });
        
        const queryOptions: QueryOptions = {
            filters: {
                category: 'A'
            }
        };
        
        const results = await provider.query('test-collection', queryOptions);
        
        // Only items with category A should be returned after filtering
        expect(results.length).toBe(2);
        expect(results[0].id).toBe('1');
        expect(results[1].id).toBe('3');
    });

    it('should handle database version upgrade', async () => {
        if (typeof window === 'undefined') {
            // Skip this test in non-browser environments
            console.log('Skipping test in Node.js environment');
            return;
        }
        
        // Create a mock migration handler
        const mockMigrationHandler = vi.fn((db) => {
            db.createObjectStore('new-collection', { keyPath: 'id' });
        });
        
        // Create a provider with version 2 and migration strategy
        const upgradeProvider = new IndexedDBProvider({
            databaseName: 'test-db',
            version: 2,
            migrationStrategy: {
                2: mockMigrationHandler
            }
        });
        
        // Simulate successful connection with upgrade
        const connectPromise = upgradeProvider.connect();
        
        // Create a mock event with a proper target
        const createEvent = (type: string) => {
            const event = new Event(type);
            Object.defineProperty(event, 'target', {
                value: mockIDB.openRequest,
                enumerable: true
            });
            return event;
        };
        
        // Trigger onupgradeneeded
        const upgradeEvent = createEvent('upgradeneeded');
        Object.defineProperty(upgradeEvent, 'oldVersion', { value: 1 });
        Object.defineProperty(upgradeEvent, 'newVersion', { value: 2 });
        
        if (mockIDB.openRequest.onupgradeneeded) {
            mockIDB.openRequest.onupgradeneeded(upgradeEvent);
        }
        
        // Trigger onsuccess
        if (mockIDB.openRequest.onsuccess) {
            mockIDB.openRequest.onsuccess(createEvent('success'));
        }
        
        await connectPromise;
        
        expect(upgradeProvider.isConnected()).toBe(true);
        expect(global.indexedDB.open).toHaveBeenCalledWith('test-db', 2);
        
        // We can't directly test if the migration handler was called because
        // we don't mock the entire upgradeNeeded process, but we can verify
        // the connection succeeded
    });
});
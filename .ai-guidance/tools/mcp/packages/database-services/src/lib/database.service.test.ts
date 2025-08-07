/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.19
 * https://github.com/biggs3d/McpMemoryServer
 */

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {DatabaseService} from './database.service.js';
import {IDatabaseConfig, DatabaseType, loadDatabaseConfig} from './config.js';
import {DatabaseProviderFactory} from './factory.js';
import {ConnectionError} from './utils/error.utils.js';

// Mock factory and config loader
vi.mock('./factory.js', () => { // Note: ensure path is correct if it's ./factory.js
    const mockProviderInstance = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        isConnected: vi.fn().mockReturnValue(true)
    };

    return {
        DatabaseProviderFactory: {
            createProvider: vi.fn().mockReturnValue(mockProviderInstance)
        }
    };
});

vi.mock('./config.js', () => { // Note: ensure path is correct if it's ./config.js
    return {
        DatabaseType: {
            InMemory: 'in-memory',
            JsonFile: 'json-file',
            SQLite: 'sqlite',
            MongoDB: 'mongodb',
            GitSync: 'git-sync'
        },
        loadDatabaseConfig: vi.fn().mockReturnValue({
            type: 'in-memory'
        })
    };
});

describe('DatabaseService', () => {
    let service: DatabaseService;
    let mockProvider: any;

    beforeEach(() => {
        vi.resetAllMocks();

        // Create a fresh mock provider for each test
        mockProvider = {
            connect: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn().mockResolvedValue(undefined),
            isConnected: vi.fn().mockReturnValue(true)
        };

        // Configure the factory to return this fresh mockProvider
        vi.mocked(DatabaseProviderFactory.createProvider).mockReturnValue(mockProvider);

        // Ensure loadDatabaseConfig is also reset to a known state
        vi.mocked(loadDatabaseConfig).mockReturnValue({type: DatabaseType.InMemory});
    });

    afterEach(() => {
        // vi.restoreAllMocks(); // Typically not needed if resetAllMocks is in beforeEach
        // and mocks are module-level. If issues persist, can be added.
    });

    it('should initialize with provided config', () => {
        const config: IDatabaseConfig = {
            type: DatabaseType.InMemory
        };

        service = new DatabaseService(config);
        expect(DatabaseProviderFactory.createProvider).not.toHaveBeenCalled();
        expect(service.getCurrentConfig()).toEqual(config);
    });

    it('should initialize with loaded config when none provided', () => {
        service = new DatabaseService();
        expect(loadDatabaseConfig).toHaveBeenCalled();
        expect(service.getCurrentConfig()).toEqual({type: 'in-memory'});
    });

    it('should create and connect provider when getProvider is called', async () => {
        service = new DatabaseService();
        const provider = await service.getProvider();
        expect(DatabaseProviderFactory.createProvider).toHaveBeenCalledWith({type: 'in-memory'});
        expect(mockProvider.connect).toHaveBeenCalled();
        expect(provider).toBe(mockProvider);
    });

    it('should return the same connected provider on subsequent getProvider calls', async () => {
        service = new DatabaseService();
        const provider1 = await service.getProvider();
        vi.mocked(DatabaseProviderFactory.createProvider).mockClear();
        mockProvider.connect.mockClear();
        const provider2 = await service.getProvider();
        expect(DatabaseProviderFactory.createProvider).not.toHaveBeenCalled();
        expect(mockProvider.connect).not.toHaveBeenCalled();
        expect(provider2).toBe(provider1);
    });

    it('should disconnect provider when disconnectProvider is called', async () => {
        service = new DatabaseService();
        await service.getProvider();
        await service.disconnectProvider();
        expect(mockProvider.disconnect).toHaveBeenCalled();
    });

    it('should reconnect if provider is not connected on getProvider', async () => {
        service = new DatabaseService();
        await service.getProvider();
        mockProvider.isConnected.mockReturnValue(false);
        vi.mocked(DatabaseProviderFactory.createProvider).mockClear(); // Clear before the call that should trigger it
        mockProvider.connect.mockClear(); // Clear before the call that should trigger it
        await service.getProvider();
        expect(DatabaseProviderFactory.createProvider).toHaveBeenCalled();
        expect(mockProvider.connect).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
        service = new DatabaseService();
        mockProvider.connect.mockRejectedValue(new Error('Connection failed'));
        await expect(service.getProvider()).rejects.toThrow(ConnectionError);
        await expect(service.getProvider()).rejects.toThrow('Failed to connect to database: Connection failed');
    });

    it('should auto-connect when configured', async () => {
        const config: IDatabaseConfig = {
            type: DatabaseType.InMemory,
            autoConnect: true
        };
        // Service instantiation will trigger auto-connect due to the config
        service = new DatabaseService(config);
        // Allow microtasks to run for async operations within constructor or init phase
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(DatabaseProviderFactory.createProvider).toHaveBeenCalled();
        expect(mockProvider.connect).toHaveBeenCalled();
    });
});
/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.19
 * https://github.com/biggs3d/McpMemoryServer
 */
import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import * as fsPromises from 'fs/promises'; // Import with an alias
import * as path from 'path';
import {JsonFileProvider} from './json-file.provider.js';
import {QueryOptions} from '../database-provider.interface.js';

// Mock fs.promises for isolated testing
vi.mock('fs/promises', () => {
    const mockFiles = new Map<string, string>();
    const mockDirectories = new Set<string>();
    const normalize = (p: string) => p.replace(/\\/g, '/');

    return {
        mkdir: vi.fn(async (dirPath: string, options?: any) => {
            mockDirectories.add(normalize(dirPath));
            return undefined;
        }),
        readdir: vi.fn(async (dirPath: string) => {
            const normalizedDirPath = normalize(dirPath);
            if (!mockDirectories.has(normalizedDirPath)) {
                throw Object.assign(new Error('Directory not found'), {code: 'ENOENT'});
            }

            const dirPrefix = normalizedDirPath.endsWith('/') ? normalizedDirPath : `${normalizedDirPath}/`;
            return Array.from(mockFiles.keys()) // Keys are already normalized
                .filter(filePath => filePath.startsWith(dirPrefix) && filePath !== dirPrefix && filePath.substring(dirPrefix.length).indexOf('/') === -1)
                .map(filePath => path.basename(filePath)); // path.basename works fine on normalized paths
        }),
        readFile: vi.fn(async (filePath: string, encoding: string) => {
            const normalizedFilePath = normalize(filePath);
            if (!mockFiles.has(normalizedFilePath)) {
                throw Object.assign(new Error('File not found'), {code: 'ENOENT'});
            }
            return mockFiles.get(normalizedFilePath);
        }),
        writeFile: vi.fn(async (filePath: string, data: string, options?: any) => {
            const normalizedFilePath = normalize(filePath);
            // Handle 'wx' flag for exclusive creation
            if (options?.flag === 'wx' && mockFiles.has(normalizedFilePath)) {
                throw Object.assign(new Error('File already exists'), {code: 'EEXIST'});
            }

            mockFiles.set(normalizedFilePath, data);
            // path.dirname operates on the original path, then normalize its output
            mockDirectories.add(normalize(path.dirname(filePath)));
            return undefined;
        }),
        rename: vi.fn(async (oldPath: string, newPath: string) => {
            const normalizedOldPath = normalize(oldPath);
            const normalizedNewPath = normalize(newPath);
            if (!mockFiles.has(normalizedOldPath)) {
                throw Object.assign(new Error('File not found'), {code: 'ENOENT'});
            }

            mockFiles.set(normalizedNewPath, mockFiles.get(normalizedOldPath)!);
            mockFiles.delete(normalizedOldPath);
            return undefined;
        }),
        unlink: vi.fn(async (filePath: string) => {
            const normalizedFilePath = normalize(filePath);
            if (!mockFiles.has(normalizedFilePath)) {
                throw Object.assign(new Error('File not found'), {code: 'ENOENT'});
            }
            mockFiles.delete(normalizedFilePath);
            return undefined;
        }),
        __mockFiles: mockFiles,
        __mockDirectories: mockDirectories,
        __clearMocks: () => {
            mockFiles.clear();
            mockDirectories.clear();
            // Also clear the mock function calls themselves
            vi.mocked(fsPromises.mkdir).mockClear();
            vi.mocked(fsPromises.readdir).mockClear();
            vi.mocked(fsPromises.readFile).mockClear();
            vi.mocked(fsPromises.writeFile).mockClear();
            vi.mocked(fsPromises.rename).mockClear();
            vi.mocked(fsPromises.unlink).mockClear();
        }
    };
});

describe('JsonFileProvider', () => {
    let provider: JsonFileProvider;
    const testDir = '/tmp/test-json-db'; // Using forward slashes for consistency in tests
    const normalizePath = (p: string) => p.replace(/\u005C/g, '\u002F');

    beforeEach(async () => {
        // Clear any existing mock files/directories and mock function call history
        (fsPromises as any).__clearMocks();

        provider = new JsonFileProvider({
            directoryPath: testDir,
            writeDebounceMs: 0
        });
        await provider.connect();
    });

    afterEach(async () => {
        await provider.disconnect();
    });

    it('should be properly initialized', () => {
        expect(provider).toBeInstanceOf(JsonFileProvider);
        expect(provider.isConnected()).toBe(true);
        // fs.mkdir is called with the raw testDir; the mock normalizes it internally
        expect(fsPromises.mkdir).toHaveBeenCalledWith(testDir, {recursive: true});
    });

    it('should disconnect properly', async () => {
        await provider.disconnect();
        expect(provider.isConnected()).toBe(false);
    });

    it('should create an item and write to file', async () => {
        const testItem = {name: 'Test Item', value: 123};
        const result: any = await provider.create('test-collection', testItem);

        expect(result).toHaveProperty('id');
        expect(result.name).toBe(testItem.name);
        expect(result.value).toBe(testItem.value);

        await new Promise(resolve => setTimeout(resolve, 10)); // Wait for debounced write

        expect(fsPromises.writeFile).toHaveBeenCalled();
        const writeFileCalls = vi.mocked(fsPromises.writeFile).mock.calls;
        const collectionWriteCall = writeFileCalls.find(
            call => call[0] && normalizePath(call[0].toString()).includes('test-collection.json.tmp')
        );

        expect(collectionWriteCall).toBeDefined();
        if (collectionWriteCall) {
            const [filePath, content] = collectionWriteCall;
            // Compare normalized paths
            expect(normalizePath(filePath as string)).toContain(normalizePath(`${testDir}/test-collection.json.tmp`));

            const parsedContent = JSON.parse(content as string);
            expect(parsedContent[result.id]).toEqual(result);

            // Verify the rename operation
            expect(fsPromises.rename).toHaveBeenCalledTimes(1);
            const renameArgs = vi.mocked(fsPromises.rename).mock.calls[0];
            const oldPathActual = renameArgs[0] as string;
            const newPathActual = renameArgs[1] as string;

            const expectedOldPath = normalizePath(`${testDir}/test-collection.json.tmp`);
            const expectedNewPath = normalizePath(`${testDir}/test-collection.json`);

            expect(normalizePath(oldPathActual)).toEqual(expectedOldPath);
            expect(normalizePath(newPathActual)).toEqual(expectedNewPath);
        }
    });

    it('should read an item by ID', async () => {
        const testItem = {name: 'Test Item', value: 123};
        const created: any = await provider.create('test-collection', testItem);
        const result: any = await provider.read('test-collection', created.id);

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
        const testItem = {name: 'Test Item', value: 123};
        const created: any = await provider.create('test-collection', testItem);
        const updateData = {value: 456};
        const updated: any = await provider.update('test-collection', created.id, updateData);

        expect(updated).not.toBeNull();
        expect(updated?.id).toBe(created.id);
        expect(updated?.name).toBe(testItem.name);
        expect(updated?.value).toBe(updateData.value);

        const readResult: any = await provider.read('test-collection', created.id);
        expect(readResult?.value).toBe(456);
    });

    it('should return null when updating a non-existent item', async () => {
        const updateData = {value: 456};
        const result = await provider.update('test-collection', 'non-existent-id', updateData);
        expect(result).toBeNull();
    });

    it('should delete an item', async () => {
        const testItem = {name: 'Test Item', value: 123};
        const created: any = await provider.create('test-collection', testItem);
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
        await provider.create('test-collection', {name: 'Item 1', value: 100, category: 'A'});
        await provider.create('test-collection', {name: 'Item 2', value: 200, category: 'B'});
        await provider.create('test-collection', {name: 'Item 3', value: 300, category: 'A'});
        const queryOptions: QueryOptions = {filters: {category: 'A'}};
        const results: any[] = await provider.query('test-collection', queryOptions);
        expect(results.length).toBe(2);
        expect(results.every(item => item.category === 'A')).toBe(true);
    });

    it('should query items with sorting', async () => {
        await provider.create('test-collection', {name: 'Item 1', value: 300});
        await provider.create('test-collection', {name: 'Item 2', value: 100});
        await provider.create('test-collection', {name: 'Item 3', value: 200});
        const queryOptions: QueryOptions = {sortBy: [{field: 'value', order: 'asc'}]};
        const results: any[] = await provider.query('test-collection', queryOptions);
        expect(results.length).toBe(3);
        expect(results[0].value).toBe(100);
        expect(results[1].value).toBe(200);
        expect(results[2].value).toBe(300);
    });

    it('should query items with pagination', async () => {
        for (let i = 1; i <= 5; i++) {
            await provider.create('test-collection', {name: `Item ${i}`, value: i * 100});
        }
        const queryOptions: QueryOptions = {limit: 2, offset: 1, sortBy: [{field: 'value', order: 'asc'}]};
        const results: any[] = await provider.query('test-collection', queryOptions);
        expect(results.length).toBe(2);
        expect(results[0].value).toBe(200);
        expect(results[1].value).toBe(300);
    });

    it('should return empty array when querying a non-existent collection', async () => {
        const results = await provider.query('non-existent-collection', {});
        expect(results).toEqual([]);
    });

    it('should work with multiple collections', async () => {
        await provider.create('collection1', {name: 'Item 1', value: 100});
        await provider.create('collection2', {name: 'Item A', code: 'X1'});
        const result1: any[] = await provider.query('collection1', {});
        const result2: any[] = await provider.query('collection2', {});
        expect(result1.length).toBe(1);
        expect(result2.length).toBe(1);
        expect(result1[0].name).toBe('Item 1');
        expect(result2[0].name).toBe('Item A');
    });

    it('should load data from existing file on connect', async () => {
        await provider.disconnect();
        const testData = {'test-id-1': {id: 'test-id-1', name: 'Preloaded Item', value: 999}};
        // Set file using a normalized path (testDir is already normalized-like)
        (fsPromises as any).__mockFiles.set(normalizePath(`${testDir}/preload-collection.json`), JSON.stringify(testData));
        (fsPromises as any).__mockDirectories.add(normalizePath(testDir));

        await provider.connect(); // Provider will use OS-specific paths, mock will normalize them
        const result: any = await provider.read('preload-collection', 'test-id-1');

        expect(result).not.toBeNull(); // This should now pass
        expect(result?.id).toBe('test-id-1');
        expect(result?.name).toBe('Preloaded Item');
        expect(result?.value).toBe(999);
    });

    it('should use single file mode when configured', async () => {
        await provider.disconnect();
        const singleFileProvider = new JsonFileProvider({
            directoryPath: testDir,
            useSingleFile: true,
            writeDebounceMs: 0
        });
        await singleFileProvider.connect();

        vi.mocked(fsPromises.writeFile).mockClear();
        vi.mocked(fsPromises.rename).mockClear();

        await singleFileProvider.create('collection1', {name: 'Item 1'});
        await singleFileProvider.create('collection2', {name: 'Item 2'});
        await new Promise(resolve => setTimeout(resolve, 10));
        await (singleFileProvider as any).flushPendingWrites();

        const writeFileCalls = vi.mocked(fsPromises.writeFile).mock.calls;
        const databaseWrites = writeFileCalls.filter(([filePath]) =>
            filePath && normalizePath(filePath.toString()).includes('database.json.tmp')
        );
        expect(databaseWrites.length).toBeGreaterThan(0);

        let foundCollections = false;
        for (const writeCall of databaseWrites) {
            const [_, content] = writeCall;
            if (typeof content === 'string') {
                try {
                    const parsedContent = JSON.parse(content);
                    if (parsedContent.collection1 && parsedContent.collection2) {
                        foundCollections = true;
                        break;
                    }
                } catch (e) { /* Ignore */
                }
            }
        }
        expect(foundCollections).toBe(true);
        await singleFileProvider.disconnect();
    });
});
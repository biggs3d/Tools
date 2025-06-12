import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRepository, MemoryQuery } from '../src/memory.repository.js';
import { createDatabaseService, DatabaseType } from '@mcp/database-services';
import type { MemoryRecord } from '@mcp/shared-types';

describe('MemoryRepository', () => {
    let repository: MemoryRepository;

    beforeEach(async () => {
        // Use in-memory database for testing
        const dbService = createDatabaseService({
            type: DatabaseType.InMemory,
            providerConfig: {}
        });
        repository = new MemoryRepository(dbService);
        await repository.initialize();
    });

    describe('Basic CRUD operations', () => {
        it('should add and retrieve a memory', async () => {
            const record: MemoryRecord = {
                id: 'test-id',
                content: 'Test memory',
                importance: 5,
                tags: ['test'],
                createdAt: '2023-01-01T00:00:00.000Z',
                lastAccessed: '2023-01-01T00:00:00.000Z',
                accessCount: 1
            };

            const added = await repository.add(record);
            expect(added).toEqual(record);

            const retrieved = await repository.getById('test-id');
            expect(retrieved).toEqual(record);
        });

        it('should update a memory', async () => {
            const record: MemoryRecord = {
                id: 'update-test',
                content: 'Original content',
                importance: 3,
                tags: ['original'],
                createdAt: '2023-01-01T00:00:00.000Z',
                lastAccessed: '2023-01-01T00:00:00.000Z',
                accessCount: 1
            };

            await repository.add(record);

            const updates = {
                content: 'Updated content',
                importance: 7,
                tags: ['updated']
            };

            const updated = await repository.update('update-test', updates);
            expect(updated?.content).toBe('Updated content');
            expect(updated?.importance).toBe(7);
            expect(updated?.tags).toEqual(['updated']);
        });

        it('should delete a memory', async () => {
            const record: MemoryRecord = {
                id: 'delete-test',
                content: 'To be deleted',
                importance: 1,
                tags: [],
                createdAt: '2023-01-01T00:00:00.000Z',
                lastAccessed: '2023-01-01T00:00:00.000Z',
                accessCount: 1
            };

            await repository.add(record);
            expect(await repository.exists('delete-test')).toBe(true);

            const deleted = await repository.delete('delete-test');
            expect(deleted).toBe(true);
            expect(await repository.exists('delete-test')).toBe(false);
        });

        it('should return null for non-existent memory', async () => {
            const result = await repository.getById('non-existent');
            expect(result).toBeNull();
        });
    });

    describe('Find method with queries', () => {
        beforeEach(async () => {
            // Add test data
            const testMemories: MemoryRecord[] = [
                {
                    id: '1',
                    content: 'JavaScript is a programming language',
                    importance: 8,
                    tags: ['programming', 'javascript'],
                    createdAt: '2023-01-01T00:00:00.000Z',
                    lastAccessed: '2023-01-01T00:00:00.000Z',
                    accessCount: 5
                },
                {
                    id: '2',
                    content: 'TypeScript adds types to JavaScript',
                    importance: 9,
                    tags: ['programming', 'typescript', 'javascript'],
                    createdAt: '2023-01-02T00:00:00.000Z',
                    lastAccessed: '2023-01-02T00:00:00.000Z',
                    accessCount: 3
                },
                {
                    id: '3',
                    content: 'React is a JavaScript framework',
                    importance: 7,
                    tags: ['programming', 'react', 'javascript'],
                    createdAt: '2023-01-03T00:00:00.000Z',
                    lastAccessed: '2023-01-03T00:00:00.000Z',
                    accessCount: 8
                },
                {
                    id: '4',
                    content: 'Python is great for data science',
                    importance: 6,
                    tags: ['programming', 'python', 'datascience'],
                    createdAt: '2023-01-04T00:00:00.000Z',
                    lastAccessed: '2023-01-04T00:00:00.000Z',
                    accessCount: 2
                }
            ];

            for (const memory of testMemories) {
                await repository.add(memory);
            }
        });

        it('should filter by text query', async () => {
            const query: MemoryQuery = {
                textQuery: 'typescript'
            };

            const results = await repository.find(query);
            expect(results).toHaveLength(1);
            expect(results[0].content).toContain('TypeScript');
        });

        it('should filter by tags', async () => {
            const query: MemoryQuery = {
                tags: ['javascript']
            };

            const results = await repository.find(query);
            expect(results).toHaveLength(3);
            expect(results.every(r => r.tags.includes('javascript'))).toBe(true);
        });

        it('should filter by multiple tags (AND logic)', async () => {
            const query: MemoryQuery = {
                tags: ['programming', 'typescript']
            };

            const results = await repository.find(query);
            expect(results).toHaveLength(1);
            expect(results[0].content).toContain('TypeScript');
        });

        it('should filter by importance range', async () => {
            const query: MemoryQuery = {
                importanceRange: [8, 10]
            };

            const results = await repository.find(query);
            expect(results).toHaveLength(2);
            expect(results.every(r => r.importance >= 8)).toBe(true);
        });

        it('should sort by importance descending', async () => {
            const query: MemoryQuery = {
                sortBy: 'importance',
                sortOrder: 'desc'
            };

            const results = await repository.find(query);
            expect(results).toHaveLength(4);
            expect(results[0].importance).toBe(9); // TypeScript
            expect(results[1].importance).toBe(8); // JavaScript
            expect(results[2].importance).toBe(7); // React
            expect(results[3].importance).toBe(6); // Python
        });

        it('should sort by accessCount ascending', async () => {
            const query: MemoryQuery = {
                sortBy: 'accessCount',
                sortOrder: 'asc'
            };

            const results = await repository.find(query);
            expect(results[0].accessCount).toBe(2); // Python
            expect(results[1].accessCount).toBe(3); // TypeScript
            expect(results[2].accessCount).toBe(5); // JavaScript
            expect(results[3].accessCount).toBe(8); // React
        });

        it('should apply pagination with limit', async () => {
            const query: MemoryQuery = {
                limit: 2,
                sortBy: 'importance',
                sortOrder: 'desc'
            };

            const results = await repository.find(query);
            expect(results).toHaveLength(2);
            expect(results[0].importance).toBe(9);
            expect(results[1].importance).toBe(8);
        });

        it('should apply pagination with offset', async () => {
            const query: MemoryQuery = {
                limit: 2,
                offset: 2,
                sortBy: 'importance',
                sortOrder: 'desc'
            };

            const results = await repository.find(query);
            expect(results).toHaveLength(2);
            expect(results[0].importance).toBe(7); // React (3rd highest)
            expect(results[1].importance).toBe(6); // Python (4th highest)
        });

        it('should combine text search and tag filtering', async () => {
            const query: MemoryQuery = {
                textQuery: 'javascript',
                tags: ['react']
            };

            const results = await repository.find(query);
            expect(results).toHaveLength(1);
            expect(results[0].content).toContain('React');
        });

        it('should return empty array when no matches', async () => {
            const query: MemoryQuery = {
                textQuery: 'nonexistent'
            };

            const results = await repository.find(query);
            expect(results).toHaveLength(0);
        });
    });

    describe('Count method', () => {
        beforeEach(async () => {
            // Add test data
            const testMemories: MemoryRecord[] = [
                {
                    id: '1',
                    content: 'Test 1',
                    importance: 5,
                    tags: ['test'],
                    createdAt: '2023-01-01T00:00:00.000Z',
                    lastAccessed: '2023-01-01T00:00:00.000Z',
                    accessCount: 1
                },
                {
                    id: '2',
                    content: 'Test 2',
                    importance: 5,
                    tags: ['test'],
                    createdAt: '2023-01-02T00:00:00.000Z',
                    lastAccessed: '2023-01-02T00:00:00.000Z',
                    accessCount: 1
                },
                {
                    id: '3',
                    content: 'Different content',
                    importance: 5,
                    tags: ['other'],
                    createdAt: '2023-01-03T00:00:00.000Z',
                    lastAccessed: '2023-01-03T00:00:00.000Z',
                    accessCount: 1
                }
            ];

            for (const memory of testMemories) {
                await repository.add(memory);
            }
        });

        it('should count all memories', async () => {
            const count = await repository.count();
            expect(count).toBe(3);
        });

        it('should count filtered memories', async () => {
            const count = await repository.count({
                tags: ['test']
            });
            expect(count).toBe(2);
        });
    });

    describe('Error handling', () => {
        it('should handle errors when repository not initialized', async () => {
            const uninitializedRepo = new MemoryRepository(
                createDatabaseService({
                    type: DatabaseType.InMemory,
                    providerConfig: {}
                })
            );

            await expect(uninitializedRepo.getById('test')).rejects.toThrow('not initialized');
        });
    });
});
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService, createDatabaseService, IDatabaseConfig } from '@mcp/database-services';
import type { MemoryRecord } from '@mcp/shared-types';
import { MemoryRepository, MemoryQuery } from './memory.repository.js';

export class MemoryService {
    private dbService: DatabaseService;
    private memoryRepository: MemoryRepository;

    constructor(dbConfig: IDatabaseConfig) {
        this.dbService = createDatabaseService(dbConfig);
        this.memoryRepository = new MemoryRepository(this.dbService);
    }

    async initialize(): Promise<void> {
        // Initialize the repository (which gets the provider)
        await this.memoryRepository.initialize();
        console.error('MemoryService initialized successfully');
    }

    async remember(content: string, importance: number, tags: string[]): Promise<MemoryRecord> {
        const now = new Date().toISOString();

        const newRecord: MemoryRecord = {
            id: uuidv4(),
            content,
            importance: Math.max(0, Math.min(10, importance)),
            tags: tags || [],
            createdAt: now,
            lastAccessed: now,
            accessCount: 1,
        };

        return this.memoryRepository.add(newRecord);
    }

    async recall(query: string, tags?: string[], limit: number = 10): Promise<MemoryRecord[]> {
        // Use repository's find method with constructed query
        const memoryQuery: MemoryQuery = {
            textQuery: query,
            tags: tags,
            limit: limit,
            sortBy: 'relevance', // Use relevance-based sorting (importance in Phase 1)
            sortOrder: 'desc',
            searchStrategy: 'text', // Phase 1: always text search
        };

        return this.memoryRepository.find(memoryQuery);
    }

    async getMemory(id: string): Promise<MemoryRecord | null> {
        const memory = await this.memoryRepository.getById(id);

        if (memory) {
            // Business logic: Update access tracking
            // NOTE: Potential race condition - accessCount increment is not atomic
            // In Phase 2, consider using atomic updates or versioning
            const updates = {
                lastAccessed: new Date().toISOString(),
                accessCount: memory.accessCount + 1,
            };
            
            const updated = await this.memoryRepository.update(id, updates);
            return updated || memory; // Return updated version or fallback to original
        }
        return null;
    }

    async forget(id: string): Promise<boolean> {
        return this.memoryRepository.delete(id);
    }

    async listMemories(tags?: string[], limit: number = 20, sortBy: 'createdAt' | 'lastAccessed' | 'importance' = 'createdAt', offset: number = 0): Promise<MemoryRecord[]> {
        // Use repository's find method for consistent querying
        const memoryQuery: MemoryQuery = {
            tags: tags,
            limit: limit,
            offset: offset,
            sortBy: sortBy,
            sortOrder: 'desc', // Default to descending for list views
        };

        return this.memoryRepository.find(memoryQuery);
    }

    async updateMemory(id: string, content?: string, importance?: number, tags?: string[]): Promise<MemoryRecord | null> {
        // Check if memory exists
        if (!(await this.memoryRepository.exists(id))) {
            return null;
        }

        const updates: Partial<MemoryRecord> = {
            lastAccessed: new Date().toISOString(),
        };

        if (content !== undefined) {
            updates.content = content;
        }
        if (importance !== undefined) {
            updates.importance = Math.max(0, Math.min(10, importance));
        }
        if (tags !== undefined) {
            updates.tags = tags;
        }

        return this.memoryRepository.update(id, updates);
    }
}
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService, createDatabaseService, IDatabaseConfig, QueryOptions } from '@mcp/database-services';
import { MemoryRecord } from '@mcp/shared-types';

const MEMORIES_COLLECTION = 'memories';

export class MemoryService {
    private dbService: DatabaseService;

    constructor(dbConfig: IDatabaseConfig) {
        this.dbService = createDatabaseService(dbConfig);
    }

    async initialize(): Promise<void> {
        const provider = await this.dbService.getProvider();
        // In a real scenario with SQLite, you might ensure a schema here.
        // For JsonFileProvider, this is not necessary.
        console.log('MemoryService initialized with provider:', provider.constructor.name);
    }

    async remember(content: string, importance: number, tags: string[]): Promise<MemoryRecord> {
        const provider = await this.dbService.getProvider();
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

        // The 'create' method in database-services should handle adding the item.
        // We pass the full object. The provider will use the 'id' field.
        const createdRecord = await provider.create<MemoryRecord>(MEMORIES_COLLECTION, newRecord);
        return createdRecord;
    }

    async recall(query: string, tags?: string[], limit: number = 10): Promise<MemoryRecord[]> {
        const provider = await this.dbService.getProvider();

        // Phase 1: Simple text search.
        // Phase 2 will involve vector search here.
        const allMemories = await provider.query<MemoryRecord>(MEMORIES_COLLECTION, {});

        const queryLower = query.toLowerCase();
        const filtered = allMemories.filter(record => {
            const contentMatch = record.content.toLowerCase().includes(queryLower);
            const tagMatch = tags ? tags.every(tag => record.tags.includes(tag)) : true;
            return contentMatch && tagMatch;
        });

        // Sort by importance and recency
        filtered.sort((a, b) => {
            if (b.importance !== a.importance) {
                return b.importance - a.importance;
            }
            return new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime();
        });

        return filtered.slice(0, limit);
    }

    async getMemory(id: string): Promise<MemoryRecord | null> {
        const provider = await this.dbService.getProvider();
        const memory = await provider.read<MemoryRecord>(MEMORIES_COLLECTION, id);

        if (memory) {
            memory.lastAccessed = new Date().toISOString();
            memory.accessCount++;
            await provider.update<MemoryRecord>(MEMORIES_COLLECTION, id, {
                lastAccessed: memory.lastAccessed,
                accessCount: memory.accessCount
            });
        }
        return memory;
    }

    async forget(id: string): Promise<boolean> {
        const provider = await this.dbService.getProvider();
        return provider.delete(MEMORIES_COLLECTION, id);
    }
}
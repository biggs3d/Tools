import { DatabaseService, IDatabaseProvider } from '@mcp/database-services';
import type { MemoryRecord } from '@mcp/shared-types';

const MEMORIES_COLLECTION = 'memories';

/**
 * Flexible query interface for memory operations
 * Supports current Phase 1 functionality and extensibility for Phase 2 vector search
 */
export interface MemoryQuery {
    // Text-based search (Phase 1)
    textQuery?: string;
    
    // Vector-based search (Phase 2 - future)
    vectorQuery?: number[];
    
    // Filters
    tags?: string[];
    importanceRange?: [number, number];
    dateRange?: [string, string]; // ISO date strings
    
    // Sorting
    sortBy?: 'createdAt' | 'lastAccessed' | 'importance' | 'relevance' | 'accessCount';
    sortOrder?: 'asc' | 'desc';
    
    // Pagination
    limit?: number;
    offset?: number;
    
    // Search strategy (for Phase 2 extensibility)
    searchStrategy?: 'text' | 'vector' | 'hybrid';
    
    // Performance hints
    includeAccessTracking?: boolean; // Whether to update access stats during retrieval
}

/**
 * Repository class for memory data access operations
 * Provides abstraction layer between MemoryService and DatabaseService
 * Designed for extensibility to support vector search in Phase 2
 */
export class MemoryRepository {
    private dbService: DatabaseService;
    private provider: IDatabaseProvider | null = null;

    constructor(dbService: DatabaseService) {
        this.dbService = dbService;
    }

    /**
     * Initialize the repository by obtaining the database provider
     */
    async initialize(): Promise<void> {
        this.provider = await this.dbService.getProvider();
        console.error('MemoryRepository initialized with provider:', this.provider.constructor.name);
    }

    /**
     * Ensure provider is available, throwing error if not initialized
     */
    private ensureProvider(): IDatabaseProvider {
        if (!this.provider) {
            throw new Error('MemoryRepository not initialized. Call initialize() first.');
        }
        return this.provider;
    }

    /**
     * Add a new memory record
     */
    async add(record: MemoryRecord): Promise<MemoryRecord> {
        const provider = this.ensureProvider();
        return provider.create<MemoryRecord>(MEMORIES_COLLECTION, record);
    }

    /**
     * Get a memory by ID
     */
    async getById(id: string): Promise<MemoryRecord | null> {
        const provider = this.ensureProvider();
        return provider.read<MemoryRecord>(MEMORIES_COLLECTION, id);
    }

    /**
     * Update a memory record
     */
    async update(id: string, updates: Partial<MemoryRecord>): Promise<MemoryRecord | null> {
        const provider = this.ensureProvider();
        return provider.update<MemoryRecord>(MEMORIES_COLLECTION, id, updates);
    }

    /**
     * Delete a memory record
     */
    async delete(id: string): Promise<boolean> {
        const provider = this.ensureProvider();
        return provider.delete(MEMORIES_COLLECTION, id);
    }

    /**
     * Find memories based on flexible query criteria
     * Phase 1: Implements text search with in-memory filtering/sorting
     * Phase 2: Will add vector search and database-level optimizations
     */
    async find(query: MemoryQuery): Promise<MemoryRecord[]> {
        const provider = this.ensureProvider();
        
        // Phase 1: Fetch all memories and filter in-memory
        // TODO Phase 2: Optimize with database-level queries for supported providers
        const allMemories = await provider.query<MemoryRecord>(MEMORIES_COLLECTION, {});

        let results = allMemories;

        // Apply filters
        results = this.applyFilters(results, query);

        // Apply sorting
        results = this.applySorting(results, query);

        // Apply pagination
        results = this.applyPagination(results, query);

        return results;
    }

    /**
     * Apply filter criteria to memory results
     */
    private applyFilters(memories: MemoryRecord[], query: MemoryQuery): MemoryRecord[] {
        let filtered = memories;

        // Text query filter
        if (query.textQuery) {
            const queryLower = query.textQuery.toLowerCase();
            filtered = filtered.filter(record =>
                record.content.toLowerCase().includes(queryLower) ||
                record.tags.some(tag => tag.toLowerCase().includes(queryLower))
            );
        }

        // Tags filter (must have ALL specified tags)
        if (query.tags && query.tags.length > 0) {
            filtered = filtered.filter(record =>
                query.tags!.every(tag => record.tags.includes(tag))
            );
        }

        // Importance range filter
        if (query.importanceRange) {
            const [min, max] = query.importanceRange;
            filtered = filtered.filter(record =>
                record.importance >= min && record.importance <= max
            );
        }

        // Date range filter
        if (query.dateRange) {
            const [startDate, endDate] = query.dateRange;
            const start = new Date(startDate).getTime();
            const end = new Date(endDate).getTime();
            filtered = filtered.filter(record => {
                const recordDate = new Date(record.createdAt).getTime();
                return recordDate >= start && recordDate <= end;
            });
        }

        return filtered;
    }

    /**
     * Apply sorting to memory results
     */
    private applySorting(memories: MemoryRecord[], query: MemoryQuery): MemoryRecord[] {
        const sortBy = query.sortBy || 'createdAt';
        const sortOrder = query.sortOrder || 'desc';
        const multiplier = sortOrder === 'asc' ? 1 : -1;

        return memories.sort((a, b) => {
            let comparison = 0;

            switch (sortBy) {
                case 'importance':
                    comparison = a.importance - b.importance;
                    break;
                case 'lastAccessed':
                    comparison = new Date(a.lastAccessed).getTime() - new Date(b.lastAccessed).getTime();
                    break;
                case 'accessCount':
                    comparison = a.accessCount - b.accessCount;
                    break;
                case 'relevance':
                    // Phase 1: Use importance as relevance proxy
                    // Phase 2: Will implement semantic relevance
                    comparison = a.importance - b.importance;
                    break;
                case 'createdAt':
                default:
                    comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    break;
            }

            return comparison * multiplier;
        });
    }

    /**
     * Apply pagination to memory results
     */
    private applyPagination(memories: MemoryRecord[], query: MemoryQuery): MemoryRecord[] {
        const offset = query.offset || 0;
        const limit = query.limit || memories.length;

        return memories.slice(offset, offset + limit);
    }

    /**
     * Get total count of memories (useful for pagination metadata)
     */
    async count(query?: Partial<MemoryQuery>): Promise<number> {
        if (!query) {
            const provider = this.ensureProvider();
            const allMemories = await provider.query<MemoryRecord>(MEMORIES_COLLECTION, {});
            return allMemories.length;
        }

        // For filtered counts, we need to apply filters
        const filteredQuery: MemoryQuery = { ...query, limit: undefined, offset: undefined };
        const results = await this.find(filteredQuery);
        return results.length;
    }

    /**
     * Check if a memory exists by ID
     */
    async exists(id: string): Promise<boolean> {
        const memory = await this.getById(id);
        return memory !== null;
    }
}
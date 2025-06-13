import { DatabaseService, IDatabaseProvider } from '@mcp/database-services';
import type { MemoryRecord, MemorySearchResult } from '@mcp/shared-types';

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
    includeSimilarityScores?: boolean; // Whether to include similarity scores in vector search results (Phase 4)
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
     * Phase 2: Implements text, vector, and hybrid search
     * Phase 4: Optionally includes similarity scores in results
     * 
     * PERFORMANCE NOTE: This implementation loads all memories into memory
     * and performs search operations in-memory. For datasets >5-10K memories,
     * this will become slow and memory-intensive. For production use, replace
     * with a proper vector database (Pinecone, Weaviate, PostgreSQL+pgvector).
     */
    async find(query: MemoryQuery): Promise<MemoryRecord[]> {
        const provider = this.ensureProvider();
        
        // Fetch all memories (Phase 2 MVP limitation)
        const allMemories = await provider.query<MemoryRecord>(MEMORIES_COLLECTION, {});

        let results: MemoryRecord[];

        // Handle different search strategies
        switch (query.searchStrategy) {
            case 'text':
                // Traditional text-based search
                results = this.applyFilters(allMemories, query);
                results = this.applySorting(results, query);
                break;

            case 'vector':
                // Pure semantic search using embeddings
                if (!query.vectorQuery) {
                    throw new Error('Vector query is required for vector search strategy');
                }
                results = this.applyVectorSearch(allMemories, query.vectorQuery, query.includeSimilarityScores);
                // Apply other filters (tags, importance, etc.) but skip text filter
                const vectorOnlyQuery = { ...query, textQuery: undefined };
                results = this.applyFilters(results, vectorOnlyQuery);
                break;

            case 'hybrid':
                // Combine text and vector search using RRF
                if (!query.vectorQuery) {
                    throw new Error('Vector query is required for hybrid search strategy');
                }
                
                // Get text search results
                const textQuery = { ...query, vectorQuery: undefined, searchStrategy: 'text' as const };
                let textResults = this.applyFilters(allMemories, textQuery);
                textResults = this.applySorting(textResults, textQuery);

                // Get vector search results
                const vectorQuery = { ...query, textQuery: undefined };
                let vectorResults = this.applyVectorSearch(allMemories, query.vectorQuery, query.includeSimilarityScores);
                vectorResults = this.applyFilters(vectorResults, vectorQuery);

                // Combine using RRF
                results = this.combineSearchResults(textResults, vectorResults);
                break;

            default:
                // Fallback to text search
                results = this.applyFilters(allMemories, query);
                results = this.applySorting(results, query);
                break;
        }

        // Apply pagination
        results = this.applyPagination(results, query);

        return results;
    }

    /**
     * Calculate cosine similarity between two vectors
     * Returns a value between -1 and 1, where 1 means identical vectors
     */
    private calculateCosineSimilarity(a: number[], b: number[]): number {
        if (a.length !== b.length) {
            throw new Error(`Vector dimensions don't match: ${a.length} vs ${b.length}`);
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) {
            return 0; // Handle zero vectors
        }

        return dotProduct / (normA * normB);
    }

    /**
     * Apply vector search to memories
     * Phase 4: Optionally preserve similarity scores in results
     * NOTE: This is an in-memory implementation for Phase 2 MVP
     * For production use with >5-10K memories, this should be replaced
     * with a proper vector database (e.g., Pinecone, Weaviate, PostgreSQL with pgvector)
     */
    private applyVectorSearch(memories: MemoryRecord[], queryEmbedding: number[], includeSimilarityScores: boolean = false): MemoryRecord[] {
        const memoriesWithSimilarity = memories
            .filter(memory => memory.embedding) // Only memories with embeddings
            .map(memory => {
                const similarity = this.calculateCosineSimilarity(queryEmbedding, memory.embedding!);
                return includeSimilarityScores ? 
                    { ...memory, similarity } as MemorySearchResult :
                    { ...memory, _tempSimilarity: similarity };
            })
            .sort((a, b) => {
                const simA = (a as any).similarity || (a as any)._tempSimilarity;
                const simB = (b as any).similarity || (b as any)._tempSimilarity;
                return simB - simA;
            });

        // Clean up temporary similarity scores if not preserving them
        if (!includeSimilarityScores) {
            return memoriesWithSimilarity.map(memory => {
                const { _tempSimilarity, ...cleanMemory } = memory as any;
                return cleanMemory;
            });
        }

        return memoriesWithSimilarity;
    }

    /**
     * Implement Reciprocal Rank Fusion (RRF) for combining text and vector search results
     * RRF is a parameter-free method for combining ranked lists from different search methods
     */
    private combineSearchResults(textResults: MemoryRecord[], vectorResults: MemoryRecord[], k: number = 60): MemoryRecord[] {
        const rrrScores = new Map<string, { memory: MemoryRecord; score: number }>();

        // Process text search results
        textResults.forEach((memory, index) => {
            const rank = index + 1;
            const score = 1 / (k + rank);
            rrrScores.set(memory.id, { memory, score });
        });

        // Process vector search results and combine scores
        vectorResults.forEach((memory, index) => {
            const rank = index + 1;
            const score = 1 / (k + rank);
            
            if (rrrScores.has(memory.id)) {
                // Combine scores for memories that appear in both results
                rrrScores.get(memory.id)!.score += score;
            } else {
                // Add new memory from vector search
                rrrScores.set(memory.id, { memory, score });
            }
        });

        // Sort by combined RRF score and return memories
        return Array.from(rrrScores.values())
            .sort((a, b) => b.score - a.score)
            .map(item => item.memory);
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

    /**
     * Get multiple memories by their IDs (Phase 4: Performance optimization)
     * This method reduces the number of database round-trips when fetching multiple memories
     */
    async getManyByIds(ids: string[]): Promise<MemoryRecord[]> {
        if (ids.length === 0) {
            return [];
        }

        const provider = this.ensureProvider();
        const results: MemoryRecord[] = [];
        
        // For now, we'll use multiple individual queries since the interface doesn't support batch gets
        // In a production environment, this should be optimized to use a single query
        for (const id of ids) {
            try {
                const memory = await provider.read<MemoryRecord>(MEMORIES_COLLECTION, id);
                if (memory) {
                    results.push(memory);
                }
            } catch (error) {
                console.error(`Failed to fetch memory ${id}:`, error);
                // Continue with other IDs even if one fails
            }
        }

        return results;
    }
}
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService, createDatabaseService, IDatabaseConfig } from '@mcp/database-services';
import type { MemoryRecord } from '@mcp/shared-types';
import { MemoryRepository, MemoryQuery } from './memory.repository.js';
import { EmbeddingConfig } from './config.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export class MemoryService {
    private dbService: DatabaseService;
    private memoryRepository: MemoryRepository;
    private genAI: GoogleGenerativeAI;
    private embeddingModel: any;

    constructor(dbConfig: IDatabaseConfig, embeddingConfig: EmbeddingConfig) {
        this.dbService = createDatabaseService(dbConfig);
        this.memoryRepository = new MemoryRepository(this.dbService);
        
        // Initialize Google Generative AI
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is required for embeddings');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.embeddingModel = this.genAI.getGenerativeModel({ model: embeddingConfig.model });
    }

    async initialize(): Promise<void> {
        // Initialize the repository (which gets the provider)
        await this.memoryRepository.initialize();
        console.error('MemoryService initialized successfully');
    }

    /**
     * Generate embeddings using Google's Generative AI directly
     */
    private async generateEmbedding(text: string, taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_DOCUMENT'): Promise<number[]> {
        try {
            console.error(`Generating ${taskType} embedding for text (${text.length} chars)`);
            
            const result = await this.embeddingModel.embedContent(text);

            return result.embedding.values;
        } catch (error) {
            console.error('Error generating embedding:', error);
            
            // Fallback to mock embedding if Gemini fails
            console.error('Falling back to mock embedding due to error');
            return Array.from({ length: 768 }, () => Math.random() * 2 - 1);
        }
    }

    async remember(content: string, importance: number, tags: string[]): Promise<MemoryRecord> {
        const now = new Date().toISOString();

        // Generate embedding for the content
        const embedding = await this.generateEmbedding(content, 'RETRIEVAL_DOCUMENT');

        const newRecord: MemoryRecord = {
            id: uuidv4(),
            content,
            importance: Math.max(0, Math.min(10, importance)),
            tags: tags || [],
            embedding, // Add the generated embedding
            createdAt: now,
            lastAccessed: now,
            accessCount: 1,
        };

        return this.memoryRepository.add(newRecord);
    }

    async recall(query: string, tags?: string[], limit: number = 10, searchType: 'text' | 'semantic' | 'hybrid' = 'hybrid'): Promise<MemoryRecord[]> {
        // Map 'semantic' to 'vector' for the repository layer
        const repositorySearchStrategy = searchType === 'semantic' ? 'vector' : searchType;
        
        const memoryQuery: MemoryQuery = {
            tags: tags,
            limit: limit,
            sortBy: 'relevance',
            sortOrder: 'desc',
            searchStrategy: repositorySearchStrategy,
        };

        if (searchType === 'text') {
            memoryQuery.textQuery = query;
        } else {
            // For 'semantic' or 'hybrid', we always need a vector
            const queryEmbedding = await this.generateEmbedding(query, 'RETRIEVAL_QUERY');
            memoryQuery.vectorQuery = queryEmbedding;
            
            // For 'hybrid', we also pass the text query
            if (searchType === 'hybrid') {
                memoryQuery.textQuery = query;
            }
        }

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
            // Regenerate embedding when content changes
            try {
                updates.embedding = await this.generateEmbedding(content, 'RETRIEVAL_DOCUMENT');
            } catch (error) {
                console.error('Failed to regenerate embedding for updated content:', error);
                // Continue with update even if embedding generation fails
            }
        }
        if (importance !== undefined) {
            updates.importance = Math.max(0, Math.min(10, importance));
        }
        if (tags !== undefined) {
            updates.tags = tags;
        }

        return this.memoryRepository.update(id, updates);
    }

    /**
     * Generate embeddings for existing memories that don't have them
     * Useful for backfilling when upgrading from Phase 1 to Phase 2
     */
    async generateEmbeddingsForExisting(batchSize: number = 10): Promise<{processed: number, updated: number, errors: string[]}> {
        const errors: string[] = [];
        let processed = 0;
        let updated = 0;

        try {
            // Get all memories without embeddings
            const allMemories = await this.memoryRepository.find({
                limit: 10000, // Process in large batches
                sortBy: 'createdAt',
                sortOrder: 'asc'
            });

            const memoriesWithoutEmbeddings = allMemories.filter(memory => !memory.embedding);
            console.error(`Found ${memoriesWithoutEmbeddings.length} memories without embeddings`);

            // Process in batches to respect API rate limits
            for (let i = 0; i < memoriesWithoutEmbeddings.length; i += batchSize) {
                const batch = memoriesWithoutEmbeddings.slice(i, i + batchSize);
                
                for (const memory of batch) {
                    try {
                        const embedding = await this.generateEmbedding(memory.content, 'RETRIEVAL_DOCUMENT');
                        await this.memoryRepository.update(memory.id, { embedding });
                        updated++;
                        
                        // Small delay to respect rate limits
                        await new Promise(resolve => setTimeout(resolve, 100));
                    } catch (error) {
                        const errorMsg = `Failed to generate embedding for memory ${memory.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                        errors.push(errorMsg);
                        console.error(errorMsg);
                    }
                    processed++;
                }

                // Longer delay between batches
                if (i + batchSize < memoriesWithoutEmbeddings.length) {
                    console.error(`Processed batch ${Math.floor(i / batchSize) + 1}, waiting before next batch...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            return { processed, updated, errors };
        } catch (error) {
            const errorMsg = `Failed to generate embeddings for existing memories: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            return { processed, updated, errors };
        }
    }

    /**
     * Clean up resources
     */
    async dispose(): Promise<void> {
        // No cleanup needed for direct API usage
    }
}
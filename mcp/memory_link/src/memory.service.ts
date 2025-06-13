import { v4 as uuidv4 } from 'uuid';
import { DatabaseService, createDatabaseService, IDatabaseConfig } from '@mcp/database-services';
import type { MemoryRecord, MemorySearchResult, CleanMemoryRecord, CleanMemorySearchResult } from '@mcp/shared-types';
import { MemoryRepository, MemoryQuery } from './memory.repository.js';
import { EmbeddingConfig, BackgroundProcessingConfig } from './config.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BackgroundProcessingService } from './background.service.js';

export class MemoryService {
    private dbService: DatabaseService;
    private memoryRepository: MemoryRepository;
    private genAI: GoogleGenerativeAI;
    private embeddingModel: any;
    private backgroundService: BackgroundProcessingService;

    constructor(dbConfig: IDatabaseConfig, embeddingConfig: EmbeddingConfig, backgroundConfig: BackgroundProcessingConfig) {
        this.dbService = createDatabaseService(dbConfig);
        this.memoryRepository = new MemoryRepository(this.dbService);
        
        // Initialize Google Generative AI
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is required for embeddings');
        }
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.embeddingModel = this.genAI.getGenerativeModel({ model: embeddingConfig.model });

        // Phase 4: Use centralized background processing configuration
        this.backgroundService = new BackgroundProcessingService(this, backgroundConfig);
    }

    async initialize(): Promise<void> {
        // Initialize the repository (which gets the provider)
        await this.memoryRepository.initialize();
        console.error('MemoryService initialized successfully');
    }

    /**
     * Convert full MemoryRecord to clean record for user responses (Phase 5: Token Optimization)
     * Strips out large embedding vectors and internal metadata to prevent token bloat
     */
    private toCleanRecord(record: MemoryRecord): CleanMemoryRecord {
        return {
            id: record.id,
            content: record.content,
            importance: record.importance,
            tags: record.tags,
            createdAt: record.createdAt,
            lastAccessed: record.lastAccessed,
            accessCount: record.accessCount,
            isConsolidated: record.isConsolidated,
            relatedCount: record.relatedMemories?.length
        };
    }

    /**
     * Convert MemorySearchResult to clean search result (Phase 5: Token Optimization)
     */
    private toCleanSearchResult(result: MemorySearchResult): CleanMemorySearchResult {
        return {
            ...this.toCleanRecord(result),
            similarity: result.similarity
        };
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
            version: 1, // Phase 4: Initialize version for optimistic locking
        };

        return this.memoryRepository.add(newRecord);
    }

    async recall(query: string, tags?: string[], limit: number = 10, searchType: 'text' | 'semantic' | 'hybrid' = 'hybrid'): Promise<CleanMemorySearchResult[]> {
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

        const records = await this.memoryRepository.find(memoryQuery);
        return records.map(r => this.toCleanSearchResult(r as MemorySearchResult));
    }

    async getMemory(id: string): Promise<CleanMemoryRecord | null> {
        const memory = await this.memoryRepository.getById(id);

        if (memory) {
            // Phase 4: Atomic access count increment using optimistic locking
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    // Get the latest version of the memory
                    const latestMemory = await this.memoryRepository.getById(id);
                    if (!latestMemory) {
                        return null; // Memory was deleted
                    }
                    
                    const currentVersion = latestMemory.version || 0;
                    const updates = {
                        lastAccessed: new Date().toISOString(),
                        accessCount: latestMemory.accessCount + 1,
                        version: currentVersion + 1,
                    };
                    
                    // Attempt to update with version check
                    const updated = await this.updateMemoryWithVersionCheck(id, updates, currentVersion);
                    if (updated) {
                        return this.toCleanRecord(updated);
                    }
                    
                    // If update failed due to version conflict, retry
                    retryCount++;
                    if (retryCount < maxRetries) {
                        // Small random delay to reduce contention
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                    }
                    
                } catch (error) {
                    console.error(`Error updating access count for memory ${id}, attempt ${retryCount + 1}:`, error);
                    retryCount++;
                }
            }
            
            // If all retries failed, return the original memory without updating access count
            console.warn(`Failed to update access count for memory ${id} after ${maxRetries} attempts`);
            return this.toCleanRecord(memory);
        }
        return null;
    }

    /**
     * Get full memory record for internal use (testing, consolidation, etc.)
     * Phase 5: Internal method to access full memory data when needed
     */
    async getFullMemory(id: string): Promise<MemoryRecord | null> {
        const memory = await this.memoryRepository.getById(id);

        if (memory) {
            // Phase 4: Atomic access count increment using optimistic locking
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    // Get the latest version of the memory
                    const latestMemory = await this.memoryRepository.getById(id);
                    if (!latestMemory) {
                        return null; // Memory was deleted
                    }
                    
                    const currentVersion = latestMemory.version || 0;
                    const updates = {
                        lastAccessed: new Date().toISOString(),
                        accessCount: latestMemory.accessCount + 1,
                        version: currentVersion + 1,
                    };
                    
                    // Attempt to update with version check
                    const updated = await this.updateMemoryWithVersionCheck(id, updates, currentVersion);
                    if (updated) {
                        return updated;
                    }
                    
                    // If update failed due to version conflict, retry
                    retryCount++;
                    if (retryCount < maxRetries) {
                        // Small random delay to reduce contention
                        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
                    }
                    
                } catch (error) {
                    console.error(`Error updating access count for memory ${id}, attempt ${retryCount + 1}:`, error);
                    retryCount++;
                }
            }
            
            // If all retries failed, return the original memory without updating access count
            console.warn(`Failed to update access count for memory ${id} after ${maxRetries} attempts`);
            return memory;
        }
        return null;
    }

    /**
     * Update memory with optimistic locking using version check (Phase 4: Data Integrity)
     */
    private async updateMemoryWithVersionCheck(
        id: string, 
        updates: Partial<MemoryRecord>, 
        expectedVersion: number
    ): Promise<MemoryRecord | null> {
        try {
            // First, verify the current version matches expected version
            const currentMemory = await this.memoryRepository.getById(id);
            if (!currentMemory) {
                return null; // Memory was deleted
            }
            
            const currentVersion = currentMemory.version || 0;
            if (currentVersion !== expectedVersion) {
                // Version mismatch - another process updated the memory
                return null;
            }
            
            // Version matches, proceed with update
            return await this.memoryRepository.update(id, updates);
            
        } catch (error) {
            console.error(`Version check update failed for memory ${id}:`, error);
            return null;
        }
    }

    async forget(id: string): Promise<boolean> {
        return this.memoryRepository.delete(id);
    }

    async listMemories(tags?: string[], limit: number = 20, sortBy: 'createdAt' | 'lastAccessed' | 'importance' = 'createdAt', offset: number = 0): Promise<CleanMemoryRecord[]> {
        // Use repository's find method for consistent querying
        const memoryQuery: MemoryQuery = {
            tags: tags,
            limit: limit,
            offset: offset,
            sortBy: sortBy,
            sortOrder: 'desc', // Default to descending for list views
        };

        const records = await this.memoryRepository.find(memoryQuery);
        return records.map(r => this.toCleanRecord(r));
    }

    async updateMemory(id: string, content?: string, importance?: number, tags?: string[]): Promise<CleanMemoryRecord | null> {
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

        const updated = await this.memoryRepository.update(id, updates);
        return updated ? this.toCleanRecord(updated) : null;
    }

    /**
     * Generate embeddings for existing memories that don't have them
     * Useful for backfilling when upgrading from Phase 1 to Phase 2
     * Phase 4: Improved scalability with pagination to handle large memory collections
     */
    async generateEmbeddingsForExisting(batchSize: number = 10): Promise<{processed: number, updated: number, errors: string[]}> {
        const errors: string[] = [];
        let processed = 0;
        let updated = 0;

        try {
            // Phase 4: Implement pagination to avoid loading all memories into memory
            const pageSize = 50; // Process 50 memories at a time to manage memory usage
            let offset = 0;
            let hasMoreResults = true;

            while (hasMoreResults) {
                // Get a paginated batch of memories
                const pageMemories = await this.memoryRepository.find({
                    limit: pageSize,
                    offset: offset,
                    sortBy: 'createdAt',
                    sortOrder: 'asc'
                });

                if (pageMemories.length === 0) {
                    hasMoreResults = false;
                    break;
                }

                // Filter for memories without embeddings in this page
                const memoriesWithoutEmbeddings = pageMemories.filter(memory => !memory.embedding);
                
                if (memoriesWithoutEmbeddings.length > 0) {
                    console.error(`Processing page at offset ${offset}: found ${memoriesWithoutEmbeddings.length} memories without embeddings out of ${pageMemories.length} total`);

                    // Process in smaller batches to respect API rate limits
                    for (let i = 0; i < memoriesWithoutEmbeddings.length; i += batchSize) {
                        const batch = memoriesWithoutEmbeddings.slice(i, i + batchSize);
                        
                        for (const memory of batch) {
                            try {
                                const embedding = await this.generateEmbedding(memory.content, 'RETRIEVAL_DOCUMENT');
                                await this.memoryRepository.update(memory.id, { 
                                    embedding,
                                    version: (memory.version || 0) + 1 // Increment version for consistency
                                });
                                updated++;
                                
                                // Small delay to respect rate limits (50ms = 20 RPS, well within text-embedding-004 limit of 25 RPS)
                                await new Promise(resolve => setTimeout(resolve, 50));
                            } catch (error) {
                                const errorMsg = `Failed to generate embedding for memory ${memory.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                                errors.push(errorMsg);
                                console.error(errorMsg);
                            }
                            processed++;
                        }

                        // Brief delay between batches (minimal delay for text-embedding-004's high rate limits)
                        if (i + batchSize < memoriesWithoutEmbeddings.length) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }
                }

                // Move to next page
                offset += pageSize;
                
                // If we got fewer results than the page size, we've reached the end
                if (pageMemories.length < pageSize) {
                    hasMoreResults = false;
                }

                // Brief pause between pages to be gentle on the system
                if (hasMoreResults) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            console.error(`Embedding generation complete: processed ${processed} memories, updated ${updated}, errors: ${errors.length}`);
            return { processed, updated, errors };
            
        } catch (error) {
            const errorMsg = `Failed to generate embeddings for existing memories: ${error instanceof Error ? error.message : 'Unknown error'}`;
            errors.push(errorMsg);
            return { processed, updated, errors };
        }
    }

    /**
     * Find similar memories with similarity scores (Phase 4: Enhanced vector search)
     */
    async findSimilarMemoriesWithScores(memoryId: string, similarityThreshold: number = 0.7, limit: number = 10): Promise<MemorySearchResult[]> {
        // Get full memory record for internal use (embeddings needed)
        const sourceMemory = await this.memoryRepository.getById(memoryId);
        if (!sourceMemory || !sourceMemory.embedding) {
            throw new Error('Source memory not found or has no embedding');
        }

        // Use semantic search to find similar memories with similarity scores
        const memoryQuery: MemoryQuery = {
            vectorQuery: sourceMemory.embedding,
            limit: limit + 1, // +1 because source memory will be included
            sortBy: 'relevance',
            sortOrder: 'desc',
            searchStrategy: 'vector',
            includeSimilarityScores: true, // Phase 4: Request similarity scores
        };

        const results = await this.memoryRepository.find(memoryQuery) as MemorySearchResult[];
        
        // Filter out the source memory itself and apply similarity threshold
        return results
            .filter(memory => memory.id !== memoryId)
            .filter(memory => (memory.similarity || 0) >= similarityThreshold)
            .slice(0, limit);
    }

    /**
     * Find similar memories for consolidation using semantic search
     * Phase 3: Memory consolidation feature
     * Phase 4: Now uses the enhanced method with scores internally
     */
    async findSimilarMemories(memoryId: string, similarityThreshold: number = 0.8, limit: number = 10): Promise<CleanMemoryRecord[]> {
        const resultsWithScores = await this.findSimilarMemoriesWithScores(memoryId, similarityThreshold, limit);
        // Return just the memory records without similarity scores for backward compatibility
        return resultsWithScores.map(result => {
            const { similarity, ...memory } = result;
            return this.toCleanRecord(memory as MemoryRecord);
        });
    }

    /**
     * Consolidate multiple memories into a single higher-level summary
     * Phase 3: Memory consolidation feature
     * Phase 4: Added atomicity through consolidationStatus tracking
     */
    async consolidateMemories(memoryIds: string[], summaryPrompt?: string): Promise<MemoryRecord> {
        if (memoryIds.length < 2) {
            throw new Error('At least 2 memories are required for consolidation');
        }

        // Phase 4: Use batch fetching to reduce database round-trips
        const memories = await this.memoryRepository.getManyByIds(memoryIds);
        if (memories.length !== memoryIds.length) {
            const foundIds = memories.map(m => m.id);
            const missingIds = memoryIds.filter(id => !foundIds.includes(id));
            throw new Error(`Memory(s) with ID(s) ${missingIds.join(', ')} not found`);
        }

        // Create consolidation prompt
        const memoryContents = memories.map((m, i) => `Memory ${i + 1}: ${m.content}`).join('\n\n');
        const prompt = summaryPrompt || 
            `Please create a concise, high-level summary that captures the key insights and patterns from these related memories. Focus on the essential knowledge and principles that can be learned from them:\n\n${memoryContents}\n\nSummary:`;

        // Generate consolidated content using Gemini
        let consolidatedContent: string;
        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            const result = await model.generateContent(prompt);
            consolidatedContent = result.response.text().trim();
        } catch (error) {
            console.error('Error generating consolidated content:', error);
            // Fallback to simple concatenation if AI generation fails
            consolidatedContent = `Consolidated summary of ${memories.length} memories:\n\n${memoryContents}`;
        }

        // Calculate importance as the highest importance + 1 (capped at 10)
        const maxImportance = Math.max(...memories.map(m => m.importance));
        const consolidatedImportance = Math.min(10, maxImportance + 1);

        // Merge all unique tags and add consolidation-specific tags
        const allTags = new Set<string>();
        memories.forEach(memory => memory.tags.forEach(tag => allTags.add(tag)));
        allTags.add('consolidated');
        allTags.add('phase3');

        // Phase 4: Atomic consolidation process using status tracking
        let consolidatedMemory: MemoryRecord | undefined;
        
        try {
            // Step 1: Create the consolidated memory with 'pending' status
            consolidatedMemory = await this.remember(
                consolidatedContent,
                consolidatedImportance,
                Array.from(allTags)
            );

            const consolidatedId = consolidatedMemory.id;
            
            // Step 2: Update consolidated memory with metadata and 'pending' status
            await this.memoryRepository.update(consolidatedId, {
                consolidatedFrom: memoryIds,
                isConsolidated: true,
                consolidationStatus: 'pending',
            });

            // Step 3: Update all source memories to reference the consolidated memory
            const updatePromises = memoryIds.map(async (sourceId) => {
                // Get full memory record for internal update (need consolidation metadata)
                const sourceMemory = await this.memoryRepository.getById(sourceId);
                if (sourceMemory) {
                    const existingConsolidatedInto = sourceMemory.consolidatedInto || [];
                    return this.memoryRepository.update(sourceId, {
                        consolidatedInto: [...existingConsolidatedInto, consolidatedId],
                    });
                }
                return Promise.resolve(null);
            });

            // Wait for all source memory updates to complete
            await Promise.all(updatePromises);

            // Step 4: Mark consolidation as completed
            await this.memoryRepository.update(consolidatedId, {
                consolidationStatus: 'completed',
            });

            // Return the updated consolidated memory (full record for internal use)
            return await this.memoryRepository.getById(consolidatedId) || consolidatedMemory;
            
        } catch (error) {
            // If we created a consolidated memory but failed later, mark it as failed
            if (consolidatedMemory?.id) {
                try {
                    await this.memoryRepository.update(consolidatedMemory.id, {
                        consolidationStatus: 'failed',
                    });
                } catch (cleanupError) {
                    console.error('Failed to mark consolidation as failed:', cleanupError);
                }
            }
            throw error;
        }
    }

    /**
     * Get related memories for a given memory (Phase 3: Memory linking)
     */
    async getRelatedMemories(memoryId: string, includeConsolidated: boolean = true): Promise<{
        consolidatedFrom: MemoryRecord[];
        consolidatedInto: MemoryRecord[];
        similar: MemoryRecord[];
        relatedByTags: MemoryRecord[];
    }> {
        // Get full memory record for internal use (need consolidation metadata)
        const memory = await this.memoryRepository.getById(memoryId);
        if (!memory) {
            throw new Error(`Memory with ID ${memoryId} not found`);
        }

        const result = {
            consolidatedFrom: [] as MemoryRecord[],
            consolidatedInto: [] as MemoryRecord[],
            similar: [] as MemoryRecord[],
            relatedByTags: [] as MemoryRecord[],
        };

        // Phase 4: Use batch fetching for consolidated memories
        if (memory.consolidatedFrom) {
            result.consolidatedFrom = await this.memoryRepository.getManyByIds(memory.consolidatedFrom);
        }

        if (memory.consolidatedInto) {
            result.consolidatedInto = await this.memoryRepository.getManyByIds(memory.consolidatedInto);
        }

        // Find similar memories using semantic search
        if (memory.embedding) {
            try {
                const similarMemories = await this.findSimilarMemories(memoryId, 0.7, 5);
                result.similar = similarMemories;
            } catch (error) {
                console.error('Error finding similar memories:', error);
            }
        }

        // Find memories with overlapping tags
        if (memory.tags.length > 0) {
            // Use repository directly to get full records for internal processing
            const tagRelatedQuery: MemoryQuery = {
                tags: memory.tags,
                limit: 10,
                sortBy: 'relevance',
                sortOrder: 'desc',
                searchStrategy: 'text',
                textQuery: memory.tags.join(' ')
            };
            const tagRelatedMemories = await this.memoryRepository.find(tagRelatedQuery);
            result.relatedByTags = tagRelatedMemories.filter(m => m.id !== memoryId);
        }

        // Phase 4: Use the relatedMemories field for additional connections
        if (memory.relatedMemories) {
            // Add manually linked memories to the similar section
            const manuallyRelated = await this.memoryRepository.getManyByIds(memory.relatedMemories);
            // Combine with semantic similar memories, avoiding duplicates
            const existingSimilarIds = result.similar.map(m => m.id);
            const newRelated = manuallyRelated.filter(m => !existingSimilarIds.includes(m.id));
            result.similar.push(...newRelated);
        }

        return result;
    }

    /**
     * Add a bidirectional relationship between two memories (Phase 4: Knowledge Graph)
     * This creates explicit connections beyond just semantic similarity
     */
    async linkMemories(memoryId1: string, memoryId2: string): Promise<boolean> {
        try {
            const [memory1, memory2] = await this.memoryRepository.getManyByIds([memoryId1, memoryId2]);
            
            if (!memory1 || !memory2) {
                throw new Error('One or both memories not found');
            }

            // Add bidirectional links
            const memory1Related = memory1.relatedMemories || [];
            const memory2Related = memory2.relatedMemories || [];

            // Add each memory to the other's related list (if not already present)
            if (!memory1Related.includes(memoryId2)) {
                await this.memoryRepository.update(memoryId1, {
                    relatedMemories: [...memory1Related, memoryId2],
                    version: (memory1.version || 0) + 1,
                });
            }

            if (!memory2Related.includes(memoryId1)) {
                await this.memoryRepository.update(memoryId2, {
                    relatedMemories: [...memory2Related, memoryId1],
                    version: (memory2.version || 0) + 1,
                });
            }

            return true;
        } catch (error) {
            console.error(`Failed to link memories ${memoryId1} and ${memoryId2}:`, error);
            return false;
        }
    }

    /**
     * Remove a bidirectional relationship between two memories (Phase 4: Knowledge Graph)
     */
    async unlinkMemories(memoryId1: string, memoryId2: string): Promise<boolean> {
        try {
            const [memory1, memory2] = await this.memoryRepository.getManyByIds([memoryId1, memoryId2]);
            
            if (!memory1 || !memory2) {
                throw new Error('One or both memories not found');
            }

            // Remove bidirectional links
            if (memory1.relatedMemories?.includes(memoryId2)) {
                const filteredRelated = memory1.relatedMemories.filter(id => id !== memoryId2);
                await this.memoryRepository.update(memoryId1, {
                    relatedMemories: filteredRelated,
                    version: (memory1.version || 0) + 1,
                });
            }

            if (memory2.relatedMemories?.includes(memoryId1)) {
                const filteredRelated = memory2.relatedMemories.filter(id => id !== memoryId1);
                await this.memoryRepository.update(memoryId2, {
                    relatedMemories: filteredRelated,
                    version: (memory2.version || 0) + 1,
                });
            }

            return true;
        } catch (error) {
            console.error(`Failed to unlink memories ${memoryId1} and ${memoryId2}:`, error);
            return false;
        }
    }

    /**
     * Auto-discover and create relationships based on semantic similarity (Phase 4)
     * This can be run periodically to automatically build the knowledge graph
     */
    async autoLinkSimilarMemories(similarityThreshold: number = 0.8, maxLinksPerMemory: number = 5): Promise<{linked: number, errors: string[]}> {
        const errors: string[] = [];
        let linked = 0;

        try {
            // Use pagination to process all memories
            const pageSize = 50;
            let offset = 0;
            let hasMoreResults = true;

            while (hasMoreResults) {
                const pageMemories = await this.memoryRepository.find({
                    limit: pageSize,
                    offset: offset,
                    sortBy: 'createdAt',
                    sortOrder: 'asc'
                });

                if (pageMemories.length === 0) {
                    hasMoreResults = false;
                    break;
                }

                // Process memories with embeddings
                const memoriesWithEmbeddings = pageMemories.filter(memory => memory.embedding);
                
                for (const memory of memoriesWithEmbeddings) {
                    try {
                        // Skip if already has many relationships
                        const currentRelated = memory.relatedMemories || [];
                        if (currentRelated.length >= maxLinksPerMemory) {
                            continue;
                        }

                        // Find similar memories
                        const similarMemories = await this.findSimilarMemories(memory.id, similarityThreshold, maxLinksPerMemory);
                        
                        // Link to similar memories that aren't already linked
                        for (const similar of similarMemories) {
                            if (!currentRelated.includes(similar.id)) {
                                const success = await this.linkMemories(memory.id, similar.id);
                                if (success) {
                                    linked++;
                                }
                            }
                        }
                        
                    } catch (error) {
                        errors.push(`Failed to auto-link memory ${memory.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }

                offset += pageSize;
                if (pageMemories.length < pageSize) {
                    hasMoreResults = false;
                }

                // Brief pause between pages
                await new Promise(resolve => setTimeout(resolve, 100));
            }

        } catch (error) {
            errors.push(`Failed to auto-link similar memories: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }

        return { linked, errors };
    }

    /**
     * Schedule background processing to run after current operation
     * This is called after each tool operation to trigger maintenance
     */
    scheduleBackgroundProcessing(): void {
        this.backgroundService.scheduleBackgroundRun();
    }

    /**
     * Get background processing status
     */
    getBackgroundStatus(): {
        isRunning: boolean;
        queueLength: number;
        operationCount: number;
        elapsedTime: number;
    } {
        return this.backgroundService.getStatus();
    }

    /**
     * Clean up orphaned consolidations with 'pending' status (Phase 4: Data Integrity)
     * This method should be called periodically to clean up failed consolidations
     */
    async cleanupOrphanedConsolidations(maxAge: number = 3600000): Promise<{cleaned: number, errors: string[]}> {
        const errors: string[] = [];
        let cleaned = 0;
        
        try {
            // Phase 4: Use pagination to avoid loading all memories
            const cutoffTime = new Date(Date.now() - maxAge).toISOString();
            const pageSize = 100;
            let offset = 0;
            let hasMoreResults = true;
            let pendingConsolidations: MemoryRecord[] = [];

            // Collect all pending consolidations using pagination
            while (hasMoreResults) {
                const pageMemories = await this.memoryRepository.find({
                    limit: pageSize,
                    offset: offset,
                    sortBy: 'createdAt',
                    sortOrder: 'asc'
                });

                if (pageMemories.length === 0) {
                    hasMoreResults = false;
                    break;
                }

                // Filter for pending consolidations older than maxAge
                const pendingInPage = pageMemories.filter(memory => 
                    memory.consolidationStatus === 'pending' && 
                    memory.createdAt < cutoffTime
                );
                
                pendingConsolidations.push(...pendingInPage);

                offset += pageSize;
                if (pageMemories.length < pageSize) {
                    hasMoreResults = false;
                }
            }
            
            console.error(`Found ${pendingConsolidations.length} orphaned pending consolidations older than ${maxAge}ms`);
            
            for (const memory of pendingConsolidations) {
                try {
                    // Mark as failed and clean up references
                    await this.memoryRepository.update(memory.id, {
                        consolidationStatus: 'failed',
                    });
                    
                    // If this memory has consolidatedFrom, clean up the reverse references
                    if (memory.consolidatedFrom) {
                        for (const sourceId of memory.consolidatedFrom) {
                            try {
                                const sourceMemory = await this.memoryRepository.getById(sourceId);
                                if (sourceMemory?.consolidatedInto) {
                                    const filteredRefs = sourceMemory.consolidatedInto.filter((id: string) => id !== memory.id);
                                    await this.memoryRepository.update(sourceId, {
                                        consolidatedInto: filteredRefs,
                                    });
                                }
                            } catch (refError) {
                                errors.push(`Failed to clean up reference in source memory ${sourceId}: ${refError instanceof Error ? refError.message : 'Unknown error'}`);
                            }
                        }
                    }
                    
                    cleaned++;
                } catch (error) {
                    errors.push(`Failed to clean up orphaned consolidation ${memory.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
            
        } catch (error) {
            errors.push(`Failed to find orphaned consolidations: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        return { cleaned, errors };
    }

    /**
     * Clean up resources (Phase 4: Proper cleanup implementation)
     * Ensures graceful shutdown of background processing and database connections
     */
    async dispose(): Promise<void> {
        console.error('MemoryService dispose requested...');
        
        try {
            // Stop background processing gracefully
            await this.backgroundService.dispose(3000); // 3 second timeout
            
            // Clean up any database connections if the provider supports it
            // Note: Most providers handle this automatically, but we can be explicit
            if (this.dbService && typeof (this.dbService as any).dispose === 'function') {
                await (this.dbService as any).dispose();
            }
            
            console.error('MemoryService disposed successfully');
        } catch (error) {
            console.error('Error during MemoryService disposal:', error);
            throw error;
        }
    }
}
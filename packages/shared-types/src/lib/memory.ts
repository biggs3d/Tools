// Copyright (c) 2025.
// Updated: Steve Biggs 2025.05.10
// https://github.com/biggs3d/McpMemoryServer

/**
 * Type definitions for enhanced memory system
 */

export type MemoryLayer = 'shortterm' | 'mediumterm' | 'longterm';

/**
 * Extended entity interface with importance tracking and layer metadata
 */
export interface Entity {
    name: string;
    entityType: string;
    observations: string[];
    metadata?: EntityMetadata;
}

export interface EntityMetadata {
    importance: number;                       // 0-10 importance score
    layer: MemoryLayer;                       // Which memory layer this belongs to
    lastAccessed: string;                     // ISO timestamp
    accessCount: number;                      // Usage counter
    createdAt: string;                        // ISO timestamp
    consolidatedFrom?: string[];              // IDs of memories this was created from
    consolidatedInto?: string[];              // IDs of higher-level memories this contributed to
    markedForDeletion?: boolean;              // Flag for pending deletion
}

/**
 * Extended relation interface with importance and confidence scores
 */
export interface Relation {
    from: string;
    to: string;
    relationType: string;
    metadata?: RelationMetadata;
}

export interface RelationMetadata {
    importance: number;                       // 0-10 importance score
    confidence: number;                       // 0-1 confidence score
    createdAt: string;                        // ISO timestamp
    lastAccessed: string;                     // ISO timestamp
    accessCount: number;                      // Usage counter
}

/**
 * Knowledge graph structure containing entities and relations
 */
export interface KnowledgeGraph {
    entities: Entity[];
    relations: Relation[];
}

/**
 * Options for memory operations
 */
export interface MemoryQueryOptions {
    layer?: MemoryLayer;                      // Specific layer to query
    limit?: number;                           // Max results to return
    filterByImportance?: number;              // Min importance threshold
    includeObservations?: boolean;            // Whether to include observations
    sortBy?: 'importance' | 'recency';        // Sort order for results
}

/**
 * Memory consolidation statistics
 */
export interface ConsolidationStats {
    processedClusters: number;                // Number of clusters processed
    consolidatedEntities: number;             // Number of new entities created
    affectedEntities: number;                 // Number of source entities affected
}

/**
 * Options for memory search
 */
export interface SearchOptions extends MemoryQueryOptions {
    searchObservations?: boolean;             // Whether to search observation content
    searchEntityNames?: boolean;              // Whether to search entity names
    searchEntityTypes?: boolean;              // Whether to search entity types
}

/**
 * Core memory record structure for memory_link
 */
export interface MemoryRecord {
    /** A unique UUID for the memory. */
    id: string;
    /** The core text content of the memory. */
    content: string;
    /** A 0-10 score of the memory's importance. */
    importance: number;
    /** An array of strings for categorization and filtering. */
    tags: string[];
    /** Vector embedding for semantic search (added in Phase 2). */
    embedding?: number[];
    /** ISO timestamp of when the memory was created. */
    createdAt: string;
    /** ISO timestamp of the last time the memory was accessed. */
    lastAccessed: string;
    /** A simple counter for how many times the memory has been accessed. */
    accessCount: number;
    
    // Phase 3: Consolidation and linking features
    /** IDs of memories this was consolidated from (Phase 3). */
    consolidatedFrom?: string[];
    /** IDs of higher-level memories this contributed to (Phase 3). */
    consolidatedInto?: string[];
    /** Related memory IDs for knowledge graph connections (Phase 3). */
    relatedMemories?: string[];
    /** Indicates this memory is a consolidated summary of other memories (Phase 3). */
    isConsolidated?: boolean;
    /** Status for tracking consolidation operations (Phase 4: Data Integrity). */
    consolidationStatus?: 'pending' | 'completed' | 'failed';
    /** Version for optimistic locking and atomic updates (Phase 4: Data Integrity). */
    version?: number;
}

/**
 * Memory record with similarity score for search results (Phase 4)
 */
export interface MemorySearchResult extends MemoryRecord {
    /** Similarity score (0-1) when returned from vector search operations. */
    similarity?: number;
}

/**
 * Clean memory record for user-facing responses (Phase 5: Token Optimization)
 * Excludes large embedding vectors and internal metadata to prevent token bloat
 */
export interface CleanMemoryRecord {
    /** A unique UUID for the memory. */
    id: string;
    /** The core text content of the memory. */
    content: string;
    /** A 0-10 score of the memory's importance. */
    importance: number;
    /** An array of strings for categorization and filtering. */
    tags: string[];
    /** ISO timestamp of when the memory was created. */
    createdAt: string;
    /** ISO timestamp of the last time the memory was accessed. */
    lastAccessed: string;
    /** A simple counter for how many times the memory has been accessed. */
    accessCount: number;
    /** Indicates this memory is a consolidated summary of other memories. */
    isConsolidated?: boolean;
    /** Number of related memories in knowledge graph. */
    relatedCount?: number;
}

/**
 * Clean memory search result with similarity score (Phase 5: Token Optimization)
 */
export interface CleanMemorySearchResult extends CleanMemoryRecord {
    /** Similarity score (0-1) when returned from vector search operations. */
    similarity?: number;
}
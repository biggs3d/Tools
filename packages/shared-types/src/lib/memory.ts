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
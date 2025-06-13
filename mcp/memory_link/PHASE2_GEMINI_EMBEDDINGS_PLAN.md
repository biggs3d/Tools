# Phase 2: Gemini Embeddings Integration Plan

## Overview
Enhance the existing `gemini_bridge` MCP server to support text embeddings using Google's `text-embedding-004` model, then integrate this capability into `memory_link` for semantic search.

## Current State Analysis
- `memory_link` Phase 1 is complete with keyword-based search
- `gemini_bridge` exists but likely lacks embeddings functionality
- Architecture is ready for Phase 2 with `embedding` fields and `vectorQuery` support

## Implementation Plan

### Step 1: Enhance gemini_bridge with Embeddings

#### Add Embeddings Tool to gemini_bridge
```typescript
server.tool(
  'generate_embeddings',
  'Generate embeddings for text using Google text-embedding-004 model',
  {
    texts: z.array(z.string()).describe('Array of texts to embed'),
    model: z.string().optional().default('text-embedding-004').describe('Embedding model to use'),
    task_type: z.enum(['RETRIEVAL_QUERY', 'RETRIEVAL_DOCUMENT', 'SEMANTIC_SIMILARITY', 'CLUSTERING', 'CLASSIFICATION']).optional().default('RETRIEVAL_DOCUMENT').describe('Task type for embedding optimization'),
    dimensionality: z.number().optional().describe('Output dimensionality (optional, model default is optimal)'),
    title: z.string().optional().describe('Optional title for document embedding context')
  },
  async ({ texts, model, task_type, dimensionality, title }) => {
    // Implementation using Google Generative AI SDK
    // Batch process texts for efficiency
    // Return embeddings as number arrays
  }
);
```

#### Key Features:
- **Batch Processing**: Handle multiple texts efficiently
- **Task Type Optimization**: Use appropriate task types for queries vs documents
- **Flexible Dimensionality**: Support custom dimensions if needed
- **Error Handling**: Robust handling of API limits and failures

### Step 2: Integrate Embeddings into memory_link

#### Enhance MemoryService
```typescript
// Add embedding generation during memory creation
async remember(content: string, importance: number, tags: string[]): Promise<MemoryRecord> {
  // Generate embedding for content
  const embedding = await this.generateEmbedding(content, 'RETRIEVAL_DOCUMENT');
  
  const newRecord: MemoryRecord = {
    // ... existing fields
    embedding: embedding
  };
  
  return this.memoryRepository.add(newRecord);
}

// Add semantic search capability
async semanticRecall(query: string, tags?: string[], limit: number = 10): Promise<MemoryRecord[]> {
  // Generate query embedding
  const queryEmbedding = await this.generateEmbedding(query, 'RETRIEVAL_QUERY');
  
  // Use repository's vector search
  const memoryQuery: MemoryQuery = {
    vectorQuery: queryEmbedding,
    tags: tags,
    limit: limit,
    searchStrategy: 'vector',
    sortBy: 'relevance'
  };
  
  return this.memoryRepository.find(memoryQuery);
}
```

#### Enhance MemoryRepository
```typescript
// Add vector similarity search
private calculateCosineSimilarity(a: number[], b: number[]): number {
  // Implement cosine similarity calculation
}

private applyVectorSearch(memories: MemoryRecord[], queryEmbedding: number[]): MemoryRecord[] {
  // Calculate similarities and sort by relevance
  return memories
    .filter(memory => memory.embedding) // Only memories with embeddings
    .map(memory => ({
      ...memory,
      similarity: this.calculateCosineSimilarity(queryEmbedding, memory.embedding!)
    }))
    .sort((a, b) => b.similarity - a.similarity);
}
```

### Step 3: Add New MCP Tools

#### Enhanced Recall Tool
```typescript
server.tool(
  'recall',
  // Enhanced description mentioning both text and semantic search
  {
    query: z.string().describe('Search query'),
    tags: z.array(z.string()).optional(),
    limit: z.number().optional().default(10),
    search_type: z.enum(['text', 'semantic', 'hybrid']).optional().default('hybrid').describe('Search strategy to use')
  },
  async ({ query, tags, limit, search_type }) => {
    // Route to appropriate search method based on search_type
  }
);
```

#### New Embeddings Management Tools
```typescript
server.tool(
  'generate_embeddings_for_existing',
  'Generate embeddings for memories that don\'t have them yet',
  {
    batch_size: z.number().optional().default(10).describe('Process memories in batches')
  },
  // Backfill embeddings for existing memories
);

server.tool(
  'recompute_embeddings',
  'Regenerate embeddings for specific memories',
  {
    memory_ids: z.array(z.string()).optional().describe('Specific memory IDs, or all if not provided')
  },
  // Useful when switching embedding models or parameters
);
```

### Step 4: Configuration and Environment

#### Environment Variables
```bash
# In gemini_bridge/.env
GEMINI_API_KEY=your_key_here

# In memory_link/.env (optional overrides)
GEMINI_BRIDGE_URL=http://localhost:3001  # If running as separate service
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_BATCH_SIZE=10
SIMILARITY_THRESHOLD=0.7
```

#### Configuration Options
- Default embedding model and parameters
- Batch processing sizes for efficiency
- Similarity thresholds for relevance filtering
- Fallback behavior when embeddings fail

### Step 5: Migration Strategy

#### Backward Compatibility
- Existing memories without embeddings continue to work
- Text search remains available as fallback
- Gradual migration with `generate_embeddings_for_existing` tool

#### Hybrid Search Implementation
1. **Hybrid Mode**: Combine text and vector search results
2. **Weighted Scoring**: Balance keyword matching vs semantic similarity
3. **Fallback Logic**: Use text search if embeddings unavailable

### Step 6: Performance Considerations

#### Optimization Strategies
- **Embedding Caching**: Cache embeddings to avoid regeneration
- **Batch API Calls**: Group multiple embedding requests
- **Async Processing**: Non-blocking embedding generation
- **Index Management**: Consider vector database for large datasets

#### Resource Management
- **Rate Limiting**: Respect Gemini API limits
- **Error Recovery**: Graceful degradation on API failures
- **Cost Monitoring**: Track embedding generation costs

## Testing Strategy

### Unit Tests
- Vector similarity calculations
- Embedding integration with memory operations
- Fallback behavior testing

### Integration Tests
- End-to-end semantic search workflows
- Gemini bridge communication
- Batch processing verification

### Performance Tests
- Large dataset semantic search performance
- Embedding generation throughput
- Memory usage with vector data

## Success Metrics

### Functional Goals
- ✅ Semantic search returns more relevant results than keyword search
- ✅ Hybrid search combines best of both approaches
- ✅ All existing functionality remains intact
- ✅ Embedding generation is reliable and efficient

### Performance Goals
- ⚡ Semantic search completes within 2 seconds for typical queries
- ⚡ Embedding generation handles batches of 10+ texts efficiently
- ⚡ Memory usage scales reasonably with vector data

## Implementation Order

1. **gemini_bridge embeddings tool** - Core embedding capability
2. **memory_link vector search** - Repository layer enhancements
3. **Enhanced MCP tools** - Updated recall and new management tools
4. **Migration utilities** - Backfill and management tools
5. **Hybrid search** - Intelligent combination of search strategies
6. **Performance optimization** - Caching, batching, error handling

## Future Phase 3 Considerations

This Phase 2 implementation sets up the foundation for Phase 3 features:
- **Memory Consolidation**: Use embeddings to find related memories for consolidation
- **Intelligent Clustering**: Group similar memories automatically
- **Concept Extraction**: Identify patterns across memory embeddings
- **Relationship Discovery**: Find non-obvious connections between memories

The vector search capability will be essential for these advanced features.
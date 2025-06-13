import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import 'dotenv/config';
import { MemoryService } from './memory.service.js';
import { getAppConfig } from './config.js';
import { buildTokenAwareResponse, formatTokenAwareResponse, cleanup as cleanupTokenizer } from './lib/token-utils.js';

async function main(): Promise<void> {
    console.error('Starting memory_link MCP Server...');

    const { dbConfig, embeddingConfig, backgroundConfig, mcpResponseConfig } = getAppConfig();
    const memoryService = new MemoryService(dbConfig, embeddingConfig, backgroundConfig);
    await memoryService.initialize();

    const server = new McpServer({
        name: 'memory-link',
        version: '0.1.0',
    });

    server.tool(
        'remember',
        `Stores information as a persistent memory across all Claude sessions.
    
    WHEN TO USE:
    - After completing tasks: Save lessons learned, solutions that worked
    - When discovering user preferences: Communication style, coding preferences, tools
    - For project-specific patterns: Architecture decisions, conventions, setup quirks
    - For reusable knowledge: Error fixes, command sequences, helpful patterns
    
    TAGGING BEST PRACTICES:
    - "user_preference": Personal preferences and style
    - "lesson_learned": Insights from completed tasks  
    - "project:<name>": Project-specific information
    - "solution": Reusable problem solutions
    - "pattern"/"antipattern": Dos and don'ts discovered
    
    Set importance 8-10 for critical info, 5-7 for useful context, 1-4 for temporary notes.`,
        {
            content: z.string()
                .min(1, "Content cannot be empty")
                .max(2000, "Memory content must be under 2000 characters. Use concise guidance, preferences, and facts - not lengthy documents.")
                .describe('The information to remember.'),
            importance: z.number().min(0).max(10).describe('A score from 0-10 for the memory importance.'),
            tags: z.array(z.string()).optional().describe('Tags for categorizing the memory.'),
        },
        async ({ content, importance, tags }) => {
            try {
                const record = await memoryService.remember(content, importance, tags || []);
                memoryService.scheduleBackgroundProcessing(); // Trigger background maintenance
                return { content: [{ type: 'text', text: `Memory stored with ID: ${record.id}` }] };
            } catch (error) {
                console.error('Error in remember tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to store memory: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    server.tool(
        'recall',
        `Retrieves relevant memories to inform current work using text, semantic, or hybrid search.
    
    ALWAYS USE THIS:
    - At the start of any task: Check for relevant context and past learnings
    - Before making design decisions: Look for established patterns
    - When encountering errors: Search for previous solutions
    - When working in a project: Filter by project tag
    
    SEARCH STRATEGIES:
    - 'text': Traditional keyword matching (fastest, good for specific terms)
    - 'semantic': AI-powered understanding (best for concepts and meaning)
    - 'hybrid': Combines both approaches using RRF (recommended for best results)
    
    EFFECTIVE QUERIES:
    - Use project tags: tags=["project:myapp"]
    - Combine with keywords: query="react hooks" tags=["pattern"]
    - Check user preferences: tags=["user_preference"]
    - Find solutions: query="error" tags=["solution"]
    
    This helps maintain consistency and leverages accumulated knowledge.`,
        {
            query: z.string().describe('The search query to find relevant memories.'),
            tags: z.array(z.string()).optional().describe('Filter memories by tags.'),
            limit: z.number().optional().default(10).describe('Maximum number of memories to return.'),
            search_type: z.enum(['text', 'semantic', 'hybrid']).optional().default('hybrid').describe('Search strategy: text (keywords), semantic (AI understanding), or hybrid (best of both)')
        },
        async ({ query, tags, limit, search_type }) => {
            try {
                const records = await memoryService.recall(query, tags, limit, search_type);
                memoryService.scheduleBackgroundProcessing(); // Trigger background maintenance
                
                // Build token-aware response
                const tokenAwareResponse = buildTokenAwareResponse(records, mcpResponseConfig, embeddingConfig.model);
                const formattedResponse = formatTokenAwareResponse(tokenAwareResponse);
                
                return { content: [{ type: 'text', text: formattedResponse }] };
            } catch (error) {
                console.error('Error in recall tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to recall memories: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    server.tool(
        'get_memory',
        `Retrieves a single memory by its ID.
    
    USE WHEN:
    - Following up on a specific memory reference
    - Detailed inspection of a particular memory
    - Updating or deleting a specific memory
    
    Updates access tracking automatically (lastAccessed, accessCount).`,
        {
            id: z.string().describe('The unique ID of the memory to retrieve.'),
        },
        async ({ id }) => {
            try {
                const record = await memoryService.getMemory(id);
                if (!record) {
                    return { content: [{ type: 'text', text: `Memory with ID ${id} not found.` }], isError: true };
                }
                return { content: [{ type: 'text', text: JSON.stringify(record, null, 2) }] };
            } catch (error) {
                console.error('Error in get_memory tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to retrieve memory: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    server.tool(
        'forget',
        `Deletes a memory by its ID.
    
    USE CAREFULLY:
    - Remove outdated information
    - Clean up duplicate memories
    - Delete temporary notes that are no longer relevant
    
    Consider updating instead of deleting if the core information is still valuable.`,
        {
            id: z.string().describe('The unique ID of the memory to delete.'),
        },
        async ({ id }) => {
            try {
                const success = await memoryService.forget(id);
                const message = success ? `Memory ${id} forgotten.` : `Memory with ID ${id} not found.`;
                return { content: [{ type: 'text', text: message }], isError: !success };
            } catch (error) {
                console.error('Error in forget tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to delete memory: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    server.tool(
        'list_memories',
        `Lists memories with filtering and sorting options.
    
    USE CASES:
    - Review all memories for a project: tags=["project:name"]
    - See most important memories: sortBy="importance"
    - Check recent learnings: sortBy="createdAt"
    - Find frequently accessed knowledge: sortBy="lastAccessed"
    
    MAINTENANCE:
    - Periodically review low-importance memories for cleanup
    - Check memories with high accessCount - they might need higher importance
    - Look for memories that could be consolidated or moved to CLAUDE.md`,
        {
            tags: z.array(z.string()).optional().describe('Filter memories by tags.'),
            limit: z.number().optional().default(20).describe('Maximum number of memories to return.'),
            offset: z.number().optional().default(0).describe('Number of memories to skip (for pagination).'),
            sortBy: z.enum(['createdAt', 'lastAccessed', 'importance']).optional().default('createdAt').describe('Sort criteria for results.'),
        },
        async ({ tags, limit, offset, sortBy }) => {
            try {
                const records = await memoryService.listMemories(tags, limit, sortBy, offset);
                
                // Build token-aware response
                const tokenAwareResponse = buildTokenAwareResponse(records, mcpResponseConfig, embeddingConfig.model);
                const formattedResponse = formatTokenAwareResponse(tokenAwareResponse);
                
                return { content: [{ type: 'text', text: formattedResponse }] };
            } catch (error) {
                console.error('Error in list_memories tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to list memories: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    server.tool(
        'update_memory',
        `Updates an existing memory.
    
    COMMON UPDATES:
    - Refine content with new insights
    - Adjust importance as understanding evolves
    - Add or modify tags for better organization
    - Correct information that was partially wrong
    
    Updates automatically refresh lastAccessed timestamp.`,
        {
            id: z.string().describe('The unique ID of the memory to update.'),
            content: z.string().optional().describe('New content for the memory.'),
            importance: z.number().min(0).max(10).optional().describe('New importance score.'),
            tags: z.array(z.string()).optional().describe('New tags for the memory.'),
        },
        async ({ id, content, importance, tags }) => {
            try {
                const updated = await memoryService.updateMemory(id, content, importance, tags);
                if (!updated) {
                    return { content: [{ type: 'text', text: `Memory with ID ${id} not found.` }], isError: true };
                }
                memoryService.scheduleBackgroundProcessing(); // Trigger background maintenance
                return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
            } catch (error) {
                console.error('Error in update_memory tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to update memory: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    server.tool(
        'generate_embeddings_for_existing',
        `Generate embeddings for memories that don't have them yet.
    
    USE WHEN:
    - Upgrading from Phase 1 to Phase 2 (backfilling existing memories)
    - After importing memories from external sources
    - When embeddings were skipped due to API errors
    
    PROCESS:
    - Finds all memories without embeddings
    - Generates embeddings in batches with rate limiting
    - Updates memories with new embeddings
    - Provides progress feedback and error reporting
    
    NOTE: This process respects API rate limits with delays between batches.`,
        {
            batch_size: z.number().optional().default(10).describe('Number of memories to process in each batch (default: 10)')
        },
        async ({ batch_size }) => {
            try {
                const result = await memoryService.generateEmbeddingsForExisting(batch_size);
                
                let statusText = `✅ **Embedding Generation Complete**\n\n` +
                    `📊 **Results:**\n` +
                    `- Processed: ${result.processed} memories\n` +
                    `- Updated: ${result.updated} memories\n` +
                    `- Errors: ${result.errors.length}\n`;

                if (result.errors.length > 0) {
                    statusText += `\n❌ **Errors encountered:**\n` +
                        result.errors.slice(0, 5).map(err => `- ${err}`).join('\n');
                    
                    if (result.errors.length > 5) {
                        statusText += `\n... and ${result.errors.length - 5} more errors`;
                    }
                }

                if (result.updated === 0) {
                    statusText += `\n🎉 All memories already have embeddings!`;
                } else {
                    statusText += `\n🚀 Semantic search is now available for ${result.updated} additional memories.`;
                }

                return { 
                    content: [{ type: 'text', text: statusText }],
                    isError: result.errors.length > 0
                };
            } catch (error) {
                console.error('Error in generate_embeddings_for_existing tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    // Phase 3: Memory consolidation and linking tools

    server.tool(
        'consolidate_memories',
        `Consolidate multiple related memories into a single higher-level summary.
        
        This creates a new consolidated memory that captures the key insights and patterns
        from multiple related memories. The consolidated memory has higher importance and
        links back to its source memories for traceability.
        
        USE CASES:
        - Merge similar lessons learned into principles
        - Combine related project patterns into architectural guidelines  
        - Consolidate user preferences into coherent style guides
        - Create higher-level abstractions from detailed observations`,
        {
            memory_ids: z.array(z.string()).min(2).describe('Array of memory IDs to consolidate (minimum 2 required).'),
            summary_prompt: z.string().optional().describe('Optional custom prompt for generating the consolidated summary.'),
        },
        async ({ memory_ids, summary_prompt }) => {
            try {
                const consolidatedMemory = await memoryService.consolidateMemories(memory_ids, summary_prompt);
                
                const responseText = `✅ **Memory Consolidation Complete**\n\n` +
                    `**Consolidated Memory ID:** ${consolidatedMemory.id}\n` +
                    `**Importance:** ${consolidatedMemory.importance}/10\n` +
                    `**Source Memories:** ${memory_ids.length} memories\n` +
                    `**Tags:** ${consolidatedMemory.tags.join(', ')}\n\n` +
                    `**Content:**\n${consolidatedMemory.content}\n\n` +
                    `🔗 This consolidated memory is linked to its source memories for traceability.`;

                return { content: [{ type: 'text', text: responseText }] };
            } catch (error) {
                console.error('Error in consolidate_memories tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to consolidate memories: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    server.tool(
        'get_related_memories',
        `Find all memories related to a given memory through various connection types.
        
        This tool discovers relationships between memories including:
        - Consolidation relationships (what this memory was built from or contributed to)
        - Semantic similarity (conceptually related memories)
        - Tag relationships (memories with overlapping tags)
        
        USE CASES:
        - Explore memory relationships and knowledge graphs
        - Find the source memories behind consolidated summaries
        - Discover related context when working on similar problems
        - Trace the evolution of ideas and patterns over time`,
        {
            memory_id: z.string().describe('The ID of the memory to find relationships for.'),
            include_consolidated: z.boolean().default(true).describe('Whether to include consolidation relationships.'),
        },
        async ({ memory_id, include_consolidated }) => {
            try {
                const relationships = await memoryService.getRelatedMemories(memory_id, include_consolidated);
                
                let responseText = `🔗 **Related Memories for ID: ${memory_id}**\n\n`;
                
                // Consolidated from (source memories)
                if (relationships.consolidatedFrom.length > 0) {
                    responseText += `📥 **Consolidated From (${relationships.consolidatedFrom.length} memories):**\n`;
                    relationships.consolidatedFrom.forEach(memory => {
                        responseText += `- [${memory.id}] ${memory.content.substring(0, 100)}...\n`;
                    });
                    responseText += '\n';
                }
                
                // Consolidated into (higher-level memories)
                if (relationships.consolidatedInto.length > 0) {
                    responseText += `📤 **Consolidated Into (${relationships.consolidatedInto.length} memories):**\n`;
                    relationships.consolidatedInto.forEach(memory => {
                        responseText += `- [${memory.id}] ${memory.content.substring(0, 100)}...\n`;
                    });
                    responseText += '\n';
                }
                
                // Semantically similar memories
                if (relationships.similar.length > 0) {
                    responseText += `🎯 **Semantically Similar (${relationships.similar.length} memories):**\n`;
                    relationships.similar.forEach(memory => {
                        responseText += `- [${memory.id}] ${memory.content.substring(0, 100)}...\n`;
                    });
                    responseText += '\n';
                }
                
                // Tag-related memories  
                if (relationships.relatedByTags.length > 0) {
                    responseText += `🏷️  **Related by Tags (${relationships.relatedByTags.length} memories):**\n`;
                    relationships.relatedByTags.forEach(memory => {
                        responseText += `- [${memory.id}] ${memory.content.substring(0, 100)}...\n`;
                    });
                }
                
                if (relationships.consolidatedFrom.length === 0 && 
                    relationships.consolidatedInto.length === 0 && 
                    relationships.similar.length === 0 && 
                    relationships.relatedByTags.length === 0) {
                    responseText += `ℹ️ No related memories found.`;
                }

                return { content: [{ type: 'text', text: responseText }] };
            } catch (error) {
                console.error('Error in get_related_memories tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to get related memories: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    server.tool(
        'find_similar_memories',
        `Find memories that are semantically similar to a given memory.
        
        Uses vector embeddings and cosine similarity to identify memories with similar
        content or concepts. Useful for discovering patterns, finding related knowledge,
        or identifying candidates for consolidation.
        
        USE CASES:
        - Identify duplicate or near-duplicate memories for cleanup
        - Find memories to consolidate into higher-level summaries
        - Discover related knowledge when working on similar problems
        - Explore conceptual connections between memories`,
        {
            memory_id: z.string().describe('The ID of the memory to find similar memories for.'),
            similarity_threshold: z.number().min(0).max(1).default(0.7).describe('Minimum similarity score (0-1, default: 0.7).'),
            limit: z.number().min(1).max(50).default(10).describe('Maximum number of similar memories to return.'),
        },
        async ({ memory_id, similarity_threshold, limit }) => {
            try {
                const similarMemories = await memoryService.findSimilarMemories(memory_id, similarity_threshold, limit);
                
                if (similarMemories.length === 0) {
                    return { 
                        content: [{ 
                            type: 'text', 
                            text: `ℹ️ No similar memories found for memory ID: ${memory_id} (threshold: ${similarity_threshold})` 
                        }] 
                    };
                }
                
                let responseText = `🎯 **Similar Memories for ID: ${memory_id}**\n` +
                    `**Similarity Threshold:** ${similarity_threshold}\n` +
                    `**Found:** ${similarMemories.length} similar memories\n\n`;
                
                similarMemories.forEach((memory, index) => {
                    responseText += `**${index + 1}. [${memory.id}]** (Importance: ${memory.importance}/10)\n`;
                    responseText += `${memory.content.substring(0, 200)}${memory.content.length > 200 ? '...' : ''}\n`;
                    responseText += `Tags: ${memory.tags.join(', ')}\n\n`;
                });
                
                responseText += `💡 **Tip:** Use \`consolidate_memories\` to merge related memories into higher-level summaries.`;

                return { content: [{ type: 'text', text: responseText }] };
            } catch (error) {
                console.error('Error in find_similar_memories tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to find similar memories: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    // Background processing status tool

    server.tool(
        'get_background_status',
        `Get the current status of background processing tasks.
        
        Shows information about automatic maintenance tasks running in the background,
        including embedding generation, importance recalculation, and consolidation
        candidate identification.
        
        USE CASES:
        - Check if background maintenance is currently running
        - Monitor automatic processing performance
        - Debug background processing issues
        - Understand system maintenance status`,
        {},
        async () => {
            try {
                const status = memoryService.getBackgroundStatus();
                
                const responseText = `🔧 **Background Processing Status**\n\n` +
                    `**Status:** ${status.isRunning ? '🟢 Running' : '⭕ Idle'}\n` +
                    `**Queue Length:** ${status.queueLength} tasks\n` +
                    `**Operations Completed:** ${status.operationCount}\n` +
                    `**Elapsed Time:** ${status.elapsedTime}ms\n\n` +
                    `**Background Tasks:**\n` +
                    `- 🧠 Embedding backfill (generate missing embeddings)\n` +
                    `- ⚖️ Importance decay (recalculate based on access patterns)\n` +
                    `- 🔍 Consolidation candidates (identify similar memories)\n\n` +
                    `Background processing runs automatically after tool operations to maintain memory quality.`;

                return { content: [{ type: 'text', text: responseText }] };
            } catch (error) {
                console.error('Error in get_background_status tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to get background status: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    // Phase 4: Knowledge Graph Tools
    server.tool(
        'link_memories',
        `Create a bidirectional relationship between two memories.
        
        This creates explicit connections in the knowledge graph beyond just semantic similarity.
        Useful for manually connecting related concepts, follow-up actions, or thematic groupings.
        
        USE CASES:
        - Connect a problem with its solution
        - Link cause and effect memories
        - Group related project learnings
        - Connect user preferences with implementation details`,
        {
            memory_id_1: z.string().describe('ID of the first memory to link'),
            memory_id_2: z.string().describe('ID of the second memory to link'),
        },
        async ({ memory_id_1, memory_id_2 }) => {
            try {
                const success = await memoryService.linkMemories(memory_id_1, memory_id_2);
                
                if (success) {
                    memoryService.scheduleBackgroundProcessing();
                    return { 
                        content: [{ 
                            type: 'text', 
                            text: `✅ Successfully linked memories ${memory_id_1} and ${memory_id_2}.\n\nThe relationship is bidirectional - both memories now reference each other in their related connections.` 
                        }] 
                    };
                } else {
                    return { 
                        content: [{ 
                            type: 'text', 
                            text: `❌ Failed to link memories. Please check that both memory IDs exist and try again.` 
                        }],
                        isError: true
                    };
                }
            } catch (error) {
                console.error('Error in link_memories tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to link memories: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    server.tool(
        'unlink_memories',
        `Remove a bidirectional relationship between two memories.
        
        This removes explicit connections from the knowledge graph while preserving
        the individual memories themselves.
        
        USE CASES:
        - Remove outdated or incorrect connections
        - Clean up knowledge graph structure
        - Correct mistaken relationships`,
        {
            memory_id_1: z.string().describe('ID of the first memory to unlink'),
            memory_id_2: z.string().describe('ID of the second memory to unlink'),
        },
        async ({ memory_id_1, memory_id_2 }) => {
            try {
                const success = await memoryService.unlinkMemories(memory_id_1, memory_id_2);
                
                if (success) {
                    memoryService.scheduleBackgroundProcessing();
                    return { 
                        content: [{ 
                            type: 'text', 
                            text: `✅ Successfully unlinked memories ${memory_id_1} and ${memory_id_2}.\n\nThe bidirectional relationship has been removed from both memories.` 
                        }] 
                    };
                } else {
                    return { 
                        content: [{ 
                            type: 'text', 
                            text: `❌ Failed to unlink memories. Please check that both memory IDs exist and try again.` 
                        }],
                        isError: true
                    };
                }
            } catch (error) {
                console.error('Error in unlink_memories tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to unlink memories: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    server.tool(
        'auto_link_similar_memories',
        `Automatically discover and create relationships based on semantic similarity.
        
        This tool builds the knowledge graph by analyzing semantic similarity between
        memories and creating connections where similarity exceeds the threshold.
        
        PARAMETERS:
        - similarity_threshold: How similar memories must be to auto-link (0.0-1.0)
        - max_links_per_memory: Maximum number of auto-generated links per memory
        
        USE CASES:
        - Build initial knowledge graph structure
        - Discover hidden connections in existing memories
        - Maintain graph connectivity as new memories are added`,
        {
            similarity_threshold: z.number().min(0).max(1).default(0.8).describe('Minimum similarity score to create links (0.0-1.0)'),
            max_links_per_memory: z.number().min(1).max(20).default(5).describe('Maximum number of auto-generated links per memory'),
        },
        async ({ similarity_threshold, max_links_per_memory }) => {
            try {
                const result = await memoryService.autoLinkSimilarMemories(similarity_threshold, max_links_per_memory);
                
                memoryService.scheduleBackgroundProcessing();
                
                const responseText = `🔗 **Auto-Linking Complete**\n\n` +
                    `**New Connections:** ${result.linked} relationships created\n` +
                    `**Similarity Threshold:** ${similarity_threshold}\n` +
                    `**Max Links per Memory:** ${max_links_per_memory}\n` +
                    `**Errors:** ${result.errors.length}\n\n` +
                    (result.errors.length > 0 ? 
                        `**Error Details:**\n${result.errors.slice(0, 5).map(err => `- ${err}`).join('\n')}${result.errors.length > 5 ? `\n... and ${result.errors.length - 5} more` : ''}` :
                        `All auto-linking operations completed successfully.`);

                return { content: [{ type: 'text', text: responseText }] };
            } catch (error) {
                console.error('Error in auto_link_similar_memories tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to auto-link similar memories: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    server.tool(
        'find_similar_memories_with_scores',
        `Find memories similar to a given memory with similarity scores.
        
        This enhanced version of similarity search returns actual similarity scores (0-1)
        showing how semantically similar each result is to the target memory.
        
        PARAMETERS:
        - memory_id: The reference memory to find similarities to
        - similarity_threshold: Minimum similarity score (0.0-1.0) to include results
        - limit: Maximum number of similar memories to return
        
        USE CASES:
        - Detailed similarity analysis for research
        - Fine-tuning similarity thresholds
        - Understanding semantic relationships quantitatively
        - Building custom similarity-based features`,
        {
            memory_id: z.string().describe('ID of the memory to find similarities for'),
            similarity_threshold: z.number().min(0).max(1).default(0.7).describe('Minimum similarity score to include (0.0-1.0)'),
            limit: z.number().min(1).max(50).default(10).describe('Maximum number of similar memories to return'),
        },
        async ({ memory_id, similarity_threshold, limit }) => {
            try {
                const similarMemories = await memoryService.findSimilarMemoriesWithScores(memory_id, similarity_threshold, limit);
                
                memoryService.scheduleBackgroundProcessing();
                
                if (similarMemories.length === 0) {
                    return { 
                        content: [{ 
                            type: 'text', 
                            text: `No similar memories found for memory ${memory_id} with similarity threshold ${similarity_threshold}.` 
                        }] 
                    };
                }

                let responseText = `🔍 **Similar Memories with Scores**\n\n`;
                responseText += `**Reference Memory:** ${memory_id}\n`;
                responseText += `**Similarity Threshold:** ${similarity_threshold}\n`;
                responseText += `**Results Found:** ${similarMemories.length}\n\n`;

                similarMemories.forEach((memory, index) => {
                    const score = memory.similarity || 0;
                    const scoreEmoji = score >= 0.9 ? '🟢' : score >= 0.8 ? '🟡' : '🟠';
                    responseText += `${scoreEmoji} **${score.toFixed(3)}** - ${memory.content.substring(0, 80)}${memory.content.length > 80 ? '...' : ''}\n`;
                    responseText += `   📋 ID: ${memory.id}\n`;
                    responseText += `   🏷️ Tags: ${memory.tags.join(', ') || 'none'}\n`;
                    responseText += `   ⭐ Importance: ${memory.importance}\n\n`;
                });

                return { content: [{ type: 'text', text: responseText }] };
            } catch (error) {
                console.error('Error in find_similar_memories_with_scores tool:', error);
                return {
                    content: [{ type: 'text', text: `Failed to find similar memories: ${error instanceof Error ? error.message : 'Unknown error'}` }],
                    isError: true
                };
            }
        }
    );

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('memory_link MCP Server started and connected.');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
        console.error('Received SIGINT, shutting down gracefully...');
        await memoryService.dispose();
        cleanupTokenizer();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        console.error('Received SIGTERM, shutting down gracefully...');
        await memoryService.dispose();
        cleanupTokenizer();
        process.exit(0);
    });
}

main().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
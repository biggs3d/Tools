import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import 'dotenv/config';
import { MemoryService } from './memory.service.js';
import { getAppConfig } from './config.js';

async function main(): Promise<void> {
    console.error('Starting memory_link MCP Server...');

    const { dbConfig } = getAppConfig();
    const memoryService = new MemoryService(dbConfig);
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
            content: z.string().describe('The information to remember.'),
            importance: z.number().min(0).max(10).describe('A score from 0-10 for the memory importance.'),
            tags: z.array(z.string()).optional().describe('Tags for categorizing the memory.'),
        },
        async ({ content, importance, tags }) => {
            try {
                const record = await memoryService.remember(content, importance, tags || []);
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
        `Retrieves relevant memories to inform current work.
    
    ALWAYS USE THIS:
    - At the start of any task: Check for relevant context and past learnings
    - Before making design decisions: Look for established patterns
    - When encountering errors: Search for previous solutions
    - When working in a project: Filter by project tag
    
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
        },
        async ({ query, tags, limit }) => {
            try {
                const records = await memoryService.recall(query, tags, limit);
                return { content: [{ type: 'text', text: JSON.stringify(records, null, 2) }] };
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
                return { content: [{ type: 'text', text: JSON.stringify(records, null, 2) }] };
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

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('memory_link MCP Server started and connected.');
}

main().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});
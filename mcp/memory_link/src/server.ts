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
        'Stores a piece of information as a memory.',
        {
            content: z.string().describe('The information to remember.'),
            importance: z.number().min(0).max(10).describe('A score from 0-10 for the memory importance.'),
            tags: z.array(z.string()).optional().describe('Tags for categorizing the memory.'),
        },
        async ({ content, importance, tags }) => {
            const record = await memoryService.remember(content, importance, tags || []);
            return { content: [{ type: 'text', text: `Memory stored with ID: ${record.id}` }] };
        }
    );

    server.tool(
        'recall',
        'Retrieves memories based on a query.',
        {
            query: z.string().describe('The search query to find relevant memories.'),
            tags: z.array(z.string()).optional().describe('Filter memories by tags.'),
            limit: z.number().optional().default(10).describe('Maximum number of memories to return.'),
        },
        async ({ query, tags, limit }) => {
            const records = await memoryService.recall(query, tags, limit);
            return { content: [{ type: 'text', text: JSON.stringify(records, null, 2) }] };
        }
    );

    server.tool(
        'get_memory',
        'Retrieves a single memory by its ID.',
        {
            id: z.string().describe('The unique ID of the memory to retrieve.'),
        },
        async ({ id }) => {
            const record = await memoryService.getMemory(id);
            if (!record) {
                return { content: [{ type: 'text', text: `Memory with ID ${id} not found.` }], isError: true };
            }
            return { content: [{ type: 'text', text: JSON.stringify(record, null, 2) }] };
        }
    );

    server.tool(
        'forget',
        'Deletes a memory by its ID.',
        {
            id: z.string().describe('The unique ID of the memory to delete.'),
        },
        async ({ id }) => {
            const success = await memoryService.forget(id);
            const message = success ? `Memory ${id} forgotten.` : `Memory with ID ${id} not found.`;
            return { content: [{ type: 'text', text: message }], isError: !success };
        }
    );

    server.tool(
        'list_memories',
        'Lists memories with filtering and sorting options.',
        {
            tags: z.array(z.string()).optional().describe('Filter memories by tags.'),
            limit: z.number().optional().default(20).describe('Maximum number of memories to return.'),
            sortBy: z.enum(['createdAt', 'lastAccessed', 'importance']).optional().default('createdAt').describe('Sort criteria for results.'),
        },
        async ({ tags, limit, sortBy }) => {
            const records = await memoryService.listMemories(tags, limit, sortBy);
            return { content: [{ type: 'text', text: JSON.stringify(records, null, 2) }] };
        }
    );

    server.tool(
        'update_memory',
        'Updates an existing memory.',
        {
            id: z.string().describe('The unique ID of the memory to update.'),
            content: z.string().optional().describe('New content for the memory.'),
            importance: z.number().min(0).max(10).optional().describe('New importance score.'),
            tags: z.array(z.string()).optional().describe('New tags for the memory.'),
        },
        async ({ id, content, importance, tags }) => {
            const updated = await memoryService.updateMemory(id, content, importance, tags);
            if (!updated) {
                return { content: [{ type: 'text', text: `Memory with ID ${id} not found.` }], isError: true };
            }
            return { content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }] };
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
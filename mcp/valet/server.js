#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { ValetServer } from './lib/core/valet-server.js';

class ValetMcpServer {
  constructor() {
    this.server = new McpServer({
      name: 'valet-mcp-server',
      version: '1.0.0',
    });

    this.valetServer = new ValetServer();
    this.setupTools();
  }

  setupTools() {
    // Daily Operations Tools
    this.setupDailyOperationsTools();
    
    // Todo Management Tools
    this.setupTodoTools();
  }

  setupDailyOperationsTools() {
    // valet_get_daily_context - Get current day's context
    this.server.tool(
      'valet_get_daily_context',
      'Get daily context including tasks, progress, and todos. Use when user greets you, asks about their day, or when starting work. Helps maintain continuity across conversations.',
      {
        date: z.string().optional().describe('Date to retrieve (YYYY-MM-DD), defaults to today'),
        sections: z.array(z.string()).optional().describe('Specific sections to include'),
        includeGlobalTodo: z.boolean().optional().default(true).describe('Include current todo list'),
        includePreviousDay: z.boolean().optional().default(false).describe('Include yesterday\'s summary')
      },
      async ({ date, sections, includeGlobalTodo, includePreviousDay }) => {
        try {
          const result = await this.valetServer.getDailyContext({
            date,
            sections,
            includeGlobalTodo,
            includePreviousDay
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: false, error: error.message }, null, 2)
            }]
          };
        }
      }
    );

    // valet_update_daily - Update specific sections of daily files
    this.server.tool(
      'valet_update_daily',
      'Update daily planner or journal with new information. Use when user completes tasks, shares progress, or mentions accomplishments. Helps track daily activities and maintain records.',
      {
        date: z.string().optional().describe('Date to update, defaults to today'),
        fileType: z.enum(['planner', 'journal']).describe('Type of file to update'),
        updates: z.array(z.object({
          section: z.enum(['tasks', 'data_stash', 'ongoing_summary', 'reflections', 'personal_reminders']).describe('Section to update'),
          operation: z.enum(['append', 'replace', 'prepend']).describe('How to update the section'),
          content: z.string().describe('Content to add')
        })).describe('Array of update operations'),
        keywords: z.array(z.string()).optional().describe('Keywords for embedding metadata')
      },
      async ({ date, fileType, updates, keywords }) => {
        try {
          const result = await this.valetServer.updateDaily({
            date,
            fileType,
            updates,
            keywords
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: false, error: error.message }, null, 2)
            }]
          };
        }
      }
    );

    // valet_new_day - Start a new day
    this.server.tool(
      'valet_new_day',
      'Initialize a new day with fresh planner and journal files. Use when user starts their day, mentions it\'s a new day, or when daily context shows today doesn\'t exist yet.',
      {
        skipEmbeddings: z.boolean().optional().default(false).describe('Skip embedding generation for speed'),
        date: z.string().optional().describe('Override date (YYYY-MM-DD), defaults to today')
      },
      async ({ skipEmbeddings, date }) => {
        try {
          const result = await this.valetServer.newDay({
            skipEmbeddings,
            date
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: false, error: error.message }, null, 2)
            }]
          };
        }
      }
    );
  }

  setupTodoTools() {
    // valet_todo_operations - Manage global todo list
    this.server.tool(
      'valet_todo_operations',
      'Add, complete, update, or remove todos from the global task list. Use when user mentions new tasks, completes work, or wants to modify their todo list.',
      {
        action: z.enum(['add', 'complete', 'update', 'remove', 'move']).describe('Action to perform'),
        task: z.object({
          id: z.string().optional().describe('Task ID for update/remove/complete'),
          content: z.string().optional().describe('Task description'),
          category: z.string().optional().describe('Task category'),
          priority: z.enum(['high', 'medium', 'low']).optional().describe('Task priority'),
          due: z.string().optional().describe('Due date (YYYY-MM-DD)'),
          notes: z.array(z.string()).optional().describe('Sub-notes for task')
        }).optional().describe('Task object'),
        filter: z.object({
          category: z.string().optional().describe('Filter by category'),
          priority: z.string().optional().describe('Filter by priority'),
          completed: z.boolean().optional().describe('Filter by completion status')
        }).optional().describe('Filter for bulk operations')
      },
      async ({ action, task, filter }) => {
        try {
          const result = await this.valetServer.todoOperations({
            action,
            task,
            filter
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: false, error: error.message }, null, 2)
            }]
          };
        }
      }
    );

    // valet_todo_view - Get filtered view of todos
    this.server.tool(
      'valet_todo_view',
      'View and filter the todo list by priority, category, or due date. Use when user asks about their tasks, wants to see what\'s pending, or needs to review their workload.',
      {
        filter: z.object({
          categories: z.array(z.string()).optional().describe('Filter by categories'),
          priorities: z.array(z.string()).optional().describe('Filter by priorities'),
          due: z.enum(['today', 'week', 'overdue', 'all']).optional().describe('Filter by due date'),
          limit: z.number().optional().describe('Maximum number of items to return')
        }).optional().describe('Filter options'),
        format: z.enum(['structured', 'markdown', 'summary']).optional().default('structured').describe('Output format')
      },
      async ({ filter, format }) => {
        try {
          const result = await this.valetServer.todoView({
            filter,
            format
          });

          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: false, error: error.message }, null, 2)
            }]
          };
        }
      }
    );
  }

  async start() {
    await this.valetServer.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

// Start the server
const server = new ValetMcpServer();
server.start().catch(console.error);
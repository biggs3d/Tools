import { z } from 'zod';

export const navigateSchema = z.object({
  url: z.string().url().describe('The URL to navigate to')
});

export const getLogsSchema = z.object({
  level: z.enum(['error', 'warning', 'info', 'log'])
    .optional()
    .default('error')
    .describe('Minimum severity level to retrieve'),
  limit: z.number()
    .optional()
    .default(-1)
    .describe('Maximum number of recent entries to return (-1 for all)')
});

export function createTools(logger) {
  return [
    {
      name: 'navigate',
      description: 'Navigate to a URL and start capturing console messages',
      inputSchema: navigateSchema,
      handler: async (context) => {
        // Extract URL from the context - it might be in context.arguments or passed directly
        const url = context.url || context.arguments?.url;
        if (!url) {
          console.error('Handler context:', JSON.stringify(context, null, 2));
          throw new Error('URL parameter is missing');
        }
        const result = await logger.navigate(url);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
    },
    {
      name: 'get_logs',
      description: 'Retrieve console messages filtered by severity level',
      inputSchema: getLogsSchema,
      handler: async ({ level, limit }) => {
        try {
          const logs = await logger.getLogs(level, limit);
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                level,
                count: logs.length,
                logs
              }, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ error: error.message }, null, 2)
            }],
            isError: true
          };
        }
      }
    },
    {
      name: 'clear_logs',
      description: 'Clear the in-memory log buffer',
      inputSchema: z.object({}),
      handler: async () => {
        const result = logger.clearLogs();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
    },
    {
      name: 'get_status',
      description: 'Get browser status and current page information',
      inputSchema: z.object({}),
      handler: async () => {
        const status = await logger.getStatus();
        if (status.pageTitle instanceof Promise) {
          status.pageTitle = await status.pageTitle;
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(status, null, 2)
          }]
        };
      }
    }
  ];
}
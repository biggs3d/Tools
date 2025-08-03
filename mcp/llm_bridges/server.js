#!/usr/bin/env node

import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { resolve } from 'path';
import { getAvailableProviders } from './lib/config.js';
import { createSendToLLMTool } from './lib/tools/send-to-llm.js';
import { estimateTotalTokens, formatTokenCount } from './lib/utils/token-estimator.js';
import { collectFiles } from './lib/utils/file-handler.js';

class LLMBridgesServer {
    constructor() {
        this.server = new McpServer({
            name: 'llm-bridges',
            description: 'Unified bridge to multiple LLM providers (Gemini, OpenAI, Grok)',
            version: '1.0.0'
        });
        
        this.setupTools();
        this.setupErrorHandling();
    }
    
    setupTools() {
        // Main tool: send_to_llm
        const sendToLLMTool = createSendToLLMTool();
        this.server.tool(
            sendToLLMTool.name,
            sendToLLMTool.description,
            sendToLLMTool.inputSchema,
            sendToLLMTool.handler
        );
        
        // Token estimation tool
        this.server.tool(
            'estimate_context_size',
            'Estimate token count for files before sending to LLM providers',
            {
                files: z.array(z.string())
                    .optional()
                    .default([])
                    .describe('Array of file paths to analyze'),
                    
                prompt: z.string()
                    .optional()
                    .describe('The prompt text to include in estimation'),
                    
                project_context: z.string()
                    .optional()
                    .describe('Project context to include in estimation'),
                    
                show_details: z.boolean()
                    .optional()
                    .default(false)
                    .describe('Show detailed breakdown of token usage'),
            },
            async ({ files, prompt, project_context, show_details }) => {
                try {
                    let response = '## Token Estimation\n\n';
                    
                    // Collect files if provided
                    let fileContents = [];
                    if (files && files.length > 0) {
                        fileContents = await collectFiles(files);
                        
                        if (files.length > 0 && fileContents.length === 0) {
                            return {
                                content: [{
                                    type: 'text',
                                    text: '❌ No valid files found to analyze.'
                                }]
                            };
                        }
                    }
                    
                    // Estimate tokens for each provider
                    const availableProviders = getAvailableProviders();
                    
                    if (availableProviders.length > 0) {
                        response += '### Token Estimation by Provider\n\n';
                        
                        for (const providerName of ['gemini', 'openai', 'grok']) {
                            if (availableProviders.includes(providerName)) {
                                const config = CONFIG.providers[providerName];
                                const totalTokens = estimateTotalTokens(
                                    fileContents, 
                                    prompt, 
                                    project_context,
                                    providerName,
                                    config.defaultModel
                                );
                                const percentage = (totalTokens / config.maxTokens) * 100;
                                const status = percentage > 100 ? '❌' : percentage > 80 ? '⚠️' : '✅';
                                
                                response += `**${providerName}** (${config.defaultModel}):\n`;
                                response += `- Estimated tokens: ${formatTokenCount(totalTokens)}\n`;
                                response += `- Status: ${status} ${percentage.toFixed(1)}% of ${formatTokenCount(config.maxTokens)} limit\n\n`;
                            }
                        }
                    } else {
                        // Fallback to generic estimation
                        const totalTokens = estimateTotalTokens(fileContents, prompt, project_context);
                        response += `**Estimated tokens:** ${formatTokenCount(totalTokens)}\n\n`;
                        response += '⚠️ No providers configured. Add API keys to get provider-specific estimates.\n\n';
                    }
                    
                    // Show details if requested
                    if (show_details && availableProviders.length > 0) {
                        response += '### Breakdown\n\n';
                        
                        // Use first available provider for detailed breakdown
                        const primaryProvider = availableProviders[0];
                        const primaryConfig = CONFIG.providers[primaryProvider];
                        
                        if (fileContents.length > 0) {
                            response += '**Files:**\n';
                            for (const file of fileContents) {
                                const fileTokens = estimateTotalTokens([file], null, null, primaryProvider, primaryConfig.defaultModel) - 1000; // Remove buffer
                                response += `- ${file.path}: ${formatTokenCount(fileTokens)}\n`;
                            }
                            response += '\n';
                        }
                        
                        if (prompt) {
                            const promptTokens = estimateTotalTokens([], prompt, null, primaryProvider, primaryConfig.defaultModel) - 1000;
                            response += `**Prompt:** ${formatTokenCount(promptTokens)}\n`;
                        }
                        
                        if (project_context) {
                            const contextTokens = estimateTotalTokens([], null, project_context, primaryProvider, primaryConfig.defaultModel) - 1000;
                            response += `**Project context:** ${formatTokenCount(contextTokens)}\n`;
                        }
                        
                        response += `**Response buffer:** ~1k tokens\n`;
                        response += `\n*Breakdown uses ${primaryProvider} tokenizer*\n`;
                    }
                    
                    return {
                        content: [{
                            type: 'text',
                            text: response
                        }]
                    };
                } catch (error) {
                    return {
                        content: [{
                            type: 'text',
                            text: `❌ Error estimating tokens: ${error.message}`
                        }]
                    };
                }
            }
        );
        
        // System info tool
        this.server.tool(
            'get_system_info',
            'Get information about available LLM providers and configuration',
            {},
            async () => {
                const providers = getAvailableProviders();
                
                let response = '## LLM Bridges System Info\n\n';
                response += `**Version:** 1.0.0\n`;
                response += `**Available providers:** ${providers.length > 0 ? providers.join(', ') : 'None'}\n\n`;
                
                if (providers.length === 0) {
                    response += '⚠️ No providers configured. Add API keys to your .env file.\n';
                } else {
                    response += '### Provider Details\n\n';
                    
                    for (const provider of providers) {
                        const config = CONFIG.providers[provider];
                        response += `**${provider}**\n`;
                        response += `- Default model: ${config.defaultModel}\n`;
                        response += `- Max tokens: ${formatTokenCount(config.maxTokens)}\n`;
                        response += `- Timeout: ${config.timeoutMin} minutes\n`;
                        
                        if (config.allowedModels && config.allowedModels.length > 0) {
                            response += `- Allowed models: ${config.allowedModels.slice(0, 5).join(', ')}`;
                            if (config.allowedModels.length > 5) {
                                response += ` +${config.allowedModels.length - 5} more`;
                            }
                            response += '\n';
                        }
                        
                        response += '\n';
                    }
                }
                
                return {
                    content: [{
                        type: 'text',
                        text: response
                    }]
                };
            }
        );
    }
    
    setupErrorHandling() {
        this.server.onerror = (error) => {
            console.error('[MCP Error]', error);
        };
        
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });
    }
    
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        
        console.error('LLM Bridges MCP server started');
        console.error(`Available providers: ${getAvailableProviders().join(', ') || 'None'}`);
    }
}

// Import CONFIG after defining the class
import { CONFIG } from './lib/config.js';

// Only start the server if this file is run directly (not imported for testing)
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const server = new LLMBridgesServer();
    server.start().catch(error => {
        console.error("Failed to start MCP server:", error);
        process.exit(1);
    });
}

// Export for testing
export { LLMBridgesServer };
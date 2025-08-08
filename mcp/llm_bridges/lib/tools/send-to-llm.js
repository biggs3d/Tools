import { z } from 'zod';
import { getAvailableProviders, getProviderConfig, inferProviderFromModel, PROVIDERS, ALL_PROVIDERS } from '../config.js';
import { GeminiProvider } from '../providers/gemini.js';
import { OpenAIProvider } from '../providers/openai.js';
import { GrokProvider } from '../providers/grok.js';
import { collectFiles, findFiles } from '../utils/file-handler.js';
import { estimateTotalTokens, formatTokenCount } from '../utils/token-estimator.js';
import { createSmartError, formatErrorResponse, formatMultipleErrors } from '../utils/error-handler.js';

// Provider instances cache
const providerCache = new Map();

// Get or create provider instance
function getProvider(name) {
    if (providerCache.has(name)) {
        return providerCache.get(name);
    }
    
    const config = getProviderConfig(name);
    let provider;
    
    switch (name) {
        case PROVIDERS.GEMINI:
            provider = new GeminiProvider(config);
            break;
        case PROVIDERS.OPENAI:
            provider = new OpenAIProvider(config);
            break;
        case PROVIDERS.GROK:
            provider = new GrokProvider(config);
            break;
        default:
            throw new Error(`Unknown provider: ${name}`);
    }
    
    providerCache.set(name, provider);
    return provider;
}

// Parse provider selection
function parseProviders(llm, availableProviders) {
    // Handle JSON string that looks like an array
    if (typeof llm === 'string' && llm.startsWith('[') && llm.endsWith(']')) {
        try {
            llm = JSON.parse(llm);
        } catch (e) {
            // If parsing fails, continue with string
        }
    }
    
    // Handle 'all' keyword
    if (llm === ALL_PROVIDERS) {
        return availableProviders.map(name => getProvider(name));
    }
    
    // Handle array of providers
    if (Array.isArray(llm)) {
        const validProviders = llm
            .filter(name => availableProviders.includes(name));
        
        // Return only the valid providers found, not all providers
        return validProviders.length > 0 
            ? validProviders.map(name => getProvider(name))
            : [];
    }
    
    // Handle single provider string
    if (typeof llm === 'string') {
        // Check if it's a model name
        const inferredProvider = inferProviderFromModel(llm);
        if (inferredProvider && availableProviders.includes(inferredProvider)) {
            return [getProvider(inferredProvider)];
        }
        
        // Treat as provider name
        if (availableProviders.includes(llm)) {
            return [getProvider(llm)];
        }
        
        // Return empty array if no match found
        return [];
    }
    
    // Default to all available only when llm is undefined or null
    return availableProviders.map(name => getProvider(name));
}

// Format file context
function formatContext(files, projectContext, includeLineNumbers = true) {
    let context = '';
    
    if (projectContext) {
        context += `# Project Context\n${projectContext}\n\n`;
    }
    
    if (files && files.length > 0) {
        context += '# Files\n\n';
        
        for (const file of files) {
            context += `## File: ${file.path}\n\n`;
            
            if (includeLineNumbers) {
                const lines = file.content.split('\n');
                const numberedLines = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
                context += numberedLines;
            } else {
                context += file.content;
            }
            
            context += '\n\n';
            
            if (file.truncated) {
                context += '[File truncated due to size]\n\n';
            }
        }
    }
    
    return context;
}

// Format results for single provider
function formatSingleResult(provider, response, timing) {
    let result = `✅ **${provider.name} Response**\n\n${response}`;
    
    if (timing) {
        result += `\n\n⏱️ Response time: ${timing}ms`;
    }
    
    return result;
}

// Format results for multiple providers
function formatMultipleResults(results, providers) {
    let response = '## 🤖 LLM Analysis Results\n\n';
    
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const provider = providers[i];
        
        response += `### ${provider.name}\n\n`;
        
        if (result.status === 'fulfilled') {
            response += result.value;
        } else {
            response += formatErrorResponse(result.reason);
        }
        
        response += '\n\n';
    }
    
    return response;
}

// Create the send_to_llm tool
export function createSendToLLMTool() {
    return {
        name: 'send_to_llm',
        description: 'Send files and context to one or more LLM providers for analysis',
        inputSchema: {
            llm: z.union([
                z.string(),
                z.array(z.string())
            ])
                .optional()
                .default(ALL_PROVIDERS)
                .describe('LLM provider(s) to use: gemini, openai, grok, all, or a model name'),
            
            prompt: z.string()
                .describe('The question or task for the LLM'),
            
            files: z.array(z.string())
                .optional()
                .default([])
                .describe('Absolute file paths to include in context (e.g., /home/user/project/file.js)'),
            
            model: z.string()
                .optional()
                .describe('Specific model to use (overrides provider defaults)'),
            
            project_context: z.string()
                .optional()
                .describe('Additional project background information'),
            
            include_line_numbers: z.boolean()
                .optional()
                .default(true)
                .describe('Include line numbers in file content'),
            
            enable_iterative: z.boolean()
                .optional()
                .describe('Enable iterative refinement for better results'),
            
            temperature: z.number()
                .min(0)
                .max(2)
                .optional()
                .describe('Sampling temperature (0-2)'),
            
            top_p: z.number()
                .min(0)
                .max(1)
                .optional()
                .describe('Top-p sampling parameter'),
            
            max_tokens: z.number()
                .optional()
                .describe('Maximum tokens in response'),
        },
        
        handler: async (args) => {
            try {
                const availableProviders = getAvailableProviders();
                
                if (availableProviders.length === 0) {
                    return {
                        content: [{
                            type: 'text',
                            text: '❌ No LLM providers configured. Please add at least one API key to your .env file:\n' +
                                  '- GEMINI_API_KEY\n' +
                                  '- OPENAI_API_KEY\n' +
                                  '- XAI_API_KEY'
                        }]
                    };
                }
                
                // Parse provider selection
                const providers = parseProviders(args.llm, availableProviders);
                
                if (providers.length === 0) {
                    return {
                        content: [{
                            type: 'text',
                            text: `❌ No valid providers found for: ${args.llm}\n\n` +
                                  `Available providers: ${availableProviders.join(', ')}`
                        }]
                    };
                }
                
                // Collect files if provided
                let fileContents = [];
                if (args.files && args.files.length > 0) {
                    fileContents = await collectFiles(args.files);
                    
                    if (args.files.length > 0 && fileContents.length === 0) {
                        return {
                            content: [{
                                type: 'text',
                                text: '❌ No valid files found. Please check the file paths.'
                            }]
                        };
                    }
                }
                
                // Format context
                const formattedContext = formatContext(
                    fileContents,
                    args.project_context,
                    args.include_line_numbers
                );
                
                const fullPrompt = formattedContext 
                    ? `${formattedContext}\n\n# Task\n${args.prompt}`
                    : args.prompt;
                
                // Prepare query options
                const queryOptions = {
                    model: args.model,
                    enableIterative: args.enable_iterative,
                    temperature: args.temperature,
                    topP: args.top_p,
                    maxTokens: args.max_tokens,
                };
                
                // Execute queries
                if (providers.length === 1) {
                    // Single provider
                    const provider = providers[0];
                    const startTime = Date.now();
                    
                    try {
                        const response = await provider.query(fullPrompt, queryOptions);
                        const timing = Date.now() - startTime;
                        
                        return {
                            content: [{
                                type: 'text',
                                text: formatSingleResult(provider, response, timing)
                            }]
                        };
                    } catch (error) {
                        const smartError = createSmartError(error, {
                            files: fileContents.length,
                            estimatedTokens: estimateTotalTokens(
                                fileContents, 
                                args.prompt, 
                                args.project_context, 
                                provider.name,
                                args.model || provider.config.defaultModel
                            ),
                            maxTokens: provider.config.maxTokens,
                        });
                        
                        return {
                            content: [{
                                type: 'text',
                                text: formatErrorResponse(smartError)
                            }]
                        };
                    }
                } else {
                    // Multiple providers - query in parallel
                    const queries = providers.map(provider => 
                        provider.query(fullPrompt, queryOptions)
                    );
                    
                    const results = await Promise.allSettled(queries);
                    
                    return {
                        content: [{
                            type: 'text',
                            text: formatMultipleResults(results, providers)
                        }]
                    };
                }
            } catch (error) {
                return {
                    content: [{
                        type: 'text',
                        text: `❌ Unexpected error: ${error.message}`
                    }]
                };
            }
        }
    };
}
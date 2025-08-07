/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

import OpenAI from 'openai';
import { BaseLLMProvider } from '../llmProvider.js';
import { OpenAIConfig, CompletionOptions } from '../types.js';
import { createOpenAIConfig } from '../config.js';

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider extends BaseLLMProvider {
    private client: OpenAI;
    private openaiConfig: OpenAIConfig;

    constructor(configOrApiKey: OpenAIConfig | string, isOperationSpecific: boolean = false) {
        // If a string is passed, treat it as the API key
        const config = typeof configOrApiKey === 'string'
            ? createOpenAIConfig({ apiKey: configOrApiKey })
            : createOpenAIConfig(configOrApiKey);

        super(config, isOperationSpecific);
        this.openaiConfig = config;

        // Initialize the OpenAI client
        this.client = new OpenAI({
            apiKey: this.openaiConfig.apiKey,
            organization: this.openaiConfig.organization,
            baseURL: this.openaiConfig.baseUrl,
            timeout: this.openaiConfig.timeoutMs,
            maxRetries: this.openaiConfig.retry?.attempts || 3
        });
    }

    /**
     * Get model being used by this provider
     */
    getModelName(): string {
        return this.openaiConfig.model || 'gpt-4-turbo';
    }

    /**
     * Complete a prompt using OpenAI
     */
    async complete(prompt: string, options?: CompletionOptions): Promise<string> {
        const model = this.openaiConfig.model || 'gpt-4-turbo';
        const temperature = options?.temperature !== undefined ? options.temperature : 0.7;
        const maxTokens = options?.maxTokens || 512; // Default to 512 tokens to avoid "finish_reason": "length" errors

        try {
            // Import the OpenAI SDK types
            type ChatCompletionMessageParam = OpenAI.ChatCompletionMessageParam;

            // Prepare messages array for the API
            const messages: ChatCompletionMessageParam[] = [];

            // Add system message if provided
            if (options?.systemPrompt) {
                messages.push({
                    role: 'system',
                    content: options.systemPrompt
                });
            }

            // Add context messages if provided
            if (options?.context && options.context.length > 0) {
                for (const msg of options.context) {
                    messages.push({
                        role: msg.role as never, // Type assertion to handle differences
                        content: msg.content,
                        ...(msg.name && { name: msg.name }),
                        ...(msg.function_call && { function_call: msg.function_call })
                    });
                }
            }

            // Add the main prompt
            messages.push({
                role: 'user',
                content: prompt
            });

            // Make the API call with specific stream setting to ensure proper typing
            // Use maxCompletionTokens instead of maxTokens for newer models compatibility
            const params: any = {
                model,
                messages,
                stream: false // Always use non-streaming for this method
            };

            // Use model capabilities to determine parameter support
            if (this.supportsCapability('supportsTemperature') && temperature !== undefined) {
                params.temperature = temperature;
            } else {
                console.log(`DEBUG: Model ${model} does not support temperature parameter`);
            }

            // Add top_p if supported and provided
            if (this.supportsCapability('supportsTopP') && options?.topP !== undefined) {
                params.top_p = options.topP;
            }

            // Add token limit with the appropriate parameter name
            if (maxTokens) {
                const maxTokensParam = this.modelCapabilities?.maxTokensParam || 'max_tokens';
                params[maxTokensParam] = maxTokens;
            }

            // Log request parameters for debugging
            console.log('DEBUG: OpenAI API Request Parameters:', JSON.stringify(params, null, 2));

            // Make the API call
            const response = await this.client.chat.completions.create(params);

            // With stream: false, response is of type ChatCompletion
            // Log response structure for debugging
            console.log('DEBUG: OpenAI API Response Structure:',
                        JSON.stringify({
                            id: response.id,
                            model: response.model,
                            choices_length: response.choices?.length,
                            first_choice: response.choices && response.choices.length > 0 ? {
                                index: response.choices[0].index,
                                finish_reason: response.choices[0].finish_reason,
                                has_content: Boolean(response.choices[0]?.message?.content)
                            } : null
                        }, null, 2));

            const content = response.choices[0]?.message.content || '';
            if (!content || content.trim() === '') {
                console.error('WARNING: OpenAI returned an empty response');
            }
            return content;
        } catch (error) {
            console.error('OpenAI completion error:', error);
            throw new Error(`OpenAI API error: ${(error as Error).message}`);
        }
    }

    /**
     * Count tokens for a text
     */
    async countTokens(text: string): Promise<number> {
        try {
            // Import dynamically to avoid circular dependencies
            const { estimateOpenAITokens } = await import('../utils/tokenCounter.js');
            return estimateOpenAITokens(text, this.openaiConfig.model);
        } catch (error) {
            console.error('Token counting error:', error);
            // Fallback to simple estimation if token counter fails
            return Math.ceil(text.length / 4);
        }
    }

    /**
     * Get embeddings for a text
     * @param text The text to get embeddings for
     * @param dimensions Optional parameter to specify output dimensions (supported by text-embedding-3-large)
     */
    async getEmbedding(text: string, dimensions?: number): Promise<number[]> {
        try {
            // Use the preferred embedding model specified in configuration, or fallback to default
            // First check if there's an operation-specific model for embeddings
            const embeddingModel = this.getModelForOperation('embedding') || 'text-embedding-3-large';

            // Basic parameters
            const params: any = {
                model: embeddingModel,
                input: text
            };

            // Add dimensions if specified and using text-embedding-3-large which supports it
            if (dimensions && embeddingModel === 'text-embedding-3-large') {
                params.dimensions = dimensions;
            }

            const response = await this.client.embeddings.create(params);

            return response.data[0].embedding;
        } catch (error) {
            console.error('OpenAI embedding error:', error);
            throw new Error(`OpenAI embedding error: ${(error as Error).message}`);
        }
    }
}
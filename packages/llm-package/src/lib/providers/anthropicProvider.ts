/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

import { BaseLLMProvider } from '../llmProvider.js';
import { AnthropicConfig, CompletionOptions } from '../types.js';
import { createAnthropicConfig } from '../config.js';

// Use dynamic import to avoid requiring the dependency if not used
// This allows the package to be used without @anthropic-ai/sdk installed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Anthropic: any;

/**
 * Anthropic (Claude) provider implementation
 */
export class AnthropicProvider extends BaseLLMProvider {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private client: any;
    private anthropicConfig: AnthropicConfig;

    constructor(configOrApiKey: AnthropicConfig | string, isOperationSpecific: boolean = false) {
        // If a string is passed, treat it as the API key
        const config = typeof configOrApiKey === 'string'
            ? createAnthropicConfig({ apiKey: configOrApiKey })
            : createAnthropicConfig(configOrApiKey);

        super(config, isOperationSpecific);
        this.anthropicConfig = config;

        // Initialize the Anthropic client - this will throw if the SDK isn't installed
        this.initClient();
    }

    /**
     * Initialize the Anthropic client
     */
    private async initClient(): Promise<void> {
        try {
            if (!Anthropic) {
                // Dynamically import the Anthropic SDK
                const module = await import('@anthropic-ai/sdk');
                Anthropic = module.default;
            }

            this.client = new Anthropic({
                apiKey: this.anthropicConfig.apiKey,
                baseURL: this.anthropicConfig.baseUrl
            });
        } catch (error) {
            throw new Error(
                `Failed to initialize Anthropic client. Make sure @anthropic-ai/sdk is installed: ${(error as Error).message}`
            );
        }
    }

    /**
     * Get model being used by this provider
     */
    getModelName(): string {
        return this.anthropicConfig.model || 'claude-3-opus-20240229';
    }

    /**
     * Count tokens for a text
     */
    async countTokens(text: string): Promise<number> {
        try {
            // Import dynamically to avoid circular dependencies
            const { estimateAnthropicTokens } = await import('../utils/tokenCounter.js');
            return estimateAnthropicTokens(text, this.anthropicConfig.model);
        } catch (error) {
            console.error('Token counting error:', error);
            // Fallback to simple estimation if token counter fails
            return Math.ceil(text.length / 4);
        }
    }

    /**
     * Complete a prompt using Anthropic's Claude
     */
    async complete(prompt: string, options?: CompletionOptions): Promise<string> {
        if (!this.client) {
            await this.initClient();
        }

        const model = this.anthropicConfig.model || 'claude-3-opus-20240229';
        const temperature = options?.temperature !== undefined ? options.temperature : 0.7;
        const maxTokens = options?.maxTokens || 512; // Default to 512 tokens to avoid "finish_reason": "length" errors

        try {
            // Prepare messages array for the API
            const messages = [];

            // Add system message if provided
            const systemPrompt = options?.systemPrompt || '';

            // Add context messages if provided
            if (options?.context && options.context.length > 0) {
                messages.push(...options.context);
            }

            // Always add the main prompt as a user message if not in context
            if (!options?.context || !options.context.some(msg => msg.role === 'user' && msg.content.includes(prompt))) {
                messages.push({
                    role: 'user',
                    content: prompt
                });
            }

            // Make the API call
            const response = await this.client.messages.create({
                model,
                messages,
                system: systemPrompt,
                temperature,
                max_tokens: maxTokens,
                top_p: options?.topP || 1,
                stream: options?.stream || false
            });

            // Return the response content - Claude API returns an array of content blocks
            return response.content[0]?.text || '';
        } catch (error) {
            console.error('Anthropic completion error:', error);
            throw new Error(`Anthropic API error: ${(error as Error).message}`);
        }
    }

    /**
     * Anthropic doesn't natively support embeddings, but we provide this method
     * to maintain API compatibility with other providers.
     *
     * @param text The text to get embeddings for (ignored)
     * @param dimensions Optional parameter to specify output dimensions (ignored)
     * @throws Error Always throws an error since Anthropic doesn't support embeddings
     */
    async getEmbedding(text: string, dimensions?: number): Promise<number[]> {
        throw new Error('Embeddings are not supported by Anthropic providers. Use OpenAI for embeddings.');
    }
}
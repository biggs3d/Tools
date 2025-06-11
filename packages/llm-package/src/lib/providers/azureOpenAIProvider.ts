/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

import { BaseLLMProvider } from '../llmProvider.js';
import { AzureOpenAIConfig, CompletionOptions } from '../types.js';
import { createAzureOpenAIConfig } from '../config.js';
import OpenAI from 'openai';

/**
 * Azure OpenAI provider implementation
 */
export class AzureOpenAIProvider extends BaseLLMProvider {
    private client: OpenAI;
    private azureConfig: AzureOpenAIConfig;

    constructor(config: AzureOpenAIConfig, isOperationSpecific: boolean = false) {
        const finalConfig = createAzureOpenAIConfig(config);
        super(finalConfig, isOperationSpecific);
        this.azureConfig = finalConfig;

        // Initialize the Azure OpenAI client
        this.client = new OpenAI({
            apiKey: this.azureConfig.apiKey,
            baseURL: this.getAzureBaseUrl(),
            defaultQuery: { 'api-version': this.azureConfig.apiVersion || '2023-05-15' },
            defaultHeaders: { 'api-key': this.azureConfig.apiKey }
        });
    }

    /**
     * Build the Azure OpenAI base URL from configuration
     */
    private getAzureBaseUrl(): string {
        if (this.azureConfig.baseUrl) {
            return this.azureConfig.baseUrl;
        }

        const resourceName = this.azureConfig.resourceName;
        if (!resourceName) {
            throw new Error('Azure OpenAI resource name is required if baseUrl is not provided');
        }

        return `https://${resourceName}.openai.azure.com/openai/deployments/${this.azureConfig.deploymentName}`;
    }

    /**
     * Get model being used by this provider
     */
    getModelName(): string {
        return this.azureConfig.deploymentName;
    }

    /**
     * Complete a prompt using Azure OpenAI
     */
    async complete(prompt: string, options?: CompletionOptions): Promise<string> {
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
                model: this.azureConfig.deploymentName,
                messages: messages,
                stream: false // Always use non-streaming for this method
            };

            // For Azure, we need to determine capabilities based on the deployment name
            // Since Azure OpenAI doesn't expose the exact model name, we'll check for known patterns
            const deploymentNameLower = this.azureConfig.deploymentName.toLowerCase();

            // Use model capabilities to determine parameter support
            if (this.supportsCapability('supportsTemperature') && temperature !== undefined) {
                params.temperature = temperature;
            } else {
                console.log(`DEBUG: Model ${deploymentNameLower} does not support temperature parameter`);
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

            const response = await this.client.chat.completions.create(params);

            // With stream: false, response is of type ChatCompletion
            return response.choices[0]?.message.content || '';
        } catch (error) {
            console.error('Azure OpenAI completion error:', error);
            throw new Error(`Azure OpenAI API error: ${(error as Error).message}`);
        }
    }

    /**
     * Count tokens for a text
     */
    async countTokens(text: string): Promise<number> {
        try {
            // Import dynamically to avoid circular dependencies
            const { estimateOpenAITokens } = await import('../utils/tokenCounter.js');
            // Azure OpenAI uses the same tokenization as OpenAI
            return estimateOpenAITokens(text, this.azureConfig.deploymentName);
        } catch (error) {
            console.error('Token counting error:', error);
            // Fallback to simple estimation if token counter fails
            return Math.ceil(text.length / 4);
        }
    }

    /**
     * Get embeddings for a text
     */
    async getEmbedding(text: string): Promise<number[]> {
        try {
            // For embeddings, we need a different base URL pattern
            const originalBaseUrl = this.client.baseURL;

            // Temporarily update the baseURL to the embeddings deployment
            // Note: In production, you should configure a separate embedding model deployment name
            const embeddingDeployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT || 'text-embedding';
            const resourceName = this.azureConfig.resourceName;

            this.client.baseURL = `https://${resourceName}.openai.azure.com/openai/deployments/${embeddingDeployment}`;

            try {
                const response = await this.client.embeddings.create({
                    model: embeddingDeployment,
                    input: text
                });

                return response.data[0].embedding;
            } finally {
                // Restore the original baseURL
                this.client.baseURL = originalBaseUrl;
            }
        } catch (error) {
            console.error('Azure OpenAI embedding error:', error);
            throw new Error(`Azure OpenAI embedding error: ${(error as Error).message}`);
        }
    }
}
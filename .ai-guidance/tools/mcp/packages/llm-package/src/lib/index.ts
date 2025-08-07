/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.14
 * https://github.com/biggs3d/McpMemoryServer
 */

/**
 * Memory LLM - LLM integration for memory systems
 */

// Core types
export * from './types.js';

// Configuration
export * from './config.js';

// Base provider and client
export { BaseLLMProvider, LLMMemoryClient } from './llmProvider.js';
export { createProviderForOperation } from './providerFactory.js';

// Provider implementations
export { OpenAIProvider } from './providers/openaiProvider.js';
export { AnthropicProvider } from './providers/anthropicProvider.js';
export { AzureOpenAIProvider } from './providers/azureOpenAIProvider.js';

// Prompts
export * from './prompts/memory.js';
export * from './prompts/evaluation.js';
export * from './prompts/clustering.js';

// Utilities
export * from './utils/retry.js';
export * from './utils/throttle.js';
export * from './utils/tokenCounter.js';
export * from './utils/cache.js';
export * from './utils/errors.js';
export * from './utils/responseParser.js';

// Re-export testing utilities for users (available in llm-package/dist/testing)
// but not directly exposed in the main export

// Factory function to create an LLM client
import { LLMConfig, LLMClient } from './types.js';
import { OpenAIProvider } from './providers/openaiProvider.js';
import { AnthropicProvider } from './providers/anthropicProvider.js';
import { AzureOpenAIProvider } from './providers/azureOpenAIProvider.js';
import { LLMMemoryClient } from './llmProvider.js';
import { loadDefaultConfig } from './config.js';

/**
 * Create an LLM client with the specified configuration
 */
export function createLLMClient(config?: LLMConfig): LLMClient {
    // Use provided config or load from environment
    const finalConfig = config || loadDefaultConfig();

    // Create the default provider for general operations
    let provider;
    switch (finalConfig.provider) {
    case 'openai':
        provider = new OpenAIProvider(finalConfig);
        break;
    case 'anthropic':
        provider = new AnthropicProvider(finalConfig);
        break;
    case 'azure-openai':
        // Type assertion is necessary since finalConfig has a more generic type
        provider = new AzureOpenAIProvider(finalConfig);
        break;
    default:
        throw new Error('Unsupported config provider!');
    }

    // Return a memory client wrapping the provider
    // The LLMMemoryClient constructor will create operation-specific providers as needed
    return new LLMMemoryClient(provider, finalConfig);
}

/**
 * Create a client using environment variables
 */
export function createLLMClientFromEnv(): LLMClient {
    return createLLMClient();
}

/**
 * Utility to create an OpenAI-based client with just an API key
 */
export function createOpenAIClient(apiKey: string, model?: string): LLMClient {
    const provider = new OpenAIProvider({
        provider: 'openai',
        apiKey,
        model
    }, true); // Set isOperationSpecific to true to skip strict validation
    return new LLMMemoryClient(provider);
}

/**
 * Utility to create a Claude-based client with just an API key
 */
export function createClaudeClient(apiKey: string, model?: string): LLMClient {
    const provider = new AnthropicProvider({
        provider: 'anthropic',
        apiKey,
        model
    }, true); // Set isOperationSpecific to true to skip strict validation
    return new LLMMemoryClient(provider);
}

/**
 * Utility to create an Azure OpenAI client with minimal configuration
 */
export function createAzureOpenAIClient(
    apiKey: string,
    deploymentName: string,
    resourceName: string,
    apiVersion?: string
): LLMClient {
    const provider = new AzureOpenAIProvider({
        provider: 'azure-openai',
        apiKey,
        deploymentName,
        resourceName,
        apiVersion: apiVersion || '2023-05-15'
    }, true); // Set isOperationSpecific to true to skip strict validation
    return new LLMMemoryClient(provider);
}
/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

import { LLMConfig, LLMProvider, ModelConfig, OperationType } from './types.js';
import { OpenAIProvider } from './providers/openaiProvider.js';
import { AnthropicProvider } from './providers/anthropicProvider.js';
import { AzureOpenAIProvider } from './providers/azureOpenAIProvider.js';
import { createAnthropicConfig, createAzureOpenAIConfig, createOpenAIConfig, validateConfig } from './config.js';

/**
 * Factory function to create an LLM provider for a specific operation type
 * based on configuration
 * 
 * @param operationType The type of operation to create a provider for
 * @param baseConfig The base configuration
 * @returns A provider instance configured for the operation
 */
export function createProviderForOperation(
    operationType: OperationType,
    baseConfig: LLMConfig
): LLMProvider {
    // Check if there's operation-specific configuration
    if (baseConfig.operationModels && baseConfig.operationModels[operationType]) {
        const modelConfig = baseConfig.operationModels[operationType];

        // If it's a ModelConfig object, create a provider using its settings
        if (typeof modelConfig === 'object' && 'provider' in modelConfig) {
            return createProviderFromModelConfig(modelConfig, baseConfig, operationType);
        }
        
        // If it's just a string model name, use the base provider type with the specified model
        if (typeof modelConfig === 'string') {
            // Create a new config with the specified model
            const configWithModel = { 
                ...baseConfig,
                model: modelConfig
            };
            
            return createProviderFromConfig(configWithModel, operationType);
        }
    }

    // If no operation-specific config, use the base config
    return createProviderFromConfig(baseConfig, operationType);
}

/**
 * Create a provider from a ModelConfig object
 * 
 * @param modelConfig The model configuration
 * @param baseConfig The base configuration to use for defaults
 * @param operationType The operation type this provider will be used for
 * @returns A provider instance
 */
function createProviderFromModelConfig(
    modelConfig: ModelConfig, 
    baseConfig: LLMConfig,
    operationType: OperationType
): LLMProvider {
    // Determine provider type from the model config
    const providerType = modelConfig.provider;
    
    // Get the API key from the model config, or try environment variable, or fall back to the base config
    let apiKey = modelConfig.apiKey;

    // If no API key is provided in the modelConfig, try to get it from environment
    if (!apiKey) {
        switch (providerType) {
            case 'openai':
                apiKey = process.env.OPENAI_API_KEY;
                break;
            case 'anthropic':
                apiKey = process.env.ANTHROPIC_API_KEY;
                break;
            case 'azure-openai':
                apiKey = process.env.AZURE_OPENAI_API_KEY;
                break;
            default:
                // Fall back to base config
                apiKey = baseConfig.apiKey;
        }
    }

    // If still no API key, fall back to base config
    if (!apiKey) {
        apiKey = baseConfig.apiKey;
    }
    
    // Create configuration based on provider type
    switch (providerType) {
        case 'openai': {
            const openaiConfig = createOpenAIConfig({
                provider: 'openai',
                apiKey,
                model: modelConfig.model,
                baseUrl: baseConfig.baseUrl,
                timeoutMs: baseConfig.timeoutMs,
                retry: baseConfig.retry,
                ...(modelConfig.options || {})
            });
            // Set isOperationSpecific=true to skip memory validation for operations like embedding
            return new OpenAIProvider(openaiConfig, true);
        }
            
        case 'anthropic': {
            const anthropicConfig = createAnthropicConfig({
                provider: 'anthropic',
                apiKey,
                model: modelConfig.model,
                baseUrl: baseConfig.baseUrl,
                timeoutMs: baseConfig.timeoutMs,
                retry: baseConfig.retry,
                ...(modelConfig.options || {})
            });
            return new AnthropicProvider(anthropicConfig, true);
        }
            
        case 'azure-openai': {
            // For Azure, we need to ensure we have the deployment name
            if (!modelConfig.model && !modelConfig.options?.deploymentName) {
                throw new Error('Azure OpenAI requires a deploymentName in options or model');
            }
            
            const options = modelConfig.options || {};
            
            const azureConfig = createAzureOpenAIConfig({
                provider: 'azure-openai',
                apiKey,
                deploymentName: modelConfig.model, // Use model as deployment name
                baseUrl: baseConfig.baseUrl,
                timeoutMs: baseConfig.timeoutMs,
                retry: baseConfig.retry,
                ...options
            });
            return new AzureOpenAIProvider(azureConfig, true);
        }
            
        default:
            throw new Error(`Unsupported provider: ${providerType}`);
    }
}

/**
 * Create a provider from a LLMConfig
 * 
 * @param config The LLM configuration
 * @param operationType Optional operation type this provider will be used for
 * @returns A provider instance
 */
function createProviderFromConfig(config: LLMConfig, operationType?: OperationType): LLMProvider {
    const provider = config.provider;
    const isOperationSpecific = Boolean(operationType);
    
    switch (provider) {
        case 'openai':
            return new OpenAIProvider(config, isOperationSpecific);
            
        case 'anthropic':
            return new AnthropicProvider(config, isOperationSpecific);
            
        case 'azure-openai':
            return new AzureOpenAIProvider(config, isOperationSpecific);
            
        default:
            throw new Error(`Unsupported provider: ${provider}`);
    }
}
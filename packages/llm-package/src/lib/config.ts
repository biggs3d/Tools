/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

import {config as loadEnvConfig} from 'dotenv';
import {
    AnthropicConfig,
    AzureOpenAIConfig,
    BaseLLMConfig,
    LLMConfig,
    ModelCapabilities,
    OpenAIConfig,
    OperationModels,
    OperationType
} from './types.js';

// Load environment variables from .env file
loadEnvConfig();

/**
 * Default configuration values for LLM providers
 */
const DEFAULT_CONFIG: BaseLLMConfig = {
    provider: 'openai',
    apiKey: '',
    timeoutMs: 30000,
    maxConcurrentRequests: 5,
    retry: {
        attempts: 3,
        initialDelayMs: 1000
    }
};

/**
 * Default provider-specific configurations
 */
const PROVIDER_DEFAULTS = {
    openai: {
        model: 'o4-mini'
    },
    anthropic: {
        model: 'claude-3-7-sonnet-latest' // Latest model as of the time of writing
    },
    'azure-openai': {
        apiVersion: '2023-05-15'
    }
};

/**
 * Model capabilities for feature support
 */
export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
    // OpenAI Embedding Model
    'text-embedding-3-large': {
        supportsTemperature: false,
        supportsTopP: false,
        supportsEmbeddings: true,
        supportsMemoryFunctions: false,
        maxContextTokens: 8191
    },

    // OpenAI Models
    'gpt-4-turbo': {
        supportsTemperature: true,
        supportsTopP: true,
        supportsEmbeddings: true,
        supportsMemoryFunctions: true,
        supportsRatingFunctions: true,
        maxContextTokens: 128000,
        maxTokensParam: 'max_completion_tokens'
    },
    'gpt-4o': {
        supportsTemperature: true,
        supportsTopP: true,
        supportsEmbeddings: true,
        supportsMemoryFunctions: true,
        supportsRatingFunctions: true,
        maxContextTokens: 128000,
        maxTokensParam: 'max_completion_tokens'
    },
    'gpt-3.5-turbo': {
        supportsTemperature: true,
        supportsTopP: true,
        supportsEmbeddings: true,
        supportsMemoryFunctions: true,
        supportsRatingFunctions: true,
        maxContextTokens: 16385,
        maxTokensParam: 'max_completion_tokens'
    },
    'o4-mini': {
        supportsTemperature: false,
        supportsTopP: false,
        supportsEmbeddings: false,
        supportsMemoryFunctions: false,
        // Even with structured prompts, o4-mini seems unreliable for ratings
        supportsRatingFunctions: false,
        maxContextTokens: 128000,
        maxTokensParam: 'max_completion_tokens'
    },

    // Anthropic Models
    'claude-3-7-sonnet-latest': {
        supportsTemperature: true,
        supportsTopP: true,
        supportsEmbeddings: false,
        supportsMemoryFunctions: true,
        supportsRatingFunctions: true,
        maxContextTokens: 200000
    },

    // Aliases for latest versions
    'claude-latest': {
        supportsTemperature: true,
        supportsTopP: true,
        supportsEmbeddings: false,
        supportsMemoryFunctions: true,
        supportsRatingFunctions: true,
        maxContextTokens: 200000
    },
    'gpt-4-latest': {
        supportsTemperature: true,
        supportsTopP: true,
        supportsEmbeddings: true,
        supportsMemoryFunctions: true,
        maxContextTokens: 128000,
        maxTokensParam: 'max_completion_tokens'
    }
};

/**
 * Recommended models for specific operations
 */
export const RECOMMENDED_MODELS = {
    // Fast operations (use cheaper/faster models)
    fast: {
        openai: 'o4-mini',
        anthropic: 'claude-3-haiku-20240307'
    },

    // Operations requiring more intelligence
    intelligence: {
        openai: 'gpt-4o',
        anthropic: 'claude-3-7-sonnet-latest'
    },

    // Operations that require reliable numeric scoring
    rating: {
        openai: 'gpt-4o',  // GPT-4 models are more reliable for numeric outputs
        anthropic: 'claude-3-7-sonnet-latest'
    },

    // Operations requiring embedding support
    embedding: {
        openai: 'text-embedding-3-large', // Best embedding model (3072 dimensions)
        anthropic: null // Anthropic doesn't support embeddings
    },

    // For memory operations (summarization, abstraction)
    memory: {
        openai: 'gpt-4o',
        anthropic: 'claude-3-7-sonnet-latest'
    }
};

/**
 * Environment variable names for different configuration values
 */
const ENV_VARS = {
    openai: {
        apiKey: 'OPENAI_API_KEY',
        model: 'OPENAI_MODEL',
        organization: 'OPENAI_ORGANIZATION'
    },
    anthropic: {
        apiKey: 'ANTHROPIC_API_KEY',
        model: 'ANTHROPIC_MODEL'
    },
    'azure-openai': {
        apiKey: 'AZURE_OPENAI_API_KEY',
        resourceName: 'AZURE_OPENAI_RESOURCE_NAME',
        deploymentName: 'AZURE_OPENAI_DEPLOYMENT_NAME',
        apiVersion: 'AZURE_OPENAI_API_VERSION'
    }
};

/**
 * Operation-specific model environment variables
 */
const OPERATION_MODEL_VARS = {
    // Unified model config (JSON format)
    modelsConfig: 'MODELS_CONFIG',

    // Individual operation model configs (JSON format)
    general: 'GENERAL_MODEL_CONFIG',
    similarity: 'SIMILARITY_MODEL_CONFIG',
    importance: 'IMPORTANCE_MODEL_CONFIG',
    summarization: 'SUMMARIZATION_MODEL_CONFIG',
    abstraction: 'ABSTRACTION_MODEL_CONFIG',
    clustering: 'CLUSTERING_MODEL_CONFIG',
    embedding: 'EMBEDDING_MODEL_CONFIG',

    // Legacy individual provider model specifications
    // (kept for backward compatibility)
    legacyOpenAI: {
        similarity: 'OPENAI_SIMILARITY_MODEL',
        importance: 'OPENAI_IMPORTANCE_MODEL',
        summarization: 'OPENAI_SUMMARIZATION_MODEL',
        abstraction: 'OPENAI_ABSTRACTION_MODEL',
        clustering: 'OPENAI_CLUSTERING_MODEL',
        embedding: 'OPENAI_EMBEDDING_MODEL'
    },
    legacyAnthropic: {
        similarity: 'ANTHROPIC_SIMILARITY_MODEL',
        importance: 'ANTHROPIC_IMPORTANCE_MODEL',
        summarization: 'ANTHROPIC_SUMMARIZATION_MODEL',
        abstraction: 'ANTHROPIC_ABSTRACTION_MODEL',
        clustering: 'ANTHROPIC_CLUSTERING_MODEL'
    },
    legacyAzureOpenAI: {
        similarity: 'AZURE_OPENAI_SIMILARITY_DEPLOYMENT',
        importance: 'AZURE_OPENAI_IMPORTANCE_DEPLOYMENT',
        summarization: 'AZURE_OPENAI_SUMMARIZATION_DEPLOYMENT',
        abstraction: 'AZURE_OPENAI_ABSTRACTION_DEPLOYMENT',
        clustering: 'AZURE_OPENAI_CLUSTERING_DEPLOYMENT',
        embedding: 'AZURE_OPENAI_EMBEDDING_DEPLOYMENT'
    }
};

/**
 * Load operation models from environment variables
 */
export function loadOperationModelsFromEnv(): Partial<OperationModels> {
    const operationModels: Partial<OperationModels> = {};

    // First, try to load the unified MODELS_CONFIG
    const modelsConfigJson = process.env[OPERATION_MODEL_VARS.modelsConfig];
    if (modelsConfigJson) {
        try {
            // Parse the JSON config
            const parsedConfig = JSON.parse(modelsConfigJson);

            // Add each operation type from the parsed config
            for (const operation of Object.keys(parsedConfig) as OperationType[]) {
                operationModels[operation] = parsedConfig[operation];
            }

            // If we have a unified config, return it immediately
            return operationModels;
        } catch (error) {
            console.error(`Error parsing MODELS_CONFIG: ${error}`);
        }
    }

    // Next, try to load individual operation configs
    const operationTypes: OperationType[] = [
        'general', 'similarity', 'importance', 'summarization',
        'abstraction', 'clustering', 'embedding'
    ];

    for (const opType of operationTypes) {
        const configVar = OPERATION_MODEL_VARS[opType];
        const configJson = process.env[configVar];

        if (configJson) {
            try {
                // Parse the JSON config for this operation
                operationModels[opType] = JSON.parse(configJson);
            } catch (error) {
                console.error(`Error parsing ${configVar}: ${error}`);
            }
        }
    }

    // Finally, check legacy model specifications for backward compatibility
    const providers = ['legacyOpenAI', 'legacyAnthropic', 'legacyAzureOpenAI'];
    const legacyModels: Record<string, any> = {};

    for (const provider of providers) {
        const legacyVars = OPERATION_MODEL_VARS[provider as keyof typeof OPERATION_MODEL_VARS];
        if (typeof legacyVars === 'object') {
            for (const [opType, envVar] of Object.entries(legacyVars)) {
                const model = process.env[envVar as string];
                if (model) {
                    // Convert provider name to proper form by removing 'legacy' prefix
                    const actualProvider = provider.replace('legacy', '').toLowerCase();

                    // Create a ModelConfig for this operation
                    legacyModels[opType] = {
                        provider: actualProvider,
                        model
                    };
                }
            }
        }
    }

    // Merge legacy models with any modern configs we found
    // (modern configs take precedence)
    return {
        ...legacyModels,
        ...operationModels
    };
}

/**
 * Load configuration from environment variables
 */
export function loadConfigFromEnv(provider: string): Partial<LLMConfig> {
    const envVars = ENV_VARS[provider as keyof typeof ENV_VARS];
    if (!envVars) {
        return {};
    }

    const config: Record<string, any> = {};

    // Get all environment variables for this provider
    for (const [configKey, envVar] of Object.entries(envVars)) {
        // Handle regular config values
        if (typeof envVar === 'string') {
            const value = process.env[envVar];
            if (value) {
                config[configKey] = value;
            }
        }
    }

    // Add operation models from separate function
    const operationModels = loadOperationModelsFromEnv();
    if (Object.keys(operationModels).length > 0) {
        config.operationModels = operationModels;
    }

    return {
        provider,
        ...config
    } as Partial<LLMConfig>;
}

/**
 * Create a complete configuration by merging defaults with provided config
 */
export function createConfig<T extends LLMConfig>(config: Partial<T>): T {
    const provider = config.provider || DEFAULT_CONFIG.provider;
    const providerDefaults = (PROVIDER_DEFAULTS as Record<string, Record<string, unknown>>)[provider] || {};

    const envConfig = loadConfigFromEnv(provider);

    // Merge in the following order: DEFAULT_CONFIG -> provider defaults -> environment variables -> explicit config
    return {
        ...DEFAULT_CONFIG,
        ...providerDefaults,
        ...envConfig,
        ...config,
        provider
    } as T;
}

/**
 * Create OpenAI configuration
 */
export function createOpenAIConfig(config: Partial<OpenAIConfig> = {}): OpenAIConfig {
    return createConfig<OpenAIConfig>({
        provider: 'openai',
        ...config
    });
}

/**
 * Create Anthropic configuration
 */
export function createAnthropicConfig(config: Partial<AnthropicConfig> = {}): AnthropicConfig {
    return createConfig<AnthropicConfig>({
        provider: 'anthropic',
        ...config
    });
}

/**
 * Create Azure OpenAI configuration
 */
export function createAzureOpenAIConfig(config: Partial<AzureOpenAIConfig> = {}): AzureOpenAIConfig {
    return createConfig<AzureOpenAIConfig>({
        provider: 'azure-openai',
        ...config
    });
}

/**
 * Get capabilities for a given model
 */
export function getModelCapabilities(modelName: string): ModelCapabilities | null {
    // Check for exact match
    if (MODEL_CAPABILITIES[modelName]) {
        return MODEL_CAPABILITIES[modelName];
    }

    // Check for partial matches (e.g., if model name has version suffixes)
    const modelPrefix = modelName.split('-').slice(0, 2).join('-');
    const fallbackModels = Object.keys(MODEL_CAPABILITIES).filter(m => m.startsWith(modelPrefix));

    if (fallbackModels.length > 0) {
        return MODEL_CAPABILITIES[fallbackModels[0]];
    }

    // Default fallback based on provider prefix
    if (modelName.includes('gpt')) {
        return MODEL_CAPABILITIES['gpt-3.5-turbo']; // Conservative fallback
    }

    if (modelName.includes('claude')) {
        return MODEL_CAPABILITIES['claude-3-haiku-20240307']; // Conservative fallback
    }

    // No matching capabilities found
    return null;
}

/**
 * Get recommended model for specific operation type
 * @param provider The provider (openai, anthropic, etc.)
 * @param operationType The operation type
 * @returns Recommended model name, or null if no recommendation
 */
export function getRecommendedModelForOperation(
    provider: string,
    operationType: OperationType
): string | null {
    // Map operation types to categories with recommended models
    const operationToCategory: Record<OperationType, keyof typeof RECOMMENDED_MODELS> = {
        general: 'intelligence',
        similarity: 'rating',
        importance: 'rating',
        summarization: 'memory',
        abstraction: 'memory',
        clustering: 'intelligence',
        embedding: 'embedding'
    };

    const category = operationToCategory[operationType];
    const recommendations = RECOMMENDED_MODELS[category];

    if (recommendations && (provider in recommendations)) {
        // @ts-ignore - TypeScript doesn't know the provider will be a key
        return recommendations[provider];
    }

    return null;
}

/**
 * Validate the configuration
 * @param config The configuration to validate
 * @param isOperationSpecific Set to true when validating a config for a specific operation
 * @param operationType The operation type being validated (optional)
 */
export function validateConfig(
    config: LLMConfig,
    isOperationSpecific: boolean = false,
    operationType?: OperationType
): string[] {
    const errors: string[] = [];

    if (!config.apiKey) {
        errors.push(`API key is required for ${config.provider}`);
    }

    // Provider-specific validation
    switch (config.provider) {
    case 'azure-openai': {
        const azureConfig = config as AzureOpenAIConfig;
        if (!azureConfig.deploymentName) {
            errors.push('deploymentName is required for Azure OpenAI');
        }
        break;
    }
    }

    // Skip memory function validation for operation-specific configs
    // Some operations like 'embedding' don't need memory functions
    if (isOperationSpecific) {
        return errors;
    }

    // Model capability validation for general configs
    if (config.model) {
        const capabilities = getModelCapabilities(config.model);

        // If we can't determine capabilities, add a warning
        if (!capabilities) {
            errors.push(`Unknown model '${config.model}' - capabilities cannot be determined. Some features may not work correctly.`);
        }
        // If the model doesn't support memory functions, add a warning
        else if (!capabilities.supportsMemoryFunctions) {
            // Get recommended model for this provider for general operations
            const recommendedModel = getRecommendedModelForOperation(config.provider, 'general');
            const recommendation = recommendedModel
                ? ` Consider using '${recommendedModel}' instead.`
                : ' Consider using a different model for memory operations.';

            errors.push(`Model '${config.model}' does not fully support memory functions.${recommendation}`);
        }
        // For specific operations like rating, check appropriate capabilities
        else if (operationType &&
                 (operationType === 'importance' || operationType === 'similarity') &&
                 capabilities.supportsRatingFunctions === false) {
            // Get recommended model for this provider for rating operations
            const recommendedModel = getRecommendedModelForOperation(config.provider, operationType);
            const recommendation = recommendedModel
                ? ` Consider using '${recommendedModel}' instead.`
                : ' Consider using a different model for numeric rating operations.';

            errors.push(`Model '${config.model}' does not reliably support numeric outputs for ${operationType} operations.${recommendation}`);
        }
    }

    return errors;
}

/**
 * Load default configuration based on environment variables
 */
export function loadDefaultConfig(): LLMConfig {
    // First check if we have a MODELS_CONFIG defined
    const modelsConfigJson = process.env[OPERATION_MODEL_VARS.modelsConfig];
    if (modelsConfigJson) {
        try {
            // If we have a models config, we'll use that
            const operationModels = loadOperationModelsFromEnv();

            // Get the provider from the general model if present, otherwise use default
            let provider = DEFAULT_CONFIG.provider;
            const generalModel = operationModels.general;

            if (generalModel && typeof generalModel !== 'string' && generalModel.provider) {
                provider = generalModel.provider;
            }

            return createConfig({
                provider,
                operationModels
            } as Partial<LLMConfig>);
        } catch (error) {
            console.error(`Error loading from MODELS_CONFIG: ${error}`);
        }
    }

    // If no models config is defined, fall back to legacy approach
    const provider =
        process.env.LLM_PROVIDER ||
        (process.env.OPENAI_API_KEY ? 'openai' :
            process.env.ANTHROPIC_API_KEY ? 'anthropic' :
                process.env.AZURE_OPENAI_API_KEY ? 'azure-openai' :
                    DEFAULT_CONFIG.provider);

    // Load operation models and add them to the config
    const operationModels = loadOperationModelsFromEnv();

    return createConfig({
        provider,
        operationModels
    } as Partial<LLMConfig>);
}

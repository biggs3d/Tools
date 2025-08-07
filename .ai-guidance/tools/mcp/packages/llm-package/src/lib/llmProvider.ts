/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.14
 * https://github.com/biggs3d/McpMemoryServer
 */

import {
    LLMConfig,
    LLMProvider,
    CompletionOptions,
    LLMClient,
    SummarizationOptions,
    ModelCapabilities,
    OperationType
} from './types.js';
import { validateConfig, getModelCapabilities, RECOMMENDED_MODELS } from './config.js';
import { createSummarizationPrompt, createAbstractionPrompt } from './prompts/memory.js';
import { rateSimilarityPrompt, calculateImportancePrompt } from './prompts/evaluation.js';
import { clusterPrompt } from './prompts/clustering.js';

/**
 * Abstract base class for LLM providers
 */
export abstract class BaseLLMProvider implements LLMProvider {
    protected config: LLMConfig;
    protected modelCapabilities: ModelCapabilities | null;
    protected defaultModel: string;

    constructor(config: LLMConfig, isOperationSpecific: boolean = false, operationType?: OperationType) {
        this.config = config;

        // Validate the configuration, with special handling for operation-specific configs
        const errors = validateConfig(config, isOperationSpecific, operationType);
        if (errors.length > 0) {
            throw new Error(`Invalid LLM configuration: ${errors.join(', ')}`);
        }

        // Store the default model
        this.defaultModel = config.model || this.getDefaultModelForProvider();

        // Get model capabilities
        this.modelCapabilities = this.defaultModel
            ? getModelCapabilities(this.defaultModel)
            : null;

        if (this.defaultModel && !this.modelCapabilities) {
            console.warn(`Warning: Unknown model '${this.defaultModel}'. Using default capabilities.`);
        }
    }

    /**
     * Get default model for the current provider
     */
    private getDefaultModelForProvider(): string {
        const provider = this.config.provider;
        const defaultModelMap: Record<string, string> = {
            'openai': 'gpt-4o',
            'anthropic': 'claude-3-7-sonnet-latest',
            'azure-openai': 'gpt-4o'
        };

        return defaultModelMap[provider] || 'gpt-4o';
    }

    /**
     * Get appropriate model for a specific operation type
     */
    protected getModelForOperation(operationType: OperationType = 'general'): string {
        // Check if there's a specific model configured for this operation
        if (this.config.operationModels && this.config.operationModels[operationType]) {
            const modelConfig = this.config.operationModels[operationType];

            // If it's a ModelConfig object, extract the model name
            if (typeof modelConfig === 'object' && 'model' in modelConfig) {
                return modelConfig.model;
            }

            // If it's a string, use it directly
            if (typeof modelConfig === 'string') {
                return modelConfig;
            }
        }

        // If not, use the default model
        return this.defaultModel;
    }

    /**
     * Get provider for a specific operation type
     * This allows using different providers for different operations
     */
    protected getProviderForOperation(operationType: OperationType = 'general'): string {
        // Check if there's a specific model configured for this operation
        if (this.config.operationModels && this.config.operationModels[operationType]) {
            const modelConfig = this.config.operationModels[operationType];

            // If it's a ModelConfig object with a provider, use that provider
            if (typeof modelConfig === 'object' && 'provider' in modelConfig) {
                return modelConfig.provider;
            }
        }

        // If not, use the default provider
        return this.config.provider;
    }

    /**
     * Get API key for a specific operation type
     * This allows using different API keys for different operations
     */
    protected getApiKeyForOperation(operationType: OperationType = 'general'): string {
        // Check if there's a specific model configured for this operation
        if (this.config.operationModels && this.config.operationModels[operationType]) {
            const modelConfig = this.config.operationModels[operationType];

            // If it's a ModelConfig object with an apiKey, use that
            if (typeof modelConfig === 'object' && 'apiKey' in modelConfig && modelConfig.apiKey) {
                return modelConfig.apiKey;
            }
        }

        // If not, use the default API key
        return this.config.apiKey;
    }

    /**
     * Get capabilities for a specific operation model
     */
    protected getCapabilitiesForOperation(operationType: OperationType = 'general'): ModelCapabilities | null {
        const model = this.getModelForOperation(operationType);
        return getModelCapabilities(model);
    }

    /**
     * Check if the model for a specific operation supports a capability
     */
    protected supportsCapabilityForOperation(
        capability: keyof ModelCapabilities,
        operationType: OperationType = 'general'
    ): boolean {
        const capabilities = this.getCapabilitiesForOperation(operationType);

        if (!capabilities) {
            // If capabilities are unknown, assume support for backwards compatibility
            return true;
        }

        return Boolean(capabilities[capability]);
    }

    /**
     * Check if the current model supports a specific capability
     */
    protected supportsCapability(capability: keyof ModelCapabilities): boolean {
        if (!this.modelCapabilities) {
            // If capabilities are unknown, assume support for backwards compatibility
            return true;
        }

        return Boolean(this.modelCapabilities[capability]);
    }

    getProviderName(): string {
        return this.config.provider;
    }

    getModelName(operationType?: OperationType): string {
        if (operationType) {
            return this.getModelForOperation(operationType);
        }
        return this.defaultModel || 'unknown';
    }

    /**
     * Complete a prompt with the LLM
     * @param prompt The text prompt to complete
     * @param options Completion options
     * @param operationType Optional operation type (ignored in base providers)
     */
    abstract complete(prompt: string, options?: CompletionOptions, operationType?: OperationType): Promise<string>;

    /**
     * Get token count for a text (if supported by the provider)
     * @param text The text to count tokens for
     */
    async countTokens?(text: string): Promise<number>;

    /**
     * Get embeddings for a text (if supported by the provider)
     * @param text The text to embed
     */
    async getEmbedding?(text: string): Promise<number[]>;
}

/**
 * Create a provider for a specific operation from a model config
 * (Helper function to avoid circular dependencies)
 */
async function createProviderForOperation(
    operationType: OperationType,
    config: LLMConfig
): Promise<LLMProvider> {
    // Dynamically import the provider factory to avoid circular dependencies
    const { createProviderForOperation } = await import('./providerFactory.js');
    return createProviderForOperation(operationType, config);
}

/**
 * Complete LLM client implementation combining provider functionality
 * with memory-specific operations
 */
export class LLMMemoryClient implements LLMClient {
    private defaultProvider: LLMProvider;
    private providers: Record<OperationType, LLMProvider> = {} as any;
    private modelCapabilities: Record<OperationType, ModelCapabilities | null> = {} as any;
    private config: LLMConfig;
    private providersInitialized = false;
    private initializationPromise: Promise<void> | null = null;

    constructor(provider: LLMProvider, config?: LLMConfig) {
        this.defaultProvider = provider;
        this.config = config || (provider as any).config || {};

        // Initialize capabilities and providers for each operation type
        const operationTypes: OperationType[] = [
            'general', 'similarity', 'importance', 'summarization',
            'abstraction', 'clustering', 'embedding'
        ];

        // Set default provider for all operations to start
        for (const opType of operationTypes) {
            this.providers[opType] = provider;
        }

        // Initialize operation-specific providers if configuration is available
        if (this.config.operationModels && Object.keys(this.config.operationModels).length > 0) {
            // We'll initialize providers lazily to avoid circular dependencies
            this.initializationPromise = this.initializeProviders(operationTypes);
        }

        // Initialize model capabilities
        for (const opType of operationTypes) {
            const provider = this.providers[opType];
            const modelName = provider.getModelName(opType);
            this.modelCapabilities[opType] = getModelCapabilities(modelName);

            // Warn if using a model that doesn't support memory functions
            if (opType !== 'general' && opType !== 'embedding' &&
                this.modelCapabilities[opType] && !this.modelCapabilities[opType]!.supportsMemoryFunctions) {
                console.warn(`Warning: Model '${modelName}' for ${opType} operations does not fully support memory functions. Using fallbacks.`);
            }
        }

        // Also check default model
        const defaultModelName = this.defaultProvider.getModelName();
        const defaultCapabilities = getModelCapabilities(defaultModelName);

        if (defaultCapabilities && !defaultCapabilities.supportsMemoryFunctions) {
            console.warn(`Warning: Default model '${defaultModelName}' does not fully support memory functions. Some operations may fail or return unexpected results.`);
        }
    }

    /**
     * Initialize operation-specific providers
     * This is done lazily to avoid circular dependencies
     */
    private async initializeProviders(operationTypes: OperationType[]): Promise<void> {
        if (this.providersInitialized) return;

        console.log('Initializing operation-specific providers from configuration');

        // Dynamic import to avoid circular dependencies
        const { createProviderForOperation } = await import('./providerFactory.js');

        // First, let's validate our configuration to ensure we have proper API keys for each provider
        const requiredApiKeys = new Map<string, boolean>();

        if (this.config.operationModels) {
            // Check all operations to see which providers they need
            for (const [opType, modelConfig] of Object.entries(this.config.operationModels)) {
                if (typeof modelConfig === 'object' && 'provider' in modelConfig) {
                    const provider = modelConfig.provider;

                    // If the model config has an API key, we don't need to check default
                    if (modelConfig.apiKey) {
                        continue;
                    }

                    // Otherwise, mark this provider as needing an API key
                    requiredApiKeys.set(provider, true);
                }
            }

            // Check if we have all required API keys in the base config
            for (const provider of requiredApiKeys.keys()) {
                if (provider !== this.config.provider && !this.hasApiKeyForProvider(provider)) {
                    console.warn(`Warning: Operation uses provider '${provider}' but no API key is provided.`);
                    console.warn(`Operations using provider '${provider}' will fall back to the default provider.`);
                }
            }
        }

        for (const opType of operationTypes) {
            // Skip general since it's already set to the default provider
            if (opType === 'general') continue;

            // Check if this operation has a specific model config
            if (this.config.operationModels && this.config.operationModels[opType]) {
                try {
                    // Check if we should create a provider for this operation
                    const modelConfig = this.config.operationModels[opType];

                    // If it's an object with a provider field, make sure we have an API key
                    if (typeof modelConfig === 'object' && 'provider' in modelConfig) {
                        // If the provider is different from default and we're missing an API key,
                        // skip creating this provider and fall back to default
                        const provider = modelConfig.provider;
                        if (
                            provider !== this.config.provider &&
                            !modelConfig.apiKey &&
                            !this.hasApiKeyForProvider(provider)
                        ) {
                            console.warn(`Skipping ${opType} provider '${provider}' due to missing API key.`);
                            continue;
                        }
                    }

                    // Create a provider for this operation
                    const opProvider = createProviderForOperation(opType, this.config);

                    // Store in our providers map
                    this.providers[opType] = opProvider;

                    console.log(`Created ${opType} provider: ${opProvider.getProviderName()} with model ${opProvider.getModelName()}`);
                } catch (error) {
                    console.error(`Error creating provider for ${opType}:`, error);
                    console.warn(`Falling back to default provider for ${opType}`);
                    // Keep the default provider for this operation
                }
            }
        }

        this.providersInitialized = true;
    }

    /**
     * Check if we have an API key for a specific provider
     */
    private hasApiKeyForProvider(provider: string): boolean {
        // Check if we have an environment variable with the API key
        switch (provider) {
            case 'openai':
                return Boolean(process.env.OPENAI_API_KEY);
            case 'anthropic':
                return Boolean(process.env.ANTHROPIC_API_KEY);
            case 'azure-openai':
                return Boolean(process.env.AZURE_OPENAI_API_KEY);
            default:
                return false;
        }
    }

    /**
     * Ensure providers are initialized before any operation
     */
    private async ensureProvidersInitialized(): Promise<void> {
        if (!this.providersInitialized && this.initializationPromise) {
            await this.initializationPromise;
        }
    }

    /**
     * Check if the model for a specific operation supports memory functions
     */
    private supportsMemoryFunctions(operationType: OperationType = 'general'): boolean {
        const capabilities = this.modelCapabilities[operationType];

        if (!capabilities) {
            // If capabilities are unknown, assume support for backwards compatibility
            return true;
        }

        return capabilities.supportsMemoryFunctions;
    }

    // Forward base provider methods
    getProviderName(): string {
        return this.defaultProvider.getProviderName();
    }

    /**
     * Get provider for a specific operation
     */
    getProviderForOperation(operationType: OperationType = 'general'): string {
        return this.providers[operationType]?.getProviderName() ||
               this.defaultProvider.getProviderName();
    }

    getModelName(operationType?: OperationType): string {
        if (operationType) {
            return this.providers[operationType]?.getModelName(operationType) ||
                   this.defaultProvider.getModelName(operationType);
        }
        return this.defaultProvider.getModelName();
    }

    async complete(prompt: string, options?: CompletionOptions, operationType: OperationType = 'general'): Promise<string> {
        await this.ensureProvidersInitialized();
        const provider = this.providers[operationType] || this.defaultProvider;
        return provider.complete(prompt, options);
    }

    async countTokens(text: string): Promise<number> {
        await this.ensureProvidersInitialized();
        // Use the default provider for token counting
        if (this.defaultProvider.countTokens) {
            return this.defaultProvider.countTokens(text);
        }
        // Fallback: rough estimate based on words (not accurate!)
        return Math.ceil(text.split(/\s+/).length * 1.3);
    }

    async getEmbedding(text: string, dimensions?: number): Promise<number[]> {
        await this.ensureProvidersInitialized();

        // Use the embedding-specific provider if available
        const provider = this.providers['embedding'] || this.defaultProvider;

        // If the provider doesn't support embeddings but we're configured to use a different
        // provider for embeddings, try to create it on-demand (lazy init)
        if (!provider.getEmbedding && this.config.operationModels &&
            typeof this.config.operationModels.embedding === 'object') {

            try {
                const { createProviderForOperation } = await import('./providerFactory.js');
                const embeddingProvider = createProviderForOperation('embedding', this.config);
                // Cache the provider for future use
                this.providers['embedding'] = embeddingProvider;

                // Use the new provider
                if (embeddingProvider.getEmbedding) {
                    return embeddingProvider.getEmbedding(text, dimensions);
                }
            } catch (error) {
                console.error('Error creating embedding provider:', error);
                // Continue with the default provider
            }
        }

        // Use the default provider's embedding function if available
        if (provider.getEmbedding) {
            return provider.getEmbedding(text, dimensions);
        }

        throw new Error('Embeddings not supported by the provider');
    }

    // Memory-specific implementations

    /**
     * Summarize multiple observations into a cohesive set
     */
    async summarizeObservations(
        observations: string[],
        options?: SummarizationOptions
    ): Promise<string[]> {
        await this.ensureProvidersInitialized();
        if (observations.length <= 1) {
            return observations; // Nothing to summarize
        }

        const operationType: OperationType = 'summarization';

        // Check if model supports memory functions
        if (!this.supportsMemoryFunctions(operationType)) {
            console.warn('Warning: Current model does not support memory functions. Using fallback summarization.');
            // Simple fallback - just concatenate first sentences from each observation
            return observations.map(obs => {
                const firstSentence = obs.split(/[.!?](\s|$)/)[0];
                return firstSentence + (firstSentence.endsWith('.') ? '' : '.');
            });
        }

        // Handle options
        const {
            maxSummaries = Math.min(5, Math.ceil(observations.length / 3)),
            // deduplicate option is reserved for future implementation
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            deduplicate = true,
            summaryType = 'concise'
        } = options || {};

        // TODO: If deduplicate is true, we'd need to first identify similar observations
        // For now, we'll just process in batches

        // Process observations in batches
        const batchSize = Math.min(10, Math.ceil(observations.length / maxSummaries));
        const batches: string[][] = [];

        for (let i = 0; i < observations.length; i += batchSize) {
            batches.push(observations.slice(i, i + batchSize));
        }

        // Get the model capabilities for this operation
        const capabilities = this.modelCapabilities[operationType];
        const supportsTemperature = capabilities?.supportsTemperature;

        // Summarize each batch using the operation-specific model
        const summaryPromises = batches.map(async (batch) => {
            const prompt = createSummarizationPrompt(batch, summaryType);
            const result = await this.complete(
                prompt,
                {
                    systemPrompt: "You are a helpful assistant that summarizes information concisely.",
                    temperature: supportsTemperature ? 0.3 : undefined
                },
                'summarization'
            );

            // Handle empty responses
            if (!result || result.trim() === '') {
                // If no result, just join the original observations
                return `Summary of ${batch.length} observations: ` +
                       batch.map(o => o.substring(0, 50) + (o.length > 50 ? '...' : '')).join('; ');
            }

            return result;
        });

        const summaries = await Promise.all(summaryPromises);
        return summaries;
    }

    /**
     * Generate a higher-level abstraction from related observations
     */
    async generateAbstraction(observations: string[], context?: string): Promise<string> {
        await this.ensureProvidersInitialized();
        // Check if model supports memory functions
        if (!this.supportsMemoryFunctions()) {
            console.warn('Warning: Current model does not support memory functions. Using fallback abstraction.');
            return "Abstract pattern: " + observations.slice(0, 3).join(" + ") +
                   (observations.length > 3 ? " + " + (observations.length - 3) + " more observations." : "");
        }

        const prompt = createAbstractionPrompt(observations, context);
        const result = await this.complete(
            prompt,
            {
                systemPrompt: "You are a helpful assistant that identifies patterns and generates abstractions. Provide a concise summary.",
                temperature: this.modelCapabilities['abstraction']?.supportsTemperature ? 0.4 : undefined,
                maxTokens: 2056
            },
            'abstraction'
        );

        // Handle empty responses
        if (!result || result.trim() === '') {
            return "Insufficient data to form an abstraction.";
        }

        return result;
    }

    /**
     * Rate the similarity between two texts (0-1)
     */
    async rateSimilarity(text1: string, text2: string): Promise<number> {
        await this.ensureProvidersInitialized();

        // Get the model capabilities for similarity operation
        const capabilities = this.modelCapabilities['similarity'];

        // Check if the model supports rating functions or memory functions
        const supportsRating = capabilities?.supportsRatingFunctions !== false; // treat undefined as true
        const supportsMemory = this.supportsMemoryFunctions('similarity');

        if (!supportsRating || !supportsMemory) {
            // If model doesn't support either ratings or memory functions, use fallback
            console.warn('Warning: Current model does not reliably support similarity ratings. Using fallback calculation.');

            // Implement a simple word overlap score as fallback
            const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 2));
            const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 2));

            // Count overlapping words
            let overlap = 0;
            for (const word of words1) {
                if (words2.has(word)) overlap++;
            }

            // Calculate Jaccard similarity
            const totalUniqueWords = words1.size + words2.size - overlap;
            return totalUniqueWords > 0 ? overlap / totalUniqueWords : 0;
        }

        const prompt = rateSimilarityPrompt(text1, text2);

        try {
            // Only try using the LLM if the model supports ratings
            // Otherwise just use the fallback directly
            if (this.modelCapabilities['similarity']?.supportsRatingFunctions !== false) {
                const result = await this.complete(
                    prompt,
                    {
                        systemPrompt: "You are a helpful assistant that rates text similarity on a scale of 0-1. Reply ONLY with a single decimal number.",
                        maxTokens: 512, // Increased to prevent "finish_reason": "length" errors
                        temperature: this.modelCapabilities['similarity']?.supportsTemperature ? 0.2 : undefined
                    },
                    'similarity'
                );

                // Dynamically import to avoid circular dependencies
                const { extractScoreFromResponse } = await import('./utils/responseParser.js');

                // Extract the score using our utility function
                return extractScoreFromResponse(
                    result,
                    'similarity_score',
                    0.5, // default value
                    0,   // min value
                    1    // max value
                );
            } else {
                // Use fallback directly for models known not to support ratings well
                console.warn("Using fallback similarity calculation for model with limited rating capabilities");

                // Implement a simple word overlap score as fallback
                const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 2));
                const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 2));

                // Count overlapping words
                let overlap = 0;
                for (const word of words1) {
                    if (words2.has(word)) overlap++;
                }

                // Calculate Jaccard similarity
                const totalUniqueWords = words1.size + words2.size - overlap;
                return totalUniqueWords > 0 ? overlap / totalUniqueWords : 0;
            }
        } catch (error) {
            console.error("Error calculating similarity:", error);
            return 0.5; // Default middle value
        }
    }

    /**
     * Calculate importance score for content (0-10)
     */
    async calculateImportance(content: string, context?: string): Promise<number> {
        await this.ensureProvidersInitialized();

        // Get the model capabilities for importance operation
        const capabilities = this.modelCapabilities['importance'];

        // Check if the model supports rating functions or memory functions
        const supportsRating = capabilities?.supportsRatingFunctions !== false; // treat undefined as true
        const supportsMemory = this.supportsMemoryFunctions('importance');

        if (!supportsRating || !supportsMemory) {
            // If model doesn't support either ratings or memory functions, use fallback
            console.warn('Warning: Current model does not reliably support importance scoring. Using fallback calculation.');

            // Simple fallback - length-based heuristic for importance
            // Longer content with more words tends to be more important (very simple heuristic)
            const wordCount = content.split(/\s+/).length;
            return Math.min(10, Math.max(1, Math.ceil(wordCount / 20)));
        }

        const prompt = calculateImportancePrompt(content, context);

        try {
            // Only try using the LLM if the model supports ratings
            // Otherwise just use the fallback directly
            if (this.modelCapabilities['importance']?.supportsRatingFunctions !== false) {
                const result = await this.complete(
                    prompt,
                    {
                        systemPrompt: "You are a helpful assistant that rates content importance on a scale of 0-10. Reply ONLY with a single number.",
                        maxTokens: 512, // Increased to prevent "finish_reason": "length" errors
                        temperature: this.modelCapabilities['importance']?.supportsTemperature ? 0.2 : undefined
                    },
                    'importance'
                );

                // Dynamically import to avoid circular dependencies
                const { extractScoreFromResponse } = await import('./utils/responseParser.js');

                // Extract the score using our utility function
                return extractScoreFromResponse(
                    result,
                    'importance_score',
                    5,   // default value
                    0,   // min value
                    10   // max value
                );
            } else {
                // Use fallback directly for models known not to support ratings well
                console.warn("Using fallback importance calculation for model with limited rating capabilities");
                const wordCount = content.split(/\s+/).length;
                return Math.min(10, Math.max(1, Math.ceil(wordCount / 20)));
            }
        } catch (error) {
            console.error("Error calculating importance:", error);
            return 5; // Default middle value
        }
    }

    /**
     * Cluster observations by semantic similarity
     */
    async clusterObservations(observations: string[]): Promise<string[][]> {
        await this.ensureProvidersInitialized();
        if (observations.length <= 2) {
            return [observations]; // Nothing to cluster
        }

        // Check if model supports memory functions
        if (!this.supportsMemoryFunctions()) {
            console.warn('Warning: Current model does not support memory functions. Using fallback clustering.');
            // Simple fallback - split into clusters of approximately equal size
            const clusters: string[][] = [];
            const clusterSize = 3; // Simple heuristic - 3 items per cluster

            for (let i = 0; i < observations.length; i += clusterSize) {
                clusters.push(observations.slice(i, i + clusterSize));
            }

            return clusters;
        }

        const prompt = clusterPrompt(observations);
        const result = await this.complete(
            prompt,
            {
                systemPrompt: 'You are a helpful assistant that clusters related observations. Respond only with JSON in the format [[index1, index2], [index3]].',
                temperature: this.modelCapabilities['clustering']?.supportsTemperature ? 0.2 : undefined,
                maxTokens: 2056
            },
            'clustering'
        );

        // Handle empty responses
        if (!result || result.trim() === '') {
            // If empty response, return everything as one cluster
            console.log('Warning: Empty response for clustering, returning single cluster');
            return [observations];
        }

        try {
            // Dynamically import to avoid circular dependencies
            const { extractJsonFromResponse } = await import('./utils/responseParser.js');

            // Try to extract and parse the JSON cluster array
            const parsed = extractJsonFromResponse<number[][]>(result);

            if (parsed && Array.isArray(parsed) && parsed.every(Array.isArray)) {
                // Convert indices (1-based from prompt) to actual observation strings
                return parsed.map(cluster =>
                    cluster.map(index => {
                        // Adjust index (1-based -> 0-based) and handle potential strings
                        const idx = typeof index === 'number' ? index - 1 : parseInt(String(index)) - 1;
                        // Ensure index is valid
                        if (isNaN(idx) || idx < 0 || idx >= observations.length) {
                            console.warn(`Invalid observation index: ${index}`);
                            return null;
                        }
                        return observations[idx];
                    }).filter(Boolean) as string[]
                );
            }

            throw new Error('Invalid or unexpected JSON structure in response');
        } catch (error) {
            console.error('Error parsing clusters:', error);
            console.log('Raw response:', result);
            // Fallback: return all as one cluster
            return [observations];
        }
    }
}
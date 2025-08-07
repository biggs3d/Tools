/**
 * Core types for LLM integration
 */

/**
 * Model capabilities for feature compatibility
 */
export interface ModelCapabilities {
    /** Supports temperature parameter */
    supportsTemperature: boolean;
    /** Supports top_p parameter */
    supportsTopP: boolean;
    /** Supports embeddings */
    supportsEmbeddings: boolean;
    /** Supports memory functions like summarization and abstraction */
    supportsMemoryFunctions: boolean;
    /** Supports reliable numeric rating outputs (important for similarity, importance scoring) */
    supportsRatingFunctions?: boolean;
    /** Maximum context window size in tokens */
    maxContextTokens?: number;
    /** Parameter name for max tokens (max_tokens or max_completion_tokens) */
    maxTokensParam?: 'max_tokens' | 'max_completion_tokens';
}

/**
 * Operation types for specialized model selection
 */
export type OperationType = 'general' | 'similarity' | 'importance' | 'summarization' | 'abstraction' | 'clustering' | 'embedding';

/**
 * Model configuration including provider and model info
 */
export interface ModelConfig {
    /** Provider for this model (openai, anthropic, azure-openai) */
    provider: string;
    /** Model name to use */
    model: string;
    /** API key for this provider */
    apiKey?: string;
    /** Provider-specific options */
    options?: Record<string, any>;
}

/**
 * Operation-specific model selection
 */
export interface OperationModels {
    /** Default model for general operations */
    general?: string | ModelConfig;
    /** Model for similarity comparisons */
    similarity?: string | ModelConfig;
    /** Model for importance scoring */
    importance?: string | ModelConfig;
    /** Model for summarization */
    summarization?: string | ModelConfig;
    /** Model for abstraction generation */
    abstraction?: string | ModelConfig;
    /** Model for clustering */
    clustering?: string | ModelConfig;
    /** Model for embedding generation */
    embedding?: string | ModelConfig;
}

/**
 * Base configuration for all LLM providers
 */
export interface BaseLLMConfig {
    /** Provider type */
    provider: string;
    /** API key or authentication token */
    apiKey: string;
    /** Optional model to use (provider-specific) */
    model?: string;
    /** Operation-specific models (overrides the default model for specific operations) */
    operationModels?: OperationModels;
    /** Base URL for API requests (for custom endpoints) */
    baseUrl?: string;
    /** Timeout in milliseconds for API requests */
    timeoutMs?: number;
    /** Maximum concurrent requests to the LLM provider */
    maxConcurrentRequests?: number;
    /** Retry configuration */
    retry?: {
        /** Number of retries for failed requests */
        attempts: number;
        /** Base delay between retries in milliseconds */
        initialDelayMs: number;
    };
}

/**
 * Message role types
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'function';

/**
 * Message structure for chat models
 */
export interface ChatMessage {
    /** Role of the message sender */
    role: MessageRole;
    /** Content of the message */
    content: string;
    /** Name of the sender (required for function role) */
    name?: string;
    /** Function call details */
    function_call?: {
        name: string;
        arguments: string;
    };
}

/**
 * Options available for all completions
 */
export interface CompletionOptions {
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** Temperature (0-1) controlling randomness */
    temperature?: number;
    /** Top-p sampling parameter (0-1) */
    topP?: number;
    /** Whether to stream tokens as they're generated */
    stream?: boolean;
    /** System prompt to set context (not all providers support this) */
    systemPrompt?: string;
    /** Token limit safety margin - recommended 20% for large jobs */
    safetyMargin?: number;
    /** Message context to include with the prompt (e.g. for chat models) */
    context?: ChatMessage[];
}

/**
 * Provider-specific configuration types
 */
export interface OpenAIConfig extends BaseLLMConfig {
    provider: 'openai';
    model?: string; // e.g. 'gpt-4-1106-preview', 'gpt-3.5-turbo'
    organization?: string;
}

export interface AnthropicConfig extends BaseLLMConfig {
    provider: 'anthropic';
    model?: string; // e.g. 'claude-3-opus-20240229', 'claude-3-sonnet-20240229'
}

export interface AzureOpenAIConfig extends BaseLLMConfig {
    provider: 'azure-openai';
    deploymentName: string;
    apiVersion?: string;
    resourceName?: string;
}

/**
 * Union type of all possible LLM configurations
 */
export type LLMConfig = OpenAIConfig | AnthropicConfig | AzureOpenAIConfig;

/**
 * Core LLM provider interface
 */
export interface LLMProvider {
    /** Get the configured provider name */
    getProviderName(): string;

    /**
     * Get the configured model name
     * @param operationType Optional operation type to get the specific model for that operation
     */
    getModelName(operationType?: OperationType): string;

    /**
     * Basic text completion
     * @param prompt The text to complete
     * @param options Completion options
     * @param operationType Optional operation type to use a specific provider/model
     */
    complete(prompt: string, options?: CompletionOptions, operationType?: OperationType): Promise<string>;

    /**
     * Get embeddings for text
     * @param text The text to create embeddings for
     * @param dimensions Optional parameter to specify output dimensions (only works with text-embedding-3-large)
     */
    getEmbedding?(text: string, dimensions?: number): Promise<number[]>;

    /** Calculate token count for prompt */
    countTokens?(text: string): Promise<number>;
}

/**
 * Memory-specific LLM operations
 */
export interface MemoryLLMFunctions {
    /** Summarize multiple observations into a cohesive set */
    summarizeObservations(observations: string[], options?: SummarizationOptions): Promise<string[]>;

    /** Generate a higher-level abstraction from related observations */
    generateAbstraction(observations: string[], context?: string): Promise<string>;

    /** Rate the similarity between two texts (0-1) */
    rateSimilarity(text1: string, text2: string): Promise<number>;

    /** Calculate importance score for content (0-10) */
    calculateImportance(content: string, context?: string): Promise<number>;

    /** Cluster observations by semantic similarity */
    clusterObservations(observations: string[]): Promise<string[][]>;
}

/**
 * Complete LLM client with both core and memory-specific functions
 */
export interface LLMClient extends LLMProvider, MemoryLLMFunctions {}

/**
 * Options for summarization
 */
export interface SummarizationOptions {
    /** Maximum number of summaries to generate */
    maxSummaries?: number;
    /** Whether to deduplicate similar observations before summarizing */
    deduplicate?: boolean;
    /** Minimum length of generated summary */
    minLength?: number;
    /** Maximum length of generated summary */
    maxLength?: number;
    /** Type of summary to generate */
    summaryType?: 'concise' | 'detailed' | 'abstract';
}
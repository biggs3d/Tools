export class BaseProvider {
    constructor(name, config) {
        this.name = name;
        this.config = config;
        this.client = null;
        this.initialized = false;
    }
    
    // Initialize the provider (lazy loading)
    async initialize() {
        if (this.initialized) return;
        
        if (!this.config.apiKey) {
            throw new Error(`No API key configured for ${this.name}`);
        }
        
        await this.initializeClient();
        this.initialized = true;
    }
    
    // Must be implemented by subclasses
    async initializeClient() {
        throw new Error('initializeClient() must be implemented by subclass');
    }
    
    // Query the LLM with a prompt and options
    async query(prompt, options = {}) {
        await this.initialize();
        
        const model = options.model || this.config.defaultModel;
        
        // Validate model if allowlist is configured
        if (this.config.allowedModels && this.config.allowedModels.length > 0) {
            const isAllowed = await this.validateModel(model);
            if (!isAllowed) {
                throw new Error(`Model '${model}' is not allowed for ${this.name}. Allowed models: ${this.config.allowedModels.join(', ')}`);
            }
        }
        
        const timeout = this.config.timeoutMin * 60 * 1000; // Convert to milliseconds
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await this.executeQuery(prompt, model, options, controller.signal);
            
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error(`Request timed out after ${this.config.timeoutMin} minutes`);
            }
            throw this.formatError(error);
        }
    }
    
    // Must be implemented by subclasses
    async executeQuery(prompt, model, options, signal) {
        throw new Error('executeQuery() must be implemented by subclass');
    }
    
    // Validate if a model is allowed
    async validateModel(modelName) {
        if (!this.config.allowedModels || this.config.allowedModels.length === 0) {
            return true; // No restrictions
        }
        
        // Check exact match
        if (this.config.allowedModels.includes(modelName)) {
            return true;
        }
        
        // Check prefix matches for preview/experimental models
        return this.config.allowedModels.some(allowed => {
            if (allowed.endsWith('-preview') || allowed.endsWith('-exp')) {
                return modelName.startsWith(allowed.split('-')[0]);
            }
            return false;
        });
    }
    
    // Get available models (can be overridden by subclasses)
    async getAvailableModels() {
        return this.config.allowedModels || [];
    }
    
    // Generate embeddings (optional, can be overridden)
    async generateEmbeddings(texts, options = {}) {
        throw new Error(`Embeddings not supported for ${this.name}`);
    }
    
    // Format provider-specific errors into standard format
    formatError(error) {
        const formatted = new Error(`${this.name} error: ${error.message}`);
        formatted.provider = this.name;
        formatted.originalError = error;
        formatted.type = this.classifyError(error);
        return formatted;
    }
    
    // Classify error types
    classifyError(error) {
        const msg = error.message.toLowerCase();
        
        if (msg.includes('api key') || msg.includes('authentication') || msg.includes('unauthorized')) {
            return 'auth';
        }
        if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('usage')) {
            return 'quota';
        }
        if (msg.includes('model') || msg.includes('not found')) {
            return 'model';
        }
        if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
            return 'network';
        }
        if (msg.includes('timeout')) {
            return 'timeout';
        }
        
        return 'unknown';
    }
    
    // Check if provider is available
    get isAvailable() {
        return !!this.config.apiKey;
    }
}
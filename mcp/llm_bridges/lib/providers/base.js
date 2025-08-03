import Bottleneck from 'bottleneck';
import { classifyError } from '../utils/error-handler.js';
import { CONFIG } from '../config.js';

export class BaseProvider {
    constructor(name, config) {
        this.name = name;
        this.config = config;
        this.client = null;
        this.initialized = false;
        this.limiter = null;
        
        // Set up rate limiter if configured
        if (CONFIG.rateLimiting.requestsPerMinute > 0) {
            this.limiter = new Bottleneck({
                minTime: 60000 / CONFIG.rateLimiting.requestsPerMinute,
                maxConcurrent: 1
            });
        }
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
        
        // Apply rate limiting if configured
        const executeWithTimeout = async () => {
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
        };
        
        // Execute with rate limiting if enabled
        if (this.limiter) {
            return await this.limiter.schedule(executeWithTimeout);
        } else {
            return await executeWithTimeout();
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
        formatted.type = classifyError(error);
        return formatted;
    }
    
    // Check if provider is available
    get isAvailable() {
        return !!this.config.apiKey;
    }
}
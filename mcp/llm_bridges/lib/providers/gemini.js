import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseProvider } from './base.js';

export class GeminiProvider extends BaseProvider {
    constructor(config) {
        super('gemini', config);
        this.modelCache = {
            models: [],
            lastFetch: 0,
            ttl: 3600000, // 1 hour
        };
    }
    
    async initializeClient() {
        this.client = new GoogleGenerativeAI(this.config.apiKey);
    }
    
    async executeQuery(prompt, model, options, signal) {
        const genModel = this.client.getGenerativeModel({ 
            model,
            generationConfig: {
                temperature: options.temperature,
                topP: options.topP,
                maxOutputTokens: options.maxTokens,
            }
        });
        
        // Handle iterative refinement if enabled
        if (options.enableIterative ?? this.config.enableIterativeRefinement) {
            return await this.queryWithIterativeRefinement(genModel, prompt, signal);
        }
        
        const result = await genModel.generateContent(prompt);
        const response = await result.response;
        return response.text();
    }
    
    async queryWithIterativeRefinement(model, prompt, signal) {
        // Initial query
        const initialPrompt = `${prompt}\n\nPlease provide a comprehensive response. If there are multiple aspects to cover, structure your response clearly.`;
        
        const initialResult = await model.generateContent(initialPrompt);
        const initialResponse = await initialResult.response;
        const initialText = initialResponse.text();
        
        // Refinement query
        const refinementPrompt = `Based on your previous response:
${initialText}

Please review and enhance your response by:
1. Adding any missing important details
2. Correcting any potential inaccuracies
3. Improving clarity and structure
4. Ensuring completeness

Provide the enhanced version:`;
        
        const refinedResult = await model.generateContent(refinementPrompt);
        const refinedResponse = await refinedResult.response;
        return refinedResponse.text();
    }
    
    async getAvailableModels() {
        // Use cached models if available and fresh
        const now = Date.now();
        if (this.modelCache.models.length > 0 && 
            (now - this.modelCache.lastFetch) < this.modelCache.ttl) {
            return this.modelCache.models;
        }
        
        // If auto-fetch is disabled, return allowed models
        if (!this.config.autoFetchModels) {
            return this.config.allowedModels || [];
        }
        
        try {
            // Fetch models from API
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
                headers: {
                    'x-goog-api-key': this.config.apiKey,
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.statusText}`);
            }
            
            const data = await response.json();
            const models = data.models
                .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
                .map(m => m.name.replace('models/', ''))
                .sort();
            
            // Update cache
            this.modelCache.models = models;
            this.modelCache.lastFetch = now;
            
            return models;
        } catch (error) {
            console.warn(`Failed to fetch Gemini models: ${error.message}`);
            return this.config.allowedModels || [];
        }
    }
    
    async generateEmbeddings(texts, options = {}) {
        await this.initialize();
        
        const model = options.model || this.config.embeddingModel;
        const batchSize = options.batchSize || 10;
        
        const embeddings = [];
        
        // Process in batches
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchEmbeddings = await Promise.all(
                batch.map(text => this.generateSingleEmbedding(text, model))
            );
            embeddings.push(...batchEmbeddings);
        }
        
        return embeddings;
    }
    
    async generateSingleEmbedding(text, model) {
        const embeddingModel = this.client.getGenerativeModel({ model });
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
    }
}
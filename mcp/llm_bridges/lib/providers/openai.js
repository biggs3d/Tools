import OpenAI from 'openai';
import { BaseProvider } from './base.js';

export class OpenAIProvider extends BaseProvider {
    constructor(config) {
        super('openai', config);
    }
    
    async initializeClient() {
        this.client = new OpenAI({
            apiKey: this.config.apiKey,
            organization: this.config.organizationId || undefined,
        });
    }
    
    async executeQuery(prompt, model, options, signal) {
        // Handle o1/o3 models differently (they have specific requirements)
        const isReasoningModel = model.startsWith('o1') || model.startsWith('o3');
        
        const messages = [
            {
                role: 'user',
                content: prompt
            }
        ];
        
        const requestOptions = {
            model,
            messages,
        };
        
        // Reasoning models don't support these parameters
        if (!isReasoningModel) {
            if (options.temperature !== undefined) requestOptions.temperature = options.temperature;
            if (options.topP !== undefined) requestOptions.top_p = options.topP;
            if (options.maxTokens !== undefined) requestOptions.max_tokens = options.maxTokens;
        }
        
        // OpenAI SDK accepts signal via options parameter
        const completion = await this.client.chat.completions.create(requestOptions, {
            signal: signal
        });
        
        return completion.choices[0].message.content;
    }
    
    async getAvailableModels() {
        try {
            const models = await this.client.models.list();
            const chatModels = [];
            
            for await (const model of models) {
                // Filter for chat models
                if (model.id.includes('gpt') || 
                    model.id.startsWith('o1') || 
                    model.id.startsWith('o3')) {
                    chatModels.push(model.id);
                }
            }
            
            return chatModels.sort();
        } catch (error) {
            console.warn(`Failed to fetch OpenAI models: ${error.message}`);
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
            
            const response = await this.client.embeddings.create({
                model,
                input: batch,
                dimensions: options.dimensions, // Optional dimension reduction
            });
            
            embeddings.push(...response.data.map(item => item.embedding));
        }
        
        return embeddings;
    }
}
import { BaseProvider } from './base.js';

export class GrokProvider extends BaseProvider {
    constructor(config) {
        super('grok', config);
    }
    
    async initializeClient() {
        // Grok uses OpenAI-compatible API, but we'll use fetch directly
        // to avoid dependency issues and have more control
        this.baseUrl = this.config.apiBaseUrl || 'https://api.x.ai/v1';
    }
    
    async executeQuery(prompt, model, options, signal) {
        const messages = [
            {
                role: 'user',
                content: prompt
            }
        ];
        
        const requestBody = {
            model,
            messages,
            stream: false,
        };
        
        // Add optional parameters
        if (options.temperature !== undefined) requestBody.temperature = options.temperature;
        if (options.topP !== undefined) requestBody.top_p = options.topP;
        if (options.maxTokens !== undefined) requestBody.max_tokens = options.maxTokens;
        
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
            },
            body: JSON.stringify(requestBody),
            signal,
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || response.statusText;
            throw new Error(`Grok API error: ${errorMessage}`);
        }
        
        const data = await response.json();
        return data.choices[0].message.content;
    }
    
    async getAvailableModels() {
        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                headers: {
                    'Authorization': `Bearer ${this.config.apiKey}`,
                }
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch models: ${response.statusText}`);
            }
            
            const data = await response.json();
            const chatModels = data.data
                .filter(model => model.id.includes('grok'))
                .map(model => model.id)
                .sort();
            
            return chatModels;
        } catch (error) {
            console.warn(`Failed to fetch Grok models: ${error.message}`);
            return this.config.allowedModels || [];
        }
    }
    
    // Grok doesn't support embeddings yet
    async generateEmbeddings(texts, options = {}) {
        throw new Error('Embeddings not yet supported for Grok');
    }
}
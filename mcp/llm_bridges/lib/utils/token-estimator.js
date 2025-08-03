import { CONFIG } from '../config.js';
import { encoding_for_model, get_encoding } from 'tiktoken';

// Cache encoders for performance
const encoderCache = new Map();

// Get the appropriate encoder for a provider/model
function getEncoder(provider, model) {
    const cacheKey = `${provider}:${model}`;
    
    if (encoderCache.has(cacheKey)) {
        return encoderCache.get(cacheKey);
    }
    
    let encoder;
    
    try {
        // Try to get model-specific encoder
        if (model) {
            encoder = encoding_for_model(model);
        } else {
            throw new Error('No model specified, use default encoding');
        }
    } catch (error) {
        // Fall back to provider-specific defaults
        switch (provider) {
            case 'openai':
                // cl100k_base is used by GPT-4, GPT-3.5-turbo, text-embedding-ada-002
                encoder = get_encoding('cl100k_base');
                break;
            case 'gemini':
                // Gemini uses similar tokenization to GPT models
                encoder = get_encoding('cl100k_base');
                break;
            case 'grok':
                // Grok likely uses similar tokenization
                encoder = get_encoding('cl100k_base');
                break;
            default:
                // Default to cl100k_base
                encoder = get_encoding('cl100k_base');
        }
    }
    
    encoderCache.set(cacheKey, encoder);
    return encoder;
}

// Estimate tokens for a string with tiktoken
export function estimateTokens(text, provider = 'openai', model = null) {
    if (!text) return 0;
    
    try {
        const encoder = getEncoder(provider, model);
        const tokens = encoder.encode(text);
        const tokenCount = tokens.length;
        
        // Apply buffer for safety (formatting, special tokens, etc.)
        return Math.ceil(tokenCount * CONFIG.shared.tokenEstimationBuffer);
    } catch (error) {
        // Fallback to character-based estimation if tiktoken fails
        console.warn('Tiktoken encoding failed, using character-based estimation:', error.message);
        const charCount = text.length;
        const baseTokens = Math.ceil(charCount / CONFIG.shared.charsPerToken);
        return Math.ceil(baseTokens * CONFIG.shared.tokenEstimationBuffer);
    }
}

// Estimate tokens for multiple files
export function estimateFileTokens(files, provider = 'openai', model = null) {
    let totalTokens = 0;
    
    for (const file of files) {
        // Add tokens for file path/header
        totalTokens += estimateTokens(`File: ${file.path}\n`, provider, model);
        
        // Add tokens for content
        totalTokens += estimateTokens(file.content, provider, model);
        
        // Add some buffer for formatting
        totalTokens += 10;
    }
    
    return totalTokens;
}

// Estimate total context size
export function estimateTotalTokens(files, prompt, projectContext, provider = 'openai', model = null) {
    let total = 0;
    
    // File tokens
    if (files && files.length > 0) {
        total += estimateFileTokens(files, provider, model);
    }
    
    // Prompt tokens
    if (prompt) {
        total += estimateTokens(prompt, provider, model);
    }
    
    // Project context tokens
    if (projectContext) {
        total += estimateTokens(projectContext, provider, model);
    }
    
    // Add buffer for response
    total += 1000;
    
    return total;
}

// Optimize context to fit within token limits
export function optimizeContext(files, maxTokens, provider = 'openai', model = null) {
    if (!files || files.length === 0) return [];
    
    // Sort files by importance (smaller files first, assuming they're more relevant)
    const sortedFiles = [...files].sort((a, b) => a.size - b.size);
    
    const optimizedFiles = [];
    let currentTokens = 0;
    
    for (const file of sortedFiles) {
        const fileTokens = estimateTokens(`File: ${file.path}\n${file.content}\n`, provider, model);
        
        if (currentTokens + fileTokens <= maxTokens * 0.8) { // Leave 20% buffer
            optimizedFiles.push(file);
            currentTokens += fileTokens;
        } else {
            // Try to include a truncated version
            const availableTokens = Math.floor((maxTokens * 0.8) - currentTokens);
            if (availableTokens > 1000) { // Only include if we have reasonable space
                const truncatedContent = truncateToTokens(file.content, availableTokens - 100, provider, model);
                optimizedFiles.push({
                    ...file,
                    content: truncatedContent + '\n\n[... truncated due to size constraints ...]',
                    truncated: true,
                });
                break;
            }
        }
    }
    
    return optimizedFiles;
}

// Truncate text to approximately fit within token limit
export function truncateToTokens(text, maxTokens, provider = 'openai', model = null) {
    try {
        const encoder = getEncoder(provider, model);
        const tokens = encoder.encode(text);
        
        if (tokens.length <= maxTokens) {
            return text;
        }
        
        // Truncate tokens and decode back to text
        const truncatedTokens = tokens.slice(0, maxTokens);
        const truncatedText = encoder.decode(truncatedTokens);
        
        // Try to truncate at a reasonable boundary
        const lastNewline = truncatedText.lastIndexOf('\n');
        if (lastNewline > truncatedText.length * 0.8) {
            return truncatedText.substring(0, lastNewline);
        }
        
        return truncatedText;
    } catch (error) {
        // Fallback to character-based truncation
        const estimatedChars = maxTokens * CONFIG.shared.charsPerToken;
        
        if (text.length <= estimatedChars) {
            return text;
        }
        
        // Try to truncate at a reasonable boundary
        let truncateAt = estimatedChars;
        
        // Look for a newline near the truncation point
        const newlineIndex = text.lastIndexOf('\n', truncateAt);
        if (newlineIndex > truncateAt * 0.8) {
            truncateAt = newlineIndex;
        }
        
        return text.substring(0, truncateAt);
    }
}

// Format token count for display
export function formatTokenCount(tokens) {
    if (tokens < 1000) {
        return `${tokens} tokens`;
    }
    return `${(tokens / 1000).toFixed(1)}k tokens`;
}
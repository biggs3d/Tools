// Unified error handling for all providers

export class BridgeError extends Error {
    constructor(message, provider, type, originalError) {
        super(message);
        this.name = 'BridgeError';
        this.provider = provider;
        this.type = type;
        this.originalError = originalError;
        this.suggestions = [];
    }
}

// Create a smart error with suggestions
export function createSmartError(error, context = {}) {
    const errorType = classifyError(error);
    const suggestions = getSuggestionsForError(errorType, context);
    
    const smartError = new BridgeError(
        error.message,
        error.provider || 'unknown',
        errorType,
        error
    );
    
    smartError.suggestions = suggestions;
    return smartError;
}

// Classify error types
export function classifyError(error) {
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
    if (msg.includes('token') || msg.includes('context')) {
        return 'context_size';
    }
    
    return 'unknown';
}

// Get suggestions based on error type
export function getSuggestionsForError(errorType, context) {
    const suggestions = {
        auth: [
            'Check that your API key is correctly set in the .env file',
            'Ensure the API key has not expired or been revoked',
            'Verify you\'re using the correct environment variable name',
        ],
        quota: [
            'Check your API usage limits and billing status',
            'Consider using a smaller model or reducing context size',
            'Wait a few minutes if you\'ve hit rate limits',
        ],
        model: [
            'Verify the model name is correct',
            'Check if the model is available in your region',
            'Try using the default model instead',
            'Check the allowed models in your .env configuration',
        ],
        network: [
            'Check your internet connection',
            'Verify any proxy or firewall settings',
            'Try again in a few moments',
        ],
        timeout: [
            'The request took too long - try with less context',
            'Consider using a faster model',
            'Increase the timeout in your .env file',
        ],
        context_size: [
            'Reduce the number of files included',
            'Use the estimate_context tool to check sizes',
            'Consider using a model with larger context window',
        ],
        unknown: [
            'Check the error details above',
            'Verify your configuration in .env',
            'Try with a simpler request first',
        ],
    };
    
    const baseSuggestions = suggestions[errorType] || suggestions.unknown;
    
    // Add context-specific suggestions
    if (context.files && context.files > 10) {
        baseSuggestions.push('Consider reducing the number of files');
    }
    
    if (context.estimatedTokens && context.maxTokens) {
        baseSuggestions.push(
            `Current request: ~${context.estimatedTokens.toLocaleString()} tokens`,
            `Maximum allowed: ${context.maxTokens.toLocaleString()} tokens`
        );
    }
    
    return baseSuggestions;
}

// Format error for display
export function formatErrorResponse(error) {
    const errorType = error.type || classifyError(error);
    const provider = error.provider || 'Unknown';
    
    let response = `❌ ${provider} Error: ${error.message}\n`;
    response += `Type: ${errorType}\n\n`;
    
    if (error.suggestions && error.suggestions.length > 0) {
        response += '**Suggestions:**\n';
        response += error.suggestions.map(s => `- ${s}`).join('\n');
    }
    
    return response;
}

// Handle multiple provider errors
export function formatMultipleErrors(results, providers) {
    const responses = [];
    
    for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const provider = providers[i];
        
        if (result.status === 'rejected') {
            responses.push(`### ${provider.name}\n${formatErrorResponse(result.reason)}`);
        }
    }
    
    return responses.join('\n\n');
}
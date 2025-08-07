/**
 * Token counting utilities for LLM providers
 */

/**
 * Simplified token counting algorithm based on GPT tokenization rules
 *
 * Note: This is an approximation. For production use, consider using:
 * - OpenAI: tiktoken (https://github.com/openai/tiktoken)
 * - Anthropic: their official tokenizers
 *
 * The approach used here is a simplified version that works well enough
 * for most use cases without introducing dependencies.
 */
export function estimateTokenCount(text: string): number {
    if (!text) return 0;

    // 1. Simple whitespace/punctuation splitting (works for English)
    // Average ratio of tokens to words is around 1.3
    const words = text.trim().split(/\s+/);
    const wordCount = words.length;

    // 2. Count punctuation as separate tokens (GPT-like models typically do this)
    const punctuationCount = (text.match(/[.,!?;:(){}[\]"'`~@#$%^&*+\-=<>/\\|]/g) || []).length;

    // 3. Count numbers and special patterns
    const digitGroups = (text.match(/\d+/g) || []).length;

    // 4. Count uppercase letters after lowercase or whitespace (camelCase/PascalCase)
    const camelCaseCount = (text.match(/[a-z][A-Z]/g) || []).length;

    // 5. Apply a model-specific multiplier
    // This number has been calibrated against OpenAI's cl100k_base tokenizer results
    // for typical English text with code
    const baseTokenCount = wordCount + punctuationCount + digitGroups + camelCaseCount;
    const tokenMultiplier = 1.25;

    return Math.ceil(baseTokenCount * tokenMultiplier);
}

/**
 * Provider-specific token counting functions
 */

/**
 * Estimate tokens for OpenAI models
 */
export function estimateOpenAITokens(text: string, _model?: string): number {
    // For OpenAI, different models have slightly different tokenizers
    // GPT-4 and beyond use cl100k_base (more efficient than older models)
    // This simple estimator doesn't distinguish between models
    return estimateTokenCount(text);
}

/**
 * Estimate tokens for Anthropic models
 */
export function estimateAnthropicTokens(text: string, _model?: string): number {
    // Claude tokenizers are slightly different from OpenAI
    // They typically use a few more tokens for the same text
    // Apply a small adjustment factor
    return Math.ceil(estimateTokenCount(text) * 1.05);
}

/**
 * Estimate tokens based on provider type
 */
export function estimateTokensByProvider(
    text: string,
    provider: 'openai' | 'anthropic' | 'azure-openai' | string,
    model?: string
): number {
    switch (provider) {
    case 'openai':
    case 'azure-openai':
        return estimateOpenAITokens(text, model);
    case 'anthropic':
        return estimateAnthropicTokens(text, model);
    default:
        return estimateTokenCount(text);
    }
}
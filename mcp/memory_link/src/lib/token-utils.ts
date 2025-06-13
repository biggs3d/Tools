/**
 * Token estimation and response management utilities
 */

import { encoding_for_model, TiktokenModel } from 'tiktoken';
import type { CleanMemoryRecord, CleanMemorySearchResult } from '@mcp/shared-types';
import { MCPResponseConfig } from '../config.js';

// Lazy-loaded tokenizer
let tokenizer: ReturnType<typeof encoding_for_model> | null = null;
let currentModel: string | null = null;

/**
 * Get or create tokenizer based on model name
 */
function getTokenizer(modelName?: string): ReturnType<typeof encoding_for_model> | null {
    // For Gemini models, we'll use estimation instead of tiktoken
    if (modelName?.includes('gemini')) {
        return null;
    }
    
    // For Claude/Anthropic models, use cl100k_base (GPT-4 tokenizer as closest approximation)
    const tiktokenModel: TiktokenModel = 'gpt-3.5-turbo';
    
    if (!tokenizer || currentModel !== tiktokenModel) {
        try {
            tokenizer = encoding_for_model(tiktokenModel);
            currentModel = tiktokenModel;
        } catch (error) {
            console.error('Failed to initialize tokenizer:', error);
            return null;
        }
    }
    
    return tokenizer;
}

/**
 * Estimate tokens for Gemini models
 * Based on Google's documentation: ~4 characters per token is a reasonable estimate
 */
function estimateGeminiTokens(text: string): number {
    // Gemini uses similar tokenization to other LLMs
    // Conservative estimate: ~3.5 characters per token for better safety margin
    return Math.ceil(text.length / 3.5);
}

/**
 * Count exact tokens in a string
 */
export function countTokens(text: string, modelName?: string): number {
    const tokenizer = getTokenizer(modelName);
    
    if (!tokenizer) {
        // Use estimation for Gemini or if tokenizer fails
        return estimateGeminiTokens(text);
    }
    
    try {
        return tokenizer.encode(text).length;
    } catch (error) {
        // Fallback to estimation if tiktoken fails
        console.error('Token counting failed, using estimation:', error);
        return estimateGeminiTokens(text);
    }
}

/**
 * Count tokens for a JSON object
 */
export function countObjectTokens(obj: any, modelName?: string): number {
    const jsonString = JSON.stringify(obj, null, 2);
    return countTokens(jsonString, modelName);
}

/**
 * Create a content snippet with ellipsis
 */
export function createSnippet(content: string, maxLength: number = 200): string {
    if (content.length <= maxLength) {
        return content;
    }
    
    // Try to break at a sentence boundary first
    const truncated = content.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');
    
    const breakPoint = Math.max(lastPeriod, lastNewline);
    
    if (breakPoint > maxLength * 0.6) {
        return truncated.substring(0, breakPoint + 1).trim() + '...';
    }
    
    // Fall back to word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.8) {
        return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
}

/**
 * Memory summary for compact representation
 */
export interface MemorySummary {
    id: string;
    contentSnippet: string;
    importance: number;
    tags: string[];
    similarity?: number;
    isConsolidated?: boolean;
    relatedCount?: number;
    tokenCount?: number;  // Original memory token count
}

/**
 * Create a summary for a memory record
 */
export function createMemorySummary(
    memory: CleanMemoryRecord | CleanMemorySearchResult, 
    snippetLength: number = 200,
    modelName?: string
): MemorySummary {
    const summary: MemorySummary = {
        id: memory.id,
        contentSnippet: createSnippet(memory.content, snippetLength),
        importance: memory.importance,
        tags: memory.tags,
        isConsolidated: memory.isConsolidated,
        relatedCount: memory.relatedCount,
        tokenCount: countTokens(memory.content, modelName)
    };
    
    // Include similarity score if present
    if ('similarity' in memory && memory.similarity !== undefined) {
        summary.similarity = memory.similarity;
    }
    
    return summary;
}

/**
 * Response builder that respects token limits
 */
export interface TokenAwareResponse {
    summaries: MemorySummary[];
    fullMemories: (CleanMemoryRecord | CleanMemorySearchResult)[];
    totalFound: number;
    truncated: boolean;
    tokenCount: number;
}

/**
 * Build a token-aware response for memory recall
 */
export function buildTokenAwareResponse(
    memories: (CleanMemoryRecord | CleanMemorySearchResult)[],
    config: MCPResponseConfig,
    modelName?: string
): TokenAwareResponse {
    const effectiveLimit = config.tokenLimit - config.tokenBuffer;
    const response: TokenAwareResponse = {
        summaries: [],
        fullMemories: [],
        totalFound: memories.length,
        truncated: false,
        tokenCount: 0
    };
    
    // Start with base response structure tokens
    let currentTokens = countTokens(JSON.stringify({
        totalFound: memories.length,
        truncated: false,
        message: ''
    }), modelName);
    
    // First pass: try to include full memories for high-importance ones
    const sortedMemories = [...memories].sort((a, b) => {
        // Sort by similarity first if available, then importance
        if ('similarity' in a && 'similarity' in b && a.similarity && b.similarity) {
            return b.similarity - a.similarity;
        }
        return b.importance - a.importance;
    });
    
    for (const memory of sortedMemories) {
        const memoryTokens = countObjectTokens(memory, modelName);
        
        // Include full memory if it's high importance/similarity and we have space
        const isHighValue = memory.importance >= 8 || 
                          ('similarity' in memory && memory.similarity && memory.similarity >= 0.85);
        
        if (isHighValue && currentTokens + memoryTokens < effectiveLimit * config.fullMemoryTokenThreshold) {
            response.fullMemories.push(memory);
            currentTokens += memoryTokens;
        } else {
            // Add summary instead
            const summary = createMemorySummary(memory, 200, modelName);
            const summaryTokens = countObjectTokens(summary, modelName);
            
            if (currentTokens + summaryTokens < effectiveLimit) {
                response.summaries.push(summary);
                currentTokens += summaryTokens;
            } else {
                // We've hit the limit
                response.truncated = true;
                break;
            }
        }
    }
    
    response.tokenCount = currentTokens;
    return response;
}

/**
 * Format the token-aware response for MCP
 */
export function formatTokenAwareResponse(response: TokenAwareResponse): string {
    const parts: string[] = [];
    
    // Header
    parts.push(`Found ${response.totalFound} memories.`);
    
    if (response.truncated) {
        parts.push(`(Showing ${response.fullMemories.length + response.summaries.length} due to token limits)`);
    }
    
    // Full memories section
    if (response.fullMemories.length > 0) {
        parts.push('\n## Full Memories (High Relevance):');
        response.fullMemories.forEach(memory => {
            parts.push(`\n### Memory ${memory.id}`);
            parts.push(`- Importance: ${memory.importance}/10`);
            parts.push(`- Tags: ${memory.tags.join(', ')}`);
            if ('similarity' in memory && memory.similarity !== undefined && memory.similarity !== null) {
                parts.push(`- Similarity: ${(memory.similarity * 100).toFixed(1)}%`);
            }
            parts.push(`\nContent:\n${memory.content}`);
        });
    }
    
    // Summaries section
    if (response.summaries.length > 0) {
        parts.push('\n## Memory Summaries:');
        parts.push('(Use get_memory with the ID to see full content)\n');
        
        response.summaries.forEach(summary => {
            parts.push(`- **${summary.id}** (${summary.importance}/10)`);
            if (summary.similarity !== undefined && summary.similarity !== null) {
                parts.push(`  Similarity: ${(summary.similarity * 100).toFixed(1)}%`);
            }
            parts.push(`  Tags: ${summary.tags.join(', ')}`);
            parts.push(`  Snippet: "${summary.contentSnippet}"`);
            if (summary.tokenCount && summary.tokenCount > 500) {
                parts.push(`  (${summary.tokenCount} tokens)`);
            }
            parts.push('');
        });
    }
    
    // Footer with guidance
    if (response.truncated) {
        parts.push('\nNote: Results truncated to fit token limits. Use more specific queries or filters to narrow results.');
    }
    
    return parts.join('\n');
}

/**
 * Clean up tokenizer resources
 */
export function cleanup(): void {
    if (tokenizer) {
        try {
            tokenizer.free();
            tokenizer = null;
            currentModel = null;
        } catch (error) {
            // Ignore cleanup errors
        }
    }
}
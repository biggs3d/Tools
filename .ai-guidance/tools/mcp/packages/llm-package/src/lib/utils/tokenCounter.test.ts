/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect } from 'vitest';
import {
    estimateTokenCount, 
    estimateOpenAITokens,
    estimateAnthropicTokens,
    estimateTokensByProvider
} from './tokenCounter.js';

describe('Token Counter Utils', () => {
    it('should handle empty input', () => {
        expect(estimateTokenCount('')).toBe(0);
        expect(estimateTokenCount(null as any)).toBe(0);
        expect(estimateTokenCount(undefined as any)).toBe(0);
    });
    
    it('should estimate tokens based on words and punctuation', () => {
        const text = 'This is a test. It has some punctuation!';
        const count = estimateTokenCount(text);
        
        // 7 words + 2 punctuation marks, with multiplier
        expect(count).toBeGreaterThan(7);
    });
    
    it('should count numbers as separate tokens', () => {
        const textWithNumbers = 'The numbers 123 and 456 are tokens';
        const textWithoutNumbers = 'The numbers and are tokens';
        
        expect(estimateTokenCount(textWithNumbers)).toBeGreaterThan(estimateTokenCount(textWithoutNumbers));
    });
    
    it('should handle camelCase and PascalCase', () => {
        const camelCase = 'thisIsCamelCase withMultipleWords';
        const regular = 'this is regular with multiple words';
        
        expect(estimateTokenCount(camelCase)).toBeGreaterThan(estimateTokenCount(regular));
    });
    
    it('should use provider-specific estimation', () => {
        const text = 'This is a test of provider-specific token counting.';
        
        const openaiCount = estimateOpenAITokens(text);
        const anthropicCount = estimateAnthropicTokens(text);
        
        // Anthropic should estimate slightly higher token count
        expect(anthropicCount).toBeGreaterThan(openaiCount);
    });
    
    it('should route to the correct estimator based on provider', () => {
        const text = 'Provider-specific token counting test';
        
        const openaiCount = estimateTokensByProvider(text, 'openai');
        const anthropicCount = estimateTokensByProvider(text, 'anthropic');
        const azureCount = estimateTokensByProvider(text, 'azure-openai');
        const defaultCount = estimateTokensByProvider(text, 'unknown-provider');
        
        expect(azureCount).toEqual(openaiCount);
        expect(anthropicCount).toBeGreaterThan(openaiCount);
        expect(defaultCount).toEqual(estimateTokenCount(text));
    });
});
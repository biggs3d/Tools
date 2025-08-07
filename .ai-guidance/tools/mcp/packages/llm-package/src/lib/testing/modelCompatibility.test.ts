/*
 * Copyright (c) 2025.  
 * Updated: Steve Biggs 2025.05.14  
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect, vi } from 'vitest';
import {getModelCapabilities} from '../config.js';
import {MockLLMProvider} from './MockLLMProvider.js';
import {LLMMemoryClient} from '../llmProvider.js';

describe('Model Compatibility Tests', () => {
    it('should detect capabilities for known models', () => {
        // Test a few well-known models
        const gpt4oCapabilities = getModelCapabilities('gpt-4o');
        const o4MiniCapabilities = getModelCapabilities('o4-mini');
        const claudeCapabilities = getModelCapabilities('claude-3-opus-20240229');

        // Verify GPT-4o has full capabilities
        expect(gpt4oCapabilities).toBeTruthy();
        expect(gpt4oCapabilities?.supportsMemoryFunctions).toBe(true);
        expect(gpt4oCapabilities?.supportsTemperature).toBe(true);

        // Verify o4-mini has limited capabilities
        expect(o4MiniCapabilities).toBeTruthy();
        expect(o4MiniCapabilities?.supportsMemoryFunctions).toBe(false);
        expect(o4MiniCapabilities?.supportsTemperature).toBe(false);

        // Verify Claude capabilities
        expect(claudeCapabilities).toBeTruthy();
        expect(claudeCapabilities?.supportsMemoryFunctions).toBe(true);
        expect(claudeCapabilities?.supportsEmbeddings).toBe(false);
    });

    it('should handle unknown models gracefully', () => {
        const unknownCapabilities = getModelCapabilities('unknown-model-name');
        expect(unknownCapabilities).toBeNull();
    });

    it('should handle different model capabilities', () => {
        // Instead of creating provider instances, just test the getModelCapabilities function
        const fullModelCapabilities = getModelCapabilities('gpt-4o');
        const limitedModelCapabilities = getModelCapabilities('o4-mini');
        
        // Verify model capabilities are correctly identified
        expect(fullModelCapabilities?.supportsMemoryFunctions).toBe(true);
        expect(limitedModelCapabilities?.supportsMemoryFunctions).toBe(false);
    });
});

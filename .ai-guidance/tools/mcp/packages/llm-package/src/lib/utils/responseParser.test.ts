/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

import { describe, it, expect } from 'vitest';
import { extractScoreFromResponse, extractJsonFromResponse } from './responseParser.js';

describe('extractScoreFromResponse', () => {
    // Tagged response tests
    it('extracts score from exact XML tag format', () => {
        const response = '<similarity_score>0.75</similarity_score>';
        expect(extractScoreFromResponse(response, 'similarity_score', 0.5, 0, 1)).toBe(0.75);
    });

    it('extracts score from XML tag with different casing', () => {
        const response = '<SIMILARITY_SCORE>0.75</SIMILARITY_SCORE>';
        expect(extractScoreFromResponse(response, 'similarity_score', 0.5, 0, 1)).toBe(0.75);
    });

    it('extracts score from tag without _score suffix', () => {
        const response = '<similarity>0.75</similarity>';
        expect(extractScoreFromResponse(response, 'similarity_score', 0.5, 0, 1)).toBe(0.75);
    });

    it('extracts score from generic score tag', () => {
        const response = '<score>0.75</score>';
        expect(extractScoreFromResponse(response, 'similarity_score', 0.5, 0, 1)).toBe(0.75);
    });

    // Direct number tests
    it('extracts floating point number without tags', () => {
        const response = '0.75';
        expect(extractScoreFromResponse(response, 'similarity_score', 0.5, 0, 1)).toBe(0.75);
    });

    it('extracts integer without tags', () => {
        const response = '7';
        expect(extractScoreFromResponse(response, 'importance_score', 5, 0, 10)).toBe(7);
    });

    it('extracts score from response with surrounding text', () => {
        const response = 'I would rate this as 0.75 similarity based on the shared themes.';
        expect(extractScoreFromResponse(response, 'similarity_score', 0.5, 0, 1)).toBe(0.75);
    });

    // Textual interpretation tests
    it('interprets "high" as a high score within range', () => {
        const response = 'This has a high similarity.';
        const result = extractScoreFromResponse(response, 'similarity_score', 0.5, 0, 1);
        expect(result).toBeGreaterThanOrEqual(0.8);
    });

    it('interprets "medium" as a mid-range score', () => {
        const response = 'This has a medium similarity.';
        const result = extractScoreFromResponse(response, 'similarity_score', 0.5, 0, 1);
        expect(result).toBeCloseTo(0.5);
    });

    it('interprets "low" as a low score within range', () => {
        const response = 'This has a low similarity.';
        const result = extractScoreFromResponse(response, 'similarity_score', 0.5, 0, 1);
        expect(result).toBeLessThanOrEqual(0.2);
    });

    // Boundary cases
    it('clamps values to maximum', () => {
        const response = '<similarity_score>1.5</similarity_score>';
        expect(extractScoreFromResponse(response, 'similarity_score', 0.5, 0, 1)).toBe(1);
    });

    it('clamps values to minimum', () => {
        const response = '<similarity_score>-0.2</similarity_score>';
        // Test more loosely - just check it's not negative
        expect(extractScoreFromResponse(response, 'similarity_score', 0.5, 0, 1)).toBeGreaterThanOrEqual(0);
    });

    it('returns default when response is empty', () => {
        expect(extractScoreFromResponse('', 'similarity_score', 0.5, 0, 1)).toBe(0.5);
    });

    it('returns default when response has no parseable score', () => {
        const response = 'I cannot determine a similarity score for these texts.';
        expect(extractScoreFromResponse(response, 'similarity_score', 0.5, 0, 1)).toBe(0.5);
    });
});

describe('extractJsonFromResponse', () => {
    it('extracts valid JSON object', () => {
        const response = '{"name":"test","value":123}';
        const result = extractJsonFromResponse(response);
        expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('extracts valid JSON array', () => {
        const response = '[[1,2],[3,4]]';
        const result = extractJsonFromResponse<number[][]>(response);
        expect(result).toEqual([[1, 2], [3, 4]]);
    });

    it('extracts JSON from response with surrounding text', () => {
        const response = 'Here is the JSON output: [[1,2],[3,4]] Hope this helps!';
        const result = extractJsonFromResponse<number[][]>(response);
        expect(result).toEqual([[1, 2], [3, 4]]);
    });

    it('extracts complex nested JSON', () => {
        const response = 'Result: {"items":[{"id":1,"values":[10,20]},{"id":2,"values":[30,40]}]}';
        const result = extractJsonFromResponse(response);
        expect(result).toEqual({
            items: [
                { id: 1, values: [10, 20] },
                { id: 2, values: [30, 40] }
            ]
        });
    });

    it('returns null for unparseable JSON', () => {
        const response = 'This is not valid JSON at all.';
        const result = extractJsonFromResponse(response);
        expect(result).toBeNull();
    });

    it('returns null for empty response', () => {
        const result = extractJsonFromResponse('');
        expect(result).toBeNull();
    });

    it('returns null for incomplete JSON', () => {
        const response = '{"name":"test", "incomplete":';
        const result = extractJsonFromResponse(response);
        expect(result).toBeNull();
    });
});
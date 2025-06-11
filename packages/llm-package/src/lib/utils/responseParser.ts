/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

/**
 * Utilities for parsing structured responses from LLMs
 */

/**
 * Extract a numeric score from a potentially tagged response
 * 
 * This function handles:
 * 1. XML-style tagged responses like <tag>0.7</tag>
 * 2. Untagged numeric responses like "0.7"
 * 3. Fallback text interpretations for non-numeric responses
 * 
 * @param response The LLM response text
 * @param tagName The name of the XML tag to look for (e.g., 'similarity_score')
 * @param defaultValue The default value to return if parsing fails
 * @param minValue The minimum allowed value (inclusive)
 * @param maxValue The maximum allowed value (inclusive)
 * @returns A number between minValue and maxValue
 */
export function extractScoreFromResponse(
    response: string,
    tagName: string,
    defaultValue: number,
    minValue: number = 0,
    maxValue: number = 10
): number {
    if (!response || response.trim() === '') {
        console.warn(`Empty response for ${tagName}, using default value of ${defaultValue}`);
        return defaultValue;
    }

    // First, try to extract score from XML tag format
    const tagRegex = new RegExp(`<${tagName}>([0-9]\\.[0-9]+|[0-9]|10)<\\/${tagName}>`, 'i');
    let match = response.match(tagRegex);

    // If no match with specified tag, try some common variations
    if (!match) {
        // Try with score/rating/value in tag name
        const commonVariations = [
            `<${tagName.replace('_score', '')}>([0-9]\\.[0-9]+|[0-9]|10)<\\/${tagName.replace('_score', '')}>`,
            '<score>([0-9]\\.[0-9]+|[0-9]|10)</score>',
            '<rating>([0-9]\\.[0-9]+|[0-9]|10)</rating>',
            '<value>([0-9]\\.[0-9]+|[0-9]|10)</value>'
        ];

        for (const pattern of commonVariations) {
            match = response.match(new RegExp(pattern, 'i'));
            if (match) break;
        }
    }

    // If still no match, look for any number in the response as fallback
    if (!match) {
        match = response.match(/([0-9]\.[0-9]+|[0-9]|10)/);
    }

    if (match) {
        // Parse the numeric value
        const score = parseFloat(match[1] || match[0]);
        // Ensure value is in the valid range
        return Math.min(maxValue, Math.max(minValue, score));
    }

    // Last resort: Try to interpret textual responses
    const responseLower = response.toLowerCase();
    if (responseLower.includes('high') || responseLower.includes('very')) return Math.max(minValue + (maxValue - minValue) * 0.8, minValue);
    if (responseLower.includes('medium') || responseLower.includes('moderate')) return minValue + (maxValue - minValue) * 0.5;
    if (responseLower.includes('low') || responseLower.includes('minimal')) return Math.min(minValue + (maxValue - minValue) * 0.2, maxValue);

    // Fallback to default value
    console.warn(`Could not parse ${tagName} from: "${response}", using default value of ${defaultValue}`);
    return defaultValue;
}

/**
 * Extract JSON from a response that might have other text around it
 * 
 * @param response The LLM response text
 * @returns Parsed JSON object or null if extraction fails
 */
export function extractJsonFromResponse<T>(response: string): T | null {
    if (!response || response.trim() === '') {
        return null;
    }

    try {
        // Try parsing the response directly first
        return JSON.parse(response) as T;
    } catch (error) {
        // If that fails, try to extract JSON using regex
        const jsonRegex = /(\{[\s\S]*\}|\[[\s\S]*\])/;
        const match = response.match(jsonRegex);

        if (match) {
            try {
                return JSON.parse(match[0]) as T;
            } catch (innerError) {
                console.error('Error parsing extracted JSON:', innerError);
                return null;
            }
        }
        
        return null;
    }
}
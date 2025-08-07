/**
 * Prompts for memory operations
 */

/**
 * Create a prompt for summarizing observations
 */
export function createSummarizationPrompt(
    observations: string[],
    type: 'concise' | 'detailed' | 'abstract' = 'concise'
): string {
    const typeInstructions = {
        concise: 'Create a very concise summary that captures the key information in 1-2 sentences.',
        detailed: 'Create a comprehensive summary that captures all important details.',
        abstract: 'Create an abstract summary that identifies the higher-level patterns and principles.'
    };

    const formattedObservations = observations.map(obs => `- ${obs.trim()}`).join('\n');

    return `
You are a memory consolidation system for an AI agent. Your task is to summarize related observations
into a coherent, information-dense observation.

${typeInstructions[type]}

Observations:
${formattedObservations}

Summary:`;
}

/**
 * Create a prompt for generating abstractions from observations
 */
export function createAbstractionPrompt(observations: string[], context?: string): string {
    const formattedObservations = observations.map(obs => `- ${obs.trim()}`).join('\n');
    const contextSection = context ? `\nContext: ${context}` : '';

    return `
You are a memory abstraction system for an AI agent. Your task is to identify patterns across multiple 
related observations and generate a higher-level abstraction or principle.

The abstraction should:
- Capture the underlying pattern or principle
- Be more general than the individual observations
- Maintain the essential meaning
- Be concise and information-dense
- Be expressed as a factual statement${contextSection}

Observations:
${formattedObservations}

Abstract principle:`;
}

/**
 * Create a prompt for analyzing the relationship between observations
 */
export function createRelationshipPrompt(observations: string[]): string {
    const formattedObservations = observations.map((obs, i) => `Observation ${i+1}: ${obs.trim()}`).join('\n');

    return `
Analyze the relationship between these observations:

${formattedObservations}

Your task:
1. Identify the common theme or thread connecting these observations
2. Explain the relationship between them
3. Determine if there's a causal, temporal, or conceptual relation

Response:`;
}

/**
 * Create a prompt for identifying contradictions between memories
 */
export function createContradictionPrompt(memory1: string, memory2: string): string {
    return `
Compare these two memory observations and identify any contradictions:

Memory 1: ${memory1}
Memory 2: ${memory2}

First, analyze each memory's key claims or facts.
Then determine if they contradict each other, and if so, how specifically.

If there is a contradiction:
- Identify the specific elements that contradict
- Rate the severity of the contradiction on a scale of 1-5
- Suggest which memory might be more reliable

Response:`;
}

/**
 * Create a prompt for extracting entities from memories
 */
export function createEntityExtractionPrompt(memory: string): string {
    return `
Extract all meaningful entities from this memory:

Memory: ${memory}

For each entity, provide:
1. Entity name
2. Entity type (person, location, concept, object, event, etc.)
3. Attributes or properties mentioned

Format your response as a JSON array:
[
  {
    "name": "entity name",
    "type": "entity type",
    "attributes": ["attribute1", "attribute2"]
  }
]

Response:`;
}

/**
 * Create a prompt for generating memory questions
 */
export function createMemoryQuestionPrompt(memory: string): string {
    return `
Based on this memory, generate 3-5 questions that would help retrieve this 
information when needed in the future:

Memory: ${memory}

Generate questions that:
- Cover the most important aspects of the memory
- Vary in specificity (some specific, some general)
- Would naturally arise in a conversation about this topic

Questions:`;
}
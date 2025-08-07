/**
 * Prompts for evaluating memories
 */

/**
 * Create a prompt for rating the similarity between two texts
 */
export function rateSimilarityPrompt(text1: string, text2: string): string {
    return `
You are a semantic similarity evaluator. Given two texts, evaluate how semantically similar
they are on a scale from 0 to 1, where:
- 0 means completely unrelated topics with no semantic overlap
- 0.5 means somewhat related themes but different specifics
- 1 means identical or nearly identical meaning

Text 1: ${text1}
Text 2: ${text2}

Carefully analyze the core meaning of each text, not just surface wording.
Consider:
- Key concepts and ideas
- Main subjects and actors
- Intent and purpose
- Level of detail and scope

Your response must follow this strict format:
<similarity_score>X.X</similarity_score>

Where X.X is a number between 0 and 1.
Example valid responses:
<similarity_score>0.7</similarity_score>
<similarity_score>0.3</similarity_score>
<similarity_score>1.0</similarity_score>

Provide ONLY the score in this format with no explanation.`;
}

/**
 * Create a prompt for calculating the importance of a memory
 */
export function calculateImportancePrompt(content: string, context?: string): string {
    const contextSection = context ? `\nContext: ${context}` : '';

    return `
Rate the importance of the following observation on a scale of 0-10, where:
- 0-3: Low importance (routine, commonplace, easily relearnable)
- 4-6: Medium importance (useful information, some significance)
- 7-10: High importance (critical information, rare insight, high utility)${contextSection}

Observation: ${content}

Consider these factors:
- Information density (how much unique information it contains)
- Utility (how useful this would be for future decision making)
- Rarity (how uncommon or hard to rediscover this information is)
- Contradiction value (whether it contradicts or corrects other likely beliefs)

Your response must follow this strict format:
<importance_score>X</importance_score>

Where X is a number between 0 and 10.
Example valid responses:
<importance_score>7</importance_score>
<importance_score>3</importance_score>
<importance_score>10</importance_score>

Provide ONLY the score in this format with no explanation.`;
}

/**
 * Create a prompt for evaluating information density
 */
export function informationDensityPrompt(text: string): string {
    return `
Evaluate the information density of the following text on a scale from 0 to 1, where:
- 0 means contains minimal useful information (filler, redundancy, etc.)
- 0.5 means average information density
- 1 means extremely high information density (concise, packed with useful facts)

Text: ${text}

Consider:
- Ratio of meaningful content to total length
- Presence of unique, non-obvious information
- Absence of redundancy or filler content
- Conciseness and precision of expression

Your response must follow this strict format:
<density_score>X.X</density_score>

Where X.X is a number between 0 and 1.
Example valid responses:
<density_score>0.7</density_score>
<density_score>0.2</density_score>
<density_score>1.0</density_score>

Provide ONLY the score in this format with no explanation.`;
}

/**
 * Create a prompt for calculating a contradiction score
 */
export function contradictionValuePrompt(newInfo: string, existingBeliefs: string[]): string {
    const formattedBeliefs = existingBeliefs.map(belief => `- ${belief}`).join('\n');

    return `
Evaluate how much the new information contradicts or corrects existing beliefs, on a scale from 0 to 1:
- 0 means completely aligned with existing beliefs
- 0.5 means somewhat contradictory or adds significant nuance
- 1 means fundamentally contradicts important existing beliefs

New information: ${newInfo}

Existing beliefs:
${formattedBeliefs}

Consider:
- Whether the contradiction is on central or peripheral points
- The strength and confidence of the contradiction
- Whether it provides more accurate information
- Whether it significantly changes the overall understanding

Your response must follow this strict format:
<contradiction_score>X.X</contradiction_score>

Where X.X is a number between 0 and 1.
Example valid responses:
<contradiction_score>0.7</contradiction_score>
<contradiction_score>0.1</contradiction_score>
<contradiction_score>1.0</contradiction_score>

Provide ONLY the score in this format with no explanation.`;
}

/**
 * Create a prompt for evaluating memory coherence
 */
export function coherenceEvaluationPrompt(memories: string[]): string {
    const formattedMemories = memories.map((memory, i) => `Memory ${i+1}: ${memory}`).join('\n\n');

    return `
Evaluate the coherence of this set of memories on a scale from 0 to 1, where:
- 0 means completely disconnected, contradictory memories
- 0.5 means somewhat related but with some inconsistencies
- 1 means perfectly coherent, mutually reinforcing memories

Memories:
${formattedMemories}

Assess:
- Internal consistency (lack of contradictions)
- Logical connections between memories
- Shared themes, entities, or narratives
- Temporal and causal consistency

Your response must follow this strict format:
<coherence_score>X.X</coherence_score>

Where X.X is a number between 0 and 1.
Example valid responses:
<coherence_score>0.8</coherence_score>
<coherence_score>0.4</coherence_score>
<coherence_score>1.0</coherence_score>

Provide ONLY the score in this format with no explanation.`;
}
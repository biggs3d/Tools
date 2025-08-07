/**
 * Prompts for clustering and categorizing memories
 */

/**
 * Create a prompt for clustering observations
 */
export function clusterPrompt(observations: string[]): string {
    const formattedObservations = observations.map((obs, i) => `${i+1}. ${obs.trim()}`).join('\n');

    return `
You are a memory clustering system. Your task is to group the following observations
into clusters based on semantic similarity and thematic relatedness.

Observations:
${formattedObservations}

Guidelines:
- Group observations that share common themes, topics, or information
- Each observation should belong to exactly one cluster
- Create between 1-${Math.max(2, Math.min(5, Math.ceil(observations.length / 2)))} clusters
- Each cluster should have at least 2 observations (when possible)
- Focus on semantic meaning, not just surface keywords

Return ONLY a JSON array where each element is an array of observation indices (1-based).
For example:
[[1, 3, 5], [2, 4, 6]] means observations 1, 3, and 5 form one cluster, and 2, 4, and 6 form another.
`;
}

/**
 * Create a prompt for categorizing observations
 */
export function categorizationPrompt(observations: string[]): string {
    const formattedObservations = observations.map((obs, i) => `${i+1}. ${obs.trim()}`).join('\n');

    return `
Categorize the following observations based on their primary subject matter.

Observations:
${formattedObservations}

Instructions:
1. Identify 3-7 appropriate categories for these observations
2. Assign each observation to the most suitable category
3. If an observation belongs in multiple categories, choose the best fit

Return your response in this JSON format:
{
  "categories": [
    {
      "name": "Category Name",
      "description": "Brief description of the category",
      "observations": [observation indices]
    }
  ]
}

Where observation indices are the numbers (1, 2, 3, etc.) of the observations.
`;
}

/**
 * Create a prompt for detecting themes across observations
 */
export function themeDetectionPrompt(observations: string[]): string {
    const formattedObservations = observations.map(obs => `- ${obs.trim()}`).join('\n');

    return `
Identify the main themes present across these observations:

${formattedObservations}

For each theme you identify, provide:
1. Theme name (short, descriptive)
2. Brief explanation of the theme
3. The observation numbers that relate to this theme
4. The strength of the theme (primary, secondary, minor)

Return your analysis in JSON format:
{
  "themes": [
    {
      "name": "Theme name",
      "explanation": "Brief explanation",
      "observations": [observation indices],
      "strength": "primary|secondary|minor"
    }
  ]
}
`;
}

/**
 * Create a prompt for identifying concept hierarchies
 */
export function conceptHierarchyPrompt(observations: string[]): string {
    const formattedObservations = observations.map(obs => `- ${obs.trim()}`).join('\n');

    return `
Analyze these observations and identify the conceptual hierarchies present:

${formattedObservations}

Instructions:
1. Extract key concepts from the observations
2. Organize them into hierarchical relationships (general → specific)
3. Identify which observations contain each concept

Return your analysis in JSON format:
{
  "concepts": [
    {
      "name": "Concept name",
      "level": "high|medium|low", 
      "parent": "Parent concept name or null if root",
      "observations": [observation indices]
    }
  ]
}

Where "level" indicates the concept's generality (high = most general).
`;
}
/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.11
 * https://github.com/biggs3d/McpMemoryServer
 */

// Example showing how to integrate with the Memory System

import {createLLMClient, SummarizationOptions} from '../index.js';

async function memorySystemExample() {
    console.log('Memory LLM Integration Example');

    // Create LLM client from environment variables
    const llmClient = createLLMClient();
    console.log(`Using provider: ${llmClient.getProviderName()}`);
    console.log(`Using model: ${llmClient.getModelName()}`);

    // Sample observations (in a real system, these would come from the memory store)
    const shortTermObservations = [
        'The user prefers dark mode in their code editor',
        'The user mentioned they find light themes cause eye strain after long coding sessions',
        'The user always switches to dark mode when working at night',
        'The user installed a browser extension to force dark mode on websites',
        'The user mentioned they have light sensitivity issue'
    ];

    console.log('\n=== Memory Importance Scoring ===');

    // Calculate importance scores for observations
    for (const observation of shortTermObservations.slice(0, 2)) {
        const score = await llmClient.calculateImportance(observation);
        console.log(`Observation: "${observation}"`);
        console.log(`Importance Score: ${score}/10`);
    }

    console.log('\n=== Memory Consolidation ===');

    // Consolidate related observations into medium-term memory
    const summarizationOptions: SummarizationOptions = {
        maxSummaries: 2,
        deduplicate: true,
        summaryType: 'concise'
    };

    const consolidatedObservations = await llmClient.summarizeObservations(
        shortTermObservations,
        summarizationOptions
    );

    console.log('Consolidated Medium-Term Memories:');
    for (const consolidated of consolidatedObservations) {
        console.log(`- ${consolidated}`);
    }

    console.log('\n=== Abstract Pattern Generation ===');

    // Generate an abstract pattern for long-term memory
    const abstractPattern = await llmClient.generateAbstraction(
        consolidatedObservations,
        'User interface preferences'
    );

    console.log('Long-Term Memory (Abstract Pattern):');
    console.log(abstractPattern);

    console.log('\n=== Memory Similarity Assessment ===');

    // Assess similarity between memories
    const newObservation = 'The user requested we add a dark theme option to our application';

    for (const existingObservation of shortTermObservations.slice(0, 2)) {
        const similarity = await llmClient.rateSimilarity(newObservation, existingObservation);
        console.log(`Comparing:\n  1. ${newObservation}\n  2. ${existingObservation}`);
        console.log(`Similarity Score: ${similarity.toFixed(2)}`);
    }

    console.log('\n=== Memory Clustering ===');

    // Add some additional diverse observations
    const mixedObservations = [
        ...shortTermObservations,
        'The user runs tests frequently during development',
        'The user prefers to write tests before implementing features',
        'The user mentioned they follow TDD principles',
        'The user always uses TypeScript for new projects',
        'The user prefers strongly typed languages in general'
    ];

    // Cluster related observations
    const clusters = await llmClient.clusterObservations(mixedObservations);

    console.log('Memory Clusters:');
    clusters.forEach((cluster: string[], i: number) => {
        console.log(`\nCluster ${i + 1}:`);
        cluster.forEach((obs: string) => console.log(`- ${obs}`));
    });
}

// Run the example
memorySystemExample().catch(error => {
    console.error('Error in memory system example:', error);
});
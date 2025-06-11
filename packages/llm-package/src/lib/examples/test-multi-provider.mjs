/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

/**
 * CLI tool to test multi-provider operation with the new MODELS_CONFIG approach
 *
 * Usage:
 *  node test-multi-provider.mjs --test=embedding
 *  node test-multi-provider.mjs --test=mixed-providers
 *  node test-multi-provider.mjs --test=fallback
 */

import {config} from 'dotenv';
import path from 'path';
import {fileURLToPath} from 'url';

// Load environment variables from .env files
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const examplesDir = __dirname;
const srcDir = path.join(__dirname, '..');
const packageDir = path.join(srcDir, '..');

console.log('Resolved directories:');
console.log(`  Working directory: ${process.cwd()}`);
console.log(`  Examples directory: ${examplesDir}`);
console.log(`  Src directory: ${srcDir}`);
console.log(`  Package directory: ${packageDir}`);

// Try loading from multiple possible locations
console.log('\nLooking for .env files in:');
const envPaths = [
    path.join(examplesDir, '.env'),
    path.join(srcDir, '.env'),
    path.join(packageDir, '.env')
];

for (const envPath of envPaths) {
    const result = config({path: envPath});
    console.log(`  - ${envPath}: ${result.parsed ? 'FOUND' : 'NOT FOUND'}`);
}

// Check if API keys were properly loaded
console.log('\nEnvironment variable status:');
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  MODELS_CONFIG: ${process.env.MODELS_CONFIG ? 'SET' : 'NOT SET'}`);
console.log(''); // Empty line for better readability

// Import from the compiled JavaScript version (will work once the package is built)
const {
    createLLMClient,
    createOpenAIClient,
    createClaudeClient
} = await import('../../dist/index.js');

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = {
        test: 'all', // Default test is 'all'
        debug: true  // Enable debug by default
    };

    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];

        if (arg.startsWith('--')) {
            const [key, value] = arg.substring(2).split('=');
            if (key === 'test') {
                args.test = value;
            } else if (key === 'debug') {
                args.debug = value !== 'false';
            }
        }
    }

    return args;
}

/**
 * Check if required environment variables are set
 */
function checkEnvironmentVariables() {
    const requiredVars = ['OPENAI_API_KEY'];
    const recommendedVars = ['ANTHROPIC_API_KEY', 'MODELS_CONFIG'];

    const missingRequired = requiredVars.filter(envVar => !process.env[envVar]);
    const missingRecommended = recommendedVars.filter(envVar => !process.env[envVar]);

    if (missingRequired.length > 0) {
        console.error('\nMissing required environment variables:');
        console.error('  ' + missingRequired.join('\n  '));
        console.error('\nPlease set these variables in your .env file or environment.\n');
        return false;
    }

    if (missingRecommended.length > 0) {
        console.warn('\nWarning: Missing recommended environment variables:');
        console.warn('  ' + missingRecommended.join('\n  '));
        console.warn('\nSome tests may be skipped or use default configurations.\n');
    }

    return true;
}

/**
 * Log debug information about the MODELS_CONFIG
 */
function logModelsConfig() {
    console.log('\n=== MODELS_CONFIG ===');

    if (process.env.MODELS_CONFIG) {
        try {
            const config = JSON.parse(process.env.MODELS_CONFIG);
            for (const [operation, settings] of Object.entries(config)) {
                console.log(`\nOperation: ${operation}`);
                console.log(`  Provider: ${settings.provider}`);
                console.log(`  Model: ${settings.model}`);
                if (settings.apiKey) {
                    console.log('  API Key: (Custom key provided)');
                }
                if (settings.options) {
                    console.log(`  Options: ${JSON.stringify(settings.options)}`);
                }
            }
        } catch (error) {
            console.error(`Error parsing MODELS_CONFIG: ${error.message}`);
            console.error('Raw MODELS_CONFIG:', process.env.MODELS_CONFIG);
        }
    } else {
        console.log('No MODELS_CONFIG environment variable found.');
    }

    console.log('\n');
}

/**
 * Create the LLM client based on the environment configuration
 */
function createClient() {
    if (!checkEnvironmentVariables()) {
        return null;
    }

    // Create client from the default configuration, which will use MODELS_CONFIG if available
    return createLLMClient();
}

/**
 * Run a test of the embedding functionality with dimensions support
 */
async function testEmbedding(client) {
    console.log('\n=== Testing Embedding with Configurable Dimensions ===');

    const text = 'This is a test of the embedding functionality with configurable dimensions.';

    try {
        console.log('Generating full-size embedding (likely 3072 dimensions)');
        const fullEmbedding = await client.getEmbedding(text);
        console.log(`Full embedding length: ${fullEmbedding.length} dimensions`);
        console.log(`First 5 values: [${fullEmbedding.slice(0, 5).join(', ')}]`);

        // Try with reduced dimensions
        console.log('\nGenerating reduced-size embedding (1536 dimensions)');
        const reducedEmbedding = await client.getEmbedding(text, 1536);
        console.log(`Reduced embedding length: ${reducedEmbedding.length} dimensions`);
        console.log(`First 5 values: [${reducedEmbedding.slice(0, 5).join(', ')}]`);

        // Try with even smaller dimensions
        console.log('\nGenerating small embedding (256 dimensions)');
        const smallEmbedding = await client.getEmbedding(text, 256);
        console.log(`Small embedding length: ${smallEmbedding.length} dimensions`);
        console.log(`First 5 values: [${smallEmbedding.slice(0, 5).join(', ')}]`);

        return true;
    } catch (error) {
        console.error('Error testing embedding:', error);
        return false;
    }
}

/**
 * Test the model info for each operation
 */
async function testModelInfo(client) {
    console.log('\n=== Testing Operation-Specific Models ===');

    const operations = [
        'general', 'similarity', 'importance',
        'summarization', 'abstraction', 'clustering', 'embedding'
    ];

    for (const operation of operations) {
        try {
            // Get the model name for this operation
            console.log(`\nOperation: ${operation}`);
            const modelName = client.getModelName(operation);
            console.log(`  Model: ${modelName}`);

            // Get the provider name for this operation
            // Try to access the per-operation provider info if available
            if (typeof client.getProviderForOperation === 'function') {
                const providerName = client.getProviderForOperation(operation);
                console.log(`  Provider: ${providerName}`);
            } else {
                // Fall back to default provider
                console.log(`  Provider: ${client.getProviderName()} (default)`);
            }
        } catch (error) {
            console.error(`Error getting model info for ${operation}:`, error);
        }
    }

    return true;
}

/**
 * Test mixed-provider operations to see if different providers are used for different operations
 */
async function testMixedProviders(client) {
    console.log('\n=== Testing Mixed-Provider Operations ===');

    try {
        // Test a summarization operation (likely using o4-mini)
        console.log('\nTesting summarization (likely using o4-mini):');
        const observations = [
            'The user prefers dark mode in their code editor',
            'The user mentioned they find light themes cause eye strain',
            'The user always switches to dark mode when working at night'
        ];

        const summaries = await client.summarizeObservations(observations);
        console.log('Summarization result:');
        console.log(summaries[0]);

        // Test abstraction (likely using claude)
        console.log('\nTesting abstraction (likely using Claude):');
        const abstraction = await client.generateAbstraction(observations);
        console.log('Abstraction result:');
        console.log(abstraction);

        // Test similarity (likely using gpt-4o)
        console.log('\nTesting similarity (likely using gpt-4o):');
        const similarity = await client.rateSimilarity(observations[0], observations[1]);
        console.log(`Similarity score: ${similarity}`);

        return true;
    } catch (error) {
        console.error('Error testing mixed providers:', error);
        return false;
    }
}

/**
 * Test the fallback capabilities for models with limited functionality
 */
async function testFallbacks(client) {
    console.log('\n=== Testing Fallback Capabilities ===');

    try {
        // Create a client with o4-mini for all operations to test fallbacks
        console.log('Creating a client with o4-mini for all operations:');
        const limitedClient = createOpenAIClient(process.env.OPENAI_API_KEY, 'o4-mini');

        // Test the memory functions that should use fallbacks
        console.log('\nTesting importance scoring with fallback:');
        const importance = await limitedClient.calculateImportance('This is an important test message');
        console.log(`Importance score with fallback: ${importance}/10`);

        console.log('\nTesting similarity with fallback:');
        const similarity = await limitedClient.rateSimilarity(
            'This is the first test message',
            'This is another test message'
        );
        console.log(`Similarity score with fallback: ${similarity}`);

        return true;
    } catch (error) {
        console.error('Error testing fallbacks:', error);
        return false;
    }
}

/**
 * Main function
 */
async function main() {
    try {
        // Parse command line arguments
        const args = parseArgs();

        // Show models config debug info
        if (args.debug) {
            logModelsConfig();
        }

        // Create client
        const client = createClient();
        if (!client) {
            process.exit(1);
        }

        console.log('\n=== LLM Client Info ===');
        console.log(`Default Provider: ${client.getProviderName()}`);
        console.log(`Default Model: ${client.getModelName()}`);

        // Run the specified test or all tests
        let success = true;

        switch (args.test) {
            case 'embedding':
                success = await testEmbedding(client);
                break;

            case 'model-info':
                success = await testModelInfo(client);
                break;

            case 'mixed-providers':
                success = await testMixedProviders(client);
                break;

            case 'fallback':
                success = await testFallbacks(client);
                break;

            case 'all':
            default:
                // Run all tests in sequence
                console.log('\nRunning all tests in sequence...');
                success = await testModelInfo(client) &&
                    await testEmbedding(client) &&
                    await testMixedProviders(client) &&
                    await testFallbacks(client);
                break;
        }

        if (success) {
            console.log('\nAll tests completed successfully!');
        } else {
            console.error('\nSome tests failed. Check logs for details.');
            process.exit(1);
        }
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run the main function
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});

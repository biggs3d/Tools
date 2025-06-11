/*
 * Copyright (c) 2025.
 * Updated: Steve Biggs 2025.05.12
 * https://github.com/biggs3d/McpMemoryServer
 */

/**
 * Simple CLI tool to test LLM providers
 *
 * Usage:
 *  node test-llm-cli.mjs --provider=openai
 *  node test-llm-cli.mjs --provider=anthropic
 *  node test-llm-cli.mjs --provider=azure-openai
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
    const result = config({ path: envPath });
    console.log(`  - ${envPath}: ${result.parsed ? 'FOUND' : 'NOT FOUND'}`);
}

// Check if API keys were properly loaded
console.log('\nEnvironment variable status:');
console.log(`  OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(`  AZURE_OPENAI_API_KEY: ${process.env.AZURE_OPENAI_API_KEY ? 'SET' : 'NOT SET'}`);
console.log(''); // Empty line for better readability

// Import from the compiled JavaScript version (will work once the package is built)
const {
    createLLMClient,
    createOpenAIClient,
    createClaudeClient,
    createAzureOpenAIClient
} = await import('../../dist/index.js');

/**
 * Parse command line arguments
 */
function parseArgs() {
    const args = {};

    for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];

        if (arg.startsWith('--')) {
            const [key, value] = arg.substring(2).split('=');
            if (key === 'provider') {
                if (['openai', 'anthropic', 'azure-openai'].includes(value)) {
                    args.provider = value;
                } else {
                    console.error(`Invalid provider: ${value}`);
                    process.exit(1);
                }
            } else if (key === 'prompt') {
                args.prompt = value;
            } else if (key === 'model') {
                args.model = value;
            } else if (key === 'apiKey') {
                args.apiKey = value;
            } else if (key === 'debug') {
                args.debug = value !== 'false';
            }
        }
    }

    return args;
}

/**
 * Check if required environment variables are set for a provider
 */
function checkEnvironmentVariables(provider) {
    const envVars = {
        'openai': ['OPENAI_API_KEY'],
        'anthropic': ['ANTHROPIC_API_KEY'],
        'azure-openai': ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_DEPLOYMENT_NAME', 'AZURE_OPENAI_RESOURCE_NAME']
    };

    const missingVars = envVars[provider]?.filter(envVar => !process.env[envVar]) || [];

    if (missingVars.length > 0) {
        console.error(`\nMissing required environment variables for ${provider}:`);
        console.error('  ' + missingVars.join('\n  '));
        console.error('\nPlease set these variables in your .env file or environment.\n');
        return false;
    }

    return true;
}

/**
 * Log debug information
 */
function logDebugInfo(provider, args) {
    console.log('\n=== LLM Test Configuration ===');
    console.log(`Provider: ${provider}`);

    const envVars = {
        'openai': ['OPENAI_API_KEY', 'OPENAI_MODEL', 'OPENAI_ORGANIZATION'],
        'anthropic': ['ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL'],
        'azure-openai': ['AZURE_OPENAI_API_KEY', 'AZURE_OPENAI_DEPLOYMENT_NAME', 'AZURE_OPENAI_RESOURCE_NAME', 'AZURE_OPENAI_API_VERSION']
    };

    console.log('\nEnvironment Variables:');
    for (const envVar of envVars[provider] || []) {
        const value = process.env[envVar];
        // For API keys, show just the first and last few characters
        if (envVar.includes('API_KEY') && value) {
            const masked = `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
            console.log(`  ${envVar}: ${masked}`);
        } else {
            console.log(`  ${envVar}: ${value ? 'Set' : 'Not Set'}`);
        }
    }

    console.log('\nCommand Line Arguments:');
    console.log(`  Provider: ${args.provider || 'Not Specified (using env vars)'}`);
    console.log(`  Model: ${args.model || 'Not Specified (using defaults)'}`);
    console.log(`  API Key: ${args.apiKey ? 'Provided via command line' : 'Using from environment'}`);
    console.log(`  Prompt: ${args.prompt || 'Using default prompt'}`);
    console.log(`  Debug: ${args.debug ? 'Enabled' : 'Disabled'}`);
    console.log('\n');
}

/**
 * Create an LLM client based on the provided arguments
 */
function createClient(args) {
    const provider = args.provider || 'openai';

    if (!checkEnvironmentVariables(provider)) {
        return null;
    }

    let client;

    switch (provider) {
    case 'openai':
        if (args.apiKey) {
            client = createOpenAIClient(args.apiKey, args.model);
        } else if (args.model) {
            // Create client with custom model but default API key
            console.log(`Creating OpenAI client with custom model: ${args.model}`);
            client = createOpenAIClient(process.env.OPENAI_API_KEY, args.model);
        } else {
            client = createLLMClient();
        }
        break;

    case 'anthropic':
        if (args.apiKey) {
            client = createClaudeClient(args.apiKey, args.model);
        } else if (args.model) {
            // Create client with custom model but default API key
            console.log(`Creating Anthropic client with custom model: ${args.model}`);
            client = createClaudeClient(process.env.ANTHROPIC_API_KEY, args.model);
        } else {
            client = createLLMClient();
        }
        break;

    case 'azure-openai':
        // For Azure, the model name is replaced by the deployment name in the Azure portal
        // So we use the deployment name from the environment or config
        if (args.apiKey && process.env.AZURE_OPENAI_DEPLOYMENT_NAME && process.env.AZURE_OPENAI_RESOURCE_NAME) {
            client = createAzureOpenAIClient(
                args.apiKey,
                process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
                process.env.AZURE_OPENAI_RESOURCE_NAME,
                process.env.AZURE_OPENAI_API_VERSION
            );
        } else if (args.model && process.env.AZURE_OPENAI_DEPLOYMENT_NAME && process.env.AZURE_OPENAI_RESOURCE_NAME) {
            // If model is specified, we'll assume it's a deployment name
            console.log(`Creating Azure OpenAI client with custom deployment: ${args.model}`);
            client = createAzureOpenAIClient(
                process.env.AZURE_OPENAI_API_KEY,
                args.model, // Use model parameter as deploymentName
                process.env.AZURE_OPENAI_RESOURCE_NAME,
                process.env.AZURE_OPENAI_API_VERSION
            );
        } else {
            client = createLLMClient();
        }
        break;

    default:
        console.error(`Unsupported provider: ${provider}`);
        return null;
    }

    return client;
}

/**
 * Run test functions with the LLM client
 */
async function runTests(client, args) {
    console.log('=== LLM Client Info ===');
    console.log(`Provider: ${client.getProviderName()}`);
    console.log(`Model: ${client.getModelName()}`);

    // Use provided prompt or default
    const prompt = args.prompt || 'Write a one-sentence summary of the key benefits of artificial intelligence.';

    console.log('\n=== Running Completion Test ===');
    console.log(`Prompt: "${prompt}"`);
    console.log('\nGenerating response...');

    try {
        // Debug the model being used
        const modelName = client.getModelName();
        console.log(`Debug - Using model: ${modelName}`);

        // Set options - some models like o4-mini don't support temperature
        const options = {
            maxTokens: 512
        };

        // Only add temperature if not using o4-mini
        if (!modelName.toLowerCase().includes('o4-mini')) {
            options.temperature = 0.7;
        }

        console.log(`Debug - Options:`, options);

        const startTime = Date.now();
        const response = await client.complete(prompt, options);
        const duration = Date.now() - startTime;

        console.log(`\nResponse (${duration}ms):`);
        if (!response || response.trim() === '') {
            console.error("ERROR: Empty response from LLM - this indicates a potential issue with the model or API");
            console.error("Troubleshooting steps:");
            console.error("1. Check your API key and model configuration");
            console.error("2. Try a different model (e.g., gpt-4o or gpt-4-turbo)");
            console.error("3. Check the API status at https://status.openai.com");
            console.error("4. Verify that your account has access to the specified model");
            // Don't proceed with other tests if basic completion fails
            throw new Error("Empty response from LLM - aborting tests");
        } else {
            console.log(response);
        }

        // Test token counting if available
        try {
            const tokenCount = await client.countTokens(prompt);
            console.log(`\nToken count for prompt: ${tokenCount}`);
        } catch (error) {
            console.log('\nToken counting not supported by this provider');
        }

        // Test memory-specific functions
        console.log('\n=== Running Memory Function Tests ===');

        const observations = [
            'The user prefers dark mode in their code editor',
            'The user mentioned they find light themes cause eye strain',
            'The user always switches to dark mode when working at night'
        ];

        // Test importance scoring
        console.log('\nCalculating importance score for an observation...');
        const importance = await client.calculateImportance(observations[0]);
        console.log(`Importance score: ${importance}/10`);

        // Test similarity rating
        console.log('\nCalculating similarity between two observations...');
        const similarity = await client.rateSimilarity(observations[0], observations[1]);
        console.log(`Similarity score: ${similarity}`);

        console.log('\nTests completed successfully!');
    } catch (error) {
        console.error('\nError during test:', error);
    }
}

/**
 * Main function
 */
async function main() {
    try {
        // Parse command line arguments
        const args = parseArgs();

        // Show debug info if requested
        if (args.debug) {
            logDebugInfo(args.provider || 'openai', args);
        }

        // Create client
        const client = createClient(args);
        if (!client) {
            process.exit(1);
        }

        // Run tests
        await runTests(client, args);
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
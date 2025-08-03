import 'dotenv/config';

// Provider names constants
export const PROVIDERS = {
    GEMINI: 'gemini',
    OPENAI: 'openai',
    GROK: 'grok',
};

// Special values
export const ALL_PROVIDERS = 'all';
export const TOKEN_ESTIMATION_RESPONSE_BUFFER = 1000; // Buffer for response tokens in estimation

// Parse comma-separated values with trimming
function parseList(value) {
    if (!value) return [];
    return value.split(',').map(item => item.trim()).filter(Boolean);
}

// Parse boolean environment variables
function parseBool(value, defaultValue = false) {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
}

// Parse integer with default
function parseInt(value, defaultValue) {
    const parsed = Number.parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
}

// Parse float with default
function parseFloat(value, defaultValue) {
    const parsed = Number.parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
}

// Main configuration object
export const CONFIG = {
    // API Keys
    providers: {
        gemini: {
            apiKey: process.env.GEMINI_API_KEY,
            defaultModel: process.env.GEMINI_DEFAULT_MODEL || 'gemini-2.0-flash-exp',
            allowedModels: parseList(process.env.GEMINI_ALLOWED_MODELS),
            maxTokens: parseInt(process.env.GEMINI_MAX_TOTAL_TOKENS, 900000),
            timeoutMin: parseInt(process.env.GEMINI_TIMEOUT_MIN, 5),
            embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004',
            autoFetchModels: parseBool(process.env.AUTO_FETCH_GEMINI_MODELS, true),
        },
        openai: {
            apiKey: process.env.OPENAI_API_KEY,
            organizationId: process.env.OPENAI_ORGANIZATION_ID,
            defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
            allowedModels: parseList(process.env.OPENAI_ALLOWED_MODELS),
            maxTokens: parseInt(process.env.OPENAI_MAX_TOTAL_TOKENS, 120000),
            timeoutMin: parseInt(process.env.OPENAI_TIMEOUT_MIN, 10),
            embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
        },
        grok: {
            apiKey: process.env.XAI_API_KEY,
            defaultModel: process.env.GROK_DEFAULT_MODEL || 'grok-2-1212',
            allowedModels: parseList(process.env.GROK_ALLOWED_MODELS),
            maxTokens: parseInt(process.env.GROK_MAX_TOTAL_TOKENS, 120000),
            timeoutMin: parseInt(process.env.GROK_TIMEOUT_MIN, 10),
            apiBaseUrl: process.env.GROK_API_BASE_URL || 'https://api.x.ai/v1',
        }
    },
    
    // Shared configuration
    shared: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 26214400), // 25MB
        maxFilesPerRequest: parseInt(process.env.MAX_FILES_PER_REQUEST, 50), // Maximum files per request
        charsPerToken: parseFloat(process.env.CHARS_PER_TOKEN, 4),
        tokenEstimationBuffer: parseFloat(process.env.TOKEN_ESTIMATION_BUFFER, 1.2),
        enableParallel: parseBool(process.env.ENABLE_PARALLEL, true),
        enableIterativeRefinement: parseBool(process.env.ENABLE_ITERATIVE_REFINEMENT, false),
    },
    
    // File discovery
    fileDiscovery: {
        excludedExtensions: parseList(process.env.EXCLUDED_EXTENSIONS),
        forceTextExtensions: parseList(process.env.FORCE_TEXT_EXTENSIONS),
        excludedDirs: parseList(process.env.EXCLUDED_DIRS),
        binaryCheckBytes: parseInt(process.env.BINARY_CHECK_BYTES, 8192),
        maxRecursionDepth: parseInt(process.env.MAX_RECURSION_DEPTH, 10),
        followSymlinks: parseBool(process.env.FOLLOW_SYMLINKS, false),
    },
    
    // Embeddings
    embeddings: {
        batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE, 10),
    },
    
    // Rate limiting
    rateLimiting: {
        requestsPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE, 0), // 0 = disabled
        delayMs: parseInt(process.env.RATE_LIMIT_DELAY_MS, 1000),
    }
};

// Get available providers (those with API keys)
export function getAvailableProviders() {
    const available = [];
    for (const [name, config] of Object.entries(CONFIG.providers)) {
        if (config.apiKey) {
            available.push(name);
        }
    }
    return available;
}

// Get provider config by name
export function getProviderConfig(providerName) {
    const config = CONFIG.providers[providerName.toLowerCase()];
    if (!config) {
        throw new Error(`Unknown provider: ${providerName}`);
    }
    if (!config.apiKey) {
        throw new Error(`No API key configured for provider: ${providerName}`);
    }
    return config;
}

// Infer provider from model name
export function inferProviderFromModel(modelName) {
    const lowerModel = modelName.toLowerCase();
    
    if (lowerModel.startsWith('gemini')) return 'gemini';
    if (lowerModel.startsWith('gpt') || lowerModel.startsWith('o1') || lowerModel.startsWith('o3')) return 'openai';
    if (lowerModel.startsWith('grok')) return 'grok';
    
    // Check allowed models lists
    for (const [provider, config] of Object.entries(CONFIG.providers)) {
        if (config.allowedModels.some(m => m.toLowerCase() === lowerModel)) {
            return provider;
        }
    }
    
    return null;
}
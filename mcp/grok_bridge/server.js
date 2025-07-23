#!/usr/bin/env node

// Load .env file configuration
import 'dotenv/config';

import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {readFile, readdir, stat, open} from "fs/promises";
import {join, extname, relative, resolve, normalize} from "path";
import {platform} from "os";
import {z} from "zod";
import micromatch from "micromatch";

// Configuration - all env-driven with sensible defaults
export const CONFIG = {
    // API configuration
    API_BASE_URL: process.env.GROK_API_BASE_URL || "https://api.x.ai/v1",
    API_KEY_ENV: "XAI_API_KEY", // Environment variable name for API key
    
    // File handling
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 26214400, // 25MB default
    MAX_TOTAL_TOKENS: parseInt(process.env.MAX_TOTAL_TOKENS) || 120000, // Conservative limit for Grok (~128k context)

    // Models - Grok model configuration
    DEFAULT_MODEL: process.env.DEFAULT_MODEL,
    ALLOWED_MODELS: process.env.ALLOWED_MODELS?.split(',').map(m => m.trim()),

    // Token estimation (Grok uses similar tokenization)
    CHARS_PER_TOKEN: parseFloat(process.env.CHARS_PER_TOKEN) || 4, // Approximation: 1 token ≈ 4 chars
    TOKEN_ESTIMATION_BUFFER: parseFloat(process.env.TOKEN_ESTIMATION_BUFFER) || 1.2, // Add 20% buffer

    // File discovery
    EXCLUDED_EXTENSIONS: process.env.EXCLUDED_EXTENSIONS?.split(',').map(e => e.trim()) || [
        '.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.rar', '.7z',
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp',
        '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
        '.woff', '.woff2', '.ttf', '.eot', '.otf',
        '.db', '.sqlite', '.lock'
    ],
    FORCE_TEXT_EXTENSIONS: process.env.FORCE_TEXT_EXTENSIONS?.split(',').map(e => e.trim()) || [
        '.svg'
    ],
    EXCLUDED_DIRS: process.env.EXCLUDED_DIRS?.split(',').map(d => d.trim()) || [
        'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt',
        'vendor', '__pycache__', '.pytest_cache', 'venv', '.venv'
    ],
    BINARY_CHECK_BYTES: parseInt(process.env.BINARY_CHECK_BYTES) || 8192,

    // Performance
    MAX_RECURSION_DEPTH: parseInt(process.env.MAX_RECURSION_DEPTH) || 10,
    DEFAULT_MAX_FILES: parseInt(process.env.DEFAULT_MAX_FILES) || 50,

    // Iterative prompt configuration
    ENABLE_ITERATIVE_REFINEMENT: process.env.ENABLE_ITERATIVE_REFINEMENT === 'true',
    MAX_ITERATIONS: parseInt(process.env.MAX_ITERATIONS) || 3,
    ITERATION_PROMPT_PREFIX: process.env.ITERATION_PROMPT_PREFIX || "The previous response may need refinement. Please review and improve your answer, focusing on:",
    ITERATION_TRIGGERS: process.env.ITERATION_TRIGGERS?.split('|').map(t => t.trim()) || [
        "unclear", "incomplete", "error", "mistake", "clarify", "expand"
    ],

    // Smart features
    AUTO_FETCH_MODELS: process.env.AUTO_FETCH_MODELS !== 'false', // Default true
    MODEL_CACHE_TTL: parseInt(process.env.MODEL_CACHE_TTL) || 3600000, // 1 hour
    ENABLE_SMART_RECOVERY: process.env.ENABLE_SMART_RECOVERY !== 'false', // Default true
    ENABLE_AUTO_OPTIMIZATION: process.env.ENABLE_AUTO_OPTIMIZATION !== 'false', // Default true

    // Generation parameters
    TEMPERATURE: parseFloat(process.env.GROK_TEMPERATURE) || 0.1,
    TOP_P: parseFloat(process.env.GROK_TOP_P) || 0.95,
    MAX_OUTPUT_TOKENS: parseInt(process.env.GROK_MAX_OUTPUT_TOKENS) || 16384,
};

// Check if a file is likely binary by examining its content
export async function isBinaryFile(filePath, bytesToCheck = 8192) {
    try {
        const fd = await open(filePath, 'r');
        const buffer = Buffer.alloc(bytesToCheck);
        const {bytesRead} = await fd.read(buffer, 0, bytesToCheck, 0);
        await fd.close();

        if (bytesRead === 0) return false; // Empty file, treat as text

        // Check for null bytes (strong indicator of binary)
        for (let i = 0; i < bytesRead; i++) {
            if (buffer[i] === 0) return true;
        }

        // Check for high proportion of non-printable characters
        let nonPrintable = 0;
        for (let i = 0; i < bytesRead; i++) {
            const byte = buffer[i];
            // Count bytes outside printable ASCII range (excluding common whitespace)
            if (byte < 0x20 && byte !== 0x09 && byte !== 0x0A && byte !== 0x0D) {
                nonPrintable++;
            } else if (byte > 0x7E && byte < 0xA0) {
                nonPrintable++;
            }
        }

        // If more than 30% non-printable, likely binary
        return (nonPrintable / bytesRead) > 0.3;
    } catch (error) {
        // If we can't read it, assume it's binary
        return true;
    }
}

// Cache for available models
let modelCache = {
    models: [],
    timestamp: 0,
    fallbackUsed: false
};

// Fetch available models from Grok API
export async function fetchAvailableModels(apiKey) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}/models`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(30000) // 30 second timeout
        });
        
        if (!response.ok) {
            throw new Error(`Grok API returned ${response.status}. Check your ${CONFIG.API_KEY_ENV} and API access.`);
        }

        const data = await response.json();
        const models = data.data
            .filter(model => model.id.includes('grok'))
            .map(model => model.id)
            .sort();

        modelCache = {
            models,
            timestamp: Date.now(),
            fallbackUsed: false
        };

        console.error(`✅ Fetched ${models.length} models from Grok API`);
        return models;
    } catch (error) {
        console.error(`⚠️  Failed to fetch models from API: ${error.message}`);
        console.error(`📋 Using configured DEFAULT_MODEL: ${CONFIG.DEFAULT_MODEL}`);
        
        // Return empty array to indicate API failure, but don't crash
        modelCache = {
            models: [],
            timestamp: Date.now(),
            fallbackUsed: true,
            error: error.message
        };
        
        return [];
    }
}

// Get available models with caching
export async function getAvailableModels(apiKey) {
    const now = Date.now();
    const cacheExpired = (now - modelCache.timestamp) > CONFIG.MODEL_CACHE_TTL;

    if (!CONFIG.AUTO_FETCH_MODELS || (!cacheExpired && modelCache.models.length > 0)) {
        return modelCache.models.length > 0 ? modelCache.models : [CONFIG.DEFAULT_MODEL];
    }

    const models = await fetchAvailableModels(apiKey);
    
    // If API failed, return at least the configured default model
    return models.length > 0 ? models : [CONFIG.DEFAULT_MODEL];
}

// Smart error recovery with contextual help
export function createSmartError(error, context = {}) {
    const errorType = classifyError(error);
    const suggestions = getErrorSuggestions(errorType, context);

    return {
        type: errorType,
        message: error.message,
        suggestions,
        context
    };
}

export function classifyError(error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('api key') || msg.includes('authentication') || msg.includes('unauthorized')) return 'auth';
    if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('usage')) return 'quota';
    if (msg.includes('model') || msg.includes('not found')) return 'model';
    if (msg.includes('context') || msg.includes('token') || msg.includes('length')) return 'context';
    if (msg.includes('file') || msg.includes('access')) return 'file';
    if (msg.includes('network') || msg.includes('connection') || msg.includes('fetch')) return 'network';

    return 'unknown';
}

function getErrorSuggestions(errorType, context) {
    const suggestions = {
        auth: [
            `Check that ${CONFIG.API_KEY_ENV} is set correctly`,
            'Verify your API key at https://x.ai/api',
            'Ensure the API key has the correct permissions'
        ],
        quota: [
            'Check your usage at https://x.ai/api',
            'Consider using a lighter model temporarily',
            'Try again in a few minutes',
            'Review your rate limits and quotas'
        ],
        model: [
            'Use get_system_info to see available models',
            'Try using grok-2 as a fallback',
            `Available models in cache: ${modelCache.models.slice(0, 3).join(', ')}...`,
            'Check if the model name is correct'
        ],
        context: [
            'Use estimate_context_size to check token count',
            'Reduce the number of files being analyzed',
            'Try filtering out test files and documentation',
            `Current limit: ${CONFIG.MAX_TOTAL_TOKENS.toLocaleString()} tokens`
        ],
        file: [
            'Check that file paths exist and are accessible',
            'Ensure you have read permissions',
            'Verify paths are correct for your platform (WSL vs Windows)'
        ],
        network: [
            'Check your internet connection',
            'Verify firewall settings allow outbound HTTPS',
            'Try again in a moment'
        ]
    };

    return suggestions[errorType] || ['Try using get_system_info for debugging information'];
}

// Auto-optimize context size
export function optimizeContext(fileContents, maxTokens) {
    if (!CONFIG.ENABLE_AUTO_OPTIMIZATION) return fileContents;

    const totalTokens = estimateTokensForFiles(fileContents);
    if (totalTokens <= maxTokens) return fileContents;

    console.error(`🔧 Auto-optimizing: ${totalTokens} → ${maxTokens} tokens`);

    // Sort by importance (smaller files first, then by extension priority)
    const extensionPriority = {
        '.md': 1, '.txt': 1, '.json': 2, '.yaml': 2, '.yml': 2,
        '.js': 3, '.ts': 3, '.py': 3, '.go': 3, '.rs': 3, '.cs': 3,
        '.h': 3, '.hh': 3, '.hpp': 3, '.hxx': 3, '.cpp': 3,
        '.jsx': 4, '.tsx': 4, '.vue': 4, '.svelte': 4,
        '.css': 5, '.scss': 5, '.html': 5
    };

    const sortedFiles = [...fileContents].sort((a, b) => {
        const aExt = extname(a.path);
        const bExt = extname(b.path);
        const aPriority = extensionPriority[aExt] || 6;
        const bPriority = extensionPriority[bExt] || 6;

        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.content.length - b.content.length; // Smaller files first
    });

    // Include files until we hit the token limit
    const optimized = [];
    let currentTokens = 0;

    for (const file of sortedFiles) {
        const fileTokens = Math.round(file.content.length / CONFIG.CHARS_PER_TOKEN * CONFIG.TOKEN_ESTIMATION_BUFFER);
        if (currentTokens + fileTokens <= maxTokens * 0.9) { // Leave 10% buffer
            optimized.push(file);
            currentTokens += fileTokens;
        }
    }

    if (optimized.length < fileContents.length) {
        console.error(`📊 Optimized: ${fileContents.length} → ${optimized.length} files`);
    }

    return optimized;
}

export function estimateTokensForFiles(fileContents) {
    let totalChars = 0;
    for (const file of fileContents) {
        totalChars += file.path.length + file.content.length + 50;
    }
    return Math.round((totalChars / CONFIG.CHARS_PER_TOKEN) * CONFIG.TOKEN_ESTIMATION_BUFFER);
}

// Path validation and sanitization
export function validatePath(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path: must be a non-empty string');
    }
    
    // Prevent path traversal attacks
    if (filePath.includes('..') || filePath.includes('\0')) {
        throw new Error('Invalid file path: contains illegal characters');
    }
    
    // Prevent access to sensitive system files
    const normalizedLower = filePath.toLowerCase();
    const sensitivePatterns = ['/etc/passwd', '/etc/shadow', 'windows/system32', '.ssh/', '.env'];
    if (sensitivePatterns.some(pattern => normalizedLower.includes(pattern))) {
        throw new Error('Access denied: cannot read sensitive system files');
    }
    
    return filePath;
}

// Sanitize glob patterns to prevent security issues
export function sanitizePatterns(patterns) {
    return patterns.map(pattern => {
        // Remove leading slashes to prevent absolute path matching
        let sanitized = pattern.replace(/^[\/\\]+/, '');
        
        // Limit pattern length to prevent ReDoS attacks
        if (sanitized.length > 200) {
            throw new Error(`Pattern too long: ${sanitized.substring(0, 50)}... (max 200 chars)`);
        }
        
        // Count wildcards to prevent overly complex patterns
        const wildcardCount = (sanitized.match(/\*/g) || []).length;
        if (wildcardCount > 10) {
            throw new Error(`Pattern too complex: ${sanitized} (max 10 wildcards)`);
        }
        
        return sanitized;
    });
}

// Path normalization for cross-platform support (WSL <-> Windows)
export function normalizePath(filePath) {
    if (!filePath) return filePath;
    
    // Validate first for security
    validatePath(filePath);

    // Handle WSL paths when called from Windows
    if (platform() === 'win32' && filePath.startsWith('/mnt/')) {
        // Convert /mnt/c/path to C:/path
        const match = filePath.match(/^\/mnt\/([a-z])\/(.*)/i);
        if (match) {
            return `${match[1].toUpperCase()}:/${match[2]}`;
        }
    }

    // Handle Windows paths when called from WSL
    if (platform() !== 'win32' && /^[A-Z]:/i.test(filePath)) {
        // Convert C:/path to /mnt/c/path
        const match = filePath.match(/^([A-Z]):\/(.*)/i);
        if (match) {
            return `/mnt/${match[1].toLowerCase()}/${match[2].replace(/\\/g, '/')}`;
        }
    }

    // Normalize slashes
    return normalize(filePath).replace(/\\/g, '/');
}

class GrokBridgeMCP {
    constructor() {
        this.server = new McpServer({
            name: "grok-context-bridge",
            version: "1.0.0"
        });

        this.setupTools();
    }

    // Dynamic model validation with smart fallback
    async isModelAllowed(model) {
        // If auto-fetch is enabled, check against live API
        if (CONFIG.AUTO_FETCH_MODELS) {
            try {
                const availableModels = await getAvailableModels(process.env[CONFIG.API_KEY_ENV]);
                return availableModels.includes(model);
            } catch (error) {
                console.error(`⚠️  Could not fetch models for validation: ${error.message}`);
            }
        }

        // Fallback to configured models
        if (!CONFIG.ALLOWED_MODELS.length) {
            return model.startsWith('grok-');
        }

        // Check exact matches
        if (CONFIG.ALLOWED_MODELS.includes(model)) {
            return true;
        }

        // Check prefix matches for new models
        return CONFIG.ALLOWED_MODELS.some(allowed => {
            if (allowed.includes('latest')) {
                return model.startsWith(allowed.replace('-latest', ''));
            }
            return false;
        });
    }

    setupTools() {
        // Main tool: Send files/context to Grok
        this.server.tool(
            "send_to_grok",
            "Send files and context to Grok for analysis with large context window",
            {
                files: z.array(z.string()).optional().default([]).describe("Array of file paths to include"),
                prompt: z.string().describe("The question or task for Grok to perform"),
                model: z.string().optional()
                    .describe(`Grok model to use (default: ${CONFIG.DEFAULT_MODEL}). Can be any grok-* model.`),
                project_context: z.string().optional().describe("Additional project background information"),
                include_line_numbers: z.boolean().optional().describe("Include line numbers in file content (default: true)"),
                enable_iterative: z.boolean().optional().describe("Enable iterative refinement for better results (default: from env config)")
            },
            async ({
                       files = [],
                       prompt,
                       model = CONFIG.DEFAULT_MODEL,
                       project_context,
                       include_line_numbers = true,
                       enable_iterative
                   }) => {
                try {
                    // Validate model with smart suggestions
                    const isAllowed = await this.isModelAllowed(model);
                    if (!isAllowed) {
                        const availableModels = modelCache.models.length > 0
                            ? modelCache.models.slice(0, 5)
                            : CONFIG.ALLOWED_MODELS.slice(0, 5);

                        return {
                            content: [{
                                type: "text",
                                text: `❌ Model '${model}' is not available.\n\n` +
                                    `**Suggested models:**\n${availableModels.map(m => `- ${m}`).join('\n')}\n\n` +
                                    `${modelCache.fallbackUsed ? '📋 Using cached model list. Set AUTO_FETCH_MODELS=true for live updates.' : '✅ Live model list from Grok API'}`
                            }]
                        };
                    }

                    // Normalize file paths
                    const normalizedFiles = files.map(f => normalizePath(f));

                    // Collect and process files
                    const fileContents = await this.collectFiles(normalizedFiles);

                    // If no files provided, that's okay - we can still send just the prompt
                    if (files.length > 0 && fileContents.length === 0) {
                        return {
                            content: [{
                                type: "text",
                                text: "❌ No valid files found to analyze. Please check the file paths.\n\nNote: Paths are normalized for cross-platform support (WSL ↔ Windows)."
                            }]
                        };
                    }

                    // Auto-optimize context if needed
                    let optimizedFiles = optimizeContext(fileContents, CONFIG.MAX_TOTAL_TOKENS);
                    const estimatedTokens = this.estimateTokens(optimizedFiles, prompt, project_context);

                    if (estimatedTokens > CONFIG.MAX_TOTAL_TOKENS) {
                        const smartError = createSmartError(
                            new Error('Context too large even after optimization'),
                            {
                                originalFiles: fileContents.length,
                                optimizedFiles: optimizedFiles.length,
                                estimatedTokens,
                                maxTokens: CONFIG.MAX_TOTAL_TOKENS
                            }
                        );

                        return {
                            content: [{
                                type: "text",
                                text: `❌ Context too large: ~${estimatedTokens.toLocaleString()} tokens (max: ${CONFIG.MAX_TOTAL_TOKENS.toLocaleString()})\n\n` +
                                    `**Auto-optimization attempted:** ${fileContents.length} → ${optimizedFiles.length} files\n\n` +
                                    `**Suggestions:**\n${smartError.suggestions.map(s => `- ${s}`).join('\n')}`
                            }]
                        };
                    }

                    // Format context for Grok
                    const formattedContext = this.formatContext(optimizedFiles, project_context, include_line_numbers);
                    const fullPrompt = `${formattedContext}\n\n# Task\n${prompt}`;

                    // Send to Grok
                    const startTime = Date.now();
                    const result = await this.queryGrok(model, fullPrompt, enable_iterative);
                    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

                    const optimizationNote = optimizedFiles.length < fileContents.length
                        ? ` (optimized from ${fileContents.length})`
                        : '';

                    return {
                        content: [{
                            type: "text",
                            text: `✅ **Grok ${model} Analysis**\n` +
                                `📊 ${optimizedFiles.length} files${optimizationNote} | ~${estimatedTokens.toLocaleString()} tokens | ${elapsedTime}s\n\n` +
                                `${result}`
                        }]
                    };

                } catch (error) {
                    const smartError = createSmartError(error, {model, files: files.length});

                    return {
                        content: [{
                            type: "text",
                            text: `❌ **${smartError.type.toUpperCase()} Error:** ${smartError.message}\n\n` +
                                `**Suggestions:**\n${smartError.suggestions.map(s => `- ${s}`).join('\n')}\n\n` +
                                `💡 Use \`get_system_info\` for detailed diagnostics.`
                        }]
                    };
                }
            }
        );

        // Utility tool: Estimate tokens before sending
        this.server.tool(
            "estimate_context_size",
            "Estimate token count for files before sending to Grok",
            {
                files: z.array(z.string()).optional().default([]).describe("Array of file paths to analyze"),
                include_project_context: z.boolean().optional().describe("Include space for project context in estimate"),
                show_estimation_details: z.boolean().optional().describe("Show token estimation calculation details")
            },
            async ({files = [], include_project_context = false, show_estimation_details = false}) => {
                try {
                    // Normalize file paths
                    const normalizedFiles = files.map(f => normalizePath(f));

                    const fileContents = await this.collectFiles(normalizedFiles);
                    const contextBuffer = include_project_context ? 5000 : 0; // Reserve tokens for context
                    const estimatedTokens = this.estimateTokens(fileContents) + contextBuffer;

                    const fileStats = fileContents.map(f => ({
                        path: f.path,
                        size: `${Math.round(f.content.length / 1024)}KB`,
                        chars: f.content.length,
                        tokens: Math.round(f.content.length / CONFIG.CHARS_PER_TOKEN * CONFIG.TOKEN_ESTIMATION_BUFFER)
                    })).sort((a, b) => b.tokens - a.tokens);

                    const totalSize = fileContents.reduce((sum, f) => sum + f.content.length, 0);

                    let response = `📊 **Context Size Estimation**\n\n` +
                        `**Total estimated tokens:** ${estimatedTokens.toLocaleString()}${include_project_context ? ' (includes context buffer)' : ''}\n` +
                        `**Total file size:** ${Math.round(totalSize / 1024)}KB\n` +
                        `**Files analyzed:** ${fileContents.length}\n` +
                        `**Status:** ${estimatedTokens > CONFIG.MAX_TOTAL_TOKENS ? '❌ Too large' : '✅ Within limits'}\n`;

                    if (show_estimation_details) {
                        response += `\n**Estimation method:**\n` +
                            `- Base: ${CONFIG.CHARS_PER_TOKEN} characters per token\n` +
                            `- Buffer: ${((CONFIG.TOKEN_ESTIMATION_BUFFER - 1) * 100).toFixed(0)}% safety margin\n` +
                            `- Note: This is an approximation. Actual tokens depend on content type.\n`;
                    }

                    response += `\n**Largest files:**\n` +
                        fileStats.slice(0, 10).map(f => `- ${f.path}: ${f.size} (~${f.tokens.toLocaleString()} tokens)`).join('\n') +
                        (fileStats.length > 10 ? `\n... and ${fileStats.length - 10} more files` : '');

                    return {
                        content: [{
                            type: "text",
                            text: response
                        }]
                    };
                } catch (error) {
                    return {
                        content: [{
                            type: "text",
                            text: `❌ Error estimating context: ${error.message}`
                        }]
                    };
                }
            }
        );

        // Utility tool: Smart file discovery
        this.server.tool(
            "find_relevant_files",
            "Discover relevant files in a directory for analysis (automatically detects text files)",
            {
                directory: z.string().describe("Directory path to scan"),
                include_patterns: z.array(z.string()).optional().describe("Glob patterns to include (e.g., ['**/*.js', 'src/**/*.{ts,tsx}'])"),
                exclude_patterns: z.array(z.string()).optional().describe("Glob patterns to exclude (e.g., ['**/test/**', '**/*.spec.*'])"),
                max_files: z.number().optional().describe(`Maximum number of files to return (default: ${CONFIG.DEFAULT_MAX_FILES})`)
            },
            async ({directory, include_patterns = [], exclude_patterns = [], max_files = CONFIG.DEFAULT_MAX_FILES}) => {
                try {
                    // Sanitize and normalize patterns
                    const sanitizedIncludes = sanitizePatterns(include_patterns);
                    const sanitizedExcludes = sanitizePatterns(exclude_patterns);
                    
                    // Normalize directory path
                    const normalizedDir = normalizePath(directory);

                    const files = await this.findFiles(normalizedDir, sanitizedIncludes, sanitizedExcludes, max_files);

                    if (files.length === 0) {
                        return {
                            content: [{
                                type: "text",
                                text: `📁 No readable text files found in ${normalizedDir}\n\nNote: Binary files and common media/archive formats are automatically excluded.\nPath normalized from '${directory}'`
                            }]
                        };
                    }

                    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
                    const estimatedTokens = Math.round(totalSize / CONFIG.CHARS_PER_TOKEN * CONFIG.TOKEN_ESTIMATION_BUFFER);

                    // Group files by extension
                    const byExtension = {};
                    files.forEach(f => {
                        const ext = extname(f.path);
                        if (!byExtension[ext]) byExtension[ext] = 0;
                        byExtension[ext]++;
                    });

                    return {
                        content: [{
                            type: "text",
                            text: `📁 **Found ${files.length} files in ${normalizedDir}**\n\n` +
                                `**Total size:** ${Math.round(totalSize / 1024)}KB (~${estimatedTokens.toLocaleString()} tokens)\n` +
                                `**By type:** ${Object.entries(byExtension).map(([ext, count]) => `${ext}: ${count}`).join(', ')}\n\n` +
                                `**Files:**\n` +
                                files.slice(0, 20).map(f => `- ${f.relativePath} (${Math.round(f.size / 1024)}KB)`).join('\n') +
                                (files.length > 20 ? `\n... and ${files.length - 20} more files\n` : '\n') +
                                `\nUse \`send_to_grok\` with these file paths for analysis.`
                        }]
                    };
                } catch (error) {
                    return {
                        content: [{
                            type: "text",
                            text: `❌ Error scanning directory: ${error.message}\n\nMake sure the directory path is valid and accessible.`
                        }]
                    };
                }
            }
        );

        // Utility tool: Analyze specific code patterns
        this.server.tool(
            "analyze_code_patterns",
            "Use Grok to analyze specific code patterns or architectural decisions across files",
            {
                pattern_type: z.enum([
                    "architecture",
                    "security",
                    "performance",
                    "testing",
                    "documentation",
                    "dependencies",
                    "code_quality"
                ]).describe("Type of pattern analysis to perform"),
                files: z.array(z.string()).optional().default([]).describe("Files to analyze for patterns"),
                specific_focus: z.string().optional().describe("Specific aspect to focus on"),
                model: z.string().optional().describe("Override the default model for this analysis")
            },
            async ({pattern_type, files = [], specific_focus, model}) => {
                const prompts = {
                    architecture: "Analyze the architectural patterns, design decisions, and overall code organization. Identify strengths, weaknesses, and improvement opportunities.",
                    security: "Perform a security audit looking for vulnerabilities, insecure practices, exposed secrets, injection risks, and authentication/authorization issues.",
                    performance: "Analyze performance bottlenecks, inefficient algorithms, memory leaks, unnecessary computations, and optimization opportunities.",
                    testing: "Review test coverage, test quality, missing test cases, and testing best practices. Suggest improvements to the test suite.",
                    documentation: "Evaluate code documentation, missing comments, unclear naming, and areas needing better explanation. Suggest documentation improvements.",
                    dependencies: "Analyze dependency usage, outdated packages, security vulnerabilities in dependencies, and unnecessary dependencies.",
                    code_quality: "Review code quality, adherence to best practices, code smells, duplication, and maintainability issues."
                };

                const prompt = `${prompts[pattern_type]}${specific_focus ? `\n\nSpecific focus: ${specific_focus}` : ''}\n\nProvide actionable recommendations with code examples where applicable.`;

                // Use the default model for pattern analysis if not specified
                const analysisModel = model || CONFIG.DEFAULT_MODEL;

                // Normalize file paths and prepare for analysis
                const normalizedFiles = files.map(f => normalizePath(f));
                
                try {
                    // Collect and process files
                    const fileContents = await this.collectFiles(normalizedFiles);
                    
                    if (files.length > 0 && fileContents.length === 0) {
                        return {
                            content: [{
                                type: "text",
                                text: "❌ No valid files found to analyze. Please check the file paths."
                            }]
                        };
                    }
                    
                    if (fileContents.length === 0) {
                        return {
                            content: [{
                                type: "text",
                                text: "❌ No files provided for pattern analysis. Please provide file paths to analyze."
                            }]
                        };
                    }

                    // Auto-optimize context if needed
                    let optimizedFiles = optimizeContext(fileContents, CONFIG.MAX_TOTAL_TOKENS);
                    const estimatedTokens = this.estimateTokens(optimizedFiles, prompt);

                    if (estimatedTokens > CONFIG.MAX_TOTAL_TOKENS) {
                        return {
                            content: [{
                                type: "text",
                                text: `❌ Context too large: ~${estimatedTokens.toLocaleString()} tokens (max: ${CONFIG.MAX_TOTAL_TOKENS.toLocaleString()})\n\nTry reducing the number of files or excluding test/documentation files.`
                            }]
                        };
                    }

                    // Format context and send to Grok
                    const formattedContext = this.formatContext(optimizedFiles, null, true);
                    const fullPrompt = `${formattedContext}\n\n# Task\n${prompt}`;

                    const startTime = Date.now();
                    const result = await this.queryGrok(analysisModel, fullPrompt);
                    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

                    return {
                        content: [{
                            type: "text",
                            text: `✅ **Grok ${analysisModel} Pattern Analysis**\n` +
                                `📊 ${optimizedFiles.length} files | ~${estimatedTokens.toLocaleString()} tokens | ${elapsedTime}s\n\n` +
                                `${result}`
                        }]
                    };
                } catch (error) {
                    const smartError = createSmartError(error, {model: analysisModel, files: files.length});
                    return {
                        content: [{
                            type: "text",
                            text: `❌ **${smartError.type.toUpperCase()} Error:** ${smartError.message}\n\n` +
                                `**Suggestions:**\n${smartError.suggestions.map(s => `- ${s}`).join('\n')}`
                        }]
                    };
                }
            }
        );

        // System info tool for debugging
        this.server.tool(
            "get_system_info",
            "Get comprehensive system information and diagnostics",
            {
                include_models: z.boolean().optional().describe("Fetch live model information (default: true)")
            },
            async ({include_models = true}) => {
                const info = {
                    platform: platform(),
                    nodeVersion: process.version,
                    config: {
                        apiBaseUrl: CONFIG.API_BASE_URL,
                        apiKeyEnv: CONFIG.API_KEY_ENV,
                        maxFileSize: `${Math.round(CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB`,
                        maxTokens: CONFIG.MAX_TOTAL_TOKENS.toLocaleString(),
                        defaultModel: CONFIG.DEFAULT_MODEL,
                        smartFeatures: {
                            autoFetchModels: CONFIG.AUTO_FETCH_MODELS,
                            smartRecovery: CONFIG.ENABLE_SMART_RECOVERY,
                            autoOptimization: CONFIG.ENABLE_AUTO_OPTIMIZATION,
                            iterativeRefinement: CONFIG.ENABLE_ITERATIVE_REFINEMENT
                        },
                        tokenEstimation: `${CONFIG.CHARS_PER_TOKEN} chars/token with ${((CONFIG.TOKEN_ESTIMATION_BUFFER - 1) * 100).toFixed(0)}% buffer`,
                        excludedExtensions: CONFIG.EXCLUDED_EXTENSIONS.length,
                        forceTextExtensions: CONFIG.FORCE_TEXT_EXTENSIONS.join(', '),
                        excludedDirs: CONFIG.EXCLUDED_DIRS.join(', ')
                    },
                    paths: {
                        example: platform() === 'win32' ? 'C:/Users/project' : '/home/user/project',
                        normalized: platform() === 'win32' ? '/mnt/c/Users/project (from WSL)' : 'C:/Users/project (from Windows)'
                    }
                };

                let modelInfo = '';
                if (include_models) {
                    try {
                        const models = await getAvailableModels(process.env[CONFIG.API_KEY_ENV]);
                        const cacheStatus = modelCache.fallbackUsed 
                            ? `Using DEFAULT_MODEL (API failed: ${modelCache.error || 'unknown error'})` 
                            : 'Live from API';
                            
                        if (models.length === 1 && models[0] === CONFIG.DEFAULT_MODEL && modelCache.fallbackUsed) {
                            modelInfo = `\n\n⚠️ **Model API Issue:**\n` +
                                `- API Error: ${modelCache.error}\n` +
                                `- Using DEFAULT_MODEL: ${CONFIG.DEFAULT_MODEL}\n` +
                                `- Fix: Check ${CONFIG.API_KEY_ENV} and network connectivity\n\n` +
                                `📊 **Model Status:** ${cacheStatus} (${Math.round((Date.now() - modelCache.timestamp) / 60000)}m ago)`;
                        } else {
                            modelInfo = `\n\n**Available Models (${models.length}):**\n` +
                                models.slice(0, 10).map(m => `- ${m}`).join('\n') +
                                (models.length > 10 ? `\n... and ${models.length - 10} more` : '') +
                                `\n\n📊 **Model Cache:** ${cacheStatus} (updated ${Math.round((Date.now() - modelCache.timestamp) / 60000)}m ago)`;
                        }
                    } catch (error) {
                        modelInfo = `\n\n⚠️ **Model Info Error:** ${error.message}\n` +
                            `- Check your ${CONFIG.API_KEY_ENV} environment variable\n` +
                            `- Verify network connectivity to Grok API`;
                    }
                }

                return {
                    content: [{
                        type: "text",
                        text: `🖥️ **Grok Bridge System Info v1.0.0**\n\n` +
                            `**Platform:** ${info.platform}\n` +
                            `**Node Version:** ${info.nodeVersion}\n\n` +
                            `**Configuration:**\n` +
                            `- API Base URL: ${info.config.apiBaseUrl}\n` +
                            `- API Key Env: ${info.config.apiKeyEnv}\n` +
                            `- Max File Size: ${info.config.maxFileSize}\n` +
                            `- Max Tokens: ${info.config.maxTokens}\n` +
                            `- Default Model: ${info.config.defaultModel}\n` +
                            `- Token Estimation: ${info.config.tokenEstimation}\n` +
                            `- Excluded Extensions: ${info.config.excludedExtensions} types\n` +
                            `- Force Text: ${info.config.forceTextExtensions}\n` +
                            `- Excluded Dirs: ${info.config.excludedDirs}\n\n` +
                            `**Smart Features:**\n` +
                            `- 🤖 Auto Fetch Models: ${info.config.smartFeatures.autoFetchModels ? '✅' : '❌'}\n` +
                            `- 🔧 Auto Optimization: ${info.config.smartFeatures.autoOptimization ? '✅' : '❌'}\n` +
                            `- 🚨 Smart Recovery: ${info.config.smartFeatures.smartRecovery ? '✅' : '❌'}\n` +
                            `- 🔄 Iterative Refinement: ${info.config.smartFeatures.iterativeRefinement ? '✅' : '❌'}\n\n` +
                            `**Path Normalization:**\n` +
                            `- Input: ${info.paths.example}\n` +
                            `- Normalized: ${info.paths.normalized}` +
                            modelInfo
                    }]
                };
            }
        );
    }

    async collectFiles(filePaths) {
        const results = [];
        const errors = [];

        for (const filePath of filePaths) {
            try {
                const resolvedPath = resolve(filePath);
                const stats = await stat(resolvedPath);

                if (stats.isDirectory()) {
                    // If directory, collect readable files recursively
                    const dirFiles = await this.findFiles(resolvedPath, [], [], 1000);
                    for (const dirFile of dirFiles) {
                        try {
                            const content = await readFile(dirFile.path, 'utf-8');
                            results.push({
                                path: dirFile.path,
                                relativePath: dirFile.relativePath,
                                content
                            });
                        } catch (err) {
                            errors.push(`Cannot read ${dirFile.path}: ${err.message}`);
                        }
                    }
                } else if (stats.size <= CONFIG.MAX_FILE_SIZE) {
                    // Check if file should be included
                    const ext = extname(resolvedPath).toLowerCase();
                    const isForceText = CONFIG.FORCE_TEXT_EXTENSIONS.includes(ext);
                    const isExcluded = CONFIG.EXCLUDED_EXTENSIONS.includes(ext);

                    if (isExcluded) {
                        errors.push(`Skipping excluded file type: ${filePath}`);
                    } else {
                        const isBinary = isForceText ? false : await isBinaryFile(resolvedPath, CONFIG.BINARY_CHECK_BYTES);
                        if (isBinary) {
                            errors.push(`Skipping binary file: ${filePath}`);
                        } else {
                            try {
                                const content = await readFile(resolvedPath, 'utf-8');
                                results.push({
                                    path: resolvedPath,
                                    relativePath: filePath,
                                    content
                                });
                            } catch (err) {
                                errors.push(`Cannot read ${filePath}: ${err.message}`);
                            }
                        }
                    }
                } else {
                    errors.push(`File too large: ${filePath} (${Math.round(stats.size / 1024 / 1024)}MB, max: ${Math.round(CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB)`);
                }
            } catch (error) {
                errors.push(`Cannot access ${filePath}: ${error.message}`);
            }
        }

        if (errors.length > 0) {
            console.error('File collection warnings:', errors);
        }

        return results;
    }

    async findFiles(directory, includePatterns = [], excludePatterns = [], maxFiles = 100) {
        const results = [];

        const scanDir = async (dir, depth = 0) => {
            if (depth > CONFIG.MAX_RECURSION_DEPTH || results.length >= maxFiles) return;

            try {
                const entries = await readdir(dir);

                for (const entry of entries) {
                    if (CONFIG.EXCLUDED_DIRS.includes(entry) || entry.startsWith('.')) continue;

                    const fullPath = join(dir, entry);
                    const relativePath = relative(directory, fullPath).replace(/\\/g, '/');
                    
                    const stats = await stat(fullPath);

                    if (stats.isDirectory()) {
                        // For directories, only check exclude patterns to skip entire directory trees
                        if (excludePatterns.length > 0) {
                            if (micromatch.any(relativePath, excludePatterns)) continue;
                        }
                        await scanDir(fullPath, depth + 1);
                    } else if (stats.size <= CONFIG.MAX_FILE_SIZE) {
                        // For files, check both include and exclude patterns first
                        
                        // Check include patterns first (if any specified)
                        if (includePatterns.length > 0) {
                            if (!micromatch.any(relativePath, includePatterns)) continue;
                        }

                        // Check exclude patterns
                        if (excludePatterns.length > 0) {
                            if (micromatch.any(relativePath, excludePatterns)) continue;
                        }
                        
                        // Check if extension is explicitly excluded
                        const ext = extname(entry).toLowerCase();
                        if (CONFIG.EXCLUDED_EXTENSIONS.includes(ext)) continue;

                        // Check if it's a force-text extension or non-binary
                        const isForceText = CONFIG.FORCE_TEXT_EXTENSIONS.includes(ext);
                        const isBinary = isForceText ? false : await isBinaryFile(fullPath, CONFIG.BINARY_CHECK_BYTES);

                        if (!isBinary) {
                            results.push({
                                path: fullPath,
                                relativePath,
                                size: stats.size,
                                isForceText
                            });

                            if (results.length >= maxFiles) return;
                        }
                    }
                }
            } catch (error) {
                // Skip directories we can't read
                console.error(`Cannot read directory ${dir}: ${error.message}`);
            }
        };

        await scanDir(directory);
        return results.slice(0, maxFiles);
    }

    formatContext(fileContents, projectContext, includeLineNumbers = true) {
        let context = "";

        if (projectContext) {
            context += `# Project Context\n${projectContext}\n\n`;
        }

        context += "# Files for Analysis\n\n";

        for (const file of fileContents) {
            const lang = this.getLanguageFromExtension(extname(file.path));

            if (includeLineNumbers && file.content.includes('\n')) {
                const lines = file.content.split('\n');
                const numberedContent = lines.map((line, idx) => `${(idx + 1).toString().padStart(4, ' ')} | ${line}`).join('\n');
                context += `## ${file.path}\n\`\`\`${lang}\n${numberedContent}\n\`\`\`\n\n`;
            } else {
                context += `## ${file.path}\n\`\`\`${lang}\n${file.content}\n\`\`\`\n\n`;
            }
        }

        return context;
    }

    getLanguageFromExtension(ext) {
        const langMap = {
            '.js': 'javascript', '.ts': 'typescript', '.jsx': 'jsx', '.tsx': 'tsx',
            '.py': 'python', '.java': 'java', '.cs': 'csharp', '.go': 'go',
            '.rs': 'rust', '.cpp': 'cpp', '.c': 'c', '.h': 'c',
            '.md': 'markdown', '.json': 'json', '.yaml': 'yaml', '.yml': 'yaml',
            '.xml': 'xml', '.html': 'html', '.css': 'css', '.scss': 'scss',
            '.vue': 'vue', '.svelte': 'svelte'
        };
        return langMap[ext.toLowerCase()] || 'text';
    }

    estimateTokens(fileContents, prompt = "", projectContext = "") {
        let totalChars = 0;

        if (projectContext) totalChars += projectContext.length;
        if (prompt) totalChars += prompt.length;

        for (const file of fileContents) {
            totalChars += file.path.length + file.content.length + 50; // Add formatting overhead
        }

        // Configurable estimation with buffer
        return Math.round((totalChars / CONFIG.CHARS_PER_TOKEN) * CONFIG.TOKEN_ESTIMATION_BUFFER);
    }

    async queryGrok(modelName, prompt, enableIterative = CONFIG.ENABLE_ITERATIVE_REFINEMENT) {
        try {
            const apiKey = process.env[CONFIG.API_KEY_ENV];
            if (!apiKey) {
                throw new Error(`${CONFIG.API_KEY_ENV} environment variable is required`);
            }

            const requestBody = {
                model: modelName,
                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: CONFIG.TEMPERATURE,
                top_p: CONFIG.TOP_P,
                max_tokens: CONFIG.MAX_OUTPUT_TOKENS,
            };

            // Initial query
            let response = await fetch(`${CONFIG.API_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(300000) // 5 minute timeout for chat completions
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Grok API returned ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            
            if (!result.choices || !result.choices[0] || !result.choices[0].message) {
                throw new Error('No response generated from Grok');
            }

            let finalResponse = result.choices[0].message.content;

            // Iterative refinement if enabled
            if (enableIterative) {
                let iterations = 0;
                let shouldRefine = this.checkNeedsRefinement(finalResponse);

                while (shouldRefine && iterations < CONFIG.MAX_ITERATIONS) {
                    iterations++;
                    console.error(`Performing iterative refinement (iteration ${iterations})...`);

                    const refinementPrompt = `${CONFIG.ITERATION_PROMPT_PREFIX}\n\nPrevious response:\n${finalResponse}\n\nOriginal task:\n${prompt}`;

                    const refinementBody = {
                        ...requestBody,
                        messages: [
                            {
                                role: "user",
                                content: refinementPrompt
                            }
                        ]
                    };

                    response = await fetch(`${CONFIG.API_BASE_URL}/chat/completions`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(refinementBody),
                        signal: AbortSignal.timeout(300000) // 5 minute timeout for refinement
                    });

                    if (response.ok) {
                        const refinedResult = await response.json();
                        if (refinedResult.choices && refinedResult.choices[0] && refinedResult.choices[0].message) {
                            finalResponse = refinedResult.choices[0].message.content;
                            shouldRefine = this.checkNeedsRefinement(finalResponse);
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
            }

            return finalResponse;
        } catch (error) {
            if (error.message?.includes('API key') || error.message?.includes('unauthorized')) {
                throw new Error(`Invalid or missing ${CONFIG.API_KEY_ENV}`);
            } else if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
                throw new Error('API quota exceeded. Please check your Grok API usage.');
            } else if (error.message?.includes('model')) {
                throw new Error(`Model ${modelName} not available. Try updating DEFAULT_MODEL in your environment.`);
            }
            throw error;
        }
    }

    checkNeedsRefinement(response) {
        if (!response || response.length < 100) return true; // Too short

        const lowerResponse = response.toLowerCase();
        return CONFIG.ITERATION_TRIGGERS.some(trigger => lowerResponse.includes(trigger));
    }

    async start() {
        if (!process.env[CONFIG.API_KEY_ENV]) {
            console.error(`ERROR: ${CONFIG.API_KEY_ENV} environment variable is required`);
            console.error("Please set it in your MCP server configuration or environment");
            process.exit(1);
        }

        // Initialize model cache in background
        if (CONFIG.AUTO_FETCH_MODELS) {
            getAvailableModels(process.env[CONFIG.API_KEY_ENV]).catch(() => {
                // Fallback already handled in the function
            });
        }

        const transport = new StdioServerTransport();
        await this.server.connect(transport);

        // Log startup info to stderr with smart features
        console.error(`🚀 Grok Bridge MCP Server v1.0.0 started`);
        console.error(`📍 Platform: ${platform()}`);
        console.error(`🤖 Model: ${CONFIG.DEFAULT_MODEL}`);
        console.error(`🌐 API: ${CONFIG.API_BASE_URL}`);
        console.error(`📁 Max file size: ${Math.round(CONFIG.MAX_FILE_SIZE / 1024 / 1024)}MB`);
        console.error(`🎯 Max context: ~${CONFIG.MAX_TOTAL_TOKENS.toLocaleString()} tokens`);
        console.error(`📊 Token estimation: ${CONFIG.CHARS_PER_TOKEN} chars/token with ${((CONFIG.TOKEN_ESTIMATION_BUFFER - 1) * 100).toFixed(0)}% buffer`);

        const smartFeatures = [];
        if (CONFIG.AUTO_FETCH_MODELS) smartFeatures.push('Auto-Models');
        if (CONFIG.ENABLE_AUTO_OPTIMIZATION) smartFeatures.push('Auto-Optimize');
        if (CONFIG.ENABLE_SMART_RECOVERY) smartFeatures.push('Smart-Errors');
        if (CONFIG.ENABLE_ITERATIVE_REFINEMENT) smartFeatures.push('Iterative');

        if (smartFeatures.length > 0) {
            console.error(`⚡ Smart features: ${smartFeatures.join(', ')}`);
        }
    }
}

// Only start the server if this file is run directly (not imported for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new GrokBridgeMCP();
    server.start().catch(error => {
        console.error("Failed to start MCP server:", error);
        process.exit(1);
    });
}

// Export the server class for testing
export { GrokBridgeMCP };
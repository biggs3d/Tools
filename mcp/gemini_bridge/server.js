#!/usr/bin/env node

// Load .env file configuration
import 'dotenv/config';

import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import {GoogleGenerativeAI} from "@google/generative-ai";
import {readFile, readdir, stat, open} from "fs/promises";
import {join, extname, relative, resolve, normalize} from "path";
import {platform} from "os";
import {z} from "zod";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuration - all env-driven with sensible defaults
export const CONFIG = {
    // File handling
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 26214400, // 25MB default
    MAX_TOTAL_TOKENS: parseInt(process.env.MAX_TOTAL_TOKENS) || 900000, // Leave room in 1M context

    // Models - flexible configuration
    DEFAULT_MODEL: process.env.DEFAULT_MODEL || "gemini-2.0-flash-exp",
    ALLOWED_MODELS: process.env.ALLOWED_MODELS?.split(',').map(m => m.trim()) || [
        "gemini-2.0-flash-exp",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro",
        "gemini-2.0-flash",
        // Add any model that starts with gemini-2.5 (experimental)
        "gemini-2.5-pro-preview",
        "gemini-2.5-flash-preview"
    ],

    // Token estimation
    CHARS_PER_TOKEN: parseFloat(process.env.CHARS_PER_TOKEN) || 4, // Approximation: 1 token ≈ 4 chars
    TOKEN_ESTIMATION_BUFFER: parseFloat(process.env.TOKEN_ESTIMATION_BUFFER) || 1.2, // Add 20% buffer for safety

    // File discovery
    EXCLUDED_EXTENSIONS: process.env.EXCLUDED_EXTENSIONS?.split(',').map(e => e.trim()) || [
        '.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.rar', '.7z',
        '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.ico', '.webp',
        '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
        '.woff', '.woff2', '.ttf', '.eot', '.otf',
        '.db', '.sqlite', '.lock'
    ],
    // Extensions that should be treated as text even if they might appear binary
    FORCE_TEXT_EXTENSIONS: process.env.FORCE_TEXT_EXTENSIONS?.split(',').map(e => e.trim()) || [
        '.pdf', '.svg'
    ],
    EXCLUDED_DIRS: process.env.EXCLUDED_DIRS?.split(',').map(d => d.trim()) || [
        'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.nuxt',
        'vendor', '__pycache__', '.pytest_cache', 'venv', '.venv'
    ],
    BINARY_CHECK_BYTES: parseInt(process.env.BINARY_CHECK_BYTES) || 8192, // Check first 8KB for binary content

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

// Fetch available models from Gemini API
export async function fetchAvailableModels(apiKey) {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`Gemini API returned ${response.status}. Check your GEMINI_API_KEY and API access.`);
        }

        const data = await response.json();
        const models = data.models
            .filter(model => model.name.includes('gemini'))
            .map(model => model.name.replace('models/', ''))
            .sort();

        modelCache = {
            models,
            timestamp: Date.now(),
            fallbackUsed: false
        };

        console.error(`✅ Fetched ${models.length} models from Gemini API`);
        return models;
    } catch (error) {
        console.error(`⚠️  Failed to fetch models from API: ${error.message}`);
        console.error(`📋 Using configured DEFAULT_MODEL: ${CONFIG.DEFAULT_MODEL}`);
        
        // Return empty array to indicate API failure, but don't crash
        // The system will use DEFAULT_MODEL from .env
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

    if (msg.includes('api key') || msg.includes('authentication')) return 'auth';
    if (msg.includes('quota') || msg.includes('rate limit')) return 'quota';
    if (msg.includes('model') || msg.includes('not found')) return 'model';
    if (msg.includes('context') || msg.includes('token')) return 'context';
    if (msg.includes('file') || msg.includes('access')) return 'file';
    if (msg.includes('network') || msg.includes('connection')) return 'network';

    return 'unknown';
}

function getErrorSuggestions(errorType, context) {
    const suggestions = {
        auth: [
            'Check that GEMINI_API_KEY is set correctly',
            'Verify your API key at https://aistudio.google.com/',
            'Ensure the API key has the correct permissions'
        ],
        quota: [
            'Check your usage at https://aistudio.google.com/',
            'Consider using a less powerful model temporarily',
            'Try again in a few minutes',
            'Review your rate limits and quotas'
        ],
        model: [
            'Use get_system_info to see available models',
            'Try using gemini-1.5-flash as a fallback',
            `Available models in cache: ${modelCache.models.slice(0, 3).join(', ')}...`,
            'Check if the model name includes version suffix'
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
        '.js': 3, '.ts': 3, '.py': 3, '.go': 3, '.rs': 3, '.cs': 3, // Added .cs
        '.h': 3, '.hh': 3, '.hpp': 3, '.hxx': 3, '.cpp': 3, // Added C++ headers and .cpp
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

// Path normalization for cross-platform support (WSL <-> Windows)
export function normalizePath(filePath) {
    if (!filePath) return filePath;

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

class GeminiBridgeMCP {
    constructor() {
        this.server = new McpServer({
            name: "gemini-context-bridge",
            version: "1.0.1"
        });

        this.setupTools();
    }

    // Dynamic model validation with smart fallback
    async isModelAllowed(model) {
        // If auto-fetch is enabled, check against live API
        if (CONFIG.AUTO_FETCH_MODELS) {
            try {
                const availableModels = await getAvailableModels(process.env.GEMINI_API_KEY);
                return availableModels.includes(model);
            } catch (error) {
                console.error(`⚠️  Could not fetch models for validation: ${error.message}`);
            }
        }

        // Fallback to configured models
        if (!CONFIG.ALLOWED_MODELS.length) {
            return model.startsWith('gemini-');
        }

        // Check exact matches
        if (CONFIG.ALLOWED_MODELS.includes(model)) {
            return true;
        }

        // Check prefix matches for experimental models
        return CONFIG.ALLOWED_MODELS.some(allowed => {
            if (allowed.endsWith('-preview')) {
                return model.startsWith(allowed);
            }
            return false;
        });
    }

    setupTools() {
        // Main tool: Send files/context to Gemini
        this.server.tool(
            "send_to_gemini",
            "Send files and context to Gemini for analysis with large context window (up to 2M tokens)",
            {
                files: z.array(z.string()).describe("Array of file paths to include"),
                prompt: z.string().describe("The question or task for Gemini to perform"),
                model: z.string().optional()
                    .describe(`Gemini model to use (default: ${CONFIG.DEFAULT_MODEL}). Can be any gemini-* model.`),
                project_context: z.string().optional().describe("Additional project background information"),
                include_line_numbers: z.boolean().optional().describe("Include line numbers in file content (default: true)"),
                enable_iterative: z.boolean().optional().describe("Enable iterative refinement for better results (default: from env config)")
            },
            async ({
                       files,
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
                                    `${modelCache.fallbackUsed ? '📋 Using cached model list. Set AUTO_FETCH_MODELS=true for live updates.' : '✅ Live model list from Gemini API'}`
                            }]
                        };
                    }

                    // Normalize file paths
                    const normalizedFiles = files.map(f => normalizePath(f));

                    // Collect and process files
                    const fileContents = await this.collectFiles(normalizedFiles);

                    if (fileContents.length === 0) {
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

                    // Format context for Gemini
                    const formattedContext = this.formatContext(optimizedFiles, project_context, include_line_numbers);
                    const fullPrompt = `${formattedContext}\n\n# Task\n${prompt}`;

                    // Send to Gemini
                    const startTime = Date.now();
                    const result = await this.queryGemini(model, fullPrompt, enable_iterative);
                    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

                    const optimizationNote = optimizedFiles.length < fileContents.length
                        ? ` (optimized from ${fileContents.length})`
                        : '';

                    return {
                        content: [{
                            type: "text",
                            text: `✅ **Gemini ${model} Analysis**\n` +
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
            "Estimate token count for files before sending to Gemini",
            {
                files: z.array(z.string()).describe("Array of file paths to analyze"),
                include_project_context: z.boolean().optional().describe("Include space for project context in estimate"),
                show_estimation_details: z.boolean().optional().describe("Show token estimation calculation details")
            },
            async ({files, include_project_context = false, show_estimation_details = false}) => {
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
                exclude_patterns: z.array(z.string()).optional().describe("Patterns to exclude (e.g., ['test', 'spec'])"),
                max_files: z.number().optional().describe(`Maximum number of files to return (default: ${CONFIG.DEFAULT_MAX_FILES})`)
            },
            async ({directory, exclude_patterns = [], max_files = CONFIG.DEFAULT_MAX_FILES}) => {
                try {
                    // Normalize directory path
                    const normalizedDir = normalizePath(directory);

                    const files = await this.findFiles(normalizedDir, exclude_patterns, max_files);

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
                                `\nUse \`send_to_gemini\` with these file paths for analysis.`
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
            "Use Gemini to analyze specific code patterns or architectural decisions across files",
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
                files: z.array(z.string()).describe("Files to analyze for patterns"),
                specific_focus: z.string().optional().describe("Specific aspect to focus on"),
                model: z.string().optional().describe("Override the default model for this analysis")
            },
            async ({pattern_type, files, specific_focus, model}) => {
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

                // Use a more powerful model for pattern analysis if not specified
                const analysisModel = model || process.env.PATTERN_ANALYSIS_MODEL || "gemini-1.5-pro";

                // Normalize file paths and prepare for analysis
                const normalizedFiles = files.map(f => normalizePath(f));
                
                // Prepare file contents (reuse logic from send_to_gemini)
                let fileContents = [];
                let totalTokens = 0;
                
                for (const filePath of normalizedFiles) {
                    try {
                        const content = await readFile(filePath, 'utf8');
                        const tokens = Math.round((content.length / CONFIG.CHARS_PER_TOKEN) * CONFIG.TOKEN_ESTIMATION_BUFFER);
                        
                        if (totalTokens + tokens > CONFIG.MAX_TOTAL_TOKENS) {
                            if (CONFIG.ENABLE_AUTO_OPTIMIZATION) {
                                console.error(`🔧 Auto-optimizing: ${totalTokens + tokens} → ${CONFIG.MAX_TOTAL_TOKENS} tokens`);
                                break;
                            }
                            const smartError = createSmartError(
                                new Error(`Total context too large: ${totalTokens + tokens} tokens`),
                                {totalTokens: totalTokens + tokens, limit: CONFIG.MAX_TOTAL_TOKENS}
                            );
                            return {
                                content: [{
                                    type: "text",
                                    text: `Error: ${smartError.message}\n\nSuggestions:\n${smartError.suggestions.map(s => `• ${s}`).join('\n')}`
                                }],
                                isError: true
                            };
                        }
                        
                        fileContents.push(`File: ${filePath}\n\`\`\`\n${content}\n\`\`\``);
                        totalTokens += tokens;
                    } catch (error) {
                        const smartError = createSmartError(error, {filePath});
                        return {
                            content: [{
                                type: "text",
                                text: `Error reading file ${filePath}: ${smartError.message}\n\nSuggestions:\n${smartError.suggestions.map(s => `• ${s}`).join('\n')}`
                            }],
                            isError: true
                        };
                    }
                }
                
                const fullPrompt = `${prompt}\n\n${fileContents.join('\n\n')}`;
                
                // Send to Gemini
                try {
                    const geminiModel = genAI.getGenerativeModel({model: analysisModel});
                    const result = await geminiModel.generateContent(fullPrompt);
                    const response = result.response;
                    const text = response.text();
                    
                    return {
                        content: [{
                            type: "text",
                            text: text
                        }]
                    };
                } catch (error) {
                    if (CONFIG.ENABLE_SMART_RECOVERY) {
                        const smartError = createSmartError(error, {
                            model: analysisModel,
                            tokenCount: totalTokens,
                            fileCount: normalizedFiles.length
                        });
                        return {
                            content: [{
                                type: "text",
                                text: `Error analyzing patterns: ${smartError.message}\n\nSuggestions:\n${smartError.suggestions.map(s => `• ${s}`).join('\n')}`
                            }],
                            isError: true
                        };
                    }
                    throw error;
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
                        const models = await getAvailableModels(process.env.GEMINI_API_KEY);
                        const cacheStatus = modelCache.fallbackUsed 
                            ? `Using DEFAULT_MODEL (API failed: ${modelCache.error || 'unknown error'})` 
                            : 'Live from API';
                            
                        if (models.length === 1 && models[0] === CONFIG.DEFAULT_MODEL && modelCache.fallbackUsed) {
                            modelInfo = `\n\n⚠️ **Model API Issue:**\n` +
                                `- API Error: ${modelCache.error}\n` +
                                `- Using DEFAULT_MODEL: ${CONFIG.DEFAULT_MODEL}\n` +
                                `- Fix: Check GEMINI_API_KEY and network connectivity\n\n` +
                                `📊 **Model Status:** ${cacheStatus} (${Math.round((Date.now() - modelCache.timestamp) / 60000)}m ago)`;
                        } else {
                            modelInfo = `\n\n**Available Models (${models.length}):**\n` +
                                models.slice(0, 10).map(m => `- ${m}`).join('\n') +
                                (models.length > 10 ? `\n... and ${models.length - 10} more` : '') +
                                `\n\n📊 **Model Cache:** ${cacheStatus} (updated ${Math.round((Date.now() - modelCache.timestamp) / 60000)}m ago)`;
                        }
                    } catch (error) {
                        modelInfo = `\n\n⚠️ **Model Info Error:** ${error.message}\n` +
                            `- Check your GEMINI_API_KEY environment variable\n` +
                            `- Verify network connectivity to Gemini API`;
                    }
                }

                return {
                    content: [{
                        type: "text",
                        text: `🖥️ **Gemini Bridge System Info v1.2.0**\n\n` +
                            `**Platform:** ${info.platform}\n` +
                            `**Node Version:** ${info.nodeVersion}\n\n` +
                            `**Configuration:**\n` +
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
                    const dirFiles = await this.findFiles(resolvedPath, [], 1000);
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
                                // For PDFs and other force-text files, read as binary and let Gemini handle it
                                const content = isForceText && ext === '.pdf'
                                    ? await readFile(resolvedPath, 'base64')
                                    : await readFile(resolvedPath, 'utf-8');

                                results.push({
                                    path: resolvedPath,
                                    relativePath: filePath,
                                    content,
                                    isPdf: ext === '.pdf'
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

    async findFiles(directory, excludePatterns = [], maxFiles = 100) {
        const results = [];

        const scanDir = async (dir, depth = 0) => {
            if (depth > CONFIG.MAX_RECURSION_DEPTH || results.length >= maxFiles) return;

            try {
                const entries = await readdir(dir);

                for (const entry of entries) {
                    if (CONFIG.EXCLUDED_DIRS.includes(entry) || entry.startsWith('.')) continue;

                    const fullPath = join(dir, entry);
                    const relativePath = relative(directory, fullPath);

                    // Check exclude patterns
                    if (excludePatterns.some(pattern => relativePath.includes(pattern))) continue;

                    const stats = await stat(fullPath);

                    if (stats.isDirectory()) {
                        await scanDir(fullPath, depth + 1);
                    } else if (stats.size <= CONFIG.MAX_FILE_SIZE) {
                        // Check if extension is explicitly excluded
                        const ext = extname(entry).toLowerCase();
                        if (CONFIG.EXCLUDED_EXTENSIONS.includes(ext)) continue;

                        // Check if it's a force-text extension (like PDF) or non-binary
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
            if (file.isPdf) {
                // For PDFs, provide them as base64 data for Gemini to process
                context += `## ${file.path} (PDF Document)\n`;
                context += `[PDF content in base64 format - Gemini will extract text]\n`;
                context += `data:application/pdf;base64,${file.content}\n\n`;
            } else {
                const lang = this.getLanguageFromExtension(extname(file.path));

                if (includeLineNumbers && file.content.includes('\n')) {
                    const lines = file.content.split('\n');
                    const numberedContent = lines.map((line, idx) => `${(idx + 1).toString().padStart(4, ' ')} | ${line}`).join('\n');
                    context += `## ${file.path}\n\`\`\`${lang}\n${numberedContent}\n\`\`\`\n\n`;
                } else {
                    context += `## ${file.path}\n\`\`\`${lang}\n${file.content}\n\`\`\`\n\n`;
                }
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
            '.vue': 'vue', '.svelte': 'svelte', '.pdf': 'text'
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

    async queryGemini(modelName, prompt, enableIterative = CONFIG.ENABLE_ITERATIVE_REFINEMENT) {
        try {
            const model = genAI.getGenerativeModel({model: modelName});

            const generationConfig = {
                temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.1,
                topK: parseInt(process.env.GEMINI_TOP_K) || 40,
                topP: parseFloat(process.env.GEMINI_TOP_P) || 0.95,
                maxOutputTokens: parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS) || 8192,
            };

            // Initial query
            let result = await model.generateContent({
                contents: [{role: "user", parts: [{text: prompt}]}],
                generationConfig,
            });

            let response = result.response;
            if (!response.text()) {
                throw new Error('No response generated from Gemini');
            }

            let finalResponse = response.text();

            // Iterative refinement if enabled
            if (enableIterative) {
                let iterations = 0;
                let shouldRefine = this.checkNeedsRefinement(finalResponse);

                while (shouldRefine && iterations < CONFIG.MAX_ITERATIONS) {
                    iterations++;
                    console.error(`Performing iterative refinement (iteration ${iterations})...`);

                    const refinementPrompt = `${CONFIG.ITERATION_PROMPT_PREFIX}\n\nPrevious response:\n${finalResponse}\n\nOriginal task:\n${prompt}`;

                    result = await model.generateContent({
                        contents: [{role: "user", parts: [{text: refinementPrompt}]}],
                        generationConfig,
                    });

                    response = result.response;
                    if (response.text()) {
                        finalResponse = response.text();
                        shouldRefine = this.checkNeedsRefinement(finalResponse);
                    } else {
                        break;
                    }
                }
            }

            return finalResponse;
        } catch (error) {
            if (error.message?.includes('API key')) {
                throw new Error('Invalid or missing GEMINI_API_KEY');
            } else if (error.message?.includes('quota')) {
                throw new Error('API quota exceeded. Please check your Gemini API usage.');
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
        if (!process.env.GEMINI_API_KEY) {
            console.error("ERROR: GEMINI_API_KEY environment variable is required");
            console.error("Please set it in your MCP server configuration or environment");
            process.exit(1);
        }

        // Initialize model cache in background
        if (CONFIG.AUTO_FETCH_MODELS) {
            getAvailableModels(process.env.GEMINI_API_KEY).catch(() => {
                // Fallback already handled in the function
            });
        }

        const transport = new StdioServerTransport();
        await this.server.connect(transport);

        // Log startup info to stderr with smart features
        console.error(`🚀 Gemini Bridge MCP Server v1.2.0 started`);
        console.error(`📍 Platform: ${platform()}`);
        console.error(`🤖 Model: ${CONFIG.DEFAULT_MODEL}`);
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
    const server = new GeminiBridgeMCP();
    server.start().catch(error => {
        console.error("Failed to start MCP server:", error);
        process.exit(1);
    });
}

// Export the server class for testing
export { GeminiBridgeMCP };
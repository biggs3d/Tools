#!/usr/bin/env node

// Load .env file configuration
import 'dotenv/config';

import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import {StdioServerTransport} from "@modelcontextprotocol/sdk/server/stdio.js";
import OpenAI from "openai";
import {readFile, readdir, stat, open} from "fs/promises";
import {join, extname, relative, resolve, normalize} from "path";
import {platform} from "os";
import {z} from "zod";
import micromatch from "micromatch";

// Initialize OpenAI API
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORGANIZATION_ID || undefined
});

// Configuration - all env-driven with sensible defaults
export const CONFIG = {
    // File handling
    MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 26214400, // 25MB default
    MAX_TOTAL_TOKENS: parseInt(process.env.MAX_TOTAL_TOKENS) || 120000, // Leave room in 128K context
    
    // Models - flexible configuration
    DEFAULT_MODEL: process.env.DEFAULT_MODEL || "gpt-4o",
    
    // Embeddings configuration
    EMBEDDING_MODEL: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
    EMBEDDING_BATCH_SIZE: parseInt(process.env.EMBEDDING_BATCH_SIZE) || 10,
    ALLOWED_MODELS: process.env.ALLOWED_MODELS?.split(',').map(m => m.trim()) || [
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "gpt-4",
        "gpt-3.5-turbo",
        "o1-preview",
        "o1-mini",
        "o3",
        "o3-mini"
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
            // Count non-printable chars (excluding common whitespace)
            if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) {
                nonPrintable++;
            }
        }
        
        // If more than 30% non-printable, likely binary
        return (nonPrintable / bytesRead) > 0.3;
    } catch (error) {
        console.error(`Error checking if file is binary: ${error.message}`);
        return false; // On error, assume text
    }
}

// Discover files recursively with smart filtering
async function discoverFiles(dir, options = {}) {
    const {
        includePatterns = [],
        excludePatterns = [],
        maxFiles = CONFIG.DEFAULT_MAX_FILES,
        excludeDirs = CONFIG.EXCLUDED_DIRS,
        excludeExtensions = CONFIG.EXCLUDED_EXTENSIONS,
        currentDepth = 0,
        maxDepth = CONFIG.MAX_RECURSION_DEPTH
    } = options;
    
    const results = [];
    const visited = new Set();
    
    async function walk(currentDir, depth) {
        if (depth > maxDepth || results.length >= maxFiles) return;
        
        // Resolve to absolute path and check if we've visited
        const absPath = resolve(currentDir);
        if (visited.has(absPath)) return;
        visited.add(absPath);
        
        try {
            const entries = await readdir(currentDir, {withFileTypes: true});
            
            for (const entry of entries) {
                if (results.length >= maxFiles) break;
                
                const fullPath = join(currentDir, entry.name);
                const relativePath = relative(dir, fullPath);
                
                if (entry.isDirectory()) {
                    // Skip excluded directories
                    if (excludeDirs.includes(entry.name)) continue;
                    
                    // Check exclude patterns
                    if (excludePatterns.length > 0 && 
                        micromatch.isMatch(relativePath, excludePatterns)) {
                        continue;
                    }
                    
                    await walk(fullPath, depth + 1);
                } else if (entry.isFile()) {
                    const ext = extname(entry.name).toLowerCase();
                    
                    // Skip excluded extensions
                    if (excludeExtensions.includes(ext)) continue;
                    
                    // Apply include/exclude patterns
                    if (includePatterns.length > 0) {
                        if (!micromatch.isMatch(relativePath, includePatterns)) continue;
                    }
                    
                    if (excludePatterns.length > 0) {
                        if (micromatch.isMatch(relativePath, excludePatterns)) continue;
                    }
                    
                    // Skip binary files unless forced
                    if (!CONFIG.FORCE_TEXT_EXTENSIONS.includes(ext) && 
                        await isBinaryFile(fullPath, CONFIG.BINARY_CHECK_BYTES)) {
                        continue;
                    }
                    
                    const stats = await stat(fullPath);
                    if (stats.size <= CONFIG.MAX_FILE_SIZE) {
                        results.push({
                            path: fullPath,
                            relativePath,
                            size: stats.size,
                            modified: stats.mtime
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Error walking directory ${currentDir}: ${error.message}`);
        }
    }
    
    await walk(dir, currentDepth);
    
    // Sort by modified time (newest first) then by path
    results.sort((a, b) => {
        const timeDiff = b.modified.getTime() - a.modified.getTime();
        return timeDiff !== 0 ? timeDiff : a.relativePath.localeCompare(b.relativePath);
    });
    
    return results;
}

// Token counting approximation for planning
function estimateTokens(text) {
    return Math.ceil((text.length / CONFIG.CHARS_PER_TOKEN) * CONFIG.TOKEN_ESTIMATION_BUFFER);
}

// OpenAI Bridge MCP Server
class OpenAIBridgeServer {
    constructor() {
        this.server = new McpServer({
            name: "openai-bridge",
            description: "Bridge to OpenAI's GPT models with large context window for code analysis",
            version: "1.0.0"
        });
        
        // Cache for model list
        this.modelCache = null;
        this.modelCacheTime = 0;
        
        this.setupTools();
    }
    
    setupTools() {
        // Main tool: Send files and prompt to OpenAI
        this.server.tool(
            'send_to_openai',
            'Send files and context to OpenAI for analysis with large context window (up to 128K tokens)',
            {
                prompt: z.string().min(1).describe('The question or task for OpenAI to perform'),
                files: z.array(z.string()).default([]).describe('Array of file paths to include'),
                project_context: z.string().optional().describe('Additional project background information'),
                model: z.string().optional().default(CONFIG.DEFAULT_MODEL).describe(`OpenAI model to use (default: ${CONFIG.DEFAULT_MODEL}). Can be any gpt-* or o1-* model.`),
                include_line_numbers: z.boolean().optional().default(true).describe('Include line numbers in file content (default: true)'),
                enable_iterative: z.boolean().optional().describe('Enable iterative refinement for better results (default: from env config)')
            },
            async ({prompt, files, project_context, model, include_line_numbers, enable_iterative}) => {
                try {
                    // Validate model
                    const selectedModel = model || CONFIG.DEFAULT_MODEL;
                    if (!selectedModel.startsWith('gpt-') && !selectedModel.startsWith('o1-') && !selectedModel.startsWith('o3')) {
                        if (!CONFIG.ALLOWED_MODELS.includes(selectedModel)) {
                            throw new Error(`Model ${selectedModel} not in allowed list. Use gpt-*, o1-*, or o3* models or one of: ${CONFIG.ALLOWED_MODELS.join(', ')}`);
                        }
                    }
                    
                    // Read all files
                    const fileContents = [];
                    let totalTokens = 0;
                    
                    for (const filePath of files) {
                        try {
                            const content = await readFile(filePath, 'utf-8');
                            const formattedContent = include_line_numbers 
                                ? content.split('\n').map((line, i) => `${i + 1}: ${line}`).join('\n')
                                : content;
                            
                            const tokens = estimateTokens(formattedContent);
                            if (totalTokens + tokens > CONFIG.MAX_TOTAL_TOKENS) {
                                console.error(`Skipping ${filePath} - would exceed token limit`);
                                continue;
                            }
                            
                            fileContents.push({
                                path: filePath,
                                content: formattedContent
                            });
                            totalTokens += tokens;
                        } catch (error) {
                            console.error(`Error reading ${filePath}: ${error.message}`);
                        }
                    }
                    
                    // Build context
                    let fullContext = '';
                    
                    if (project_context) {
                        fullContext += `Project Context:\n${project_context}\n\n`;
                    }
                    
                    if (fileContents.length > 0) {
                        fullContext += 'Files:\n\n';
                        for (const file of fileContents) {
                            fullContext += `--- ${file.path} ---\n${file.content}\n\n`;
                        }
                    }
                    
                    fullContext += `Task:\n${prompt}`;
                    
                    // Determine if we should use iterative refinement
                    const useIterative = enable_iterative !== undefined 
                        ? enable_iterative 
                        : CONFIG.ENABLE_ITERATIVE_REFINEMENT;
                    
                    // Call OpenAI
                    let response;
                    const messages = [
                        {
                            role: 'user',
                            content: fullContext
                        }
                    ];
                    
                    // First call
                    const completionParams = {
                        model: selectedModel,
                        messages: messages
                    };
                    
                    // o3 models don't support temperature parameter
                    if (!selectedModel.startsWith('o3')) {
                        completionParams.temperature = 0.1;
                    }
                    
                    // o1 and o3 models don't support max_tokens
                    if (!selectedModel.includes('o1') && !selectedModel.startsWith('o3')) {
                        completionParams.max_tokens = 4096;
                    }
                    
                    const completion = await openai.chat.completions.create(completionParams);
                    
                    response = completion.choices[0].message.content;
                    
                    // Iterative refinement if enabled
                    if (useIterative && CONFIG.MAX_ITERATIONS > 1) {
                        const shouldRefine = CONFIG.ITERATION_TRIGGERS.some(trigger => 
                            prompt.toLowerCase().includes(trigger) || 
                            response.toLowerCase().includes(trigger)
                        );
                        
                        if (shouldRefine) {
                            messages.push({role: 'assistant', content: response});
                            
                            for (let i = 1; i < CONFIG.MAX_ITERATIONS; i++) {
                                const refinementPrompt = `${CONFIG.ITERATION_PROMPT_PREFIX}\n- Accuracy and completeness\n- Code quality and best practices\n- Clear explanations`;
                                
                                messages.push({role: 'user', content: refinementPrompt});
                                
                                const refinedParams = {
                                    model: selectedModel,
                                    messages: messages
                                };
                                
                                if (!selectedModel.startsWith('o3')) {
                                    refinedParams.temperature = 0.1;
                                }
                                
                                if (!selectedModel.includes('o1') && !selectedModel.startsWith('o3')) {
                                    refinedParams.max_tokens = 4096;
                                }
                                
                                const refinedCompletion = await openai.chat.completions.create(refinedParams);
                                
                                response = refinedCompletion.choices[0].message.content;
                                messages.push({role: 'assistant', content: response});
                            }
                        }
                    }
                    
                    return {
                        content: [{
                            type: 'text',
                            text: response
                        }]
                    };
                } catch (error) {
                    console.error('OpenAI API Error:', error);
                    return {
                        content: [{
                            type: 'text',
                            text: `Error: ${error.message}`
                        }]
                    };
                }
            }
        );
        
        // Tool: Estimate context size
        this.server.tool(
            'estimate_context_size',
            'Estimate token count for files before sending to OpenAI',
            {
                files: z.array(z.string()).default([]).describe('Array of file paths to analyze'),
                include_project_context: z.boolean().optional().describe('Include space for project context in estimate'),
                show_estimation_details: z.boolean().optional().describe('Show token estimation calculation details')
            },
            async ({files, include_project_context, show_estimation_details}) => {
                try {
                    let totalChars = 0;
                    let totalTokens = 0;
                    const details = [];
                    
                    for (const filePath of files) {
                        try {
                            const content = await readFile(filePath, 'utf-8');
                            const chars = content.length;
                            const tokens = estimateTokens(content);
                            
                            totalChars += chars;
                            totalTokens += tokens;
                            
                            if (show_estimation_details) {
                                details.push({
                                    file: filePath,
                                    characters: chars,
                                    estimatedTokens: tokens
                                });
                            }
                        } catch (error) {
                            if (show_estimation_details) {
                                details.push({
                                    file: filePath,
                                    error: error.message
                                });
                            }
                        }
                    }
                    
                    if (include_project_context) {
                        const contextTokens = 2000; // Reserve for project context
                        totalTokens += contextTokens;
                        if (show_estimation_details) {
                            details.push({
                                item: 'Project Context (reserved)',
                                estimatedTokens: contextTokens
                            });
                        }
                    }
                    
                    const maxTokens = 128000; // GPT-4 context window
                    const percentUsed = Math.round((totalTokens / maxTokens) * 100);
                    
                    let result = {
                        totalFiles: files.length,
                        totalCharacters: totalChars,
                        estimatedTokens: totalTokens,
                        maxTokens: maxTokens,
                        percentOfLimit: percentUsed,
                        withinLimit: totalTokens < CONFIG.MAX_TOTAL_TOKENS,
                        recommendation: totalTokens < CONFIG.MAX_TOTAL_TOKENS 
                            ? 'All files can be processed together'
                            : 'Consider splitting files into batches or reducing content'
                    };
                    
                    if (show_estimation_details) {
                        result.details = details;
                    }
                    
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }]
                    };
                } catch (error) {
                    return {
                        content: [{
                            type: 'text',
                            text: `Error: ${error.message}`
                        }]
                    };
                }
            }
        );
        
        // Tool: Find relevant files
        this.server.tool(
            'find_relevant_files',
            'Discover relevant files in a directory for analysis (automatically detects text files)',
            {
                directory: z.string().describe('Directory path to scan'),
                include_patterns: z.array(z.string()).optional().describe("Glob patterns to include (e.g., ['**/*.js', 'src/**/*.{ts,tsx}'])"),
                exclude_patterns: z.array(z.string()).optional().describe("Glob patterns to exclude (e.g., ['**/test/**', '**/*.spec.*'])"),
                max_files: z.number().optional().default(CONFIG.DEFAULT_MAX_FILES).describe(`Maximum number of files to return (default: ${CONFIG.DEFAULT_MAX_FILES})`)
            },
            async ({directory, include_patterns = [], exclude_patterns = [], max_files}) => {
                try {
                    const files = await discoverFiles(directory, {
                        includePatterns: include_patterns,
                        excludePatterns: exclude_patterns,
                        maxFiles: max_files
                    });
                    
                    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
                    const estimatedTokens = Math.ceil((totalSize / CONFIG.CHARS_PER_TOKEN) * CONFIG.TOKEN_ESTIMATION_BUFFER);
                    
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                directory,
                                foundFiles: files.length,
                                totalSizeBytes: totalSize,
                                estimatedTokens,
                                files: files.map(f => ({
                                    path: f.relativePath,
                                    size: f.size,
                                    modified: f.modified
                                }))
                            }, null, 2)
                        }]
                    };
                } catch (error) {
                    return {
                        content: [{
                            type: 'text',
                            text: `Error: ${error.message}`
                        }]
                    };
                }
            }
        );
        
        // Tool: Analyze code patterns
        this.server.tool(
            'analyze_code_patterns',
            'Use OpenAI to analyze specific code patterns or architectural decisions across files',
            {
                pattern_type: z.enum([
                    'architecture',
                    'security', 
                    'performance',
                    'testing',
                    'documentation',
                    'dependencies',
                    'code_quality'
                ]).describe('Type of pattern analysis to perform'),
                files: z.array(z.string()).default([]).describe('Files to analyze for patterns'),
                specific_focus: z.string().optional().describe('Specific aspect to focus on'),
                model: z.string().optional().describe('Override the default model for this analysis')
            },
            async ({pattern_type, files, specific_focus, model}) => {
                const patternPrompts = {
                    architecture: "Analyze the architectural patterns, design decisions, and structure. Focus on modularity, separation of concerns, and scalability.",
                    security: "Identify security vulnerabilities, unsafe practices, and potential attack vectors. Suggest secure alternatives.",
                    performance: "Find performance bottlenecks, inefficient algorithms, and resource-intensive operations. Suggest optimizations.",
                    testing: "Evaluate test coverage, testing strategies, and test quality. Identify untested code paths and suggest improvements.",
                    documentation: "Assess documentation quality, completeness, and clarity. Identify undocumented functions and suggest improvements.",
                    dependencies: "Analyze dependency usage, version management, and potential conflicts. Check for outdated or vulnerable packages.",
                    code_quality: "Evaluate code maintainability, readability, and adherence to best practices. Identify code smells and technical debt."
                };
                
                let prompt = patternPrompts[pattern_type];
                if (specific_focus) {
                    prompt += `\n\nSpecific focus: ${specific_focus}`;
                }
                
                prompt += "\n\nProvide actionable insights and specific recommendations.";
                
                // Use the send_to_openai function
                return await this.server._tools.get('send_to_openai').handler({
                    prompt,
                    files,
                    model: model || CONFIG.DEFAULT_MODEL,
                    include_line_numbers: true,
                    enable_iterative: true
                });
            }
        );
        
        // Tool: Generate embeddings
        this.server.tool(
            'generate_embeddings',
            'Generate embeddings for text using OpenAI\'s latest embeddings model(s)',
            {
                texts: z.array(z.string()).describe('Array of texts to embed'),
                model: z.string().optional().default(CONFIG.EMBEDDING_MODEL).describe(`Embedding model to use (default: ${CONFIG.EMBEDDING_MODEL})`),
                dimensions: z.number().optional().describe('Output dimensionality (optional, model default is optimal)')
            },
            async ({texts, model, dimensions}) => {
                try {
                    const embeddings = [];
                    
                    // Process in batches
                    for (let i = 0; i < texts.length; i += CONFIG.EMBEDDING_BATCH_SIZE) {
                        const batch = texts.slice(i, i + CONFIG.EMBEDDING_BATCH_SIZE);
                        
                        const params = {
                            model: model || CONFIG.EMBEDDING_MODEL,
                            input: batch
                        };
                        
                        if (dimensions) {
                            params.dimensions = dimensions;
                        }
                        
                        const response = await openai.embeddings.create(params);
                        
                        embeddings.push(...response.data.map((item, idx) => ({
                            text: batch[idx],
                            embedding: item.embedding,
                            index: i + idx
                        })));
                    }
                    
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify({
                                model: model || CONFIG.EMBEDDING_MODEL,
                                totalTexts: texts.length,
                                dimensions: embeddings[0]?.embedding.length || 0,
                                embeddings: embeddings
                            }, null, 2)
                        }]
                    };
                } catch (error) {
                    return {
                        content: [{
                            type: 'text',
                            text: `Error generating embeddings: ${error.message}`
                        }]
                    };
                }
            }
        );
        
        // Tool: Get system info
        this.server.tool(
            'get_system_info',
            'Get comprehensive system information and diagnostics',
            {
                include_models: z.boolean().optional().default(true).describe('Fetch live model information (default: true)')
            },
            async ({include_models}) => {
                try {
                    const info = {
                        server: {
                            name: 'OpenAI Bridge MCP Server',
                            version: '1.0.0',
                            platform: platform(),
                            nodeVersion: process.version
                        },
                        configuration: {
                            defaultModel: CONFIG.DEFAULT_MODEL,
                            embeddingModel: CONFIG.EMBEDDING_MODEL,
                            maxFileSize: `${Math.round(CONFIG.MAX_FILE_SIZE / 1048576)}MB`,
                            maxTotalTokens: CONFIG.MAX_TOTAL_TOKENS,
                            contextWindow: '128K tokens',
                            iterativeRefinement: CONFIG.ENABLE_ITERATIVE_REFINEMENT,
                            excludedExtensions: CONFIG.EXCLUDED_EXTENSIONS.length,
                            excludedDirs: CONFIG.EXCLUDED_DIRS.length
                        },
                        environment: {
                            apiKeySet: !!process.env.OPENAI_API_KEY,
                            apiKeyLength: process.env.OPENAI_API_KEY?.length || 0
                        }
                    };
                    
                    // Fetch live model list if requested
                    if (include_models && CONFIG.AUTO_FETCH_MODELS) {
                        const now = Date.now();
                        if (!this.modelCache || (now - this.modelCacheTime) > CONFIG.MODEL_CACHE_TTL) {
                            try {
                                const modelsResponse = await openai.models.list();
                                const models = modelsResponse.data
                                    .filter(m => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('embedding'))
                                    .map(m => ({
                                        id: m.id,
                                        created: new Date(m.created * 1000).toISOString(),
                                        type: m.id.includes('embedding') ? 'embedding' : 'chat'
                                    }))
                                    .sort((a, b) => a.id.localeCompare(b.id));
                                
                                this.modelCache = models;
                                this.modelCacheTime = now;
                            } catch (error) {
                                console.error('Error fetching models:', error);
                                this.modelCache = CONFIG.ALLOWED_MODELS.map(m => ({id: m, type: 'chat'}));
                            }
                        }
                        info.availableModels = this.modelCache;
                    }
                    
                    return {
                        content: [{
                            type: 'text',
                            text: JSON.stringify(info, null, 2)
                        }]
                    };
                } catch (error) {
                    return {
                        content: [{
                            type: 'text',
                            text: `Error getting system info: ${error.message}`
                        }]
                    };
                }
            }
        );
    }
    
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error('OpenAI Bridge MCP Server running');
    }
}

// Start server
const server = new OpenAIBridgeServer();
server.start().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFile, readdir, stat } from "fs/promises";
import { join, extname, relative } from "path";
import { z } from "zod";

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configuration
const CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_TOTAL_TOKENS: 900000, // Leave room in 1M context
  DEFAULT_MODEL: "gemini-2.5-flash",
  SUPPORTED_EXTENSIONS: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cs', '.go', '.rs', '.cpp', '.c', '.h', '.md', '.txt', '.json', '.yaml', '.yml']
};

class GeminiBridgeMCP {
  constructor() {
    this.server = new McpServer({
      name: "gemini-context-bridge",
      version: "1.0.0"
    });
    
    this.setupTools();
  }

  setupTools() {
    // Main tool: Send files/context to Gemini
    this.server.tool(
      "send_to_gemini",
      "Send files and context to Gemini 2.5 for analysis with large context window",
      {
        files: z.array(z.string()).describe("Array of file paths to include"),
        prompt: z.string().describe("The question or task for Gemini to perform"),
        model: z.enum(["gemini-2.5-flash", "gemini-2.5-pro"]).optional().describe("Gemini model to use"),
        project_context: z.string().optional().describe("Additional project background information")
      },
      async ({ files, prompt, model = CONFIG.DEFAULT_MODEL, project_context }) => {
        try {
          // Collect and process files
          const fileContents = await this.collectFiles(files);
          
          // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
          const estimatedTokens = this.estimateTokens(fileContents, prompt, project_context);
          
          if (estimatedTokens > CONFIG.MAX_TOTAL_TOKENS) {
            return {
              content: [{
                type: "text",
                text: `❌ Context too large: ~${estimatedTokens} tokens (max: ${CONFIG.MAX_TOTAL_TOKENS})\nConsider reducing files or using selective filtering.`
              }]
            };
          }

          // Format context for Gemini
          const formattedContext = this.formatContext(fileContents, project_context);
          const fullPrompt = `${formattedContext}\n\n# Task\n${prompt}`;

          // Send to Gemini
          const result = await this.queryGemini(model, fullPrompt);
          
          return {
            content: [{
              type: "text",
              text: `✅ **Gemini ${model} Analysis** (${fileContents.length} files, ~${estimatedTokens} tokens)\n\n${result}`
            }]
          };

        } catch (error) {
          return {
            content: [{
              type: "text", 
              text: `❌ Error: ${error.message}`
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
        files: z.array(z.string()).describe("Array of file paths to analyze")
      },
      async ({ files }) => {
        try {
          const fileContents = await this.collectFiles(files);
          const estimatedTokens = this.estimateTokens(fileContents);
          
          const fileStats = fileContents.map(f => ({
            path: f.path,
            size: `${Math.round(f.content.length / 1024)}KB`,
            tokens: Math.round(f.content.length / 4)
          }));

          return {
            content: [{
              type: "text",
              text: `📊 **Context Size Estimation**\n\n` +
                   `**Total estimated tokens:** ${estimatedTokens}\n` +
                   `**Status:** ${estimatedTokens > CONFIG.MAX_TOTAL_TOKENS ? '❌ Too large' : '✅ Within limits'}\n\n` +
                   `**File breakdown:**\n` +
                   fileStats.map(f => `- ${f.path}: ${f.size} (~${f.tokens} tokens)`).join('\n')
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
      "Discover relevant files in a directory for analysis",
      {
        directory: z.string().describe("Directory path to scan"),
        extensions: z.array(z.string()).optional().describe("File extensions to include (e.g., ['.js', '.ts'])"),
        max_files: z.number().optional().describe("Maximum number of files to return")
      },
      async ({ directory, extensions = CONFIG.SUPPORTED_EXTENSIONS, max_files = 50 }) => {
        try {
          const files = await this.findFiles(directory, extensions, max_files);
          
          return {
            content: [{
              type: "text",
              text: `📁 **Found ${files.length} relevant files in ${directory}:**\n\n` +
                   files.map(f => `- ${f.path} (${Math.round(f.size / 1024)}KB)`).join('\n') +
                   `\n\nUse \`send_to_gemini\` with these file paths for analysis.`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `❌ Error scanning directory: ${error.message}`
            }]
          };
        }
      }
    );
  }

  async collectFiles(filePaths) {
    const results = [];
    
    for (const filePath of filePaths) {
      try {
        const stats = await stat(filePath);
        
        if (stats.isDirectory()) {
          // If directory, collect supported files
          const dirFiles = await this.findFiles(filePath, CONFIG.SUPPORTED_EXTENSIONS);
          for (const dirFile of dirFiles) {
            const content = await readFile(dirFile.path, 'utf-8');
            results.push({ path: dirFile.path, content });
          }
        } else if (stats.size <= CONFIG.MAX_FILE_SIZE) {
          const content = await readFile(filePath, 'utf-8');
          results.push({ path: filePath, content });
        } else {
          console.warn(`Skipping large file: ${filePath} (${Math.round(stats.size / 1024 / 1024)}MB)`);
        }
      } catch (error) {
        console.warn(`Error reading ${filePath}: ${error.message}`);
      }
    }
    
    return results;
  }

  async findFiles(directory, extensions, maxFiles = 100) {
    const results = [];
    
    const scanDir = async (dir, depth = 0) => {
      if (depth > 5 || results.length >= maxFiles) return; // Prevent deep recursion
      
      try {
        const entries = await readdir(dir);
        
        for (const entry of entries) {
          if (entry.startsWith('.') || entry === 'node_modules') continue;
          
          const fullPath = join(dir, entry);
          const stats = await stat(fullPath);
          
          if (stats.isDirectory()) {
            await scanDir(fullPath, depth + 1);
          } else if (extensions.includes(extname(entry).toLowerCase()) && stats.size <= CONFIG.MAX_FILE_SIZE) {
            results.push({
              path: fullPath,
              relativePath: relative(directory, fullPath),
              size: stats.size
            });
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    await scanDir(directory);
    return results.slice(0, maxFiles);
  }

  formatContext(fileContents, projectContext) {
    let context = "";
    
    if (projectContext) {
      context += `# Project Context\n${projectContext}\n\n`;
    }
    
    context += "# Files for Analysis\n\n";
    
    for (const file of fileContents) {
      context += `## ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
    }
    
    return context;
  }

  estimateTokens(fileContents, prompt = "", projectContext = "") {
    let totalChars = 0;
    
    if (projectContext) totalChars += projectContext.length;
    if (prompt) totalChars += prompt.length;
    
    for (const file of fileContents) {
      totalChars += file.path.length + file.content.length + 20; // Add formatting overhead
    }
    
    // Rough approximation: 1 token ≈ 4 characters for code
    return Math.round(totalChars / 4);
  }

  async queryGemini(modelName, prompt) {
    const model = genAI.getGenerativeModel({ model: modelName });
    
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });

    return result.response.text();
  }

  async start() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Gemini Bridge MCP Server started"); // Use stderr to avoid interfering with MCP protocol
  }
}

// Start the server
const server = new GeminiBridgeMCP();
server.start().catch(error => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});

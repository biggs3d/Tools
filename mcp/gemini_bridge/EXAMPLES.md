# Gemini Bridge MCP Server - Usage Examples

This document provides detailed examples of using the Gemini Bridge MCP server in Claude Code for various development scenarios.

## Table of Contents

- [Basic Usage](#basic-usage)
- [Project Analysis](#project-analysis)
- [Code Review Scenarios](#code-review-scenarios)
- [Refactoring Assistance](#refactoring-assistance)
- [Documentation Generation](#documentation-generation)
- [Performance Optimization](#performance-optimization)
- [Security Auditing](#security-auditing)
- [Advanced Patterns](#advanced-patterns)

## Basic Usage

### Simple File Analysis

```
Please use the gemini bridge to analyze the file src/components/Dashboard.tsx and explain its architecture.
```

### Multiple File Analysis

```
Can you send these files to gemini for review: src/api/auth.js, src/api/users.js, and src/middleware/authentication.js? I need to understand how authentication flows through the system.
```

### Directory Analysis

```
Use gemini to analyze all TypeScript files in the src/services directory and identify any anti-patterns or code smells.
```

## Project Analysis

### Full Project Architecture Review

```
First, use the gemini bridge to find all relevant source files in my project (excluding tests and node_modules). Then send them to gemini with this context: "This is a React-based e-commerce platform using Redux for state management." Ask it to provide a comprehensive architecture review with improvement suggestions.
```

### Technology Stack Analysis

```
Please estimate the context size for all configuration files (package.json, tsconfig.json, webpack.config.js, etc.), then if it fits, send them to gemini to analyze our technology choices and suggest optimizations.
```

### Dependency Analysis

```
Use the gemini bridge pattern analysis tool with type "dependencies" on my package.json and all import statements to identify unused dependencies and suggest upgrades.
```

## Code Review Scenarios

### PR Review Simulation

```
I'm about to submit a PR with changes to these files: [list files]. Can you use gemini to review them as if you were a senior developer? Focus on code quality, potential bugs, and adherence to best practices.
```

### Design Pattern Implementation

```
Use gemini to analyze my repository pattern implementation in src/repositories/. Check if it follows SOLID principles and suggest improvements.
```

### API Consistency Check

```
Find all files in src/api/ and src/controllers/, then use gemini to check for API consistency in terms of naming conventions, error handling, and response formats.
```

## Refactoring Assistance

### Legacy Code Modernization

```
This legacy JavaScript file (src/legacy/dataProcessor.js) needs modernization. Use gemini to suggest how to refactor it using modern ES6+ features and better design patterns.
```

### Component Decomposition

```
The file src/components/UserDashboard.tsx is too large (over 500 lines). Use gemini to analyze it and suggest how to break it down into smaller, more manageable components.
```

### Code Duplication Analysis

```
Find all JavaScript files in src/, then use gemini to identify duplicate code patterns and suggest how to refactor them into shared utilities.
```

## Documentation Generation

### API Documentation

```
Use gemini to analyze all files in src/routes/ and generate comprehensive API documentation including endpoints, parameters, and example responses.
```

### Component Documentation

```
Analyze all React components in src/components/ with gemini and generate JSDoc comments for props and methods that are missing documentation.
```

### Architecture Decision Records

```
Based on the codebase analysis, use gemini to generate Architecture Decision Records (ADRs) for the major architectural patterns found in the project.
```

### Large Source Documents

```
I have two huge Standards pdfs in the ./docs folder, can you use gemini to analyze the main concepts and extract consolidated examples for us to use as more succinct context reference?
```

This is particularly useful for:
- Technical standards documents (ISO, IEEE, etc.)
- API reference manuals
- Framework documentation
- Legal or compliance documents
- Research papers

Note: PDF files are supported up to 25MB by default. Gemini will extract and analyze the text content from PDFs.

## Performance Optimization

### React Performance Audit

```
Use the gemini bridge with pattern type "performance" to analyze all React components and identify:
1. Unnecessary re-renders
2. Missing memoization opportunities  
3. Large bundle imports
4. Inefficient state updates
```

### Database Query Optimization

```
Send all files containing database queries (src/db/, src/models/) to gemini and ask it to identify N+1 queries, missing indexes, and optimization opportunities.
```

### Bundle Size Analysis

```
Analyze my import statements across all source files with gemini to identify opportunities for code splitting and lazy loading.
```

## Security Auditing

### Comprehensive Security Review

```
Use the gemini bridge security analysis pattern on all files to identify:
- SQL injection vulnerabilities
- XSS possibilities  
- Insecure dependencies
- Exposed secrets or API keys
- Missing authentication checks
```

### Authentication Flow Audit

```
Find all files related to authentication (auth, login, session, token in filename), then use gemini to audit the complete authentication flow for security vulnerabilities.
```

### Input Validation Check

```
Use gemini to analyze all API endpoints and form handlers to ensure proper input validation and sanitization.
```

## Advanced Patterns

### Cross-Cutting Concerns Analysis

```
I want to understand how logging, error handling, and authentication are implemented across my codebase. Use gemini to analyze files and identify these cross-cutting concerns and suggest improvements using AOP or middleware patterns.
```

### Microservices Readiness Assessment

```
Analyze my monolithic application structure with gemini and provide a detailed assessment of:
1. Current coupling between modules
2. Suggested service boundaries
3. Migration strategy to microservices
4. Estimated effort for each service extraction
```

### Test Coverage Gap Analysis

```
First find all test files (*.test.js, *.spec.ts), then find all source files. Send both sets to gemini to identify which source files lack corresponding tests and suggest what tests should be written.
```

### Multi-Model Comparison

```
For this complex refactoring task, first use gemini-2.5-flash-preview-05-20 to get a quick overview of the changes needed in src/core/. Then use gemini-2.5-pro-preview-06-05 for a detailed implementation plan. Compare both responses.
```

### Incremental Analysis for Large Codebases

```
My codebase is too large for one analysis. Please:
1. Use find_relevant_files to list all directories
2. Estimate context size for each major module
3. Analyze each module separately with gemini
4. Finally, send a summary of all analyses to gemini for an overall assessment
```

## Tips for Effective Usage

1. **Always Estimate First**: For large directories, use `estimate_context_size` before sending to avoid token limit errors.

2. **Provide Context**: Include project context when analyzing architecture or making design decisions.

3. **Be Specific**: The more specific your prompt, the better Gemini's analysis will be.

4. **Use Pattern Analysis**: Leverage the built-in pattern analysis tool for focused reviews.

5. **Iterative Refinement**: Start with broad analysis, then zoom in on specific areas of concern.

6. **Model Selection**:
   - Use `gemini-2.5-flash-preview-05-20` for quick analysis and code reviews
   - Use `gemini-2.5-pro-preview-06-05` for complex architectural decisions and detailed refactoring plans
   - Use `gemini-2.0-flash` as a balanced option
   - For PDF analysis, consider using `gemini-2.5-pro-preview-06-05` for better text extraction

## Common Workflows

### Daily Code Review Workflow

```
1. Find files changed today: `git diff --name-only HEAD~1`
2. Estimate their context size with gemini bridge
3. Send to gemini for review with context about what features were being implemented
4. Address feedback before committing
```

### Pre-Deployment Audit

```
1. Use gemini security pattern analysis on all API endpoints
2. Run performance pattern analysis on critical user paths  
3. Check for any hardcoded values or TODOs
4. Generate a deployment readiness report
```

### New Developer Onboarding

```
1. Use gemini to analyze project structure and generate an overview
2. Identify the most complex modules and explain them
3. Document the main architectural patterns used
4. Create a learning path for new developers
```
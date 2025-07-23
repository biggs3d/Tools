#!/usr/bin/env node

/**
 * Test both Gemini and Grok bridges to ensure identical behavior
 * This ensures they stay synchronized after upgrades
 */

import { GeminiBridgeMCP } from './gemini_bridge/server.js';
import { GrokBridgeMCP } from './grok_bridge/server.js';
import { sanitizePatterns as geminiFn } from './gemini_bridge/server.js';
import { sanitizePatterns as grokFn } from './grok_bridge/server.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

class BridgeSyncTester {
    constructor() {
        this.geminiServer = new GeminiBridgeMCP();
        this.grokServer = new GrokBridgeMCP();
        this.testDir = './test-bridge-sync';
        this.passed = 0;
        this.failed = 0;
    }

    async runSyncTests() {
        console.log('🔄 Testing Gemini ↔ Grok Bridge Synchronization...\n');
        
        await this.setupTestFiles();
        
        console.log('🧪 Running identical behavior tests...\n');
        
        // Test core patterns
        await this.testIdenticalBehavior('Basic JS files', ['**/*.js'], []);
        await this.testIdenticalBehavior('TypeScript files', ['**/*.{ts,tsx}'], []);
        await this.testIdenticalBehavior('Exclude tests', ['**/*'], ['**/test/**']);
        await this.testIdenticalBehavior('Complex include/exclude', 
            ['src/**/*.{js,ts}'], 
            ['**/*.test.*', '**/spec/**']
        );
        
        // Test edge cases
        await this.testIdenticalBehavior('Special characters', ['**/*{-,_,*}*'], []);
        await this.testIdenticalBehavior('Deep nesting', ['deep/**/*.js'], []);
        await this.testIdenticalBehavior('Case patterns', ['**/*.JS'], []);
        
        console.log('🔒 Testing sanitization synchronization...\n');
        
        // Test sanitization functions are identical
        this.testSanitizationSync();
        
        this.cleanup();
        this.printSummary();
    }

    async setupTestFiles() {
        console.log('📁 Setting up test files for bridge comparison...');
        
        if (existsSync(this.testDir)) {
            rmSync(this.testDir, { recursive: true });
        }

        // Create test structure
        const dirs = [
            'src', 'src/components', 'test', 'test/unit', 'deep/nested/structure',
            'case-test', 'Case-Test'
        ];
        
        dirs.forEach(dir => {
            mkdirSync(join(this.testDir, dir), { recursive: true });
        });

        const files = [
            'src/index.js', 'src/app.ts', 'src/components/Button.jsx',
            'test/app.test.js', 'test/unit/helpers.spec.ts',
            'deep/nested/structure/file.js',
            'case-test/lower.js', 'Case-Test/Mixed.JS',
            'src/file-with-dashes.js', 'src/file_with_underscores.py',
            'src/file*asterisk.js'
        ];

        files.forEach(file => {
            writeFileSync(join(this.testDir, file), `// Test file: ${file}`);
        });

        console.log('✅ Test files created\n');
    }

    async testIdenticalBehavior(testName, includePatterns, excludePatterns) {
        try {
            // Get results from both bridges
            const geminiFiles = await this.geminiServer.findFiles(
                this.testDir, includePatterns, excludePatterns, 1000
            );
            
            const grokFiles = await this.grokServer.findFiles(
                this.testDir, includePatterns, excludePatterns, 1000
            );

            // Compare results
            const geminiPaths = geminiFiles.map(f => f.relativePath).sort();
            const grokPaths = grokFiles.map(f => f.relativePath).sort();

            const identical = JSON.stringify(geminiPaths) === JSON.stringify(grokPaths);

            if (identical) {
                this.recordResult(testName, true);
                console.log(`   ✅ ${testName}: ${geminiPaths.length} files (identical)`);
            } else {
                this.recordResult(testName, false);
                console.log(`   ❌ ${testName}: Results differ!`);
                console.log(`      Gemini: [${geminiPaths.join(', ')}]`);
                console.log(`      Grok:   [${grokPaths.join(', ')}]`);
                
                // Show differences
                const onlyInGemini = geminiPaths.filter(p => !grokPaths.includes(p));
                const onlyInGrok = grokPaths.filter(p => !geminiPaths.includes(p));
                
                if (onlyInGemini.length > 0) {
                    console.log(`      Only in Gemini: ${onlyInGemini.join(', ')}`);
                }
                if (onlyInGrok.length > 0) {
                    console.log(`      Only in Grok: ${onlyInGrok.join(', ')}`);
                }
            }

        } catch (error) {
            this.recordResult(testName, false);
            console.log(`   ❌ ${testName}: Error - ${error.message}`);
        }
    }

    testSanitizationSync() {
        const testCases = [
            ['**/*.js', 'src/**/*.ts'],
            ['/absolute/path', '\\\\windows\\path'],
            ['normal-pattern']
        ];

        for (const patterns of testCases) {
            try {
                const geminiResult = geminiFn(patterns);
                const grokResult = grokFn(patterns);
                
                const identical = JSON.stringify(geminiResult) === JSON.stringify(grokResult);
                
                if (identical) {
                    this.recordResult(`Sanitization: [${patterns.join(', ')}]`, true);
                } else {
                    this.recordResult(`Sanitization: [${patterns.join(', ')}]`, false);
                    console.log(`   ❌ Sanitization differs for: ${patterns.join(', ')}`);
                    console.log(`      Gemini: ${JSON.stringify(geminiResult)}`);
                    console.log(`      Grok:   ${JSON.stringify(grokResult)}`);
                }
            } catch (error) {
                // Both should either succeed or fail identically
                let bothFailed = false;
                try {
                    geminiFn(patterns);
                } catch (geminiError) {
                    try {
                        grokFn(patterns);
                    } catch (grokError) {
                        // Both failed - check if error messages are similar
                        bothFailed = geminiError.message === grokError.message;
                    }
                }
                
                this.recordResult(`Sanitization error: [${patterns.join(', ')}]`, bothFailed);
            }
        }

        // Test specific edge cases
        const edgeCases = [
            'a'.repeat(201), // Too long
            '*'.repeat(15)   // Too many wildcards
        ];

        for (const pattern of edgeCases) {
            let geminiError = null;
            let grokError = null;

            try {
                geminiFn([pattern]);
            } catch (e) {
                geminiError = e.message;
            }

            try {
                grokFn([pattern]);
            } catch (e) {
                grokError = e.message;
            }

            const identicalErrors = geminiError === grokError;
            this.recordResult(`Edge case: ${pattern.substring(0, 20)}...`, identicalErrors);
            
            if (!identicalErrors) {
                console.log(`   ❌ Different error handling for: ${pattern.substring(0, 20)}...`);
                console.log(`      Gemini: ${geminiError || 'No error'}`);
                console.log(`      Grok:   ${grokError || 'No error'}`);
            }
        }
    }

    recordResult(testName, passed) {
        if (passed) {
            this.passed++;
        } else {
            this.failed++;
        }
    }

    cleanup() {
        if (existsSync(this.testDir)) {
            rmSync(this.testDir, { recursive: true });
        }
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('🔄 BRIDGE SYNCHRONIZATION TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`✅ Synchronized: ${this.passed}`);
        console.log(`❌ Different:    ${this.failed}`);
        console.log(`📊 Total Tests:  ${this.passed + this.failed}`);
        console.log(`🎯 Sync Rate:    ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
        
        if (this.failed === 0) {
            console.log('\n🎉 BRIDGES ARE PERFECTLY SYNCHRONIZED!');
            console.log('✅ Both Gemini and Grok bridges behave identically');
        } else {
            console.log('\n⚠️  SYNCHRONIZATION ISSUES DETECTED!');
            console.log('🔧 Review the differences above and ensure both bridges have identical logic');
        }
    }
}

// Run the synchronization test
const tester = new BridgeSyncTester();
tester.runSyncTests().catch(console.error);
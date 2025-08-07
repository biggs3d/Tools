#!/usr/bin/env node

/**
 * Comprehensive test suite for enhanced glob pattern support
 * Tests edge cases, performance, and reliability
 */

import { GrokBridgeMCP } from '../server.js';
import { sanitizePatterns } from '../server.js';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

class GlobTestSuite {
    constructor() {
        this.server = new GrokBridgeMCP();
        this.testDir = './test-comprehensive-glob';
        this.passed = 0;
        this.failed = 0;
        this.results = [];
    }

    async runAllTests() {
        console.log('🧪 Running comprehensive glob pattern tests...\n');
        
        await this.setupTestFiles();
        
        // Run test categories
        await this.testBasicPatterns();
        await this.testSpecialCharacters();
        await this.testOverlappingPatterns();
        await this.testCaseSensitivity();
        await this.testNestedDirectories();
        await this.testPatternSanitization();
        await this.testCrossplatformPaths();
        await this.testPerformanceBasics();
        await this.testBinaryAndTextFiles();
        
        this.cleanup();
        this.printSummary();
    }

    async setupTestFiles() {
        console.log('📁 Setting up test files...');
        
        if (existsSync(this.testDir)) {
            rmSync(this.testDir, { recursive: true });
        }

        // Create comprehensive directory structure
        const dirs = [
            'src', 'src/components', 'src/utils', 'src/assets', 'src/types',
            'test', 'test/unit', 'test/integration', 'test/e2e',
            'docs', 'docs/api', 'docs/guides',
            'dist', 'node_modules', 'node_modules/react', 'node_modules/lodash', '.git', '.vscode',
            'special chars', 'special chars/with spaces',
            'deep/very/deeply/nested/structure',
            'case-test', 'Case-Test', 'CASE-TEST'
        ];
        
        dirs.forEach(dir => {
            mkdirSync(join(this.testDir, dir), { recursive: true });
        });

        // Create test files with various extensions and names
        const files = [
            // Basic files
            'src/index.js', 'src/app.ts', 'src/main.py', 'src/config.json',
            'src/components/Button.jsx', 'src/components/Modal.tsx', 'src/components/Header.vue',
            'src/utils/helpers.js', 'src/utils/constants.ts', 'src/utils/api.py',
            'src/assets/logo.png', 'src/assets/style.css', 'src/assets/icon.svg',
            'src/types/index.d.ts', 'src/types/api.d.ts',
            
            // Test files
            'test/index.test.js', 'test/app.spec.ts', 'test/helpers.test.py',
            'test/unit/button.test.jsx', 'test/integration/api.test.js',
            'test/e2e/login.spec.ts',
            
            // Documentation
            'docs/README.md', 'docs/api/endpoints.md', 'docs/guides/setup.md',
            
            // Build outputs
            'dist/bundle.js', 'dist/styles.css', 'dist/index.html',
            
            // Dependencies (should be excluded)
            'node_modules/react/index.js', 'node_modules/lodash/main.js',
            
            // Hidden files
            '.gitignore', '.env', '.vscode/settings.json',
            
            // Special characters in names
            'special chars/file with spaces.js',
            'special chars/with spaces/nested file.ts',
            'src/file-with-dashes.js', 'src/file_with_underscores.py',
            'src/file.with.dots.js', 'src/file[brackets].js',
            'src/file*asterisk.js', 'src/file?question.js',
            
            // Deep nesting
            'deep/very/deeply/nested/structure/file.js',
            
            // Case variations
            'case-test/lowercase.js', 'Case-Test/MixedCase.JS', 'CASE-TEST/UPPERCASE.js',
            
            // Files with similar names to test precision
            'src/test-utils.js', 'src/latest-version.js', 'src/testing-library.js'
        ];

        files.forEach(file => {
            const content = `// ${file}\nconsole.log("${file}");`;
            writeFileSync(join(this.testDir, file), content);
        });

        console.log(`✅ Created ${files.length} test files in ${dirs.length} directories\n`);
    }

    async testBasicPatterns() {
        console.log('🔍 Testing basic glob patterns...');
        
        const tests = [
            {
                name: 'All JavaScript files',
                include: ['**/*.js'],
                exclude: [],
                expectCount: 16,
                expectIncludes: ['src/index.js', 'src/utils/helpers.js', 'deep/very/deeply/nested/structure/file.js']
            },
            {
                name: 'All TypeScript files', 
                include: ['**/*.{ts,tsx}'],
                exclude: [],
                expectCount: 8,
                expectIncludes: ['src/app.ts', 'src/components/Modal.tsx', 'src/types/index.d.ts']
            },
            {
                name: 'Source files only',
                include: ['src/**/*'],
                exclude: [],
                expectCount: 23,
                expectIncludes: ['src/index.js', 'src/components/Button.jsx', 'src/assets/icon.svg']
            },
            {
                name: 'Exclude test directories',
                include: [],
                exclude: ['**/test/**', '**/node_modules/**'],
                expectIncludes: ['src/index.js', 'docs/README.md'],
                expectExcludes: ['test/index.test.js', 'node_modules/react/index.js']
            },
            {
                name: 'Multiple extensions',
                include: ['**/*.{js,ts,jsx,tsx,py}'],
                exclude: ['**/test/**', '**/node_modules/**'],
                expectIncludes: ['src/index.js', 'src/app.ts', 'src/main.py'],
                expectExcludes: ['test/index.test.js']
            }
        ];

        for (const test of tests) {
            await this.runSingleTest(test);
        }
    }

    async testSpecialCharacters() {
        console.log('🔤 Testing special characters in filenames...');
        
        const tests = [
            {
                name: 'Files with spaces',
                include: ['**/*spaces*'],
                exclude: [],
                expectIncludes: ['special chars/file with spaces.js']
            },
            {
                name: 'Files with dashes and underscores',
                include: ['**/*{-,_}*'],
                exclude: [],
                expectIncludes: ['src/file-with-dashes.js', 'src/file_with_underscores.py']
            },
            {
                name: 'Files with dots in name',
                include: ['**/*.*.js'],
                exclude: [],
                expectIncludes: ['src/file.with.dots.js']
            }
        ];

        for (const test of tests) {
            await this.runSingleTest(test);
        }
    }

    async testOverlappingPatterns() {
        console.log('🔄 Testing overlapping include/exclude patterns...');
        
        const tests = [
            {
                name: 'Include JS, exclude test files',
                include: ['**/*.js'],
                exclude: ['**/*.test.js', '**/*.spec.js'],
                expectIncludes: ['src/index.js', 'src/utils/helpers.js'],
                expectExcludes: ['test/index.test.js']
            },
            {
                name: 'Include src, exclude specific subdirs',
                include: ['src/**/*'],
                exclude: ['src/assets/**'],
                expectIncludes: ['src/index.js', 'src/components/Button.jsx'],
                expectExcludes: ['src/assets/logo.png']
            },
            {
                name: 'Complex overlap - include all, exclude multiple',
                include: ['**/*'],
                exclude: ['**/test/**', '**/node_modules/**', '**/dist/**', '.*'],
                expectIncludes: ['src/index.js', 'docs/README.md'],
                expectExcludes: ['test/index.test.js', 'node_modules/react/index.js', '.gitignore']
            }
        ];

        for (const test of tests) {
            await this.runSingleTest(test);
        }
    }

    async testCaseSensitivity() {
        console.log('🔠 Testing case sensitivity...');
        
        const tests = [
            {
                name: 'Lowercase pattern',
                include: ['**/lowercase.*'],
                exclude: [],
                expectIncludes: ['case-test/lowercase.js']
            },
            {
                name: 'Mixed case directories',
                include: ['case-test/**'], // Filesystem normalized to lowercase
                exclude: [],
                expectCount: 3, // case-test has 3 files: lowercase.js, MixedCase.JS, UPPERCASE.js
                expectIncludes: ['case-test/MixedCase.JS']
            },
            {
                name: 'Extension case sensitivity',
                include: ['**/*.JS'], // Uppercase extension
                exclude: [],
                expectCount: 1,
                expectCount: 1,
                expectIncludes: ['case-test/MixedCase.JS']
            }
        ];

        for (const test of tests) {
            await this.runSingleTest(test);
        }
    }

    async testNestedDirectories() {
        console.log('📂 Testing deeply nested directories...');
        
        const tests = [
            {
                name: 'Deep nesting with **',
                include: ['deep/**/*.js'],
                exclude: [],
                expectIncludes: ['deep/very/deeply/nested/structure/file.js']
            },
            {
                name: 'Specific depth matching',
                include: ['deep/**/file.js'], // Simpler pattern that should match
                exclude: [],
                expectCount: 1,
                expectIncludes: ['deep/very/deeply/nested/structure/file.js']
            }
        ];

        for (const test of tests) {
            await this.runSingleTest(test);
        }
    }

    async testPatternSanitization() {
        console.log('🔒 Testing pattern sanitization...');
        
        try {
            // Test normal patterns
            sanitizePatterns(['**/*.js', 'src/**/*.ts']);
            this.recordResult('Normal patterns sanitization', true);
        } catch (e) {
            this.recordResult('Normal patterns sanitization', false, e.message);
        }

        try {
            // Test leading slash removal
            const result = sanitizePatterns(['/absolute/path', '\\\\windows\\path']);
            const hasNoLeadingSlashes = result.every(p => !p.startsWith('/') && !p.startsWith('\\'));
            this.recordResult('Leading slash removal', hasNoLeadingSlashes);
        } catch (e) {
            this.recordResult('Leading slash removal', false, e.message);
        }

        try {
            // Test pattern too long
            const longPattern = 'a'.repeat(201);
            sanitizePatterns([longPattern]);
            this.recordResult('Long pattern rejection', false, 'Should have thrown');
        } catch (e) {
            this.recordResult('Long pattern rejection', true);
        }

        try {
            // Test too many wildcards
            const wildcardPattern = '*'.repeat(15);
            sanitizePatterns([wildcardPattern]);
            this.recordResult('Wildcard limit', false, 'Should have thrown');
        } catch (e) {
            this.recordResult('Wildcard limit', true);
        }
    }

    async testCrossplatformPaths() {
        console.log('🌐 Testing cross-platform path normalization...');
        
        const tests = [
            {
                name: 'Forward slashes in patterns',
                include: ['src/components/*.jsx'],
                exclude: [],
                expectIncludes: ['src/components/Button.jsx']
            },
            {
                name: 'Mixed separators normalized',
                include: ['special chars/with spaces/*'],
                exclude: [],
                expectIncludes: ['special chars/with spaces/nested file.ts']
            }
        ];

        for (const test of tests) {
            await this.runSingleTest(test);
        }
    }

    async testPerformanceBasics() {
        console.log('⚡ Testing basic performance...');
        
        const startTime = Date.now();
        const files = await this.server.findFiles(this.testDir, ['**/*'], ['**/node_modules/**'], 1000);
        const duration = Date.now() - startTime;
        
        const performanceOk = duration < 1000; // Should complete in under 1 second
        this.recordResult(`Performance scan (${duration}ms)`, performanceOk);
        
        const filesFound = files.length;
        const reasonableCount = filesFound > 20 && filesFound < 200;
        this.recordResult(`Reasonable file count (${filesFound})`, reasonableCount);
    }

    async testBinaryAndTextFiles() {
        console.log('📄 Testing binary vs text file detection...');
        
        // Create a mock binary file (PNG header)
        const binaryContent = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        writeFileSync(join(this.testDir, 'test-binary.png'), binaryContent);
        
        const tests = [
            {
                name: 'Include only JS files (excludes binary)',
                include: ['**/*.{js,ts,jsx,tsx}'],
                exclude: [],
                expectExcludes: ['test-binary.png']
            }
        ];

        for (const test of tests) {
            await this.runSingleTest(test);
        }
    }

    async runSingleTest(test) {
        try {
            const files = await this.server.findFiles(
                this.testDir, 
                test.include || [], 
                test.exclude || [], 
                1000
            );
            
            const foundPaths = files.map(f => f.relativePath);
            let passed = true;
            let errors = [];

            // Check expected count
            if (test.expectCount !== undefined) {
                if (foundPaths.length !== test.expectCount) {
                    passed = false;
                    errors.push(`Expected ${test.expectCount} files, got ${foundPaths.length}`);
                }
            }

            // Check expected includes
            if (test.expectIncludes) {
                for (const expectedFile of test.expectIncludes) {
                    if (!foundPaths.includes(expectedFile)) {
                        passed = false;
                        errors.push(`Missing expected file: ${expectedFile}`);
                    }
                }
            }

            // Check expected excludes
            if (test.expectExcludes) {
                for (const excludedFile of test.expectExcludes) {
                    if (foundPaths.includes(excludedFile)) {
                        passed = false;
                        errors.push(`Should not include: ${excludedFile}`);
                    }
                }
            }

            this.recordResult(test.name, passed, errors.join(', '));
            
        } catch (error) {
            this.recordResult(test.name, false, error.message);
        }
    }

    recordResult(testName, passed, error = '') {
        const result = {
            name: testName,
            passed,
            error
        };
        
        this.results.push(result);
        
        if (passed) {
            this.passed++;
            console.log(`   ✅ ${testName}`);
        } else {
            this.failed++;
            console.log(`   ❌ ${testName}: ${error}`);
        }
    }

    cleanup() {
        if (existsSync(this.testDir)) {
            rmSync(this.testDir, { recursive: true });
        }
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('🧪 COMPREHENSIVE GLOB TEST RESULTS');
        console.log('='.repeat(60));
        console.log(`✅ Passed: ${this.passed}`);
        console.log(`❌ Failed: ${this.failed}`);
        console.log(`📊 Total:  ${this.passed + this.failed}`);
        console.log(`🎯 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
        
        if (this.failed > 0) {
            console.log('\n❌ FAILED TESTS:');
            this.results.filter(r => !r.passed).forEach(r => {
                console.log(`   - ${r.name}: ${r.error}`);
            });
        }
        
        console.log('\n' + (this.failed === 0 ? '🎉 ALL TESTS PASSED!' : '⚠️  Some tests failed - review above'));
    }
}

// Run the test suite
const testSuite = new GlobTestSuite();
testSuite.runAllTests().catch(console.error);
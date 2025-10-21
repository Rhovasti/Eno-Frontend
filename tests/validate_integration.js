/**
 * Entity Explorer Integration Validation Script
 * Validates that all components are properly integrated and accessible
 */

const fs = require('fs');
const path = require('path');

class EntityExplorerValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.passed = 0;
        this.total = 0;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            'info': '✓',
            'warning': '⚠',
            'error': '✗',
            'skip': '○'
        }[type] || '✓';

        console.log(`${prefix} ${message}`);
    }

    assert(condition, message) {
        this.total++;
        if (condition) {
            this.passed++;
            this.log(message, 'info');
        } else {
            this.log(message, 'error');
            this.errors.push(message);
        }
    }

    warn(condition, message) {
        this.total++;
        if (condition) {
            this.passed++;
            this.log(message, 'info');
        } else {
            this.log(message, 'warning');
            this.warnings.push(message);
        }
    }

    // Test file existence
    testFileExistence() {
        console.log('\n=== File Existence Tests ===');

        const requiredFiles = [
            // Main HTML
            'hml/entity-explorer.html',

            // CSS
            'css/entity-explorer.css',
            'css/main.css',

            // Services
            'js/services/entitySearchService.js',

            // Components
            'js/components/EntitySearch.js',
            'js/components/RelationshipViewer.js',

            // Routes
            'js/routes/entityRoutes.js',

            // Main integration
            'js/entity-explorer.js',

            // Dependencies
            'js/lib/jwt-decode.min.js'
        ];

        for (const file of requiredFiles) {
            this.assert(
                fs.existsSync(file),
                `Required file exists: ${file}`
            );
        }
    }

    // Test HTML structure
    testHTMLStructure() {
        console.log('\n=== HTML Structure Tests ===');

        try {
            const htmlPath = 'hml/entity-explorer.html';
            this.assert(
                fs.existsSync(htmlPath),
                'Entity Explorer HTML file exists'
            );

            if (fs.existsSync(htmlPath)) {
                const html = fs.readFileSync(htmlPath, 'utf8');

                // Check for required elements
                this.assert(
                    html.includes('Entity Explorer'),
                    'HTML contains Entity Explorer title'
                );

                this.assert(
                    html.includes('entity-search-container'),
                    'HTML contains search container'
                );

                this.assert(
                    html.includes('relationship-viewer-container'),
                    'HTML contains relationship viewer container'
                );

                this.assert(
                    html.includes('entity-explorer.js'),
                    'HTML includes main JavaScript file'
                );

                this.assert(
                    html.includes('entity-explorer.css'),
                    'HTML includes CSS file'
                );

                // Check for component scripts
                this.assert(
                    html.includes('EntitySearch.js'),
                    'HTML includes EntitySearch component'
                );

                this.assert(
                    html.includes('RelationshipViewer.js'),
                    'HTML includes RelationshipViewer component'
                );

                this.assert(
                    html.includes('entityRoutes.js'),
                    'HTML includes routes file'
                );
            }
        } catch (error) {
            this.assert(false, `Failed to read HTML file: ${error.message}`);
        }
    }

    // Test CSS structure
    testCSSStructure() {
        console.log('\n=== CSS Structure Tests ===');

        try {
            const cssPath = 'css/entity-explorer.css';
            this.assert(
                fs.existsSync(cssPath),
                'Entity Explorer CSS file exists'
            );

            if (fs.existsSync(cssPath)) {
                const css = fs.readFileSync(cssPath, 'utf8');

                // Check for required CSS classes
                const requiredClasses = [
                    '.main-header',
                    '.entity-search-container',
                    '.relationship-viewer-container',
                    '.entity-search-results',
                    '.loading-overlay',
                    '.error-modal'
                ];

                for (const className of requiredClasses) {
                    this.assert(
                        css.includes(className),
                        `CSS contains required class: ${className}`
                    );
                }

                // Check for responsive design
                this.assert(
                    css.includes('@media'),
                    'CSS includes responsive design queries'
                );

                this.assert(
                    css.includes('grid-template-columns'),
                    'CSS includes grid layout for responsive design'
                );
            }
        } catch (error) {
            this.assert(false, `Failed to read CSS file: ${error.message}`);
        }
    }

    // Test JavaScript structure
    testJavaScriptStructure() {
        console.log('\n=== JavaScript Structure Tests ===');

        try {
            const jsPath = 'js/entity-explorer.js';
            this.assert(
                fs.existsSync(jsPath),
                'Entity Explorer JavaScript file exists'
            );

            if (fs.existsSync(jsPath)) {
                const js = fs.readFileSync(jsPath, 'utf8');

                // Check for required classes and functions
                this.assert(
                    js.includes('class EntityExplorer'),
                    'JavaScript contains EntityExplorer class'
                );

                this.assert(
                    js.includes('async init()'),
                    'JavaScript contains async init method'
                );

                this.assert(
                    js.includes('EntitySearchService'),
                    'JavaScript imports EntitySearchService'
                );

                this.assert(
                    js.includes('document.addEventListener'),
                    'JavaScript includes DOM event listeners'
                );

                // Check for component initialization
                this.assert(
                    js.includes('EntitySearch'),
                    'JavaScript initializes EntitySearch component'
                );

                this.assert(
                    js.includes('RelationshipViewer'),
                    'JavaScript initializes RelationshipViewer component'
                );
            }
        } catch (error) {
            this.assert(false, `Failed to read JavaScript file: ${error.message}`);
        }
    }

    // Test component files
    testComponentFiles() {
        console.log('\n=== Component Files Tests ===');

        const componentFiles = [
            {
                path: 'js/services/entitySearchService.js',
                checks: ['class EntitySearchService', 'searchEntities', 'getEntityDetails']
            },
            {
                path: 'js/components/EntitySearch.js',
                checks: ['class EntitySearch', 'search', 'displayResults']
            },
            {
                path: 'js/components/RelationshipViewer.js',
                checks: ['class RelationshipViewer', 'loadEntity', 'displayRelationships']
            },
            {
                path: 'js/routes/entityRoutes.js',
                checks: ['router', '/api/entities', 'authenticateToken']
            }
        ];

        for (const component of componentFiles) {
            try {
                this.assert(
                    fs.existsSync(component.path),
                    `Component file exists: ${component.path}`
                );

                if (fs.existsSync(component.path)) {
                    const content = fs.readFileSync(component.path, 'utf8');

                    for (const check of component.checks) {
                        this.assert(
                            content.includes(check),
                            `${component.path} contains: ${check}`
                        );
                    }
                }
            } catch (error) {
                this.assert(false, `Failed to read component file ${component.path}: ${error.message}`);
            }
        }
    }

    // Test file sizes (basic quality check)
    testFileSizes() {
        console.log('\n=== File Size Tests ===');

        const sizeChecks = [
            { path: 'hml/entity-explorer.html', min: 5000, name: 'HTML file' },
            { path: 'css/entity-explorer.css', min: 3000, name: 'CSS file' },
            { path: 'js/entity-explorer.js', min: 2000, name: 'Main JavaScript file' },
            { path: 'js/services/entitySearchService.js', min: 1000, name: 'Entity Search Service' },
            { path: 'js/components/EntitySearch.js', min: 1000, name: 'EntitySearch Component' },
            { path: 'js/components/RelationshipViewer.js', min: 1000, name: 'RelationshipViewer Component' }
        ];

        for (const check of sizeChecks) {
            try {
                if (fs.existsSync(check.path)) {
                    const stats = fs.statSync(check.path);
                    const sizeKB = Math.round(stats.size / 1024);

                    this.warn(
                        sizeKB >= check.min,
                        `${check.name} size: ${sizeKB}KB (minimum: ${check.min}KB)`
                    );
                }
            } catch (error) {
                this.assert(false, `Failed to check size of ${check.path}: ${error.message}`);
            }
        }
    }

    // Test for potential issues
    testPotentialIssues() {
        console.log('\n=== Potential Issues Tests ===');

        try {
            // Check for TODO comments
            const files = [
                'js/entity-explorer.js',
                'js/services/entitySearchService.js',
                'js/components/EntitySearch.js',
                'js/components/RelationshipViewer.js'
            ];

            let todoCount = 0;
            for (const file of files) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    const todos = content.match(/TODO|FIXME|HACK/gi);
                    if (todos) {
                        todoCount += todos.length;
                    }
                }
            }

            this.warn(
                todoCount <= 5,
                `Found ${todoCount} TODO/FIXME comments (should be <= 5)`
            );

            // Check for console.log statements (should be minimal in production)
            let consoleLogCount = 0;
            for (const file of files) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    const logs = content.match(/console\.log/g);
                    if (logs) {
                        consoleLogCount += logs.length;
                    }
                }
            }

            this.warn(
                consoleLogCount <= 10,
                `Found ${consoleLogCount} console.log statements (should be <= 10)`
            );

        } catch (error) {
            this.log(`Error checking potential issues: ${error.message}`, 'warning');
        }
    }

    // Run all validation tests
    runAllTests() {
        console.log('🔍 Entity Explorer Integration Validation');
        console.log('=' .repeat(50));

        this.testFileExistence();
        this.testHTMLStructure();
        this.testCSSStructure();
        this.testJavaScriptStructure();
        this.testComponentFiles();
        this.testFileSizes();
        this.testPotentialIssues();

        // Print summary
        console.log('\n' + '=' .repeat(50));
        console.log('📊 Validation Summary:');
        console.log(`  Total Tests: ${this.total}`);
        console.log(`  Passed: ${this.passed}`);
        console.log(`  Failed: ${this.errors.length}`);
        console.log(`  Warnings: ${this.warnings.length}`);

        const successRate = this.total > 0 ? (this.passed / this.total) * 100 : 0;
        console.log(`  Success Rate: ${successRate.toFixed(1)}%`);

        if (this.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.errors.forEach(error => console.log(`  - ${error}`));
        }

        if (this.warnings.length > 0) {
            console.log('\n⚠️  Warnings:');
            this.warnings.forEach(warning => console.log(`  - ${warning}`));
        }

        if (successRate >= 90) {
            console.log('\n🎉 Integration validation successful!');
            return true;
        } else {
            console.log('\n❌ Integration validation failed. Please address the issues above.');
            return false;
        }
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new EntityExplorerValidator();
    const success = validator.runAllTests();
    process.exit(success ? 0 : 1);
}

module.exports = EntityExplorerValidator;
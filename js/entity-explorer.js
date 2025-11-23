/**
 * Entity Explorer Main JavaScript - Dynamic Knowledge Graph Integration
 * Initializes and orchestrates all Entity Explorer components
 */

// Import components (using global scope for browser compatibility)
// Components are loaded via script tags in HTML

class EntityExplorer {
    constructor() {
        this.searchService = null;
        this.entitySearch = null;
        this.relationshipViewer = null;
        this.serviceStatus = null;

        // UI state
        this.isInitialized = false;
        this.isLoading = false;
        this.currentEntity = null;

        // Statistics
        this.statistics = {
            totalEntities: 0,
            totalRelationships: 0,
            semanticSearches: 0,
            graphSearches: 0
        };

        // Cache for performance
        this.cache = {
            searchResults: new Map(),
            entityDetails: new Map(),
            relationships: new Map()
        };

        this.init();
    }

    /**
     * Initialize the Entity Explorer
     */
    async init() {
        try {
            console.log('Initializing Entity Explorer...');

            // Show loading overlay
            this.showLoading();

            // Initialize services
            await this.initializeServices();

            // Initialize components
            await this.initializeComponents();

            // Set up event listeners
            this.setupEventListeners();

            // Check service status
            await this.checkServiceStatus();

            // Load initial statistics
            await this.loadStatistics();

            // Hide loading overlay
            this.hideLoading();

            this.isInitialized = true;
            console.log('Entity Explorer initialized successfully');

        } catch (error) {
            console.error('Failed to initialize Entity Explorer:', error);
            this.hideLoading();
            this.showError('Failed to initialize Entity Explorer: ' + error.message);
        }
    }

    /**
     * Initialize services
     */
    async initializeServices() {
        try {
            // Initialize Entity Search Service
            this.searchService = new EntitySearchService();
            console.log('Entity Search Service initialized');

        } catch (error) {
            console.error('Failed to initialize services:', error);
            throw error;
        }
    }

    /**
     * Initialize UI components
     */
    async initializeComponents() {
        try {
            // Initialize Entity Search component
            const searchContainer = document.getElementById('entity-search-container');
            if (searchContainer) {
                this.entitySearch = new EntitySearch('entity-search-container', this.searchService);

                // Set up event handlers for search component
                this.entitySearch.on('search', this.handleSearch.bind(this));
                this.entitySearch.on('entitySelected', this.handleEntitySelected.bind(this));
                console.log('Entity Search component initialized');
            }

            // Initialize Relationship Viewer component
            const relationshipContainer = document.getElementById('relationship-viewer-container');
            if (relationshipContainer) {
                this.relationshipViewer = new RelationshipViewer('relationship-viewer-container', this.searchService);

                // Set up event handlers for relationship viewer
                this.relationshipViewer.on('relationshipSelected', this.handleRelationshipSelected.bind(this));
                console.log('Relationship Viewer component initialized');
            }

        } catch (error) {
            console.error('Failed to initialize components:', error);
            throw error;
        }
    }

    /**
     * Set up global event listeners
     */
    setupEventListeners() {
        try {
            // Toggle sidebar
            const toggleBtn = document.getElementById('toggle-sidebar');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', this.toggleSidebar.bind(this));
            }

            // Error modal handlers
            const errorRetry = document.getElementById('error-retry');
            const errorDismiss = document.getElementById('error-dismiss');
            const errorModalClose = document.getElementById('error-modal-close');

            if (errorRetry) {
                errorRetry.addEventListener('click', this.handleRetry.bind(this));
            }

            if (errorDismiss) {
                errorDismiss.addEventListener('click', this.hideError.bind(this));
            }

            if (errorModalClose) {
                errorModalClose.addEventListener('click', this.hideError.bind(this));
            }

            // Close modal on background click
            const errorModal = document.getElementById('error-modal');
            if (errorModal) {
                errorModal.addEventListener('click', (e) => {
                    if (e.target === errorModal) {
                        this.hideError();
                    }
                });
            }

            // Keyboard shortcuts
            document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

            // Page visibility change
            document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

            console.log('Event listeners set up');

        } catch (error) {
            console.error('Failed to set up event listeners:', error);
        }
    }

    /**
     * Check service status
     */
    async checkServiceStatus() {
        try {
            this.updateStatusIndicator('Checking...', 'checking');

            const status = await this.searchService.getServiceStatus();
            this.serviceStatus = status;

            // Update UI based on status
            if (status.chroma_connected && status.neo4j_connected) {
                this.updateStatusIndicator('All services online', 'online');
            } else if (status.chroma_connected || status.neo4j_connected) {
                this.updateStatusIndicator('Partial service availability', 'partial');
            } else {
                this.updateStatusIndicator('Services offline', 'offline');
            }

        } catch (error) {
            console.error('Failed to check service status:', error);
            this.updateStatusIndicator('Service status unknown', 'offline');
        }
    }

    /**
     * Load statistics
     */
    async loadStatistics() {
        try {
            // Get available entity types to show basic statistics
            const entityTypes = await this.searchService.getAvailableEntityTypes();

            // Update statistics display
            this.updateStatisticsDisplay({
                totalEntities: this.statistics.totalEntities,
                totalRelationships: this.statistics.totalRelationships,
                semanticSearches: this.statistics.semanticSearches,
                graphSearches: this.statistics.graphSearches,
                availableEntityTypes: entityTypes.length
            });

            // Show statistics section
            const statsSection = document.getElementById('statistics-section');
            if (statsSection) {
                statsSection.style.display = 'block';
            }

        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    }

    /**
     * Handle search event
     */
    async handleSearch(searchData) {
        try {
            console.log('Search performed:', searchData);

            // Update search statistics
            if (searchData.searchMode === 'semantic') {
                this.statistics.semanticSearches++;
            } else if (searchData.searchMode === 'graph') {
                this.statistics.graphSearches++;
            }

            // Update statistics display
            this.updateStatisticsDisplay(this.statistics);

            // Cache search results
            const cacheKey = this.getSearchCacheKey(searchData.query, searchData.options);
            this.cache.searchResults.set(cacheKey, searchData.results);

        } catch (error) {
            console.error('Failed to handle search:', error);
        }
    }

    /**
     * Handle entity selection
     */
    async handleEntitySelected(entity) {
        try {
            console.log('Entity selected:', entity);
            this.currentEntity = entity;

            // Update relationship viewer
            if (this.relationshipViewer) {
                await this.relationshipViewer.loadEntity(entity);
            }

            // Update entity count in statistics
            if (entity && !this.cache.entityDetails.has(entity.id)) {
                this.statistics.totalEntities++;
                this.cache.entityDetails.set(entity.id, entity);
                this.updateStatisticsDisplay(this.statistics);
            }

        } catch (error) {
            console.error('Failed to handle entity selection:', error);
        }
    }

    /**
     * Handle relationship selection
     */
    async handleRelationshipSelected(relationship) {
        try {
            console.log('Relationship selected:', relationship);

            // Update relationship count in statistics
            if (relationship && !this.cache.relationships.has(relationship.id)) {
                this.statistics.totalRelationships++;
                this.cache.relationships.set(relationship.id, relationship);
                this.updateStatisticsDisplay(this.statistics);
            }

        } catch (error) {
            console.error('Failed to handle relationship selection:', error);
        }
    }

    /**
     * Toggle sidebar visibility
     */
    toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            const isCollapsed = sidebar.classList.contains('collapsed');

            if (isCollapsed) {
                sidebar.classList.remove('collapsed');
                sidebar.style.display = 'block';
            } else {
                sidebar.classList.add('collapsed');
                sidebar.style.display = 'none';
            }
        }
    }

    /**
     * Handle retry button click
     */
    async handleRetry() {
        this.hideError();
        this.showLoading();

        try {
            await this.checkServiceStatus();
            await this.loadStatistics();
            this.hideLoading();
        } catch (error) {
            this.hideLoading();
            this.showError('Failed to retry: ' + error.message);
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(event) {
        // Only handle shortcuts when not in input fields
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (event.key) {
            case 'Escape':
                // Close modals
                this.hideError();
                break;

            case '/':
                // Focus search
                event.preventDefault();
                if (this.entitySearch && this.entitySearch.focusSearch) {
                    this.entitySearch.focusSearch();
                }
                break;

            case 's':
                // Toggle sidebar
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    this.toggleSidebar();
                }
                break;
        }
    }

    /**
     * Handle page visibility change
     */
    async handleVisibilityChange() {
        if (!document.hidden && this.isInitialized) {
            // Page became visible again, refresh service status
            await this.checkServiceStatus();
        }
    }

    /**
     * Update status indicator
     */
    updateStatusIndicator(text, status) {
        const statusText = document.getElementById('status-text');
        const statusIndicator = document.getElementById('status-indicator');

        if (statusText) {
            statusText.textContent = text;
        }

        if (statusIndicator) {
            statusIndicator.className = 'status-indicator';

            switch (status) {
                case 'online':
                    statusIndicator.classList.add('online');
                    break;
                case 'offline':
                    statusIndicator.classList.add('offline');
                    break;
                case 'partial':
                    // Use default (yellow/pulsing) for partial status
                    break;
                default:
                    // Default checking state
                    break;
            }
        }
    }

    /**
     * Update statistics display
     */
    updateStatisticsDisplay(stats) {
        const elements = {
            'total-entities': stats.totalEntities || 0,
            'total-relationships': stats.totalRelationships || 0,
            'semantic-searches': stats.semanticSearches || 0,
            'graph-searches': stats.graphSearches || 0
        };

        for (const [id, value] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) {
                // Animate number change
                this.animateNumber(element, parseInt(element.textContent) || 0, value);
            }
        }
    }

    /**
     * Animate number changes
     */
    animateNumber(element, from, to) {
        const duration = 1000; // 1 second
        const steps = 30;
        const stepDuration = duration / steps;
        const increment = (to - from) / steps;

        let current = from;
        let step = 0;

        const timer = setInterval(() => {
            step++;
            current += increment;

            if (step >= steps) {
                current = to;
                clearInterval(timer);
            }

            element.textContent = Math.round(current).toLocaleString();
        }, stepDuration);
    }

    /**
     * Get cache key for search results
     */
    getSearchCacheKey(query, options) {
        const optionsStr = JSON.stringify(options || {});
        return `${query}:${optionsStr}`;
    }

    /**
     * Show loading overlay
     */
    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
        this.isLoading = true;
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        this.isLoading = false;
    }

    /**
     * Show error modal
     */
    showError(message) {
        const errorMessage = document.getElementById('error-message');
        const errorModal = document.getElementById('error-modal');

        if (errorMessage) {
            errorMessage.textContent = message;
        }

        if (errorModal) {
            errorModal.style.display = 'flex';
        }
    }

    /**
     * Hide error modal
     */
    hideError() {
        const errorModal = document.getElementById('error-modal');
        if (errorModal) {
            errorModal.style.display = 'none';
        }
    }

    /**
     * Clear all caches
     */
    clearCaches() {
        this.cache.searchResults.clear();
        this.cache.entityDetails.clear();
        this.cache.relationships.clear();

        if (this.searchService) {
            this.searchService.clearCache();
        }

        console.log('All caches cleared');
    }

    /**
     * Get current application state
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            isLoading: this.isLoading,
            currentEntity: this.currentEntity,
            serviceStatus: this.serviceStatus,
            statistics: { ...this.statistics },
            cacheSize: {
                searchResults: this.cache.searchResults.size,
                entityDetails: this.cache.entityDetails.size,
                relationships: this.cache.relationships.size
            }
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Clear caches
        this.clearCaches();

        // Cleanup components
        if (this.entitySearch && this.entitySearch.destroy) {
            this.entitySearch.destroy();
        }

        if (this.relationshipViewer && this.relationshipViewer.destroy) {
            this.relationshipViewer.destroy();
        }

        // Reset state
        this.isInitialized = false;
        this.currentEntity = null;

        console.log('Entity Explorer destroyed');
    }
}

// Initialize Entity Explorer when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Create global instance
        window.entityExplorer = new EntityExplorer();

        // Make instance available globally for debugging
        console.log('Entity Explorer instance available as window.entityExplorer');

    } catch (error) {
        console.error('Failed to initialize Entity Explorer on DOM load:', error);

        // Show error immediately if initialization fails
        const errorMessage = document.getElementById('error-message');
        const errorModal = document.getElementById('error-modal');

        if (errorMessage) {
            errorMessage.textContent = 'Failed to initialize Entity Explorer: ' + error.message;
        }

        if (errorModal) {
            errorModal.style.display = 'flex';
        }
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.entityExplorer) {
        window.entityExplorer.destroy();
    }
});

// Export for module usage (if applicable)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EntityExplorer;
}
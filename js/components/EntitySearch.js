/**
 * Entity Search Component - Interactive entity search with real-time suggestions
 * Follows existing component organization patterns in js/
 */

class EntitySearch {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);

        if (!this.container) {
            throw new Error(`Container with ID '${containerId}' not found`);
        }

        // Configuration
        this.options = {
            maxResults: 10,
            minQueryLength: 2,
            debounceDelay: 300,
            includeRelationships: true,
            showSearchModes: true,
            enableSemanticHighlighting: true,
            ...options
        };

        // State
        this.currentQuery = '';
        this.currentResults = [];
        this.isLoading = false;
        this.searchTimeout = null;
        this.selectedEntity = null;

        // Initialize component
        this.init();
    }

    /**
     * Initialize the entity search component
     */
    init() {
        this.render();
        this.bindEvents();
        this.loadEntityTypes();
    }

    /**
     * Render the component HTML
     */
    render() {
        this.container.innerHTML = `
            <div class="entity-search-component">
                <div class="search-header">
                    <h3>Entity Search</h3>
                    <div class="search-controls">
                        ${this.options.showSearchModes ? this.renderSearchModeSelector() : ''}
                        <select id="entity-type-filter" class="entity-type-filter">
                            <option value="">All Types</option>
                        </select>
                    </div>
                </div>

                <div class="search-input-container">
                    <input
                        type="text"
                        id="entity-search-input"
                        class="entity-search-input"
                        placeholder="Search for entities..."
                        autocomplete="off"
                    >
                    <div class="search-input-status">
                        <span id="search-status" class="search-status"></span>
                        <button id="clear-search" class="clear-search-btn" style="display: none;">×</button>
                    </div>
                </div>

                <div class="search-loading" id="search-loading" style="display: none;">
                    <div class="spinner"></div>
                    <span>Searching entities...</span>
                </div>

                <div class="search-suggestions" id="search-suggestions" style="display: none;">
                </div>

                <div class="search-results" id="search-results" style="display: none;">
                    <div class="results-header">
                        <span id="results-count"></span>
                        <div class="results-info">
                            <span id="search-time"></span>
                            <span id="search-sources"></span>
                        </div>
                    </div>
                    <div class="results-list" id="results-list">
                    </div>
                </div>

                <div class="search-empty" id="search-empty" style="display: none;">
                    <div class="empty-message">
                        <p>No entities found. Try adjusting your search criteria.</p>
                    </div>
                </div>

                <div class="search-error" id="search-error" style="display: none;">
                    <div class="error-message">
                        <p>An error occurred while searching. Please try again.</p>
                        <button id="retry-search" class="retry-btn">Retry</button>
                    </div>
                </div>
            </div>
        `;

        // Add styles if not already present
        this.addStyles();
    }

    /**
     * Render search mode selector
     */
    renderSearchModeSelector() {
        return `
            <div class="search-mode-selector">
                <label>Search Mode:</label>
                <select id="search-mode" class="search-mode">
                    <option value="combined">Combined</option>
                    <option value="semantic">Semantic</option>
                    <option value="graph">Graph</option>
                </select>
            </div>
        `;
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        const searchInput = this.container.querySelector('#entity-search-input');
        const entityTypeFilter = this.container.querySelector('#entity-type-filter');
        const searchMode = this.container.querySelector('#search-mode');
        const clearButton = this.container.querySelector('#clear-search');
        const retryButton = this.container.querySelector('#retry-search');

        // Search input events
        searchInput.addEventListener('input', (e) => {
            this.handleSearchInput(e.target.value);
        });

        searchInput.addEventListener('keydown', (e) => {
            this.handleSearchKeydown(e);
        });

        searchInput.addEventListener('focus', () => {
            this.showSuggestions();
        });

        // Filter changes
        entityTypeFilter.addEventListener('change', () => {
            this.performSearch();
        });

        if (searchMode) {
            searchMode.addEventListener('change', () => {
                this.performSearch();
            });
        }

        // Clear button
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.clearSearch();
            });
        }

        // Retry button
        if (retryButton) {
            retryButton.addEventListener('click', () => {
                this.performSearch();
            });
        }

        // Click outside to close suggestions
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.hideSuggestions();
            }
        });
    }

    /**
     * Handle search input with debouncing
     */
    handleSearchInput(query) {
        this.currentQuery = query.trim();

        // Clear existing timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Update clear button visibility
        const clearButton = this.container.querySelector('#clear-search');
        if (clearButton) {
            clearButton.style.display = this.currentQuery ? 'block' : 'none';
        }

        // Update status
        this.updateStatus('');

        if (this.currentQuery.length < this.options.minQueryLength) {
            this.hideResults();
            this.hideSuggestions();
            return;
        }

        // Set loading state
        this.setLoading(true);

        // Debounced search
        this.searchTimeout = setTimeout(() => {
            this.performSearch();
        }, this.options.debounceDelay);
    }

    /**
     * Handle keyboard navigation in search
     */
    handleSearchKeydown(e) {
        const suggestions = this.container.querySelector('#search-suggestions');
        const suggestionItems = suggestions ? suggestions.querySelectorAll('.suggestion-item') : [];

        if (suggestionItems.length === 0) return;

        let currentIndex = -1;
        for (let i = 0; i < suggestionItems.length; i++) {
            if (suggestionItems[i].classList.contains('selected')) {
                currentIndex = i;
                break;
            }
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                currentIndex = Math.min(currentIndex + 1, suggestionItems.length - 1);
                this.selectSuggestion(currentIndex);
                break;
            case 'ArrowUp':
                e.preventDefault();
                currentIndex = Math.max(currentIndex - 1, 0);
                this.selectSuggestion(currentIndex);
                break;
            case 'Enter':
                e.preventDefault();
                if (currentIndex >= 0) {
                    this.selectSuggestionEntity(currentIndex);
                } else {
                    this.performSearch();
                }
                break;
            case 'Escape':
                this.hideSuggestions();
                break;
        }
    }

    /**
     * Perform entity search
     */
    async performSearch() {
        if (!this.currentQuery || this.currentQuery.length < this.options.minQueryLength) {
            return;
        }

        try {
            this.setLoading(true);
            this.hideError();

            // Get search parameters
            const entityTypeFilter = this.container.querySelector('#entity-type-filter');
            const searchMode = this.container.querySelector('#search-mode');

            const entityTypes = entityTypeFilter && entityTypeFilter.value ? [entityTypeFilter.value] : [];
            const mode = searchMode ? searchMode.value : 'combined';

            // Perform search through service
            const results = await window.entitySearchService.searchEntities(this.currentQuery, {
                entityTypes,
                maxResults: this.options.maxResults,
                includeRelationships: this.options.includeRelationships,
                searchMode: mode
            });

            this.currentResults = results.results || [];
            this.displayResults(results);

        } catch (error) {
            console.error('Search error:', error);
            this.showError(error.message);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Display search results
     */
    displayResults(results) {
        const resultsContainer = this.container.querySelector('#search-results');
        const resultsList = this.container.querySelector('#results-list');
        const resultsCount = this.container.querySelector('#results-count');
        const searchTime = this.container.querySelector('#search-time');
        const searchSources = this.container.querySelector('#search-sources');
        const emptyContainer = this.container.querySelector('#search-empty');

        if (!results.results || results.results.length === 0) {
            resultsContainer.style.display = 'none';
            emptyContainer.style.display = 'block';
            return;
        }

        // Update results info
        resultsCount.textContent = `${results.total_count} entities found`;
        searchTime.textContent = `(${results.search_time.toFixed(2)}s)`;

        if (results.sources_used && results.sources_used.length > 0) {
            searchSources.textContent = `Sources: ${results.sources_used.join(', ')}`;
        }

        // Render results
        resultsList.innerHTML = results.results.map(entity =>
            this.renderEntityResult(entity)
        ).join('');

        // Bind result events
        this.bindResultEvents();

        // Show results
        resultsContainer.style.display = 'block';
        emptyContainer.style.display = 'none';
    }

    /**
     * Render individual entity result
     */
    renderEntityResult(entity) {
        const relevanceScore = Math.round(entity.relevance_score * 100);
        const semanticScore = entity.semantic_score > 0 ?
            Math.round(entity.semantic_score * 100) : null;

        return `
            <div class="entity-result" data-entity-id="${entity.entity_id}" data-entity-name="${entity.name}" data-entity-type="${entity.entity_type}">
                <div class="entity-header">
                    <h4 class="entity-name">${this.highlightSearchTerm(entity.name)}</h4>
                    <span class="entity-type">${entity.entity_type}</span>
                    <div class="entity-scores">
                        <span class="relevance-score" title="Relevance Score">${relevanceScore}%</span>
                        ${semanticScore !== null ? `<span class="semantic-score" title="Semantic Score">${semanticScore}%</span>` : ''}
                    </div>
                </div>
                <div class="entity-description">
                    ${entity.description ? this.highlightSearchTerm(entity.description) : '<em>No description available</em>'}
                </div>
                ${entity.relationships && entity.relationships.length > 0 ?
                    `<div class="entity-relationships">
                        <span class="relationship-count">${entity.relationships.length} relationships</span>
                    </div>` : ''
                }
                <div class="entity-actions">
                    <button class="view-details-btn" data-entity="${entity.name}" data-type="${entity.entity_type}">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Highlight search term in text
     */
    highlightSearchTerm(text) {
        if (!this.options.enableSemanticHighlighting || !this.currentQuery) {
            return text;
        }

        const regex = new RegExp(`(${this.currentQuery})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    /**
     * Bind events to result elements
     */
    bindResultEvents() {
        const viewDetailsButtons = this.container.querySelectorAll('.view-details-btn');

        viewDetailsButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const entityName = e.target.dataset.entity;
                const entityType = e.target.dataset.type;
                this.selectEntity(entityName, entityType);
            });
        });
    }

    /**
     * Select an entity for detailed view
     */
    async selectEntity(entityName, entityType) {
        try {
            this.selectedEntity = { name: entityName, type: entityType };

            // Get detailed entity information
            const entityDetails = await window.entitySearchService.getEntityDetails(
                entityName,
                entityType,
                true
            );

            if (entityDetails) {
                this.displayEntityDetails(entityDetails);
                // Trigger custom event for entity selection
                this.container.dispatchEvent(new CustomEvent('entitySelected', {
                    detail: { entity: entityDetails }
                }));
            }

        } catch (error) {
            console.error('Error getting entity details:', error);
            this.showError('Failed to load entity details');
        }
    }

    /**
     * Display detailed entity information
     */
    displayEntityDetails(entity) {
        // This would typically open a modal or navigate to a detail view
        // For now, we'll log the selection and trigger events
        console.log('Selected entity:', entity);

        // You could integrate with RelationshipViewer here
        if (window.relationshipViewer) {
            window.relationshipViewer.loadEntity(entity);
        }
    }

    /**
     * Set loading state
     */
    setLoading(isLoading) {
        this.isLoading = isLoading;
        const loadingContainer = this.container.querySelector('#search-loading');
        const searchInput = this.container.querySelector('#entity-search-input');

        if (isLoading) {
            loadingContainer.style.display = 'flex';
            searchInput.classList.add('loading');
            this.updateStatus('Searching...');
        } else {
            loadingContainer.style.display = 'none';
            searchInput.classList.remove('loading');
            this.updateStatus('');
        }
    }

    /**
     * Update status message
     */
    updateStatus(message) {
        const statusElement = this.container.querySelector('#search-status');
        if (statusElement) {
            statusElement.textContent = message;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorContainer = this.container.querySelector('#search-error');
        const errorMessage = errorContainer.querySelector('.error-message p');

        if (errorMessage) {
            errorMessage.textContent = message;
        }

        errorContainer.style.display = 'block';
        this.hideResults();
    }

    /**
     * Hide error message
     */
    hideError() {
        const errorContainer = this.container.querySelector('#search-error');
        errorContainer.style.display = 'none';
    }

    /**
     * Hide results
     */
    hideResults() {
        const resultsContainer = this.container.querySelector('#search-results');
        const emptyContainer = this.container.querySelector('#search-empty');

        resultsContainer.style.display = 'none';
        emptyContainer.style.display = 'none';
    }

    /**
     * Show suggestions (placeholder for future implementation)
     */
    showSuggestions() {
        // This could be implemented to show autocomplete suggestions
        // For now, we'll leave it empty
    }

    /**
     * Hide suggestions
     */
    hideSuggestions() {
        const suggestionsContainer = this.container.querySelector('#search-suggestions');
        suggestionsContainer.style.display = 'none';
    }

    /**
     * Clear search
     */
    clearSearch() {
        const searchInput = this.container.querySelector('#entity-search-input');
        searchInput.value = '';
        this.currentQuery = '';
        this.currentResults = [];
        this.hideResults();
        this.hideSuggestions();
        this.updateStatus('');

        const clearButton = this.container.querySelector('#clear-search');
        if (clearButton) {
            clearButton.style.display = 'none';
        }
    }

    /**
     * Load available entity types
     */
    async loadEntityTypes() {
        try {
            const entityTypes = await window.entitySearchService.getAvailableEntityTypes();
            const typeFilter = this.container.querySelector('#entity-type-filter');

            if (typeFilter) {
                entityTypes.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type;
                    option.textContent = type;
                    typeFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading entity types:', error);
        }
    }

    /**
     * Add component styles
     */
    addStyles() {
        if (document.getElementById('entity-search-styles')) {
            return; // Styles already added
        }

        const styles = document.createElement('style');
        styles.id = 'entity-search-styles';
        styles.textContent = `
            .entity-search-component {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                font-family: Arial, sans-serif;
            }

            .search-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }

            .search-controls {
                display: flex;
                gap: 10px;
                align-items: center;
            }

            .search-input-container {
                position: relative;
                margin-bottom: 20px;
            }

            .entity-search-input {
                width: 100%;
                padding: 12px 40px 12px 16px;
                border: 2px solid #ddd;
                border-radius: 8px;
                font-size: 16px;
                box-sizing: border-box;
            }

            .entity-search-input:focus {
                outline: none;
                border-color: #007bff;
            }

            .entity-search-input.loading {
                background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-dasharray="31.416" stroke-dashoffset="31.416"><animate attributeName="stroke-dashoffset" from="31.416" to="0" dur="1s" repeatCount="indefinite"/></circle></svg>');
                background-repeat: no-repeat;
                background-position: right 12px center;
            }

            .search-input-status {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .search-status {
                font-size: 14px;
                color: #666;
            }

            .clear-search-btn {
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #999;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .clear-search-btn:hover {
                color: #666;
            }

            .search-loading {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 20px;
                text-align: center;
                color: #666;
            }

            .spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .results-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding-bottom: 10px;
                border-bottom: 1px solid #eee;
                margin-bottom: 15px;
            }

            .results-info {
                display: flex;
                gap: 15px;
                font-size: 14px;
                color: #666;
            }

            .entity-result {
                border: 1px solid #eee;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 12px;
                transition: box-shadow 0.2s ease;
            }

            .entity-result:hover {
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }

            .entity-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 10px;
            }

            .entity-name {
                margin: 0;
                color: #333;
                font-size: 18px;
            }

            .entity-type {
                background: #007bff;
                color: white;
                padding: 2px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
            }

            .entity-scores {
                display: flex;
                gap: 8px;
                flex-direction: column;
                align-items: flex-end;
            }

            .relevance-score, .semantic-score {
                font-size: 12px;
                padding: 2px 6px;
                border-radius: 10px;
                font-weight: bold;
            }

            .relevance-score {
                background: #28a745;
                color: white;
            }

            .semantic-score {
                background: #ffc107;
                color: #212529;
            }

            .entity-description {
                color: #666;
                margin-bottom: 10px;
                line-height: 1.4;
            }

            .entity-relationships {
                margin-bottom: 10px;
            }

            .relationship-count {
                font-size: 12px;
                color: #007bff;
                font-weight: bold;
            }

            .entity-actions {
                text-align: right;
            }

            .view-details-btn {
                background: #007bff;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            }

            .view-details-btn:hover {
                background: #0056b3;
            }

            .search-empty, .search-error {
                text-align: center;
                padding: 40px 20px;
                color: #666;
            }

            .error-message {
                color: #dc3545;
            }

            .retry-btn {
                background: #dc3545;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                margin-top: 10px;
            }

            .retry-btn:hover {
                background: #c82333;
            }

            mark {
                background: #fff3cd;
                padding: 1px 2px;
                border-radius: 2px;
            }

            .entity-type-filter, .search-mode {
                padding: 6px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
            }

            .search-mode-selector {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .search-mode-selector label {
                font-size: 14px;
                font-weight: bold;
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * Public method to perform search programmatically
     */
    search(query, options = {}) {
        const searchInput = this.container.querySelector('#entity-search-input');
        searchInput.value = query;
        this.handleSearchInput(query);
    }

    /**
     * Public method to get current results
     */
    getResults() {
        return this.currentResults;
    }

    /**
     * Public method to get selected entity
     */
    getSelectedEntity() {
        return this.selectedEntity;
    }

    /**
     * Destroy component and clean up
     */
    destroy() {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Remove event listeners
        this.container.innerHTML = '';

        // Remove styles if no other instances exist
        if (document.querySelectorAll('.entity-search-component').length === 0) {
            const styles = document.getElementById('entity-search-styles');
            if (styles) {
                styles.remove();
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EntitySearch;
} else if (typeof window !== 'undefined') {
    window.EntitySearch = EntitySearch;
}
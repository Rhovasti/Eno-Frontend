/**
 * Relationship Viewer Component - Interactive relationship visualization
 * Follows existing UI component patterns with lazy loading for large relationship graphs
 */

class RelationshipViewer {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);

        if (!this.container) {
            throw new Error(`Container with ID '${containerId}' not found`);
        }

        // Configuration
        this.options = {
            maxDepth: 2,
            maxNodes: 100,
            lazyLoading: true,
            showStatistics: true,
            enableInteraction: true,
            ...options
        };

        // State
        this.currentEntity = null;
        this.relationshipData = null;
        this.isLoading = false;
        this.expandedNodes = new Set();
        this.nodePositions = {};

        // Initialize component
        this.init();
    }

    /**
     * Initialize the relationship viewer component
     */
    init() {
        this.render();
        this.bindEvents();
    }

    /**
     * Render the component HTML
     */
    render() {
        this.container.innerHTML = `
            <div class="relationship-viewer-component">
                <div class="viewer-header">
                    <h3>Relationship Explorer</h3>
                    <div class="viewer-controls">
                        <button id="refresh-relationships" class="refresh-btn" disabled>
                            Refresh
                        </button>
                        <button id="clear-relationships" class="clear-btn">
                            Clear
                        </button>
                    </div>
                </div>

                <div class="viewer-content" id="viewer-content">
                    <div class="no-entity-selected" id="no-entity-selected">
                        <div class="placeholder-message">
                            <p>Select an entity to explore its relationships</p>
                            <div class="placeholder-icon">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M2 12h20"/>
                                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10"/>
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div class="entity-info" id="entity-info" style="display: none;">
                        <div class="entity-header">
                            <h4 id="entity-name"></h4>
                            <span id="entity-type" class="entity-type-badge"></span>
                        </div>
                        <div class="entity-description" id="entity-description"></div>
                        <div class="entity-stats" id="entity-stats"></div>
                    </div>

                    <div class="relationship-controls" id="relationship-controls" style="display: none;">
                        <div class="depth-control">
                            <label for="depth-slider">Exploration Depth:</label>
                            <input type="range" id="depth-slider" min="1" max="4" value="${this.options.maxDepth}">
                            <span id="depth-value">${this.options.maxDepth}</span>
                        </div>
                        <div class="filter-controls">
                            <label for="relationship-filter">Filter by Type:</label>
                            <select id="relationship-filter" multiple>
                                <option value="">All Types</option>
                            </select>
                        </div>
                    </div>

                    <div class="relationship-loading" id="relationship-loading" style="display: none;">
                        <div class="spinner"></div>
                        <span>Loading relationships...</span>
                    </div>

                    <div class="relationship-graph" id="relationship-graph" style="display: none;">
                        <div class="graph-controls">
                            <button id="zoom-in" class="zoom-btn" title="Zoom In">+</button>
                            <button id="zoom-out" class="zoom-btn" title="Zoom Out">−</button>
                            <button id="reset-view" class="zoom-btn" title="Reset View">⟲</button>
                            <button id="toggle-layout" class="layout-btn" title="Toggle Layout">
                                ⊞
                            </button>
                        </div>
                        <div class="graph-container">
                            <svg id="relationship-svg" width="100%" height="400"></svg>
                        </div>
                    </div>

                    <div class="relationship-details" id="relationship-details" style="display: none;">
                        <div class="details-tabs">
                            <button class="tab-btn active" data-tab="direct">Direct Relationships</button>
                            <button class="tab-btn" data-tab="paths">Relationship Paths</button>
                            <button class="tab-btn" data-tab="statistics">Statistics</button>
                        </div>
                        <div class="tab-content">
                            <div class="tab-pane active" id="direct-tab">
                                <div class="direct-relationships" id="direct-relationships"></div>
                            </div>
                            <div class="tab-pane" id="paths-tab">
                                <div class="relationship-paths" id="relationship-paths"></div>
                            </div>
                            <div class="tab-pane" id="statistics-tab">
                                <div class="relationship-statistics" id="relationship-statistics"></div>
                            </div>
                        </div>
                    </div>

                    <div class="relationship-error" id="relationship-error" style="display: none;">
                        <div class="error-message">
                            <p>Failed to load relationship data. Please try again.</p>
                            <button id="retry-relationships" class="retry-btn">Retry</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add styles if not already present
        this.addStyles();
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        const refreshBtn = this.container.querySelector('#refresh-relationships');
        const clearBtn = this.container.querySelector('#clear-relationships');
        const depthSlider = this.container.querySelector('#depth-slider');
        const depthValue = this.container.querySelector('#depth-value');
        const relationshipFilter = this.container.querySelector('#relationship-filter');
        const retryBtn = this.container.querySelector('#retry-relationships');

        // Control buttons
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (this.currentEntity) {
                    this.loadEntityRelationships(this.currentEntity);
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearViewer();
            });
        }

        // Depth control
        if (depthSlider) {
            depthSlider.addEventListener('input', (e) => {
                const depth = parseInt(e.target.value);
                depthValue.textContent = depth;
                this.options.maxDepth = depth;

                if (this.currentEntity) {
                    this.loadEntityRelationships(this.currentEntity);
                }
            });
        }

        // Relationship filter
        if (relationshipFilter) {
            relationshipFilter.addEventListener('change', () => {
                this.filterRelationships();
            });
        }

        // Tab switching
        const tabBtns = this.container.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Graph controls
        this.bindGraphControls();

        // Retry button
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                if (this.currentEntity) {
                    this.loadEntityRelationships(this.currentEntity);
                }
            });
        }
    }

    /**
     * Bind graph control events
     */
    bindGraphControls() {
        const zoomInBtn = this.container.querySelector('#zoom-in');
        const zoomOutBtn = this.container.querySelector('#zoom-out');
        const resetViewBtn = this.container.querySelector('#reset-view');
        const toggleLayoutBtn = this.container.querySelector('#toggle-layout');

        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomGraph(1.2));
        }

        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomGraph(0.8));
        }

        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', () => this.resetGraphView());
        }

        if (toggleLayoutBtn) {
            toggleLayoutBtn.addEventListener('click', () => this.toggleLayout());
        }
    }

    /**
     * Load entity relationships
     */
    async loadEntityRelationships(entity) {
        this.currentEntity = entity;
        this.setLoading(true);
        this.hideError();

        try {
            // Get relationship exploration data
            const relationshipData = await window.entitySearchService.exploreRelationships(
                entity.name,
                entity.type,
                {
                    maxDepth: this.options.maxDepth,
                    includeBidirectional: true
                }
            );

            this.relationshipData = relationshipData;
            this.displayEntityInfo(entity);
            this.displayRelationshipData(relationshipData);
            this.populateRelationshipFilter(relationshipData);

        } catch (error) {
            console.error('Error loading relationships:', error);
            this.showError('Failed to load relationship data');
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Display entity information
     */
    displayEntityInfo(entity) {
        const noEntitySelected = this.container.querySelector('#no-entity-selected');
        const entityInfo = this.container.querySelector('#entity-info');
        const entityName = this.container.querySelector('#entity-name');
        const entityType = this.container.querySelector('#entity-type');
        const entityDescription = this.container.querySelector('#entity-description');

        noEntitySelected.style.display = 'none';
        entityInfo.style.display = 'block';

        entityName.textContent = entity.name;
        entityType.textContent = entity.type;
        entityDescription.textContent = entity.description || 'No description available';

        // Enable controls
        const refreshBtn = this.container.querySelector('#refresh-relationships');
        if (refreshBtn) {
            refreshBtn.disabled = false;
        }
    }

    /**
     * Display relationship data
     */
    displayRelationshipData(data) {
        const relationshipControls = this.container.querySelector('#relationship-controls');
        const relationshipGraph = this.container.querySelector('#relationship-graph');
        const relationshipDetails = this.container.querySelector('#relationship-details');

        relationshipControls.style.display = 'block';
        relationshipGraph.style.display = 'block';
        relationshipDetails.style.display = 'block';

        // Display direct relationships
        this.displayDirectRelationships(data.direct_relationships);

        // Display relationship paths
        this.displayRelationshipPaths(data.relationship_paths);

        // Load and display statistics
        this.loadAndDisplayStatistics();

        // Render relationship graph
        this.renderRelationshipGraph(data);

        // Update controls
        this.updateControls(data);
    }

    /**
     * Display relationships (alias for displayDirectRelationships)
     */
    displayRelationships(relationships) {
        this.displayDirectRelationships(relationships);
    }

    /**
     * Display direct relationships
     */
    displayDirectRelationships(relationships) {
        const container = this.container.querySelector('#direct-relationships');

        if (!relationships || relationships.length === 0) {
            container.innerHTML = '<p class="no-relationships">No direct relationships found</p>';
            return;
        }

        container.innerHTML = relationships.map(rel => `
            <div class="relationship-item" data-relationship-type="${rel.relationship_type}">
                <div class="relationship-header">
                    <span class="related-entity">${rel.related_entity_name}</span>
                    <span class="relationship-type">${rel.relationship_type}</span>
                    <span class="relationship-strength">${Math.round(rel.relationship_strength * 100)}%</span>
                </div>
                ${rel.properties && Object.keys(rel.properties).length > 0 ?
                    `<div class="relationship-properties">
                        ${Object.entries(rel.properties).map(([key, value]) =>
                            `<span class="property">${key}: ${value}</span>`
                        ).join('')}
                    </div>` : ''
                }
            </div>
        `).join('');
    }

    /**
     * Display relationship paths
     */
    displayRelationshipPaths(paths) {
        const container = this.container.querySelector('#relationship-paths');

        if (!paths || paths.length === 0) {
            container.innerHTML = '<p class="no-paths">No relationship paths found</p>';
            return;
        }

        container.innerHTML = paths.map(path => `
            <div class="path-item">
                <div class="path-header">
                    <span class="path-end">${path.end_entity}</span>
                    <span class="path-strength">${Math.round(path.total_strength * 100)}%</span>
                </div>
                <div class="path-steps">
                    ${path.path.map((rel, index) => `
                        <div class="path-step">
                            ${index > 0 ? `<span class="step-arrow">→</span>` : ''}
                            <span class="step-entity">${rel.related_entity_name}</span>
                            <span class="step-type">${rel.relationship_type}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    /**
     * Load and display relationship statistics
     */
    async loadAndDisplayStatistics() {
        if (!this.currentEntity || !this.options.showStatistics) {
            return;
        }

        try {
            const stats = await window.entitySearchService.getRelationshipStatistics(
                this.currentEntity.name,
                this.currentEntity.type
            );

            this.displayStatistics(stats);

        } catch (error) {
            console.error('Error loading statistics:', error);
        }
    }

    /**
     * Display statistics
     */
    displayStatistics(stats) {
        const container = this.container.querySelector('#relationship-statistics');

        if (!stats || stats.error) {
            container.innerHTML = '<p class="no-stats">Statistics not available</p>';
            return;
        }

        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Total Relationships</span>
                    <span class="stat-value">${stats.total_relationships}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Average Strength</span>
                    <span class="stat-value">${Math.round(stats.average_strength * 100)}%</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Total Strength</span>
                    <span class="stat-value">${Math.round(stats.total_relationship_strength * 100)}%</span>
                </div>
            </div>
            ${stats.relationship_types && Object.keys(stats.relationship_types).length > 0 ?
                `<div class="relationship-types">
                    <h5>Relationship Types:</h5>
                    ${Object.entries(stats.relationship_types).map(([type, count]) =>
                        `<div class="type-stat">
                            <span class="type-name">${type}:</span>
                            <span class="type-count">${count}</span>
                        </div>`
                    ).join('')}
                </div>` : ''
            }
        `;
    }

    /**
     * Render relationship graph (simplified implementation)
     */
    renderRelationshipGraph(data) {
        const svg = this.container.querySelector('#relationship-svg');

        if (!data.direct_relationships || data.direct_relationships.length === 0) {
            svg.innerHTML = '<text x="50%" y="50%" text-anchor="middle" fill="#999">No relationships to display</text>';
            return;
        }

        // Simplified graph rendering
        const width = svg.clientWidth || 800;
        const height = 400;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 120;

        // Clear existing content
        svg.innerHTML = '';

        // Create central node
        const centralNode = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        centralNode.setAttribute('cx', centerX);
        centralNode.setAttribute('cy', centerY);
        centralNode.setAttribute('r', 20);
        centralNode.setAttribute('fill', '#007bff');
        centralNode.setAttribute('class', 'central-node');

        const centralText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        centralText.setAttribute('x', centerX);
        centralText.setAttribute('y', centerY);
        centralText.setAttribute('text-anchor', 'middle');
        centralText.setAttribute('dominant-baseline', 'middle');
        centralText.setAttribute('fill', 'white');
        centralText.setAttribute('font-size', '12');
        centralText.setAttribute('font-weight', 'bold');
        centralText.textContent = this.currentEntity.name;

        svg.appendChild(centralNode);
        svg.appendChild(centralText);

        // Create relationship nodes and edges
        data.direct_relationships.forEach((rel, index) => {
            const angle = (2 * Math.PI * index) / data.direct_relationships.length;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);

            // Create edge
            const edge = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            edge.setAttribute('x1', centerX);
            edge.setAttribute('y1', centerY);
            edge.setAttribute('x2', x);
            edge.setAttribute('y2', y);
            edge.setAttribute('stroke', '#ddd');
            edge.setAttribute('stroke-width', '2');
            edge.setAttribute('class', 'relationship-edge');

            svg.appendChild(edge);

            // Create node
            const node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            node.setAttribute('cx', x);
            node.setAttribute('cy', y);
            node.setAttribute('r', 15);
            node.setAttribute('fill', this.getEntityTypeColor(rel.related_entity_name, rel.relationship_type));
            node.setAttribute('class', 'relationship-node');
            node.setAttribute('data-entity', rel.related_entity_name);

            // Create label
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', x);
            label.setAttribute('y', y + 25);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', '12');
            label.setAttribute('fill', '#666');
            label.textContent = rel.related_entity_name;

            svg.appendChild(edge);
            svg.appendChild(node);
            svg.appendChild(label);
        });
    }

    /**
     * Get color for entity type
     */
    getEntityTypeColor(entityName, relationshipType) {
        // Simple color mapping based on relationship type
        const colors = {
            'LOCATED_IN': '#28a745',
            'PARTICIPATES_IN': '#ffc107',
            'RELATED_TO': '#17a2b8',
            'MEMBER_OF': '#dc3545',
            'default': '#6c757d'
        };

        return colors[relationshipType] || colors.default;
    }

    /**
     * Populate relationship filter
     */
    populateRelationshipFilter(data) {
        const filter = this.container.querySelector('#relationship-filter');
        if (!filter) return;

        // Clear existing options (except "All Types")
        filter.innerHTML = '<option value="">All Types</option>';

        if (data.direct_relationships && data.direct_relationships.length > 0) {
            const relationshipTypes = new Set(
                data.direct_relationships.map(rel => rel.relationship_type)
            );

            relationshipTypes.forEach(type => {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type;
                filter.appendChild(option);
            });
        }
    }

    /**
     * Update controls based on data
     */
    updateControls(data) {
        const relationshipCount = data.total_relationships || 0;
        const exploredNodes = data.explored_nodes || 0;

        // You could update status indicators here
        console.log(`Loaded ${relationshipCount} relationships, explored ${exploredNodes} nodes`);
    }

    /**
     * Switch tab
     */
    switchTab(tabName) {
        const tabBtns = this.container.querySelectorAll('.tab-btn');
        const tabPanes = this.container.querySelectorAll('.tab-pane');

        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === `${tabName}-tab`);
        });
    }

    /**
     * Filter relationships
     */
    filterRelationships() {
        const filter = this.container.querySelector('#relationship-filter');
        const selectedTypes = Array.from(filter.selectedOptions).map(option => option.value);

        if (selectedTypes.includes('') || selectedTypes.length === 0) {
            // Show all relationships
            this.showAllRelationships();
        } else {
            // Filter by selected types
            this.hideRelationshipTypes(selectedTypes);
        }
    }

    /**
     * Show all relationships
     */
    showAllRelationships() {
        const relationshipItems = this.container.querySelectorAll('.relationship-item');
        relationshipItems.forEach(item => {
            item.style.display = 'block';
        });
    }

    /**
     * Hide specific relationship types
     */
    hideRelationshipTypes(visibleTypes) {
        const relationshipItems = this.container.querySelectorAll('.relationship-item');
        relationshipItems.forEach(item => {
            const itemType = item.dataset.relationshipType;
            item.style.display = visibleTypes.includes(itemType) ? 'block' : 'none';
        });
    }

    /**
     * Graph control methods
     */
    zoomGraph(factor) {
        const svg = this.container.querySelector('#relationship-svg');
        const currentTransform = svg.style.transform || 'scale(1)';
        const currentScale = parseFloat(currentTransform.match(/scale\(([\d.]+)\)/)?.[1] || 1);
        const newScale = Math.max(0.5, Math.min(3, currentScale * factor));

        svg.style.transform = `scale(${newScale})`;
    }

    resetGraphView() {
        const svg = this.container.querySelector('#relationship-svg');
        svg.style.transform = 'scale(1)';
        this.renderRelationshipGraph(this.relationshipData);
    }

    toggleLayout() {
        // This could toggle between different layout algorithms
        console.log('Toggle layout - would switch between circular, force-directed, hierarchical layouts');
        // For now, just re-render with current data
        this.renderRelationshipGraph(this.relationshipData);
    }

    /**
     * Set loading state
     */
    setLoading(isLoading) {
        this.isLoading = isLoading;
        const loadingContainer = this.container.querySelector('#relationship-loading');
        const refreshBtn = this.container.querySelector('#refresh-relationships');

        if (isLoading) {
            loadingContainer.style.display = 'flex';
            if (refreshBtn) refreshBtn.disabled = true;
        } else {
            loadingContainer.style.display = 'none';
            if (refreshBtn && this.currentEntity) refreshBtn.disabled = false;
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        const errorContainer = this.container.querySelector('#relationship-error');
        const errorMessage = errorContainer.querySelector('.error-message p');

        if (errorMessage) {
            errorMessage.textContent = message;
        }

        errorContainer.style.display = 'block';

        // Hide other views
        this.hideRelationshipViews();
    }

    /**
     * Hide error message
     */
    hideError() {
        const errorContainer = this.container.querySelector('#relationship-error');
        errorContainer.style.display = 'none';
    }

    /**
     * Hide relationship views
     */
    hideRelationshipViews() {
        const relationshipGraph = this.container.querySelector('#relationship-graph');
        const relationshipDetails = this.container.querySelector('#relationship-details');
        const relationshipControls = this.container.querySelector('#relationship-controls');

        relationshipGraph.style.display = 'none';
        relationshipDetails.style.display = 'none';
        relationshipControls.style.display = 'none';
    }

    /**
     * Clear viewer
     */
    clearViewer() {
        this.currentEntity = null;
        this.relationshipData = null;
        this.expandedNodes.clear();
        this.nodePositions = {};

        const noEntitySelected = this.container.querySelector('#no-entity-selected');
        const entityInfo = this.container.querySelector('#entity-info');
        const relationshipGraph = this.container.querySelector('#relationship-graph');
        const relationshipDetails = this.container.querySelector('#relationship-details');
        const relationshipControls = this.container.querySelector('#relationship-controls');

        noEntitySelected.style.display = 'block';
        entityInfo.style.display = 'none';
        relationshipGraph.style.display = 'none';
        relationshipDetails.style.display = 'none';
        relationshipControls.style.display = 'none';

        // Disable refresh button
        const refreshBtn = this.container.querySelector('#refresh-relationships');
        if (refreshBtn) {
            refreshBtn.disabled = true;
        }
    }

    /**
     * Add component styles
     */
    addStyles() {
        if (document.getElementById('relationship-viewer-styles')) {
            return; // Styles already added
        }

        const styles = document.createElement('style');
        styles.id = 'relationship-viewer-styles';
        styles.textContent = `
            .relationship-viewer-component {
                max-width: 1000px;
                margin: 0 auto;
                padding: 20px;
                font-family: Arial, sans-serif;
            }

            .viewer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 2px solid #eee;
            }

            .viewer-controls {
                display: flex;
                gap: 10px;
            }

            .refresh-btn, .clear-btn {
                padding: 8px 16px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: white;
                cursor: pointer;
                font-size: 14px;
            }

            .refresh-btn:hover:not(:disabled), .clear-btn:hover {
                background: #f8f9fa;
            }

            .refresh-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .no-entity-selected {
                text-align: center;
                padding: 60px 20px;
                color: #666;
            }

            .placeholder-icon {
                margin: 20px auto;
                color: #ddd;
            }

            .entity-info {
                margin-bottom: 20px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 8px;
            }

            .entity-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }

            .entity-header h4 {
                margin: 0;
                color: #333;
            }

            .entity-type-badge {
                background: #007bff;
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
            }

            .entity-description {
                color: #666;
                margin-bottom: 10px;
            }

            .relationship-controls {
                display: flex;
                gap: 20px;
                align-items: center;
                margin-bottom: 20px;
                padding: 15px;
                background: #fff;
                border: 1px solid #ddd;
                border-radius: 8px;
            }

            .depth-control, .filter-controls {
                display: flex;
                align-items: center;
                gap: 10px;
            }

            .depth-control input[type="range"] {
                width: 100px;
            }

            .filter-controls select {
                min-width: 150px;
            }

            .relationship-loading {
                display: flex;
                align-items: center;
                gap: 10px;
                justify-content: center;
                padding: 40px;
                color: #666;
            }

            .relationship-graph {
                border: 1px solid #ddd;
                border-radius: 8px;
                margin-bottom: 20px;
                background: white;
            }

            .graph-controls {
                padding: 10px;
                border-bottom: 1px solid #eee;
                display: flex;
                gap: 5px;
            }

            .zoom-btn, .layout-btn {
                width: 32px;
                height: 32px;
                border: 1px solid #ddd;
                background: white;
                cursor: pointer;
                border-radius: 4px;
                font-size: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .zoom-btn:hover, .layout-btn:hover {
                background: #f8f9fa;
            }

            .graph-container {
                padding: 20px;
                text-align: center;
            }

            .relationship-details {
                border: 1px solid #ddd;
                border-radius: 8px;
                background: white;
            }

            .details-tabs {
                display: flex;
                border-bottom: 1px solid #eee;
            }

            .tab-btn {
                padding: 12px 20px;
                border: none;
                background: none;
                cursor: pointer;
                border-bottom: 2px solid transparent;
                font-size: 14px;
            }

            .tab-btn.active {
                border-bottom-color: #007bff;
                color: #007bff;
                font-weight: bold;
            }

            .tab-btn:hover {
                background: #f8f9fa;
            }

            .tab-content {
                padding: 20px;
            }

            .tab-pane {
                display: none;
            }

            .tab-pane.active {
                display: block;
            }

            .relationship-item {
                border: 1px solid #eee;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 10px;
                transition: box-shadow 0.2s ease;
            }

            .relationship-item:hover {
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }

            .relationship-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .related-entity {
                font-weight: bold;
                color: #333;
            }

            .relationship-type {
                background: #e9ecef;
                color: #495057;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 12px;
            }

            .relationship-strength {
                background: #d4edda;
                color: #155724;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 12px;
                font-weight: bold;
            }

            .relationship-properties {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
                margin-top: 8px;
            }

            .property {
                background: #f8f9fa;
                color: #666;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 11px;
            }

            .path-item {
                border: 1px solid #eee;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 10px;
            }

            .path-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                font-weight: bold;
            }

            .path-strength {
                background: #fff3cd;
                color: #856404;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 12px;
            }

            .path-steps {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }

            .path-step {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .step-arrow {
                color: #999;
                font-weight: bold;
            }

            .step-entity {
                font-weight: bold;
                color: #333;
            }

            .step-type {
                background: #e9ecef;
                color: #495057;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 12px;
            }

            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }

            .stat-item {
                text-align: center;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 8px;
            }

            .stat-label {
                display: block;
                font-size: 14px;
                color: #666;
                margin-bottom: 5px;
            }

            .stat-value {
                display: block;
                font-size: 24px;
                font-weight: bold;
                color: #333;
            }

            .relationship-types {
                margin-top: 20px;
            }

            .relationship-types h5 {
                margin-bottom: 10px;
                color: #333;
            }

            .type-stat {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                border-bottom: 1px solid #eee;
            }

            .type-name {
                color: #666;
            }

            .type-count {
                font-weight: bold;
                color: #333;
            }

            .no-relationships, .no-paths, .no-stats {
                text-align: center;
                color: #999;
                font-style: italic;
                padding: 20px;
            }

            .relationship-error {
                text-align: center;
                padding: 40px 20px;
                color: #dc3545;
            }

            .error-message {
                background: #f8d7da;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #f5c6cb;
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

            .central-node {
                filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
            }

            .relationship-edge {
                transition: stroke 0.2s ease;
            }

            .relationship-edge:hover {
                stroke: #007bff;
            }

            .relationship-node {
                cursor: pointer;
                transition: r 0.2s ease;
            }

            .relationship-node:hover {
                r: 18;
            }
        `;

        document.head.appendChild(styles);
    }

    /**
     * Public method to load entity programmatically
     */
    loadEntity(entity) {
        this.loadEntityRelationships(entity);
    }

    /**
     * Public method to get current entity
     */
    getCurrentEntity() {
        return this.currentEntity;
    }

    /**
     * Public method to get relationship data
     */
    getRelationshipData() {
        return this.relationshipData;
    }

    /**
     * Destroy component and clean up
     */
    destroy() {
        this.clearViewer();

        // Remove event listeners
        this.container.innerHTML = '';

        // Remove styles if no other instances exist
        if (document.querySelectorAll('.relationship-viewer-component').length === 0) {
            const styles = document.getElementById('relationship-viewer-styles');
            if (styles) {
                styles.remove();
            }
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RelationshipViewer;
} else if (typeof window !== 'undefined') {
    window.RelationshipViewer = RelationshipViewer;
}
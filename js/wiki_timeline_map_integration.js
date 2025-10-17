/**
 * Wiki Timeline & Map Integration
 * Connects wiki entries with TemporalTimeline and CitystateMapViewer
 * Provides bidirectional synchronization between all three views
 */

class WikiTimelineMapIntegration {
    constructor() {
        this.timeline = null;
        this.map = null;
        this.currentEntry = null;
        this.wikiSystem = null; // Reference to main wiki system
        this.init();
    }

    async init() {
        console.log('Initializing Wiki Timeline & Map Integration...');

        // Setup panel toggle functionality
        this.setupPanelToggles();

        // Wait for wiki system to be ready
        this.waitForWikiSystem();

        // Initialize components when data is available
        document.addEventListener('wikiEntriesLoaded', () => {
            this.initializeComponents();
        });
    }

    waitForWikiSystem() {
        // Poll for wiki system availability
        const checkInterval = setInterval(() => {
            if (window.wikiSystem) {
                this.wikiSystem = window.wikiSystem;
                clearInterval(checkInterval);
                console.log('Wiki system detected');

                // If entries are already loaded, initialize immediately
                if (this.wikiSystem.entries && this.wikiSystem.entries.length > 0) {
                    console.log('Entries already loaded, initializing components immediately');
                    this.initializeComponents();
                }
            }
        }, 100);

        // Timeout after 5 seconds
        setTimeout(() => clearInterval(checkInterval), 5000);
    }

    setupPanelToggles() {
        // Timeline toggle (in main panel)
        const timelineToggle = document.getElementById('toggleTimelineMain');
        const timelineHeader = document.querySelector('#timelinePanelMain .panel-header');
        const timelineContent = document.getElementById('timelineContentMain');

        if (timelineToggle && timelineContent) {
            const toggleTimeline = () => {
                timelineContent.classList.toggle('collapsed');
                timelineToggle.classList.toggle('collapsed');
            };

            timelineToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleTimeline();
            });

            if (timelineHeader) {
                timelineHeader.addEventListener('click', toggleTimeline);
            }
        }

        // Map toggle
        const mapToggle = document.getElementById('toggleMap');
        const mapHeader = document.querySelector('#mapPanel .panel-header');
        const mapContent = document.getElementById('mapContent');

        if (mapToggle && mapContent) {
            const toggleMap = () => {
                mapContent.classList.toggle('collapsed');
                mapToggle.classList.toggle('collapsed');
            };

            mapToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleMap();
            });

            mapHeader.addEventListener('click', toggleMap);
        }

        // Images toggle
        const imagesToggle = document.getElementById('toggleImages');
        const imagesHeader = document.querySelector('#contextImagePanel .panel-header');
        const imagesContent = document.getElementById('imageContent');

        if (imagesToggle && imagesContent) {
            // Start collapsed
            imagesContent.classList.add('collapsed');
            imagesToggle.classList.add('collapsed');

            const toggleImages = () => {
                imagesContent.classList.toggle('collapsed');
                imagesToggle.classList.toggle('collapsed');
            };

            imagesToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleImages();
            });

            imagesHeader.addEventListener('click', toggleImages);
        }
    }

    async initializeComponents() {
        if (!this.wikiSystem || !this.wikiSystem.entries) {
            console.warn('Wiki system or entries not available');
            return;
        }

        // Check if there are entries with temporal or geographic data
        const entriesWithTemporal = this.wikiSystem.entries.filter(e =>
            e.temporal_start_cycle !== null
        );

        const entriesWithLocation = this.wikiSystem.entries.filter(e =>
            e.latitude !== null && e.longitude !== null
        );

        console.log(`Found ${entriesWithTemporal.length} entries with temporal data`);
        console.log(`Found ${entriesWithLocation.length} entries with location data`);

        // Initialize timeline if there's temporal data
        if (entriesWithTemporal.length > 0) {
            this.initializeTimeline(entriesWithTemporal);
        }

        // Initialize map if there's location data
        if (entriesWithLocation.length > 0) {
            this.initializeMap(entriesWithLocation);
        }
    }

    initializeTimeline(entriesWithTemporal) {
        const timelineContainer = document.getElementById('wikiTimeline');

        if (!timelineContainer) {
            console.warn('Timeline container not found');
            return;
        }

        // Clear placeholder
        timelineContainer.innerHTML = '';

        try {
            // Find earliest and latest cycles for initial view
            const cycles = entriesWithTemporal.map(e => e.temporal_start_cycle);
            const minCycle = Math.min(...cycles);
            const maxCycle = Math.max(...cycles);
            const centerCycle = Math.floor((minCycle + maxCycle) / 2);

            this.timeline = new TemporalTimeline('wikiTimeline', {
                width: timelineContainer.clientWidth || 800,
                height: 250,
                initialCycle: centerCycle,
                initialZoomLevel: 3, // Decade view
                onEventClick: (event) => this.handleTimelineEventClick(event),
                onTimeChange: (cycle) => this.handleTimelineChange(cycle)
            });

            console.log('Timeline initialized successfully');
        } catch (error) {
            console.error('Error initializing timeline:', error);
            timelineContainer.innerHTML = `
                <div class="timeline-placeholder">
                    <p style="color: #e74c3c;">Timeline initialization failed</p>
                    <p style="font-size: 0.9em;">Check that temporal API endpoints are configured</p>
                </div>
            `;
        }
    }

    initializeMap(entriesWithLocation) {
        const mapContainer = document.getElementById('wikiMap');

        if (!mapContainer) {
            console.warn('Map container not found');
            return;
        }

        // Check if map is already initialized by production wiki script
        if (mapContainer._leaflet_id) {
            console.log('WikiTimelineMapIntegration: Map already initialized, using existing map');

            // Use existing map instance
            const existingMap = window.wikiMap || window.productionWikiMap?.map;
            if (existingMap) {
                this.map = existingMap;

                // Add markers for entries with location
                const bounds = [];
                entriesWithLocation.forEach(entry => {
                    const marker = L.marker([entry.latitude, entry.longitude], {
                        title: entry.title
                    });

                    marker.bindPopup(`
                        <div style="min-width: 150px;">
                            <h4 style="margin: 0 0 8px 0;">${entry.title}</h4>
                            <p style="margin: 0 0 8px 0; font-size: 0.9em;">${entry.excerpt || entry.category}</p>
                            <button onclick="window.wikiTimelineMapIntegration.selectEntryFromMap(${entry.id})"
                                    style="background: var(--color-primary); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                                View Entry
                            </button>
                        </div>
                    `);

                    marker.addTo(this.map);
                    bounds.push([entry.latitude, entry.longitude]);
                });

                // Fit map to show all markers if there are any
                if (bounds.length > 0) {
                    this.map.fitBounds(bounds, { padding: [20, 20] });
                }

                // Make this instance globally accessible for popup callbacks
                window.wikiTimelineMapIntegration = this;

                console.log('WikiTimelineMapIntegration: Added location markers to existing map');
                return;
            }
        }

        // Clear placeholder only if map hasn't been initialized
        if (!mapContainer.hasChildNodes() || (mapContainer.children.length === 1 && mapContainer.children[0].className === 'map-placeholder')) {
            mapContainer.innerHTML = '';
        }

        try {
            // Initialize with Leaflet - match UnifiedMapViewer configuration
            this.map = L.map('wikiMap', {
                center: [5, 23],
                zoom: 3,
                minZoom: 0,
                maxZoom: 18,
                zoomControl: true,
                attributionControl: false
            });

            // Add base tiles
            L.tileLayer('https://rhovasti.github.io/eno-tiles/{z}/{x}/{y}.png', {
                attribution: 'Eno World Map',
                minZoom: 0,
                maxZoom: 8,
                opacity: 0.8,
                tms: true
            }).addTo(this.map);

            // Initialize vector layers
            this.vectorLayers = {
                elevation: null,
                roads: null,
                water: null
            };

            // Add layer controls
            this.addVectorLayerControls();

            // Add markers for entries with location
            const bounds = [];
            entriesWithLocation.forEach(entry => {
                const marker = L.marker([entry.latitude, entry.longitude], {
                    title: entry.title
                });

                marker.bindPopup(`
                    <div style="min-width: 150px;">
                        <h4 style="margin: 0 0 8px 0;">${entry.title}</h4>
                        <p style="margin: 0 0 8px 0; font-size: 0.9em;">${entry.excerpt || entry.category}</p>
                        <button onclick="window.wikiTimelineMapIntegration.selectEntryFromMap(${entry.id})"
                                style="background: var(--color-primary); color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;">
                            View Entry
                        </button>
                    </div>
                `);

                marker.addTo(this.map);
                bounds.push([entry.latitude, entry.longitude]);
            });

            // Fit map to show all markers
            if (bounds.length > 0) {
                this.map.fitBounds(bounds, { padding: [20, 20] });
            }

            // Setup zoom-based layer visibility
            this.map.on('zoomend', () => this.updateVectorLayerVisibility());

            // Make this instance globally accessible for popup callbacks
            window.wikiTimelineMapIntegration = this;

            console.log('Map initialized successfully');
        } catch (error) {
            console.error('Error initializing map:', error);
            mapContainer.innerHTML = `
                <div class="map-placeholder">
                    <p style="color: #e74c3c;">Map initialization failed</p>
                    <p style="font-size: 0.9em;">${error.message}</p>
                </div>
            `;
        }
    }

    // Add vector layer controls to the map
    addVectorLayerControls() {
        // Create layer control panel
        const layerControl = L.control({ position: 'topright' });

        layerControl.onAdd = (map) => {
            const div = L.DomUtil.create('div', 'vector-layer-control');
            div.innerHTML = `
                <h4>Map Layers</h4>
                <div class="layer-control-group">
                    <label>
                        <input type="checkbox" id="elevationLayerToggle" checked>
                        <span class="layer-icon">⛰️</span> Elevation Contours
                    </label>
                    <div class="layer-info" id="elevationInfo">Loading...</div>
                </div>
                <div class="layer-control-group">
                    <label>
                        <input type="checkbox" id="roadsLayerToggle" checked>
                        <span class="layer-icon">🛣️</span> Road Network
                    </label>
                    <div class="layer-info" id="roadsInfo">Loading...</div>
                </div>
                <div class="layer-control-group">
                    <label>
                        <input type="checkbox" id="waterLayerToggle" checked>
                        <span class="layer-icon">💧</span> Water Features
                    </label>
                    <div class="layer-info" id="waterInfo">Loading...</div>
                </div>
            `;

            // Add styles
            div.style.cssText = `
                background: white;
                padding: 12px;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                font-family: 'Segoe UI', Tahoma, sans-serif;
                font-size: 13px;
                min-width: 180px;
            `;

            // Style the layer groups
            const styleElement = document.createElement('style');
            styleElement.textContent = `
                .vector-layer-control h4 {
                    margin: 0 0 10px 0;
                    font-size: 14px;
                    font-weight: 600;
                    color: #333;
                    border-bottom: 1px solid #eee;
                    padding-bottom: 6px;
                }
                .layer-control-group {
                    margin-bottom: 10px;
                }
                .layer-control-group label {
                    display: flex;
                    align-items: center;
                    margin-bottom: 4px;
                    cursor: pointer;
                }
                .layer-control-group input[type="checkbox"] {
                    margin-right: 8px;
                }
                .layer-icon {
                    margin-right: 6px;
                    font-size: 14px;
                }
                .layer-info {
                    font-size: 11px;
                    color: #666;
                    margin-left: 22px;
                    font-style: italic;
                }
                .layer-control-group label:hover {
                    background: rgba(102, 126, 234, 0.1);
                    padding: 2px 4px;
                    border-radius: 4px;
                    margin: -2px -4px;
                }
            `;
            document.head.appendChild(styleElement);

            // Setup event listeners
            const elevationToggle = div.querySelector('#elevationLayerToggle');
            const roadsToggle = div.querySelector('#roadsLayerToggle');
            const waterToggle = div.querySelector('#waterLayerToggle');

            elevationToggle.addEventListener('change', (e) => {
                this.toggleVectorLayer('elevation', e.target.checked);
            });

            roadsToggle.addEventListener('change', (e) => {
                this.toggleVectorLayer('roads', e.target.checked);
            });

            waterToggle.addEventListener('change', (e) => {
                this.toggleVectorLayer('water', e.target.checked);
            });

            // Load vector layers
            this.loadVectorLayers();

            return div;
        };

        layerControl.addTo(this.map);
    }

    // Load vector layers from API endpoints
    async loadVectorLayers() {
        try {
            // Load elevation contours
            await this.loadElevationLayer();

            // Load roads network
            await this.loadRoadsLayer();

            // Load water features
            await this.loadWaterLayer();

            // Update layer info displays
            this.updateLayerInfo();

        } catch (error) {
            console.error('Error loading vector layers:', error);
            this.updateLayerInfoError(error);
        }
    }

    // Load elevation contours layer
    async loadElevationLayer() {
        try {
            const response = await fetch('/api/maps/elevation/contours');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const apiResponse = await response.json();
            const geoData = apiResponse.data || apiResponse; // Extract actual GeoJSON data

            this.vectorLayers.elevation = L.geoJSON(geoData, {
                style: (feature) => {
                    const elevation = feature.properties.ELEV || 0;
                    const intensity = Math.min(elevation / 200, 1); // Normalize to 0-1
                    const color = `hsl(30, 70%, ${50 + intensity * 30}%)`; // Brown gradient
                    const weight = 0.5 + intensity * 1.5; // Thicker lines for higher elevation

                    return {
                        color: color,
                        weight: weight,
                        opacity: 0.7 + intensity * 0.3,
                        fillOpacity: 0
                    };
                },
                onEachFeature: (feature, layer) => {
                    if (feature.properties && feature.properties.ELEV) {
                        layer.bindPopup(`Elevation: ${feature.properties.ELEV}m`);
                    }
                }
            });

            // Add to map by default
            this.vectorLayers.elevation.addTo(this.map);

        } catch (error) {
            console.error('Error loading elevation layer:', error);
            throw error;
        }
    }

    // Load roads network layer
    async loadRoadsLayer() {
        try {
            const response = await fetch('/api/maps/roads/network');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const apiResponse = await response.json();
            const geoData = apiResponse.data || apiResponse; // Extract actual GeoJSON data

            this.vectorLayers.roads = L.geoJSON(geoData, {
                style: {
                    color: '#444444',
                    weight: 1.5,
                    opacity: 0.8
                },
                onEachFeature: (feature, layer) => {
                    if (feature.properties && feature.properties.NAME) {
                        layer.bindPopup(`Road: ${feature.properties.NAME}`);
                    } else {
                        layer.bindPopup('Road');
                    }
                }
            });

            // Add to map by default
            this.vectorLayers.roads.addTo(this.map);

        } catch (error) {
            console.error('Error loading roads layer:', error);
            throw error;
        }
    }

    // Load water features layer
    async loadWaterLayer() {
        try {
            const response = await fetch('/api/maps/water/features');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const apiResponse = await response.json();
            const geoData = apiResponse.data || apiResponse; // Extract actual GeoJSON data

            this.vectorLayers.water = L.geoJSON(geoData, {
                style: {
                    color: '#4a90e2',
                    weight: 2,
                    fillColor: '#6bb6ff',
                    fillOpacity: 0.6
                },
                onEachFeature: (feature, layer) => {
                    if (feature.properties && feature.properties.type) {
                        layer.bindPopup(`Water: ${feature.properties.type}`);
                    } else {
                        layer.bindPopup('Water feature');
                    }
                }
            });

            // Add to map by default
            this.vectorLayers.water.addTo(this.map);

        } catch (error) {
            console.error('Error loading water layer:', error);
            throw error;
        }
    }

    // Toggle vector layer visibility
    toggleVectorLayer(layerType, isVisible) {
        if (!this.vectorLayers[layerType]) return;

        if (isVisible) {
            this.vectorLayers[layerType].addTo(this.map);
        } else {
            this.map.removeLayer(this.vectorLayers[layerType]);
        }

        // Update visibility based on zoom level
        this.updateVectorLayerVisibility();
    }

    // Update vector layer visibility based on zoom level
    updateVectorLayerVisibility() {
        const currentZoom = this.map.getZoom();

        // Define zoom thresholds for each layer type
        const zoomThresholds = {
            elevation: 7,  // Show contours at zoom 7+
            roads: 8,      // Show roads at zoom 8+
            water: 6       // Show water at zoom 6+
        };

        Object.keys(zoomThresholds).forEach(layerType => {
            const layer = this.vectorLayers[layerType];
            const threshold = zoomThresholds[layerType];

            if (!layer) return;

            // Check if layer checkbox is checked
            const checkbox = document.getElementById(`${layerType}LayerToggle`);
            if (!checkbox || !checkbox.checked) return;

            // Show/hide based on zoom level
            if (currentZoom >= threshold) {
                if (!this.map.hasLayer(layer)) {
                    layer.addTo(this.map);
                }
            } else {
                if (this.map.hasLayer(layer)) {
                    this.map.removeLayer(layer);
                }
            }
        });
    }

    // Update layer information displays
    updateLayerInfo() {
        const updateInfo = (layerId, count, description) => {
            const infoElement = document.getElementById(layerId);
            if (infoElement) {
                infoElement.textContent = `${count} features - ${description}`;
                infoElement.style.fontStyle = 'normal';
                infoElement.style.color = '#4a90e2';
            }
        };

        if (this.vectorLayers.elevation) {
            const count = Object.keys(this.vectorLayers.elevation._layers).length;
            updateInfo('elevationInfo', count, 'visible at zoom 7+');
        }

        if (this.vectorLayers.roads) {
            const count = Object.keys(this.vectorLayers.roads._layers).length;
            updateInfo('roadsInfo', count, 'visible at zoom 8+');
        }

        if (this.vectorLayers.water) {
            const count = Object.keys(this.vectorLayers.water._layers).length;
            updateInfo('waterInfo', count, 'visible at zoom 6+');
        }
    }

    // Update layer info with error state
    updateLayerInfoError(error) {
        ['elevationInfo', 'roadsInfo', 'waterInfo'].forEach(id => {
            const infoElement = document.getElementById(id);
            if (infoElement) {
                infoElement.textContent = 'Failed to load';
                infoElement.style.color = '#e74c3c';
                infoElement.style.fontStyle = 'italic';
            }
        });
    }

    handleTimelineEventClick(event) {
        console.log('Timeline event clicked:', event);

        // Find related wiki entry
        if (event.related_wiki_entry_id) {
            this.selectEntry(event.related_wiki_entry_id);
        } else if (event.title) {
            // Search for entry by title
            this.searchEntryByTitle(event.title);
        }
    }

    handleTimelineChange(cycle) {
        console.log('Timeline centered on cycle:', cycle);
        // Could filter wiki entries by temporal range here
    }

    selectEntryFromMap(entryId) {
        this.selectEntry(entryId);

        // Close any open popups
        if (this.map) {
            this.map.closePopup();
        }
    }

    selectEntry(entryId) {
        if (!this.wikiSystem) return;

        const entry = this.wikiSystem.entries.find(e => e.id == entryId);
        if (!entry) {
            console.warn(`Entry ${entryId} not found`);
            return;
        }

        this.currentEntry = entry;

        // Trigger wiki system to display this entry
        if (this.wikiSystem.displayTopicDetail) {
            this.wikiSystem.displayTopicDetail(entry);
        }

        // Scroll to entry in sidebar if visible
        const topicItem = document.querySelector(`[data-entry-id="${entryId}"]`);
        if (topicItem) {
            topicItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.highlightElement(topicItem);
        }

        // Update timeline position if entry has temporal data
        if (entry.temporal_start_cycle !== null) {
            if (entry.category === 'Locations') {
                this.showLocationDate(entry);
            } else if (entry.category === 'Events' && this.timeline) {
                const cycle = entry.temporal_start_cycle + (entry.temporal_start_day || 0) / 360;
                this.timeline.jumpToCycle(cycle);
            }
        }

        // Update map position if entry has location data
        if (this.map && entry.latitude !== null && entry.longitude !== null) {
            this.map.setView([entry.latitude, entry.longitude], 10);

            // Highlight the marker (if we can find it)
            this.highlightMapMarker(entry.latitude, entry.longitude);
        }
    }

    searchEntryByTitle(title) {
        if (!this.wikiSystem) return;

        const entry = this.wikiSystem.entries.find(e =>
            e.title.toLowerCase().includes(title.toLowerCase())
        );

        if (entry) {
            this.selectEntry(entry.id);
        } else {
            // Trigger search in wiki system
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.value = title;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }

    // Update timeline and map when entry is selected from wiki sidebar
    updateForEntry(entry) {
        if (!entry) return;

        this.currentEntry = entry;

        // Update timeline based on entry type
        if (entry.temporal_start_cycle !== null) {
            const timelineContent = document.getElementById('timelineContentMain');

            if (entry.category === 'Locations') {
                // For locations (cities), show simple date indicator
                this.showLocationDate(entry);
            } else if (entry.category === 'Events') {
                // For events, show full interactive timeline
                if (this.timeline) {
                    const cycle = entry.temporal_start_cycle + (entry.temporal_start_day || 0) / 360;
                    this.timeline.jumpToCycle(cycle);
                }
            }

            // Expand timeline panel if collapsed
            if (timelineContent && timelineContent.classList.contains('collapsed')) {
                const toggleBtn = document.getElementById('toggleTimelineMain');
                if (toggleBtn) toggleBtn.click();
            }
        }

        // Update map
        if (this.map && entry.latitude !== null && entry.longitude !== null) {
            this.map.setView([entry.latitude, entry.longitude], 10);
            this.highlightMapMarker(entry.latitude, entry.longitude);

            // Expand map panel if collapsed
            const mapContent = document.getElementById('mapContent');
            if (mapContent && mapContent.classList.contains('collapsed')) {
                document.getElementById('toggleMap').click();
            }
        }
    }

    highlightElement(element) {
        element.classList.add('entry-highlighted');
        setTimeout(() => {
            element.classList.remove('entry-highlighted');
        }, 2000);
    }

    highlightMapMarker(lat, lng) {
        // Create a temporary highlight circle
        if (this.highlightCircle) {
            this.map.removeLayer(this.highlightCircle);
        }

        this.highlightCircle = L.circle([lat, lng], {
            color: '#e67e22',
            fillColor: '#e67e22',
            fillOpacity: 0.3,
            radius: 5000 // 5km radius
        }).addTo(this.map);

        // Remove after animation
        setTimeout(() => {
            if (this.highlightCircle) {
                this.map.removeLayer(this.highlightCircle);
                this.highlightCircle = null;
            }
        }, 2000);
    }

    showLocationDate(entry) {
        // Show simple date indicator for locations instead of full timeline
        const timelineContainer = document.getElementById('wikiTimeline');
        if (!timelineContainer) return;

        // Format the date using TimeConverter if available
        let dateText = `Cycle ${entry.temporal_start_cycle}`;
        if (entry.temporal_start_day) {
            dateText += `, Day ${entry.temporal_start_day}`;
        }

        // Try to format with TimeConverter if available
        if (window.TimeConverter && window.TimeConverter.formatCycleDay) {
            try {
                const formatted = window.TimeConverter.formatCycleDay(
                    entry.temporal_start_cycle,
                    entry.temporal_start_day || 1
                );
                dateText = formatted;
            } catch (e) {
                // Fallback to simple format
                console.log('TimeConverter not available, using simple format');
            }
        }

        // Display simple date card
        timelineContainer.innerHTML = `
            <div style="padding: 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; color: white;">
                <div style="font-size: 0.9em; opacity: 0.9; margin-bottom: 8px;">Founded</div>
                <div style="font-size: 1.4em; font-weight: bold;">${dateText}</div>
                ${entry.title ? `<div style="font-size: 0.95em; margin-top: 8px; opacity: 0.95;">${entry.title}</div>` : ''}
            </div>
        `;
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.wikiTimelineMapIntegration = new WikiTimelineMapIntegration();
    });
} else {
    window.wikiTimelineMapIntegration = new WikiTimelineMapIntegration();
}

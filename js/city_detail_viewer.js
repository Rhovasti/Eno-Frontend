/**
 * CityDetailViewer - Modal system for detailed city maps
 * Provides separate Leaflet map instances for city-level detail views
 * without overloading the global map performance
 */

class CityDetailViewer {
    constructor() {
        this.isOpen = false;
        this.currentCity = null;
        this.localMap = null;
        this.layers = {};
        this.modal = null;
        this.dataCache = new Map(); // 5-minute cache for city data
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Open city detail modal with comprehensive local map
     * @param {string} cityName - Name of the city to display
     * @param {Object} cityData - Basic city information from global map
     * @param {Array} coordinates - [lat, lng] coordinates for the city
     */
    async open(cityName, cityData = {}, coordinates = [0, 0]) {
        if (this.isOpen) {
            this.close(); // Close existing modal first
        }

        console.log(`Opening city detail view for: ${cityName}`);

        this.currentCity = cityName;
        this.isOpen = true;

        try {
            // Create modal structure
            this.createModal(cityName, cityData);

            // Show modal first so map container is visible
            this.modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling

            // Small delay to ensure DOM is ready
            await new Promise(resolve => setTimeout(resolve, 100));

            // Initialize local map
            await this.initializeLocalMap(coordinates);

            // Load city-specific layers
            await this.loadCityLayers(cityName);

        } catch (error) {
            console.error('Error opening city detail view:', error);
            this.showError('Failed to load city details. Please try again.');
        }
    }

    /**
     * Create modal DOM structure
     */
    createModal(cityName, cityData) {
        // Remove existing modal if any
        const existingModal = document.getElementById('cityDetailModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal structure
        const modalHTML = `
            <div id="cityDetailModal" class="city-detail-modal">
                <div class="city-detail-content">
                    <div class="city-detail-header">
                        <div class="city-info">
                            <h2>${cityName}</h2>
                            <div class="city-stats">
                                <span class="stat">Pop: ${cityData.population || 'Unknown'}</span>
                                <span class="stat">Type: ${cityData.type || 'Settlement'}</span>
                            </div>
                        </div>
                        <div class="city-controls">
                            <div class="layer-toggles">
                                <label><input type="checkbox" id="detailBuildings" checked> Buildings</label>
                                <label><input type="checkbox" id="detailRoads" checked> Roads</label>
                                <label><input type="checkbox" id="detailDistricts"> Districts</label>
                                <label><input type="checkbox" id="detailFields"> Fields</label>
                                <label><input type="checkbox" id="detailTrees"> Trees</label>
                                <label><input type="checkbox" id="detailCastles"> Castles</label>
                            </div>
                            <button id="generateRoads" class="action-btn">Generate Roads</button>
                            <button id="closeCityModal" class="close-btn">&times;</button>
                        </div>
                    </div>
                    <div class="city-detail-map" id="cityDetailMap">
                        <div class="loading-indicator" id="cityMapLoading">
                            <div class="spinner"></div>
                            <p>Loading city details...</p>
                        </div>
                    </div>
                    <div class="city-detail-status" id="cityDetailStatus">
                        Ready to explore ${cityName}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('cityDetailModal');

        // Add event listeners
        this.setupModalEventListeners();
    }

    /**
     * Initialize local Leaflet map instance
     */
    async initializeLocalMap(coordinates) {
        const mapContainer = document.getElementById('cityDetailMap');

        // Create local map instance (separate from global map)
        this.localMap = L.map('cityDetailMap', {
            center: coordinates,
            zoom: 14, // Start with detailed zoom for city view
            maxZoom: 18, // Allow high zoom for city details
            minZoom: 8
        });

        // Add land texture basemap using Mazlo's Land Texture Tiles
        // First try to get available textures, fallback to OSM if none available
        try {
            const textureResponse = await fetch('/api/land-textures');
            const textures = await textureResponse.json();

            if (textures.success && textures.textures.length > 0) {
                // Use first available texture as base layer
                const firstTexture = textures.textures[0];
                console.log(`Using land texture: ${firstTexture.name}`);

                // Create ImageOverlay from texture
                // For now, use a reasonable bounds around the city coordinates
                const boundsSize = 0.05; // Approximately 5km radius
                const textureBounds = [
                    [coordinates[0] - boundsSize, coordinates[1] - boundsSize],
                    [coordinates[0] + boundsSize, coordinates[1] + boundsSize]
                ];

                L.imageOverlay(firstTexture.url, textureBounds, {
                    opacity: 0.7,
                    attribution: 'Mazlo Land Textures'
                }).addTo(this.localMap);

                console.log('Added land texture overlay for city detail view');
            } else {
                // Fallback to OSM with reduced opacity
                this.addFallbackBasemap();
            }
        } catch (error) {
            console.warn('Could not load land textures, using fallback basemap:', error);
            this.addFallbackBasemap();
        }

        // Initialize layer groups for detailed features
        this.layers = {
            buildings: L.layerGroup(),
            roads: L.layerGroup(),
            districts: L.layerGroup(),
            fields: L.layerGroup(),
            trees: L.layerGroup(),
            castles: L.layerGroup()
        };

        // Add all layers to map by default
        Object.values(this.layers).forEach(layer => {
            layer.addTo(this.localMap);
        });

        console.log('Added all layers to local map:', Object.keys(this.layers));

        // Hide loading indicator
        document.getElementById('cityMapLoading').style.display = 'none';
    }

    /**
     * Load city-specific GeoJSON layers
     */
    async loadCityLayers(cityName) {
        const layerTypes = ['buildings', 'roads', 'districts', 'fields', 'trees', 'castles'];
        let loadedLayers = [];
        let failedLayers = [];

        for (const layerType of layerTypes) {
            try {
                await this.loadCityLayer(cityName, layerType);
                loadedLayers.push(layerType);
            } catch (error) {
                console.log(`Optional layer ${layerType} not available for ${cityName}`);
                failedLayers.push(layerType);
            }
        }

        if (loadedLayers.length > 0) {
            this.updateStatus(`Loaded ${loadedLayers.length} layer types for ${cityName}: ${loadedLayers.join(', ')}`);
            if (failedLayers.length > 0) {
                console.log(`Missing optional layers for ${cityName}: ${failedLayers.join(', ')}`);
            }
        } else {
            this.updateStatus(`No city data found for ${cityName}. Try adding GeoJSON files to /Mundi/local-data/`);
        }
    }

    /**
     * Load individual city layer
     */
    async loadCityLayer(cityName, layerType) {
        // Check cache first
        const cacheKey = `${cityName}_${layerType}`;
        const cached = this.dataCache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp < this.cacheTimeout)) {
            this.addGeoJSONToLayer(cached.data, layerType);
            return;
        }

        try {
            const response = await fetch(`/api/local-map/${layerType}/${encodeURIComponent(cityName)}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const geojsonData = await response.json();

            if (geojsonData.features && geojsonData.features.length > 0) {
                // Cache the data
                this.dataCache.set(cacheKey, {
                    data: geojsonData,
                    timestamp: Date.now()
                });

                this.addGeoJSONToLayer(geojsonData, layerType);
                console.log(`Loaded ${geojsonData.features.length} ${layerType} features for ${cityName}`);
            }

        } catch (error) {
            // This is expected for optional layers that don't exist
            throw error; // Re-throw to be caught by caller
        }
    }

    /**
     * Add GeoJSON data to specified layer
     */
    addGeoJSONToLayer(geojsonData, layerType) {
        const layer = this.layers[layerType];
        if (!layer) return;

        // Clear existing data
        layer.clearLayers();

        console.log(`Adding ${geojsonData.features?.length} ${layerType} features to layer`);

        const geoJsonLayer = L.geoJSON(geojsonData, {
            style: this.getLayerStyle(layerType),
            pointToLayer: (feature, latlng) => {
                console.log(`Creating point marker for ${layerType} at:`, latlng);
                return L.circleMarker(latlng, this.getLayerStyle(layerType));
            },
            onEachFeature: (feature, layer) => {
                console.log(`Processing feature in ${layerType}:`, feature.properties);

                // Add popups with feature information
                const props = feature.properties || {};
                const popupContent = Object.entries(props)
                    .filter(([key, value]) => value && key !== 'geometry')
                    .map(([key, value]) => `<strong>${key}:</strong> ${value}`)
                    .join('<br>');

                if (popupContent) {
                    layer.bindPopup(popupContent);
                }
            }
        });

        geoJsonLayer.addTo(layer);

        // Force map to fit bounds of added features if they exist
        if (geojsonData.features && geojsonData.features.length > 0) {
            try {
                const bounds = geoJsonLayer.getBounds();
                console.log(`${layerType} layer bounds:`, bounds);

                // Only fit to bounds if this is the first significant layer (buildings usually)
                if (layerType === 'buildings' && this.localMap) {
                    this.localMap.fitBounds(bounds, { padding: [20, 20] });
                    console.log(`Fitted map to ${layerType} bounds`);
                }
            } catch (error) {
                console.warn(`Could not fit bounds for ${layerType}:`, error);
            }
        }
    }

    /**
     * Get styling for different layer types
     */
    getLayerStyle(layerType) {
        const styles = {
            buildings: {
                color: '#8B4513',
                weight: 2,
                fillColor: '#D2B48C',
                fillOpacity: 0.8,
                opacity: 1.0
            },
            roads: {
                color: '#FF6347', // More visible red-orange
                weight: 4,
                opacity: 1.0
            },
            districts: {
                color: '#4169E1',
                weight: 3,
                fillOpacity: 0.2,
                opacity: 1.0,
                dashArray: '5, 5'
            },
            fields: {
                color: '#228B22',
                fillColor: '#90EE90',
                fillOpacity: 0.5,
                opacity: 1.0
            },
            trees: {
                color: '#006400',
                fillColor: '#228B22',
                fillOpacity: 1.0,
                radius: 6,
                opacity: 1.0
            },
            castles: {
                color: '#8B0000',
                fillColor: '#DC143C',
                fillOpacity: 1.0,
                radius: 10,
                opacity: 1.0
            }
        };

        return styles[layerType] || { color: '#FF0000', weight: 2, opacity: 1.0 }; // Bright red fallback
    }

    /**
     * Setup event listeners for modal controls
     */
    setupModalEventListeners() {
        // Close button
        document.getElementById('closeCityModal').addEventListener('click', () => {
            this.close();
        });

        // Layer toggles
        const layerTypes = ['buildings', 'roads', 'districts', 'fields', 'trees', 'castles'];
        layerTypes.forEach(layerType => {
            const checkbox = document.getElementById(`detail${layerType.charAt(0).toUpperCase() + layerType.slice(1)}`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.toggleLayer(layerType, e.target.checked);
                });
            }
        });

        // Generate roads button
        document.getElementById('generateRoads').addEventListener('click', () => {
            this.generateRoads();
        });

        // Close on background click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    /**
     * Toggle layer visibility
     */
    toggleLayer(layerType, visible) {
        const layer = this.layers[layerType];
        if (!layer || !this.localMap) return;

        if (visible) {
            this.localMap.addLayer(layer);
        } else {
            this.localMap.removeLayer(layer);
        }
    }

    /**
     * Generate roads using server-side pathfinding
     */
    async generateRoads() {
        if (!this.currentCity) return;

        const button = document.getElementById('generateRoads');
        const originalText = button.textContent;

        button.textContent = 'Generating...';
        button.disabled = true;

        try {
            this.updateStatus('Generating road network...');

            const response = await fetch('/api/generate-local-roads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cityName: this.currentCity })
            });

            if (!response.ok) {
                throw new Error(`Failed to generate roads: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                // Reload roads layer with generated data
                await this.loadCityLayer(this.currentCity, 'roads');
                this.updateStatus(`Generated ${result.roadCount || 'road network'} for ${this.currentCity}`);
            } else {
                throw new Error(result.error || 'Road generation failed');
            }

        } catch (error) {
            console.error('Road generation error:', error);
            this.updateStatus(`Error generating roads: ${error.message}`);
        } finally {
            button.textContent = originalText;
            button.disabled = false;
        }
    }

    /**
     * Update status message
     */
    updateStatus(message) {
        const statusEl = document.getElementById('cityDetailStatus');
        if (statusEl) {
            statusEl.textContent = message;
            console.log('City Detail Status:', message);
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        this.updateStatus(`Error: ${message}`);
        console.error('City Detail Error:', message);
    }

    /**
     * Close modal and clean up resources
     */
    close() {
        if (!this.isOpen) return;

        console.log('Closing city detail view');

        // Destroy map instance to free memory
        if (this.localMap) {
            this.localMap.remove();
            this.localMap = null;
        }

        // Clear layers
        this.layers = {};

        // Remove modal from DOM
        if (this.modal) {
            this.modal.remove();
            this.modal = null;
        }

        // Restore body scrolling
        document.body.style.overflow = '';

        // Clean up state
        this.isOpen = false;
        this.currentCity = null;

        console.log('City detail view closed and resources cleaned up');
    }

    /**
     * Add fallback basemap when textures are not available
     */
    addFallbackBasemap() {
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: 'City Detail View - Fallback Basemap',
            minZoom: 8,
            maxZoom: 18,
            opacity: 0.3 // Lower opacity to make overlays more visible
        }).addTo(this.localMap);
        console.log('Added fallback OSM basemap');
    }

    /**
     * Clear cache entries older than timeout
     */
    cleanupCache() {
        const now = Date.now();
        for (const [key, entry] of this.dataCache.entries()) {
            if (now - entry.timestamp > this.cacheTimeout) {
                this.dataCache.delete(key);
            }
        }
    }
}

// Create global instance
window.cityDetailViewer = new CityDetailViewer();

// Clean up cache periodically
setInterval(() => {
    window.cityDetailViewer.cleanupCache();
}, 60000); // Clean up every minute
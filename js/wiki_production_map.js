/**
 * Production Wiki Map Integration
 * Automatically loads vector layers without user controls
 * Respects zoom level restrictions and shows layers by default
 */

class ProductionWikiMap {
    constructor() {
        this.map = null;
        this.mapInitialized = false;
        this.vectorLayers = {
            elevation: null,
            roads: null,
            water: null,
            biomes: null,
            rivers: null
        };
        this.defaultCenter = [1.37, 10.94];
        this.defaultZoom = 6;

        this.init();
    }

    async init() {
        console.log('Production Wiki Map: Initializing...');

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeMap());
        } else {
            setTimeout(() => this.initializeMap(), 100);
        }
    }

    async initializeMap() {
        const mapContainer = document.getElementById('wikiMap');
        if (!mapContainer) {
            console.log('Production Wiki Map: Map container not found');
            return;
        }

        // Check if map is already initialized by another script
        if (mapContainer._leaflet_id) {
            console.log('Production Wiki Map: Map already initialized by another script');

            // Try to get the existing map instance
            const existingMap = window.wikiMap || window.map;
            if (existingMap) {
                this.map = existingMap;
                this.mapInitialized = true;

                // Initialize vector layers on the existing map
                this.initializeVectorLayers();
                await this.loadAllVectorLayers();

                // Setup zoom-based layer visibility
                this.map.on('zoomend', () => this.updateLayerVisibility());

                console.log('Production Wiki Map: Vector layers added to existing map');
                return;
            }
        }

        // Clear placeholder only if map hasn't been initialized
        if (!mapContainer.hasChildNodes() || (mapContainer.children.length === 1 && mapContainer.children[0].className === 'map-placeholder')) {
            mapContainer.innerHTML = '';
        }

        try {
            // Initialize Leaflet map
            this.map = L.map('wikiMap', {
                center: this.defaultCenter,
                zoom: this.defaultZoom,
                minZoom: 0,
                maxZoom: 18
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
            this.initializeVectorLayers();

            // Load all vector layers
            await this.loadAllVectorLayers();

            // Setup zoom-based layer visibility
            this.map.on('zoomend', () => this.updateLayerVisibility());

            this.mapInitialized = true;

            // Make map globally available for other scripts
            window.wikiMap = this.map;
            window.productionWikiMap = this;

            console.log('Production Wiki Map: Map initialized successfully with vector layers');

        } catch (error) {
            console.error('Production Wiki Map: Error initializing map:', error);
            this.showMapError(error);
        }
    }

    initializeVectorLayers() {
        // Create layer groups for each vector type
        this.vectorLayers = {
            elevation: L.layerGroup(),
            roads: L.layerGroup(),
            water: L.layerGroup(),
            biomes: L.layerGroup(),
            rivers: L.layerGroup()
        };
    }

    async loadAllVectorLayers() {
        console.log('Production Wiki Map: Loading all vector layers...');

        try {
            // Load all vector layers in parallel
            const loadPromises = [
                this.loadVectorLayer('roads', '/api/maps/roads/network'),
                this.loadVectorLayer('water', '/api/maps/water/features'),
                this.loadVectorLayer('biomes', '/api/maps/biomes/regions'),
                this.loadVectorLayer('rivers', '/api/maps/water/rivers')
            ];

            // Try to load elevation separately since it might be disabled
            this.loadVectorLayer('elevation', '/api/maps/elevation/contours').catch(err => {
                console.log('Production Wiki Map: Elevation contours not available:', err.message || 'Disabled');
            });

            await Promise.all(loadPromises);

            // Add all layers to map (they will be shown/hidden based on zoom)
            Object.keys(this.vectorLayers).forEach(layerType => {
                if (this.vectorLayers[layerType]) {
                    this.vectorLayers[layerType].addTo(this.map);
                }
            });

            // Update initial visibility based on current zoom
            this.updateLayerVisibility();

            console.log('Production Wiki Map: All vector layers loaded successfully');

        } catch (error) {
            console.error('Production Wiki Map: Error loading vector layers:', error);
        }
    }

    async loadVectorLayer(layerType, endpoint) {
        try {
            console.log(`Production Wiki Map: Loading ${layerType} layer from ${endpoint}`);

            const response = await fetch(endpoint);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Handle both API response formats
            let geojsonData;
            if (data.success && data.data) {
                geojsonData = data.data;
            } else if (data.data) {
                geojsonData = data.data;
            } else if (data.features) {
                geojsonData = data;
            } else {
                console.warn(`Production Wiki Map: Unexpected data format for ${layerType}:`, data);
                return;
            }

            if (geojsonData && geojsonData.features) {
                this.addGeoJSONToLayer(geojsonData, layerType);
                console.log(`Production Wiki Map: ${layerType} layer loaded with ${geojsonData.features.length} features`);
            } else {
                console.warn(`Production Wiki Map: No features found in ${layerType} data`);
            }

        } catch (error) {
            console.error(`Production Wiki Map: Error loading ${layerType} layer:`, error);
        }
    }

    addGeoJSONToLayer(geojsonData, layerType) {
        const layer = this.vectorLayers[layerType];

        L.geoJSON(geojsonData, {
            style: this.getLayerStyle(layerType),
            pointToLayer: (feature, latlng) => {
                return L.circleMarker(latlng, this.getLayerStyle(layerType));
            },
            onEachFeature: (feature, layer) => {
                this.setupPopup(feature, layer, layerType);
            }
        }).addTo(layer);
    }

    getLayerStyle(layerType) {
        const styles = {
            elevation: (feature) => {
                const elevation = feature.properties.ELEV || 0;
                const intensity = Math.min(elevation / 200, 1);
                const color = `hsl(30, 70%, ${50 + intensity * 30}%)`;
                const weight = 0.5 + intensity * 1.5;

                return {
                    color: color,
                    weight: weight,
                    opacity: 0.7 + intensity * 0.3,
                    fillOpacity: 0
                };
            },
            roads: {
                color: '#444444',
                weight: 1.5,
                opacity: 0.8,
                dashArray: '5, 5'  // Dashed lines
            },
            water: {
                color: '#4a90e2',
                weight: 2,
                fillColor: '#6bb6ff',
                fillOpacity: 0.6
            },
            biomes: (feature) => {
                const biomeType = feature.properties.Biome || feature.properties.biome || 'unknown';
                const biomeColors = {
                    'Forest': '#228B22',
                    'Wetland': '#4682B4',
                    'Grassland': '#90EE90',
                    'Desert': '#F4A460',
                    'Tundra': '#E0E0E0',
                    'Mountain': '#A0522D',
                    'Ocean': '#006994',
                    'unknown': '#CCCCCC'
                };
                const color = biomeColors[biomeType] || '#CCCCCC';

                return {
                    color: color,
                    weight: 1,
                    fillColor: color,
                    fillOpacity: 0.3
                };
            },
            rivers: {
                color: '#2980b9',
                weight: 2,
                opacity: 0.8
            }
        };

        const style = styles[layerType];
        if (typeof style === 'function') {
            return style;
        }
        return style;
    }

    setupPopup(feature, layer, layerType) {
        let popupContent = '';

        switch (layerType) {
            case 'elevation':
                if (feature.properties && feature.properties.ELEV) {
                    popupContent = `<div style="font-family: Arial, sans-serif; font-size: 12px;"><strong>⛰️ Elevation:</strong> ${feature.properties.ELEV}m</div>`;
                }
                break;

            case 'roads':
                popupContent = `<div style="font-family: Arial, sans-serif; font-size: 12px;"><strong>🛣️ Road</strong></div>`;
                break;

            case 'water':
                const waterType = feature.properties.type || 'water feature';
                popupContent = `<div style="font-family: Arial, sans-serif; font-size: 12px;"><strong>💧 Water:</strong> ${waterType}</div>`;
                break;

            case 'biomes':
                const biomeType = feature.properties.Biome || feature.properties.biome || 'unknown';
                popupContent = `<div style="font-family: Arial, sans-serif; font-size: 12px;"><strong>🌿 Biome:</strong> ${biomeType}</div>`;
                break;

            case 'rivers':
                const riverName = feature.properties.nimi || feature.properties.name || 'unnamed river';
                popupContent = `<div style="font-family: Arial, sans-serif; font-size: 12px;"><strong>🌊 River:</strong> ${riverName}</div>`;
                break;
        }

        if (popupContent) {
            layer.bindPopup(popupContent, {
                maxWidth: 200,
                className: 'production-wiki-popup'
            });
        }
    }

    updateLayerVisibility() {
        const currentZoom = this.map.getZoom();

        // Zoom thresholds for each layer type
        const zoomThresholds = {
            elevation: 7,    // Show at zoom 7+
            roads: 8,        // Show at zoom 8+
            water: 6,         // Show at zoom 6+
            biomes: 5,        // Show at zoom 5+
            rivers: 6          // Show at zoom 6+
        };

        Object.entries(zoomThresholds).forEach(([layerType, threshold]) => {
            const layer = this.vectorLayers[layerType];
            if (!layer) return;

            const isVisible = currentZoom >= threshold;

            if (isVisible && !this.map.hasLayer(layer)) {
                this.map.addLayer(layer);
                console.log(`Production Wiki Map: Showing ${layerType} layer (zoom ${currentZoom} >= ${threshold})`);
            } else if (!isVisible && this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
                console.log(`Production Wiki Map: Hiding ${layerType} layer (zoom ${currentZoom} < ${threshold})`);
            }
        });
    }

    showMapError(error) {
        const mapContainer = document.getElementById('wikiMap');
        if (mapContainer) {
            mapContainer.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #8b7355; text-align: center; font-family: Arial, sans-serif;">
                    <div style="font-size: 24px; margin-bottom: 10px;">⚠️ Map Loading Error</div>
                    <div style="font-size: 14px;">Unable to load the interactive map</div>
                    <div style="font-size: 12px; margin-top: 10px; color: #666;">Error: ${error.message}</div>
                </div>
            `;
        }
    }

    // Public method to zoom to specific coordinates
    zoomToLocation(lat, lon, zoom = 10) {
        if (this.map) {
            this.map.setView([lat, lon], zoom);
        }
    }

    // Public method to center map
    centerMap() {
        if (this.map) {
            this.map.setView(this.defaultCenter, this.defaultZoom);
        }
    }
}

// Initialize the production wiki map when page loads
let productionWikiMap;

document.addEventListener('DOMContentLoaded', () => {
    productionWikiMap = new ProductionWikiMap();
    console.log('Production Wiki Map: Module loaded');
});

// Make globally accessible for external use
if (typeof window !== 'undefined') {
    window.productionWikiMap = productionWikiMap;
}
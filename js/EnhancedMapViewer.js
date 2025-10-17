/**
 * Enhanced Map Viewer with Mundi and Enonomics Integration
 * Extends CityDetailViewer with economic overlays and trade visualization
 */

class EnhancedMapViewer {
    constructor() {
        this.map = null;
        this.geoJsonService = new GeoJSONService();
        this.mundiService = new MundiService();
        this.layers = {
            base: {},
            economic: {},
            trade: {},
            analysis: {}
        };
        this.currentCity = null;
        this.economicData = null;
    }

    /**
     * Initialize the enhanced map viewer
     * @param {string} containerId - DOM element ID for map container
     * @param {Object} options - Map initialization options
     */
    async initialize(containerId, options = {}) {
        try {
            // Create map instance
            this.map = L.map(containerId, {
                center: options.center || [0, 0],
                zoom: options.zoom || 5,
                maxZoom: options.maxZoom || 18,
                minZoom: options.minZoom || 2
            });

            // Add base layer
            await this.addBaseLayer(options.basemap);

            // Initialize layer controls
            this.layerControl = L.control.layers({}, {}, {
                position: 'topright',
                collapsed: false
            });
            this.layerControl.addTo(this.map);

            // Add custom controls
            this.addCustomControls();

            // Setup event handlers
            this.setupEventHandlers();

            return true;
        } catch (error) {
            console.error('Failed to initialize enhanced map:', error);
            return false;
        }
    }

    /**
     * Load and display city with economic data
     * @param {string} cityName - Name of the city to load
     */
    async loadCity(cityName) {
        try {
            this.currentCity = cityName;

            // Show loading indicator
            this.showLoading(true);

            // Load combined city data
            const cityData = await this.geoJsonService.loadCityData(cityName);

            // Clear existing layers
            this.clearLayers();

            // Add city layers
            this.addCityLayers(cityData);

            // Load and add economic overlays
            if (cityData.metadata && cityData.metadata.economicSummary) {
                this.economicData = cityData.metadata.economicSummary;
                await this.addEconomicOverlays(cityData);
            }

            // Load trade routes
            await this.loadTradeRoutes(cityName);

            // Fit map to city bounds
            this.fitToCityBounds(cityData);

            // Hide loading indicator
            this.showLoading(false);

            // Update info panel
            this.updateInfoPanel(cityData.metadata);

        } catch (error) {
            console.error(`Failed to load city ${cityName}:`, error);
            this.showError(`Failed to load city: ${error.message}`);
        }
    }

    /**
     * Add base layer to map
     * @param {string} basemapId - Basemap identifier
     */
    async addBaseLayer(basemapId = 'osm') {
        const basemaps = await this.mundiService.getBasemaps();
        const basemap = basemaps.find(b => b.id === basemapId) || basemaps[0];

        this.layers.base.main = L.tileLayer(basemap.url, {
            attribution: basemap.attribution,
            maxZoom: 19
        });

        this.layers.base.main.addTo(this.map);
        this.layerControl.addBaseLayer(this.layers.base.main, basemap.name);
    }

    /**
     * Add city feature layers
     * @param {Object} cityData - GeoJSON city data
     */
    addCityLayers(cityData) {
        const layerGroups = this.groupFeaturesByLayer(cityData.features);

        Object.entries(layerGroups).forEach(([layerName, features]) => {
            const geoJsonLayer = L.geoJSON({
                type: 'FeatureCollection',
                features: features
            }, {
                style: (feature) => this.getFeatureStyle(feature),
                onEachFeature: (feature, layer) => this.bindFeaturePopup(feature, layer)
            });

            this.layers.base[layerName] = geoJsonLayer;
            geoJsonLayer.addTo(this.map);
            this.layerControl.addOverlay(geoJsonLayer, this.formatLayerName(layerName));
        });
    }

    /**
     * Add economic overlay layers
     * @param {Object} cityData - City data with economic information
     */
    async addEconomicOverlays(cityData) {
        // Create wealth heatmap
        const wealthLayer = this.createWealthHeatmap(cityData);
        if (wealthLayer) {
            this.layers.economic.wealth = wealthLayer;
            this.layerControl.addOverlay(wealthLayer, '💰 Wealth Distribution');
        }

        // Create population density layer
        const populationLayer = this.createPopulationDensityLayer(cityData);
        if (populationLayer) {
            this.layers.economic.population = populationLayer;
            this.layerControl.addOverlay(populationLayer, '👥 Population Density');
        }

        // Create technology level indicators
        const techLayer = this.createTechnologyLayer(cityData);
        if (techLayer) {
            this.layers.economic.technology = techLayer;
            this.layerControl.addOverlay(techLayer, '⚙️ Technology Level');
        }
    }

    /**
     * Create wealth distribution heatmap
     * @param {Object} cityData - City data
     * @returns {L.Layer} Wealth heatmap layer
     */
    createWealthHeatmap(cityData) {
        const wealthPoints = [];

        cityData.features.forEach(feature => {
            if (feature.properties.economicData && feature.geometry.type === 'Point') {
                const wealth = feature.properties.economicData.wealth_level || 0;
                wealthPoints.push([
                    feature.geometry.coordinates[1], // lat
                    feature.geometry.coordinates[0], // lng
                    wealth
                ]);
            }
        });

        if (wealthPoints.length > 0) {
            return L.heatLayer(wealthPoints, {
                radius: 25,
                blur: 15,
                maxZoom: 17,
                gradient: {
                    0.0: 'blue',
                    0.25: 'cyan',
                    0.5: 'lime',
                    0.75: 'yellow',
                    1.0: 'red'
                }
            });
        }

        return null;
    }

    /**
     * Create population density visualization
     * @param {Object} cityData - City data
     * @returns {L.Layer} Population density layer
     */
    createPopulationDensityLayer(cityData) {
        const densityFeatures = cityData.features.filter(f =>
            f.properties.layer === 'districts' && f.properties.population
        );

        if (densityFeatures.length > 0) {
            return L.geoJSON({
                type: 'FeatureCollection',
                features: densityFeatures
            }, {
                style: (feature) => {
                    const density = feature.properties.population / feature.properties.area || 0;
                    return {
                        fillColor: this.getColorForDensity(density),
                        fillOpacity: 0.6,
                        color: '#666',
                        weight: 1
                    };
                }
            });
        }

        return null;
    }

    /**
     * Create technology level indicators
     * @param {Object} cityData - City data
     * @returns {L.Layer} Technology indicators layer
     */
    createTechnologyLayer(cityData) {
        const techMarkers = [];

        cityData.features.forEach(feature => {
            if (feature.properties.tech_level && feature.geometry.type === 'Point') {
                const icon = this.getTechIcon(feature.properties.tech_level);
                const marker = L.marker(
                    [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
                    { icon }
                );
                marker.bindPopup(`Tech Level: ${feature.properties.tech_level}`);
                techMarkers.push(marker);
            }
        });

        if (techMarkers.length > 0) {
            return L.layerGroup(techMarkers);
        }

        return null;
    }

    /**
     * Load and display trade routes
     * @param {string} cityName - City name
     */
    async loadTradeRoutes(cityName) {
        try {
            const response = await fetch(`/api/trade-routes/${cityName}`);
            if (!response.ok) return;

            const tradeData = await response.json();

            if (tradeData.features && tradeData.features.length > 0) {
                const tradeLayer = L.geoJSON(tradeData, {
                    style: (feature) => ({
                        color: this.getTradeRouteColor(feature.properties.volume),
                        weight: Math.log(feature.properties.volume + 1) + 1,
                        opacity: 0.7,
                        dashArray: '5, 10'
                    }),
                    onEachFeature: (feature, layer) => {
                        layer.bindPopup(`
                            <strong>Trade Route</strong><br>
                            From: ${feature.properties.from}<br>
                            To: ${feature.properties.to}<br>
                            Volume: ${feature.properties.volume}<br>
                            Goods: ${feature.properties.goods.join(', ')}
                        `);
                    }
                });

                this.layers.trade.routes = tradeLayer;
                tradeLayer.addTo(this.map);
                this.layerControl.addOverlay(tradeLayer, '🚢 Trade Routes');
            }
        } catch (error) {
            console.warn('Could not load trade routes:', error);
        }
    }

    /**
     * Add custom map controls
     */
    addCustomControls() {
        // Economic data toggle
        const economicControl = L.control({ position: 'topleft' });
        economicControl.onAdd = () => {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            div.innerHTML = `
                <a href="#" title="Toggle Economic Data" class="economic-toggle">
                    <span style="font-size: 20px;">📊</span>
                </a>
            `;
            div.onclick = (e) => {
                e.preventDefault();
                this.toggleEconomicLayers();
            };
            return div;
        };
        economicControl.addTo(this.map);

        // Analysis tools
        const analysisControl = L.control({ position: 'topleft' });
        analysisControl.onAdd = () => {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            div.innerHTML = `
                <a href="#" title="Spatial Analysis" class="analysis-toggle">
                    <span style="font-size: 20px;">🔍</span>
                </a>
            `;
            div.onclick = (e) => {
                e.preventDefault();
                this.openAnalysisPanel();
            };
            return div;
        };
        analysisControl.addTo(this.map);

        // Info panel
        const infoControl = L.control({ position: 'bottomright' });
        infoControl.onAdd = () => {
            const div = L.DomUtil.create('div', 'info-panel');
            div.innerHTML = '<h4>City Information</h4><div id="info-content">Select a city to view details</div>';
            return div;
        };
        this.infoPanel = infoControl;
        infoControl.addTo(this.map);
    }

    /**
     * Update information panel
     * @param {Object} metadata - City metadata
     */
    updateInfoPanel(metadata) {
        if (!metadata) return;

        const content = document.getElementById('info-content');
        if (content) {
            content.innerHTML = `
                <strong>${metadata.cityName || 'Unknown City'}</strong><br>
                Population: ${metadata.economicSummary?.population || 'N/A'}<br>
                GDP: ${metadata.economicSummary?.gdp || 'N/A'}<br>
                Tech Level: ${metadata.economicSummary?.techLevel || 'N/A'}<br>
                <small>Updated: ${new Date(metadata.timestamp).toLocaleString()}</small>
            `;
        }
    }

    /**
     * Get style for feature based on properties
     * @param {Object} feature - GeoJSON feature
     * @returns {Object} Leaflet style object
     */
    getFeatureStyle(feature) {
        const layer = feature.properties.layer;
        const styles = {
            buildings: {
                fillColor: '#d4a373',
                fillOpacity: 0.8,
                color: '#8b7355',
                weight: 1
            },
            roads: {
                color: '#666666',
                weight: 3,
                opacity: 0.9
            },
            districts: {
                fillColor: '#90EE90',
                fillOpacity: 0.3,
                color: '#228B22',
                weight: 2,
                dashArray: '5, 5'
            },
            castles: {
                fillColor: '#8B4513',
                fillOpacity: 0.9,
                color: '#654321',
                weight: 2
            }
        };

        return styles[layer] || {
            fillColor: '#3388ff',
            fillOpacity: 0.5,
            color: '#3388ff',
            weight: 2
        };
    }

    /**
     * Bind popup to feature
     * @param {Object} feature - GeoJSON feature
     * @param {L.Layer} layer - Leaflet layer
     */
    bindFeaturePopup(feature, layer) {
        const props = feature.properties;
        let popupContent = `<strong>${props.name || 'Unknown'}</strong><br>`;
        popupContent += `Type: ${props.layer}<br>`;

        if (props.economicData) {
            popupContent += `Wealth: ${props.economicData.wealth_level || 'N/A'}<br>`;
            popupContent += `Tech Access: ${props.economicData.tech_access || 'N/A'}<br>`;
        }

        layer.bindPopup(popupContent);
    }

    /**
     * Helper functions
     */

    groupFeaturesByLayer(features) {
        const groups = {};
        features.forEach(feature => {
            const layer = feature.properties.layer || 'other';
            if (!groups[layer]) {
                groups[layer] = [];
            }
            groups[layer].push(feature);
        });
        return groups;
    }

    formatLayerName(name) {
        const icons = {
            buildings: '🏠',
            roads: '🛣️',
            districts: '🏘️',
            castles: '🏰'
        };
        const icon = icons[name] || '📍';
        return `${icon} ${name.charAt(0).toUpperCase() + name.slice(1)}`;
    }

    getColorForDensity(density) {
        return density > 1000 ? '#800026' :
               density > 500 ? '#BD0026' :
               density > 200 ? '#E31A1C' :
               density > 100 ? '#FC4E2A' :
               density > 50 ? '#FD8D3C' :
               density > 20 ? '#FEB24C' :
               density > 10 ? '#FED976' :
                             '#FFEDA0';
    }

    getTechIcon(level) {
        const icons = {
            'tribal': '🏕️',
            'medieval': '⚔️',
            'industrial': '🏭',
            'modern': '🏙️',
            'advanced': '🚀'
        };
        const iconText = icons[level] || '❓';

        return L.divIcon({
            html: `<div style="font-size: 20px;">${iconText}</div>`,
            className: 'tech-icon',
            iconSize: [30, 30]
        });
    }

    getTradeRouteColor(volume) {
        if (volume > 1000) return '#ff0000';
        if (volume > 500) return '#ff8800';
        if (volume > 100) return '#ffff00';
        if (volume > 50) return '#88ff00';
        return '#00ff00';
    }

    toggleEconomicLayers() {
        Object.values(this.layers.economic).forEach(layer => {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            } else {
                this.map.addLayer(layer);
            }
        });
    }

    fitToCityBounds(cityData) {
        const bbox = this.geoJsonService.getBoundingBox(cityData);
        if (bbox[0] !== Infinity) {
            this.map.fitBounds([
                [bbox[1], bbox[0]], // SW
                [bbox[3], bbox[2]]  // NE
            ]);
        }
    }

    clearLayers() {
        ['base', 'economic', 'trade', 'analysis'].forEach(category => {
            Object.values(this.layers[category]).forEach(layer => {
                if (layer && layer !== this.layers.base.main) {
                    this.map.removeLayer(layer);
                }
            });
        });
    }

    showLoading(show) {
        // Implement loading indicator
        const loader = document.getElementById('map-loader');
        if (loader) {
            loader.style.display = show ? 'block' : 'none';
        }
    }

    showError(message) {
        // Implement error display
        console.error(message);
        alert(message);
    }

    openAnalysisPanel() {
        // Placeholder for spatial analysis tools
        console.log('Analysis panel would open here');
    }

    setupEventHandlers() {
        this.map.on('click', (e) => {
            // Handle map clicks
        });

        this.map.on('zoomend', () => {
            // Handle zoom changes
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedMapViewer;
}
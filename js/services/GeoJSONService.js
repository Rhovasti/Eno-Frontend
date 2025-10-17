/**
 * GeoJSON Processing Service
 * Unified service for processing and merging GeoJSON data from Mundi and Enonomics
 */

class GeoJSONService {
    constructor() {
        this.mundiDataPath = '/Mundi/local-data/';
        this.enonomicsAPI = process.env.ENONOMICS_API_URL || 'http://localhost:8001/api/';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Load city data from multiple sources and merge
     * @param {string} cityName - Name of the city
     * @returns {Promise<Object>} Merged GeoJSON FeatureCollection
     */
    async loadCityData(cityName) {
        const cacheKey = `city_${cityName}`;

        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        try {
            // Load spatial data from Mundi
            const [buildings, roads, districts, castles] = await Promise.all([
                this.loadGeoJSON(`buildings/${cityName}`),
                this.loadGeoJSON(`roads/${cityName}`),
                this.loadGeoJSON(`districts/${cityName}`),
                this.loadGeoJSON(`castles/${cityName}_castles`)
            ]);

            // Fetch economic data from Enonomics
            const economicData = await this.fetchEconomicData(cityName);

            // Merge all datasets
            const mergedData = this.mergeDatasets({
                buildings,
                roads,
                districts,
                castles,
                economicData
            });

            // Cache the result
            this.cache.set(cacheKey, {
                data: mergedData,
                timestamp: Date.now()
            });

            // Cleanup old cache entries
            this.cleanupCache();

            return mergedData;

        } catch (error) {
            console.error(`Error loading city data for ${cityName}:`, error);
            throw error;
        }
    }

    /**
     * Load GeoJSON file from local data directory
     * @param {string} path - Relative path to GeoJSON file
     * @returns {Promise<Object>} GeoJSON object
     */
    async loadGeoJSON(path) {
        try {
            const response = await fetch(`/api/local-map/${path.split('/').join('/')}`);
            if (!response.ok) {
                // Return empty FeatureCollection if file not found
                return { type: 'FeatureCollection', features: [] };
            }
            return await response.json();
        } catch (error) {
            console.warn(`Could not load GeoJSON from ${path}:`, error);
            return { type: 'FeatureCollection', features: [] };
        }
    }

    /**
     * Fetch economic data from Enonomics system
     * @param {string} cityName - Name of the city
     * @returns {Promise<Object>} Economic data
     */
    async fetchEconomicData(cityName) {
        try {
            const response = await fetch(`${this.enonomicsAPI}city/${cityName}/economics`);
            if (!response.ok) {
                return this.getDefaultEconomicData();
            }
            return await response.json();
        } catch (error) {
            console.warn(`Could not fetch economic data for ${cityName}:`, error);
            return this.getDefaultEconomicData();
        }
    }

    /**
     * Get default economic data structure
     * @returns {Object} Default economic data
     */
    getDefaultEconomicData() {
        return {
            gdp: 0,
            gdp_per_capita: 0,
            population: 0,
            technology_level: 'unknown',
            resources: [],
            trade_connections: [],
            economic_indicators: {
                wealth: 0,
                growth_rate: 0,
                unemployment: 0,
                inflation: 0
            }
        };
    }

    /**
     * Merge spatial and economic datasets
     * @param {Object} datasets - Object containing different data layers
     * @returns {Object} Merged GeoJSON FeatureCollection
     */
    mergeDatasets(datasets) {
        const { buildings, roads, districts, castles, economicData } = datasets;
        const features = [];

        // Process buildings with economic data
        if (buildings && buildings.features) {
            buildings.features.forEach(feature => {
                const enrichedFeature = {
                    ...feature,
                    properties: {
                        ...feature.properties,
                        layer: 'buildings',
                        economicData: this.getEconomicDataForFeature(feature, economicData)
                    }
                };
                features.push(enrichedFeature);
            });
        }

        // Add infrastructure layers
        this.addLayerFeatures(features, roads, 'roads');
        this.addLayerFeatures(features, districts, 'districts');
        this.addLayerFeatures(features, castles, 'castles');

        // Create feature collection with metadata
        return {
            type: 'FeatureCollection',
            features,
            metadata: {
                cityName: economicData.city_name || 'Unknown',
                economicSummary: {
                    gdp: economicData.gdp,
                    population: economicData.population,
                    techLevel: economicData.technology_level
                },
                timestamp: new Date().toISOString()
            }
        };
    }

    /**
     * Add features from a layer to the features array
     * @param {Array} features - Target features array
     * @param {Object} layer - Source GeoJSON layer
     * @param {string} layerName - Name of the layer
     */
    addLayerFeatures(features, layer, layerName) {
        if (layer && layer.features) {
            layer.features.forEach(feature => {
                features.push({
                    ...feature,
                    properties: {
                        ...feature.properties,
                        layer: layerName
                    }
                });
            });
        }
    }

    /**
     * Get economic data for a specific feature
     * @param {Object} feature - GeoJSON feature
     * @param {Object} economicData - Economic data object
     * @returns {Object} Economic data for the feature
     */
    getEconomicDataForFeature(feature, economicData) {
        // Match economic data to feature based on ID or name
        const featureId = feature.properties.id || feature.properties.name;

        if (economicData.feature_economics && economicData.feature_economics[featureId]) {
            return economicData.feature_economics[featureId];
        }

        // Return general economic indicators if no specific data
        return {
            wealth_level: economicData.economic_indicators?.wealth || 0,
            tech_access: economicData.technology_level || 'unknown'
        };
    }

    /**
     * Transform coordinates between projection systems
     * @param {Array} coordinates - Input coordinates
     * @param {string} fromProj - Source projection (e.g., 'EPSG:3857')
     * @param {string} toProj - Target projection (e.g., 'EPSG:4326')
     * @returns {Array} Transformed coordinates
     */
    transformCoordinates(coordinates, fromProj = 'EPSG:3857', toProj = 'EPSG:4326') {
        // Simple Web Mercator to WGS84 transformation
        if (fromProj === 'EPSG:3857' && toProj === 'EPSG:4326') {
            return coordinates.map(coord => {
                const x = (coord[0] * 180) / 20037508.34;
                const y = (Math.atan(Math.exp((coord[1] * Math.PI) / 20037508.34)) * 360) / Math.PI - 90;
                return [x, y];
            });
        }

        // Return unchanged if transformation not implemented
        return coordinates;
    }

    /**
     * Validate GeoJSON structure
     * @param {Object} geojson - GeoJSON object to validate
     * @returns {boolean} True if valid
     */
    validateGeoJSON(geojson) {
        if (!geojson || typeof geojson !== 'object') {
            return false;
        }

        if (geojson.type === 'FeatureCollection') {
            return Array.isArray(geojson.features);
        }

        if (geojson.type === 'Feature') {
            return geojson.geometry && geojson.properties;
        }

        return false;
    }

    /**
     * Clean up expired cache entries
     */
    cleanupCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout * 2) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get bounding box for a GeoJSON object
     * @param {Object} geojson - GeoJSON object
     * @returns {Array} Bounding box [minLon, minLat, maxLon, maxLat]
     */
    getBoundingBox(geojson) {
        let minLon = Infinity, minLat = Infinity;
        let maxLon = -Infinity, maxLat = -Infinity;

        const processCoords = (coords) => {
            if (Array.isArray(coords[0])) {
                coords.forEach(processCoords);
            } else {
                minLon = Math.min(minLon, coords[0]);
                maxLon = Math.max(maxLon, coords[0]);
                minLat = Math.min(minLat, coords[1]);
                maxLat = Math.max(maxLat, coords[1]);
            }
        };

        if (geojson.features) {
            geojson.features.forEach(feature => {
                if (feature.geometry && feature.geometry.coordinates) {
                    processCoords(feature.geometry.coordinates);
                }
            });
        }

        return [minLon, minLat, maxLon, maxLat];
    }

    /**
     * Filter features by property value
     * @param {Object} geojson - GeoJSON FeatureCollection
     * @param {string} property - Property name
     * @param {any} value - Property value to match
     * @returns {Object} Filtered FeatureCollection
     */
    filterByProperty(geojson, property, value) {
        if (!this.validateGeoJSON(geojson)) {
            return { type: 'FeatureCollection', features: [] };
        }

        const filteredFeatures = geojson.features.filter(feature =>
            feature.properties && feature.properties[property] === value
        );

        return {
            type: 'FeatureCollection',
            features: filteredFeatures
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeoJSONService;
}
/**
 * Mundi GIS Platform Service
 * Wrapper for Mundi.ai API integration
 */

class MundiService {
    constructor() {
        this.mundiAPI = process.env.MUNDI_API_URL || 'http://localhost:8000';
        this.headers = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Initialize connection to Mundi service
     * @returns {Promise<boolean>} Connection status
     */
    async connect() {
        try {
            const response = await fetch(`${this.mundiAPI}/health`);
            return response.ok;
        } catch (error) {
            console.error('Failed to connect to Mundi service:', error);
            return false;
        }
    }

    /**
     * Create a new map project
     * @param {Object} mapConfig - Map configuration
     * @returns {Promise<Object>} Created map details
     */
    async createMap(mapConfig) {
        try {
            const response = await fetch(`${this.mundiAPI}/api/projects`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    name: mapConfig.name || 'Eno Map',
                    description: mapConfig.description || 'Eno world map',
                    bounds: mapConfig.bounds,
                    center: mapConfig.center,
                    zoom: mapConfig.zoom || 5
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to create map: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error creating map:', error);
            throw error;
        }
    }

    /**
     * Add a layer to an existing map
     * @param {string} mapId - Map ID
     * @param {Object} layerData - Layer configuration and data
     * @returns {Promise<Object>} Layer details
     */
    async addLayer(mapId, layerData) {
        try {
            const response = await fetch(`${this.mundiAPI}/api/maps/${mapId}/layers`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    name: layerData.name,
                    type: layerData.type || 'geojson',
                    data: layerData.data,
                    style: layerData.style || this.getDefaultStyle(layerData.type),
                    visible: layerData.visible !== false,
                    minZoom: layerData.minZoom || 0,
                    maxZoom: layerData.maxZoom || 20
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to add layer: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error adding layer:', error);
            throw error;
        }
    }

    /**
     * Query features within a bounding box
     * @param {Array} bbox - Bounding box [minLon, minLat, maxLon, maxLat]
     * @param {Object} filters - Optional filters
     * @returns {Promise<Object>} GeoJSON FeatureCollection
     */
    async queryFeatures(bbox, filters = {}) {
        try {
            const params = new URLSearchParams({
                bbox: bbox.join(','),
                ...filters
            });

            const response = await fetch(`${this.mundiAPI}/api/features?${params}`);

            if (!response.ok) {
                throw new Error(`Failed to query features: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error querying features:', error);
            throw error;
        }
    }

    /**
     * Upload GeoJSON data to Mundi
     * @param {Object} geojson - GeoJSON data
     * @param {Object} metadata - Metadata for the upload
     * @returns {Promise<Object>} Upload result
     */
    async uploadGeoJSON(geojson, metadata = {}) {
        try {
            const response = await fetch(`${this.mundiAPI}/api/layers`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    name: metadata.name || 'Uploaded Layer',
                    data_type: 'geojson',
                    data: geojson,
                    source: metadata.source || 'eno-frontend',
                    tags: metadata.tags || []
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to upload GeoJSON: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error uploading GeoJSON:', error);
            throw error;
        }
    }

    /**
     * Get list of available basemaps
     * @returns {Promise<Array>} List of basemap configurations
     */
    async getBasemaps() {
        try {
            const response = await fetch(`${this.mundiAPI}/api/basemaps`);

            if (!response.ok) {
                throw new Error(`Failed to get basemaps: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting basemaps:', error);
            // Return default basemap if service unavailable
            return [{
                id: 'osm',
                name: 'OpenStreetMap',
                url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                attribution: '© OpenStreetMap contributors'
            }];
        }
    }

    /**
     * Perform spatial analysis
     * @param {string} operation - Analysis operation (buffer, intersect, union, etc.)
     * @param {Object} params - Operation parameters
     * @returns {Promise<Object>} Analysis result
     */
    async spatialAnalysis(operation, params) {
        try {
            const response = await fetch(`${this.mundiAPI}/api/analysis/${operation}`, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify(params)
            });

            if (!response.ok) {
                throw new Error(`Spatial analysis failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Error in spatial analysis (${operation}):`, error);
            throw error;
        }
    }

    /**
     * Get default style for a layer type
     * @param {string} type - Layer type
     * @returns {Object} Default style configuration
     */
    getDefaultStyle(type) {
        const styles = {
            point: {
                radius: 6,
                fillColor: '#3388ff',
                fillOpacity: 0.8,
                color: '#ffffff',
                weight: 2
            },
            line: {
                color: '#3388ff',
                weight: 3,
                opacity: 0.8
            },
            polygon: {
                fillColor: '#3388ff',
                fillOpacity: 0.5,
                color: '#3388ff',
                weight: 2
            },
            building: {
                fillColor: '#d4a373',
                fillOpacity: 0.8,
                color: '#8b7355',
                weight: 1
            },
            road: {
                color: '#666666',
                weight: 2,
                opacity: 0.9
            },
            district: {
                fillColor: '#90EE90',
                fillOpacity: 0.3,
                color: '#228B22',
                weight: 2,
                dashArray: '5, 5'
            }
        };

        return styles[type] || styles.polygon;
    }

    /**
     * Export map data in various formats
     * @param {string} mapId - Map ID
     * @param {string} format - Export format (geojson, kml, shapefile)
     * @returns {Promise<Blob>} Exported data
     */
    async exportMap(mapId, format = 'geojson') {
        try {
            const response = await fetch(`${this.mundiAPI}/api/maps/${mapId}/export?format=${format}`);

            if (!response.ok) {
                throw new Error(`Export failed: ${response.statusText}`);
            }

            return await response.blob();
        } catch (error) {
            console.error('Error exporting map:', error);
            throw error;
        }
    }

    /**
     * Get collaboration room for real-time editing
     * @param {string} mapId - Map ID
     * @returns {Promise<Object>} Room connection details
     */
    async getCollaborationRoom(mapId) {
        try {
            const response = await fetch(`${this.mundiAPI}/api/maps/${mapId}/room`, {
                method: 'POST',
                headers: this.headers
            });

            if (!response.ok) {
                throw new Error(`Failed to get collaboration room: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error getting collaboration room:', error);
            throw error;
        }
    }

    /**
     * Subscribe to real-time updates for a map
     * @param {string} mapId - Map ID
     * @param {Function} callback - Callback for updates
     * @returns {WebSocket} WebSocket connection
     */
    subscribeToUpdates(mapId, callback) {
        const wsUrl = this.mundiAPI.replace('http', 'ws');
        const ws = new WebSocket(`${wsUrl}/room/${mapId}`);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                callback(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
            console.log('WebSocket connection closed');
        };

        return ws;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MundiService;
}
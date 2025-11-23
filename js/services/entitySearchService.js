/**
 * Entity Search Service - Frontend service for entity search and relationship exploration
 * Follows AsyncGameManager.js patterns for API communication and error handling
 */

class EntitySearchService {
    constructor() {
        this.apiBaseUrl = '/api/entities';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache timeout
    }

    /**
     * Get cache key for search queries
     * @param {string} query - Search query
     * @param {Array} entityTypes - Entity types filter
     * @param {string} searchMode - Search mode
     * @returns {string} Cache key
     */
    _getCacheKey(query, entityTypes = [], searchMode = 'combined') {
        const typesStr = entityTypes.sort().join(',');
        return `${query}:${typesStr}:${searchMode}`;
    }

    /**
     * Get cached results if valid
     * @param {string} cacheKey - Cache key
     * @returns {Object|null} Cached results or null
     */
    _getCachedResults(cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        this.cache.delete(cacheKey);
        return null;
    }

    /**
     * Cache search results
     * @param {string} cacheKey - Cache key
     * @param {Object} data - Results to cache
     */
    _cacheResults(cacheKey, data) {
        this.cache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
    }

    /**
     * Make API request with error handling
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Fetch options
     * @returns {Promise<Object>} API response
     */
    async _makeRequest(endpoint, options = {}) {
        try {
            const response = await fetch(this.apiBaseUrl + endpoint, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Entity Search Service API Error (${endpoint}):`, error);
            throw error;
        }
    }

    /**
     * Search for entities with semantic and graph search
     * @param {string} queryText - Search query text
     * @param {Object} options - Search options
     * @returns {Promise<Object>} Search results
     */
    async searchEntities(queryText, options = {}) {
        const {
            entityTypes = [],
            maxResults = 10,
            includeRelationships = true,
            minRelevanceScore = 0.5,
            searchMode = 'combined' // 'semantic', 'graph', or 'combined'
        } = options;

        // Check cache first
        const cacheKey = this._getCacheKey(queryText, entityTypes, searchMode);
        const cachedResults = this._getCachedResults(cacheKey);
        if (cachedResults) {
            console.log(`Using cached results for query: ${queryText}`);
            return cachedResults;
        }

        try {
            const requestBody = {
                query_text: queryText,
                entity_types: entityTypes,
                max_results: maxResults,
                include_relationships: includeRelationships,
                min_relevance_score: minRelevanceScore,
                search_mode: searchMode
            };

            const results = await this._makeRequest('/search', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });

            // Cache successful results
            this._cacheResults(cacheKey, results);

            console.log(`Entity search completed: ${results.total_count} results in ${results.search_time.toFixed(2)}s`);
            return results;

        } catch (error) {
            console.error('Error searching entities:', error);
            throw new Error(`Failed to search entities: ${error.message}`);
        }
    }

    /**
     * Get detailed information about a specific entity
     * @param {string} entityName - Name of the entity
     * @param {string} entityType - Type of the entity
     * @param {boolean} includeRelationships - Whether to include relationships
     * @returns {Promise<Object|null>} Entity details or null if not found
     */
    async getEntityDetails(entityName, entityType, includeRelationships = true) {
        try {
            const params = new URLSearchParams({
                entity_name: entityName,
                entity_type: entityType,
                include_relationships: includeRelationships.toString()
            });

            const entity = await this._makeRequest(`/details?${params}`);
            return entity;
        } catch (error) {
            if (error.message.includes('404')) {
                return null; // Entity not found
            }
            console.error('Error getting entity details:', error);
            throw new Error(`Failed to get entity details: ${error.message}`);
        }
    }

    /**
     * Explore relationships for an entity
     * @param {string} entityName - Name of the entity
     * @param {string} entityType - Type of the entity
     * @param {Object} options - Exploration options
     * @returns {Promise<Object>} Relationship exploration results
     */
    async exploreRelationships(entityName, entityType, options = {}) {
        const {
            maxDepth = 2,
            relationshipTypes = [],
            includeBidirectional = true
        } = options;

        try {
            const requestBody = {
                entity_name: entityName,
                entity_type: entityType,
                max_depth: maxDepth,
                relationship_types: relationshipTypes,
                include_bidirectional: includeBidirectional
            };

            const results = await this._makeRequest('/relationships/explore', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });

            console.log(`Relationship exploration completed: ${results.total_relationships} direct relationships`);
            return results;

        } catch (error) {
            console.error('Error exploring relationships:', error);
            throw new Error(`Failed to explore relationships: ${error.message}`);
        }
    }

    /**
     * Find common relationships between two entities
     * @param {string} entity1Name - Name of first entity
     * @param {string} entity1Type - Type of first entity
     * @param {string} entity2Name - Name of second entity
     * @param {string} entity2Type - Type of second entity
     * @returns {Promise<Object>} Common relationships
     */
    async findCommonRelationships(entity1Name, entity1Type, entity2Name, entity2Type) {
        try {
            const params = new URLSearchParams({
                entity1_name: entity1Name,
                entity1_type: entity1Type,
                entity2_name: entity2Name,
                entity2_type: entity2Type
            });

            const results = await this._makeRequest(`/relationships/common?${params}`);
            return results;
        } catch (error) {
            console.error('Error finding common relationships:', error);
            throw new Error(`Failed to find common relationships: ${error.message}`);
        }
    }

    /**
     * Get relationship statistics for an entity
     * @param {string} entityName - Name of the entity
     * @param {string} entityType - Type of the entity
     * @returns {Promise<Object>} Relationship statistics
     */
    async getRelationshipStatistics(entityName, entityType) {
        try {
            const params = new URLSearchParams({
                entity_name: entityName,
                entity_type: entityType
            });

            const stats = await this._makeRequest(`/relationships/statistics?${params}`);
            return stats;
        } catch (error) {
            console.error('Error getting relationship statistics:', error);
            throw new Error(`Failed to get relationship statistics: ${error.message}`);
        }
    }

    /**
     * Get available entity types
     * @returns {Promise<Array>} List of available entity types
     */
    async getAvailableEntityTypes() {
        try {
            const response = await this._makeRequest('/types');
            return response.entity_types || [];
        } catch (error) {
            console.error('Error getting entity types:', error);
            // Return default entity types if API fails
            return ['Character', 'Location', 'Event', 'Faction', 'Item', 'Concept'];
        }
    }

    /**
     * Get service status and capabilities
     * @returns {Promise<Object>} Service status
     */
    async getServiceStatus() {
        try {
            const status = await this._makeRequest('/status');
            return status;
        } catch (error) {
            console.error('Error getting service status:', error);
            return {
                chroma_connected: false,
                neo4j_connected: false,
                search_modes_available: [],
                error: error.message
            };
        }
    }

    /**
     * Add a new entity to the search index
     * @param {Object} entityData - Entity data
     * @returns {Promise<boolean>} Success status
     */
    async addEntity(entityData) {
        const {
            entityId,
            entityName,
            entityType,
            description,
            relationships = [],
            properties = {}
        } = entityData;

        try {
            const requestBody = {
                entity_id: entityId,
                entity_name: entityName,
                entity_type: entityType,
                description,
                relationships,
                properties
            };

            await this._makeRequest('/add', {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });

            // Clear relevant cache entries
            this._clearRelatedCache(entityName, entityType);

            console.log(`Successfully added entity: ${entityName}`);
            return true;

        } catch (error) {
            console.error('Error adding entity:', error);
            throw new Error(`Failed to add entity: ${error.message}`);
        }
    }

    /**
     * Update an existing entity in the search index
     * @param {Object} entityData - Updated entity data
     * @returns {Promise<boolean>} Success status
     */
    async updateEntity(entityData) {
        const {
            entityId,
            entityName,
            entityType,
            description,
            relationships = [],
            properties = {}
        } = entityData;

        try {
            const requestBody = {
                entity_id: entityId,
                entity_name: entityName,
                entity_type: entityType,
                description,
                relationships,
                properties
            };

            await this._makeRequest('/update', {
                method: 'PUT',
                body: JSON.stringify(requestBody)
            });

            // Clear relevant cache entries
            this._clearRelatedCache(entityName, entityType);

            console.log(`Successfully updated entity: ${entityName}`);
            return true;

        } catch (error) {
            console.error('Error updating entity:', error);
            throw new Error(`Failed to update entity: ${error.message}`);
        }
    }

    /**
     * Clear cache entries related to an entity
     * @param {string} entityName - Entity name
     * @param {string} entityType - Entity type
     */
    _clearRelatedCache(entityName, entityType) {
        // Clear cache entries that might be affected by this entity change
        for (const [key, value] of this.cache.entries()) {
            if (key.includes(entityName.toLowerCase()) ||
                key.includes(entityType.toLowerCase())) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Clear all cached results
     */
    clearCache() {
        this.cache.clear();
        console.log('Entity search cache cleared');
    }

    /**
     * Get cache information
     * @returns {Object} Cache statistics
     */
    getCacheInfo() {
        const entries = Array.from(this.cache.entries());
        const now = Date.now();

        return {
            totalEntries: entries.length,
            validEntries: entries.filter(([key, value]) =>
                now - value.timestamp < this.cacheTimeout
            ).length,
            oldestEntry: entries.length > 0 ?
                Math.min(...entries.map(([key, value]) => value.timestamp)) : null,
            newestEntry: entries.length > 0 ?
                Math.max(...entries.map(([key, value]) => value.timestamp)) : null
        };
    }
}

// Export for use in browser
window.EntitySearchService = EntitySearchService;
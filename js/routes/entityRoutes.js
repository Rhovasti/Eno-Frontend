/**
 * Entity Routes - Express routes for entity search and relationship exploration
 * Follows existing Express route patterns in server_sqlite_new.js with authentication middleware
 */

const express = require('express');
const EntitySearchService = require('../services/entitySearchService');

const router = express.Router();

// Initialize entity search service
const entitySearchService = new EntitySearchService();

/**
 * Authentication middleware - follows existing patterns from server_sqlite_new.js
 */
function authenticateToken(req, res, next) {
    const token = req.cookies.token;

    if (!token) {
        return res.status(401).json({
            error: 'Authentication required',
            message: 'Please log in to access this feature'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        console.error('JWT verification error:', error);
        return res.status(401).json({
            error: 'Invalid token',
            message: 'Please log in again'
        });
    }
}

/**
 * Check user permissions - follows existing role-based access patterns
 */
function checkPermission(requiredPermission) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please log in to access this feature'
            });
        }

        const userRoles = req.user.roles || ['player'];
        const hasPermission = userRoles.some(role => {
            const permissions = {
                'admin': ['all'],
                'gm': ['create_game', 'manage_game', 'create_post', 'edit_own_post', 'create_beat', 'create_chapter', 'archive_chapter', 'view_all', 'search_entities'],
                'editor': ['edit_wiki', 'create_wiki', 'edit_lore', 'create_lore', 'view_all', 'create_post', 'edit_own_post', 'search_entities'],
                'player': ['create_post', 'edit_own_post', 'join_game', 'view_public', 'search_entities'],
                'anonymous': ['view_public', 'create_post', 'search_entities']
            };
            return permissions[role] && (
                permissions[role].includes('all') ||
                permissions[role].includes(requiredPermission)
            );
        });

        if (!hasPermission) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                message: `Permission '${requiredPermission}' required to access this feature`
            });
        }

        next();
    };
}

/**
 * Error handling middleware - follows existing error response patterns
 */
function handleAsyncError(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * GET /api/entities/status
 * Get entity search service status and capabilities
 */
router.get('/status', handleAsyncError(async (req, res) => {
    try {
        const status = await entitySearchService.getServiceStatus();
        res.json({
            success: true,
            data: status,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting service status:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to get service status',
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * GET /api/entities/types
 * Get available entity types for filtering
 */
router.get('/types', handleAsyncError(async (req, res) => {
    try {
        const entityTypes = await entitySearchService.getAvailableEntityTypes();
        res.json({
            success: true,
            data: {
                entity_types: entityTypes,
                total_types: entityTypes.length
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting entity types:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to get entity types',
            timestamp: new Date().toISOString()
        });
    }
}));

/**
 * POST /api/entities/search
 * Search for entities with semantic and graph search capabilities
 */
router.post('/search',
    authenticateToken,
    checkPermission('search_entities'),
    handleAsyncError(async (req, res) => {
        try {
            const {
                query_text,
                entity_types = [],
                max_results = 10,
                include_relationships = true,
                min_relevance_score = 0.5,
                search_mode = 'combined'
            } = req.body;

            // Validate required fields
            if (!query_text || typeof query_text !== 'string' || query_text.trim().length < 2) {
                return res.status(400).json({
                    error: 'Invalid query',
                    message: 'Query text must be at least 2 characters long'
                });
            }

            // Validate search mode
            const validModes = ['semantic', 'graph', 'combined'];
            if (!validModes.includes(search_mode)) {
                return res.status(400).json({
                    error: 'Invalid search mode',
                    message: `Search mode must be one of: ${validModes.join(', ')}`
                });
            }

            // Validate numeric parameters
            if (max_results && (typeof max_results !== 'number' || max_results < 1 || max_results > 100)) {
                return res.status(400).json({
                    error: 'Invalid max_results',
                    message: 'max_results must be a number between 1 and 100'
                });
            }

            if (min_relevance_score && (typeof min_relevance_score !== 'number' || min_relevance_score < 0 || min_relevance_score > 1)) {
                return res.status(400).json({
                    error: 'Invalid min_relevance_score',
                    message: 'min_relevance_score must be a number between 0 and 1'
                });
            }

            // Perform search
            const results = await entitySearchService.searchEntities(query_text, {
                entityTypes,
                maxResults: max_results,
                includeRelationships,
                minRelevanceScore,
                searchMode
            });

            res.json({
                success: true,
                data: results,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error in entity search:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to search entities',
                timestamp: new Date().toISOString()
            });
        }
    })
);

/**
 * GET /api/entities/details
 * Get detailed information about a specific entity
 */
router.get('/details',
    authenticateToken,
    checkPermission('search_entities'),
    handleAsyncError(async (req, res) => {
        try {
            const {
                entity_name,
                entity_type,
                include_relationships = 'true'
            } = req.query;

            // Validate required parameters
            if (!entity_name || !entity_type) {
                return res.status(400).json({
                    error: 'Missing required parameters',
                    message: 'Both entity_name and entity_type are required'
                });
            }

            const includeRels = include_relationships === 'true';

            // Get entity details
            const entity = await entitySearchService.getEntityDetails(
                entity_name,
                entity_type,
                includeRels
            );

            if (!entity) {
                return res.status(404).json({
                    error: 'Entity not found',
                    message: `No entity found with name '${entity_name}' and type '${entity_type}'`
                });
            }

            res.json({
                success: true,
                data: entity,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error getting entity details:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to get entity details',
                timestamp: new Date().toISOString()
            });
        }
    })
);

/**
 * POST /api/entities/relationships/explore
 * Explore relationships for an entity with bidirectional traversal
 */
router.post('/relationships/explore',
    authenticateToken,
    checkPermission('search_entities'),
    handleAsyncError(async (req, res) => {
        try {
            const {
                entity_name,
                entity_type,
                max_depth = 2,
                relationship_types = [],
                include_bidirectional = true
            } = req.body;

            // Validate required parameters
            if (!entity_name || !entity_type) {
                return res.status(400).json({
                    error: 'Missing required parameters',
                    message: 'Both entity_name and entity_type are required'
                });
            }

            // Validate max_depth
            if (typeof max_depth !== 'number' || max_depth < 1 || max_depth > 4) {
                return res.status(400).json({
                    error: 'Invalid max_depth',
                    message: 'max_depth must be a number between 1 and 4'
                });
            }

            // Explore relationships
            const relationshipData = await entitySearchService.exploreRelationships(
                entity_name,
                entity_type,
                {
                    maxDepth,
                    relationshipTypes,
                    includeBidirectional
                }
            );

            res.json({
                success: true,
                data: relationshipData,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error exploring relationships:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to explore relationships',
                timestamp: new Date().toISOString()
            });
        }
    })
);

/**
 * GET /api/entities/relationships/common
 * Find common relationships between two entities
 */
router.get('/relationships/common',
    authenticateToken,
    checkPermission('search_entities'),
    handleAsyncError(async (req, res) => {
        try {
            const {
                entity1_name,
                entity1_type,
                entity2_name,
                entity2_type
            } = req.query;

            // Validate required parameters
            if (!entity1_name || !entity1_type || !entity2_name || !entity2_type) {
                return res.status(400).json({
                    error: 'Missing required parameters',
                    message: 'All four parameters are required: entity1_name, entity1_type, entity2_name, entity2_type'
                });
            }

            // Find common relationships
            const commonRelationships = await entitySearchService.findCommonRelationships(
                entity1_name,
                entity1_type,
                entity2_name,
                entity2_type
            );

            res.json({
                success: true,
                data: commonRelationships,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error finding common relationships:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to find common relationships',
                timestamp: new Date().toISOString()
            });
        }
    })
);

/**
 * GET /api/entities/relationships/statistics
 * Get relationship statistics for an entity
 */
router.get('/relationships/statistics',
    authenticateToken,
    checkPermission('search_entities'),
    handleAsyncError(async (req, res) => {
        try {
            const {
                entity_name,
                entity_type
            } = req.query;

            // Validate required parameters
            if (!entity_name || !entity_type) {
                return res.status(400).json({
                    error: 'Missing required parameters',
                    message: 'Both entity_name and entity_type are required'
                });
            }

            // Get statistics
            const statistics = await entitySearchService.getRelationshipStatistics(
                entity_name,
                entity_type
            );

            res.json({
                success: true,
                data: statistics,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Error getting relationship statistics:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to get relationship statistics',
                timestamp: new Date().toISOString()
            });
        }
    })
);

/**
 * POST /api/entities/add
 * Add a new entity to the search index
 */
router.post('/add',
    authenticateToken,
    checkPermission('create_wiki'), // Wiki creation permission seems appropriate
    handleAsyncError(async (req, res) => {
        try {
            const {
                entity_id,
                entity_name,
                entity_type,
                description,
                relationships = [],
                properties = {}
            } = req.body;

            // Validate required fields
            if (!entity_id || !entity_name || !entity_type) {
                return res.status(400).json({
                    error: 'Missing required parameters',
                    message: 'entity_id, entity_name, and entity_type are required'
                });
            }

            // Validate entity type
            const validTypes = ['Character', 'Location', 'Event', 'Faction', 'Item', 'Concept'];
            if (!validTypes.includes(entity_type)) {
                return res.status(400).json({
                    error: 'Invalid entity type',
                    message: `entity_type must be one of: ${validTypes.join(', ')}`
                });
            }

            // Add entity
            const success = await entitySearchService.addEntity({
                entityId,
                entityName,
                entityType,
                description,
                relationships,
                properties
            });

            if (success) {
                res.json({
                    success: true,
                    message: 'Entity added successfully to search index',
                    entity_id,
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(500).json({
                    error: 'Failed to add entity',
                    message: 'Entity could not be added to search index'
                });
            }

        } catch (error) {
            console.error('Error adding entity:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to add entity',
                timestamp: new Date().toISOString()
            });
        }
    })
);

/**
 * PUT /api/entities/update
 * Update an existing entity in the search index
 */
router.put('/update',
    authenticateToken,
    checkPermission('edit_wiki'), // Wiki edit permission seems appropriate
    handleAsyncError(async (req, res) => {
        try {
            const {
                entity_id,
                entity_name,
                entity_type,
                description,
                relationships = [],
                properties = {}
            } = req.body;

            // Validate required fields
            if (!entity_id || !entity_name || !entity_type) {
                return res.status(400).json({
                    error: 'Missing required parameters',
                    message: 'entity_id, entity_name, and entity_type are required'
                });
            }

            // Validate entity type
            const validTypes = ['Character', 'Location', 'Event', 'Faction', 'Item', 'Concept'];
            if (!validTypes.includes(entity_type)) {
                return res.status(400).json({
                    error: 'Invalid entity type',
                    message: `entity_type must be one of: ${validTypes.join(', ')}`
                });
            }

            // Update entity
            const success = await entitySearchService.updateEntity({
                entityId,
                entityName,
                entityType,
                description,
                relationships,
                properties
            });

            if (success) {
                res.json({
                    success: true,
                    message: 'Entity updated successfully in search index',
                    entity_id,
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(500).json({
                    error: 'Failed to update entity',
                    message: 'Entity could not be updated in search index'
                });
            }

        } catch (error) {
            console.error('Error updating entity:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to update entity',
                timestamp: new Date().toISOString()
            });
        }
    })
);

/**
 * GET /api/entities/cache/info
 * Get cache information (for debugging)
 */
router.get('/cache/info',
    authenticateToken,
    checkPermission('view_all'),
    handleAsyncError(async (req, res) => {
        try {
            const cacheInfo = entitySearchService.getCacheInfo();
            res.json({
                success: true,
                data: cacheInfo,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error getting cache info:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to get cache information',
                timestamp: new Date().toISOString()
            });
        }
    })
);

/**
 * DELETE /api/entities/cache
 * Clear search cache (for debugging/admin purposes)
 */
router.delete('/cache',
    authenticateToken,
    checkPermission('admin'), // Admin only
    handleAsyncError(async (req, res) => {
        try {
            entitySearchService.clearCache();
            res.json({
                success: true,
                message: 'Entity search cache cleared successfully',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error clearing cache:', error);
            res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to clear cache',
                timestamp: new Date().toISOString()
            });
        }
    })
);

/**
 * Error handling middleware for the router
 */
router.use((error, req, res, next) => {
    console.error('Entity routes error:', error);

    // Handle JWT errors specifically
    if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid token',
            message: 'Please log in again'
        });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation error',
            message: error.message
        });
    }

    // Generic error handling
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'production'
            ? 'An unexpected error occurred'
            : error.message,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
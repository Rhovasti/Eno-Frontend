/**
 * Lore Integration Service
 *
 * Central hub for connecting to all lore and knowledge sources:
 * - N4L Knowledge Graph (SSTorytime)
 * - Neo4j Graph Database (Eno-Backend)
 * - ChromaDB Vector Store (Eno-Backend)
 * - Enonomics Economic Data
 * - QGIS/Mundi Geospatial Data
 * - Wiki/Lore JSON files
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

class LoreIntegrationService {
    constructor(db) {
        this.db = db;
        this.cache = new Map();
        this.cacheTimeout = 300000; // 5 minutes

        // Initialize connectors
        this.connectors = {
            n4l: new N4LConnector(),
            wiki: new WikiConnector(),
            geospatial: new GeospatialConnector(),
            economic: new EconomicConnector()
        };

        // Note: Neo4j and ChromaDB connectors would require backend API calls
        // For now, we'll stub these or use local alternatives
    }

    /**
     * Fetch comprehensive context from all available sources
     */
    async fetchComprehensiveContext(gameId, actions) {
        const cacheKey = `context_${gameId}_${Date.now()}`;

        // Check if we have recent cached context
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }
        }

        // Parallel fetch from all sources
        const [
            worldStructure,
            historicalEvents,
            characterRelationships,
            economicData,
            geographicContext,
            culturalLore,
            worldRules
        ] = await Promise.all([
            this.fetchWorldStructure(gameId),
            this.fetchHistoricalEvents(gameId, actions),
            this.fetchCharacterRelationships(gameId),
            this.fetchEconomicData(gameId),
            this.fetchGeographicContext(actions),
            this.fetchCulturalLore(gameId),
            this.fetchWorldRules()
        ]);

        const context = {
            worldStructure,
            historicalEvents,
            characterRelationships,
            economicData,
            geographicContext,
            culturalLore,
            worldRules,
            timestamp: new Date().toISOString()
        };

        // Cache the result
        this.cache.set(cacheKey, {
            data: context,
            timestamp: Date.now()
        });

        // Clean old cache entries
        this.cleanCache();

        return context;
    }

    async fetchWorldStructure(gameId) {
        try {
            // Try to fetch from N4L if available
            const n4lData = await this.connectors.n4l.getWorldStructure();
            if (n4lData) return n4lData;
        } catch (error) {
            console.error('Error fetching N4L world structure:', error);
        }

        // Fallback to database
        return this.fetchDatabaseWorldStructure(gameId);
    }

    async fetchDatabaseWorldStructure(gameId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT world_data, game_config
                FROM games
                WHERE id = ?
            `;

            this.db.get(query, [gameId], (err, row) => {
                if (err) {
                    console.error('Error fetching world structure:', err);
                    resolve({});
                    return;
                }

                try {
                    const worldData = row?.world_data ? JSON.parse(row.world_data) : {};
                    const gameConfig = row?.game_config ? JSON.parse(row.game_config) : {};

                    resolve({
                        regions: worldData.regions || [],
                        factions: worldData.factions || [],
                        landmarks: worldData.landmarks || [],
                        worldType: gameConfig.worldType || 'fantasy',
                        magicSystem: gameConfig.magicSystem || 'standard',
                        technologyLevel: gameConfig.technologyLevel || 'medieval'
                    });
                } catch (e) {
                    console.error('Error parsing world structure:', e);
                    resolve({});
                }
            });
        });
    }

    async fetchHistoricalEvents(gameId, actions) {
        // Fetch from narrative history
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    nc.id,
                    nc.cycle_number,
                    nc.narrative_summary,
                    nc.creation_time,
                    nc.key_events
                FROM narrative_cycles nc
                WHERE nc.game_id = ?
                ORDER BY nc.cycle_number DESC
                LIMIT 10
            `;

            this.db.all(query, [gameId], (err, rows) => {
                if (err) {
                    console.error('Error fetching historical events:', err);
                    resolve([]);
                    return;
                }

                const events = rows?.map(row => {
                    let keyEvents = [];
                    try {
                        keyEvents = row.key_events ? JSON.parse(row.key_events) : [];
                    } catch (e) {
                        console.error('Error parsing key events:', e);
                    }

                    return {
                        cycleNumber: row.cycle_number,
                        date: row.creation_time,
                        summary: row.narrative_summary,
                        keyEvents: keyEvents,
                        type: 'narrative_cycle'
                    };
                }) || [];

                resolve(events);
            });
        });
    }

    async fetchCharacterRelationships(gameId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    ps1.character_name as character1,
                    ps2.character_name as character2,
                    r.relationship_type,
                    r.strength,
                    r.history
                FROM character_relationships r
                JOIN player_sessions ps1 ON r.character1_id = ps1.user_id
                JOIN player_sessions ps2 ON r.character2_id = ps2.user_id
                WHERE ps1.game_id = ?
            `;

            this.db.all(query, [gameId], (err, rows) => {
                if (err) {
                    console.error('Error fetching character relationships:', err);
                    // Return empty but valid structure
                    resolve({ relationships: [], network: {} });
                    return;
                }

                const relationships = rows?.map(row => ({
                    source: row.character1,
                    target: row.character2,
                    type: row.relationship_type || 'neutral',
                    strength: row.strength || 0.5,
                    history: row.history || []
                })) || [];

                // Build network structure
                const network = {};
                relationships.forEach(rel => {
                    if (!network[rel.source]) network[rel.source] = [];
                    if (!network[rel.target]) network[rel.target] = [];
                    network[rel.source].push(rel);
                    network[rel.target].push({
                        ...rel,
                        source: rel.target,
                        target: rel.source
                    });
                });

                resolve({ relationships, network });
            });
        });
    }

    async fetchEconomicData(gameId) {
        try {
            // Try to fetch from Enonomics if available
            const economicData = await this.connectors.economic.getGameEconomy(gameId);
            if (economicData) return economicData;
        } catch (error) {
            console.error('Error fetching Enonomics data:', error);
        }

        // Fallback to basic economic model
        return {
            tradeRoutes: [],
            marketPrices: {
                grain: 1.0,
                iron: 3.0,
                gold: 100.0
            },
            economicHealth: 0.6,
            inflation: 0.02,
            tradingPartners: []
        };
    }

    async fetchGeographicContext(actions) {
        // Extract location references from actions
        const locations = this.extractLocations(actions);

        try {
            // Try to fetch from geospatial data
            const geoData = await this.connectors.geospatial.getLocationData(locations);
            if (geoData) return geoData;
        } catch (error) {
            console.error('Error fetching geospatial data:', error);
        }

        // Return basic geographic context
        return {
            primaryLocation: locations[0] || 'Unknown',
            terrain: 'plains',
            climate: 'temperate',
            nearbySettlements: [],
            naturalFeatures: []
        };
    }

    async fetchCulturalLore(gameId) {
        try {
            // Try to fetch from wiki/lore files
            const wikiLore = await this.connectors.wiki.getCulturalLore(gameId);
            if (wikiLore) return wikiLore;
        } catch (error) {
            console.error('Error fetching wiki lore:', error);
        }

        // Fallback to database
        return new Promise((resolve, reject) => {
            const query = `
                SELECT cultural_data
                FROM games
                WHERE id = ?
            `;

            this.db.get(query, [gameId], (err, row) => {
                if (err) {
                    console.error('Error fetching cultural lore:', err);
                    resolve({});
                    return;
                }

                try {
                    const culturalData = row?.cultural_data ? JSON.parse(row.cultural_data) : {};
                    resolve({
                        traditions: culturalData.traditions || [],
                        beliefs: culturalData.beliefs || [],
                        customs: culturalData.customs || [],
                        languages: culturalData.languages || ['Common'],
                        myths: culturalData.myths || []
                    });
                } catch (e) {
                    console.error('Error parsing cultural lore:', e);
                    resolve({});
                }
            });
        });
    }

    async fetchWorldRules() {
        // Fetch fundamental world rules and constraints
        try {
            const rulesFile = path.join(__dirname, '../../data/world_rules.json');
            const rulesData = await fs.readFile(rulesFile, 'utf8');
            return JSON.parse(rulesData);
        } catch (error) {
            // Return default rules
            return {
                physics: 'standard',
                magic: {
                    exists: true,
                    maxLevel: 10,
                    sources: ['arcane', 'divine', 'nature']
                },
                technology: {
                    maxLevel: 5,
                    forbidden: ['gunpowder', 'electronics']
                },
                factionConstraints: {},
                culturalConstraints: {},
                geographicConstraints: {}
            };
        }
    }

    extractLocations(actions) {
        const locations = [];
        const locationPatterns = [
            /in (\w+)/gi,
            /at (\w+)/gi,
            /to (\w+)/gi,
            /from (\w+)/gi,
            /near (\w+)/gi
        ];

        actions.forEach(action => {
            const content = action.content || '';
            locationPatterns.forEach(pattern => {
                const matches = content.matchAll(pattern);
                for (const match of matches) {
                    if (match[1] && match[1].length > 2) {
                        locations.push(match[1]);
                    }
                }
            });
        });

        return [...new Set(locations)]; // Remove duplicates
    }

    cleanCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout * 2) {
                this.cache.delete(key);
            }
        }
    }
}

/**
 * Connector for N4L Knowledge Graph
 */
class N4LConnector {
    async getWorldStructure() {
        try {
            // Try to query N4L system
            const { stdout } = await execPromise(
                'cd /root/Eno/SSTorytime && ./N4L -query "SELECT * FROM World LIMIT 10"'
            );
            return this.parseN4LOutput(stdout);
        } catch (error) {
            console.error('N4L query failed:', error);
            return null;
        }
    }

    parseN4LOutput(output) {
        // Parse N4L query output
        try {
            const lines = output.split('\n');
            const data = {
                entities: [],
                relationships: []
            };

            lines.forEach(line => {
                if (line.includes('->')) {
                    // Relationship
                    const [source, rest] = line.split('->');
                    const [relation, target] = rest.split(':');
                    data.relationships.push({
                        source: source.trim(),
                        relation: relation.trim(),
                        target: target.trim()
                    });
                } else if (line.trim()) {
                    // Entity
                    data.entities.push(line.trim());
                }
            });

            return data;
        } catch (e) {
            console.error('Error parsing N4L output:', e);
            return null;
        }
    }
}

/**
 * Connector for Wiki/Lore files
 */
class WikiConnector {
    async getCulturalLore(gameId) {
        try {
            const loreFile = path.join(__dirname, `../../data/lore/game_${gameId}.json`);
            const loreData = await fs.readFile(loreFile, 'utf8');
            return JSON.parse(loreData);
        } catch (error) {
            // File doesn't exist or can't be read
            return null;
        }
    }
}

/**
 * Connector for Geospatial data
 */
class GeospatialConnector {
    async getLocationData(locations) {
        try {
            // Try to read QGIS data
            const geoFile = path.join('/root/Eno/qgis/biomes/kaupungit.geojson');
            const geoData = await fs.readFile(geoFile, 'utf8');
            const geojson = JSON.parse(geoData);

            // Find matching locations
            const matches = geojson.features.filter(feature => {
                const name = feature.properties?.name || '';
                return locations.some(loc =>
                    name.toLowerCase().includes(loc.toLowerCase())
                );
            });

            if (matches.length > 0) {
                return {
                    primaryLocation: matches[0].properties.name,
                    coordinates: matches[0].geometry.coordinates,
                    terrain: matches[0].properties.terrain || 'varied',
                    climate: matches[0].properties.climate || 'temperate',
                    nearbySettlements: matches.slice(1, 4).map(m => m.properties.name),
                    naturalFeatures: matches[0].properties.features || []
                };
            }
        } catch (error) {
            console.error('Error reading geospatial data:', error);
        }

        return null;
    }
}

/**
 * Connector for Economic data
 */
class EconomicConnector {
    async getGameEconomy(gameId) {
        try {
            // Try to fetch from Enonomics output
            const economicFile = path.join('/root/Eno/Enonomics/out/economy_data.json');
            const economicData = await fs.readFile(economicFile, 'utf8');
            return JSON.parse(economicData);
        } catch (error) {
            // File doesn't exist or can't be read
            return null;
        }
    }
}

module.exports = LoreIntegrationService;
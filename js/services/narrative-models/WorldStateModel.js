/**
 * World State Model
 *
 * Represents the physical and environmental state of the game world
 * Analogous to the "Physics Model" in DBN architecture
 */

class WorldStateModel {
    constructor(db) {
        this.db = db;
        this.cache = new Map();
    }

    async getState(gameId) {
        // Check cache first
        if (this.cache.has(gameId)) {
            const cached = this.cache.get(gameId);
            if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
                return cached.state;
            }
        }

        // Fetch current world state from database
        const state = await this.fetchWorldState(gameId);

        // Cache the result
        this.cache.set(gameId, {
            state,
            timestamp: Date.now()
        });

        return state;
    }

    async fetchWorldState(gameId) {
        return new Promise((resolve, reject) => {
            // Get game-specific world data
            const query = `
                SELECT
                    g.world_data,
                    g.current_season,
                    g.time_period,
                    COUNT(DISTINCT ps.user_id) as active_players,
                    COUNT(DISTINCT nc.id) as recent_events
                FROM games g
                LEFT JOIN player_sessions ps ON g.id = ps.game_id AND ps.session_status = 'active'
                LEFT JOIN narrative_cycles nc ON g.id = nc.game_id
                    AND nc.creation_time > datetime('now', '-7 days')
                WHERE g.id = ?
                GROUP BY g.id
            `;

            this.db.get(query, [gameId], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }

                // Parse world data or use defaults
                let worldData = {};
                try {
                    worldData = row?.world_data ? JSON.parse(row.world_data) : {};
                } catch (e) {
                    console.error('Error parsing world data:', e);
                }

                const state = {
                    // Environmental factors
                    season: row?.current_season || 'spring',
                    timePeriod: row?.time_period || 'medieval',
                    weather: worldData.weather || this.generateWeather(row?.current_season),

                    // Economic indicators
                    economicHealth: worldData.economicHealth || 0.6,
                    tradeRoutes: worldData.tradeRoutes || [],
                    resourceAvailability: worldData.resourceAvailability || 0.7,
                    marketPrices: worldData.marketPrices || this.getDefaultPrices(),

                    // Political landscape
                    politicalStability: worldData.politicalStability || 0.5,
                    rulingFactions: worldData.rulingFactions || [],
                    conflicts: worldData.conflicts || [],
                    alliances: worldData.alliances || [],

                    // Geographic data
                    regions: worldData.regions || [],
                    settlements: worldData.settlements || [],
                    landmarks: worldData.landmarks || [],

                    // Population metrics
                    population: worldData.population || 10000,
                    activePlayers: row?.active_players || 0,
                    demographicTrends: worldData.demographicTrends || [],

                    // Event indicators
                    recentEvents: row?.recent_events || 0,
                    naturalDisasters: worldData.naturalDisasters || [],
                    plagues: worldData.plagues || [],

                    // Resource states
                    resources: {
                        food: worldData.resources?.food || 0.7,
                        water: worldData.resources?.water || 0.8,
                        minerals: worldData.resources?.minerals || 0.5,
                        wood: worldData.resources?.wood || 0.6,
                        magic: worldData.resources?.magic || 0.3
                    },

                    // Technological/magical level
                    techLevel: worldData.techLevel || 3,
                    magicLevel: worldData.magicLevel || 2,

                    // Time tracking
                    worldAge: worldData.worldAge || 0,
                    lastUpdate: new Date().toISOString()
                };

                resolve(state);
            });
        });
    }

    async update(dt, influences, loreContext) {
        // Apply influences to world state
        const currentState = await this.getState(influences.gameId);
        const newState = this.applyInfluences(currentState, influences, dt);

        // Incorporate lore constraints
        const constrainedState = this.applyLoreConstraints(newState, loreContext);

        // Save updated state
        await this.saveState(influences.gameId, constrainedState);

        // Clear cache for this game
        this.cache.delete(influences.gameId);

        return constrainedState;
    }

    applyInfluences(state, influences, dt) {
        const newState = { ...state };

        // Economic changes
        if (influences.economicChanges) {
            if (influences.economicChanges.tradeVolume) {
                newState.economicHealth *= influences.economicChanges.tradeVolume;
            }

            Object.entries(influences.economicChanges).forEach(([key, value]) => {
                if (newState.marketPrices && newState.marketPrices[key]) {
                    newState.marketPrices[key] *= (1 + value * dt);
                }
            });
        }

        // Political shifts
        if (influences.politicalShifts) {
            if (influences.politicalShifts.stabilityDelta) {
                newState.politicalStability += influences.politicalShifts.stabilityDelta * dt;
                newState.politicalStability = Math.max(0, Math.min(1, newState.politicalStability));
            }

            if (influences.politicalShifts.conflictProbability && Math.random() < influences.politicalShifts.conflictProbability) {
                newState.conflicts.push({
                    type: 'civil_unrest',
                    severity: influences.politicalShifts.conflictProbability,
                    started: new Date().toISOString()
                });
            }
        }

        // Environmental effects
        if (influences.environmentalEffects) {
            // Apply weather changes, natural disasters, etc.
            if (influences.environmentalEffects.disaster) {
                newState.naturalDisasters.push(influences.environmentalEffects.disaster);
            }
        }

        // Resource flows
        if (influences.resourceFlows) {
            Object.entries(newState.resources).forEach(([resource, level]) => {
                if (influences.resourceFlows[resource]) {
                    newState.resources[resource] += influences.resourceFlows[resource] * dt;
                    newState.resources[resource] = Math.max(0, Math.min(1, newState.resources[resource]));
                }
            });
        }

        // Update world age
        newState.worldAge += dt;
        newState.lastUpdate = new Date().toISOString();

        return newState;
    }

    applyLoreConstraints(state, loreContext) {
        // Ensure state changes respect established lore
        const constrained = { ...state };

        if (loreContext.worldRules) {
            // Apply hard constraints from lore
            if (loreContext.worldRules.maxMagicLevel && constrained.magicLevel > loreContext.worldRules.maxMagicLevel) {
                constrained.magicLevel = loreContext.worldRules.maxMagicLevel;
            }

            if (loreContext.worldRules.minPopulation && constrained.population < loreContext.worldRules.minPopulation) {
                constrained.population = loreContext.worldRules.minPopulation;
            }
        }

        if (loreContext.geographicConstraints) {
            // Ensure geographic consistency
            constrained.regions = this.validateRegions(constrained.regions, loreContext.geographicConstraints);
        }

        return constrained;
    }

    async saveState(gameId, state) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE games
                SET world_data = ?,
                    current_season = ?,
                    time_period = ?
                WHERE id = ?
            `;

            this.db.run(query, [
                JSON.stringify(state),
                state.season,
                state.timePeriod,
                gameId
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    generateWeather(season) {
        const weatherPatterns = {
            spring: ['sunny', 'rainy', 'cloudy', 'windy'],
            summer: ['sunny', 'hot', 'clear', 'thunderstorm'],
            autumn: ['cloudy', 'rainy', 'foggy', 'cool'],
            winter: ['snowy', 'cold', 'blizzard', 'clear']
        };

        const patterns = weatherPatterns[season] || weatherPatterns.spring;
        return patterns[Math.floor(Math.random() * patterns.length)];
    }

    getDefaultPrices() {
        return {
            grain: 1.0,
            meat: 2.5,
            wood: 0.8,
            iron: 3.0,
            gold: 100.0,
            gems: 50.0,
            cloth: 1.5,
            weapons: 10.0,
            magic_items: 500.0
        };
    }

    validateRegions(regions, constraints) {
        // Ensure regions match geographic constraints from lore
        return regions.filter(region => {
            return !constraints.forbiddenRegions || !constraints.forbiddenRegions.includes(region.name);
        });
    }
}

module.exports = WorldStateModel;
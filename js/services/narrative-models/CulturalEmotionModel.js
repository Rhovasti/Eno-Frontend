/**
 * Cultural Emotion Model
 *
 * Tracks collective emotional states and cultural dynamics using VAD dimensions
 * Based on the emotion model from DBN architecture
 */

class CulturalEmotionModel {
    constructor(db) {
        this.db = db;
        this.cache = new Map();

        // Emotion decay rates (how quickly emotions return to neutral)
        this.decayRates = {
            valence: 0.1,      // Pleasure decays slowly
            arousal: 0.2,      // Activation decays moderately
            dominance: 0.05    // Control decays very slowly
        };
    }

    async getState(gameId) {
        const culturalData = await this.fetchCulturalData(gameId);
        const collectiveEmotion = await this.calculateCollectiveEmotion(gameId);
        const culturalTrends = this.identifyCulturalTrends(culturalData, collectiveEmotion);

        return {
            // VAD dimensions for collective emotion
            collectiveValence: collectiveEmotion.valence,
            collectiveArousal: collectiveEmotion.arousal,
            collectiveDominance: collectiveEmotion.dominance,

            // Discrete emotion label
            mood: this.getEmotionLabel(collectiveEmotion),

            // Cultural indicators
            culturalCohesion: culturalData.cohesion || 0.5,
            traditionalism: culturalData.traditionalism || 0.5,
            openness: culturalData.openness || 0.5,
            collectivism: culturalData.collectivism || 0.5,

            // Social dynamics
            socialTension: this.calculateSocialTension(collectiveEmotion, culturalData),
            culturalMomentum: this.calculateCulturalMomentum(culturalData),

            // Trends and movements
            trends: culturalTrends,
            activeMovements: culturalData.movements || [],
            culturalEvents: culturalData.events || [],

            // Historical emotion tracking
            emotionHistory: culturalData.emotionHistory || [],
            culturalMemory: culturalData.culturalMemory || []
        };
    }

    async fetchCulturalData(gameId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    g.cultural_data,
                    COUNT(DISTINCT ps.user_id) as population,
                    AVG(ps.influence_score) as avg_influence,
                    COUNT(DISTINCT ps.faction_id) as faction_diversity
                FROM games g
                LEFT JOIN player_sessions ps ON g.id = ps.game_id
                WHERE g.id = ?
                GROUP BY g.id
            `;

            this.db.get(query, [gameId], (err, row) => {
                if (err) {
                    console.error('Error fetching cultural data:', err);
                    resolve(this.getDefaultCulturalData());
                    return;
                }

                let culturalData = {};
                try {
                    culturalData = row?.cultural_data ? JSON.parse(row.cultural_data) : {};
                } catch (e) {
                    console.error('Error parsing cultural data:', e);
                }

                resolve({
                    ...this.getDefaultCulturalData(),
                    ...culturalData,
                    population: row?.population || 0,
                    avgInfluence: row?.avg_influence || 0,
                    factionDiversity: row?.faction_diversity || 1,
                    diversityIndex: this.calculateDiversityIndex(row?.faction_diversity, row?.population)
                });
            });
        });
    }

    async calculateCollectiveEmotion(gameId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    ps.character_data,
                    ps.influence_score,
                    COUNT(p.id) as recent_actions
                FROM player_sessions ps
                LEFT JOIN posts p ON p.author_id = ps.user_id
                    AND p.created_at > datetime('now', '-7 days')
                WHERE ps.game_id = ? AND ps.session_status = 'active'
                GROUP BY ps.user_id
            `;

            this.db.all(query, [gameId], (err, rows) => {
                if (err) {
                    console.error('Error calculating collective emotion:', err);
                    resolve({ valence: 0, arousal: 0, dominance: 0 });
                    return;
                }

                let totalValence = 0, totalArousal = 0, totalDominance = 0;
                let totalWeight = 0;

                rows?.forEach(row => {
                    let characterData = {};
                    try {
                        characterData = row.character_data ? JSON.parse(row.character_data) : {};
                    } catch (e) {
                        console.error('Error parsing character emotion data:', e);
                    }

                    const emotion = characterData.emotion || {};
                    const weight = (row.influence_score || 1) * Math.log(row.recent_actions + 1);

                    totalValence += (emotion.valence || 0) * weight;
                    totalArousal += (emotion.arousal || 0) * weight;
                    totalDominance += (emotion.dominance || 0) * weight;
                    totalWeight += weight;
                });

                if (totalWeight > 0) {
                    resolve({
                        valence: this.clamp(totalValence / totalWeight),
                        arousal: this.clamp(totalArousal / totalWeight),
                        dominance: this.clamp(totalDominance / totalWeight)
                    });
                } else {
                    resolve({ valence: 0, arousal: 0, dominance: 0 });
                }
            });
        });
    }

    identifyCulturalTrends(culturalData, collectiveEmotion) {
        const trends = [];

        // Emotional trends
        if (collectiveEmotion.valence > 0.5 && collectiveEmotion.arousal > 0.3) {
            trends.push({
                type: 'renaissance',
                strength: collectiveEmotion.valence,
                description: 'A period of cultural flourishing and innovation'
            });
        }

        if (collectiveEmotion.valence < -0.3 && collectiveEmotion.arousal > 0.5) {
            trends.push({
                type: 'revolution',
                strength: Math.abs(collectiveEmotion.valence) * collectiveEmotion.arousal,
                description: 'Social unrest and calls for change'
            });
        }

        // Cultural indicator trends
        if (culturalData.traditionalism > 0.7) {
            trends.push({
                type: 'conservatism',
                strength: culturalData.traditionalism,
                description: 'Return to traditional values'
            });
        }

        if (culturalData.openness > 0.7 && culturalData.diversityIndex > 0.6) {
            trends.push({
                type: 'cosmopolitanism',
                strength: culturalData.openness,
                description: 'Embrace of diverse perspectives'
            });
        }

        // Social cohesion trends
        if (culturalData.cohesion < 0.3) {
            trends.push({
                type: 'fragmentation',
                strength: 1 - culturalData.cohesion,
                description: 'Society divides along factional lines'
            });
        }

        if (culturalData.collectivism > 0.7 && culturalData.cohesion > 0.6) {
            trends.push({
                type: 'unity',
                strength: culturalData.collectivism * culturalData.cohesion,
                description: 'Strong communal bonds and shared purpose'
            });
        }

        return trends;
    }

    getEmotionLabel(emotion) {
        // Map VAD to discrete emotion labels (Russell's circumplex model)
        const v = emotion.valence;
        const a = emotion.arousal;
        const d = emotion.dominance;

        if (v > 0.3 && a > 0.3) {
            return d > 0 ? 'triumphant' : 'excited';
        } else if (v > 0.3 && a < -0.3) {
            return d > 0 ? 'content' : 'peaceful';
        } else if (v < -0.3 && a > 0.3) {
            return d > 0 ? 'angry' : 'anxious';
        } else if (v < -0.3 && a < -0.3) {
            return d > 0 ? 'melancholic' : 'depressed';
        } else if (a > 0.5) {
            return 'tense';
        } else if (a < -0.5) {
            return 'lethargic';
        } else {
            return 'neutral';
        }
    }

    calculateSocialTension(emotion, culturalData) {
        // High arousal + low valence + low cohesion = high tension
        const emotionalTension = Math.max(0, emotion.arousal * (1 - emotion.valence));
        const socialFragmentation = 1 - (culturalData.cohesion || 0.5);
        const factionalConflict = Math.min(1, (culturalData.factionDiversity || 1) / 5);

        return (emotionalTension + socialFragmentation + factionalConflict) / 3;
    }

    calculateCulturalMomentum(culturalData) {
        // Rate of cultural change
        const recentEvents = culturalData.events?.filter(e => {
            const eventTime = new Date(e.timestamp);
            const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            return eventTime > weekAgo;
        }).length || 0;

        const movementStrength = culturalData.movements?.reduce((sum, m) => sum + (m.strength || 0), 0) || 0;

        return Math.min(1, (recentEvents * 0.1 + movementStrength * 0.3));
    }

    async update(dt, influences, loreContext) {
        const currentState = await this.getState(influences.gameId);
        const newState = this.applyInfluences(currentState, influences, dt);
        const constrainedState = this.applyLoreConstraints(newState, loreContext);

        await this.saveState(influences.gameId, constrainedState);
        this.cache.delete(influences.gameId);

        return constrainedState;
    }

    applyInfluences(state, influences, dt) {
        const newState = { ...state };

        // Update VAD dimensions
        if (influences.valenceDelta !== undefined) {
            newState.collectiveValence += influences.valenceDelta * dt;
        }
        if (influences.arousalDelta !== undefined) {
            newState.collectiveArousal += influences.arousalDelta * dt;
        }
        if (influences.dominanceDelta !== undefined) {
            newState.collectiveDominance += influences.dominanceDelta * dt;
        }

        // Apply natural decay toward neutral
        newState.collectiveValence *= (1 - this.decayRates.valence * dt);
        newState.collectiveArousal *= (1 - this.decayRates.arousal * dt);
        newState.collectiveDominance *= (1 - this.decayRates.dominance * dt);

        // Clamp values
        newState.collectiveValence = this.clamp(newState.collectiveValence);
        newState.collectiveArousal = this.clamp(newState.collectiveArousal);
        newState.collectiveDominance = this.clamp(newState.collectiveDominance);

        // Update mood label
        newState.mood = this.getEmotionLabel({
            valence: newState.collectiveValence,
            arousal: newState.collectiveArousal,
            dominance: newState.collectiveDominance
        });

        // Apply cultural shifts
        if (influences.culturalShifts) {
            influences.culturalShifts.forEach(shift => {
                if (shift === 'optimism') {
                    newState.openness = Math.min(1, newState.openness + 0.1 * dt);
                } else if (shift === 'unrest') {
                    newState.cohesion = Math.max(0, newState.cohesion - 0.15 * dt);
                    newState.traditionalism = Math.max(0, newState.traditionalism - 0.1 * dt);
                } else if (shift === 'unity') {
                    newState.cohesion = Math.min(1, newState.cohesion + 0.2 * dt);
                    newState.collectivism = Math.min(1, newState.collectivism + 0.1 * dt);
                }
            });
        }

        // Add to emotion history
        newState.emotionHistory.push({
            timestamp: new Date().toISOString(),
            valence: newState.collectiveValence,
            arousal: newState.collectiveArousal,
            dominance: newState.collectiveDominance,
            mood: newState.mood
        });

        // Keep only last 100 entries
        if (newState.emotionHistory.length > 100) {
            newState.emotionHistory = newState.emotionHistory.slice(-100);
        }

        // Recalculate social tension
        newState.socialTension = this.calculateSocialTension(
            {
                valence: newState.collectiveValence,
                arousal: newState.collectiveArousal,
                dominance: newState.collectiveDominance
            },
            newState
        );

        return newState;
    }

    applyLoreConstraints(state, loreContext) {
        const constrained = { ...state };

        if (loreContext.culturalConstraints) {
            // Apply cultural boundaries from lore
            const constraints = loreContext.culturalConstraints;

            if (constraints.maxTraditionalism && constrained.traditionalism > constraints.maxTraditionalism) {
                constrained.traditionalism = constraints.maxTraditionalism;
            }

            if (constraints.minCohesion && constrained.cohesion < constraints.minCohesion) {
                constrained.cohesion = constraints.minCohesion;
            }

            // Prevent certain emotional states based on world rules
            if (constraints.forbiddenMoods && constraints.forbiddenMoods.includes(constrained.mood)) {
                // Adjust VAD to avoid forbidden mood
                constrained.collectiveValence *= 0.8;
                constrained.collectiveArousal *= 0.8;
                constrained.mood = this.getEmotionLabel({
                    valence: constrained.collectiveValence,
                    arousal: constrained.collectiveArousal,
                    dominance: constrained.collectiveDominance
                });
            }
        }

        return constrained;
    }

    async saveState(gameId, state) {
        return new Promise((resolve, reject) => {
            const culturalData = {
                cohesion: state.culturalCohesion,
                traditionalism: state.traditionalism,
                openness: state.openness,
                collectivism: state.collectivism,
                movements: state.activeMovements,
                events: state.culturalEvents,
                emotionHistory: state.emotionHistory,
                culturalMemory: state.culturalMemory,
                lastUpdate: new Date().toISOString()
            };

            const query = `
                UPDATE games
                SET cultural_data = ?
                WHERE id = ?
            `;

            this.db.run(query, [
                JSON.stringify(culturalData),
                gameId
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    clamp(value, min = -1, max = 1) {
        return Math.max(min, Math.min(max, value));
    }

    calculateDiversityIndex(factionCount, population) {
        if (population === 0) return 0;
        // Shannon diversity index adapted for factions
        const maxDiversity = Math.log(Math.max(factionCount, 1));
        return maxDiversity > 0 ? Math.log(factionCount) / maxDiversity : 0;
    }

    getDefaultCulturalData() {
        return {
            cohesion: 0.5,
            traditionalism: 0.5,
            openness: 0.5,
            collectivism: 0.5,
            movements: [],
            events: [],
            emotionHistory: [],
            culturalMemory: []
        };
    }
}

module.exports = CulturalEmotionModel;
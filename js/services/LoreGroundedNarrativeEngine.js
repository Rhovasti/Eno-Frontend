/**
 * Lore-Grounded Narrative Engine
 *
 * A Dynamic Bayesian Network approach to narrative generation that integrates:
 * - Physics/World State (environmental and geographic context)
 * - Motivation/Goals (character and faction objectives)
 * - Emotion/Culture (social dynamics and cultural factors)
 *
 * Based on DBN architecture where each model influences the others dynamically
 */

const fs = require('fs').promises;
const path = require('path');

// Import models
const WorldStateModel = require('./narrative-models/WorldStateModel');
const FunctionalFormalitiesModel = require('./narrative-models/FunctionalFormalitiesModel');
const CulturalEmotionModel = require('./narrative-models/CulturalEmotionModel');
const LoreIntegrationService = require('./LoreIntegrationService');

class DynamicNarrativeNetwork {
    constructor(db, anthropic) {
        this.db = db;
        this.anthropic = anthropic;
        this.timeStep = 0;

        // Core models (inspired by DBN architecture)
        this.worldModel = new WorldStateModel(db);
        this.functionalFormalities = new FunctionalFormalitiesModel(db);
        this.culturalModel = new CulturalEmotionModel(db);

        // Lore integration service
        this.loreService = new LoreIntegrationService(db);

        // History tracking
        this.stateHistory = [];
        this.narrativeHistory = [];
    }

    /**
     * Main update cycle - processes player actions through the DBN
     */
    async generateNarrative(gameId, actions, dt = 1.0) {
        // Get current states from each model
        const worldState = await this.worldModel.getState(gameId);
        const functionalState = await this.functionalFormalities.getState(gameId);
        const culturalState = await this.culturalModel.getState(gameId);

        // Fetch lore context from all sources
        const loreContext = await this.loreService.fetchComprehensiveContext(gameId, actions);

        // Compute cross-model influences (key DBN mechanism)
        const worldInfluence = this.computeWorldInfluence(functionalState, culturalState, actions);
        const functionalInfluence = this.computeFunctionalInfluence(worldState, culturalState, actions);
        const culturalInfluence = this.computeCulturalInfluence(worldState, functionalState, actions);

        // Update each model with influences
        worldInfluence.gameId = gameId;
        functionalInfluence.gameId = gameId;
        culturalInfluence.gameId = gameId;

        await this.worldModel.update(dt, worldInfluence, loreContext);
        await this.functionalFormalities.update(dt, functionalInfluence, loreContext);
        await this.culturalModel.update(dt, culturalInfluence, loreContext);

        // Generate narrative from updated states
        const narrative = await this.synthesizeNarrative(
            gameId,
            {worldState, functionalState, culturalState},
            actions,
            loreContext
        );

        // Update history
        this.stateHistory.push({
            timeStep: this.timeStep,
            worldState,
            functionalState,
            culturalState
        });
        this.narrativeHistory.push(narrative);

        this.timeStep++;

        return narrative;
    }

    /**
     * Compute how Functional Formalities and culture influence the world
     */
    computeWorldInfluence(functionalState, culturalState, actions) {
        const influence = {
            economicChanges: {},
            politicalShifts: {},
            environmentalEffects: {},
            resourceFlows: {}
        };

        // Dominant imperatives affect economic patterns
        if (functionalState.dominantImperative?.imperative === 'Expand') {
            influence.economicChanges.tradeVolume = 1.2; // 20% increase
            influence.resourceFlows.direction = 'outward';
        } else if (functionalState.dominantImperative?.imperative === 'Consume') {
            influence.economicChanges.resourceDemand = 1.3;
            influence.resourceFlows.direction = 'inward';
        }

        // Cultural emotions affect political stability
        if (culturalState.collectiveArousal > 0.7) {
            influence.politicalShifts.stabilityDelta = -0.2;
            influence.politicalShifts.conflictProbability = 0.3;
        }

        // Player actions directly affect world
        actions.forEach(action => {
            if (action.type === 'economic') {
                influence.economicChanges[action.target] = action.magnitude;
            }
        });

        return influence;
    }

    /**
     * Compute how world and culture influence Functional Formalities
     */
    computeFunctionalInfluence(worldState, culturalState, actions) {
        const influence = {
            imperativeShifts: {},
            aspectAdoption: [],
            soulscapeChanges: {}
        };

        // Resource scarcity forces Survive imperative
        if (worldState.resourceAvailability < 0.3) {
            // Characters may shift to Survive imperative
            influence.imperativeShifts = {
                probability: 0.3,
                newImperative: 'Survive',
                trigger: 'resource_scarcity'
            };
        }

        // Cultural turmoil affects soulscapes
        if (culturalState.collectiveArousal > 0.7 && culturalState.collectiveValence < -0.3) {
            influence.soulscapeChanges = {
                newState: 'Inner turmoil - chaos overwhelms peace',
                newQualia: 'A soul witnessing the world\'s descent into disorder'
            };
        }

        // Positive cultural states enable growth
        if (culturalState.collectiveValence > 0.5) {
            influence.aspectAdoption.push({
                aspect: 'Growth',
                ethosShift: 'Positive',
                trigger: 'cultural_optimism'
            });
        }

        return influence;
    }

    /**
     * Compute how world and Functional Formalities influence culture/emotions
     */
    computeCulturalInfluence(worldState, functionalState, actions) {
        const influence = {
            valenceDelta: 0,
            arousalDelta: 0,
            dominanceDelta: 0,
            culturalShifts: []
        };

        // Economic prosperity increases collective valence
        if (worldState.economicHealth > 0.7) {
            influence.valenceDelta = 0.2;
            influence.culturalShifts.push('optimism');
        }

        // Conflicting imperatives create cultural tension
        if (functionalState.emergentPatterns?.some(p => p.type === 'emerging_conflict')) {
            influence.valenceDelta = -0.3;
            influence.arousalDelta = 0.4;
            influence.culturalShifts.push('unrest');
        }

        // Dominant imperatives affect collective mood
        const dominant = functionalState.dominantImperative;
        if (dominant?.imperative === 'Destroy' || dominant?.imperative === 'Consume') {
            influence.valenceDelta = -0.2;
            influence.arousalDelta = 0.3;
            influence.culturalShifts.push('aggression');
        } else if (dominant?.imperative === 'Create' || dominant?.imperative === 'Share') {
            influence.valenceDelta = 0.2;
            influence.dominanceDelta = 0.1;
            influence.culturalShifts.push('harmony');
        }

        // Player actions affecting cultural mood
        const culturalActions = actions.filter(a => a.type === 'cultural' || a.type === 'social');
        culturalActions.forEach(action => {
            if (action.sentiment === 'positive') {
                influence.valenceDelta += 0.1;
            }
        });

        return influence;
    }

    /**
     * Synthesize narrative from all model states using AI
     */
    async synthesizeNarrative(gameId, states, actions, loreContext) {
        // Build comprehensive prompt with all context
        const prompt = this.buildNarrativePrompt(states, actions, loreContext);

        try {
            // Use AI to generate narrative
            const response = await this.anthropic.messages.create({
                model: process.env.AI_MODEL || 'claude-3-haiku-20240307',
                max_tokens: 2000,
                temperature: 0.8,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            });

            const narrative = response.content[0].text;

            // Store the narrative with metadata
            await this.storeNarrative(gameId, narrative, states, actions);

            return {
                content: narrative,
                metadata: {
                    timeStep: this.timeStep,
                    worldState: states.worldState,
                    dominantTheme: this.identifyTheme(states),
                    playerInfluence: this.calculatePlayerInfluence(actions, narrative)
                }
            };

        } catch (error) {
            console.error('Error generating narrative:', error);
            return this.generateFallbackNarrative(states, actions);
        }
    }

    /**
     * Build AI prompt with full lore grounding
     */
    buildNarrativePrompt(states, actions, loreContext) {
        return `You are the narrator for an evolving world. Generate a narrative continuation based on:

WORLD STATE:
- Economic Health: ${states.worldState.economicHealth}
- Political Stability: ${states.worldState.politicalStability}
- Resource Availability: ${states.worldState.resourceAvailability}
- Active Conflicts: ${JSON.stringify(states.worldState.conflicts)}

FUNCTIONAL FORMALITIES:
- Dominant Imperative: ${states.functionalState.dominantImperative?.imperative} (${states.functionalState.dominantImperative?.strength})
- Collective Soulscape: ${states.functionalState.soulscapeState}
- Active Characters: ${states.functionalState.characters?.length || 0}
- Emergent Patterns: ${states.functionalState.emergentPatterns?.map(p => p.type).join(', ') || 'None'}

CULTURAL/EMOTIONAL CLIMATE:
- Collective Mood: ${states.culturalState.mood}
- Social Tension: ${states.culturalState.arousal}
- Cultural Trends: ${JSON.stringify(states.culturalState.trends)}

ESTABLISHED LORE:
${this.formatLoreContext(loreContext)}

RECENT PLAYER ACTIONS:
${this.formatPlayerActions(actions)}

NARRATIVE CONSTRAINTS:
- Maintain consistency with established world facts
- Reflect the current emotional and motivational states
- Show consequences of player actions
- Advance ongoing story arcs
- Include environmental and economic details

Generate a narrative of 300-500 words that weaves these elements together naturally.`;
    }

    formatLoreContext(loreContext) {
        let formatted = '';

        if (loreContext.worldStructure) {
            formatted += `\nWorld Structure:\n${JSON.stringify(loreContext.worldStructure, null, 2)}`;
        }

        if (loreContext.historicalEvents) {
            formatted += `\n\nRelevant History:\n`;
            loreContext.historicalEvents.forEach(event => {
                formatted += `- ${event.date}: ${event.description}\n`;
            });
        }

        if (loreContext.characterRelationships) {
            formatted += `\n\nCharacter Relationships:\n${JSON.stringify(loreContext.characterRelationships, null, 2)}`;
        }

        if (loreContext.economicData) {
            formatted += `\n\nEconomic Context:\n${JSON.stringify(loreContext.economicData, null, 2)}`;
        }

        if (loreContext.geographicContext) {
            formatted += `\n\nGeographic Setting:\n${loreContext.geographicContext}`;
        }

        return formatted;
    }

    formatPlayerActions(actions) {
        return actions.map(action =>
            `- ${action.character_name || action.username}: ${action.content}`
        ).join('\n');
    }

    identifyTheme(states) {
        // Analyze states to identify dominant narrative theme
        if (states.worldState.conflicts.length > 0 && states.culturalState.arousal > 0.6) {
            return 'conflict';
        }
        if (states.motivationState.dominantGoal === 'exploration' && states.culturalState.valence > 0.3) {
            return 'discovery';
        }
        if (states.worldState.economicHealth < 0.3) {
            return 'survival';
        }
        return 'development';
    }

    calculatePlayerInfluence(actions, narrative) {
        // Simple influence calculation - can be made more sophisticated
        const actionWords = actions.map(a => a.content.toLowerCase()).join(' ');
        const narrativeWords = narrative.toLowerCase();

        let matchCount = 0;
        actions.forEach(action => {
            // Check if action concepts appear in narrative
            const keywords = action.content.split(' ').filter(w => w.length > 4);
            keywords.forEach(keyword => {
                if (narrativeWords.includes(keyword.toLowerCase())) {
                    matchCount++;
                }
            });
        });

        return Math.min(matchCount / Math.max(actions.length * 3, 1), 1.0);
    }

    async storeNarrative(gameId, narrative, states, actions) {
        const query = `
            INSERT INTO narrative_history (
                game_id, narrative_content, world_state, motivation_state,
                cultural_state, player_actions, timestamp
            ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;

        return new Promise((resolve, reject) => {
            this.db.run(query, [
                gameId,
                narrative,
                JSON.stringify(states.worldState),
                JSON.stringify(states.functionalState),
                JSON.stringify(states.culturalState),
                JSON.stringify(actions)
            ], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    generateFallbackNarrative(states, actions) {
        // Fallback narrative generation if AI fails
        let narrative = "The world continues to evolve...\n\n";

        if (states.worldState.economicHealth < 0.5) {
            narrative += "Economic pressures mount across the realm. ";
        }

        if (states.motivationState.dominantGoal) {
            narrative += `Factions pursue their goal of ${states.motivationState.dominantGoal}. `;
        }

        if (actions.length > 0) {
            narrative += "Recent events have shaped the course of history: ";
            actions.forEach(action => {
                narrative += `${action.character_name || action.username} acted decisively. `;
            });
        }

        return {
            content: narrative,
            metadata: {
                timeStep: this.timeStep,
                fallback: true
            }
        };
    }
}

module.exports = DynamicNarrativeNetwork;
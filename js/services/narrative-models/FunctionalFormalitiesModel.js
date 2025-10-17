/**
 * Functional Formalities Model
 *
 * Implements Eno's Functional Formalities framework for defining characters,
 * locations, events, and concepts through Form and Function
 *
 * This replaces the simpler MotivationModel with Eno's richer ontology
 */

class FunctionalFormalitiesModel {
    constructor(db) {
        this.db = db;
        this.cache = new Map();

        // Possible Imperatives from Eno lore
        this.IMPERATIVES = [
            'Survive', 'Expand', 'Protect', 'Discover', 'Create',
            'Destroy', 'Transform', 'Preserve', 'Connect', 'Isolate',
            'Dominate', 'Submit', 'Balance', 'Consume', 'Share'
        ];

        // Ethos channels
        this.ETHOS = {
            POSITIVE: 'Positive',    // Affective
            NEUTRAL: 'Neutral',      // Indifferent
            NEGATIVE: 'Negative'     // Aversive
        };

        // Root motivations
        this.ROOTS = [
            'Curiosity', 'Fear', 'Love', 'Hunger', 'Power',
            'Knowledge', 'Freedom', 'Order', 'Chaos', 'Purpose',
            'Vengeance', 'Redemption', 'Growth', 'Decay', 'Unity'
        ];
    }

    /**
     * Get complete Functional Formalities state for a game
     */
    async getState(gameId) {
        const entities = await this.fetchAllEntities(gameId);
        const interactions = this.computeInteractions(entities);
        const emergentPatterns = this.identifyEmergentPatterns(entities, interactions);

        return {
            characters: entities.characters,
            locations: entities.locations,
            events: entities.events,
            concepts: entities.concepts,
            interactions: interactions,
            emergentPatterns: emergentPatterns,
            dominantImperative: this.identifyDominantImperative(entities),
            soulscapeState: this.assessCollectiveSoulscape(entities)
        };
    }

    /**
     * Fetch all entities with their Functional Formalities
     */
    async fetchAllEntities(gameId) {
        const [characters, locations, events, concepts] = await Promise.all([
            this.fetchCharacters(gameId),
            this.fetchLocations(gameId),
            this.fetchEvents(gameId),
            this.fetchConcepts(gameId)
        ]);

        return { characters, locations, events, concepts };
    }

    /**
     * Fetch character entities with full Functional Formalities
     */
    async fetchCharacters(gameId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    ps.user_id,
                    ps.character_name,
                    ps.character_data,
                    ps.influence_score,
                    u.username
                FROM player_sessions ps
                JOIN users u ON ps.user_id = u.id
                WHERE ps.game_id = ? AND ps.session_status = 'active'
            `;

            this.db.all(query, [gameId], (err, rows) => {
                if (err) {
                    console.error('Error fetching characters:', err);
                    resolve([]);
                    return;
                }

                const characters = rows?.map(row => {
                    let characterData = {};
                    try {
                        characterData = row.character_data ? JSON.parse(row.character_data) : {};
                    } catch (e) {
                        console.error('Error parsing character data:', e);
                    }

                    // Extract or generate Functional Formalities
                    const ff = characterData.functionalFormalities || this.generateCharacterFF(row);

                    return {
                        id: row.user_id,
                        name: row.character_name || row.username,
                        influence: row.influence_score || 0,
                        function: {
                            imperative: ff.imperative || 'Survive',
                            ethos: ff.ethos || this.ETHOS.NEUTRAL,
                            root: ff.root || 'Purpose',
                            manner: ff.manner || this.generateManner(ff),
                            interactions: ff.interactions || this.generateInteractions(ff.imperative),
                            adoptedAspects: ff.adoptedAspects || [],
                            qualia: ff.qualia || 'A soul seeking its path',
                            soulscape: ff.soulscape || 'Equilibrium'
                        },
                        form: {
                            legacy: ff.legacy || 'Wanderer',
                            crest: ff.crest || 'Seeker',
                            aspects: ff.aspects || [],
                            archetype: ff.archetype || 'Hero',
                            persona: ff.persona || row.character_name
                        }
                    };
                }) || [];

                resolve(characters);
            });
        });
    }

    /**
     * Fetch location entities
     */
    async fetchLocations(gameId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT location_data
                FROM game_locations
                WHERE game_id = ?
            `;

            this.db.all(query, [gameId], (err, rows) => {
                if (err) {
                    console.error('Error fetching locations:', err);
                    resolve(this.getDefaultLocations());
                    return;
                }

                const locations = rows?.map(row => {
                    let locationData = {};
                    try {
                        locationData = row.location_data ? JSON.parse(row.location_data) : {};
                    } catch (e) {
                        console.error('Error parsing location data:', e);
                    }

                    const ff = locationData.functionalFormalities || this.generateLocationFF(locationData);

                    return {
                        name: locationData.name || 'Unknown Place',
                        function: {
                            imperative: ff.imperative || 'Preserve',
                            ethos: ff.ethos || this.ETHOS.NEUTRAL,
                            root: ff.root || 'Order',
                            manner: ff.manner || this.generateManner(ff),
                            interactions: ff.interactions || this.generateInteractions(ff.imperative),
                            adoptedAspects: ff.adoptedAspects || []
                        },
                        form: {
                            legacy: ff.legacy || 'Valley',  // Geographic region
                            crest: ff.crest || 'Settlement', // Specific place
                            aspects: ff.aspects || [],
                            archetype: ff.archetype || 'Haven',
                            persona: ff.persona || null  // Locations rarely have personas
                        }
                    };
                }) || this.getDefaultLocations();

                resolve(locations);
            });
        });
    }

    /**
     * Fetch event entities from narrative cycles
     */
    async fetchEvents(gameId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    id,
                    cycle_number,
                    key_events,
                    narrative_summary,
                    creation_time
                FROM narrative_cycles
                WHERE game_id = ?
                ORDER BY cycle_number DESC
                LIMIT 5
            `;

            this.db.all(query, [gameId], (err, rows) => {
                if (err) {
                    console.error('Error fetching events:', err);
                    resolve([]);
                    return;
                }

                const events = [];
                rows?.forEach(row => {
                    let keyEvents = [];
                    try {
                        keyEvents = row.key_events ? JSON.parse(row.key_events) : [];
                    } catch (e) {
                        console.error('Error parsing key events:', e);
                    }

                    keyEvents.forEach(event => {
                        const ff = this.generateEventFF(event);
                        events.push({
                            cycleNumber: row.cycle_number,
                            timestamp: row.creation_time,
                            function: {
                                imperative: ff.imperative,
                                ethos: ff.ethos,
                                root: ff.root,
                                manner: ff.manner,
                                interactions: ff.interactions,
                                adoptedAspects: ff.adoptedAspects || []
                            },
                            form: {
                                legacy: 'Current Epoch',  // Time period
                                crest: `Cycle ${row.cycle_number}`, // Specific moment
                                aspects: ff.aspects || [],
                                archetype: ff.archetype || 'Turning Point',
                                persona: null  // Events don't have personas
                            }
                        });
                    });
                });

                resolve(events);
            });
        });
    }

    /**
     * Fetch concept entities (acts, spells, ideas)
     */
    async fetchConcepts(gameId) {
        // For now, return predefined concepts
        // In a full implementation, these would come from a concepts table
        return [
            {
                name: 'Act of Creation',
                function: {
                    imperative: 'Create',
                    ethos: this.ETHOS.POSITIVE,
                    root: 'Purpose',
                    manner: 'Joyfully manifests new possibilities from pure potential',
                    interactions: {
                        attracted: ['Transform', 'Discover'],
                        aversion: ['Destroy', 'Decay'],
                        indifferent: ['Preserve']
                    },
                    adoptedAspects: ['Genesis', 'Potential']
                },
                form: {
                    legacy: 'Methodology of Manifestation',  // School of magic
                    crest: 'Enchantment',  // Spell type
                    aspects: ['Light', 'Order'],
                    archetype: 'The First Act',
                    persona: null  // Most concepts don't have personas
                }
            }
        ];
    }

    /**
     * Generate Functional Formalities for a character
     */
    generateCharacterFF(characterRow) {
        const imperative = this.selectImperative(characterRow);
        const ethos = this.selectEthos(characterRow);
        const root = this.selectRoot(characterRow);

        return {
            imperative,
            ethos,
            root,
            manner: this.generateManner({ imperative, ethos, root }),
            interactions: this.generateInteractions(imperative),
            adoptedAspects: [],
            qualia: this.generateQualia(characterRow),
            soulscape: this.generateSoulscape(ethos, imperative),
            legacy: 'Mortal',
            crest: this.determineCrest(characterRow),
            aspects: [],
            archetype: this.determineArchetype(imperative, root),
            persona: characterRow.character_name
        };
    }

    /**
     * Generate manner description from Function components
     */
    generateManner(ff) {
        const emotions = {
            [this.ETHOS.POSITIVE]: ['Joyfully', 'Eagerly', 'Gracefully', 'Confidently'],
            [this.ETHOS.NEUTRAL]: ['Methodically', 'Calmly', 'Steadily', 'Quietly'],
            [this.ETHOS.NEGATIVE]: ['Grimly', 'Desperately', 'Angrily', 'Fearfully']
        };

        const actions = {
            'Survive': 'endures',
            'Expand': 'grows',
            'Protect': 'shields',
            'Discover': 'explores',
            'Create': 'manifests',
            'Destroy': 'obliterates',
            'Transform': 'changes',
            'Preserve': 'maintains',
            'Connect': 'unites',
            'Isolate': 'separates',
            'Dominate': 'controls',
            'Submit': 'yields',
            'Balance': 'harmonizes',
            'Consume': 'devours',
            'Share': 'distributes'
        };

        const emotion = emotions[ff.ethos]?.[Math.floor(Math.random() * emotions[ff.ethos].length)] || 'Purposefully';
        const action = actions[ff.imperative] || 'acts upon';
        const object = 'the world';
        const purpose = `to fulfill their ${ff.root}`;

        return `${emotion} ${action} ${object} ${purpose}`;
    }

    /**
     * Generate interactions based on imperative
     */
    generateInteractions(imperative) {
        const interactionMap = {
            'Survive': {
                attracted: ['Protect', 'Share', 'Connect'],
                aversion: ['Destroy', 'Consume', 'Isolate'],
                indifferent: ['Create', 'Transform']
            },
            'Expand': {
                attracted: ['Consume', 'Transform', 'Discover'],
                aversion: ['Preserve', 'Isolate', 'Submit'],
                indifferent: ['Balance', 'Protect']
            },
            'Protect': {
                attracted: ['Preserve', 'Connect', 'Balance'],
                aversion: ['Destroy', 'Consume', 'Chaos'],
                indifferent: ['Expand', 'Discover']
            },
            'Discover': {
                attracted: ['Transform', 'Create', 'Expand'],
                aversion: ['Preserve', 'Isolate', 'Submit'],
                indifferent: ['Protect', 'Dominate']
            },
            'Create': {
                attracted: ['Transform', 'Discover', 'Share'],
                aversion: ['Destroy', 'Consume', 'Decay'],
                indifferent: ['Preserve', 'Isolate']
            }
        };

        return interactionMap[imperative] || {
            attracted: ['Balance'],
            aversion: ['Chaos'],
            indifferent: ['Order']
        };
    }

    /**
     * Compute interactions between all entities
     */
    computeInteractions(entities) {
        const interactions = [];

        // Character-Character interactions
        entities.characters.forEach(char1 => {
            entities.characters.forEach(char2 => {
                if (char1.id !== char2.id) {
                    const affinity = this.calculateAffinity(
                        char1.function.imperative,
                        char2.function.imperative,
                        char1.function.interactions
                    );

                    if (affinity !== 0) {
                        interactions.push({
                            source: char1.name,
                            target: char2.name,
                            type: affinity > 0 ? 'attraction' : 'aversion',
                            strength: Math.abs(affinity)
                        });
                    }
                }
            });
        });

        // Character-Location interactions
        entities.characters.forEach(char => {
            entities.locations.forEach(loc => {
                const affinity = this.calculateAffinity(
                    char.function.imperative,
                    loc.function.imperative,
                    char.function.interactions
                );

                if (affinity !== 0) {
                    interactions.push({
                        source: char.name,
                        target: loc.name,
                        type: affinity > 0 ? 'drawn_to' : 'repelled_by',
                        strength: Math.abs(affinity)
                    });
                }
            });
        });

        return interactions;
    }

    /**
     * Calculate affinity between imperatives
     */
    calculateAffinity(imperative1, imperative2, interactions) {
        if (interactions.attracted?.includes(imperative2)) {
            return 1.0;
        } else if (interactions.aversion?.includes(imperative2)) {
            return -1.0;
        } else if (interactions.indifferent?.includes(imperative2)) {
            return 0;
        }

        // Default slight attraction to similar imperatives
        return imperative1 === imperative2 ? 0.3 : 0;
    }

    /**
     * Identify emergent patterns from entity interactions
     */
    identifyEmergentPatterns(entities, interactions) {
        const patterns = [];

        // Check for faction formation (multiple characters with same imperative)
        const imperativeGroups = {};
        entities.characters.forEach(char => {
            const imp = char.function.imperative;
            if (!imperativeGroups[imp]) imperativeGroups[imp] = [];
            imperativeGroups[imp].push(char);
        });

        Object.entries(imperativeGroups).forEach(([imperative, chars]) => {
            if (chars.length >= 2) {
                patterns.push({
                    type: 'faction_formation',
                    imperative: imperative,
                    strength: chars.length / entities.characters.length,
                    description: `Multiple souls united by ${imperative}`
                });
            }
        });

        // Check for conflict patterns
        const conflicts = interactions.filter(i => i.type === 'aversion' && i.strength > 0.7);
        if (conflicts.length > 0) {
            patterns.push({
                type: 'emerging_conflict',
                strength: conflicts.length / Math.max(interactions.length, 1),
                description: 'Tensions rise from incompatible imperatives'
            });
        }

        // Check for harmony patterns
        const harmonies = interactions.filter(i => i.type === 'attraction' && i.strength > 0.7);
        if (harmonies.length > interactions.length * 0.3) {
            patterns.push({
                type: 'convergence',
                strength: harmonies.length / interactions.length,
                description: 'Souls find common purpose'
            });
        }

        return patterns;
    }

    /**
     * Identify the dominant imperative across all entities
     */
    identifyDominantImperative(entities) {
        const imperativeCounts = {};
        let totalInfluence = 0;

        // Weight by character influence
        entities.characters.forEach(char => {
            const imp = char.function.imperative;
            const influence = char.influence || 1;
            imperativeCounts[imp] = (imperativeCounts[imp] || 0) + influence;
            totalInfluence += influence;
        });

        // Add location imperatives with less weight
        entities.locations.forEach(loc => {
            const imp = loc.function.imperative;
            imperativeCounts[imp] = (imperativeCounts[imp] || 0) + 0.5;
            totalInfluence += 0.5;
        });

        let dominant = 'Balance';
        let maxInfluence = 0;

        Object.entries(imperativeCounts).forEach(([imp, influence]) => {
            if (influence > maxInfluence) {
                maxInfluence = influence;
                dominant = imp;
            }
        });

        return {
            imperative: dominant,
            strength: maxInfluence / Math.max(totalInfluence, 1)
        };
    }

    /**
     * Assess the collective soulscape state
     */
    assessCollectiveSoulscape(entities) {
        let turmoil = 0;
        let peace = 0;
        let transformation = 0;

        entities.characters.forEach(char => {
            const soulscape = char.function.soulscape;
            if (soulscape.includes('turmoil') || soulscape.includes('conflict')) {
                turmoil++;
            } else if (soulscape.includes('peace') || soulscape.includes('equilibrium')) {
                peace++;
            } else if (soulscape.includes('transform') || soulscape.includes('change')) {
                transformation++;
            }
        });

        const total = Math.max(turmoil + peace + transformation, 1);

        if (turmoil / total > 0.5) {
            return 'Collective Turmoil - The world churns with conflict';
        } else if (peace / total > 0.5) {
            return 'Collective Peace - Harmony prevails across souls';
        } else if (transformation / total > 0.3) {
            return 'Collective Transformation - Change ripples through reality';
        } else {
            return 'Dynamic Equilibrium - Forces in constant flux';
        }
    }

    /**
     * Update state with influences
     */
    async update(dt, influences, loreContext) {
        const currentState = await this.getState(influences.gameId);
        const newState = this.applyInfluences(currentState, influences, dt);
        const constrainedState = this.applyLoreConstraints(newState, loreContext);

        await this.saveState(influences.gameId, constrainedState);
        this.cache.delete(influences.gameId);

        return constrainedState;
    }

    /**
     * Apply influences to Functional Formalities
     */
    applyInfluences(state, influences, dt) {
        const newState = { ...state };

        // Update character imperatives based on influences
        if (influences.imperativeShifts) {
            newState.characters.forEach(char => {
                const shift = influences.imperativeShifts[char.id];
                if (shift && Math.random() < shift.probability * dt) {
                    char.function.imperative = shift.newImperative;
                    char.function.interactions = this.generateInteractions(shift.newImperative);
                    char.function.manner = this.generateManner(char.function);
                }
            });
        }

        // Adopt new aspects based on interactions
        if (influences.aspectAdoption) {
            influences.aspectAdoption.forEach(adoption => {
                const target = newState.characters.find(c => c.id === adoption.targetId);
                if (target && !target.function.adoptedAspects.includes(adoption.aspect)) {
                    target.function.adoptedAspects.push(adoption.aspect);

                    // Aspects can change ethos
                    if (adoption.ethosShift) {
                        target.function.ethos = adoption.ethosShift;
                    }
                }
            });
        }

        // Update soulscapes based on events
        if (influences.soulscapeChanges) {
            newState.characters.forEach(char => {
                const change = influences.soulscapeChanges[char.id];
                if (change) {
                    char.function.soulscape = change.newState;
                    char.function.qualia = change.newQualia || char.function.qualia;
                }
            });
        }

        return newState;
    }

    // Helper methods for generation
    selectImperative(data) {
        // Logic to select appropriate imperative based on character data
        if (data.influence_score > 70) return 'Dominate';
        if (data.influence_score < 30) return 'Survive';
        return this.IMPERATIVES[Math.floor(Math.random() * this.IMPERATIVES.length)];
    }

    selectEthos(data) {
        // Determine ethos based on character actions/history
        return this.ETHOS.NEUTRAL;
    }

    selectRoot(data) {
        // Select root motivation
        return this.ROOTS[Math.floor(Math.random() * this.ROOTS.length)];
    }

    generateQualia(data) {
        return `A ${data.character_name || 'soul'} perceiving reality through the lens of their experiences`;
    }

    generateSoulscape(ethos, imperative) {
        if (ethos === this.ETHOS.NEGATIVE) {
            return 'Inner turmoil - shadows dance with light';
        } else if (ethos === this.ETHOS.POSITIVE) {
            return 'Radiant peace - purpose illuminates the path';
        }
        return 'Balanced equilibrium - forces in harmony';
    }

    determineCrest(data) {
        // Determine role/crest based on character data
        if (data.influence_score > 70) return 'Leader';
        if (data.influence_score > 40) return 'Advisor';
        return 'Wanderer';
    }

    determineArchetype(imperative, root) {
        const archetypeMap = {
            'Survive_Fear': 'Survivor',
            'Expand_Power': 'Conqueror',
            'Protect_Love': 'Guardian',
            'Discover_Curiosity': 'Explorer',
            'Create_Purpose': 'Creator'
        };

        return archetypeMap[`${imperative}_${root}`] || 'Seeker';
    }

    generateLocationFF(locationData) {
        return {
            imperative: 'Preserve',
            ethos: this.ETHOS.NEUTRAL,
            root: 'Order',
            manner: 'Steadfastly maintains the boundaries of reality',
            interactions: this.generateInteractions('Preserve'),
            adoptedAspects: locationData.aspects || [],
            legacy: locationData.region || 'Unknown Valley',
            crest: locationData.name || 'Settlement',
            aspects: [],
            archetype: 'Nexus',
            persona: null
        };
    }

    generateEventFF(eventData) {
        // Determine imperative based on event type
        let imperative = 'Transform';
        if (eventData.type === 'conflict') imperative = 'Destroy';
        if (eventData.type === 'alliance') imperative = 'Connect';
        if (eventData.type === 'discovery') imperative = 'Discover';

        return {
            imperative,
            ethos: this.ETHOS.NEUTRAL,
            root: 'Purpose',
            manner: this.generateManner({ imperative, ethos: this.ETHOS.NEUTRAL, root: 'Purpose' }),
            interactions: this.generateInteractions(imperative),
            adoptedAspects: [],
            aspects: [],
            archetype: 'Catalyst'
        };
    }

    getDefaultLocations() {
        return [{
            name: 'The Crossroads',
            function: {
                imperative: 'Connect',
                ethos: this.ETHOS.NEUTRAL,
                root: 'Unity',
                manner: 'Perpetually draws wanderers to converge',
                interactions: this.generateInteractions('Connect'),
                adoptedAspects: []
            },
            form: {
                legacy: 'Central Valley',
                crest: 'Meeting Place',
                aspects: ['Convergence', 'Choice'],
                archetype: 'Nexus',
                persona: null
            }
        }];
    }

    async saveState(gameId, state) {
        // Save character Functional Formalities
        const characterPromises = state.characters.map(char => {
            return new Promise((resolve, reject) => {
                const query = `
                    UPDATE player_sessions
                    SET character_data = json_set(
                        COALESCE(character_data, '{}'),
                        '$.functionalFormalities',
                        json(?)
                    )
                    WHERE user_id = ? AND game_id = ?
                `;

                this.db.run(query, [
                    JSON.stringify({
                        imperative: char.function.imperative,
                        ethos: char.function.ethos,
                        root: char.function.root,
                        manner: char.function.manner,
                        interactions: char.function.interactions,
                        adoptedAspects: char.function.adoptedAspects,
                        qualia: char.function.qualia,
                        soulscape: char.function.soulscape,
                        legacy: char.form.legacy,
                        crest: char.form.crest,
                        aspects: char.form.aspects,
                        archetype: char.form.archetype,
                        persona: char.form.persona
                    }),
                    char.id,
                    gameId
                ], err => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        await Promise.all(characterPromises);
    }
}

module.exports = FunctionalFormalitiesModel;
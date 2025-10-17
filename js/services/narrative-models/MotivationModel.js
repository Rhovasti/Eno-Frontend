/**
 * Motivation Model
 *
 * Tracks goals, objectives, and functional formalities of factions/characters
 * Based on the "Functional Formalities" concept from DBN
 */

class MotivationModel {
    constructor(db) {
        this.db = db;
        this.cache = new Map();
    }

    async getState(gameId) {
        // Fetch all active motivations for the game
        const factionGoals = await this.fetchFactionGoals(gameId);
        const characterObjectives = await this.fetchCharacterObjectives(gameId);
        const emergentGoals = this.computeEmergentGoals(factionGoals, characterObjectives);

        return {
            factionGoals,
            characterObjectives,
            emergentGoals,
            dominantGoal: this.identifyDominantGoal(factionGoals, emergentGoals),
            goalSatisfaction: this.calculateOverallSatisfaction(factionGoals, characterObjectives),
            objectives: this.consolidateObjectives(factionGoals, characterObjectives),
            functionalFormalities: this.computeFunctionalFormalities(factionGoals)
        };
    }

    async fetchFactionGoals(gameId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT
                    f.id,
                    f.name,
                    f.goals,
                    f.resources,
                    f.influence,
                    COUNT(ps.user_id) as member_count
                FROM factions f
                LEFT JOIN player_sessions ps ON ps.faction_id = f.id
                WHERE f.game_id = ?
                GROUP BY f.id
            `;

            this.db.all(query, [gameId], (err, rows) => {
                if (err) {
                    console.error('Error fetching faction goals:', err);
                    resolve(this.getDefaultFactionGoals());
                    return;
                }

                const goals = rows?.map(row => {
                    let parsedGoals = {};
                    try {
                        parsedGoals = row.goals ? JSON.parse(row.goals) : {};
                    } catch (e) {
                        console.error('Error parsing faction goals:', e);
                    }

                    return {
                        factionId: row.id,
                        factionName: row.name,
                        goals: parsedGoals,
                        resources: row.resources || 0,
                        influence: row.influence || 0,
                        memberCount: row.member_count || 0,
                        priority: this.calculateGoalPriority(parsedGoals, row.resources, row.influence)
                    };
                }) || this.getDefaultFactionGoals();

                resolve(goals);
            });
        });
    }

    async fetchCharacterObjectives(gameId) {
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
                    console.error('Error fetching character objectives:', err);
                    resolve([]);
                    return;
                }

                const objectives = rows?.map(row => {
                    let characterData = {};
                    try {
                        characterData = row.character_data ? JSON.parse(row.character_data) : {};
                    } catch (e) {
                        console.error('Error parsing character data:', e);
                    }

                    return {
                        userId: row.user_id,
                        characterName: row.character_name || row.username,
                        personalGoals: characterData.goals || this.generatePersonalGoals(),
                        influence: row.influence_score || 0,
                        alignment: characterData.alignment || 'neutral'
                    };
                }) || [];

                resolve(objectives);
            });
        });
    }

    computeEmergentGoals(factionGoals, characterObjectives) {
        const emergent = [];

        // Check for goal convergence
        const goalFrequency = {};
        factionGoals.forEach(faction => {
            Object.keys(faction.goals || {}).forEach(goal => {
                goalFrequency[goal] = (goalFrequency[goal] || 0) + 1;
            });
        });

        // If multiple factions share a goal, it becomes emergent
        Object.entries(goalFrequency).forEach(([goal, count]) => {
            if (count >= 2) {
                emergent.push({
                    type: goal,
                    strength: count / Math.max(factionGoals.length, 1),
                    description: `Multiple factions pursue ${goal}`
                });
            }
        });

        // Check for conflicting goals that create emergent tensions
        if (this.hasConflictingGoals(factionGoals)) {
            emergent.push({
                type: 'conflict_resolution',
                strength: 0.8,
                description: 'Tensions arise from conflicting faction goals'
            });
        }

        return emergent;
    }

    identifyDominantGoal(factionGoals, emergentGoals) {
        let dominantGoal = null;
        let maxPriority = 0;

        // Check faction goals
        factionGoals.forEach(faction => {
            Object.entries(faction.goals || {}).forEach(([goal, data]) => {
                const priority = (data.priority || 0) * faction.influence;
                if (priority > maxPriority) {
                    maxPriority = priority;
                    dominantGoal = goal;
                }
            });
        });

        // Check if emergent goals override
        emergentGoals.forEach(goal => {
            if (goal.strength > 0.7 && goal.strength > maxPriority) {
                dominantGoal = goal.type;
            }
        });

        return dominantGoal || 'survival';
    }

    calculateOverallSatisfaction(factionGoals, characterObjectives) {
        let totalSatisfaction = 0;
        let totalWeight = 0;

        factionGoals.forEach(faction => {
            Object.values(faction.goals || {}).forEach(goal => {
                const satisfaction = goal.satisfaction || 0.5;
                const weight = faction.influence || 1;
                totalSatisfaction += satisfaction * weight;
                totalWeight += weight;
            });
        });

        characterObjectives.forEach(character => {
            Object.values(character.personalGoals || {}).forEach(goal => {
                const satisfaction = goal.satisfaction || 0.5;
                const weight = character.influence || 0.5;
                totalSatisfaction += satisfaction * weight;
                totalWeight += weight;
            });
        });

        return totalWeight > 0 ? totalSatisfaction / totalWeight : 0.5;
    }

    consolidateObjectives(factionGoals, characterObjectives) {
        const objectives = [];

        // Add faction objectives
        factionGoals.forEach(faction => {
            Object.entries(faction.goals || {}).forEach(([goalType, goalData]) => {
                objectives.push({
                    source: `faction:${faction.factionName}`,
                    type: goalType,
                    priority: goalData.priority || 0.5,
                    satisfaction: goalData.satisfaction || 0.5,
                    description: goalData.description || `${faction.factionName} seeks ${goalType}`
                });
            });
        });

        // Add character objectives
        characterObjectives.forEach(character => {
            Object.entries(character.personalGoals || {}).forEach(([goalType, goalData]) => {
                objectives.push({
                    source: `character:${character.characterName}`,
                    type: goalType,
                    priority: goalData.priority || 0.3,
                    satisfaction: goalData.satisfaction || 0.5,
                    description: goalData.description || `${character.characterName} pursues ${goalType}`
                });
            });
        });

        // Sort by priority
        objectives.sort((a, b) => b.priority - a.priority);

        return objectives;
    }

    computeFunctionalFormalities(factionGoals) {
        // Implement the "Functional Formalities" concept
        // This represents the formal structures and procedures that emerge from goals

        const formalities = {
            economicSystems: [],
            politicalStructures: [],
            socialContracts: [],
            culturalNorms: []
        };

        factionGoals.forEach(faction => {
            const goals = faction.goals || {};

            // Economic formalities emerge from trade/resource goals
            if (goals.trade || goals.wealth || goals.resources) {
                formalities.economicSystems.push({
                    type: 'market',
                    strength: faction.influence,
                    description: `${faction.factionName} establishes trade networks`
                });
            }

            // Political formalities from power/control goals
            if (goals.power || goals.control || goals.dominance) {
                formalities.politicalStructures.push({
                    type: 'hierarchy',
                    strength: faction.influence,
                    description: `${faction.factionName} enforces political order`
                });
            }

            // Social contracts from cooperation/alliance goals
            if (goals.alliance || goals.cooperation || goals.unity) {
                formalities.socialContracts.push({
                    type: 'treaty',
                    strength: faction.influence,
                    description: `${faction.factionName} seeks diplomatic bonds`
                });
            }

            // Cultural norms from tradition/identity goals
            if (goals.tradition || goals.culture || goals.identity) {
                formalities.culturalNorms.push({
                    type: 'customs',
                    strength: faction.influence,
                    description: `${faction.factionName} preserves cultural heritage`
                });
            }
        });

        return formalities;
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

        // Apply goal priority shifts
        if (influences.goalPriorityShifts) {
            newState.objectives.forEach(objective => {
                if (influences.goalPriorityShifts[objective.type]) {
                    objective.priority *= influences.goalPriorityShifts[objective.type];
                    objective.priority = Math.min(1.0, objective.priority);
                }
            });
        }

        // Add new objectives
        if (influences.newObjectives) {
            influences.newObjectives.forEach(newObj => {
                newState.objectives.push({
                    source: 'emergent',
                    type: newObj.type,
                    priority: newObj.priority,
                    satisfaction: 0,
                    description: newObj.description || `New objective: ${newObj.type}`
                });
            });
        }

        // Update satisfaction deltas
        if (influences.satisfactionDeltas) {
            Object.entries(influences.satisfactionDeltas).forEach(([goalType, delta]) => {
                newState.objectives
                    .filter(obj => obj.type === goalType)
                    .forEach(obj => {
                        obj.satisfaction += delta * dt;
                        obj.satisfaction = Math.max(0, Math.min(1, obj.satisfaction));
                    });
            });
        }

        // Recompute dominant goal
        newState.dominantGoal = this.identifyDominantGoal(
            newState.factionGoals,
            newState.emergentGoals
        );

        return newState;
    }

    applyLoreConstraints(state, loreContext) {
        const constrained = { ...state };

        if (loreContext.factionConstraints) {
            // Ensure goals align with faction lore
            constrained.factionGoals = constrained.factionGoals.map(faction => {
                const constraints = loreContext.factionConstraints[faction.factionName];
                if (constraints) {
                    // Filter out forbidden goals
                    if (constraints.forbiddenGoals) {
                        Object.keys(faction.goals).forEach(goal => {
                            if (constraints.forbiddenGoals.includes(goal)) {
                                delete faction.goals[goal];
                            }
                        });
                    }
                    // Enforce required goals
                    if (constraints.requiredGoals) {
                        constraints.requiredGoals.forEach(goal => {
                            if (!faction.goals[goal]) {
                                faction.goals[goal] = {
                                    priority: 0.7,
                                    satisfaction: 0.3,
                                    description: `Required by faction nature`
                                };
                            }
                        });
                    }
                }
                return faction;
            });
        }

        return constrained;
    }

    async saveState(gameId, state) {
        // Save faction goals
        const factionPromises = state.factionGoals.map(faction => {
            return new Promise((resolve, reject) => {
                const query = `
                    UPDATE factions
                    SET goals = ?
                    WHERE id = ? AND game_id = ?
                `;
                this.db.run(query, [
                    JSON.stringify(faction.goals),
                    faction.factionId,
                    gameId
                ], err => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        // Save character objectives
        const characterPromises = state.characterObjectives.map(character => {
            return new Promise((resolve, reject) => {
                const query = `
                    UPDATE player_sessions
                    SET character_data = json_set(
                        COALESCE(character_data, '{}'),
                        '$.goals',
                        json(?)
                    )
                    WHERE user_id = ? AND game_id = ?
                `;
                this.db.run(query, [
                    JSON.stringify(character.personalGoals),
                    character.userId,
                    gameId
                ], err => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        await Promise.all([...factionPromises, ...characterPromises]);
    }

    calculateGoalPriority(goals, resources, influence) {
        // Complex priority calculation based on multiple factors
        let basePriority = 0.5;

        if (resources < 30) {
            // Low resources increase survival priority
            if (goals.survival) basePriority += 0.3;
        }

        if (influence > 70) {
            // High influence enables expansion goals
            if (goals.expansion) basePriority += 0.2;
        }

        return Math.min(1.0, basePriority);
    }

    generatePersonalGoals() {
        // Generate default personal goals for characters
        return {
            survival: {
                priority: 0.8,
                satisfaction: 0.6,
                description: 'Stay alive and prosper'
            },
            advancement: {
                priority: 0.6,
                satisfaction: 0.3,
                description: 'Gain power and influence'
            },
            discovery: {
                priority: 0.4,
                satisfaction: 0.5,
                description: 'Explore and learn'
            }
        };
    }

    getDefaultFactionGoals() {
        return [{
            factionId: 'default',
            factionName: 'Independent',
            goals: {
                survival: { priority: 0.9, satisfaction: 0.5 },
                prosperity: { priority: 0.7, satisfaction: 0.4 },
                security: { priority: 0.8, satisfaction: 0.6 }
            },
            resources: 50,
            influence: 30,
            memberCount: 1,
            priority: 0.5
        }];
    }

    hasConflictingGoals(factionGoals) {
        const conflictPairs = [
            ['expansion', 'peace'],
            ['dominance', 'cooperation'],
            ['tradition', 'innovation'],
            ['isolation', 'trade']
        ];

        for (const [goal1, goal2] of conflictPairs) {
            const hasGoal1 = factionGoals.some(f => f.goals && f.goals[goal1]);
            const hasGoal2 = factionGoals.some(f => f.goals && f.goals[goal2]);
            if (hasGoal1 && hasGoal2) {
                return true;
            }
        }

        return false;
    }
}

module.exports = MotivationModel;
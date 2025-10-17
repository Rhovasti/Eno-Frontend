/**
 * Asynchronous Game Session Management System
 *
 * Handles long-running, play-by-post narrative games with:
 * - Player contribution windows and scheduling
 * - Narrative cycle processing
 * - Turn management and state persistence
 * - Player engagement tracking
 * - Lore-grounded narrative generation
 */

// Import the lore-grounded narrative engine if available (exported as DynamicNarrativeNetwork)
let LoreGroundedNarrativeEngine = null;
if (typeof require !== 'undefined') {
    try {
        // The file exports DynamicNarrativeNetwork class
        LoreGroundedNarrativeEngine = require('./LoreGroundedNarrativeEngine');
    } catch (e) {
        console.log('LoreGroundedNarrativeEngine not available via require, will check global scope');
    }
}

class AsyncGameManager {
    constructor(db) {
        this.db = db;
        this.narrativeCycleTimers = new Map(); // Track active cycle timers
        this.playerNotificationQueue = [];

        // Initialize the lore-grounded narrative engine if available
        this.narrativeEngine = null;
        if (typeof LoreGroundedNarrativeEngine !== 'undefined') {
            try {
                this.narrativeEngine = new LoreGroundedNarrativeEngine(db);
                console.log('AsyncGameManager: LoreGroundedNarrativeEngine integrated successfully');
            } catch (error) {
                console.error('AsyncGameManager: Failed to initialize LoreGroundedNarrativeEngine:', error);
            }
        } else {
            console.log('AsyncGameManager: Using template-based narrative generation (LoreGroundedNarrativeEngine not available)');
        }
    }

    /**
     * Create a new asynchronous game with enhanced session management
     */
    async createAsyncGame(gameData) {
        const {
            name,
            description,
            gm_id,
            session_type = 'async',
            turn_frequency = 'daily',
            contribution_window_hours = 24,
            max_players = 6,
            auto_advance_turns = true,
            narrative_style = 'collaborative',
            expected_duration_weeks = 12,
            enrollment_deadline = null
        } = gameData;

        const self = this;
        return new Promise((resolve, reject) => {
            self.db.serialize(() => {
                self.db.run('BEGIN TRANSACTION');

                // Create the game
                const gameQuery = `
                    INSERT INTO games (
                        name, description, gm_id, game_state, session_type,
                        turn_frequency, contribution_window_hours, max_inactive_days,
                        auto_advance_turns, narrative_style, expected_duration_weeks,
                        enrollment_deadline, max_players
                    ) VALUES (?, ?, ?, 'recruiting', ?, ?, ?, 7, ?, ?, ?, ?, ?)
                `;
                self.db.run(gameQuery, [
                    name, description, gm_id, session_type, turn_frequency,
                    contribution_window_hours, auto_advance_turns, narrative_style,
                    expected_duration_weeks, enrollment_deadline, max_players
                ], function(err) {
                    if (err) {
                        self.db.run('ROLLBACK');
                        return reject(err);
                    }

                    const gameId = this.lastID;

                    // Create initial game session
                    const sessionQuery = `
                        INSERT INTO game_sessions (
                            game_id, session_phase, session_data
                        ) VALUES (?, 'recruitment', '{"recruitment_started": true}')
                    `;

                    self.db.run(sessionQuery, [gameId], (err) => {
                        if (err) {
                            self.db.run('ROLLBACK');
                            return reject(err);
                        }

                        // Add GM as initial player session
                        const playerSessionQuery = `
                            INSERT INTO player_sessions (
                                game_id, user_id, session_status, character_name, influence_score
                            ) VALUES (?, ?, 'active', 'Game Master', 200)
                        `;

                        self.db.run(playerSessionQuery, [gameId, gm_id], (err) => {
                            if (err) {
                                self.db.run('ROLLBACK');
                                return reject(err);
                            }

                            self.db.run('COMMIT');

                            // Schedule initial narrative cycle if auto-advance is enabled
                            if (auto_advance_turns) {
                                self.scheduleNextNarrativeCycle(gameId).catch(console.error);
                            }

                            resolve({ gameId, message: 'Async game created successfully' });
                        });
                    });
                });
            });
        });
    }

    /**
     * Add a player to an async game
     */
    async addPlayerToGame(gameId, userId, characterData = {}) {
        return new Promise((resolve, reject) => {
            // First check if game is accepting players
            this.db.get('SELECT * FROM games WHERE id = ? AND game_state IN ("recruiting", "active")', 
                [gameId], (err, game) => {
                if (err) return reject(err);
                if (!game) return reject(new Error('Game not found or not accepting players'));

                // Check if player is already in game
                this.db.get('SELECT * FROM player_sessions WHERE game_id = ? AND user_id = ?', 
                    [gameId, userId], (err, existing) => {
                    if (err) return reject(err);
                    if (existing) return reject(new Error('Player already in game'));

                    // Count current active players
                    this.db.get('SELECT COUNT(*) as count FROM player_sessions WHERE game_id = ? AND session_status = "active"',
                        [gameId], (err, result) => {
                        if (err) return reject(err);
                        if (result.count >= game.max_players) {
                            return reject(new Error('Game is full'));
                        }

                        // Add player
                        const query = `
                            INSERT INTO player_sessions (
                                game_id, user_id, session_status, character_name, character_data
                            ) VALUES (?, ?, 'active', ?, ?)
                        `;

                        this.db.run(query, [
                            gameId, userId, 'active', 
                            characterData.name || 'Unnamed Character',
                            JSON.stringify(characterData)
                        ], function(err) {
                            if (err) return reject(err);
                            resolve({ 
                                playerId: this.lastID, 
                                message: 'Player added to game successfully' 
                            });
                        });
                    });
                });
            });
        });
    }

    /**
     * Submit a player action during a contribution window
     */
    async submitPlayerAction(gameId, userId, actionData) {
        const {
            action_type,
            action_content,
            action_priority = 5,
            target_entity = null,
            chapter_id = null,
            beat_id = null
        } = actionData;

        return new Promise((resolve, reject) => {
            // Check if game is accepting contributions
            this.db.get(`
                SELECT g.*, gs.session_phase 
                FROM games g
                JOIN game_sessions gs ON g.id = gs.game_id
                WHERE g.id = ? AND g.game_state = 'active'
            `, [gameId], (err, game) => {
                if (err) return reject(err);
                if (!game) return reject(new Error('Game not found or not active'));

                // Verify player is in game
                this.db.get('SELECT * FROM player_sessions WHERE game_id = ? AND user_id = ? AND session_status = "active"',
                    [gameId, userId], (err, player) => {
                    if (err) return reject(err);
                    if (!player) return reject(new Error('Player not in game or inactive'));

                    // Submit action
                    const query = `
                        INSERT INTO player_actions (
                            game_id, user_id, chapter_id, beat_id, action_type,
                            action_content, action_priority, target_entity
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    this.db.run(query, [
                        gameId, userId, chapter_id, beat_id, action_type,
                        action_content, action_priority, target_entity
                    ], function(err) {
                        if (err) return reject(err);
                        resolve({ 
                            actionId: this.lastID, 
                            message: 'Action submitted successfully' 
                        });
                    });
                });
            });
        });
    }

    /**
     * Schedule the next narrative cycle for a game
     */
    async scheduleNextNarrativeCycle(gameId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, game) => {
                if (err) return reject(err);
                if (!game) return reject(new Error('Game not found'));

                // Calculate next cycle timing based on frequency
                const now = new Date();
                let nextCycle = new Date(now);
                let inputDeadline = new Date(now);

                switch (game.turn_frequency) {
                    case 'hourly':
                        nextCycle.setHours(nextCycle.getHours() + 1);
                        inputDeadline.setMinutes(inputDeadline.getMinutes() + 50); // 10 min buffer
                        break;
                    case 'daily':
                        nextCycle.setDate(nextCycle.getDate() + 1);
                        inputDeadline.setHours(inputDeadline.getHours() + 20); // 4 hour buffer
                        break;
                    case 'weekly':
                        nextCycle.setDate(nextCycle.getDate() + 7);
                        inputDeadline.setDate(inputDeadline.getDate() + 6);
                        break;
                    default:
                        return reject(new Error('Invalid turn frequency'));
                }

                // Get current cycle number
                this.db.get('SELECT MAX(cycle_number) as max_cycle FROM narrative_cycles WHERE game_id = ?',
                    [gameId], (err, result) => {
                    if (err) return reject(err);
                    const cycleNumber = (result.max_cycle || 0) + 1;

                    // Create narrative cycle
                    const query = `
                        INSERT INTO narrative_cycles (
                            game_id, cycle_number, scheduled_start, input_deadline
                        ) VALUES (?, ?, ?, ?)
                    `;

                    this.db.run(query, [gameId, cycleNumber, nextCycle.toISOString(), inputDeadline.toISOString()],
                        function(err) {
                        if (err) return reject(err);

                        // Update game with next cycle time
                        this.db.run('UPDATE games SET next_narrative_cycle = ? WHERE id = ?',
                            [nextCycle.toISOString(), gameId], (err) => {
                            if (err) return reject(err);

                            // Schedule the actual processing
                            const timeUntilCycle = nextCycle.getTime() - now.getTime();
                            const timer = setTimeout(() => {
                                this.processNarrativeCycle(gameId, this.lastID).catch(console.error);
                            }, Math.max(timeUntilCycle, 1000)); // At least 1 second delay

                            this.narrativeCycleTimers.set(gameId, timer);
                            resolve({ cycleId: this.lastID, scheduledFor: nextCycle });
                        });
                    }.bind(this));
                });
            });
        });
    }

    /**
     * Process a narrative cycle - collect actions and generate story continuation
     */
    async processNarrativeCycle(gameId, cycleId) {
        return new Promise((resolve, reject) => {
            // Update cycle status to processing
            this.db.run('UPDATE narrative_cycles SET cycle_status = "processing", actual_start = CURRENT_TIMESTAMP WHERE id = ?',
                [cycleId], (err) => {
                if (err) return reject(err);

                // Collect all pending actions for this game
                this.db.all(`
                    SELECT pa.*, u.username, ps.character_name
                    FROM player_actions pa
                    JOIN users u ON pa.user_id = u.id
                    JOIN player_sessions ps ON pa.game_id = ps.game_id AND pa.user_id = ps.user_id
                    WHERE pa.game_id = ? AND pa.action_status = 'pending'
                    ORDER BY pa.action_priority DESC, pa.submitted_at ASC
                `, [gameId], (err, actions) => {
                    if (err) return reject(err);

                    console.log(`Processing narrative cycle for game ${gameId} with ${actions.length} actions`);

                    // Generate narrative based on actions
                    this.generateNarrativeContinuation(gameId, actions)
                        .then(narrative => {
                            // Update cycle with results
                            const updateQuery = `
                                UPDATE narrative_cycles SET 
                                    cycle_status = 'completed',
                                    completion_time = CURRENT_TIMESTAMP,
                                    actions_collected = ?,
                                    actions_processed = ?,
                                    narrative_generated = ?
                                WHERE id = ?
                            `;

                            this.db.run(updateQuery, [
                                actions.length, actions.length, narrative.content, cycleId
                            ], (err) => {
                                if (err) return reject(err);

                                // Mark actions as incorporated
                                const actionIds = actions.map(a => a.id);
                                if (actionIds.length > 0) {
                                    const placeholders = actionIds.map(() => '?').join(',');
                                    this.db.run(`UPDATE player_actions SET action_status = 'incorporated', processed_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`,
                                        actionIds, (err) => {
                                        if (err) console.error('Error updating action statuses:', err);
                                    });
                                }

                                // Update game state
                                this.db.run('UPDATE games SET last_narrative_cycle = CURRENT_TIMESTAMP WHERE id = ?',
                                    [gameId], (err) => {
                                    if (err) console.error('Error updating game state:', err);
                                });

                                // Schedule next cycle
                                this.scheduleNextNarrativeCycle(gameId).catch(console.error);

                                resolve({ narrative, actionsProcessed: actions.length });
                            });
                        })
                        .catch(reject);
                });
            });
        });
    }

    /**
     * Generate narrative continuation based on player actions
     * This is a simplified version - in production you'd integrate with AI services
     */
    async generateNarrativeContinuation(gameId, actions) {
        // Check if we have the lore-grounded narrative engine available
        if (this.narrativeEngine) {
            try {
                console.log(`AsyncGameManager: Using LoreGroundedNarrativeEngine for game ${gameId}`);

                // Prepare the context for the narrative engine
                const context = {
                    gameId: gameId,
                    actions: actions,
                    timestamp: new Date().toISOString()
                };

                // Generate narrative using the sophisticated engine
                const engineResult = await this.narrativeEngine.generateNarrative(context);

                return {
                    content: engineResult.narrative || "The story continues in unexpected ways...",
                    metadata: {
                        actionsProcessed: actions.length,
                        generatedAt: new Date().toISOString(),
                        generationMethod: 'lore-grounded-ai',
                        engineMetadata: engineResult.metadata || {},
                        modelsUsed: engineResult.modelsUsed || []
                    }
                };
            } catch (error) {
                console.error('AsyncGameManager: Failed to generate narrative with LoreGroundedNarrativeEngine:', error);
                console.log('AsyncGameManager: Falling back to template-based generation');
                // Fall through to template-based generation
            }
        }

        // Fallback: Simple template-based narrative generation
        let narrative = "The story continues...\n\n";

        if (actions.length === 0) {
            narrative += "Time passes quietly in the world, with the wind carrying whispers of distant events yet to unfold.";
        } else {
            narrative += "Recent events have shaped the world:\n\n";

            actions.forEach((action, index) => {
                const characterName = action.character_name || action.username;

                switch (action.action_type) {
                    case 'dialogue':
                        narrative += `${characterName} spoke with conviction, their words echoing through the scene.\n`;
                        break;
                    case 'action':
                        narrative += `${characterName} took decisive action, changing the course of events.\n`;
                        break;
                    case 'reaction':
                        narrative += `${characterName} responded to the unfolding situation with careful consideration.\n`;
                        break;
                    default:
                        narrative += `${characterName} contributed to the evolving story.\n`;
                }
            });

            narrative += "\nThe consequences of these actions will ripple through the world, setting the stage for what comes next...";
        }

        return {
            content: narrative,
            metadata: {
                actionsProcessed: actions.length,
                generatedAt: new Date().toISOString(),
                generationMethod: 'template'
            }
        };
    }

    /**
     * Get game state summary for management
     */
    async getGameStateSummary(gameId) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT 
                    g.*,
                    gs.session_phase,
                    gs.total_turns_completed,
                    COUNT(DISTINCT ps.user_id) as active_players,
                    COUNT(DISTINCT pa.id) as pending_actions,
                    nc.scheduled_start as next_cycle_start
                FROM games g
                LEFT JOIN game_sessions gs ON g.id = gs.game_id
                LEFT JOIN player_sessions ps ON g.id = ps.game_id AND ps.session_status = 'active'
                LEFT JOIN player_actions pa ON g.id = pa.game_id AND pa.action_status = 'pending'
                LEFT JOIN narrative_cycles nc ON g.id = nc.game_id AND nc.cycle_status = 'scheduled'
                WHERE g.id = ?
                GROUP BY g.id
            `;

            this.db.get(query, [gameId], (err, result) => {
                if (err) return reject(err);
                if (!result) return reject(new Error('Game not found'));
                resolve(result);
            });
        });
    }

    /**
     * Get player engagement metrics
     */
    async getPlayerEngagement(gameId, userId = null) {
        return new Promise((resolve, reject) => {
            let query = `
                SELECT 
                    ps.*,
                    u.username,
                    COUNT(DISTINCT pa.id) as total_actions,
                    COUNT(DISTINCT p.id) as total_posts,
                    JULIANDAY('now') - JULIANDAY(ps.last_activity) as days_since_activity
                FROM player_sessions ps
                JOIN users u ON ps.user_id = u.id
                LEFT JOIN player_actions pa ON ps.game_id = pa.game_id AND ps.user_id = pa.user_id
                LEFT JOIN posts p ON p.author_id = ps.user_id
                WHERE ps.game_id = ?
            `;
            
            let params = [gameId];
            
            if (userId) {
                query += ' AND ps.user_id = ?';
                params.push(userId);
            }
            
            query += ' GROUP BY ps.user_id ORDER BY ps.influence_score DESC';

            this.db.all(query, params, (err, results) => {
                if (err) return reject(err);
                resolve(results);
            });
        });
    }

    /**
     * Cleanup - remove timers and prepare for shutdown
     */
    cleanup() {
        this.narrativeCycleTimers.forEach(timer => clearTimeout(timer));
        this.narrativeCycleTimers.clear();
    }
}

module.exports = AsyncGameManager;
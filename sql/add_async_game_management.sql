-- Enhanced Database Schema for Asynchronous Game Session Management
-- Transforms the Eno-Frontend into a sophisticated play-by-post narrative system

-- First, add new columns to existing games table for async functionality
ALTER TABLE games ADD COLUMN game_state TEXT DEFAULT 'recruiting' CHECK(game_state IN ('recruiting', 'active', 'paused', 'concluded', 'archived'));
ALTER TABLE games ADD COLUMN session_type TEXT DEFAULT 'async' CHECK(session_type IN ('async', 'scheduled', 'hybrid'));
ALTER TABLE games ADD COLUMN turn_frequency TEXT DEFAULT 'daily' CHECK(turn_frequency IN ('hourly', 'daily', 'weekly', 'manual'));
ALTER TABLE games ADD COLUMN contribution_window_hours INTEGER DEFAULT 24; -- How long players have to contribute
ALTER TABLE games ADD COLUMN max_inactive_days INTEGER DEFAULT 7; -- Before player is considered inactive
ALTER TABLE games ADD COLUMN auto_advance_turns BOOLEAN DEFAULT 1; -- Whether to auto-advance narrative cycles
ALTER TABLE games ADD COLUMN narrative_style TEXT DEFAULT 'collaborative'; -- 'gm_driven', 'collaborative', 'ai_assisted'
ALTER TABLE games ADD COLUMN last_narrative_cycle TIMESTAMP NULL;
ALTER TABLE games ADD COLUMN next_narrative_cycle TIMESTAMP NULL;
ALTER TABLE games ADD COLUMN enrollment_deadline TIMESTAMP NULL; -- When recruitment closes
ALTER TABLE games ADD COLUMN expected_duration_weeks INTEGER DEFAULT 12; -- Expected campaign length

-- Game Sessions: Track long-running game states and narrative cycles
CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    session_phase TEXT NOT NULL CHECK(session_phase IN ('setup', 'recruitment', 'active', 'narrative_cycle', 'conclusion', 'archived')),
    current_turn_order INTEGER DEFAULT 1, -- For turn-based games
    total_turns_completed INTEGER DEFAULT 0,
    phase_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    phase_deadline TIMESTAMP NULL,
    session_data JSON DEFAULT '{}', -- Flexible metadata for game state
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Player Sessions: Track individual player participation and engagement
CREATE TABLE IF NOT EXISTS player_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    session_status TEXT DEFAULT 'active' CHECK(session_status IN ('active', 'inactive', 'on_hold', 'dropped_out')),
    enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_contribution TIMESTAMP NULL,
    contribution_count INTEGER DEFAULT 0,
    influence_score INTEGER DEFAULT 100, -- Player impact on narrative (0-200)
    character_name TEXT NULL,
    character_data JSON DEFAULT '{}', -- Character sheets, background, etc.
    participation_notes TEXT NULL, -- GM notes on player participation
    notification_preferences JSON DEFAULT '{"email": true, "in_app": true}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, user_id),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Player Actions Queue: Store player contributions between narrative cycles
CREATE TABLE IF NOT EXISTS player_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    chapter_id INTEGER NULL,
    beat_id INTEGER NULL,
    action_type TEXT NOT NULL CHECK(action_type IN ('dialogue', 'action', 'reaction', 'ooc', 'character_development')),
    action_content TEXT NOT NULL,
    action_priority INTEGER DEFAULT 5, -- 1-10 scale for narrative importance
    action_status TEXT DEFAULT 'pending' CHECK(action_status IN ('pending', 'acknowledged', 'incorporated', 'superseded')),
    target_entity TEXT NULL, -- Who/what the action targets
    consequences JSON DEFAULT '[]', -- Potential narrative consequences
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    processing_notes TEXT NULL, -- GM or AI notes on how action was handled
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    FOREIGN KEY (beat_id) REFERENCES beats(id) ON DELETE SET NULL
);

-- Narrative Cycles: Track scheduled story generation and world progression
CREATE TABLE IF NOT EXISTS narrative_cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    cycle_number INTEGER NOT NULL,
    cycle_type TEXT DEFAULT 'regular' CHECK(cycle_type IN ('regular', 'major_event', 'character_focus', 'world_event')),
    cycle_status TEXT DEFAULT 'scheduled' CHECK(cycle_status IN ('scheduled', 'collecting_input', 'processing', 'completed', 'skipped')),
    scheduled_start TIMESTAMP NOT NULL,
    actual_start TIMESTAMP NULL,
    completion_time TIMESTAMP NULL,
    input_deadline TIMESTAMP NOT NULL, -- When player contributions close
    actions_collected INTEGER DEFAULT 0,
    actions_processed INTEGER DEFAULT 0,
    narrative_generated TEXT NULL, -- AI or GM generated story continuation
    world_state_changes JSON DEFAULT '{}', -- How the world changed this cycle
    player_impact_scores JSON DEFAULT '{}', -- Player contribution scoring
    cycle_summary TEXT NULL,
    next_cycle_hints TEXT NULL, -- Teasers for upcoming content
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Game State Snapshots: Preserve game state at key moments
CREATE TABLE IF NOT EXISTS game_state_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    snapshot_type TEXT NOT NULL CHECK(snapshot_type IN ('narrative_cycle', 'chapter_end', 'major_event', 'backup')),
    snapshot_data JSON NOT NULL, -- Complete game state
    chapter_id INTEGER NULL,
    cycle_id INTEGER NULL,
    snapshot_name TEXT NULL,
    snapshot_description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE SET NULL,
    FOREIGN KEY (cycle_id) REFERENCES narrative_cycles(id) ON DELETE SET NULL
);

-- Player Engagement Metrics: Track participation patterns for better game management
CREATE TABLE IF NOT EXISTS player_engagement_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    metric_date DATE NOT NULL,
    posts_contributed INTEGER DEFAULT 0,
    actions_submitted INTEGER DEFAULT 0,
    words_written INTEGER DEFAULT 0,
    reactions_given INTEGER DEFAULT 0, -- Likes, comments on other posts
    login_count INTEGER DEFAULT 0,
    time_spent_minutes INTEGER DEFAULT 0,
    engagement_score FLOAT DEFAULT 0.0, -- Calculated engagement metric
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, user_id, metric_date),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Turn Management: For games that need structured turn order
CREATE TABLE IF NOT EXISTS turn_management (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    turn_number INTEGER NOT NULL,
    current_player_id INTEGER NULL, -- NULL for GM turns or free-form periods
    turn_type TEXT DEFAULT 'player' CHECK(turn_type IN ('player', 'gm', 'group', 'narrative_cycle')),
    turn_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    turn_deadline TIMESTAMP NULL,
    turn_completed_at TIMESTAMP NULL,
    turn_skipped BOOLEAN DEFAULT 0,
    skip_reason TEXT NULL,
    turn_data JSON DEFAULT '{}', -- Turn-specific information
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (current_player_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Enhanced posts table with async-specific fields (we'll add columns to existing table)
-- Add columns to existing posts table
ALTER TABLE posts ADD COLUMN contribution_cycle_id INTEGER NULL;
ALTER TABLE posts ADD COLUMN action_id INTEGER NULL; -- Link to player_actions if this post implements an action
ALTER TABLE posts ADD COLUMN narrative_weight FLOAT DEFAULT 1.0; -- How much this post affects the story (0.0-2.0)
ALTER TABLE posts ADD COLUMN emotional_tone TEXT NULL; -- 'dramatic', 'comedic', 'mysterious', etc.
ALTER TABLE posts ADD COLUMN character_focus TEXT NULL; -- Which character(s) this post focuses on
ALTER TABLE posts ADD COLUMN world_impact JSON DEFAULT '{}'; -- How this post changes the world state
ALTER TABLE posts ADD COLUMN player_reactions JSON DEFAULT '{}'; -- Likes, reactions from other players
ALTER TABLE posts ADD COLUMN is_pivotal BOOLEAN DEFAULT 0; -- Whether this is a major story moment

-- Add foreign key constraints for new columns
-- Note: SQLite doesn't support adding foreign keys to existing tables easily,
-- so we'll handle these relationships in application code for now

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_phase ON game_sessions(session_phase);
CREATE INDEX IF NOT EXISTS idx_player_sessions_game_user ON player_sessions(game_id, user_id);
CREATE INDEX IF NOT EXISTS idx_player_sessions_status ON player_sessions(session_status);
CREATE INDEX IF NOT EXISTS idx_player_sessions_last_activity ON player_sessions(last_activity);
CREATE INDEX IF NOT EXISTS idx_player_actions_game_id ON player_actions(game_id);
CREATE INDEX IF NOT EXISTS idx_player_actions_status ON player_actions(action_status);
CREATE INDEX IF NOT EXISTS idx_player_actions_submitted ON player_actions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_narrative_cycles_game_id ON narrative_cycles(game_id);
CREATE INDEX IF NOT EXISTS idx_narrative_cycles_scheduled ON narrative_cycles(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_narrative_cycles_status ON narrative_cycles(cycle_status);
CREATE INDEX IF NOT EXISTS idx_engagement_metrics_game_user_date ON player_engagement_metrics(game_id, user_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_turn_management_game_id ON turn_management(game_id);
CREATE INDEX IF NOT EXISTS idx_turn_management_current_player ON turn_management(current_player_id);

-- Triggers for automatic timestamp updates
CREATE TRIGGER IF NOT EXISTS update_game_sessions_timestamp 
AFTER UPDATE ON game_sessions
BEGIN
    UPDATE game_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_player_sessions_timestamp 
AFTER UPDATE ON player_sessions
BEGIN
    UPDATE player_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_narrative_cycles_timestamp 
AFTER UPDATE ON narrative_cycles
BEGIN
    UPDATE narrative_cycles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update player activity when they submit actions
CREATE TRIGGER IF NOT EXISTS update_player_activity_on_action
AFTER INSERT ON player_actions
BEGIN
    UPDATE player_sessions 
    SET last_activity = CURRENT_TIMESTAMP,
        last_contribution = CURRENT_TIMESTAMP,
        contribution_count = contribution_count + 1
    WHERE game_id = NEW.game_id AND user_id = NEW.user_id;
END;

-- Trigger to update player activity when they post
CREATE TRIGGER IF NOT EXISTS update_player_activity_on_post
AFTER INSERT ON posts
BEGIN
    UPDATE player_sessions 
    SET last_activity = CURRENT_TIMESTAMP,
        last_contribution = CURRENT_TIMESTAMP,
        contribution_count = contribution_count + 1
    WHERE game_id IN (
        SELECT g.id FROM games g 
        JOIN chapters c ON g.id = c.game_id 
        JOIN beats b ON c.id = b.chapter_id 
        WHERE b.id = NEW.beat_id
    ) AND user_id = NEW.author_id;
END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS active_games_summary AS
SELECT 
    g.id,
    g.name,
    g.game_state,
    g.session_type,
    g.turn_frequency,
    COUNT(DISTINCT ps.user_id) as active_players,
    COUNT(DISTINCT c.id) as total_chapters,
    g.last_narrative_cycle,
    g.next_narrative_cycle,
    g.created_at
FROM games g
LEFT JOIN player_sessions ps ON g.id = ps.game_id AND ps.session_status = 'active'
LEFT JOIN chapters c ON g.id = c.game_id
WHERE g.game_state IN ('recruiting', 'active')
GROUP BY g.id;

CREATE VIEW IF NOT EXISTS player_engagement_summary AS
SELECT 
    ps.game_id,
    ps.user_id,
    u.username,
    ps.session_status,
    ps.contribution_count,
    ps.influence_score,
    ps.last_activity,
    ps.last_contribution,
    JULIANDAY('now') - JULIANDAY(ps.last_activity) as days_since_last_activity,
    COUNT(pa.id) as pending_actions
FROM player_sessions ps
JOIN users u ON ps.user_id = u.id
LEFT JOIN player_actions pa ON ps.game_id = pa.game_id AND ps.user_id = pa.user_id AND pa.action_status = 'pending'
GROUP BY ps.game_id, ps.user_id;

-- Sample data for testing (optional - can be removed for production)
-- This creates a sample async game to test the system
INSERT OR IGNORE INTO games (name, description, game_state, session_type, turn_frequency) 
VALUES ('The Ashen Realms Campaign', 'A long-running fantasy epic where heroes explore a world recovering from ancient catastrophe. Players contribute at their own pace as the world evolves around their actions.', 'recruiting', 'async', 'daily');

-- Comments explaining the system design
-- This schema supports:
-- 1. Long-running games (weeks/months) with flexible pacing
-- 2. Player contribution windows and async participation
-- 3. Narrative cycles that process accumulated player actions
-- 4. Turn management for structured games
-- 5. Engagement tracking and player retention analytics
-- 6. Game state snapshots for consistency and rollback
-- 7. Flexible character and world state management
-- 8. Integration with existing games→chapters→beats→posts hierarchy
-- Database Schema Updates for Lore-Grounded Narrative System
-- Adds tables for Functional Formalities, VAD emotions, and narrative history

-- Character Relationships table for relationship tracking
CREATE TABLE IF NOT EXISTS character_relationships (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character1_id INTEGER NOT NULL,
    character2_id INTEGER NOT NULL,
    game_id INTEGER NOT NULL,
    relationship_type TEXT DEFAULT 'neutral',
    strength REAL DEFAULT 0.5,
    history TEXT DEFAULT '[]', -- JSON array of relationship events
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character1_id) REFERENCES users(id),
    FOREIGN KEY (character2_id) REFERENCES users(id),
    FOREIGN KEY (game_id) REFERENCES games(id),
    UNIQUE(character1_id, character2_id, game_id)
);

-- Game Locations table for tracking locations with Functional Formalities
CREATE TABLE IF NOT EXISTS game_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    location_data TEXT DEFAULT '{}', -- JSON with Functional Formalities
    coordinates TEXT, -- JSON with lat/lng if using geospatial
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Factions table for group dynamics
CREATE TABLE IF NOT EXISTS factions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    goals TEXT DEFAULT '{}', -- JSON with faction goals
    resources INTEGER DEFAULT 0,
    influence INTEGER DEFAULT 0,
    faction_data TEXT DEFAULT '{}', -- JSON with Functional Formalities
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Narrative History table for tracking generated narratives
CREATE TABLE IF NOT EXISTS narrative_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    narrative_content TEXT NOT NULL,
    world_state TEXT DEFAULT '{}', -- JSON snapshot of world state
    motivation_state TEXT DEFAULT '{}', -- JSON snapshot of functional formalities
    cultural_state TEXT DEFAULT '{}', -- JSON snapshot of VAD emotional state
    player_actions TEXT DEFAULT '[]', -- JSON array of actions that influenced this narrative
    generation_metadata TEXT DEFAULT '{}', -- JSON with AI generation info
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Lore Cache table for efficient lore integration
CREATE TABLE IF NOT EXISTS lore_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL UNIQUE,
    cache_data TEXT NOT NULL, -- JSON cached data
    source_type TEXT NOT NULL, -- 'n4l', 'wiki', 'geospatial', 'economic'
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Entity Aspects table for tracking adopted aspects in Functional Formalities
CREATE TABLE IF NOT EXISTS entity_aspects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL, -- 'character', 'location', 'event', 'concept'
    entity_id TEXT NOT NULL, -- ID within entity type
    game_id INTEGER,
    aspect_name TEXT NOT NULL,
    aspect_source TEXT, -- Where the aspect came from
    adopted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Cultural Movements table for tracking cultural trends
CREATE TABLE IF NOT EXISTS cultural_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    movement_name TEXT NOT NULL,
    movement_type TEXT DEFAULT 'social', -- 'social', 'political', 'religious', 'artistic'
    strength REAL DEFAULT 0.5,
    vad_influence TEXT DEFAULT '{}', -- JSON with VAD impact
    participants TEXT DEFAULT '[]', -- JSON array of character IDs
    description TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    FOREIGN KEY (game_id) REFERENCES games(id)
);

-- World Events table for autonomous world changes
CREATE TABLE IF NOT EXISTS world_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    event_data TEXT DEFAULT '{}', -- JSON with event details
    functional_formalities TEXT DEFAULT '{}', -- JSON with FF for the event
    impact_radius TEXT DEFAULT 'local', -- 'local', 'regional', 'global'
    triggered_by TEXT, -- What triggered this event
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Update existing games table to support new features
ALTER TABLE games ADD COLUMN world_data TEXT DEFAULT '{}';
ALTER TABLE games ADD COLUMN cultural_data TEXT DEFAULT '{}';
ALTER TABLE games ADD COLUMN current_season TEXT DEFAULT 'spring';
ALTER TABLE games ADD COLUMN time_period TEXT DEFAULT 'medieval';
ALTER TABLE games ADD COLUMN world_age INTEGER DEFAULT 0;

-- Update player_sessions to store Functional Formalities and VAD emotions
-- Note: character_data already exists, we'll use it with JSON extensions

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_character_relationships_game ON character_relationships(game_id);
CREATE INDEX IF NOT EXISTS idx_character_relationships_chars ON character_relationships(character1_id, character2_id);
CREATE INDEX IF NOT EXISTS idx_game_locations_game ON game_locations(game_id);
CREATE INDEX IF NOT EXISTS idx_factions_game ON factions(game_id);
CREATE INDEX IF NOT EXISTS idx_narrative_history_game ON narrative_history(game_id);
CREATE INDEX IF NOT EXISTS idx_narrative_history_timestamp ON narrative_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_lore_cache_key ON lore_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_lore_cache_expires ON lore_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_entity_aspects_entity ON entity_aspects(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_aspects_game ON entity_aspects(game_id);
CREATE INDEX IF NOT EXISTS idx_cultural_movements_game ON cultural_movements(game_id);
CREATE INDEX IF NOT EXISTS idx_world_events_game ON world_events(game_id);
CREATE INDEX IF NOT EXISTS idx_world_events_unresolved ON world_events(game_id, resolved);

-- Insert default data for testing
INSERT OR IGNORE INTO game_locations (game_id, name, location_data)
SELECT id, 'The Crossroads', '{"functionalFormalities":{"imperative":"Connect","ethos":"Neutral","root":"Unity"}}'
FROM games LIMIT 1;

INSERT OR IGNORE INTO factions (game_id, name, goals, resources, influence)
SELECT id, 'Independent', '{"survival":{"priority":0.9,"satisfaction":0.5},"prosperity":{"priority":0.7,"satisfaction":0.4}}', 50, 30
FROM games LIMIT 1;

-- Trigger to update updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_character_relationships_timestamp
    AFTER UPDATE ON character_relationships
BEGIN
    UPDATE character_relationships SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_game_locations_timestamp
    AFTER UPDATE ON game_locations
BEGIN
    UPDATE game_locations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_factions_timestamp
    AFTER UPDATE ON factions
BEGIN
    UPDATE factions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Clean up expired cache entries
CREATE TRIGGER IF NOT EXISTS cleanup_expired_lore_cache
    AFTER INSERT ON lore_cache
BEGIN
    DELETE FROM lore_cache WHERE expires_at < datetime('now');
END;
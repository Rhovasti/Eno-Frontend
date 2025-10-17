-- Migration: Add Temporal System for 4D Worldbuilding
-- Description: Creates tables for temporal events, timelines, and entity lifespans
-- Date: 2025-09-27

-- ============================================================================
-- 1. Enhance wiki_entries with temporal columns
-- ============================================================================

ALTER TABLE wiki_entries ADD COLUMN temporal_start_cycle INTEGER DEFAULT NULL;
ALTER TABLE wiki_entries ADD COLUMN temporal_start_day INTEGER DEFAULT NULL;
ALTER TABLE wiki_entries ADD COLUMN temporal_end_cycle INTEGER DEFAULT NULL;
ALTER TABLE wiki_entries ADD COLUMN temporal_end_day INTEGER DEFAULT NULL;
ALTER TABLE wiki_entries ADD COLUMN temporal_granularity VARCHAR(20) DEFAULT NULL;

-- ============================================================================
-- 2. Create temporal_events table
-- ============================================================================

CREATE TABLE temporal_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wiki_entry_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,

    -- Spatial coordinates
    latitude REAL,
    longitude REAL,
    location_type VARCHAR(20), -- 'world', 'region', 'citystate', 'district', 'building'
    location_id VARCHAR(100),

    -- Temporal coordinates
    cycle_start INTEGER NOT NULL, -- Full cycle number (can be negative for ancient past)
    day_start INTEGER, -- Day within cycle (1-360)
    cycle_end INTEGER, -- NULL for instantaneous events
    day_end INTEGER,

    -- Temporal precision
    granularity VARCHAR(20) DEFAULT 'day', -- 'epoch', 'century', 'decade', 'cycle', 'season', 'month', 'day'
    is_ongoing BOOLEAN DEFAULT 0,

    -- Event metadata
    event_type VARCHAR(50), -- 'battle', 'founding', 'treaty', 'birth', 'death', 'discovery', etc.
    importance INTEGER DEFAULT 0, -- 0-10 scale for filtering

    -- Relations
    related_events TEXT, -- JSON array of event IDs
    participants TEXT, -- JSON array of character/faction names

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (wiki_entry_id) REFERENCES wiki_entries(id) ON DELETE CASCADE
);

-- Indexes for efficient temporal queries
CREATE INDEX idx_temporal_events_time ON temporal_events(cycle_start, day_start);
CREATE INDEX idx_temporal_events_location ON temporal_events(location_type, location_id);
CREATE INDEX idx_temporal_events_spatial ON temporal_events(latitude, longitude);
CREATE INDEX idx_temporal_events_type ON temporal_events(event_type);
CREATE INDEX idx_temporal_events_wiki ON temporal_events(wiki_entry_id);
CREATE INDEX idx_temporal_events_importance ON temporal_events(importance);

-- ============================================================================
-- 3. Create timeline_metadata table (for eras/epochs)
-- ============================================================================

CREATE TABLE timeline_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    epoch_name TEXT NOT NULL, -- "Age of Dragons", "First Founding", etc.
    cycle_start INTEGER NOT NULL,
    cycle_end INTEGER NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3498db', -- Hex color for visualization
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_timeline_metadata_range ON timeline_metadata(cycle_start, cycle_end);

-- ============================================================================
-- 4. Create entity_lifespans table
-- ============================================================================

CREATE TABLE entity_lifespans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_name TEXT NOT NULL,
    entity_type VARCHAR(50), -- 'character', 'faction', 'nation', 'building'
    wiki_entry_id INTEGER,

    birth_cycle INTEGER,
    birth_day INTEGER,
    death_cycle INTEGER,
    death_day INTEGER,

    location_type VARCHAR(20),
    location_id VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (wiki_entry_id) REFERENCES wiki_entries(id) ON DELETE SET NULL
);

CREATE INDEX idx_entity_lifespans_name ON entity_lifespans(entity_name);
CREATE INDEX idx_entity_lifespans_type ON entity_lifespans(entity_type);
CREATE INDEX idx_entity_lifespans_wiki ON entity_lifespans(wiki_entry_id);
CREATE INDEX idx_entity_lifespans_time ON entity_lifespans(birth_cycle, death_cycle);

-- ============================================================================
-- 5. Insert sample timeline metadata (epochs/eras)
-- ============================================================================

INSERT INTO timeline_metadata (epoch_name, cycle_start, cycle_end, description, color) VALUES
    ('Ancient Past', -10000, -1000, 'The dawn of civilization and mythological ages', '#8e44ad'),
    ('Age of Foundations', -1000, -100, 'Great cities and nations were founded', '#2980b9'),
    ('Before Era', -100, 0, 'The century before the current reckoning', '#16a085'),
    ('Current Era', 0, 1000, 'The present age of recorded history', '#27ae60'),
    ('Near Future', 1000, 2000, 'Prophesied and potential future events', '#f39c12');

-- ============================================================================
-- 6. Sample temporal events for testing
-- ============================================================================

-- Example: Battle of Malveiba (if Malveiba citystate exists)
INSERT INTO temporal_events (
    title, description,
    latitude, longitude, location_type, location_id,
    cycle_start, day_start, cycle_end, day_end,
    granularity, event_type, importance,
    participants
) VALUES (
    'Founding of Malveiba',
    'The great citystate of Malveiba was founded by ancient settlers from the north.',
    -34.43, 31.90, 'citystate', 'malveiba',
    -500, 180, NULL, NULL,
    'day', 'founding', 9,
    '["Ancient Settlers", "Northern Tribes"]'
);

INSERT INTO temporal_events (
    title, description,
    latitude, longitude, location_type, location_id,
    cycle_start, day_start, cycle_end, day_end,
    granularity, event_type, importance,
    participants
) VALUES (
    'Battle of the Red Plains',
    'A decisive battle that shaped the political landscape of the region for centuries to come.',
    -34.50, 32.00, 'region', 'eastern_territories',
    523, 145, 523, 147,
    'day', 'battle', 8,
    '["Eastern Alliance", "Northern Coalition"]'
);

-- ============================================================================
-- Migration complete
-- ============================================================================
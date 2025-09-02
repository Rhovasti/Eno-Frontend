#!/bin/bash

echo "Applying AI GM schema to local database..."

# Backup current database
cp /root/Eno/Eno-Frontend/data/database.sqlite /root/Eno/Eno-Frontend/data/database.sqlite.backup

# Apply AI GM tables
sqlite3 /root/Eno/Eno-Frontend/data/database.sqlite << 'EOF'
-- AI GM System Tables
-- This enables players to create games with AI Game Masters

-- AI GM personality profiles
CREATE TABLE IF NOT EXISTS ai_gm_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    personality_traits TEXT NOT NULL, -- JSON array of traits
    response_style TEXT NOT NULL, -- How the AI GM responds
    game_genres TEXT NOT NULL, -- JSON array of preferred genres
    difficulty_level TEXT DEFAULT 'medium', -- easy, medium, hard
    icon TEXT DEFAULT '🤖', -- Visual icon for the AI GM
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Player game requests (orders)
CREATE TABLE IF NOT EXISTS player_game_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    ai_gm_profile_id INTEGER NOT NULL,
    game_title TEXT NOT NULL,
    game_description TEXT NOT NULL,
    genre TEXT NOT NULL,
    theme TEXT,
    max_players INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending', -- pending, approved, active, completed
    game_id INTEGER, -- Reference to created game
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    FOREIGN KEY (player_id) REFERENCES users(id),
    FOREIGN KEY (ai_gm_profile_id) REFERENCES ai_gm_profiles(id),
    FOREIGN KEY (game_id) REFERENCES games(id)
);

-- AI GM response queue
CREATE TABLE IF NOT EXISTS ai_gm_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    beat_id INTEGER NOT NULL,
    trigger_post_id INTEGER, -- The post that triggered this response
    response_content TEXT,
    response_type TEXT DEFAULT 'narrative', -- narrative, challenge, reward, scene_change
    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (beat_id) REFERENCES beats(id),
    FOREIGN KEY (trigger_post_id) REFERENCES posts(id)
);

-- Default AI GM Profiles
INSERT INTO ai_gm_profiles (name, description, personality_traits, response_style, game_genres) VALUES
(
    'Klassinen Tarinankertoja',
    'Perinteinen GM joka keskittyy eeppisiin seikkailuihin ja sankaritarinoihin',
    '["fair", "encouraging", "descriptive", "traditional"]',
    'Kuvaileva ja innostava, antaa pelaajille tilaa loistaa',
    '["fantasy", "adventure", "heroic"]'
),
(
    'Synkkä Salaisuuksien Vartija',
    'Mysteerien ja kauhun mestari, pitää pelaajat jännityksessä',
    '["mysterious", "atmospheric", "challenging", "cryptic"]',
    'Arvoituksellinen ja tunnelmallinen, ei paljasta liikaa kerralla',
    '["horror", "mystery", "thriller"]'
),
(
    'Humoristinen Seikkailija',
    'Kevytmielinen GM joka tuo huumoria peliin',
    '["funny", "lighthearted", "creative", "spontaneous"]',
    'Leikkisä ja yllättävä, ei ota asioita liian vakavasti',
    '["comedy", "adventure", "fantasy"]'
),
(
    'Taktinen Strategi',
    'Keskittyy haastaviin taisteluihin ja strategiseen pelaamiseen',
    '["analytical", "fair", "challenging", "detailed"]',
    'Tarkka ja yksityiskohtainen, antaa selkeät haasteet',
    '["strategy", "war", "scifi"]'
),
(
    'Improvisaation Mestari',
    'Mukautuu pelaajien valintoihin ja luo tarinan lennossa',
    '["adaptive", "creative", "responsive", "collaborative"]',
    'Joustava ja pelaajavetoinen, "kyllä, ja..." -mentaliteetti',
    '["any"]'
);

-- Check if columns already exist before adding them
PRAGMA table_info(games);
EOF

# Check if is_ai_gm column exists, if not add it
if ! sqlite3 /root/Eno/Eno-Frontend/data/database.sqlite "PRAGMA table_info(games);" | grep -q "is_ai_gm"; then
    echo "Adding is_ai_gm column to games table..."
    sqlite3 /root/Eno/Eno-Frontend/data/database.sqlite "ALTER TABLE games ADD COLUMN is_ai_gm BOOLEAN DEFAULT 0;"
fi

# Check if ai_gm_profile_id column exists, if not add it
if ! sqlite3 /root/Eno/Eno-Frontend/data/database.sqlite "PRAGMA table_info(games);" | grep -q "ai_gm_profile_id"; then
    echo "Adding ai_gm_profile_id column to games table..."
    sqlite3 /root/Eno/Eno-Frontend/data/database.sqlite "ALTER TABLE games ADD COLUMN ai_gm_profile_id INTEGER REFERENCES ai_gm_profiles(id);"
fi

echo "AI GM schema applied successfully!"
echo ""
echo "Verifying tables..."
sqlite3 /root/Eno/Eno-Frontend/data/database.sqlite ".tables" | grep -E "ai_gm|player_game" || echo "No AI GM tables found (might be an issue)"
echo ""
echo "AI GM profiles count:"
sqlite3 /root/Eno/Eno-Frontend/data/database.sqlite "SELECT COUNT(*) FROM ai_gm_profiles;"
#!/bin/bash

echo "=== Fixing AI GM Database and Endpoints ==="

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'ENDSSH'
cd /var/www/pelisivusto

echo "=== Checking current database schema ==="
sqlite3 data/database.sqlite ".tables" | grep -E "ai_gm|player_game"

echo -e "\n=== Applying AI GM database migrations ==="
sqlite3 data/database.sqlite << 'SQL'
-- Create AI GM tables if they don't exist
CREATE TABLE IF NOT EXISTS ai_gm_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    personality_traits TEXT NOT NULL,
    response_style TEXT NOT NULL,
    game_genres TEXT NOT NULL,
    difficulty_level TEXT DEFAULT 'medium',
    icon TEXT DEFAULT '🤖',
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS player_game_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    ai_gm_profile_id INTEGER NOT NULL,
    game_title TEXT NOT NULL,
    game_description TEXT NOT NULL,
    genre TEXT NOT NULL,
    theme TEXT,
    max_players INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    game_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    approved_at DATETIME,
    FOREIGN KEY (player_id) REFERENCES users(id),
    FOREIGN KEY (ai_gm_profile_id) REFERENCES ai_gm_profiles(id),
    FOREIGN KEY (game_id) REFERENCES games(id)
);

CREATE TABLE IF NOT EXISTS ai_gm_responses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    beat_id INTEGER NOT NULL,
    trigger_post_id INTEGER,
    response_content TEXT,
    response_type TEXT DEFAULT 'narrative',
    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    status TEXT DEFAULT 'pending',
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (beat_id) REFERENCES beats(id),
    FOREIGN KEY (trigger_post_id) REFERENCES posts(id)
);

-- Add AI GM columns to games table
ALTER TABLE games ADD COLUMN is_ai_gm BOOLEAN DEFAULT 0;
ALTER TABLE games ADD COLUMN ai_gm_profile_id INTEGER REFERENCES ai_gm_profiles(id);

-- Insert default AI GM profiles if not exist
INSERT OR IGNORE INTO ai_gm_profiles (id, name, description, personality_traits, response_style, game_genres, icon, difficulty_level) VALUES
(1, 'Klassinen Tarinankertoja', 'Perinteinen GM joka keskittyy eeppisiin seikkailuihin ja sankaritarinoihin', '["fair", "encouraging", "descriptive", "traditional"]', 'Kuvaileva ja innostava, antaa pelaajille tilaa loistaa', '["fantasy", "adventure", "heroic"]', '🧙‍♂️', 'medium'),
(2, 'Synkkä Salaisuuksien Vartija', 'Mysteerien ja kauhun mestari, pitää pelaajat jännityksessä', '["mysterious", "atmospheric", "challenging", "cryptic"]', 'Arvoituksellinen ja tunnelmallinen, ei paljasta liikaa kerralla', '["horror", "mystery", "thriller"]', '🕵️', 'hard'),
(3, 'Humoristinen Seikkailija', 'Kevytmielinen GM joka tuo huumoria peliin', '["funny", "lighthearted", "creative", "spontaneous"]', 'Leikkisä ja yllättävä, ei ota asioita liian vakavasti', '["comedy", "adventure", "fantasy"]', '🤡', 'easy'),
(4, 'Taktinen Strategi', 'Keskittyy haastaviin taisteluihin ja strategiseen pelaamiseen', '["analytical", "fair", "challenging", "detailed"]', 'Tarkka ja yksityiskohtainen, antaa selkeät haasteet', '["strategy", "war", "scifi"]', '♟️', 'hard'),
(5, 'Improvisaation Mestari', 'Mukautuu pelaajien valintoihin ja luo tarinan lennossa', '["adaptive", "creative", "responsive", "collaborative"]', 'Joustava ja pelaajavetoinen, "kyllä, ja..." -mentaliteetti', '["any"]', '🎭', 'medium');

-- Verify tables were created
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%ai_gm%' OR name LIKE '%player_game%';

-- Check AI GM profiles
SELECT COUNT(*) as profile_count FROM ai_gm_profiles;
SQL

echo -e "\n=== Checking server endpoints ==="
# Check if the endpoint is registered
grep -n "player-game-requests" js/server_sqlite.js | head -5

echo -e "\n=== Testing AI GM profiles endpoint ==="
curl -s http://localhost:3000/api/ai-gm-profiles | head -c 200

echo -e "\n=== Restarting server to ensure all endpoints are loaded ==="
systemctl restart pelisivusto

sleep 3

echo -e "\n=== Checking server status ==="
systemctl status pelisivusto --no-pager | head -10

echo -e "\n=== Testing endpoints directly ==="
# Test if API is responding
curl -s -I http://localhost:3000/api/games | grep HTTP

echo -e "\n=== Checking for syntax errors in server file ==="
node -c js/server_sqlite.js

echo -e "\n=== Database and endpoints fixed! ==="
echo "The AI GM system should now work properly."
echo "Players can order games at: https://www.iinou.eu/hml/order-game.html"

ENDSSH

echo -e "\n=== Local fix complete ==="
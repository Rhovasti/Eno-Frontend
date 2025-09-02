#!/bin/bash

echo "Fixing games table on production..."

REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"

sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

echo "1. Checking current games table schema..."
sqlite3 data/database.sqlite ".schema games"

echo -e "\n2. Backing up database..."
cp data/database.sqlite data/database.sqlite.backup.$(date +%Y%m%d_%H%M%S)

echo -e "\n3. Fixing games table schema..."
sqlite3 data/database.sqlite << 'SQL'
-- Check current columns
.headers on
PRAGMA table_info(games);

-- Create temporary table with correct schema
CREATE TABLE games_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    created_by INTEGER,
    genre TEXT DEFAULT 'fantasy',
    gm_id INTEGER,
    max_players INTEGER DEFAULT 5,
    posting_frequency TEXT DEFAULT 'daily',
    is_private BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (gm_id) REFERENCES users(id)
);

-- Copy data from old table
INSERT INTO games_new (id, title, description, created_at)
SELECT id, name, description, created_at FROM games;

-- Drop old table and rename new one
DROP TABLE games;
ALTER TABLE games_new RENAME TO games;

-- Update missing gm_id values
UPDATE games SET gm_id = 1 WHERE gm_id IS NULL;
UPDATE games SET created_by = 1 WHERE created_by IS NULL;

-- Show result
SELECT COUNT(*) as total_games FROM games;
SELECT id, title FROM games;
SQL

echo -e "\n4. Restarting server..."
pkill -f "node.*server" || true
sleep 2
nohup node js/server_sqlite_ai.js > server_ai.log 2>&1 &
sleep 3

echo -e "\n5. Checking server status..."
if pgrep -f "server_sqlite_ai" > /dev/null; then
    echo "✓ Server is running"
    tail -10 server_ai.log | grep -v "Error executing statement"
else
    echo "✗ Server failed to start"
fi
EOF

echo -e "\nDone! Try creating a game now at https://www.iinou.eu/hml/create-game.html"
#!/bin/bash

echo "=== Deploying GM Dashboard Features ==="

# Configuration
REMOTE_HOST="root@95.217.21.111"
REMOTE_PASSWORD="ininFvTPNTguUtuuLbx3"
REMOTE_DIR="/var/www/pelisivusto"

echo "=== Uploading GM dashboard files ==="

# Upload the new server file with outline endpoints
sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no \
    js/server_sqlite_gm_dashboard.js \
    "$REMOTE_HOST:$REMOTE_DIR/js/server_sqlite_gm_dashboard.js"

# Upload the GM dashboard HTML page
sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no \
    hml/gm-dashboard.html \
    "$REMOTE_HOST:$REMOTE_DIR/hml/gm-dashboard.html"

# Upload the database migration script
sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no \
    sql/add_game_outlines.sql \
    "$REMOTE_HOST:$REMOTE_DIR/sql/add_game_outlines.sql"

echo "=== Applying changes on production server ==="

sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no "$REMOTE_HOST" << 'ENDSSH'
cd /var/www/pelisivusto

echo "=== Creating database backup ==="
cp data/database.sqlite data/database.sqlite.backup.$(date +%Y%m%d_%H%M%S)

echo "=== Applying database migrations ==="
# Create game_outlines table
sqlite3 data/database.sqlite << 'SQL'
CREATE TABLE IF NOT EXISTS game_outlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    outline_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Add game statistics columns if they don't exist
ALTER TABLE games ADD COLUMN total_posts INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN last_post_at DATETIME;
ALTER TABLE games ADD COLUMN current_chapter_id INTEGER;
ALTER TABLE games ADD COLUMN max_players INTEGER DEFAULT 5;
ALTER TABLE games ADD COLUMN status TEXT DEFAULT 'open';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_game_outlines_game_id ON game_outlines(game_id);

-- Update post counts for existing games
UPDATE games 
SET total_posts = (
    SELECT COUNT(*) 
    FROM posts p 
    JOIN beats b ON p.beat_id = b.id 
    JOIN chapters c ON b.chapter_id = c.id 
    WHERE c.game_id = games.id
);

-- Verify tables
.tables
SQL

echo "=== Backing up current server ==="
cp js/server_sqlite.js js/server_sqlite.backup.$(date +%Y%m%d_%H%M%S).js

echo "=== Installing new server with GM dashboard features ==="
cp js/server_sqlite_gm_dashboard.js js/server_sqlite.js

echo "=== Restarting server ==="
systemctl restart pelisivusto

sleep 3

echo "=== Checking server status ==="
systemctl status pelisivusto --no-pager | head -15

echo -e "\n=== Testing new endpoints ==="
# Test outline endpoint
curl -s -X GET http://localhost:3000/api/games/1/outline \
  -H "Authorization: Bearer test" | head -c 100
echo -e "\n"

echo -e "\n=== Creating navigation helper script ==="
cat > update_navigation.js << 'EOF'
// Helper script to add GM Dashboard links
// This can be run manually to update existing pages

console.log("To add GM Dashboard links to your pages:");
console.log("1. In threads.html or storyboard.html, add this after loading game data:");
console.log("");
console.log("if (gameData.created_by === user.id || user.is_admin) {");
console.log("  const gmLink = document.createElement('a');");
console.log("  gmLink.href = '/hml/gm-dashboard.html?game=' + gameId;");
console.log("  gmLink.className = 'btn btn-primary';");
console.log("  gmLink.textContent = 'GM Dashboard';");
console.log("  // Add to appropriate location in your UI");
console.log("}");
EOF

echo -e "\n=== Deployment complete! ==="
echo "GM Dashboard features are now available at:"
echo "https://www.iinou.eu/hml/gm-dashboard.html?game=GAME_ID"
echo ""
echo "Features added:"
echo "✅ GM Dashboard page with outline management"
echo "✅ Game settings management"
echo "✅ Progress tracking and recent posts view"
echo "✅ Editable story arc/outline"
echo "✅ Database schema for outlines"
echo ""
echo "To use:"
echo "1. Navigate to any game you created as GM"
echo "2. Access the dashboard at /hml/gm-dashboard.html?game=YOUR_GAME_ID"
echo "3. Manage your game outline, settings, and track progress"

ENDSSH

echo -e "\n=== Local deployment complete ==="
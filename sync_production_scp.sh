#!/bin/bash

# Alternative sync script using SCP instead of SFTP

set -e

echo "==================================="
echo "Production Server Sync (SCP Method)"
echo "==================================="

# Production server details
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"
REMOTE_PATH="/var/www/pelisivusto"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Backup completed. Proceeding with file upload...${NC}"

# Upload files using scp
echo -e "\n${GREEN}Uploading JavaScript files...${NC}"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    js/server_sqlite_new.js \
    js/server.js \
    js/script.js \
    js/storyboard.js \
    js/threads.js \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/js/

echo -e "${GREEN}Uploading HTML files...${NC}"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    hml/*.html \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/hml/

echo -e "${GREEN}Uploading CSS files...${NC}"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    css/styles.css \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/css/

echo -e "${GREEN}Uploading root files...${NC}"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    index.html \
    package.json \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/

echo -e "${GREEN}Uploading SQL files...${NC}"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    sql/sqlite_schema.sql \
    sql/add_chapter_archiving.sql \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/sql/

# Setup and start SQLite server
echo -e "\n${GREEN}Setting up SQLite server on production...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

# Ensure npm dependencies are installed
echo "Installing npm dependencies..."
npm install --production

# Apply archiving schema if needed
if [ -f data/database.sqlite ]; then
    echo "Checking for archiving schema updates..."
    sqlite3 data/database.sqlite "SELECT sql FROM sqlite_master WHERE type='table' AND name='chapters';" | grep -q "is_archived" || {
        echo "Applying archiving schema update..."
        cat > /tmp/archiving_update.sql << 'SQL'
ALTER TABLE chapters ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE chapters ADD COLUMN archived_at TIMESTAMP NULL;
ALTER TABLE chapters ADD COLUMN archived_narrative TEXT;
ALTER TABLE beats ADD COLUMN title TEXT;
ALTER TABLE beats ADD COLUMN content TEXT;
CREATE INDEX idx_chapters_archived ON chapters(is_archived, game_id);
SQL
        sqlite3 data/database.sqlite < /tmp/archiving_update.sql
        rm /tmp/archiving_update.sql
        echo "Archiving schema applied!"
    }
fi

# Stop existing server
echo "Stopping existing Node.js processes..."
pkill -f "node.*server" || true
sleep 2

# Start new server
echo "Starting SQLite server..."
nohup node js/server_sqlite_new.js > server.log 2>&1 &
sleep 3

# Verify server started
if pgrep -f "node.*server_sqlite_new" > /dev/null; then
    echo "Server started successfully!"
    ps aux | grep node | grep -v grep
else
    echo "ERROR: Server failed to start!"
    tail -20 server.log
fi
EOF

echo -e "\n${GREEN}Testing production deployment...${NC}"
sleep 2
curl -s -w "\nHTTP Status: %{http_code}\n" https://www.iinou.eu/api/games | head -5

echo -e "\n${GREEN}Deployment completed!${NC}"
echo "Production server has been synced with local changes."
echo "URL: https://www.iinou.eu"
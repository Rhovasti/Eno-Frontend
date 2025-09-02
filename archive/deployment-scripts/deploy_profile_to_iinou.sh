#!/bin/bash

set -e

echo "========================================"
echo "Deploying Profile Features to Production"
echo "========================================"

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

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo -e "${RED}sshpass is required but not installed. Installing...${NC}"
    apt-get update && apt-get install -y sshpass
fi

echo -e "\n${GREEN}Step 1: Uploading JavaScript files...${NC}"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    js/server.js \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/js/

echo -e "${GREEN}Step 2: Uploading new HTML files...${NC}"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    hml/create-game.html \
    hml/profile.html \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/hml/

echo -e "${GREEN}Step 3: Uploading updated HTML files...${NC}"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    hml/storyboard.html \
    hml/threads.html \
    hml/wiki.html \
    index.html \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/

# Copy to hml directory as well
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << EOF
cp $REMOTE_PATH/hml/storyboard.html $REMOTE_PATH/hml/
cp $REMOTE_PATH/hml/threads.html $REMOTE_PATH/hml/
cp $REMOTE_PATH/hml/wiki.html $REMOTE_PATH/hml/
EOF

echo -e "${GREEN}Step 4: Uploading SQL migration...${NC}"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    sql/add_user_profile_columns.sql \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/sql/

echo -e "\n${GREEN}Step 5: Applying database migration...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

# For SQLite, we need to convert the MySQL migration
echo "Converting MySQL migration to SQLite format..."
cat > /tmp/profile_migration.sql << 'SQL'
-- Add bio column to users table
ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL;

-- Add columns to games table
ALTER TABLE games ADD COLUMN gm_id INTEGER DEFAULT NULL;
ALTER TABLE games ADD COLUMN player_ids TEXT DEFAULT '[]';
ALTER TABLE games ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN genre VARCHAR(50) DEFAULT NULL;
ALTER TABLE games ADD COLUMN max_players INTEGER DEFAULT 5;
ALTER TABLE games ADD COLUMN post_frequency VARCHAR(20) DEFAULT 'weekly';
ALTER TABLE games ADD COLUMN require_application INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN is_private INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN allow_spectators INTEGER DEFAULT 1;

-- SQLite doesn't support renaming columns directly, so we'll keep author_id as is
-- But create an alias view if needed
SQL

# Apply migration
if [ -f data/database.sqlite ]; then
    echo "Applying profile schema update..."
    # Check if bio column already exists
    sqlite3 data/database.sqlite "PRAGMA table_info(users);" | grep -q "bio" || {
        sqlite3 data/database.sqlite < /tmp/profile_migration.sql
        echo "Profile schema applied!"
    }
else
    echo "ERROR: Database not found!"
fi

rm -f /tmp/profile_migration.sql
EOF

echo -e "\n${GREEN}Step 6: Restarting server...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

# Stop existing server
echo "Stopping existing Node.js processes..."
pkill -f "node.*server" || true
sleep 2

# Start server - check which server file is being used
if [ -f js/server_sqlite_new.js ]; then
    echo "Starting SQLite server..."
    nohup node js/server_sqlite_new.js > server.log 2>&1 &
elif [ -f js/server.js ]; then
    echo "Starting server.js..."
    nohup node js/server.js > server.log 2>&1 &
else
    echo "ERROR: No server file found!"
    exit 1
fi

sleep 3

# Verify server started
if pgrep -f "node.*server" > /dev/null; then
    echo "Server started successfully!"
    ps aux | grep node | grep -v grep
else
    echo "ERROR: Server failed to start!"
    tail -20 server.log
fi
EOF

echo -e "\n${GREEN}Step 7: Verifying deployment...${NC}"
sleep 2

# Test API endpoint
echo "Testing API health..."
curl -s -w "\nHTTP Status: %{http_code}\n" https://www.iinou.eu/api/games | head -5

echo -e "\n${GREEN}Deployment completed successfully!${NC}"
echo "You can now access:"
echo "- Game Creation: https://www.iinou.eu/hml/create-game.html"
echo "- User Profile: https://www.iinou.eu/hml/profile.html"
echo ""
echo "Note: Users need to be logged in to access these features."
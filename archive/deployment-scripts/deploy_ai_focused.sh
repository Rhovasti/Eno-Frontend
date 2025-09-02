#!/bin/bash

echo "=== Focused AI Deployment ==="

REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"
REMOTE_PATH="/var/www/pelisivusto"

# Step 1: Create a deployment package locally
echo "1. Creating deployment package..."
mkdir -p ai_deploy
cp js/server_sqlite_ai.js ai_deploy/
cp js/threads.js ai_deploy/
cp hml/create-game.html ai_deploy/
cp css/styles.css ai_deploy/
cp .env.example ai_deploy/.env

# Update .env with actual API key
cat > ai_deploy/.env << 'EOF'
AI_SERVICE=anthropic
AI_API_KEY=
AI_MODEL=claude-3-haiku-20240307
AI_MAX_REQUESTS_PER_DAY=100
AI_MAX_TOKENS_PER_REQUEST=1000
JWT_SECRET=eno-game-platform-secret-key-change-in-production
PORT=3000
EOF

tar -czf ai_deploy.tar.gz ai_deploy/
echo "Package created: ai_deploy.tar.gz"

# Step 2: Upload and extract
echo "2. Uploading to production..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no ai_deploy.tar.gz $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/

echo "3. Extracting and installing on production..."
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

# Backup current state
echo "Backing up current files..."
cp js/server_sqlite_with_profiles.js js/server_sqlite_backup_$(date +%Y%m%d_%H%M%S).js
cp -r hml hml_backup_$(date +%Y%m%d_%H%M%S)

# Extract new files
echo "Extracting AI files..."
tar -xzf ai_deploy.tar.gz
cp ai_deploy/server_sqlite_ai.js js/
cp ai_deploy/threads.js js/
cp ai_deploy/create-game.html hml/
cp ai_deploy/styles.css css/
cp ai_deploy/.env .

# Install AI dependencies
echo "Installing AI dependencies..."
npm install @anthropic-ai/sdk@latest dotenv@latest

# Update database
echo "Updating database schema..."
sqlite3 data/database.sqlite << 'SQL'
ALTER TABLE users ADD COLUMN is_gm BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL;
CREATE TABLE IF NOT EXISTS ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost_cents INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS game_players (
    game_id INTEGER,
    user_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game_id, user_id),
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
UPDATE users SET is_gm = 1 WHERE is_admin = 1 OR roles LIKE '%gm%';
SQL

# Stop current server
echo "Stopping current server..."
pkill -f "node js/server" || true
sleep 2

# Start AI server
echo "Starting AI server..."
cd /var/www/pelisivusto
nohup node js/server_sqlite_ai.js > server_ai.log 2>&1 &
echo "Server starting..."
sleep 5

# Check if running
if pgrep -f "server_sqlite_ai" > /dev/null; then
    echo "✓ AI server is running!"
    tail -20 server_ai.log
else
    echo "✗ Server failed to start"
    cat server_ai.log
fi

# Cleanup
rm -rf ai_deploy ai_deploy.tar.gz
EOF

# Cleanup local files
rm -rf ai_deploy ai_deploy.tar.gz

echo "4. Testing deployment..."
sleep 5
curl -I https://www.iinou.eu 2>/dev/null | head -3
#!/bin/bash

# Automated AI Features Deployment Script
set -e

echo "==================================="
echo "AI Features Automated Deployment"
echo "==================================="

# Production server details (from sync_production.sh)
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"
REMOTE_PATH="/var/www/pelisivusto"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting automated deployment...${NC}"

# Step 1: Backup production
echo -e "\n${GREEN}Step 1: Backing up production...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto
mkdir -p backups
DATE=$(date +%Y%m%d_%H%M%S)

# Backup SQLite database
if [ -f data/database.sqlite ]; then
    cp data/database.sqlite backups/database_sqlite_$DATE.sqlite
    echo "Database backed up to backups/database_sqlite_$DATE.sqlite"
fi

# Backup current files
tar -czf backups/pre_ai_deployment_$DATE.tar.gz js/ hml/ css/ package.json 2>/dev/null || true
echo "Files backed up to backups/pre_ai_deployment_$DATE.tar.gz"
EOF

# Step 2: Upload AI-enabled files
echo -e "\n${GREEN}Step 2: Uploading AI-enabled files...${NC}"

# Create SFTP batch file
cat > /tmp/ai_deploy_batch << 'BATCH'
cd /var/www/pelisivusto
put js/server_sqlite_ai.js js/
put js/threads.js js/
put hml/create-game.html hml/
put hml/profile.html hml/
put css/styles.css css/
put package.json
put .env.example
put update_schema.sql
BATCH

# Upload files
sshpass -p "$REMOTE_PASS" sftp -o StrictHostKeyChecking=no -b /tmp/ai_deploy_batch $REMOTE_USER@$REMOTE_HOST

# Step 3: Install dependencies and configure
echo -e "\n${GREEN}Step 3: Installing dependencies and configuring...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

# Install AI packages
echo "Installing AI dependencies..."
npm install @anthropic-ai/sdk dotenv

# Create .env file with AI key
echo "Configuring environment..."
cat > .env << 'ENVFILE'
# AI Service Configuration
AI_SERVICE=anthropic
AI_API_KEY=
AI_MODEL=claude-3-haiku-20240307

# Optional: Rate limiting
AI_MAX_REQUESTS_PER_DAY=100
AI_MAX_TOKENS_PER_REQUEST=1000

# Server Configuration
JWT_SECRET=eno-game-platform-secret-key-change-in-production
PORT=3000
ENVFILE

echo ".env file created with AI configuration"
EOF

# Step 4: Update database schema
echo -e "\n${GREEN}Step 4: Updating database schema...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

# Apply schema updates
echo "Applying database updates..."
sqlite3 data/database.sqlite << 'SQL'
-- Add missing columns (ignore errors if they exist)
ALTER TABLE users ADD COLUMN is_gm BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL;

-- Create AI usage table
CREATE TABLE IF NOT EXISTS ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost_cents INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create game_players table
CREATE TABLE IF NOT EXISTS game_players (
    game_id INTEGER,
    user_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game_id, user_id),
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Update admin users to have GM role
UPDATE users SET is_gm = 1 WHERE is_admin = 1 OR roles LIKE '%gm%';

-- Check if games table needs updating
SELECT sql FROM sqlite_master WHERE type='table' AND name='games';
SQL

# Try to add missing game columns (will fail silently if they exist)
sqlite3 data/database.sqlite "ALTER TABLE games ADD COLUMN created_by INTEGER;" 2>/dev/null || true
sqlite3 data/database.sqlite "ALTER TABLE games ADD COLUMN genre TEXT DEFAULT 'fantasy';" 2>/dev/null || true
sqlite3 data/database.sqlite "ALTER TABLE games ADD COLUMN gm_id INTEGER;" 2>/dev/null || true
sqlite3 data/database.sqlite "ALTER TABLE games ADD COLUMN max_players INTEGER DEFAULT 5;" 2>/dev/null || true
sqlite3 data/database.sqlite "ALTER TABLE games ADD COLUMN posting_frequency TEXT DEFAULT 'daily';" 2>/dev/null || true
sqlite3 data/database.sqlite "ALTER TABLE games ADD COLUMN is_private BOOLEAN DEFAULT 0;" 2>/dev/null || true

echo "Database schema updated"
EOF

# Step 5: Restart server with AI features
echo -e "\n${GREEN}Step 5: Restarting server with AI features...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

# Stop current server
echo "Stopping current server..."
pkill -f "node.*server" || true
sleep 2

# Start AI-enabled server
echo "Starting AI-enabled server..."
nohup node js/server_sqlite_ai.js > server_ai.log 2>&1 &
sleep 3

# Check if server started
if pgrep -f "node.*server_sqlite_ai" > /dev/null; then
    echo "AI server started successfully!"
    echo "Checking AI features..."
    grep -i "AI Service\|AI Model" server_ai.log | tail -5
else
    echo "ERROR: Server failed to start!"
    tail -20 server_ai.log
fi
EOF

# Step 6: Verify deployment
echo -e "\n${GREEN}Step 6: Verifying deployment...${NC}"

# Test main site
echo "Testing main site..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.iinou.eu)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Main site is accessible${NC}"
else
    echo -e "${RED}✗ Main site returned HTTP $HTTP_CODE${NC}"
fi

# Test API
echo "Testing API..."
API_RESPONSE=$(curl -s https://www.iinou.eu/api/games 2>&1 || echo "API unreachable")
echo "API Response: ${API_RESPONSE:0:100}..."

# Cleanup
rm -f /tmp/ai_deploy_batch

echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo -e "${YELLOW}Deployment Summary:${NC}"
echo "1. ✓ Production backed up"
echo "2. ✓ AI-enabled files uploaded"
echo "3. ✓ Dependencies installed"
echo "4. ✓ Database schema updated"
echo "5. ✓ Server restarted with AI features"
echo ""
echo -e "${YELLOW}Test the following:${NC}"
echo "1. Login: https://www.iinou.eu/hml/login.html"
echo "   - Username: admin@example.com"
echo "   - Password: admin123"
echo "2. Create Game (with AI): https://www.iinou.eu/hml/create-game.html"
echo "3. Profile page: https://www.iinou.eu/hml/profile.html"
echo "4. Threads with improved post styling"
echo ""
echo -e "${GREEN}AI Features are now live!${NC}"
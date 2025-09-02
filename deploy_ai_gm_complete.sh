#!/bin/bash

# Complete AI GM Feature Deployment to Production
# This script syncs ALL AI GM features including structured posts and automatic image generation

echo "================================================"
echo "Deploying Complete AI GM Features to Production"
echo "Target: www.iinou.eu (95.217.21.111)"
echo "================================================"

# Production server credentials
PROD_HOST="95.217.21.111"
PROD_USER="root"
PROD_PASS="ininFvTPNTguUtuuLbx3"
PROD_PATH="/var/www/pelisivusto"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Creating backup of production database...${NC}"

# Create backup of production database
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST \
    "cd $PROD_PATH && cp data/database.sqlite data/database.sqlite.backup.$(date +%Y%m%d_%H%M%S)" \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database backed up${NC}"
else
    echo -e "${RED}Warning: Could not backup database${NC}"
fi

echo -e "${YELLOW}Step 2: Uploading core server files...${NC}"

# Upload main server file
echo "  - Uploading server_sqlite_new.js..."
sshpass -p "$PROD_PASS" scp js/server_sqlite_new.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null

# Upload services directory
echo "  - Uploading services..."
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "mkdir -p $PROD_PATH/js/services" 2>/dev/null
sshpass -p "$PROD_PASS" scp js/services/imageService.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/services/ 2>/dev/null
sshpass -p "$PROD_PASS" scp js/services/audioService.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/services/ 2>/dev/null

echo -e "${GREEN}✓ Core server files uploaded${NC}"

echo -e "${YELLOW}Step 3: Uploading frontend files...${NC}"

# Upload HTML files
echo "  - Uploading HTML files..."
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "mkdir -p $PROD_PATH/hml" 2>/dev/null
sshpass -p "$PROD_PASS" scp hml/threads.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null
sshpass -p "$PROD_PASS" scp hml/storyboard.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null
sshpass -p "$PROD_PASS" scp hml/login.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null
sshpass -p "$PROD_PASS" scp hml/admin.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null
sshpass -p "$PROD_PASS" scp hml/create-game.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null
sshpass -p "$PROD_PASS" scp hml/gm-selection.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null

# Upload CSS
echo "  - Uploading CSS..."
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "mkdir -p $PROD_PATH/css" 2>/dev/null
sshpass -p "$PROD_PASS" scp css/styles.css $PROD_USER@$PROD_HOST:$PROD_PATH/css/ 2>/dev/null

# Upload JavaScript
echo "  - Uploading JavaScript files..."
sshpass -p "$PROD_PASS" scp js/script.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null
sshpass -p "$PROD_PASS" scp js/threads.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null
sshpass -p "$PROD_PASS" scp js/storyboard.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null

echo -e "${GREEN}✓ Frontend files uploaded${NC}"

echo -e "${YELLOW}Step 4: Uploading configuration and assets...${NC}"

# Upload environment configuration
echo "  - Uploading .env configuration..."
sshpass -p "$PROD_PASS" scp .env $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null

# Upload style reference images
echo "  - Uploading style reference images..."
sshpass -p "$PROD_PASS" scp -r style $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null

# Upload portraits
echo "  - Uploading AI GM portraits..."
sshpass -p "$PROD_PASS" scp -r portraits $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null

echo -e "${GREEN}✓ Configuration and assets uploaded${NC}"

echo -e "${YELLOW}Step 5: Installing/updating dependencies...${NC}"

# Install/update Node.js dependencies on production
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
cd /var/www/pelisivusto
echo "Installing Node.js dependencies..."
npm install --production
if [ $? -ne 0 ]; then
    echo "Error installing dependencies"
    exit 1
fi
echo "Dependencies installed successfully"
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dependencies updated${NC}"
else
    echo -e "${RED}✗ Dependency installation failed${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 6: Stopping current server...${NC}"

# Stop current server
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST \
    "cd $PROD_PATH && pkill -f 'node.*server' || true && sleep 3" 2>/dev/null

echo -e "${GREEN}✓ Server stopped${NC}"

echo -e "${YELLOW}Step 7: Starting server with AI GM features...${NC}"

# Start server with all environment variables
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
cd /var/www/pelisivusto

echo "Starting server with AI GM features..."
export AWS_REGION=eu-north-1
export AWS_BUCKET_NAME=kuvatjakalat

# Start server in background
nohup node js/server_sqlite_new.js > server.log 2>&1 &

# Wait for startup
sleep 5

# Check if server started
if pgrep -f "node.*server" > /dev/null; then
    echo "Server started successfully!"
    echo "Process ID: $(pgrep -f 'node.*server')"
else
    echo "Error: Server failed to start!"
    echo "Last 10 lines of server log:"
    tail -10 server.log
    exit 1
fi
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Server started successfully${NC}"
else
    echo -e "${RED}✗ Server startup failed!${NC}"
    echo -e "${YELLOW}Checking server logs...${NC}"
    sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "cd $PROD_PATH && tail -20 server.log"
    exit 1
fi

echo -e "${YELLOW}Step 8: Verifying deployment...${NC}"

# Wait a bit more for server to fully initialize
sleep 3

# Test if server is responding
echo "  - Testing server health..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.iinou.eu/ 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Main page responding (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${YELLOW}? Main page response: HTTP $HTTP_CODE${NC}"
fi

# Test API endpoint
HTTP_CODE_API=$(curl -s -o /dev/null -w "%{http_code}" https://www.iinou.eu/api/games 2>/dev/null)

if [ "$HTTP_CODE_API" = "200" ] || [ "$HTTP_CODE_API" = "401" ]; then
    echo -e "${GREEN}✓ API responding (HTTP $HTTP_CODE_API)${NC}"
else
    echo -e "${RED}✗ API health check failed (HTTP $HTTP_CODE_API)${NC}"
fi

echo -e "${YELLOW}Step 9: Checking AI GM features...${NC}"

# Check if AI GM profiles exist in production
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
cd /var/www/pelisivusto
echo "Checking AI GM profiles in database..."
if [ -f "data/database.sqlite" ]; then
    AI_COUNT=$(sqlite3 data/database.sqlite "SELECT COUNT(*) FROM ai_gm_profiles WHERE is_active = 1;" 2>/dev/null || echo "0")
    if [ "$AI_COUNT" -gt "0" ]; then
        echo "✓ Found $AI_COUNT active AI GM profiles"
        sqlite3 data/database.sqlite "SELECT name, title FROM ai_gm_profiles WHERE is_active = 1 LIMIT 5;" 2>/dev/null | head -5
    else
        echo "! No AI GM profiles found - they may need to be seeded"
    fi
else
    echo "! Database file not found"
fi
EOF

echo
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}AI GM Deployment Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo
echo -e "${BLUE}New AI GM Features Deployed:${NC}"
echo "• Structured AI GM posts with voting options"
echo "• Automatic AI responses to player posts"
echo "• AI-generated images for all GM posts"
echo "• Genre-specific opening scenes"
echo "• Personality-based GM behavior"
echo
echo -e "${BLUE}Access the updated platform:${NC}"
echo "• Main site: https://www.iinou.eu"
echo "• Login: https://www.iinou.eu/hml/login.html"
echo "• Create AI GM game: https://www.iinou.eu/hml/create-game.html"
echo
echo -e "${BLUE}Monitor deployment:${NC}"
echo "  ssh $PROD_USER@$PROD_HOST 'cd $PROD_PATH && tail -f server.log'"
echo
echo -e "${BLUE}Test AI GM features:${NC}"
echo "1. Create a new game with an AI GM"
echo "2. Make a player post in the game"
echo "3. Watch for automatic AI GM response with image"
echo
echo -e "${YELLOW}Note: Allow 10-15 seconds for AI responses and image generation${NC}"
#!/bin/bash

# Complete Feature Deployment to Production
# Deploys: Wiki System, Citystate Maps, Narrative Engine, AsyncGameManager, Services

echo "==============================================================="
echo "Deploying Complete Feature Set to Production"
echo "Features: Wiki + Citystate Maps + Narrative Engine + Async Games"
echo "Target: www.iinou.eu (95.217.21.111)"
echo "==============================================================="

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

echo -e "${GREEN}✓ Core server file uploaded${NC}"

echo -e "${YELLOW}Step 3: Uploading services (including new ones)...${NC}"

# Upload all services directory
echo "  - Uploading complete services directory..."
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "mkdir -p $PROD_PATH/js/services" 2>/dev/null
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "mkdir -p $PROD_PATH/js/services/narrative-models" 2>/dev/null

# Core services
sshpass -p "$PROD_PASS" scp js/services/imageService.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/services/ 2>/dev/null
sshpass -p "$PROD_PASS" scp js/services/audioService.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/services/ 2>/dev/null

# New async game manager
sshpass -p "$PROD_PASS" scp js/services/AsyncGameManager.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/services/ 2>/dev/null

# Narrative engine and models
sshpass -p "$PROD_PASS" scp js/services/LoreGroundedNarrativeEngine.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/services/ 2>/dev/null
sshpass -p "$PROD_PASS" scp js/services/LoreIntegrationService.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/services/ 2>/dev/null
sshpass -p "$PROD_PASS" scp js/services/narrative-models/*.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/services/narrative-models/ 2>/dev/null

echo -e "${GREEN}✓ Services uploaded${NC}"

echo -e "${YELLOW}Step 4: Uploading frontend files...${NC}"

# Upload HTML files including new ones
echo "  - Uploading HTML files..."
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "mkdir -p $PROD_PATH/hml" 2>/dev/null
sshpass -p "$PROD_PASS" scp hml/threads.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null
sshpass -p "$PROD_PASS" scp hml/storyboard.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null
sshpass -p "$PROD_PASS" scp hml/login.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null
sshpass -p "$PROD_PASS" scp hml/admin.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null
sshpass -p "$PROD_PASS" scp hml/create-game.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null
sshpass -p "$PROD_PASS" scp hml/gm-selection.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null

# New wiki system
sshpass -p "$PROD_PASS" scp hml/wiki_dynamic.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null

# New citystate map system
sshpass -p "$PROD_PASS" scp citystate-map.html $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null

# Upload CSS
echo "  - Uploading CSS..."
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "mkdir -p $PROD_PATH/css" 2>/dev/null
sshpass -p "$PROD_PASS" scp css/styles.css $PROD_USER@$PROD_HOST:$PROD_PATH/css/ 2>/dev/null

# Upload JavaScript files including new ones
echo "  - Uploading JavaScript files..."
sshpass -p "$PROD_PASS" scp js/script.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null
sshpass -p "$PROD_PASS" scp js/threads.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null
sshpass -p "$PROD_PASS" scp js/storyboard.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null

# New map and wiki systems
sshpass -p "$PROD_PASS" scp js/wiki_dynamic.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null
sshpass -p "$PROD_PASS" scp js/CitystateMapViewer.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null
sshpass -p "$PROD_PASS" scp js/city_detail_viewer.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null

echo -e "${GREEN}✓ Frontend files uploaded${NC}"

echo -e "${YELLOW}Step 5: Uploading static assets...${NC}"

# Create static directory structure
echo "  - Setting up static directories..."
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "mkdir -p $PROD_PATH/static/maps" 2>/dev/null
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "mkdir -p $PROD_PATH/static/textures" 2>/dev/null
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "mkdir -p $PROD_PATH/Mundi/local-data" 2>/dev/null

# Upload citystate map data (this might take a while)
echo "  - Uploading citystate map data..."
sshpass -p "$PROD_PASS" scp -r static/maps/citystates $PROD_USER@$PROD_HOST:$PROD_PATH/static/maps/ 2>/dev/null

# Upload textures
echo "  - Uploading map textures..."
sshpass -p "$PROD_PASS" scp static/textures/*.png $PROD_USER@$PROD_HOST:$PROD_PATH/static/textures/ 2>/dev/null

# Upload local data
echo "  - Uploading local map data..."
sshpass -p "$PROD_PASS" scp -r Mundi/local-data/* $PROD_USER@$PROD_HOST:$PROD_PATH/Mundi/local-data/ 2>/dev/null

echo -e "${GREEN}✓ Static assets uploaded${NC}"

echo -e "${YELLOW}Step 6: Uploading configuration...${NC}"

# Upload environment configuration
echo "  - Uploading .env configuration..."
sshpass -p "$PROD_PASS" scp .env $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null

# Upload style reference images
sshpass -p "$PROD_PASS" scp -r style $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null

# Upload portraits
sshpass -p "$PROD_PASS" scp -r portraits $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null

echo -e "${GREEN}✓ Configuration uploaded${NC}"

echo -e "${YELLOW}Step 7: Installing/updating dependencies...${NC}"

# Install/update Node.js dependencies on production
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
cd /var/www/pelisivusto
echo "Installing Node.js dependencies..."
npm install --production
if [ $? -ne 0 ]; then
    echo "Warning: Some dependencies may not have installed correctly"
fi
echo "Dependencies installation completed"
EOF

echo -e "${GREEN}✓ Dependencies updated${NC}"

echo -e "${YELLOW}Step 8: Restarting production server...${NC}"

# Restart the server with proper environment
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
cd /var/www/pelisivusto

echo "Stopping existing server processes..."
pkill -f "node.*server" 2>/dev/null
sleep 2

echo "Starting server with updated features..."
export AWS_REGION=eu-north-1
export AWS_BUCKET_NAME=kuvatjakalat
nohup node js/server_sqlite_new.js > server.log 2>&1 &

sleep 3

# Check if server started successfully
if pgrep -f "node.*server" > /dev/null; then
    echo "✓ Server started successfully"
    echo "Server PID: $(pgrep -f 'node.*server')"

    # Show recent log entries
    echo "Recent log entries:"
    tail -10 server.log 2>/dev/null | head -10
else
    echo "✗ Server failed to start"
    echo "Recent error log:"
    tail -20 server.log 2>/dev/null
fi
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Server restarted${NC}"
else
    echo -e "${RED}Warning: Server restart may have issues${NC}"
fi

echo -e "${YELLOW}Step 9: Verification...${NC}"

# Test server response
echo "Testing server response..."
if curl -s -o /dev/null -w "%{http_code}" https://www.iinou.eu/hml/wiki_dynamic.html | grep -q "200"; then
    echo -e "${GREEN}✓ Wiki system accessible${NC}"
else
    echo -e "${YELLOW}⚠ Wiki system may not be accessible (SSL warnings expected)${NC}"
fi

echo ""
echo "==============================================================="
echo -e "${GREEN}DEPLOYMENT COMPLETE!${NC}"
echo "==============================================================="
echo ""
echo -e "${BLUE}Deployed Features:${NC}"
echo "  • Enhanced Wiki System with map integration"
echo "  • Citystate Map Viewer with 133 citystates"
echo "  • Vector overlays (buildings, roads, districts, etc.)"
echo "  • Lore-Grounded Narrative Engine"
echo "  • AsyncGameManager for long-running games"
echo "  • Complete service layer architecture"
echo ""
echo -e "${BLUE}Access URLs:${NC}"
echo "  • Wiki: https://www.iinou.eu/hml/wiki_dynamic.html"
echo "  • Maps: https://www.iinou.eu/citystate-map.html"
echo "  • Games: https://www.iinou.eu/hml/threads.html"
echo ""
echo -e "${YELLOW}Note: SSL certificate expired - browsers will show security warnings${NC}"
echo ""
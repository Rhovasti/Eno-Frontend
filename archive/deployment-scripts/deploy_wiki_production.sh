#!/bin/bash

# Deploy Dynamic Wiki with Eno Tilemap to Production (iinou.eu)
# This script deploys the wiki system with custom Eno world tilemap

echo "================================================"
echo "Deploying Dynamic Wiki with Eno Tilemap to Production"
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
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Backing up production database...${NC}"

# Create backup of production database
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST \
    "cd $PROD_PATH && cp data/database.sqlite data/database.sqlite.backup.wiki.$(date +%Y%m%d_%H%M%S)" \
    2>/dev/null

echo -e "${GREEN}✓ Database backed up${NC}"

echo -e "${YELLOW}Step 2: Deploying wiki files...${NC}"

# Deploy wiki HTML file
sshpass -p "$PROD_PASS" scp hml/wiki_dynamic.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null
echo -e "${GREEN}✓ Wiki HTML deployed${NC}"

# Deploy wiki JavaScript
sshpass -p "$PROD_PASS" scp js/wiki_dynamic.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null
echo -e "${GREEN}✓ Wiki JavaScript deployed${NC}"

# Deploy updated server with wiki routes
sshpass -p "$PROD_PASS" scp js/server_sqlite_new.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null
echo -e "${GREEN}✓ Server updates deployed${NC}"

echo -e "${YELLOW}Step 3: Restarting production server...${NC}"

# Restart the Node.js server
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
cd /var/www/pelisivusto
# Kill existing Node process
pkill -f "node.*server_sqlite_new.js" || true
sleep 2
# Start server with nohup
nohup node js/server_sqlite_new.js > server.log 2>&1 &
echo "Server restarted"
EOF

echo -e "${GREEN}✓ Server restarted${NC}"

echo ""
echo "================================================"
echo -e "${GREEN}Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "📍 Wiki Access URL:"
echo "   https://www.iinou.eu/wiki_dynamic.html"
echo ""
echo "🗺️ Custom Eno World Tiles:"
echo "   Served from: https://rhovasti.github.io/eno-tiles/"
echo "   Format: TMS with Y-axis inversion"
echo ""
echo "📊 Features Deployed:"
echo "   - Dynamic wiki system with CRUD operations"
echo "   - Custom Eno world satellite basemap"
echo "   - Geospatial layers (cities, villages, rivers, lakes)"
echo "   - Wiki-to-map location linkage"
echo "   - D3.js relationship graph"
echo "   - Version history tracking"
echo ""
echo "⚠️  Notes:"
echo "   - Wiki tables will be auto-created on first run"
echo "   - Existing game data remains intact"
echo "   - Check server.log if issues occur"
echo ""
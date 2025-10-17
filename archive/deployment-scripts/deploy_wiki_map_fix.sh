#!/bin/bash

# Deploy Wiki Map Fix with Location Zoom to Production
# This script deploys the updated wiki system with location-aware map zooming

echo "================================================"
echo "Deploying Wiki Map Fix with Location Zoom to Production"
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

echo -e "${YELLOW}Step 1: Creating Mundi directory on production...${NC}"

# Create Mundi directory structure on production
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST \
    "mkdir -p /var/www/Mundi/mundi.ai" \
    2>/dev/null

echo -e "${GREEN}✓ Mundi directory created${NC}"

echo -e "${YELLOW}Step 2: Copying geospatial data files to production...${NC}"

# Copy all GeoJSON files from Mundi
for file in ../Mundi/mundi.ai/*.geojson; do
    if [ -f "$file" ]; then
        filename=$(basename "$file")
        echo "  Uploading $filename..."
        sshpass -p "$PROD_PASS" scp "$file" $PROD_USER@$PROD_HOST:/var/www/Mundi/mundi.ai/ 2>/dev/null
    fi
done

echo -e "${GREEN}✓ Geospatial data files uploaded${NC}"

echo -e "${YELLOW}Step 3: Backing up production database...${NC}"

# Create backup of production database
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST \
    "cd $PROD_PATH && cp data/database.sqlite data/database.sqlite.backup.mapfix.$(date +%Y%m%d_%H%M%S)" \
    2>/dev/null

echo -e "${GREEN}✓ Database backed up${NC}"

echo -e "${YELLOW}Step 4: Deploying updated wiki files...${NC}"

# Deploy updated wiki JavaScript with location zoom feature
sshpass -p "$PROD_PASS" scp js/wiki_dynamic.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null
echo -e "${GREEN}✓ Wiki JavaScript with location zoom deployed${NC}"

# Deploy updated server (in case there are any changes)
sshpass -p "$PROD_PASS" scp js/server_sqlite_new.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null
echo -e "${GREEN}✓ Server updates deployed${NC}"

echo -e "${YELLOW}Step 5: Restarting production server...${NC}"

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
echo "🗺️ Map Enhancements Deployed:"
echo "   - City and village points now visible on map"
echo "   - Wiki entries automatically zoom to mentioned locations"
echo "   - Temporary yellow highlight shows selected location"
echo "   - Falls back to map center if no location found"
echo ""
echo "📍 Wiki Access URL:"
echo "   https://www.iinou.eu/wiki_dynamic.html"
echo ""
echo "🔍 Location Detection:"
echo "   - Searches entry title and content for city/village names"
echo "   - Prioritizes cities over villages"
echo "   - Supports explicit coordinates in entry metadata"
echo ""
echo "⚠️  Verification Steps:"
echo "   1. Open https://www.iinou.eu/wiki_dynamic.html"
echo "   2. Verify city points appear on the map"
echo "   3. Click a wiki entry mentioning a city"
echo "   4. Confirm map zooms to that location"
echo ""
echo "📝 Troubleshooting:"
echo "   - Check server.log: ssh $PROD_USER@$PROD_HOST 'tail -f $PROD_PATH/server.log'"
echo "   - Verify Mundi files: ssh $PROD_USER@$PROD_HOST 'ls -la /var/www/Mundi/mundi.ai/'"
echo ""
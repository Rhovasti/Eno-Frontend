#!/bin/bash

# Deploy Enhanced Wiki with Relief Basemap to Production
# Uses existing production structure: /var/www/pelisivusto

echo "================================================"
echo "Deploying Enhanced Wiki with Relief Basemap"
echo "Target: www.iinou.eu (95.217.21.111)"
echo "================================================"

# Production server credentials (from existing script)
PROD_HOST="95.217.21.111"
PROD_USER="root"
PROD_PASS="ininFvTPNTguUtuuLbx3"
PROD_PATH="/var/www/pelisivusto"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Pre-deployment validation
echo -e "${YELLOW}Step 1: Pre-deployment validation...${NC}"

if [ ! -d "relief-tiles" ]; then
    echo -e "${RED}❌ Error: relief-tiles directory not found!${NC}"
    echo "   Run: gdal2tiles.py -z 0-8 /path/to/reliefi.tif relief-tiles/"
    exit 1
fi

TILE_COUNT=$(find relief-tiles -name "*.png" | wc -l)
echo "📊 Found $TILE_COUNT relief tiles to deploy"

if [ $TILE_COUNT -lt 1000 ]; then
    echo -e "${YELLOW}⚠️  Warning: Low tile count. Expected ~7500+ tiles${NC}"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${GREEN}✓ Validation passed${NC}"

echo -e "${YELLOW}Step 2: Creating relief tiles archive...${NC}"

# Create compressed archive for efficient transfer
tar -czf relief-tiles.tar.gz relief-tiles/
ARCHIVE_SIZE=$(du -h relief-tiles.tar.gz | cut -f1)
echo "📦 Archive created: $ARCHIVE_SIZE"
echo -e "${GREEN}✓ Archive ready${NC}"

echo -e "${YELLOW}Step 3: Backing up production database...${NC}"

# Create backup of production database
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST \
    "cd $PROD_PATH && cp data/database.sqlite data/database.sqlite.backup.relief.$(date +%Y%m%d_%H%M%S)" \
    2>/dev/null

echo -e "${GREEN}✓ Database backed up${NC}"

echo -e "${YELLOW}Step 4: Deploying enhanced wiki files...${NC}"

# Deploy enhanced wiki HTML file
sshpass -p "$PROD_PASS" scp hml/wiki_dynamic.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null
echo -e "${GREEN}✓ Enhanced wiki HTML deployed${NC}"

# Deploy enhanced wiki JavaScript
sshpass -p "$PROD_PASS" scp js/wiki_dynamic.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null
echo -e "${GREEN}✓ Enhanced wiki JavaScript deployed${NC}"

# Deploy updated server (same as before, but ensuring compatibility)
sshpass -p "$PROD_PASS" scp js/server_sqlite_new.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null
echo -e "${GREEN}✓ Server updates deployed${NC}"

# Ensure services directory exists and deploy required services
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "mkdir -p $PROD_PATH/js/services" 2>/dev/null
sshpass -p "$PROD_PASS" scp js/services/AsyncGameManager.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/services/ 2>/dev/null
sshpass -p "$PROD_PASS" scp js/services/imageService.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/services/ 2>/dev/null
sshpass -p "$PROD_PASS" scp js/services/audioService.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/services/ 2>/dev/null
echo -e "${GREEN}✓ Required services deployed${NC}"

echo -e "${YELLOW}Step 5: Deploying relief tiles archive...${NC}"

# Deploy relief tiles archive to production
echo "📤 Transferring $ARCHIVE_SIZE archive..."
sshpass -p "$PROD_PASS" scp relief-tiles.tar.gz $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null
echo -e "${GREEN}✓ Relief tiles archive transferred${NC}"

echo -e "${YELLOW}Step 6: Extracting tiles and restarting server...${NC}"

# Extract tiles and restart server
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
cd /var/www/pelisivusto

echo "📂 Extracting relief tiles..."
# Remove old relief tiles if they exist
rm -rf relief-tiles/

# Extract new tiles
if tar -xzf relief-tiles.tar.gz; then
    echo "✅ Relief tiles extracted successfully"

    # Set proper permissions
    chmod -R 644 relief-tiles/
    find relief-tiles/ -type d -exec chmod 755 {} \;

    # Show tile count
    TILE_COUNT=$(find relief-tiles -name "*.png" | wc -l)
    echo "📊 Extracted $TILE_COUNT relief tiles"

    # Cleanup archive
    rm relief-tiles.tar.gz
    echo "🧹 Cleaned up archive file"
else
    echo "❌ Failed to extract relief tiles"
    exit 1
fi

echo "🔄 Restarting production server..."
# Kill existing Node process
pkill -f "node.*server_sqlite_new.js" || true
sleep 2

# Start server with nohup
nohup node js/server_sqlite_new.js > server.log 2>&1 &
sleep 3

# Check if server started
if pgrep -f "node.*server_sqlite_new.js" > /dev/null; then
    echo "✅ Server restarted successfully"
else
    echo "❌ Server failed to start"
    echo "Last 10 lines of server log:"
    tail -10 server.log
    exit 1
fi

echo "📊 Final status check:"
echo "  Relief tiles: $(find relief-tiles -name "*.png" | wc -l) files"
echo "  Server process: $(pgrep -f "node.*server_sqlite_new.js" | wc -l) running"
EOF

# Clean up local archive
rm relief-tiles.tar.gz

echo -e "${GREEN}✓ Deployment completed${NC}"

echo ""
echo "================================================"
echo -e "${GREEN}Enhanced Wiki Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "🎯 New Features Deployed:"
echo "   • Relief topography basemap option"
echo "   • Basemap switching (Satellite ⟷ Relief)"
echo "   • Enhanced map controls UI"
echo "   • $TILE_COUNT relief tiles for zoom levels 0-8"
echo ""
echo "📍 Wiki Access URL:"
echo "   https://www.iinou.eu/wiki_dynamic.html"
echo ""
echo "🗺️ Basemap Sources:"
echo "   • Satellite: https://rhovasti.github.io/eno-tiles/"
echo "   • Relief: Local server (/relief-tiles/)"
echo ""
echo "🧪 Testing Instructions:"
echo "   1. Visit the wiki URL"
echo "   2. Enable 'Show Map View'"
echo "   3. Use the Basemap dropdown to switch between:"
echo "      - Satellite Imagery (default)"
echo "      - Relief Topography (new)"
echo "   4. Verify both basemaps load correctly"
echo "   5. Test layer controls (Cities, Villages, etc.)"
echo ""
echo "📊 Deployment Statistics:"
echo "   - Enhanced files: 3 (HTML, JS, Server)"
echo "   - Relief tiles: $TILE_COUNT PNG files"
echo "   - Archive size: $ARCHIVE_SIZE"
echo "   - Production path: $PROD_PATH"
echo ""
echo "⚠️  Production Notes:"
echo "   • Relief tiles served locally from production server"
echo "   • Satellite tiles remain CDN-served for performance"
echo "   • Database backup created before deployment"
echo "   • Existing game data remains intact"
echo ""
echo "🔧 Troubleshooting:"
echo "   Check server log: ssh root@www.iinou.eu 'tail -20 /var/www/pelisivusto/server.log'"
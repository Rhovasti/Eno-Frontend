#!/bin/bash

# Deploy Enhanced Wiki with Relief Basemap to Production Server
# Target: www.iinou.eu
# Features: Satellite + Relief basemap switching, enhanced map controls

echo "🚀 Deploying Enhanced Wiki System with Relief Basemap to Production..."

# Server details
SERVER="root@www.iinou.eu"
REMOTE_PATH="/var/www/html"
REMOTE_APP_PATH="/root/Eno-Frontend"

# Pre-deployment checks
echo "🔍 Pre-deployment validation..."
if [ ! -d "relief-tiles" ]; then
    echo "❌ Error: relief-tiles directory not found!"
    echo "   Run: gdal2tiles.py -z 0-8 /path/to/reliefi.tif relief-tiles/"
    exit 1
fi

TILE_COUNT=$(find relief-tiles -name "*.png" | wc -l)
echo "📊 Found $TILE_COUNT relief tiles to deploy"

if [ $TILE_COUNT -lt 1000 ]; then
    echo "⚠️  Warning: Low tile count. Expected ~7500+ tiles"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Deploy core wiki files
echo "📦 Deploying enhanced wiki files..."
scp hml/wiki_dynamic.html $SERVER:$REMOTE_PATH/hml/
scp js/wiki_dynamic.js $SERVER:$REMOTE_PATH/js/
scp js/server_sqlite_new.js $SERVER:$REMOTE_PATH/js/

# Deploy application files to runtime directory
echo "📄 Deploying server files to app directory..."
scp hml/wiki_dynamic.html $SERVER:$REMOTE_APP_PATH/hml/
scp js/wiki_dynamic.js $SERVER:$REMOTE_APP_PATH/js/
scp js/server_sqlite_new.js $SERVER:$REMOTE_APP_PATH/js/

# Deploy relief tiles
echo "🗺️  Deploying relief tiles (this may take several minutes)..."
echo "   Compressing and transferring $TILE_COUNT tiles..."

# Create compressed archive of tiles
tar -czf relief-tiles.tar.gz relief-tiles/
scp relief-tiles.tar.gz $SERVER:$REMOTE_APP_PATH/

# Extract tiles on remote server
echo "📂 Extracting relief tiles on production server..."
ssh $SERVER << 'EOF'
cd /root/Eno-Frontend
# Remove old relief tiles if they exist
rm -rf relief-tiles/
# Extract new tiles
tar -xzf relief-tiles.tar.gz
# Cleanup archive
rm relief-tiles.tar.gz
# Set proper permissions
chmod -R 644 relief-tiles/
find relief-tiles/ -type d -exec chmod 755 {} \;
echo "Relief tiles extracted successfully"
EOF

# Clean up local archive
rm relief-tiles.tar.gz

# Restart Node.js server on production
echo "🔄 Restarting production server..."
ssh $SERVER << 'EOF'
cd /root/Eno-Frontend
# Kill existing Node process
pkill -f "node.*server_sqlite_new.js" || true
sleep 2
# Start server in background
nohup node js/server_sqlite_new.js > server.log 2>&1 &
sleep 3
# Check if server started
if pgrep -f "node.*server_sqlite_new.js" > /dev/null; then
    echo "✅ Server restarted successfully"
else
    echo "❌ Server failed to start. Check server.log"
    tail -10 server.log
fi
EOF

echo "✅ Enhanced Wiki Deployment Complete!"
echo ""
echo "🎯 New Features Deployed:"
echo "   • Relief topography basemap option"
echo "   • Basemap switching (Satellite ⟷ Relief)"
echo "   • Enhanced map controls UI"
echo "   • $TILE_COUNT relief tiles for zoom levels 0-8"
echo ""
echo "📍 Access the enhanced wiki at:"
echo "   https://www.iinou.eu/wiki_dynamic.html"
echo ""
echo "🗺️  Basemap Sources:"
echo "   • Satellite: https://rhovasti.github.io/eno-tiles/"
echo "   • Relief: Local server (/relief-tiles/)"
echo ""
echo "🧪 Testing Instructions:"
echo "   1. Open the wiki and enable 'Show Map View'"
echo "   2. Use the Basemap dropdown to switch between:"
echo "      - Satellite Imagery (default)"
echo "      - Relief Topography (new)"
echo "   3. Verify both basemaps load correctly"
echo "   4. Test layer controls (Cities, Villages, etc.)"
echo ""
echo "⚠️  Production Notes:"
echo "   • Relief tiles served locally (~$(du -sh relief-tiles/ 2>/dev/null | cut -f1) storage)"
echo "   • Satellite tiles remain CDN-served for performance"
echo "   • Database starts fresh for wiki entries"
echo "   • Game data remains intact"
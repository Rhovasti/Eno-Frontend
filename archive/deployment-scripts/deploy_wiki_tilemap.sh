#!/bin/bash

# Deploy Wiki with Custom Tilemap to Production Server
# Target: www.iinou.eu

echo "🚀 Deploying Wiki Dynamic System with Eno World Tilemap to Production..."

# Server details
SERVER="root@www.iinou.eu"
REMOTE_PATH="/var/www/html"

# Files to deploy
echo "📦 Deploying wiki and map files..."
scp hml/wiki_dynamic.html $SERVER:$REMOTE_PATH/hml/
scp js/wiki_dynamic.js $SERVER:$REMOTE_PATH/js/
scp js/server_sqlite_new.js $SERVER:$REMOTE_PATH/js/

# Deploy API updates (if server.js is used in production)
echo "📄 Deploying server updates..."
scp js/server_sqlite_new.js $SERVER:/root/Eno-Frontend/js/

# Restart Node.js server on production
echo "🔄 Restarting production server..."
ssh $SERVER << 'EOF'
cd /root/Eno-Frontend
# Kill existing Node process
pkill -f "node.*server_sqlite_new.js" || true
# Start server in background
nohup node js/server_sqlite_new.js > server.log 2>&1 &
echo "Server restarted successfully"
EOF

echo "✅ Deployment complete!"
echo ""
echo "📍 Access the new wiki at:"
echo "   https://www.iinou.eu/wiki_dynamic.html"
echo ""
echo "🗺️ Custom Eno World tiles served from:"
echo "   https://rhovasti.github.io/eno-tiles/"
echo ""
echo "⚠️  Note: The production database will start fresh for wiki entries."
echo "    Existing game data remains intact."
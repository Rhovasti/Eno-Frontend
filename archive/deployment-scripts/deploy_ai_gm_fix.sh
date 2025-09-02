#!/bin/bash

# Production Deployment Script for AI GM Fix
# Date: May 25, 2025

echo "Starting AI GM Fix Deployment to Production..."

# Configuration
REMOTE_HOST="root@www.iinou.eu"
REMOTE_DIR="/home/eno"
LOCAL_DIR="/root/Eno/Eno-Frontend"

# Step 1: Create deployment package
echo "Creating deployment package..."
cd $LOCAL_DIR

# Create a temporary deployment directory
mkdir -p deploy_temp
cp js/server_sqlite_ai_gm_enhanced.js deploy_temp/
cp create_ai_gm_user.js deploy_temp/
cp create_test_accounts.js deploy_temp/
cp DEPLOYMENT_NOTES.md deploy_temp/

# Create tarball
tar -czf ai_gm_fix_deployment.tar.gz deploy_temp/

# Step 2: Backup production database
echo "Creating backup of production database..."
ssh $REMOTE_HOST "cd $REMOTE_DIR && cp data/database.sqlite data/database.sqlite.backup.$(date +%Y%m%d_%H%M%S)"

# Step 3: Upload files
echo "Uploading files to production..."
scp ai_gm_fix_deployment.tar.gz $REMOTE_HOST:$REMOTE_DIR/

# Step 4: Extract and apply changes on production
echo "Applying changes on production..."
ssh $REMOTE_HOST << 'EOF'
cd /home/eno
tar -xzf ai_gm_fix_deployment.tar.gz

# Backup current server file
cp js/server_sqlite.js js/server_sqlite.backup.$(date +%Y%m%d_%H%M%S).js

# Copy new server file
cp deploy_temp/js/server_sqlite_ai_gm_enhanced.js js/server_sqlite_ai_gm_enhanced.js

# Create AI GM user on production
echo "Creating AI GM System user..."
node deploy_temp/create_ai_gm_user.js

# Optional: Create test accounts (comment out if not needed)
# node deploy_temp/create_test_accounts.js

# Stop current server
echo "Stopping current server..."
pkill -f "node.*server" || true
sleep 2

# Start new server
echo "Starting new server..."
nohup node js/server_sqlite_ai_gm_enhanced.js > server.log 2>&1 &
sleep 5

# Check if server is running
if pgrep -f "node.*server" > /dev/null; then
    echo "Server started successfully!"
else
    echo "ERROR: Server failed to start!"
    echo "Rolling back..."
    nohup node js/server_sqlite.js > server.log 2>&1 &
fi

# Cleanup
rm -rf deploy_temp/
rm ai_gm_fix_deployment.tar.gz
EOF

# Step 5: Cleanup local files
rm -rf deploy_temp/
rm ai_gm_fix_deployment.tar.gz

echo "Deployment complete!"
echo ""
echo "Post-deployment checklist:"
echo "1. Test login with GM account on https://www.iinou.eu"
echo "2. Test AI GM game creation via order-game.html"
echo "3. Verify AI GM posts are being created"
echo "4. Check server logs for any errors"
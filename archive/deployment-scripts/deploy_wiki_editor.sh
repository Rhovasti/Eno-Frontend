#!/bin/bash

# Deploy Wiki Editor functionality to production server
# Created: 2025-09-05
# This script deploys the Wiki editing functionality to iinou.eu

echo "========================================="
echo "Wiki Editor Deployment Script"
echo "========================================="

# Production server details
PROD_SERVER="95.217.21.111"
PROD_USER="root"
PROD_PASS="ininFvTPNTguUtuuLbx3"
PROD_PATH="/var/www/pelisivusto"

# Files to deploy
FILES_TO_DEPLOY=(
    "js/server_sqlite_new.js"
    "js/wiki_dynamic.js"
    "hml/wiki_dynamic.html"
)

echo ""
echo "This script will deploy the following files to $PROD_SERVER:"
for file in "${FILES_TO_DEPLOY[@]}"; do
    echo "  - $file"
done

echo ""
read -p "Do you want to continue? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

echo ""
echo "Step 1: Creating backup of production database..."
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_SERVER "cd $PROD_PATH && cp -v data/database.sqlite data/database.sqlite.backup.\$(date +%Y%m%d_%H%M%S)" 2>/dev/null

echo ""
echo "Step 2: Deploying updated files..."
for file in "${FILES_TO_DEPLOY[@]}"; do
    echo "Copying $file..."
    # Ensure directory exists
    DIR=$(dirname "$file")
    sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_SERVER "mkdir -p $PROD_PATH/$DIR" 2>/dev/null
    # Copy file
    sshpass -p "$PROD_PASS" scp "$file" "$PROD_USER@$PROD_SERVER:$PROD_PATH/$file" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "  ✓ $file deployed successfully"
    else
        echo "  ✗ Failed to deploy $file"
        exit 1
    fi
done

echo ""
echo "Step 3: Restarting the server..."
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_SERVER << 'EOF'
cd /var/www/pelisivusto
echo "Stopping current server..."
pkill -f "node.*server" || true
sleep 2
echo "Starting server..."
export AWS_REGION=eu-north-1
export AWS_BUCKET_NAME=kuvatjakalat
nohup node js/server_sqlite_new.js > server.log 2>&1 &
sleep 3
if pgrep -f "node.*server" > /dev/null; then
    echo "Server started successfully!"
else
    echo "Error: Server failed to start!"
    exit 1
fi
EOF

echo ""
echo "Step 4: Waiting for server to start..."
sleep 5

echo ""
echo "Step 5: Testing server response..."
if curl -s -o /dev/null -w "%{http_code}" https://$PROD_SERVER/api/health | grep -q "200"; then
    echo "  ✓ Server is responding correctly"
else
    echo "  ⚠ Server may not be responding correctly. Please check manually."
fi

echo ""
echo "========================================="
echo "Deployment Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Visit https://$PROD_SERVER/hml/login.html"
echo "2. Login with editor@iinou.eu / password123"
echo "3. Navigate to https://$PROD_SERVER/hml/wiki_dynamic.html"
echo "4. Verify that:"
echo "   - User badge shows 'editor (Editor)' in top-right"
echo "   - Editor toolbar with '+ New Entry' button appears bottom-right"
echo "   - Edit buttons (red) appear on wiki entry cards"
echo "   - You can create and edit wiki entries"
echo ""
echo "If you encounter issues:"
echo "- Check server logs: sshpass -p '$PROD_PASS' ssh $PROD_USER@$PROD_SERVER 'tail -f $PROD_PATH/server.log'"
echo "- Restore backup: sshpass -p '$PROD_PASS' ssh $PROD_USER@$PROD_SERVER 'cd $PROD_PATH && cp data/database.sqlite.backup.TIMESTAMP data/database.sqlite'"
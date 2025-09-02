#!/bin/bash

echo "=== Deploying Dice Roll Feature to www.iinou.eu ==="

# Server details
SERVER_IP="95.217.219.85"
SERVER_USER="root"
REMOTE_PATH="/root/Eno/Eno-Frontend"

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo "Installing sshpass for automated deployment..."
    apt-get update && apt-get install -y sshpass
fi

# Prompt for password
echo -n "Enter password for root@${SERVER_IP}: "
read -s SERVER_PASS
echo ""

# Create deployment package
echo "1. Creating deployment package..."
mkdir -p dice_deploy_temp

# Copy all necessary files
cp js/server_sqlite.js dice_deploy_temp/
cp js/diceEngine.js dice_deploy_temp/
cp js/threads.js dice_deploy_temp/
cp hml/threads.html dice_deploy_temp/
cp css/styles.css dice_deploy_temp/
cp sql/add_dice_rolls.sql dice_deploy_temp/

# Create remote installation script
cat > dice_deploy_temp/install_dice.sh << 'EOF'
#!/bin/bash
echo "Installing dice roll feature on production..."

# Create backups
echo "Backing up existing files..."
cp js/server_sqlite.js "js/server_sqlite.backup.$(date +%Y%m%d_%H%M%S).js" 2>/dev/null
cp js/threads.js "js/threads.backup.$(date +%Y%m%d_%H%M%S).js" 2>/dev/null
cp hml/threads.html "hml/threads.backup.$(date +%Y%m%d_%H%M%S).html" 2>/dev/null
cp css/styles.css "css/styles.backup.$(date +%Y%m%d_%H%M%S).css" 2>/dev/null

# Copy new files
echo "Installing updated files..."
cp server_sqlite.js js/
cp diceEngine.js js/
cp threads.js js/
cp threads.html hml/
cp styles.css css/
cp add_dice_rolls.sql sql/

# Apply database migration
echo "Applying database migration..."
if [ -f data/foorumi.db ]; then
    sqlite3 data/foorumi.db < add_dice_rolls.sql
    echo "✓ Database migration completed"
else
    echo "⚠ Database file not found at expected location"
fi

# Restart server
echo "Restarting server..."
pkill -f 'node.*server' 2>/dev/null
sleep 2
nohup node js/server_sqlite.js > server.log 2>&1 &
sleep 3

# Check if server started
if pgrep -f "node.*server_sqlite" > /dev/null; then
    echo "✓ Server restarted successfully"
else
    echo "✗ Server failed to start - check server.log for details"
fi

echo ""
echo "✓ Dice roll feature installed!"
echo "Visit https://www.iinou.eu/hml/threads.html to test"
EOF

chmod +x dice_deploy_temp/install_dice.sh

# Create tarball
tar -czf dice_deploy.tar.gz dice_deploy_temp/

# Upload to server
echo "2. Uploading files to production server..."
sshpass -p "$SERVER_PASS" scp dice_deploy.tar.gz ${SERVER_USER}@${SERVER_IP}:${REMOTE_PATH}/

# Execute installation
echo "3. Installing on production server..."
sshpass -p "$SERVER_PASS" ssh ${SERVER_USER}@${SERVER_IP} "cd ${REMOTE_PATH} && tar -xzf dice_deploy.tar.gz && cd dice_deploy_temp && ./install_dice.sh"

# Cleanup
rm -rf dice_deploy_temp dice_deploy.tar.gz

echo ""
echo "=== Deployment Complete! ==="
echo "The dice roll feature should now be live at:"
echo "https://www.iinou.eu/hml/threads.html"
echo ""
echo "To verify deployment:"
echo "1. Visit the threads page"
echo "2. Create a new post"
echo "3. Use the dice roll feature (e.g., 2d6+3)"
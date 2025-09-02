#!/bin/bash

echo "=== Deploying Dice Roll Feature to Production ==="

# Server details
SERVER="root@95.217.219.85"
REMOTE_PATH="/root/Eno/Eno-Frontend"

# Create deployment package
echo "1. Creating deployment package..."
mkdir -p dice_roll_deploy

# Copy updated files
cp js/server_sqlite.js dice_roll_deploy/
cp js/diceEngine.js dice_roll_deploy/
cp js/threads.js dice_roll_deploy/
cp hml/threads.html dice_roll_deploy/
cp css/styles.css dice_roll_deploy/
cp sql/add_dice_rolls.sql dice_roll_deploy/

# Create deployment script for remote server
cat > dice_roll_deploy/install_dice_rolls.sh << 'EOF'
#!/bin/bash
echo "Installing dice roll feature..."

# Backup current files
echo "Creating backups..."
cp js/server_sqlite.js js/server_sqlite.backup.$(date +%Y%m%d_%H%M%S).js
cp js/threads.js js/threads.backup.$(date +%Y%m%d_%H%M%S).js
cp hml/threads.html hml/threads.backup.$(date +%Y%m%d_%H%M%S).html
cp css/styles.css css/styles.backup.$(date +%Y%m%d_%H%M%S).css

# Copy new files
echo "Installing new files..."
cp server_sqlite.js js/
cp diceEngine.js js/
cp threads.js js/
cp threads.html hml/
cp styles.css css/

# Apply database migration
echo "Applying database migration..."
if [ -f data/foorumi.db ]; then
    sqlite3 data/foorumi.db < add_dice_rolls.sql
    echo "✓ Database migration completed"
else
    echo "✗ Database not found, migration will be applied on first run"
fi

echo "✓ Dice roll feature installed successfully!"
echo ""
echo "To restart the server with new features:"
echo "  1. Stop current server: pkill -f 'node.*server'"
echo "  2. Start new server: nohup node js/server_sqlite.js > server.log 2>&1 &"
EOF

chmod +x dice_roll_deploy/install_dice_rolls.sh

# Create tarball
echo "2. Creating deployment archive..."
tar -czf dice_roll_deploy.tar.gz dice_roll_deploy/

# Upload to server
echo "3. Uploading to production server..."
scp dice_roll_deploy.tar.gz $SERVER:$REMOTE_PATH/

# Execute installation on remote server
echo "4. Installing on production server..."
ssh $SERVER "cd $REMOTE_PATH && tar -xzf dice_roll_deploy.tar.gz && cd dice_roll_deploy && ./install_dice_rolls.sh"

# Clean up
rm -rf dice_roll_deploy dice_roll_deploy.tar.gz

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Next steps on production server:"
echo "1. SSH to server: ssh $SERVER"
echo "2. Navigate to: cd $REMOTE_PATH"
echo "3. Stop current server: pkill -f 'node.*server'"
echo "4. Start with dice rolls: nohup node js/server_sqlite.js > server.log 2>&1 &"
echo ""
echo "The dice roll feature will be available at:"
echo "https://eno.anotherrealm.org/hml/threads.html"
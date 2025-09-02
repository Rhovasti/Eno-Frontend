#!/bin/bash

echo "Starting deployment of profile and game creation features to production server..."

# Production server details
REMOTE_HOST="162.55.219.227"
REMOTE_USER="eno"
REMOTE_PATH="/var/www/html/foorumi"

# Step 1: Upload all modified files
echo "Uploading modified files..."
scp -o StrictHostKeyChecking=no \
    js/server.js \
    hml/create-game.html \
    hml/profile.html \
    hml/storyboard.html \
    hml/threads.html \
    hml/wiki.html \
    index.html \
    sql/add_user_profile_columns.sql \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/

# Also ensure the hml directory exists
ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST "mkdir -p $REMOTE_PATH/hml"

# Step 2: Run the database migration
echo "Running database migration for user profiles..."
ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html/foorumi
mysql -u eno -ppassword Foorumi < sql/add_user_profile_columns.sql
if [ $? -eq 0 ]; then
    echo "Database migration completed successfully."
else
    echo "Database migration failed. Some columns might already exist, continuing..."
fi
EOF

# Step 3: Restart the server
echo "Restarting the server..."
ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html/foorumi
# Kill existing node processes
pkill -f "node.*server" || true
# Start the server with the updated code
nohup node js/server.js > server.log 2>&1 &
sleep 3
# Check if server started successfully
if pgrep -f "node.*server" > /dev/null; then
    echo "Server restarted successfully."
else
    echo "Server failed to start. Check server.log for errors."
fi
EOF

# Step 4: Verify deployment
echo "Verifying deployment..."
curl -s -o /dev/null -w "%{http_code}" https://pelisivu.link/health
if [ $? -eq 0 ]; then
    echo "Server is responding to health checks."
else
    echo "Warning: Server health check failed."
fi

echo "Deployment completed!"
echo "You can now test the new features at:"
echo "- Game Creation: https://pelisivu.link/hml/create-game.html"
echo "- User Profile: https://pelisivu.link/hml/profile.html"
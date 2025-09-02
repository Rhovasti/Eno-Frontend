#!/bin/bash

echo "Starting deployment to production server..."

# Production server details
REMOTE_HOST="162.55.219.227"
REMOTE_USER="eno"
REMOTE_PATH="/var/www/html/foorumi"

# Files to deploy
echo "Uploading modified files..."
scp -o StrictHostKeyChecking=no \
    js/threads.js \
    js/storyboard.js \
    js/server_sqlite_new.js \
    hml/threads.html \
    sql/add_chapter_archiving_mysql.sql \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/

# Run the database migration
echo "Running database migration..."
ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html/foorumi
mysql -u eno -ppassword Foorumi < sql/add_chapter_archiving_mysql.sql
echo "Database migration completed."
EOF

# Restart the server
echo "Restarting the server..."
ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html/foorumi
pkill -f "node.*server"
nohup node js/server.js > server.log 2>&1 &
echo "Server restarted."
EOF

echo "Deployment completed successfully!"
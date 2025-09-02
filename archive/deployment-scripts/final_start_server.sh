#!/bin/bash

REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"

echo "Starting server on production..."

# Kill any existing processes and start fresh
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST 'pkill -9 -f node || true'
sleep 2

# Start the server
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST 'cd /var/www/pelisivusto && nohup node js/server_sqlite_new.js > server.log 2>&1 & echo "Server started with PID $!"'

sleep 5

# Check if running
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST 'pgrep -f node'

echo "Done"
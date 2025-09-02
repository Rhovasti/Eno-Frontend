#!/bin/bash

REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"

echo "Restarting server on production..."
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST 'cd /var/www/pelisivusto && pkill -f "node.*server" || true && sleep 2 && nohup node js/server_sqlite_new.js > server.log 2>&1 & sleep 3 && ps aux | grep node | grep -v grep'

echo "Server restart completed"
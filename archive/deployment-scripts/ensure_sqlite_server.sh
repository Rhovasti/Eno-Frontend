#!/bin/bash

echo "Ensuring SQLite server is running on production..."

# Upload the correct SQLite server file
echo "Uploading server_sqlite.js to production..."
sshpass -p 'ininFvTPNTguUtuuLbx3' sftp -o StrictHostKeyChecking=no root@95.217.21.111 <<EOF
cd /var/www/pelisivusto/js
put js/server_sqlite.js server_sqlite.js
put js/server_sqlite_new.js server_sqlite_new.js
EOF

# Restart with SQLite server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

# Kill all node processes
echo 'Stopping all Node processes...'
killall -9 node || true
sleep 2

# Start the SQLite server
echo 'Starting SQLite server...'
nohup node js/server_sqlite_new.js > server.log 2>&1 &
echo 'Server started'
sleep 3

# Check status
echo 'Server status:'
ps aux | grep node | grep -v grep

# Test the server
curl -s http://localhost:3000/health || echo 'Health check endpoint not available'
"

echo "Server restarted with SQLite configuration"
echo "You should now be able to login at https://www.iinou.eu/"
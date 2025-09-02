#\!/bin/bash

# Connect to the remote server and run the new SQLite server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
echo 'Stopping any running Node.js processes...'
pkill -f 'node js/server' || true

echo 'Installing sqlite3 package if needed...'
npm install sqlite3

echo 'Starting new SQLite server...'
nohup node js/server_sqlite.js > server_sqlite.log 2>&1 &
PID=\$\!
echo 'Server started with PID: '\$PID

sleep 3
echo 'Checking server log:'
cat server_sqlite.log

echo 'Testing debug endpoint:'
curl -s http://localhost:3000/api/debug/posts
echo

echo 'Testing login endpoint:'
curl -s -X POST http://localhost:3000/api/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"admin123\"}'
echo
"

echo "New server started"

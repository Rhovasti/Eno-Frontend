#\!/bin/bash

# Connect to the remote server and restart the Node.js application with logging
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
echo 'Stopping any running Node.js processes...'
pkill -f 'node js/server' || true

echo 'Starting server.js...'
nohup node js/server.js > server.log 2>&1 &
PID=\$\!
echo 'Server started with PID: '\$PID

sleep 3
echo 'Server log:'
tail -n 20 server.log

echo 'Checking server status:'
ps -p \$PID && echo 'Server is running' || echo 'Server crashed'

echo 'Testing login and threads endpoints:'
curl -s -X POST http://localhost:3000/api/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"admin123\"}' | head -c 300
echo
echo 'Testing API endpoints:'
curl -s http://localhost:3000/api/debug/posts | head -c 300
echo
"

echo "Server restarted with logging"

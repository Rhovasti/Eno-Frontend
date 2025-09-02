#\!/bin/bash

# Connect to the remote server and start the SQLite version of the server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
echo 'Stopping any running Node.js processes...'
pkill -f 'node js/server' || true

echo 'Starting SQLite server...'
nohup node js/server_sqlite.js > server_sqlite.log 2>&1 &
PID=\$\!
echo 'SQLite server started with PID: '\$PID

sleep 3
echo 'Checking server status:'
ps -p \$PID && echo 'Server is running' || echo 'Server crashed'

echo 'Testing debug API:'
curl -s http://localhost:3000/api/debug/posts || echo 'Debug API not available'
"

echo "SQLite server started"

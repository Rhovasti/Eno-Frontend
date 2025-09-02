#\!/bin/bash

# Restart the server with the correct server.js file
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
echo 'Stopping any running Node.js processes...'
pkill -f 'node js/server' || true

echo 'Starting server.js (not server_sqlite.js)...'
nohup node js/server.js > server.log 2>&1 &
PID=\$\!
echo 'Server started with PID: '\$PID

sleep 2
if ps -p \$PID > /dev/null; then
    echo 'Server still running with PID: '\$PID
    echo 'Testing API...'
    echo 'GET /'
    curl -s http://localhost:3000/
    echo
    echo 'GET /api/posts'
    curl -s http://localhost:3000/api/posts
else
    echo 'Server stopped unexpectedly'
    cat server.log
fi
"

echo "Server corrected"

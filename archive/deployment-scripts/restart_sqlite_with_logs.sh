#\!/bin/bash

# Connect to the remote server and start the SQLite server with detailed logging
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
echo 'Stopping any running Node.js processes...'
pkill -f 'node js/server' || true

echo 'Starting SQLite server with output...'
node js/server_sqlite.js 2>&1 | tee server_sqlite.log
"

echo "SQLite server start attempt completed"

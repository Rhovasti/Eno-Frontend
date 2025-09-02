#\!/bin/bash

# Connect to the remote server and restart the Node.js application
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 '
cd /var/www/pelisivusto
echo "Stopping any running Node.js processes..."
pkill -f "node js/server.js" || true
echo "Starting server..."
nohup node js/server.js > server.log 2>&1 &
echo "Server restarted. Check server.log for details."
'

echo "Server restart command sent"

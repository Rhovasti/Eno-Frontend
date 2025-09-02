#\!/bin/bash

# Connect to the remote server and restart the Node.js application with better logging
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 '
cd /var/www/pelisivusto
echo "Stopping any running Node.js processes..."
pkill -f "node js/server.js" || true

echo "Current directory: $(pwd)"
echo "Server.js exists: $(test -f js/server.js && echo "Yes" || echo "No")"
echo "Node version: $(node --version)"
echo "Packages installed: $(ls -la node_modules | wc -l) directories"

echo "Starting server..."
rm -f server.log
node js/server.js > server.log 2>&1 &
PID=$\!
echo "Server started with PID: $PID"

sleep 2
if ps -p $PID > /dev/null; then
    echo "Server still running"
    echo "Server logs:"
    tail -n 20 server.log
else
    echo "Server stopped unexpectedly"
    echo "Server logs:"
    cat server.log
fi
'

echo "Server restart completed"

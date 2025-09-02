#\!/bin/bash

# Connect to the remote server and start the simple test server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'ENDSSH'
cd /var/www/pelisivusto
echo 'Stopping any running Node.js processes...'
pkill -f 'node js/' || true

echo 'Starting simple test server...'
nohup node js/simple_test_server.js > simple_server.log 2>&1 &
echo "Server started with PID: $\!"

sleep 2
echo 'Checking if server is running:'
ps aux | grep '[n]ode js/simple'
ENDSSH

echo "Simple server command sent. Checking status..."

sleep 3

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
echo 'Server log:'
cat simple_server.log

echo 'Testing health endpoint:'
curl -s http://localhost:3000/health
echo

echo 'Testing debug endpoint:'
curl -s http://localhost:3000/api/debug/posts
echo

echo 'Testing mock login:'
curl -s -X POST http://localhost:3000/api/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"admin123\"}'
echo
"

echo "Status check completed"

#\!/bin/bash

# Connect to the remote server and check the server logs
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
echo '=== Server Log ==='
cat server.log
echo '================='

echo '=== Server Status ==='
ps aux | grep '[n]ode js/server'
echo '===================='

echo '=== Testing HTTP Status ==='
curl -I http://localhost:3000/
echo '========================='

echo '=== Testing Login API ==='
curl -s -X POST http://localhost:3000/api/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"admin123\"}' | head -c 500
echo
echo '========================'
"

echo "Log checking completed"

#\!/bin/bash

# Force kill all Node.js processes and start the correct server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
echo 'Forcefully stopping all Node.js processes...'
killall -9 node || true

sleep 1
echo 'Starting server.js...'
nohup node js/server.js > server.log 2>&1 &
PID=\$\!
echo 'Server started with PID: '\$PID

sleep 2
ps aux | grep '\$PID'
echo 'Testing API...'
curl -v http://localhost:3000/api/posts
"

echo "Server forcefully restarted"

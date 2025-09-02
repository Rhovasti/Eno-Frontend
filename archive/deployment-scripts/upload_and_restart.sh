#\!/bin/bash

# Upload the updated server.js file and restart the server
sshpass -p 'ininFvTPNTguUtuuLbx3' sftp -o StrictHostKeyChecking=no root@95.217.21.111 <<SFTP_CMD
cd /var/www/pelisivusto/js
put /root/Eno/Eno-Frontend/js/server.js
SFTP_CMD

echo "Updated server.js uploaded"

# Restart the server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
echo 'Stopping all Node.js processes...'
killall -9 node || true

sleep 1
echo 'Starting updated server.js...'
nohup node js/server.js > server.log 2>&1 &
PID=\$\!
echo 'Server started with PID: '\$PID

sleep 2
echo 'Testing debug API endpoint...'
curl -s http://localhost:3000/api/debug/posts
"

echo "Server updated and restarted"

#\!/bin/bash

# Upload the latest server.js file and restart
sshpass -p 'ininFvTPNTguUtuuLbx3' sftp -o StrictHostKeyChecking=no root@95.217.21.111 <<SFTP_CMD
cd /var/www/pelisivusto/js
put /root/Eno/Eno-Frontend/js/server.js
SFTP_CMD

echo "Server.js uploaded"

# Restart the server and check its status
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
pkill -f 'node js/server.js' || true
echo 'Starting server...'
nohup node js/server.js > server.log 2>&1 &
echo 'Server started with PID: '\$\!
sleep 2
echo 'Checking endpoint...'
curl -s http://localhost:3000/api/posts
"

echo "Server restarted and endpoint tested"

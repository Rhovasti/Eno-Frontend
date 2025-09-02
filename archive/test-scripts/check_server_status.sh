#\!/bin/bash

# Connect to the remote server and check if the Node.js server is running
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 '
echo "=== Process status ==="
ps aux | grep "[n]ode js/server.js"
echo "======================"
echo ""
echo "=== Listening ports ==="
netstat -tulpn | grep node
echo "======================="
'

echo "Server status check completed"

#\!/bin/bash

# Connect to the remote server and create a log file for the Node.js server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 '
cd /var/www/pelisivusto
echo "Creating log file..."
touch server.log
echo "Log file created."
'

echo "Log file creation command sent"

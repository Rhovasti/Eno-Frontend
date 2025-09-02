#\!/bin/bash

# Connect to the remote server and install dependencies
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 '
cd /var/www/pelisivusto
echo "Installing dependencies..."
npm install
echo "Dependencies installed."
'

echo "Dependencies installation command sent"

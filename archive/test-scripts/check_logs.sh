#\!/bin/bash

# Connect to the remote server and check the server logs
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 'cd /var/www/pelisivusto && tail -n 50 server.log'

echo "End of server logs"

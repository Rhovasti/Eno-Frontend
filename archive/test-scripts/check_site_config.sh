#\!/bin/bash

# Connect to the remote server and check the pelisivusto nginx configuration
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 '
echo "=== Pelisivusto Nginx Config ==="
cat /etc/nginx/sites-available/pelisivusto
echo "================================="
echo ""
echo "=== Web Server Port Usage ==="
lsof -i :80
lsof -i :443
echo "============================"
'

echo "Site config check completed"

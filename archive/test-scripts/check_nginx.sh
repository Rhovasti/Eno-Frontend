#\!/bin/bash

# Connect to the remote server and check nginx configuration
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 '
echo "=== Nginx Status ==="
systemctl status nginx | head -10
echo "===================="
echo ""
echo "=== Nginx Config Files ==="
ls -la /etc/nginx/sites-enabled/
echo "=========================="
echo ""
echo "=== Nginx Default Site Config ==="
cat /etc/nginx/sites-enabled/default || echo "No default config file found"
echo "================================="
'

echo "Nginx check completed"

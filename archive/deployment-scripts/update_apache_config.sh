#\!/bin/bash

# Connect to the remote server and update the Apache configuration
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'ENDSSH'
echo "=== Checking current Apache configuration ==="
ls -la /etc/apache2/sites-enabled/
cat /etc/apache2/sites-enabled/* | grep -A 20 -B 5 "VirtualHost"

echo "=== Creating proxy configuration ==="
sudo tee /etc/apache2/conf-available/nodejs-proxy.conf > /dev/null << 'EOF'
<IfModule mod_proxy.c>
    ProxyRequests Off
    ProxyPreserveHost On

    <Location /api>
        ProxyPass http://localhost:3000/api
        ProxyPassReverse http://localhost:3000/api
    </Location>
</IfModule>

#!/bin/bash

echo "=== Updating SSL certificate to cover both domains ==="

# SSH into the production server and update the certificate
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'ENDSSH'

echo "=== Backing up current certificates ==="
cp -r /etc/letsencrypt /etc/letsencrypt.backup.$(date +%Y%m%d_%H%M%S)

echo "=== Stopping Apache temporarily ==="
systemctl stop apache2

echo "=== Obtaining new certificate for both domains ==="
certbot certonly --standalone -d www.iinou.eu -d iinou.eu --non-interactive --agree-tos --email admin@iinou.eu --expand

echo "=== Starting Apache ==="
systemctl start apache2

echo "=== Verifying new certificate ==="
certbot certificates

echo "=== Testing both domains ==="
echo "Testing https://www.iinou.eu..."
curl -I https://www.iinou.eu 2>&1 | head -n 5

echo -e "\nTesting https://iinou.eu..."
curl -I https://iinou.eu 2>&1 | head -n 5

echo -e "\n=== Certificate update complete ==="

ENDSSH

echo "=== Certificate updated successfully ==="
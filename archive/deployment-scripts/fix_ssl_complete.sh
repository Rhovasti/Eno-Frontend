#!/bin/bash

echo "=== Complete SSL fix for mobile access ==="

# SSH into the production server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'ENDSSH'

echo "=== Fixing Apache configuration and SSL certificate ==="

# First, let's check current DNS records
echo "=== Checking DNS resolution ==="
dig +short www.iinou.eu
dig +short iinou.eu

# Update certificate using Apache plugin (while Apache is running)
echo "=== Updating certificate to cover both domains ==="
certbot --apache -d www.iinou.eu -d iinou.eu --expand --non-interactive --agree-tos --email admin@iinou.eu

# Create a simplified Apache configuration that handles redirects properly
echo "=== Creating optimized Apache configuration ==="
cat > /etc/apache2/sites-available/iinou.conf << 'EOF'
# HTTP to HTTPS redirect
<VirtualHost *:80>
    ServerName www.iinou.eu
    ServerAlias iinou.eu
    
    RewriteEngine On
    RewriteCond %{SERVER_NAME} =www.iinou.eu [OR]
    RewriteCond %{SERVER_NAME} =iinou.eu
    RewriteRule ^ https://www.iinou.eu%{REQUEST_URI} [END,NE,R=301,L]
</VirtualHost>

# HTTPS configuration
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName www.iinou.eu
    ServerAlias iinou.eu
    DocumentRoot /var/www/html
    
    # If accessed via non-www, redirect to www
    RewriteEngine On
    RewriteCond %{HTTP_HOST} ^iinou\.eu$ [NC]
    RewriteRule ^(.*)$ https://www.iinou.eu$1 [R=301,L]
    
    # Proxy for Node.js API
    ProxyPreserveHost On
    ProxyPass /api http://localhost:3000/api
    ProxyPassReverse /api http://localhost:3000/api
    
    # Directory settings
    <Directory /var/www/html>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # Security headers
    Header always set Strict-Transport-Security "max-age=31536000"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/www.iinou.eu/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/www.iinou.eu/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
    
    # Logs
    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
</IfModule>
EOF

# Disable old configs and enable new one
echo "=== Updating site configuration ==="
a2dissite 000-default
a2dissite 000-default-le-ssl
a2ensite iinou

# Test configuration
echo "=== Testing configuration ==="
apache2ctl configtest

# Reload Apache
echo "=== Reloading Apache ==="
systemctl reload apache2

# Test the domains
echo -e "\n=== Testing domain access ==="
echo "Testing HTTP to HTTPS redirect for www.iinou.eu..."
curl -I -L http://www.iinou.eu 2>&1 | grep -E "HTTP|Location" | head -n 10

echo -e "\nTesting HTTP to HTTPS redirect for iinou.eu..."
curl -I -L http://iinou.eu 2>&1 | grep -E "HTTP|Location" | head -n 10

echo -e "\nTesting HTTPS access for www.iinou.eu..."
curl -I https://www.iinou.eu 2>&1 | grep "HTTP" | head -n 1

echo -e "\nTesting HTTPS redirect for iinou.eu..."
curl -I https://iinou.eu 2>&1 | grep -E "HTTP|Location" | head -n 5

echo -e "\n=== Configuration complete ==="
echo "Mobile devices should now:"
echo "1. Be automatically redirected from HTTP to HTTPS"
echo "2. Be redirected from iinou.eu to www.iinou.eu"
echo "3. Have proper SSL certificate coverage"
echo "4. Not see any security warnings"

ENDSSH

echo -e "\n=== All fixes applied ==="
echo "Please test on your mobile device now."
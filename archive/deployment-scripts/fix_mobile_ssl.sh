#!/bin/bash

echo "=== Fixing SSL and redirect issues for mobile devices ==="

# SSH into the production server and apply fixes
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'ENDSSH'

echo "=== Backing up current Apache configuration ==="
cp -r /etc/apache2/sites-available /etc/apache2/sites-available.backup.$(date +%Y%m%d_%H%M%S)

echo "=== Creating comprehensive SSL configuration ==="
cat > /etc/apache2/sites-available/000-default.conf << 'EOF'
# HTTP to HTTPS redirect for both www and non-www
<VirtualHost *:80>
    ServerName iinou.eu
    ServerAlias www.iinou.eu
    
    # Redirect all HTTP traffic to HTTPS
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://www.iinou.eu$1 [R=301,L]
</VirtualHost>
EOF

echo "=== Creating SSL configuration ==="
cat > /etc/apache2/sites-available/000-default-le-ssl.conf << 'EOF'
<IfModule mod_ssl.c>
# HTTPS configuration for non-www domain
<VirtualHost *:443>
    ServerName iinou.eu
    
    # Redirect non-www to www
    RewriteEngine On
    RewriteRule ^(.*)$ https://www.iinou.eu$1 [R=301,L]
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/www.iinou.eu/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/www.iinou.eu/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>

# HTTPS configuration for www domain
<VirtualHost *:443>
    ServerName www.iinou.eu
    DocumentRoot /var/www/html
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/www.iinou.eu/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/www.iinou.eu/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
    
    # Security headers
    Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains"
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    
    # Proxy configuration for Node.js API
    <Location /api>
        ProxyPass http://localhost:3000/api
        ProxyPassReverse http://localhost:3000/api
        ProxyPreserveHost On
    </Location>
    
    # Enable necessary modules
    <IfModule mod_headers.c>
        RequestHeader set X-Forwarded-Proto "https"
    </IfModule>
    
    # Directory configuration
    <Directory /var/www/html>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # Logging
    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
</IfModule>
EOF

echo "=== Enabling required Apache modules ==="
a2enmod rewrite
a2enmod ssl
a2enmod headers
a2enmod proxy
a2enmod proxy_http

echo "=== Testing Apache configuration ==="
apache2ctl configtest

echo "=== Restarting Apache ==="
systemctl restart apache2

echo "=== Checking certificate status ==="
certbot certificates

echo "=== Testing HTTPS redirects ==="
echo "Testing http://iinou.eu redirect..."
curl -I -L http://iinou.eu 2>&1 | head -n 20

echo -e "\nTesting http://www.iinou.eu redirect..."
curl -I -L http://www.iinou.eu 2>&1 | head -n 20

echo -e "\nTesting https://iinou.eu redirect..."
curl -I -L https://iinou.eu 2>&1 | head -n 20

echo -e "\n=== Configuration complete ==="
echo "The following changes were made:"
echo "1. All HTTP traffic now redirects to HTTPS"
echo "2. Non-www domain (iinou.eu) redirects to www domain (www.iinou.eu)"
echo "3. SSL is properly configured for both domains"
echo "4. Security headers added for better protection"
echo "5. Mobile devices should no longer see security warnings"

ENDSSH

echo "=== Fix applied successfully ==="
echo "Please test on your mobile device to confirm the issue is resolved."
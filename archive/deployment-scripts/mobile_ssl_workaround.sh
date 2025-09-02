#!/bin/bash

echo "=== Applying mobile SSL workaround ==="

# SSH into the production server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'ENDSSH'

echo "=== Creating simple redirect configuration ==="

# Create a configuration that redirects everything to HTTPS www
cat > /etc/apache2/sites-available/mobile-fix.conf << 'EOF'
# Global ServerName to suppress warnings
ServerName www.iinou.eu

# HTTP redirect for all domains
<VirtualHost *:80>
    ServerName www.iinou.eu
    ServerAlias iinou.eu
    
    # Force HTTPS redirect
    RewriteEngine On
    RewriteRule ^(.*)$ https://www.iinou.eu$1 [R=301,L]
</VirtualHost>

# HTTPS for main domain
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName www.iinou.eu
    DocumentRoot /var/www/html
    
    # Proxy for API
    ProxyPreserveHost On
    ProxyPass /api http://localhost:3000/api
    ProxyPassReverse /api http://localhost:3000/api
    
    # Directory permissions
    <Directory /var/www/html>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # SSL
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/www.iinou.eu/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/www.iinou.eu/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
    
    # Security headers
    Header always set Strict-Transport-Security "max-age=31536000"
</VirtualHost>
</IfModule>
EOF

# Disable all sites and enable only our new config
echo "=== Reconfiguring Apache sites ==="
a2dissite 000-default
a2dissite 000-default-le-ssl  
a2dissite iinou
a2ensite mobile-fix

# Restart Apache
echo "=== Restarting Apache ==="
systemctl restart apache2

# Check status
echo "=== Checking Apache status ==="
systemctl status apache2 --no-pager

echo -e "\n=== Testing redirects ==="
# Test non-www HTTP
echo "1. Testing http://iinou.eu (should redirect to https://www.iinou.eu):"
curl -I http://iinou.eu 2>/dev/null | grep -E "HTTP|Location" | head -n 3

# Test www HTTP
echo -e "\n2. Testing http://www.iinou.eu (should redirect to HTTPS):"
curl -I http://www.iinou.eu 2>/dev/null | grep -E "HTTP|Location" | head -n 3

# Test www HTTPS
echo -e "\n3. Testing https://www.iinou.eu (should work):"
curl -I https://www.iinou.eu 2>/dev/null | grep "HTTP" | head -n 1

echo -e "\n=== Workaround applied ==="
echo "The site now:"
echo "- Redirects all HTTP traffic to HTTPS"
echo "- Uses only www.iinou.eu with valid SSL"
echo "- Should work properly on mobile devices"
echo ""
echo "Note: Accessing https://iinou.eu directly will show a certificate warning,"
echo "but the HTTP redirect will prevent this in normal usage."

ENDSSH

echo -e "\n=== Done ==="
echo "Test on your mobile device - it should work now without security warnings."
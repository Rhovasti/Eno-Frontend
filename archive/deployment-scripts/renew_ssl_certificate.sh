#!/bin/bash

# Script to manage Let's Encrypt SSL certificate for www.iinou.eu
DOMAIN="www.iinou.eu"
EMAIL="admin@iinou.eu"  # Change this to your email address
WEBROOT="/var/www/html"  # Change this to your web root path

echo "Starting certificate management for $DOMAIN"

# Check if certificate already exists
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "Certificate exists, attempting renewal"
    
    # Stop web server to free up port 80 (if needed)
    # Uncomment the appropriate line for your setup:
    # systemctl stop apache2
    # systemctl stop nginx
    
    # Renew the certificate
    certbot renew --quiet --non-interactive
    
    # Restart web server
    # Uncomment the appropriate line for your setup:
    # systemctl start apache2
    # systemctl start nginx
    
    echo "Certificate renewal completed"
else
    echo "Certificate does not exist, obtaining new certificate"
    
    # Uncomment one of the following methods based on your setup:
    
    # Method 1: Webroot plugin (if your web server is already running)
    # certbot certonly --webroot -w $WEBROOT -d $DOMAIN -d iinou.eu --email $EMAIL --agree-tos --non-interactive
    
    # Method 2: Standalone (temporarily stops your web server)
    # systemctl stop apache2  # or nginx
    # certbot certonly --standalone -d $DOMAIN -d iinou.eu --email $EMAIL --agree-tos --non-interactive
    # systemctl start apache2  # or nginx
    
    # Method 3: Apache plugin (if using Apache)
    # certbot --apache -d $DOMAIN -d iinou.eu --email $EMAIL --agree-tos --non-interactive
    
    # Method 4: Nginx plugin (if using Nginx)
    # certbot --nginx -d $DOMAIN -d iinou.eu --email $EMAIL --agree-tos --non-interactive
    
    echo "Certificate installation completed"
    
    # Configure web server to use the new certificate
    echo "Remember to configure your web server to use the new certificate"
    echo "Certificate location: /etc/letsencrypt/live/$DOMAIN/"
fi
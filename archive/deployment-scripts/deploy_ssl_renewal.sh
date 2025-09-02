#!/bin/bash

# Deploy SSL renewal setup to production server
# Usage: ./deploy_ssl_renewal.sh <username> <server_ip>

USERNAME=$1
SERVER_IP=${2:-95.217.21.111}  # Default to the known IP if not provided

if [ -z "$USERNAME" ]; then
    echo "Error: Username is required"
    echo "Usage: ./deploy_ssl_renewal.sh <username> [server_ip]"
    exit 1
fi

echo "Deploying SSL renewal setup to $USERNAME@$SERVER_IP..."

# Create a temporary deployment directory
TEMP_DIR=$(mktemp -d)
cp setup_production_ssl.md "$TEMP_DIR/"

# Create the SSL setup script
cat > "$TEMP_DIR/setup_ssl.sh" << 'EOF'
#!/bin/bash

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}SSL Certificate Setup for www.iinou.eu${NC}"
echo "This script will set up automatic SSL certificate renewal"

# Detect web server
if command -v apache2 &> /dev/null; then
    WEB_SERVER="apache"
    echo -e "${GREEN}Detected Apache web server${NC}"
elif command -v nginx &> /dev/null; then
    WEB_SERVER="nginx"
    echo -e "${GREEN}Detected Nginx web server${NC}"
else
    echo -e "${YELLOW}No web server detected. Please install Apache or Nginx first.${NC}"
    read -p "Which web server do you plan to use? (apache/nginx): " WEB_SERVER
fi

# Install certbot and plugins
echo -e "${GREEN}Installing Certbot and plugins...${NC}"
sudo apt update
sudo apt install -y certbot

if [ "$WEB_SERVER" = "apache" ]; then
    sudo apt install -y python3-certbot-apache
elif [ "$WEB_SERVER" = "nginx" ]; then
    sudo apt install -y python3-certbot-nginx
fi

# Obtain certificate
echo -e "${GREEN}Obtaining SSL certificate for www.iinou.eu...${NC}"
if [ "$WEB_SERVER" = "apache" ]; then
    sudo certbot --apache -d www.iinou.eu -d iinou.eu
elif [ "$WEB_SERVER" = "nginx" ]; then
    sudo certbot --nginx -d www.iinou.eu -d iinou.eu
else
    echo -e "${YELLOW}Using standalone mode (will temporarily stop web server)${NC}"
    sudo certbot certonly --standalone -d www.iinou.eu -d iinou.eu
fi

# Create renewal hook
echo -e "${GREEN}Setting up renewal hook...${NC}"
sudo mkdir -p /etc/letsencrypt/renewal-hooks/post
sudo bash -c 'cat > /etc/letsencrypt/renewal-hooks/post/reload-webserver.sh << HOOK
#!/bin/bash

# Reload web server after certificate renewal
if command -v apache2ctl &> /dev/null; then
    apache2ctl graceful
elif command -v nginx &> /dev/null; then
    nginx -s reload
fi
HOOK'

sudo chmod +x /etc/letsencrypt/renewal-hooks/post/reload-webserver.sh

# Verify renewal setup
echo -e "${GREEN}Verifying renewal setup...${NC}"
sudo systemctl status certbot.timer
sudo certbot renew --dry-run

echo -e "${GREEN}SSL certificate setup complete!${NC}"
echo "Your certificates will automatically renew when needed."
echo "Certificate location: /etc/letsencrypt/live/www.iinou.eu/"
EOF

# Make the script executable
chmod +x "$TEMP_DIR/setup_ssl.sh"

# Transfer files to the server
echo "Transferring files to server..."
scp -r "$TEMP_DIR"/* "$USERNAME@$SERVER_IP:~/"

# Execute the setup script
echo "Running SSL setup script on server..."
ssh "$USERNAME@$SERVER_IP" "chmod +x ~/setup_ssl.sh && ~/setup_ssl.sh"

# Clean up
rm -rf "$TEMP_DIR"

echo "Deployment completed!"
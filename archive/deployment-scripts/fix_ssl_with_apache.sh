#!/bin/bash

# Fix SSL Certificate using Apache plugin
# This script uses Apache plugin for Let's Encrypt which handles everything automatically

echo "======================================="
echo "Fixing SSL Certificate with Apache"
echo "======================================="

# Production server credentials
PROD_HOST="95.217.21.111"
PROD_USER="root"
PROD_PASS="ininFvTPNTguUtuuLbx3"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Step 1: Installing Apache plugin for certbot...${NC}"

sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
# Install Apache plugin if not already installed
apt-get update
apt-get install -y python3-certbot-apache
EOF

echo -e "${GREEN}✓ Apache plugin installed${NC}"

echo -e "${YELLOW}Step 2: Obtaining certificate with Apache plugin...${NC}"

sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
# Use Apache plugin to get certificate
# This handles all the configuration automatically
certbot --apache -d www.iinou.eu -d iinou.eu --non-interactive --agree-tos --email admin@iinou.eu --redirect
EOF

echo -e "${YELLOW}Step 3: Testing renewal...${NC}"

sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
# Test renewal
certbot renew --dry-run
EOF

echo -e "${YELLOW}Step 4: Checking certificate status...${NC}"

sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
# Check certificates
certbot certificates
EOF

echo -e "${YELLOW}Step 5: Setting up auto-renewal monitoring...${NC}"

sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
# Create a pre-hook script to ensure services are ready
cat > /etc/letsencrypt/renewal-hooks/pre/stop-services.sh << 'PREHOOK'
#!/bin/bash
# Ensure port 80 is available for renewal
systemctl stop eno-server 2>/dev/null || true
PREHOOK

# Create a post-hook script to restart services
cat > /etc/letsencrypt/renewal-hooks/post/restart-services.sh << 'POSTHOOK'
#!/bin/bash
# Restart services after renewal
systemctl reload apache2
systemctl start eno-server 2>/dev/null || true
POSTHOOK

chmod +x /etc/letsencrypt/renewal-hooks/pre/stop-services.sh
chmod +x /etc/letsencrypt/renewal-hooks/post/restart-services.sh

# Ensure timer is active
systemctl enable certbot.timer
systemctl start certbot.timer
EOF

echo
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}SSL Certificate Fix Complete${NC}"
echo -e "${GREEN}=======================================${NC}"
echo
echo "The Apache plugin handles:"
echo "1. Certificate installation"
echo "2. Apache configuration"
echo "3. Automatic renewal setup"
echo "4. HTTP to HTTPS redirects"
echo
echo "Auto-renewal will run twice daily via systemd timer."
echo "To check timer status: systemctl status certbot.timer"

# Make script executable
chmod +x fix_ssl_with_apache.sh
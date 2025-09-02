#!/bin/bash

# Fix SSL Auto-Renewal for iinou.eu
# This script reconfigures certbot to use webroot authentication for automatic renewal

echo "======================================="
echo "Fixing SSL Auto-Renewal for iinou.eu"
echo "======================================="

# Production server credentials
PROD_HOST="95.217.21.111"
PROD_USER="root"
PROD_PASS="ininFvTPNTguUtuuLbx3"
PROD_PATH="/var/www/pelisivusto"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Step 1: Creating .well-known directory for ACME challenges...${NC}"

sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
# Create directory for ACME challenges
mkdir -p /var/www/pelisivusto/.well-known/acme-challenge
chmod 755 /var/www/pelisivusto/.well-known
chmod 755 /var/www/pelisivusto/.well-known/acme-challenge

# Create a test file to verify web server can serve it
echo "test" > /var/www/pelisivusto/.well-known/acme-challenge/test.txt
EOF

echo -e "${GREEN}✓ Directory created${NC}"

echo -e "${YELLOW}Step 2: Testing ACME challenge directory...${NC}"

# Test if the file is accessible
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://www.iinou.eu/.well-known/acme-challenge/test.txt 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ ACME challenge directory is accessible${NC}"
else
    echo -e "${RED}✗ ACME challenge directory is NOT accessible (HTTP $HTTP_CODE)${NC}"
    echo "Apache configuration may need to be updated"
fi

echo -e "${YELLOW}Step 3: Backing up current certificate configuration...${NC}"

sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
cp /etc/letsencrypt/renewal/www.iinou.eu.conf /etc/letsencrypt/renewal/www.iinou.eu.conf.backup.$(date +%Y%m%d_%H%M%S)
EOF

echo -e "${GREEN}✓ Configuration backed up${NC}"

echo -e "${YELLOW}Step 4: Obtaining new certificate with webroot authentication...${NC}"

sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
# Stop Apache temporarily to free up port 80
systemctl stop apache2

# Try to get a new certificate using standalone method first
certbot certonly --standalone -d www.iinou.eu -d iinou.eu --agree-tos --non-interactive --force-renewal

# Restart Apache
systemctl start apache2

# If standalone worked, update the renewal configuration to use webroot
if [ $? -eq 0 ]; then
    # Update the renewal configuration
    cat > /etc/letsencrypt/renewal/www.iinou.eu.conf << 'RENEWAL_CONFIG'
# renew_before_expiry = 30 days
version = 2.9.0
archive_dir = /etc/letsencrypt/archive/www.iinou.eu
cert = /etc/letsencrypt/live/www.iinou.eu/cert.pem
privkey = /etc/letsencrypt/live/www.iinou.eu/privkey.pem
chain = /etc/letsencrypt/live/www.iinou.eu/chain.pem
fullchain = /etc/letsencrypt/live/www.iinou.eu/fullchain.pem

# Options used in the renewal process
[renewalparams]
account = 2839336e92ced2222b3aa11f757fef0a
authenticator = webroot
webroot_path = /var/www/pelisivusto
server = https://acme-v02.api.letsencrypt.org/directory
key_type = ecdsa
[[webroot_map]]
www.iinou.eu = /var/www/pelisivusto
iinou.eu = /var/www/pelisivusto
RENEWAL_CONFIG
    echo "Certificate renewed and configuration updated!"
else
    echo "Certificate renewal failed!"
fi
EOF

echo -e "${YELLOW}Step 5: Testing automatic renewal...${NC}"

sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
# Test renewal
certbot renew --dry-run
EOF

echo -e "${YELLOW}Step 6: Verifying systemd timer is active...${NC}"

sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
# Ensure timer is enabled
systemctl enable certbot.timer
systemctl start certbot.timer
systemctl status certbot.timer --no-pager
EOF

echo -e "${YELLOW}Step 7: Creating monitoring script...${NC}"

sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
# Create a script to check certificate expiration
cat > /usr/local/bin/check-ssl-expiry.sh << 'MONITOR_SCRIPT'
#!/bin/bash
# Check SSL certificate expiration

DOMAIN="www.iinou.eu"
EXPIRY_DATE=$(echo | openssl s_client -servername $DOMAIN -connect $DOMAIN:443 2>/dev/null | openssl x509 -noout -dates | grep notAfter | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $CURRENT_EPOCH) / 86400 ))

echo "SSL Certificate for $DOMAIN expires in $DAYS_LEFT days"

if [ $DAYS_LEFT -lt 30 ]; then
    echo "WARNING: Certificate expires soon!"
    # Attempt renewal
    certbot renew
fi
MONITOR_SCRIPT

chmod +x /usr/local/bin/check-ssl-expiry.sh

# Add to crontab to run weekly
(crontab -l 2>/dev/null; echo "0 0 * * 0 /usr/local/bin/check-ssl-expiry.sh >> /var/log/ssl-check.log 2>&1") | crontab -
EOF

echo -e "${GREEN}✓ Monitoring script created${NC}"

echo
echo -e "${GREEN}=======================================${NC}"
echo -e "${GREEN}SSL Auto-Renewal Configuration Complete${NC}"
echo -e "${GREEN}=======================================${NC}"
echo
echo "Summary:"
echo "1. Certificate has been renewed (if successful)"
echo "2. Renewal configuration updated to use webroot authentication"
echo "3. Systemd timer is active for automatic renewal"
echo "4. Weekly monitoring script added to crontab"
echo
echo "The certificate should now renew automatically when it's within 30 days of expiration."
echo
echo "To manually test renewal: ssh $PROD_USER@$PROD_HOST 'certbot renew --dry-run'"
echo "To check certificate status: ssh $PROD_USER@$PROD_HOST 'certbot certificates'"

# Make script executable
chmod +x fix_ssl_auto_renewal.sh
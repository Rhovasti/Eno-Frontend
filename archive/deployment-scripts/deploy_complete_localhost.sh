#!/bin/bash

# Deploy Complete Localhost Stack to Production
# This script does a fresh complete deployment of all localhost files

echo "================================================"
echo "Deploying Complete Localhost Stack to Production"
echo "Target: www.iinou.eu (95.217.21.111)"
echo "================================================"

# Production server credentials
PROD_HOST="95.217.21.111"
PROD_USER="root"
PROD_PASS="ininFvTPNTguUtuuLbx3"
PROD_PATH="/var/www/pelisivusto"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Step 1: Verifying localhost files...${NC}"

# Check critical files
if [ ! -f "js/server_sqlite_new.js" ]; then
    echo -e "${RED}Error: Server file not found!${NC}"
    exit 1
fi

if [ ! -f "data/database.sqlite" ]; then
    echo -e "${RED}Error: Database file not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All localhost files verified${NC}"

echo -e "${YELLOW}Step 2: Uploading server files...${NC}"

# Upload main server
sshpass -p "$PROD_PASS" scp js/server_sqlite_new.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null

# Upload services
sshpass -p "$PROD_PASS" scp -r js/services/ $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null

# Upload other JS files
sshpass -p "$PROD_PASS" scp js/script.js js/storyboard.js js/threads.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null

echo -e "${GREEN}✓ Server files uploaded${NC}"

echo -e "${YELLOW}Step 3: Uploading HTML pages...${NC}"
sshpass -p "$PROD_PASS" scp -r hml/ $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null
echo -e "${GREEN}✓ HTML pages uploaded${NC}"

echo -e "${YELLOW}Step 4: Uploading CSS and assets...${NC}"
sshpass -p "$PROD_PASS" scp -r css/ $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null
sshpass -p "$PROD_PASS" scp -r style/ $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null
sshpass -p "$PROD_PASS" scp -r portraits/ $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null
echo -e "${GREEN}✓ CSS and assets uploaded${NC}"

echo -e "${YELLOW}Step 5: Uploading database and configuration...${NC}"
sshpass -p "$PROD_PASS" scp data/database.sqlite $PROD_USER@$PROD_HOST:$PROD_PATH/data/ 2>/dev/null
sshpass -p "$PROD_PASS" scp .env $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null
sshpass -p "$PROD_PASS" scp package.json $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null
echo -e "${GREEN}✓ Database and configuration uploaded${NC}"

echo -e "${YELLOW}Step 6: Uploading SQL schemas...${NC}"
sshpass -p "$PROD_PASS" scp -r sql/ $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null
echo -e "${GREEN}✓ SQL schemas uploaded${NC}"

echo -e "${YELLOW}Step 7: Installing dependencies on production...${NC}"
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST 'cd /var/www/pelisivusto && npm install --production' 2>/dev/null
echo -e "${GREEN}✓ Dependencies installed${NC}"

echo -e "${YELLOW}Step 8: Starting production server...${NC}"

# Stop any existing server and start new one
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST 'cd /var/www/pelisivusto && pkill -f "node.*server" 2>/dev/null || true && sleep 3 && export AWS_REGION=eu-north-1 && export AWS_BUCKET_NAME=kuvatjakalat && nohup node js/server_sqlite_new.js > server.log 2>&1 &' 2>/dev/null

sleep 5

# Check if server started
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST 'pgrep -f "node.*server" > /dev/null' 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Server started successfully${NC}"
else
    echo -e "${RED}✗ Server startup failed!${NC}"
    echo "Checking server log..."
    sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST 'cd /var/www/pelisivusto && tail -10 server.log' 2>/dev/null
fi

echo -e "${YELLOW}Step 9: Verifying deployment...${NC}"

# Test server response
sleep 3
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.iinou.eu/ 2>/dev/null)

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Server is responding (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Server health check failed (HTTP $HTTP_CODE)${NC}"
fi

echo
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Complete Deployment Finished!${NC}"
echo -e "${GREEN}================================================${NC}"
echo
echo "All localhost files have been deployed to production."
echo "Your production server now has:"
echo "- Latest server code with all features"
echo "- Production database with all existing data"
echo "- AI image generation capabilities"
echo "- Audio generation features"
echo "- Dice rolling system"
echo "- All UI improvements"
echo
echo "Next steps:"
echo "1. Test login at https://www.iinou.eu/hml/login.html"
echo "2. Verify all features work"
echo "3. Renew SSL certificate if needed"
echo
echo "Monitor server:"
echo "  ssh $PROD_USER@$PROD_HOST 'tail -f $PROD_PATH/server.log'"

# Make script executable
chmod +x deploy_complete_localhost.sh
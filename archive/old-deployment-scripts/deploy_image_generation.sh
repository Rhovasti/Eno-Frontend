#!/bin/bash

# Deploy Image Generation Feature to Production (iinou.eu)
# This script deploys the AI-powered sketch + style transfer image generation feature

echo "================================================"
echo "Deploying Image Generation Feature to Production"
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

# Function to check if file exists
check_file() {
    if [ ! -f "$1" ]; then
        echo -e "${RED}Error: Required file $1 not found!${NC}"
        exit 1
    fi
}

# Function to check if directory exists
check_dir() {
    if [ ! -d "$1" ]; then
        echo -e "${RED}Error: Required directory $1 not found!${NC}"
        exit 1
    fi
}

echo -e "${YELLOW}Step 1: Verifying required files...${NC}"

# Check critical files
check_file "js/server_sqlite_new.js"
check_file "js/services/imageService.js"
check_file "hml/threads.html"
check_file "css/styles.css"
check_file ".env"
check_dir "style"

echo -e "${GREEN}✓ All required files found${NC}"

echo -e "${YELLOW}Step 2: Creating deployment package...${NC}"

# Create temporary directory for deployment
DEPLOY_DIR="deploy_temp_$(date +%Y%m%d_%H%M%S)"
mkdir -p $DEPLOY_DIR

# Copy required files
cp -r js/server_sqlite_new.js $DEPLOY_DIR/
mkdir -p $DEPLOY_DIR/js/services
cp js/services/imageService.js $DEPLOY_DIR/js/services/
cp -r hml/threads.html $DEPLOY_DIR/hml/
cp -r css/styles.css $DEPLOY_DIR/css/
cp -r style $DEPLOY_DIR/
cp .env $DEPLOY_DIR/

# Also copy other important HTML files that might reference the feature
cp hml/login.html $DEPLOY_DIR/hml/
cp hml/storyboard.html $DEPLOY_DIR/hml/
cp hml/admin.html $DEPLOY_DIR/hml/

echo -e "${GREEN}✓ Deployment package created${NC}"

echo -e "${YELLOW}Step 3: Backing up production database...${NC}"

# Create backup of production database
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST \
    "cd $PROD_PATH && cp data/database.sqlite data/database.sqlite.backup.$(date +%Y%m%d_%H%M%S)" \
    2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database backed up${NC}"
else
    echo -e "${RED}Warning: Could not backup database${NC}"
fi

echo -e "${YELLOW}Step 4: Uploading files to production...${NC}"

# Upload each component
echo "  - Uploading server files..."
sshpass -p "$PROD_PASS" scp -r $DEPLOY_DIR/js/server_sqlite_new.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/ 2>/dev/null

echo "  - Uploading image service..."
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST "mkdir -p $PROD_PATH/js/services" 2>/dev/null
sshpass -p "$PROD_PASS" scp -r $DEPLOY_DIR/js/services/imageService.js $PROD_USER@$PROD_HOST:$PROD_PATH/js/services/ 2>/dev/null

echo "  - Uploading HTML files..."
sshpass -p "$PROD_PASS" scp -r $DEPLOY_DIR/hml/*.html $PROD_USER@$PROD_HOST:$PROD_PATH/hml/ 2>/dev/null

echo "  - Uploading CSS..."
sshpass -p "$PROD_PASS" scp -r $DEPLOY_DIR/css/styles.css $PROD_USER@$PROD_HOST:$PROD_PATH/css/ 2>/dev/null

echo "  - Uploading style reference images..."
sshpass -p "$PROD_PASS" scp -r $DEPLOY_DIR/style $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null

echo "  - Uploading environment configuration..."
sshpass -p "$PROD_PASS" scp $DEPLOY_DIR/.env $PROD_USER@$PROD_HOST:$PROD_PATH/ 2>/dev/null

echo -e "${GREEN}✓ Files uploaded successfully${NC}"

echo -e "${YELLOW}Step 5: Restarting production server...${NC}"

# Stop current server and start new one
sshpass -p "$PROD_PASS" ssh $PROD_USER@$PROD_HOST << 'EOF'
cd /var/www/pelisivusto
echo "Stopping current server..."
pkill -f "node.*server" || true
sleep 2
echo "Starting server with image generation support..."
export AWS_REGION=eu-north-1
export AWS_BUCKET_NAME=kuvatjakalat
nohup node js/server_sqlite_new.js > server.log 2>&1 &
sleep 3
# Check if server started
if pgrep -f "node.*server" > /dev/null; then
    echo "Server started successfully!"
else
    echo "Error: Server failed to start!"
    exit 1
fi
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Server restarted successfully${NC}"
else
    echo -e "${RED}✗ Server restart failed!${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 6: Verifying deployment...${NC}"

# Test if server is responding
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.iinou.eu/api/games 2>/dev/null)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Server is responding (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Server health check failed (HTTP $HTTP_CODE)${NC}"
fi

# Clean up temporary directory
rm -rf $DEPLOY_DIR

echo
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo
echo "Image Generation Feature has been deployed to production."
echo
echo "Next steps:"
echo "1. Visit https://www.iinou.eu/hml/login.html"
echo "2. Login and navigate to a game thread"
echo "3. Create a post with the image generation feature:"
echo "   - Enter a text prompt"
echo "   - Draw a sketch in the doodle canvas"
echo "   - Select a style (Comic or Sketch)"
echo "   - Click 'Generate Image'"
echo
echo "Monitor logs:"
echo "  ssh $PROD_USER@$PROD_HOST 'tail -f $PROD_PATH/server.log'"
echo
echo -e "${YELLOW}Known Issues:${NC}"
echo "- Image may take a few seconds to appear after generation"
echo "- If issues occur, check KNOWN_ISSUES.md for troubleshooting"

# Make script executable
chmod +x deploy_image_generation.sh
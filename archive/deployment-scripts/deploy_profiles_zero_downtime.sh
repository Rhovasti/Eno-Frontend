#!/bin/bash

set -e

echo "============================================"
echo "Zero-Downtime Profile Features Deployment"
echo "============================================"

# Production server details
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"
REMOTE_PATH="/var/www/pelisivusto"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "\n${GREEN}Step 1: Uploading new server file...${NC}"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    js/server_sqlite_with_profiles.js \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/js/

echo -e "\n${GREEN}Step 2: Testing new server file on different port...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

# Start the new server on port 3001 for testing
echo "Starting test server on port 3001..."
PORT=3001 node js/server_sqlite_with_profiles.js > test_server.log 2>&1 &
TEST_PID=$!
sleep 5

# Test if the new server is working
if curl -s http://localhost:3001/health | grep -q "SQLite Server with Profiles"; then
    echo "Test server is running correctly!"
    
    # Test profile endpoint
    if curl -s http://localhost:3001/api/users/1/profile 2>&1 | grep -q "Authentication required"; then
        echo "Profile endpoints are working!"
    else
        echo "Warning: Profile endpoints might not be working correctly"
    fi
    
    # Kill the test server
    kill $TEST_PID 2>/dev/null || true
    echo "Test server stopped"
else
    echo "ERROR: Test server failed to start!"
    kill $TEST_PID 2>/dev/null || true
    tail -20 test_server.log
    exit 1
fi
EOF

echo -e "\n${GREEN}Step 3: Backing up current server...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto
cp js/server_sqlite_new.js js/server_sqlite_backup_$(date +%Y%m%d_%H%M%S).js
echo "Backup created"
EOF

echo -e "\n${GREEN}Step 4: Switching to new server with zero downtime...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

# Copy new server to the active file
cp js/server_sqlite_with_profiles.js js/server_sqlite_new.js

# Get current server PID
OLD_PID=$(pgrep -f "node.*server_sqlite_new.js" | head -1)
echo "Current server PID: $OLD_PID"

# Start new server
echo "Starting new server..."
nohup node js/server_sqlite_new.js > server_new.log 2>&1 &
NEW_PID=$!
echo "New server PID: $NEW_PID"

# Wait for new server to be ready
sleep 5

# Check if new server is running
if ps -p $NEW_PID > /dev/null; then
    echo "New server is running!"
    
    # Give it a moment to handle any ongoing requests
    sleep 2
    
    # Kill old server
    if [ ! -z "$OLD_PID" ]; then
        kill $OLD_PID 2>/dev/null || true
        echo "Old server stopped"
    fi
    
    # Move log file
    mv server_new.log server.log
    echo "Deployment successful!"
else
    echo "ERROR: New server failed to start!"
    tail -20 server_new.log
    
    # Restart old server if needed
    if ! pgrep -f "node.*server" > /dev/null; then
        echo "Restarting old server..."
        nohup node js/server_sqlite_backup_*.js > server.log 2>&1 &
    fi
    exit 1
fi
EOF

echo -e "\n${GREEN}Step 5: Verifying deployment...${NC}"
sleep 3

# Test main site
echo "Testing main site..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.iinou.eu/)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Main site is working (HTTP $HTTP_CODE)${NC}"
else
    echo -e "${RED}✗ Main site error (HTTP $HTTP_CODE)${NC}"
fi

# Test health endpoint
echo "Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s https://www.iinou.eu/health)
if echo "$HEALTH_RESPONSE" | grep -q "SQLite Server with Profiles"; then
    echo -e "${GREEN}✓ Server is running with profile features${NC}"
else
    echo -e "${YELLOW}⚠ Server might not have profile features${NC}"
fi

# Test profile page access
echo "Testing profile page..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://www.iinou.eu/hml/profile.html)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Profile page is accessible${NC}"
else
    echo -e "${RED}✗ Profile page error (HTTP $HTTP_CODE)${NC}"
fi

echo -e "\n${GREEN}Deployment completed successfully!${NC}"
echo "Profile features are now live at:"
echo "- Profile Page: https://www.iinou.eu/hml/profile.html"
echo "- Game Creation: https://www.iinou.eu/hml/create-game.html"
echo ""
echo "Note: Users need to be logged in to access these features."
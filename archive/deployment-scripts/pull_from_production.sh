#!/bin/bash

# Pull data FROM production server to localhost
# This syncs localhost with production (production -> localhost)

set -e

echo "==================================="
echo "Pull from Production Server"
echo "==================================="

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

echo -e "${YELLOW}Starting pull from production...${NC}"

# Step 1: Download production database
echo -e "\n${GREEN}Step 1: Downloading production database...${NC}"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/data/database.sqlite \
    data/database_from_production.sqlite

# Step 2: Download production code files
echo -e "\n${GREEN}Step 2: Downloading production code files...${NC}"

# Create temp directory for downloads
mkdir -p temp_production_files/{js,hml,css,sql}

# Download JavaScript files
echo "Downloading JavaScript files..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/js/*.js \
    temp_production_files/js/

# Download HTML files
echo "Downloading HTML files..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/hml/*.html \
    temp_production_files/hml/

# Download CSS files
echo "Downloading CSS files..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/css/*.css \
    temp_production_files/css/

# Download root files
echo "Downloading root files..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/index.html \
    $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/package.json \
    temp_production_files/

# Step 3: Compare and show differences
echo -e "\n${GREEN}Step 3: Comparing files...${NC}"

echo -e "\n${YELLOW}Database differences:${NC}"
if [ -f data/database.sqlite ] && [ -f data/database_from_production.sqlite ]; then
    LOCAL_SIZE=$(stat -c%s data/database.sqlite)
    PROD_SIZE=$(stat -c%s data/database_from_production.sqlite)
    echo "Local database size: $LOCAL_SIZE bytes"
    echo "Production database size: $PROD_SIZE bytes"
    
    # Show table counts
    echo -e "\n${YELLOW}Local database tables:${NC}"
    sqlite3 data/database.sqlite "SELECT name FROM sqlite_master WHERE type='table';" | sort
    
    echo -e "\n${YELLOW}Production database tables:${NC}"
    sqlite3 data/database_from_production.sqlite "SELECT name FROM sqlite_master WHERE type='table';" | sort
fi

echo -e "\n${YELLOW}File differences:${NC}"
# Compare key files
for file in js/server.js js/server_sqlite_new.js js/script.js js/storyboard.js js/threads.js; do
    if [ -f "$file" ] && [ -f "temp_production_files/$file" ]; then
        if ! diff -q "$file" "temp_production_files/$file" > /dev/null; then
            echo -e "${RED}DIFFERENT:${NC} $file"
        else
            echo -e "${GREEN}IDENTICAL:${NC} $file"
        fi
    fi
done

# Step 4: Ask for confirmation
echo -e "\n${YELLOW}WARNING: This will replace your local files with production versions!${NC}"
echo -e "Do you want to proceed with the sync? (yes/no)"
read -r response

if [ "$response" = "yes" ]; then
    echo -e "\n${GREEN}Step 4: Applying production files to localhost...${NC}"
    
    # Backup current local files
    echo "Creating backup of current local files..."
    tar -czf backups/local_files_$(date +%Y%m%d_%H%M%S).tar.gz js/ hml/ css/ data/ index.html package.json
    
    # Replace database
    echo "Replacing database..."
    mv data/database.sqlite data/database_old_$(date +%Y%m%d_%H%M%S).sqlite
    mv data/database_from_production.sqlite data/database.sqlite
    
    # Replace code files
    echo "Replacing code files..."
    cp -r temp_production_files/js/* js/
    cp -r temp_production_files/hml/* hml/
    cp -r temp_production_files/css/* css/
    cp temp_production_files/index.html .
    cp temp_production_files/package.json .
    
    # Install npm dependencies
    echo "Installing npm dependencies..."
    npm install
    
    echo -e "\n${GREEN}Sync completed successfully!${NC}"
    echo "Your localhost now matches production."
    echo "To start the server, run: node js/server_sqlite_new.js"
else
    echo -e "\n${YELLOW}Sync cancelled. No files were changed.${NC}"
    echo "Production files are available in temp_production_files/ for manual review."
fi

# Cleanup temp files if sync was applied
if [ "$response" = "yes" ]; then
    rm -rf temp_production_files
fi

echo -e "\n${GREEN}Done!${NC}"
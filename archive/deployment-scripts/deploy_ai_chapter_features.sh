#!/bin/bash

echo "=== Deploying AI Chapter Generation Features ==="

# Configuration
REMOTE_HOST="root@95.217.21.111"
REMOTE_PASSWORD="ininFvTPNTguUtuuLbx3"
REMOTE_DIR="/var/www/html"

# Create a temporary directory for deployment
TEMP_DIR=$(mktemp -d)
echo "Using temporary directory: $TEMP_DIR"

# Copy necessary files
echo "Preparing files for deployment..."
cp js/server_sqlite_ai_extended.js "$TEMP_DIR/server_sqlite_ai_extended.js"
cp hml/create-game-ai-enhanced.html "$TEMP_DIR/create-game.html"
cp .env.example "$TEMP_DIR/.env.example"

# Create deployment package
cd "$TEMP_DIR"
tar -czf ai-chapter-features.tar.gz *
cd -

echo "=== Uploading files to production server ==="
sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no "$TEMP_DIR/ai-chapter-features.tar.gz" "$REMOTE_HOST:/tmp/"

echo "=== Applying changes on production server ==="
sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no "$REMOTE_HOST" << 'ENDSSH'
cd /var/www/html

# Backup current files
echo "Backing up current files..."
cp hml/create-game.html hml/create-game.backup.$(date +%Y%m%d_%H%M%S).html 2>/dev/null || true
cp js/server.js js/server.backup.$(date +%Y%m%d_%H%M%S).js 2>/dev/null || true

# Extract new files
echo "Extracting new files..."
tar -xzf /tmp/ai-chapter-features.tar.gz

# Use the extended AI server as the main server
cp server_sqlite_ai_extended.js js/server_ai_enhanced.js

# Check if AI API key is configured
if [ ! -f .env ]; then
    echo "WARNING: .env file not found. AI features will be disabled."
    echo "To enable AI features, create .env file with:"
    echo "AI_API_KEY=your-anthropic-api-key"
fi

# Install Anthropic SDK if not already installed
if ! npm list @anthropic-ai/sdk >/dev/null 2>&1; then
    echo "Installing Anthropic SDK..."
    npm install @anthropic-ai/sdk
fi

# Find and stop current server
echo "Stopping current server..."
pkill -f "node.*server" || true
sleep 2

# Start new server with AI features
echo "Starting server with AI chapter features..."
nohup node js/server_ai_enhanced.js > server.log 2>&1 &

sleep 3

# Check if server started successfully
if pgrep -f "node.*server_ai_enhanced" > /dev/null; then
    echo "✓ Server started successfully with AI chapter features"
    
    # Test the new endpoints
    echo -e "\nTesting AI endpoints..."
    curl -s http://localhost:3000/api/ai/usage -H "Authorization: Bearer test" | head -c 100
    echo -e "\n"
else
    echo "✗ Server failed to start. Rolling back..."
    
    # Rollback
    mv hml/create-game.backup.*.html hml/create-game.html 2>/dev/null || true
    nohup node js/server.js > server.log 2>&1 &
    
    echo "Check server.log for errors"
    exit 1
fi

# Clean up
rm /tmp/ai-chapter-features.tar.gz

echo -e "\n=== Deployment complete ==="
echo "AI Chapter Generation features are now available:"
echo "1. GMs can generate first chapter when creating games"
echo "2. GMs can generate complete story arcs with multiple chapters"
echo "3. AI-generated content can be edited before saving"
echo ""
echo "Note: Ensure AI_API_KEY is set in .env file for features to work"

ENDSSH

# Clean up local temp directory
rm -rf "$TEMP_DIR"

echo -e "\n=== Deployment finished ==="
echo "Access the site at https://www.iinou.eu"
echo "Test the new AI features in the game creation page"
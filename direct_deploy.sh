#!/bin/bash

echo "Direct deployment to production..."

# Server details from sync_production.sh
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"
REMOTE_PATH="/var/www/pelisivusto"

# First, let's check what's currently on production
echo "1. Checking current production setup..."
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto
echo "Current server file:"
ls -la js/server*.js
echo "Current package.json dependencies:"
grep -A5 dependencies package.json
echo "Checking for .env file:"
ls -la .env 2>/dev/null || echo "No .env file found"
EOF
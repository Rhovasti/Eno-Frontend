#!/bin/bash

# Deploy enhanced AI GM server

echo "Deploying enhanced AI GM server..."

# Copy the enhanced server file
cp js/server_sqlite_ai_gm_enhanced.js js/server_sqlite.js

# Create deployment package
tar -czf eno-ai-gm-enhanced.tar.gz \
    js/server_sqlite.js \
    hml/order-game.html \
    hml/gm-dashboard.html \
    sql/add_ai_gm_tables.sql

echo "Package created: eno-ai-gm-enhanced.tar.gz"
echo "Please manually upload this package to production and restart the service"
echo ""
echo "On production server:"
echo "1. tar -xzf eno-ai-gm-enhanced.tar.gz"
echo "2. sudo systemctl restart eno-frontend"
echo "3. Test AI GM features at https://www.iinou.eu/hml/order-game.html"
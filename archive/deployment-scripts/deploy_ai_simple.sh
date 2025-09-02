#!/bin/bash

echo "Deploying AI features to production..."

# First, let's create a single deployable server file that includes all features
cat > js/server_production.js << 'EOF'
// Production server with all features
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// Note: Anthropic SDK will be added after deployment
let Anthropic;
try {
    Anthropic = require('@anthropic-ai/sdk');
} catch (e) {
    console.log('Anthropic SDK not installed - AI features disabled');
}

const app = express();
const port = process.env.PORT || 3000;

// Production configuration
const JWT_SECRET = process.env.JWT_SECRET || 'eno-game-platform-secret-key-change-in-production';
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_ENABLED = !!AI_API_KEY && !!Anthropic;

if (AI_ENABLED) {
    console.log('AI features enabled');
} else {
    console.log('AI features disabled - set AI_API_KEY in environment');
}

// Copy the rest of server_sqlite_ai.js content here...
// (This would be the full server code)
EOF

echo "Creating deployment package..."

# Create a tarball with all necessary files
tar -czf eno-ai-deploy.tar.gz \
    js/server_sqlite_ai.js \
    js/threads.js \
    hml/create-game.html \
    hml/profile.html \
    css/styles.css \
    package.json \
    .env.example

echo "Package created: eno-ai-deploy.tar.gz"
echo ""
echo "Manual deployment steps:"
echo "1. Copy the file to production:"
echo "   scp eno-ai-deploy.tar.gz eno@www.iinou.eu:/var/www/html/"
echo ""
echo "2. SSH to production and extract:"
echo "   ssh eno@www.iinou.eu"
echo "   cd /var/www/html"
echo "   tar -xzf eno-ai-deploy.tar.gz"
echo ""
echo "3. Install dependencies:"
echo "   npm install @anthropic-ai/sdk dotenv"
echo ""
echo "4. Create/update .env file with:"
echo "   AI_API_KEY=your-claude-api-key"
echo "   PORT=3000"
echo ""
echo "5. Update database schema:"
echo "   sqlite3 data/database.sqlite < update_schema.sql"
echo ""
echo "6. Restart server:"
echo "   pkill -f node"
echo "   nohup node js/server_sqlite_ai.js > server.log 2>&1 &"
#!/bin/bash

echo "=== Deploying AI Features to Production ==="

# Production server details
REMOTE_HOST="www.iinou.eu"
REMOTE_USER="eno"
REMOTE_PATH="/var/www/html"

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting deployment to production server...${NC}"

# Step 1: Check connection
echo -e "\n${YELLOW}1. Testing connection to production server...${NC}"
if ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST "echo 'Connection successful'" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Connection established${NC}"
else
    echo -e "${RED}✗ Failed to connect to server${NC}"
    exit 1
fi

# Step 2: Backup production database
echo -e "\n${YELLOW}2. Backing up production database...${NC}"
ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html
if [ -f data/database.sqlite ]; then
    cp data/database.sqlite data/database.sqlite.backup.$(date +%Y%m%d_%H%M%S)
    echo "Database backed up successfully"
else
    echo "Warning: SQLite database not found"
fi
EOF

# Step 3: Create file list for deployment
echo -e "\n${YELLOW}3. Preparing files for deployment...${NC}"
cat > /tmp/deploy_files.txt << 'FILELIST'
js/server_sqlite_ai.js
js/threads.js
hml/create-game.html
hml/profile.html
css/styles.css
package.json
.env.example
AI_CONTENT_PLAN.md
FILELIST

# Step 4: Upload files
echo -e "\n${YELLOW}4. Uploading files...${NC}"
while IFS= read -r file; do
    if [ -f "$file" ]; then
        echo -n "Uploading $file... "
        if scp -o StrictHostKeyChecking=no "$file" $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/$file 2>/dev/null; then
            echo -e "${GREEN}✓${NC}"
        else
            echo -e "${RED}✗${NC}"
        fi
    else
        echo -e "${YELLOW}Skipping $file (not found)${NC}"
    fi
done < /tmp/deploy_files.txt

# Step 5: Install dependencies and setup environment
echo -e "\n${YELLOW}5. Installing dependencies and setting up environment...${NC}"
ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html

# Install new npm packages
echo "Installing npm packages..."
npm install @anthropic-ai/sdk dotenv

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "IMPORTANT: Remember to add the Claude API key to .env file!"
fi

# Update database schema
echo "Checking database schema..."
sqlite3 data/database.sqlite << 'SQL'
-- Add missing columns if they don't exist
ALTER TABLE users ADD COLUMN is_gm BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL;

-- Create AI usage table
CREATE TABLE IF NOT EXISTS ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost_cents INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create game_players table if missing
CREATE TABLE IF NOT EXISTS game_players (
    game_id INTEGER,
    user_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game_id, user_id),
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Update admin user to have GM privileges
UPDATE users SET is_gm = 1 WHERE is_admin = 1;
SQL

echo "Database schema updated"
EOF

# Step 6: Create startup script
echo -e "\n${YELLOW}6. Creating startup script...${NC}"
ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html

cat > start_server.sh << 'SCRIPT'
#!/bin/bash
cd /var/www/html
pkill -f "node.*server" || true
sleep 2
PORT=3000 nohup node js/server_sqlite_ai.js > server.log 2>&1 &
echo "Server started with PID: $!"
SCRIPT

chmod +x start_server.sh
EOF

# Step 7: Restart server
echo -e "\n${YELLOW}7. Restarting production server...${NC}"
ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/html
./start_server.sh
sleep 3

# Check if server is running
if pgrep -f "node.*server_sqlite_ai" > /dev/null; then
    echo "Server is running"
else
    echo "Warning: Server may not have started properly"
    tail -20 server.log
fi
EOF

# Step 8: Verify deployment
echo -e "\n${YELLOW}8. Verifying deployment...${NC}"
sleep 5
if curl -s -o /dev/null -w "%{http_code}" https://www.iinou.eu | grep -q "200"; then
    echo -e "${GREEN}✓ Site is accessible${NC}"
else
    echo -e "${RED}✗ Site is not responding properly${NC}"
fi

# Final instructions
echo -e "\n${GREEN}=== Deployment Complete ===${NC}"
echo -e "\n${YELLOW}IMPORTANT NEXT STEPS:${NC}"
echo "1. SSH into the server: ssh $REMOTE_USER@$REMOTE_HOST"
echo "2. Edit the .env file: nano /var/www/html/.env"
echo "3. Add your Claude API key:"
echo "   AI_API_KEY="
echo "4. Restart the server: cd /var/www/html && ./start_server.sh"
echo -e "\n${YELLOW}Test URLs:${NC}"
echo "- Homepage: https://www.iinou.eu"
echo "- Login: https://www.iinou.eu/hml/login.html"
echo "- Create Game (GM): https://www.iinou.eu/hml/create-game.html"

# Cleanup
rm -f /tmp/deploy_files.txt
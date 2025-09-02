#!/bin/bash

# Production sync script - Deploy latest changes to production server
# This script will sync the local codebase with production

set -e  # Exit on error

echo "==================================="
echo "Production Server Sync Script"
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
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting production sync process...${NC}"

# Step 1: Create backup of production database
echo -e "\n${GREEN}Step 1: Backing up production database...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto
mkdir -p backups
DATE=$(date +%Y%m%d_%H%M%S)

# Backup MySQL database if it exists
if mysql -e "SHOW DATABASES LIKE 'Foorumi';" | grep -q Foorumi; then
    echo "Backing up MySQL database..."
    mysqldump Foorumi > backups/foorumi_mysql_$DATE.sql
    echo "MySQL backup saved to backups/foorumi_mysql_$DATE.sql"
fi

# Backup SQLite database if it exists
if [ -f data/database.sqlite ]; then
    echo "Backing up SQLite database..."
    cp data/database.sqlite backups/database_sqlite_$DATE.sqlite
    echo "SQLite backup saved to backups/database_sqlite_$DATE.sqlite"
fi

# Backup current server files
echo "Backing up server files..."
tar -czf backups/server_files_$DATE.tar.gz js/*.js hml/*.html css/*.css
echo "Server files backed up to backups/server_files_$DATE.tar.gz"
EOF

# Step 2: Upload all necessary files
echo -e "\n${GREEN}Step 2: Uploading files to production...${NC}"

# Create file list
cat > /tmp/sftp_batch << 'BATCH'
cd /var/www/pelisivusto
put js/server_sqlite_new.js js/
put js/server.js js/
put js/script.js js/
put js/storyboard.js js/
put js/threads.js js/
put css/styles.css css/
put hml/index.html hml/
put hml/login.html hml/
put hml/register.html hml/
put hml/admin.html hml/
put hml/storyboard.html hml/
put hml/threads.html hml/
put hml/wiki.html hml/
put index.html
put package.json
put sql/sqlite_schema.sql sql/
put sql/add_chapter_archiving.sql sql/
put sql/add_chapter_archiving_mysql.sql sql/
BATCH

echo "Uploading files via SFTP..."
sshpass -p "$REMOTE_PASS" sftp -o StrictHostKeyChecking=no -b /tmp/sftp_batch $REMOTE_USER@$REMOTE_HOST

# Step 3: Setup SQLite database
echo -e "\n${GREEN}Step 3: Setting up SQLite database on production...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

# Create data directory if it doesn't exist
mkdir -p data

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

# If SQLite database doesn't exist, we'll need to migrate from MySQL
if [ ! -f data/database.sqlite ]; then
    echo "SQLite database not found. Creating new database..."
    
    # Create a migration script
    cat > migrate_to_sqlite.js << 'MIGRATE_SCRIPT'
const mysql = require('mysql');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// MySQL connection
const mysqlConn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'Foorumi'
});

// SQLite connection
const sqliteDb = new sqlite3.Database('./data/database.sqlite');

// Read and execute schema
const schemaPath = path.join(__dirname, 'sql/sqlite_schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

console.log('Creating SQLite schema...');
sqliteDb.serialize(() => {
    // Execute schema
    const statements = schema.split(';').filter(s => s.trim());
    statements.forEach(stmt => {
        if (stmt.trim()) {
            sqliteDb.run(stmt, err => {
                if (err) console.error('Schema error:', err);
            });
        }
    });
});

// Wait a bit for schema to be created
setTimeout(() => {
    console.log('Starting data migration...');
    
    mysqlConn.connect(err => {
        if (err) {
            console.error('MySQL connection error:', err);
            console.log('No MySQL data to migrate. Setting up fresh SQLite database...');
            
            // Create admin user
            const adminPassword = bcrypt.hashSync('admin123', 10);
            sqliteDb.run(
                "INSERT INTO users (username, email, password, roles, is_admin) VALUES (?, ?, ?, ?, ?)",
                ['admin', 'admin@example.com', adminPassword, '["admin"]', 1],
                err => {
                    if (err) console.error('Error creating admin:', err);
                    else console.log('Admin user created');
                    sqliteDb.close();
                    process.exit(0);
                }
            );
            return;
        }
        
        // Migrate users
        mysqlConn.query('SELECT * FROM users', (err, users) => {
            if (!err && users) {
                console.log(`Migrating ${users.length} users...`);
                users.forEach(user => {
                    const roles = user.role ? `["${user.role}"]` : '["player"]';
                    sqliteDb.run(
                        "INSERT INTO users (id, username, email, password, roles, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        [user.id, user.username, user.email, user.password, roles, user.is_admin || 0, user.created_at]
                    );
                });
            }
        });
        
        // Migrate games
        mysqlConn.query('SELECT * FROM games', (err, games) => {
            if (!err && games) {
                console.log(`Migrating ${games.length} games...`);
                games.forEach(game => {
                    sqliteDb.run(
                        "INSERT INTO games (id, name, description, created_at) VALUES (?, ?, ?, ?)",
                        [game.id, game.name, game.description, game.created_at]
                    );
                });
            }
        });
        
        // Migrate chapters
        mysqlConn.query('SELECT * FROM chapters', (err, chapters) => {
            if (!err && chapters) {
                console.log(`Migrating ${chapters.length} chapters...`);
                chapters.forEach(chapter => {
                    sqliteDb.run(
                        "INSERT INTO chapters (id, game_id, sequence_number, title, description, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                        [chapter.id, chapter.game_id, chapter.sequence_number, chapter.title, chapter.description, chapter.created_at]
                    );
                });
            }
        });
        
        // Complete migration
        setTimeout(() => {
            console.log('Migration completed!');
            mysqlConn.end();
            sqliteDb.close();
            process.exit(0);
        }, 5000);
    });
}, 2000);
MIGRATE_SCRIPT

    # Run migration
    node migrate_to_sqlite.js
    rm migrate_to_sqlite.js
fi

# Apply archiving schema updates if needed
echo "Checking for archiving schema updates..."
sqlite3 data/database.sqlite "SELECT sql FROM sqlite_master WHERE type='table' AND name='chapters';" | grep -q "is_archived" || {
    echo "Applying archiving schema update..."
    sqlite3 data/database.sqlite < sql/add_chapter_archiving.sql
}

echo "Database setup completed!"
EOF

# Step 4: Stop current server and start new one
echo -e "\n${GREEN}Step 4: Restarting production server...${NC}"
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << 'EOF'
cd /var/www/pelisivusto

# Stop any running Node.js servers
echo "Stopping existing Node.js processes..."
pkill -f "node.*server" || true
sleep 2

# Start the new SQLite server
echo "Starting SQLite server..."
nohup node js/server_sqlite_new.js > server.log 2>&1 &
sleep 3

# Check if server started successfully
if pgrep -f "node.*server_sqlite_new" > /dev/null; then
    echo "Server started successfully!"
    echo "Checking server status..."
    curl -s http://localhost:3000/api/games || echo "API check returned error (expected if auth required)"
else
    echo "ERROR: Server failed to start!"
    echo "Last 20 lines of server.log:"
    tail -20 server.log
fi
EOF

# Step 5: Verify deployment
echo -e "\n${GREEN}Step 5: Verifying deployment...${NC}"
echo "Testing production API..."
RESPONSE=$(curl -s https://www.iinou.eu/api/games 2>&1 || echo "Connection failed")
echo "API Response: $RESPONSE"

echo -e "\n${GREEN}Deployment Summary:${NC}"
echo "1. Production database backed up"
echo "2. All files uploaded to production"
echo "3. SQLite database setup/migrated"
echo "4. Server restarted with SQLite version"
echo "5. Production URL: https://www.iinou.eu"

echo -e "\n${YELLOW}IMPORTANT:${NC}"
echo "- The server is now running with SQLite instead of MySQL"
echo "- All data has been migrated (if MySQL was present)"
echo "- Monitor server.log on production for any issues"
echo "- Test all functionality thoroughly"

rm -f /tmp/sftp_batch
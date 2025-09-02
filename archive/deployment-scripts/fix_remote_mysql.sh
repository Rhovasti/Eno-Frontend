#!/bin/bash

# Remote server details
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"
REMOTE_DIR="/var/www/pelisivusto"

echo "=== Fixing MySQL on Remote Production Server ==="

# First, copy the fail-safe schema to the remote server
echo "Copying fail-safe schema to remote server..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no sql/mysql.txt "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/sql/"

# Connect to the remote server and fix MySQL
echo "Connecting to remote server and fixing MySQL..."
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << 'ENDSSH'
cd /var/www/pelisivusto

echo "== Checking MySQL service =="
systemctl status mysql || systemctl status mariadb

# Try to restart MySQL if it's not running
if [ $? -ne 0 ]; then
  echo "Attempting to restart MySQL..."
  systemctl restart mysql || systemctl restart mariadb
  if [ $? -ne 0 ]; then
    echo "Failed to restart MySQL. Exiting."
    exit 1
  fi
fi

echo "== Backing up current database (if exists) =="
if mysql -e "SHOW DATABASES" 2>/dev/null | grep -q Foorumi; then
  mysqldump Foorumi > Foorumi_backup_$(date +%Y%m%d%H%M%S).sql 2>/dev/null
  echo "Backup created."
fi

echo "== Dropping existing database =="
mysql -e "DROP DATABASE IF EXISTS Foorumi;" 2>/dev/null

echo "== Importing fail-safe schema =="
mysql < sql/mysql.txt

echo "== Creating test users =="
mysql -e "USE Foorumi; 
INSERT INTO users (username, role) VALUES ('admin', 'op'), ('gm', 'gm'), ('player', 'player');"

echo "== Creating test game structure =="
mysql -e "USE Foorumi;
INSERT INTO games (name, description) VALUES ('Test Game', 'A test game created during MySQL recovery');
INSERT INTO chapters (game_id, sequence_number, title, description) VALUES (1, 1, 'Chapter 1', 'First chapter');
INSERT INTO beats (chapter_id, sequence_number) VALUES (1, 1);
INSERT INTO posts (beat_id, author_id, title, content, post_type) VALUES (1, 1, 'Welcome', 'Welcome to the recovered game!', 'gm');"

echo "== Verifying tables were created =="
mysql -e "USE Foorumi; SHOW TABLES;"

echo "== Setting up MySQL user for Node.js =="
mysql -e "CREATE USER IF NOT EXISTS 'eno_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password123';"
mysql -e "GRANT ALL PRIVILEGES ON Foorumi.* TO 'eno_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "== Testing application user connection =="
mysql -u eno_user -p'password123' -e "USE Foorumi; SELECT COUNT(*) FROM users;"
if [ $? -eq 0 ]; then
  echo "Application user connection successful."
else
  echo "WARNING: Application user connection failed."
fi

echo "== Updating server.js to use the new credentials =="
sed -i 's/user: ".*", \/\/ Using/user: "eno_user", \/\/ Using/g' js/server.js
sed -i 's/password: ".*", \/\/ /password: "password123", \/\/ /g' js/server.js

echo "== Restarting the Node.js service =="
systemctl restart eno-server
sleep 3
systemctl status eno-server

echo "== Checking server health =="
curl -s http://localhost:3000/health
echo ""
ENDSSH

echo "=== MySQL fix on remote server complete! ==="
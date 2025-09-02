#!/bin/bash

# Remote server details
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"
REMOTE_DIR="/var/www/pelisivusto"

echo "=== Setting up MySQL Database on Remote Server ==="

# Copy the fail-safe schema to the remote server
echo "Copying fail-safe schema to remote server..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no sql/mysql.txt "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/sql/"

# Connect to the remote server and set up the database
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << 'ENDSSH'
cd /var/www/pelisivusto

echo "== Checking MySQL status =="
if ! systemctl is-active mysql &>/dev/null; then
  echo "MySQL is not running. Starting MySQL..."
  systemctl start mysql
  sleep 5
fi

echo "== Creating Foorumi database =="
mysql -e "CREATE DATABASE IF NOT EXISTS Foorumi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "== Importing schema from fail-safe file =="
if [ -f sql/mysql.txt ]; then
  mysql Foorumi < sql/mysql.txt
  echo "Schema imported successfully."
else
  echo "WARNING: Schema file not found at sql/mysql.txt"
  ls -la sql/
fi

echo "== Creating test users =="
mysql -e "USE Foorumi; 
INSERT IGNORE INTO users (username, role) VALUES ('admin', 'op'), ('gm', 'gm'), ('player', 'player');"

echo "== Creating test game structure =="
mysql -e "USE Foorumi;
INSERT IGNORE INTO games (name, description) VALUES ('Test Game', 'A test game created during MySQL recovery');
INSERT IGNORE INTO chapters (game_id, sequence_number, title, description) VALUES (1, 1, 'Chapter 1', 'First chapter');
INSERT IGNORE INTO beats (chapter_id, sequence_number) VALUES (1, 1);
INSERT IGNORE INTO posts (beat_id, author_id, title, content, post_type) VALUES (1, 1, 'Welcome', 'Welcome to the recovered game!', 'gm');"

echo "== Verifying tables were created =="
mysql -e "USE Foorumi; SHOW TABLES;"

echo "== Setting up MySQL user for Node.js =="
mysql -e "CREATE USER IF NOT EXISTS 'eno_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password123';"
mysql -e "GRANT ALL PRIVILEGES ON Foorumi.* TO 'eno_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "== Testing application user connection =="
mysql -u eno_user -p'password123' -e "USE Foorumi; SELECT 'Connection test successful';"

echo "== Updating server.js to use the new credentials =="
cp js/server.js js/server.js.bak
sed -i 's/user: ".*", \/\/ Using/user: "eno_user", \/\/ Using/g' js/server.js
sed -i 's/password: ".*", \/\/ /password: "password123", \/\/ /g' js/server.js
echo "Server configuration updated"

echo "== Restarting Node.js server =="
systemctl restart eno-server
sleep 3
systemctl status eno-server

echo "== Testing server health =="
curl -s http://localhost:3000/health
ENDSSH

echo "=== MySQL database setup complete ==="
#!/bin/bash

# Remote server details
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"
REMOTE_DIR="/var/www/pelisivusto"

echo "=== Setting up MySQL Database on Remote Server ==="

# First, copy the fail-safe schema to the remote server (if needed)
echo "Copying fail-safe schema to remote server..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no sql/mysql.txt "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/sql/"

# Connect to the remote server and set up the database
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << 'ENDSSH'
cd /var/www/pelisivusto

echo "== Creating Foorumi database =="
mysql -e "CREATE DATABASE IF NOT EXISTS Foorumi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "== Importing schema from fail-safe file =="
mysql Foorumi < sql/mysql.txt

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
mysql -u eno_user -p'password123' -e "USE Foorumi; SELECT 'Connection test successful';"

echo "== Updating server.js to use the new credentials =="
sed -i 's/user: ".*", \/\/ Using/user: "eno_user", \/\/ Using/g' /var/www/pelisivusto/js/server.js
sed -i 's/password: ".*", \/\/ /password: "password123", \/\/ /g' /var/www/pelisivusto/js/server.js

echo "== Restarting Node.js server =="
systemctl restart eno-server
sleep 3
systemctl status eno-server
ENDSSH

echo "=== MySQL database setup complete ==="
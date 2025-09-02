#!/bin/bash

# Remote server details
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"
REMOTE_DIR="/var/www/pelisivusto"

echo "=== Deploying MySQL-Compatible SQLite Server to Remote Host ==="

# First, check if we have the necessary files
if [ ! -f js/server_sqlite_new.js ]; then
  echo "ERROR: SQLite server file not found at js/server_sqlite_new.js"
  exit 1
fi

if [ ! -f sql/sqlite_schema.sql ]; then
  echo "ERROR: SQLite schema file not found at sql/sqlite_schema.sql"
  exit 1
fi

# Create directory structures if needed
echo "Creating necessary directories..."
mkdir -p sql

# Copy the SQLite server and schema files to the remote server
echo "Copying SQLite server and schema to remote server..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no js/server_sqlite_new.js "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/js/"
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no sql/sqlite_schema.sql "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/sql/"

# Connect to the remote server and set up the SQLite server
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << 'ENDSSH'
cd /var/www/pelisivusto

# Create required directories
echo "Creating directories if they don't exist..."
mkdir -p data
mkdir -p sql

# Backup the current server files
echo "Backing up current server files..."
cp -f js/server.js js/server.js.mysql.bak
[ -f js/server_sqlite.js ] && cp -f js/server_sqlite.js js/server_sqlite.js.bak

# Install SQLite module if needed
echo "Installing SQLite module..."
npm install sqlite3 --save

# Update the server files
echo "Updating server files..."
cp -f js/server_sqlite_new.js js/server_sqlite_new.js
mv -f sql/sqlite_schema.sql sql/sqlite_schema.sql

# Check if existing SQLite database exists, backup if it does
if [ -f data/database.sqlite ]; then
  echo "Backing up existing SQLite database..."
  cp -f data/database.sqlite data/database.sqlite.bak.$(date +%Y%m%d%H%M%S)
fi

# Update the service file to use the new SQLite server
echo "Updating service file to use new SQLite server..."
systemctl stop eno-server

# Update the service unit file
cat > /etc/systemd/system/eno-server.service << 'EOFS'
[Unit]
Description=Eno Game Platform Server (MySQL-Compatible SQLite)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/pelisivusto
ExecStart=/usr/bin/node /var/www/pelisivusto/js/server_sqlite_new.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=eno-server

[Install]
WantedBy=multi-user.target
EOFS

# Reload systemd and restart the server
systemctl daemon-reload
systemctl restart eno-server
sleep 5
systemctl status eno-server

# Check if the server is running
echo "Checking server health..."
curl -s http://localhost:3000/health

# Create symbolic links for easier management
echo "Creating symbolic links for convenient management..."
ln -sf server_sqlite_new.js js/current_server.js

echo "Server deployment complete!"
ENDSSH

echo "=== MySQL-Compatible SQLite Server Deployment Complete ==="
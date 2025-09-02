#!/bin/bash

# Remote server details
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"
REMOTE_DIR="/var/www/pelisivusto"

echo "=== Deploying SQLite Server to Remote Host ==="

# First, check if we have the SQLite server file
if [ ! -f js/server_sqlite.js ]; then
  echo "ERROR: SQLite server file not found at js/server_sqlite.js"
  exit 1
fi

# Copy the SQLite server file to the remote server
echo "Copying SQLite server to remote server..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no js/server_sqlite.js "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/js/"

# Connect to the remote server and set up the SQLite server
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << 'ENDSSH'
cd /var/www/pelisivusto

# Backup the current server.js in case we need to restore it
echo "Backing up current server.js..."
cp js/server.js js/server.js.mysql.bak

# Install SQLite module if needed
echo "Installing SQLite module..."
npm install sqlite3 --save

# Create data directory for SQLite
echo "Creating data directory..."
mkdir -p data

# Update the service file to use the SQLite server
echo "Updating service file to use SQLite server..."
systemctl stop eno-server

# Update the service unit file
cat > /etc/systemd/system/eno-server.service << 'EOFS'
[Unit]
Description=Eno Game Platform Server (SQLite)
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/pelisivusto
ExecStart=/usr/bin/node /var/www/pelisivusto/js/server_sqlite.js
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

# Create a symbolic link for easier switching between servers
echo "Creating symbolic link for convenient switching between servers..."
ln -sf server_sqlite.js js/current_server.js

echo "Server deployment complete!"
ENDSSH

echo "=== SQLite Server Deployment Complete ==="
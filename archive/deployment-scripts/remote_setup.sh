#!/bin/bash

# Script to deploy the full server to a remote host

# Remote server details
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"
REMOTE_DIR="/var/www/pelisivusto"

echo "=== Deploying full server to remote host ==="

# Pack the application files
echo "Packing application files..."
tar -czf eno-frontend.tar.gz --exclude='node_modules' --exclude='.git' .

# Copy the files to the remote server
echo "Copying files to remote server..."
sshpass -p "$REMOTE_PASS" scp -o StrictHostKeyChecking=no eno-frontend.tar.gz "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

# Connect to the remote server and set up the application
echo "Setting up application on remote server..."
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << 'ENDSSH'
cd /var/www/pelisivusto

# Extract the files
tar -xzf eno-frontend.tar.gz
rm eno-frontend.tar.gz

# Install dependencies
npm install

# Setup MySQL
apt-get update
apt-get install -y mysql-server

# Set root password and authentication method
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';"

# Initialize the database
chmod +x db_init.sh
./db_init.sh

# Create systemd service for the full server
echo "Creating systemd service for full server..."
cat > /etc/systemd/system/eno-server.service << 'EOFS'
[Unit]
Description=Eno Game Platform Server
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/pelisivusto
ExecStart=/usr/bin/node /var/www/pelisivusto/js/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=eno-server

[Install]
WantedBy=multi-user.target
EOFS

# Reload systemd, enable and start the service
systemctl daemon-reload
systemctl enable eno-server
systemctl restart eno-server
systemctl status eno-server

# Test the service
echo "Testing the service..."
curl -s http://localhost:3000/health
echo ""

echo "Setup complete!"
ENDSSH

# Clean up local files
rm eno-frontend.tar.gz

echo "=== Deployment complete ==="
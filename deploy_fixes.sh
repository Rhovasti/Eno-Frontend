#!/bin/bash

# Script to deploy our fixes to the production server
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"
REMOTE_DIR="/var/www/pelisivusto"

echo "=== Deploying user management, registration, and Python script fixes to production ==="

# Upload the modified files
echo "Uploading fixed package.json, admin.html, SQLite server, and Python scripts..."
sshpass -p "$REMOTE_PASS" sftp -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << SFTP_CMD
cd $REMOTE_DIR
put /root/Eno/Eno-Frontend/package.json
put /root/Eno/Eno-Frontend/fetch_beat_posts.py
put /root/Eno/Eno-Frontend/post_to_beat.py
chmod 755 fetch_beat_posts.py
chmod 755 post_to_beat.py
mkdir -p sql
cd sql
put /root/Eno/Eno-Frontend/sql/sqlite_schema.sql
cd ..
cd hml
put /root/Eno/Eno-Frontend/hml/admin.html
cd ..
cd js
put /root/Eno/Eno-Frontend/js/server_sqlite_new.js
SFTP_CMD

echo "Files uploaded successfully"

# Restart the server using the new SQLite server
echo "Configuring and restarting the server..."
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST << ENDSSH
cd $REMOTE_DIR

# Stop the current server
echo "Stopping Node.js processes..."
systemctl stop eno-server || killall -9 node || true

# Update npm packages if needed
echo "Updating npm packages..."
npm install sqlite3 --save

# Wait a moment
sleep 2

# Update the service file to use the new SQLite server
echo "Updating service file to use the new SQLite server..."
cat > /etc/systemd/system/eno-server.service << EOF
[Unit]
Description=Eno Game Platform Server (SQLite)
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
EOF

# Reload systemd and restart the server
systemctl daemon-reload
systemctl start eno-server

# Wait for server to start
sleep 5

# Check if server is running
echo "Checking server status..."
curl -s http://localhost:3000/health || echo "Server health check failed"

# Check the log for any errors
echo "Latest server logs:"
journalctl -u eno-server -n 20
ENDSSH

echo "=== Deployment complete ==="
echo "You can now check the production server at https://www.iinou.eu"
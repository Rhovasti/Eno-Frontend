#!/bin/bash

echo "Restarting production server..."

# First, ensure the Node.js server will restart on boot
sshpass -p "ininFvTPNTguUtuuLbx3" ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'EOF'
# Create systemd service if it doesn't exist
if [ ! -f /etc/systemd/system/eno-game.service ]; then
    cat > /etc/systemd/system/eno-game.service << 'SERVICE'
[Unit]
Description=Eno Game Platform
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/pelisivusto
ExecStart=/usr/bin/node /var/www/pelisivusto/js/server_sqlite_new.js
Restart=always
RestartSec=10
StandardOutput=append:/var/www/pelisivusto/server.log
StandardError=append:/var/www/pelisivusto/server.log

[Install]
WantedBy=multi-user.target
SERVICE

    systemctl daemon-reload
    systemctl enable eno-game.service
    echo "Systemd service created and enabled"
else
    echo "Systemd service already exists"
fi

# Stop the current Node.js process gracefully
pkill -SIGTERM -f "node.*server"
sleep 2

# Restart the system
echo "Initiating system restart..."
shutdown -r now
EOF

echo "Restart command sent. The server will be back online in a few minutes."
echo "You can check if it's back online with: curl -s https://www.iinou.eu/api/games"
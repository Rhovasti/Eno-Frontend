#\!/bin/bash

# Connect to the remote server and create a service for our Node.js server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'ENDSSH'
cd /var/www/pelisivusto

echo "=== Creating systemd service ==="
sudo tee /etc/systemd/system/eno-server.service > /dev/null << 'EOFS'
[Unit]
Description=Eno Game Platform Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/pelisivusto
ExecStart=/usr/bin/node /var/www/pelisivusto/js/simple_test_server.js
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=eno-server

[Install]
WantedBy=multi-user.target
EOFS

echo "=== Enabling and starting the service ==="
sudo systemctl daemon-reload
sudo systemctl enable eno-server
sudo systemctl start eno-server
sudo systemctl status eno-server

echo "=== Testing server via curl ==="
curl -s http://localhost:3000/health
echo

echo "=== Server service installed ==="
ENDSSH

echo "Service created and started"

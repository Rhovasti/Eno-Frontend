#!/bin/bash

echo "=== Creating systemd service ==="
sudo tee /etc/systemd/system/eno-server.service > /dev/null << 'EOFS'
[Unit]
Description=Eno Game Platform Server
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/Eno/Eno-Frontend
ExecStart=/usr/bin/node /root/Eno/Eno-Frontend/js/server.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
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
curl -s http://localhost:3000/health || echo "Health endpoint not available, testing login"
curl -s http://localhost:3000/api/auth-test

echo "=== Server service installed ==="
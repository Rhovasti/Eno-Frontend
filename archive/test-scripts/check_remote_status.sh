#!/bin/bash

# Remote server details
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"

echo "=== Checking Remote Server Status ==="

# Connect to the remote server and check status
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << 'ENDSSH'
echo "== MySQL Service Status =="
systemctl status mysql || systemctl status mariadb

echo "== MySQL Database Status =="
echo "List of databases:"
mysql -e "SHOW DATABASES;" 2>/dev/null
echo ""

echo "Foorumi database tables (if exists):"
if mysql -e "SHOW DATABASES" 2>/dev/null | grep -q Foorumi; then
  mysql -e "USE Foorumi; SHOW TABLES;" 2>/dev/null
else
  echo "Foorumi database does not exist."
fi
echo ""

echo "== Node.js Service Status =="
systemctl status eno-server

echo "== Server Health Check =="
curl -s http://localhost:3000/health
echo ""

echo "== Server Disk Space =="
df -h /var/www

echo "== Server Memory Usage =="
free -h

echo "== Server Process Status =="
ps aux | grep -E "node|mysql" | grep -v grep
ENDSSH

echo "=== Remote Status Check Complete ==="
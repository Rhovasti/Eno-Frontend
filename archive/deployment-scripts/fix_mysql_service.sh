#!/bin/bash

# Remote server details
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"

echo "=== Fixing MySQL Service on Remote Server ==="

# Connect to the remote server and fix MySQL service
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << 'ENDSSH'
# Stop any running MySQL processes
echo "Stopping any running MySQL processes..."
systemctl stop mysql || true
killall -9 mysqld mysqld_safe 2>/dev/null || true
pkill -9 mysql 2>/dev/null || true

# Check MySQL data directory
echo "Checking MySQL data directory..."
ls -la /var/lib/mysql/ || echo "MySQL data directory does not exist"

# Make sure the MySQL socket directory exists
echo "Ensuring MySQL socket directory exists..."
mkdir -p /var/run/mysqld
chown mysql:mysql /var/run/mysqld
chmod 755 /var/run/mysqld

# Check MySQL configuration
echo "Checking MySQL configuration..."
cat /etc/mysql/my.cnf

# Try to start MySQL with a shorter timeout
echo "Starting MySQL with increased timeout..."
systemctl set-property mysql.service TimeoutStartSec=600
systemctl daemon-reload
systemctl start mysql
sleep 5

# Check MySQL status
echo "Checking MySQL status..."
systemctl status mysql

# Test MySQL connection
echo "Testing MySQL connection..."
mysql -e "SELECT VERSION();"

# If MySQL is running, secure it
if [ $? -eq 0 ]; then
  echo "MySQL is running. Setting up secure configuration..."
  mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';"
  mysql -e "FLUSH PRIVILEGES;"
  echo "MySQL configured successfully!"
else
  echo "Failed to start MySQL."
fi
ENDSSH

echo "=== MySQL service fix attempted ==="
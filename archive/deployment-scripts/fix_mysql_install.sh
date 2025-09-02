#!/bin/bash

# Remote server details
REMOTE_HOST="95.217.21.111"
REMOTE_USER="root"
REMOTE_PASS="ininFvTPNTguUtuuLbx3"

echo "=== Reinstalling MySQL on Remote Server ==="

# Connect to the remote server and reinstall MySQL
sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_HOST" << 'ENDSSH'
echo "== Checking existing MySQL installation =="
dpkg -l | grep -i mysql

echo "== Stopping any running MySQL service =="
systemctl stop mysql 2>/dev/null
systemctl stop mariadb 2>/dev/null

echo "== Completely removing MySQL packages =="
apt-get remove --purge mysql* -y
apt-get autoremove -y
apt-get autoclean

echo "== Removing MySQL data directories =="
rm -rf /var/lib/mysql/
rm -rf /etc/mysql/
rm -rf /var/log/mysql/

echo "== Installing MySQL server =="
apt-get update
apt-get install -y mysql-server

echo "== Starting MySQL service =="
systemctl start mysql
systemctl status mysql

echo "== Securing MySQL installation =="
# Set root password to empty and allow remote root access
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '';"
mysql -e "FLUSH PRIVILEGES;"

echo "== Creating Foorumi database =="
mysql -e "CREATE DATABASE Foorumi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "== Importing schema from fail-safe file =="
if [ -f sql/mysql.txt ]; then
  mysql < sql/mysql.txt
  echo "Schema imported successfully."
else
  echo "WARNING: Schema file not found at sql/mysql.txt"
  ls -la sql/
fi

echo "== Verifying database setup =="
mysql -e "SHOW DATABASES;"
mysql -e "USE Foorumi; SHOW TABLES;"

echo "== Creating application user =="
mysql -e "CREATE USER IF NOT EXISTS 'eno_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password123';"
mysql -e "GRANT ALL PRIVILEGES ON Foorumi.* TO 'eno_user'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "== Testing application user connection =="
mysql -u eno_user -p'password123' -e "USE Foorumi; SELECT 'Connection test successful';"

echo "== Updating server.js to use new credentials =="
sed -i 's/user: ".*", \/\/ Using/user: "eno_user", \/\/ Using/g' /var/www/pelisivusto/js/server.js
sed -i 's/password: ".*", \/\/ /password: "password123", \/\/ /g' /var/www/pelisivusto/js/server.js

echo "== Restarting Node.js server =="
systemctl restart eno-server
sleep 3
systemctl status eno-server
ENDSSH

echo "=== MySQL reinstallation complete ==="
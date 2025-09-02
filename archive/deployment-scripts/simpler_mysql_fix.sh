#\!/bin/bash

# Connect to the remote server and fix MySQL authentication for Node.js
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Fixing MySQL authentication ==='
echo 'ALTER USER \"root\"@\"localhost\" IDENTIFIED WITH mysql_native_password BY \"\"; FLUSH PRIVILEGES;' | mysql -u root || echo 'Failed to update root user'

echo '=== Testing database connection ==='
mysql -u root -e 'SHOW DATABASES;' || echo 'Failed to connect with root'

echo '=== Checking for Foorumi database ==='
if mysql -u root -e 'SHOW DATABASES;' | grep -q Foorumi; then
  echo 'Foorumi database exists'
  mysql -u root -e 'USE Foorumi; SHOW TABLES;' || echo 'Failed to show tables'
else
  echo 'Creating Foorumi database'
  mysql -u root -e 'CREATE DATABASE Foorumi;' || echo 'Failed to create database'
  
  echo 'Importing schema'
  if [ -f sql/mysql_schema.txt ]; then
    mysql -u root Foorumi < sql/mysql_schema.txt && echo 'Schema imported successfully'
  else
    echo 'Schema file not found'
    ls -la sql/
  fi
fi
"

echo "MySQL authentication updated"

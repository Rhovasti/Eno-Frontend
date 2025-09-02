#\!/bin/bash

# Connect to the remote server and initialize the database with our schema
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Initialize Database ==='
echo 'Checking MySQL connection...'
mysql -u root -e 'SELECT 1;' || echo 'Failed to connect to MySQL'

echo 'Dropping existing database (if any)...'
mysql -u root -e 'DROP DATABASE IF EXISTS Foorumi;' || echo 'Failed to drop database'

echo 'Creating fresh database...'
mysql -u root -e 'CREATE DATABASE Foorumi;' || echo 'Failed to create database'

echo 'Importing schema from SQL file...'
mysql -u root Foorumi < sql/mysql_schema.sql && echo 'Schema imported successfully' || echo 'Failed to import schema'

echo 'Verifying database tables...'
mysql -u root -e 'USE Foorumi; SHOW TABLES;' || echo 'Failed to show tables'

echo 'Testing a query...'
mysql -u root -e 'USE Foorumi; SELECT id, username, email, roles, is_admin FROM users;' || echo 'Failed to query users'
"

echo "Database initialized"

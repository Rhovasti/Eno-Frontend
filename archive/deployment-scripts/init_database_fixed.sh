#\!/bin/bash

# Connect to the remote server and initialize the database with our fixed schema
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Initialize Database with Fixed Schema ==='
echo 'Dropping existing database (if any)...'
mysql -u root -e 'DROP DATABASE IF EXISTS Foorumi;' || echo 'Failed to drop database'

echo 'Creating fresh database...'
mysql -u root -e 'CREATE DATABASE Foorumi;' || echo 'Failed to create database'

echo 'Importing fixed schema...'
mysql -u root Foorumi < sql/mysql_schema_fixed.sql && echo 'Schema imported successfully' || echo 'Failed to import schema'

echo 'Verifying database tables...'
mysql -u root -e 'USE Foorumi; SHOW TABLES;' || echo 'Failed to show tables'

echo 'Checking users table...'
mysql -u root -e 'USE Foorumi; SELECT id, username, email, roles, is_admin FROM users;' || echo 'Failed to query users'
"

echo "Database reinitialized with fixed schema"

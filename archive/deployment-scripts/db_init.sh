#!/bin/bash

# Initialize the MySQL database for Eno-Frontend

echo "=== Setting up MySQL database for Eno-Frontend ==="

# Create database and user
echo "Creating database and user..."
mysql -u root -ppassword << EOF
CREATE DATABASE IF NOT EXISTS Foorumi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'eno'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password';
GRANT ALL PRIVILEGES ON Foorumi.* TO 'eno'@'localhost';
FLUSH PRIVILEGES;
EOF

# Import schema (excluding CREATE DATABASE and USE statements)
echo "Importing database schema..."
grep -v "CREATE DATABASE" /root/Eno/Eno-Frontend/sql/mysql_schema.txt | grep -v "USE Foorumi" > /tmp/schema.sql
sed -i 's/roles JSON DEFAULT .*/roles JSON,/' /tmp/schema.sql
mysql -u eno -ppassword Foorumi < /tmp/schema.sql || echo "Error importing schema, might already exist"

# Create users with proper password hashing
echo "Creating users with proper password hashing..."
cd /root/Eno/Eno-Frontend && node js/create_admin.js

echo "=== Setup complete ==="
echo "Test the installation with: node -e \"require('./js/server.js')\""
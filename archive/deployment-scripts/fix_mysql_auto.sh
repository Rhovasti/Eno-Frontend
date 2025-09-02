#!/bin/bash

# This is a non-interactive version of the MySQL fix script
# It assumes you have passwordless sudo access or are running as root

echo "=== Automated MySQL Schema Recovery Script ==="
echo "Using fail-safe schema from sql/mysql.txt"

# Check if script is run with sudo
if [ "$EUID" -ne 0 ]; then
  echo "Please run this script with sudo or as root"
  exit 1
fi

# Check if MySQL service is running
echo "Checking MySQL service..."
systemctl status mysql || systemctl status mariadb

# Try to restart MySQL if it's not running
if [ $? -ne 0 ]; then
  echo "Attempting to restart MySQL..."
  systemctl restart mysql || systemctl restart mariadb
  if [ $? -ne 0 ]; then
    echo "Failed to restart MySQL. Exiting."
    exit 1
  fi
fi

# Back up current database (if it exists)
echo "Backing up current database (if exists)..."
if mysql -e "SHOW DATABASES" 2>/dev/null | grep -q Foorumi; then
  mysqldump Foorumi > Foorumi_backup_$(date +%Y%m%d%H%M%S).sql
  echo "Backup created."
fi

# Reset MySQL root password (be careful with this in production!)
echo "Resetting MySQL root password..."
mysqladmin -u root password 'temp_password' 2>/dev/null || mysqladmin -u root -p'temp_password' password 'temp_password' 2>/dev/null

# Drop the database if it exists
echo "Dropping existing database..."
mysql -u root -p'temp_password' -e "DROP DATABASE IF EXISTS Foorumi;" 2>/dev/null

# Import the fail-safe schema
echo "Importing fail-safe schema from sql/mysql.txt..."
mysql -u root -p'temp_password' < sql/mysql.txt 2>/dev/null

# Create test users
echo "Creating test users..."
mysql -u root -p'temp_password' -e "USE Foorumi; 
INSERT INTO users (username, role) VALUES ('admin', 'op'), ('gm', 'gm'), ('player', 'player');" 2>/dev/null

# Create a test game structure
echo "Creating test game structure..."
mysql -u root -p'temp_password' -e "USE Foorumi;
INSERT INTO games (name, description) VALUES ('Test Game', 'A test game created during MySQL recovery');
INSERT INTO chapters (game_id, sequence_number, title, description) VALUES (1, 1, 'Chapter 1', 'First chapter');
INSERT INTO beats (chapter_id, sequence_number) VALUES (1, 1);
INSERT INTO posts (beat_id, author_id, title, content, post_type) VALUES (1, 1, 'Welcome', 'Welcome to the recovered game!', 'gm');" 2>/dev/null

# Verify tables were created
echo "Verifying database setup..."
mysql -u root -p'temp_password' -e "USE Foorumi; SHOW TABLES;" 2>/dev/null

# Create application user
echo "Creating application user..."
mysql -u root -p'temp_password' -e "CREATE USER IF NOT EXISTS 'eno_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password123';" 2>/dev/null
mysql -u root -p'temp_password' -e "GRANT ALL PRIVILEGES ON Foorumi.* TO 'eno_user'@'localhost';" 2>/dev/null
mysql -u root -p'temp_password' -e "FLUSH PRIVILEGES;" 2>/dev/null

# Test application user
echo "Testing application user connection..."
mysql -u eno_user -p'password123' -e "USE Foorumi; SELECT COUNT(*) FROM users;" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "Application user connection successful."
else
  echo "WARNING: Application user connection failed."
fi

echo "MySQL database recovery complete!"
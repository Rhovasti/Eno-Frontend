#!/bin/bash

echo "=== MySQL Schema Recovery Script ==="
echo "Using fail-safe schema from sql/mysql.txt"

# Check if MySQL service is running
echo "Checking MySQL service..."
systemctl status mysql || systemctl status mariadb

# Prompt for MySQL root password
echo -n "Enter MySQL root password: "
read -s MYSQL_PWD
export MYSQL_PWD
echo

# Test connection
echo "Testing MySQL connection..."
if ! mysql -u root -e "SELECT 'Connection successful'"; then
  echo "Failed to connect to MySQL. Please check your password and try again."
  exit 1
fi

# Back up current database (if it exists)
echo "Backing up current database (if exists)..."
if mysql -u root -e "SHOW DATABASES" | grep -q Foorumi; then
  mysqldump -u root Foorumi > Foorumi_backup_$(date +%Y%m%d%H%M%S).sql
  echo "Backup created."
fi

# Drop the database if it exists and recreate it
echo "Dropping existing database..."
mysql -u root -e "DROP DATABASE IF EXISTS Foorumi;"

# Import the fail-safe schema
echo "Importing fail-safe schema from sql/mysql.txt..."
mysql -u root < sql/mysql.txt

# Create test users
echo "Creating test users..."
mysql -u root -e "USE Foorumi; 
INSERT INTO users (username, role) VALUES ('admin', 'op'), ('gm', 'gm'), ('player', 'player');"

# Create a test game structure
echo "Creating test game structure..."
mysql -u root -e "USE Foorumi;
INSERT INTO games (name, description) VALUES ('Test Game', 'A test game created during MySQL recovery');
INSERT INTO chapters (game_id, sequence_number, title, description) VALUES (1, 1, 'Chapter 1', 'First chapter');
INSERT INTO beats (chapter_id, sequence_number) VALUES (1, 1);
INSERT INTO posts (beat_id, author_id, title, content, post_type) VALUES (1, 1, 'Welcome', 'Welcome to the recovered game!', 'gm');"

# Verify tables were created
echo "Verifying database setup..."
mysql -u root -e "USE Foorumi; SHOW TABLES;"

# Update authentication method to be compatible with Node.js
echo "Updating MySQL authentication for Node.js compatibility..."
mysql -u root -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY ''; FLUSH PRIVILEGES;"

# Create a dedicated user for the application
echo "Creating application user..."
mysql -u root -e "CREATE USER IF NOT EXISTS 'eno_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'password123';"
mysql -u root -e "GRANT ALL PRIVILEGES ON Foorumi.* TO 'eno_user'@'localhost';"
mysql -u root -e "FLUSH PRIVILEGES;"

echo "MySQL database recovery complete!"
#!/bin/bash

echo "=== Fixing AI Authentication Issues ==="

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'ENDSSH'

cd /var/www/pelisivusto

echo "=== Checking database schema ==="
sqlite3 data/database.sqlite "PRAGMA table_info(users);"

echo -e "\n=== Adding missing columns if needed ==="
sqlite3 data/database.sqlite << 'SQL'
-- Add is_gm column if it doesn't exist
ALTER TABLE users ADD COLUMN is_gm BOOLEAN DEFAULT 0;

-- Add is_admin column if it doesn't exist  
ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0;

-- Check the schema again
.schema users
SQL

echo -e "\n=== Setting GM privileges for test users ==="
sqlite3 data/database.sqlite << 'SQL'
-- Set admin privileges for user 'admin'
UPDATE users SET is_admin = 1 WHERE username = 'admin';

-- Set GM privileges for users who have created games
UPDATE users SET is_gm = 1 WHERE id IN (SELECT DISTINCT created_by FROM games);

-- Show users with privileges
SELECT id, username, is_gm, is_admin FROM users WHERE is_gm = 1 OR is_admin = 1;
SQL

echo -e "\n=== Checking user roles ==="
sqlite3 data/database.sqlite "SELECT COUNT(*) as gm_count FROM users WHERE is_gm = 1;"
sqlite3 data/database.sqlite "SELECT COUNT(*) as admin_count FROM users WHERE is_admin = 1;"

echo -e "\n=== Restarting server to apply changes ==="
systemctl restart pelisivusto

sleep 3
systemctl status pelisivusto --no-pager | head -10

echo -e "\n=== Testing AI endpoint ==="
# Get a test token first (you'll need to login to get a real token)
echo "To test AI features:"
echo "1. Login at https://www.iinou.eu/hml/login.html"
echo "2. Use a GM or admin account"
echo "3. Try creating a game with AI features"

ENDSSH

echo -e "\n=== Fix completed ==="
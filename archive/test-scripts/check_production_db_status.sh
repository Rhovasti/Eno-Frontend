#!/bin/bash

echo "Checking database and server status on production..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
echo '=== Checking MySQL Service Status ==='
systemctl status mysql || echo 'MySQL service not found'
echo

echo '=== Checking for SQLite database ==='
ls -la /var/www/pelisivusto/data/ | grep -i sqlite || echo 'No SQLite database found'
echo

echo '=== Checking running Node processes ==='
ps aux | grep node | grep -v grep
echo

echo '=== Checking server configuration ==='
cd /var/www/pelisivusto
grep -n 'database.*=' js/server.js | head -5 || echo 'No database config in server.js'
grep -n 'sqlite' js/server*.js | head -3 || echo 'No sqlite references found'
echo

echo '=== Checking domain configuration ==='
grep -r 'pelisivusto.eu\\|iinou.eu' /var/www/pelisivusto/ 2>/dev/null | head -5 || echo 'No domain references found'
echo

echo '=== Checking which server file is actually being used ==='
lsof -i :3000 | grep node || echo 'No node process on port 3000'
echo

echo '=== Checking Apache/Nginx configuration ==='
if [ -d /etc/apache2 ]; then
    grep -r 'iinou.eu' /etc/apache2/sites-enabled/ 2>/dev/null | head -3
    echo 'Apache site configuration found'
elif [ -d /etc/nginx ]; then
    grep -r 'iinou.eu' /etc/nginx/sites-enabled/ 2>/dev/null | head -3
    echo 'Nginx site configuration found'
fi
echo

echo '=== Testing direct database access ==='
cd /var/www/pelisivusto

# Check if SQLite is being used
if [ -f data/database.sqlite ]; then
    echo 'SQLite database exists, checking users table...'
    sqlite3 data/database.sqlite 'SELECT id, username, email, is_admin FROM users;' || echo 'SQLite query failed'
else
    echo 'No SQLite database found'
fi

# Check MySQL
echo
echo '=== Testing MySQL connection ==='
mysql -e 'SELECT VERSION();' 2>&1 || echo 'MySQL connection failed'
mysql Foorumi -e 'SELECT id, username, email, is_admin FROM users LIMIT 5;' 2>&1 || echo 'MySQL Foorumi query failed'
"
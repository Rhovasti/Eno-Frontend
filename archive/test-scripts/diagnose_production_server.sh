#!/bin/bash

echo "Diagnosing production server configuration..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

# Check which server is actually running
echo '=== Running server process ==='
ps aux | grep node | grep -v grep
echo

# Check database configuration in the running server
echo '=== Database configuration in server.js ==='
grep -A5 -B5 'createConnection\\|Database' js/server.js | head -20
echo

# Restart the server with SQLite configuration
echo '=== Stopping current server ==='
pkill -f 'node.*server.js'
sleep 2

echo '=== Starting SQLite server ==='
nohup node js/server_sqlite.js > server.log 2>&1 &
echo 'Server started with PID: '\$!
sleep 3

echo '=== Checking new server status ==='
ps aux | grep node | grep -v grep
echo

echo '=== Testing login again ==='
node test_admin_login.js
echo

echo '=== Checking server logs ==='
tail -10 server.log
"
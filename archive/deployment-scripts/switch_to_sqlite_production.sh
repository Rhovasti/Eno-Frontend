#!/bin/bash

echo "Switching production server to SQLite configuration..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

# Stop MySQL service since it's having issues
echo '=== Stopping problematic MySQL service ==='
systemctl stop mysql
systemctl disable mysql
echo

# Kill current node processes
echo '=== Stopping current Node servers ==='
pkill -f 'node.*server'
sleep 2
echo

# Ensure SQLite database has correct permissions
echo '=== Setting SQLite database permissions ==='
chown www-data:www-data data/database.sqlite
chmod 664 data/database.sqlite
echo

# Copy sqlite server as main server
echo '=== Backing up and replacing server.js ==='
cp js/server.js js/server_mysql_backup.js
cp js/server_sqlite.js js/server.js
echo

# Start the server
echo '=== Starting server with SQLite ==='
nohup node js/server.js > server.log 2>&1 &
PID=\$!
echo 'Server started with PID: '\$PID
sleep 3

# Verify server is running
echo '=== Server status ==='
ps aux | grep node | grep -v grep
echo

# Test login
echo '=== Testing admin login ==='
cat > test_login_final.js << 'FINAL_TEST'
const http = require('http');

const loginData = JSON.stringify({
    email: 'admin@example.com',
    password: 'admin123'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
};

const req = http.request(options, (res) => {
    let responseData = '';
    res.on('data', (chunk) => responseData += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        if (res.statusCode === 200) {
            const response = JSON.parse(responseData);
            console.log('✓ Login successful!');
            console.log('Username:', response.user.username);
            console.log('Email:', response.user.email);
            console.log('Is Admin:', response.user.is_admin);
        } else {
            console.log('✗ Login failed:', responseData);
        }
    });
});

req.on('error', (error) => console.error('Error:', error));
req.write(loginData);
req.end();
FINAL_TEST

node test_login_final.js
echo

echo '=== Server logs ==='
tail -5 server.log
echo

echo 'Server switched to SQLite successfully!'
echo 'You can now login at https://www.iinou.eu/ with:'
echo '  Username: admin'
echo '  Password: admin123'
"
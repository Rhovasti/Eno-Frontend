#!/bin/bash

echo "Testing login on production server (iinou.eu)..."

# Create a test script on the production server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

# Create a test login script
cat > test_admin_login.js << 'TEST_SCRIPT'
const http = require('http');

// Test admin login credentials
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

console.log('Testing admin login on localhost:3000...');

const req = http.request(options, (res) => {
    let responseData = '';

    res.on('data', (chunk) => {
        responseData += chunk;
    });

    res.on('end', () => {
        console.log('Response status:', res.statusCode);
        console.log('Response data:', responseData);
        
        if (res.statusCode === 200) {
            const response = JSON.parse(responseData);
            console.log('Login successful!');
            console.log('User:', response.user);
            console.log('Token received:', response.token ? 'Yes' : 'No');
        } else {
            console.log('Login failed');
        }
    });
});

req.on('error', (error) => {
    console.error('Error:', error);
});

req.write(loginData);
req.end();
TEST_SCRIPT

# Run the test
echo '=== Testing direct login to server ==='
node test_admin_login.js
echo

# Check if bcrypt is installed
echo '=== Checking bcrypt installation ==='
npm list bcrypt
echo

# Check password directly in database
echo '=== Checking password hash in database ==='
sqlite3 data/database.sqlite \"SELECT username, password, is_admin FROM users WHERE username='admin';\"
echo

# Check server logs
echo '=== Recent server logs ==='
tail -20 server.log | grep -E 'login|auth|error' || echo 'No relevant logs found'
"

echo
echo "To test from your browser, go to: https://www.iinou.eu/"
echo "Login with: admin / admin123"
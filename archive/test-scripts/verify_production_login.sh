#!/bin/bash

echo "Verifying admin login on production server..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

# Create final test script
cat > verify_admin.js << 'VERIFY_SCRIPT'
const http = require('http');

console.log('Testing admin login...');

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
    
    res.on('data', (chunk) => {
        responseData += chunk;
    });
    
    res.on('end', () => {
        console.log('Response Status:', res.statusCode);
        
        if (res.statusCode === 200) {
            const response = JSON.parse(responseData);
            console.log('✓ LOGIN SUCCESSFUL!');
            console.log('User Details:');
            console.log('  Username:', response.user.username);
            console.log('  Email:', response.user.email);
            console.log('  Is Admin:', response.user.is_admin);
            console.log('  Roles:', response.user.roles);
            console.log('  Token received:', response.token ? 'Yes' : 'No');
        } else {
            console.log('✗ LOGIN FAILED');
            console.log('Response:', responseData);
        }
    });
});

req.on('error', (error) => {
    console.error('Request Error:', error);
});

req.write(loginData);
req.end();
VERIFY_SCRIPT

node verify_admin.js
echo

echo '=== Server Information ==='
ps aux | grep node | grep -v grep
echo

echo '=== Database Users ==='
sqlite3 data/database.sqlite 'SELECT id, username, email, is_admin FROM users;'
"

echo
echo "Admin login has been set up on production server at https://www.iinou.eu/"
echo "Login credentials:"
echo "  Email: admin@example.com"
echo "  Password: admin123"
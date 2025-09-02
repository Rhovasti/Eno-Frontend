const http = require('http');

// Test admin login
const adminCredentials = {
  email: 'admin@example.com',
  password: 'admin123'
};

const data = JSON.stringify(adminCredentials);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

console.log('Testing admin login...');

const req = http.request(options, (res) => {
  let responseData = '';

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    console.log('Response status:', res.statusCode);
    try {
      const jsonResponse = JSON.parse(responseData);
      if (res.statusCode === 200) {
        console.log('✓ Login successful!');
        console.log('Username:', jsonResponse.user.username);
        console.log('Email:', jsonResponse.user.email);
        console.log('Roles:', jsonResponse.user.roles);
        console.log('Is Admin:', jsonResponse.user.is_admin ? 'Yes' : 'No');
        console.log('Auth Token:', jsonResponse.token ? 'Received' : 'Not received');
      } else {
        console.log('✗ Login failed:', jsonResponse.error || 'Unknown error');
      }
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.log('Raw response:', responseData);
    }
  });
});

req.on('error', (error) => {
  console.error('Error sending request:', error);
  console.log('Make sure the server is running on port 3000');
});

req.write(data);
req.end();
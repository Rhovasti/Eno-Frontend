// Test user login
const http = require('http');

const loginCredentials = {
  email: 'test@example.com',
  password: 'testpassword123'
};

// JSON data to send in the request
const data = JSON.stringify(loginCredentials);

// Options for the HTTP request
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

// Make the request
const req = http.request(options, (res) => {
  let responseData = '';

  // A chunk of data has been received
  res.on('data', (chunk) => {
    responseData += chunk;
  });

  // The whole response has been received
  res.on('end', () => {
    console.log('Response status:', res.statusCode);
    try {
      const jsonResponse = JSON.parse(responseData);
      console.log('Login successful!');
      console.log('Username:', jsonResponse.user.username);
      console.log('Email:', jsonResponse.user.email);
      console.log('Roles:', jsonResponse.user.roles);
      console.log('Is Admin:', jsonResponse.user.is_admin ? 'Yes' : 'No');
      console.log('Auth Token received:', jsonResponse.token ? 'Yes' : 'No');
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.log('Raw response:', responseData);
    }
  });
});

// Handle errors
req.on('error', (error) => {
  console.error('Error sending request:', error);
});

// Write data to the request body
req.write(data);

// End the request
req.end();

console.log('Sending login request for user:', loginCredentials.email);
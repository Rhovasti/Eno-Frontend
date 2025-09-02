// Test user registration
const http = require('http');

const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'testpassword123',
  confirmPassword: 'testpassword123'
};

// JSON data to send in the request
const data = JSON.stringify(testUser);

// Options for the HTTP request
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/register',
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
      console.log('Response data:', JSON.stringify(jsonResponse, null, 2));
      
      if (res.statusCode === 201) {
        console.log('User registration successful!');
      } else {
        console.log('User registration failed.');
      }
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

console.log('Sending registration request for user:', testUser.username);
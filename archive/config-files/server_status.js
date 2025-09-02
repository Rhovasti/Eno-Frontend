// Simple server status checker
const http = require('http');

// Options for the HTTP request
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/health',
  method: 'GET'
};

// Make the request
const req = http.request(options, (res) => {
  let data = '';

  // A chunk of data has been received
  res.on('data', (chunk) => {
    data += chunk;
  });

  // The whole response has been received
  res.on('end', () => {
    try {
      const jsonData = JSON.parse(data);
      console.log('Server status:');
      console.log('----------------------------');
      console.log(`Status: ${jsonData.status}`);
      console.log(`Message: ${jsonData.message}`);
      console.log(`Database: ${jsonData.database}`);
      console.log(`Version: ${jsonData.version || 'N/A'}`);
      console.log('----------------------------');
      console.log('Server is running and responding to requests!');
    } catch (e) {
      console.error('Error parsing server response:', e.message);
      console.log('Raw response:', data);
    }
  });
});

// Handle errors
req.on('error', (error) => {
  console.error('Error checking server status:');
  console.error(`${error.message}`);
  console.log('----------------------------');
  console.log('The server is not running or is not responding to requests.');
  console.log('Start the server with: node js/server_sqlite.js');
});

// End the request
req.end();
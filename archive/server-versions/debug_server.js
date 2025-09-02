// Add this at the top of the server.js file
const express = require('express');
const app = express();
const port = 3000;

// Simple middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Basic routes for testing
app.get('/', (req, res) => {
  res.send('Server is running');
});

app.get('/api/posts', (req, res) => {
  res.json([{ id: 1, title: 'Test Post', content: 'This is a test post' }]);
});

app.post('/api/posts', (req, res) => {
  res.status(201).json({ message: 'Post created successfully', id: 999 });
});

// Start the server
app.listen(port, () => {
  console.log(`Debug server listening on port ${port}`);
});

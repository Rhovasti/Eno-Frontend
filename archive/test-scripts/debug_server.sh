#\!/bin/bash

# Create a debug version of server.js and deploy it
cat > /tmp/debug_server.js << 'DEBUG_SERVER'
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
DEBUG_SERVER

# Upload the debug server
sshpass -p 'ininFvTPNTguUtuuLbx3' sftp -o StrictHostKeyChecking=no root@95.217.21.111 <<SFTP_CMD
cd /var/www/pelisivusto/js
put /tmp/debug_server.js debug_server.js
SFTP_CMD

echo "Debug server.js uploaded"

# Restart with the debug server
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto
pkill -f 'node js/server.js' || true
echo 'Starting debug server...'
nohup node js/debug_server.js > debug_server.log 2>&1 &
echo 'Debug server started with PID: '\$\!
sleep 2
echo 'Testing GET /api/posts...'
curl -s http://localhost:3000/api/posts
echo
"

echo "Debug server started and tested"

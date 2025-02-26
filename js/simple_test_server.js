// Simple test server without database dependencies
const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(__dirname + '/../'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Debug posts endpoint
app.get('/api/debug/posts', (req, res) => {
    console.log('Debug endpoint accessed');
    res.json([
        { id: 999, title: 'Debug Post', content: 'This is a debug post', post_type: 'player', username: 'debug_user' }
    ]);
});

// Mock login endpoint
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    console.log('Login attempt:', email, password);
    
    if (email === 'admin@example.com' && password === 'admin123') {
        res.json({
            message: 'Login successful',
            user: {
                id: 1, 
                username: 'admin',
                email: 'admin@example.com',
                roles: '["player","gm"]',
                is_admin: 1
            },
            token: 'mock-token-for-testing'
        });
    } else {
        res.status(401).json({ error: 'Invalid email or password' });
    }
});

// Mock posts endpoint
app.get('/api/posts', (req, res) => {
    res.json([
        { id: 1, title: 'First Post', content: 'This is the first post', post_type: 'gm', username: 'admin' },
        { id: 2, title: 'Second Post', content: 'This is the second post', post_type: 'player', username: 'player' }
    ]);
});

// Start the server
app.listen(port, () => {
    console.log(`Simple test server listening on port ${port}`);
});

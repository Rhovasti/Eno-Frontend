#\!/bin/bash

# Connect to the remote server and add debug endpoints to the SQLite server file
sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

# Create a backup first
cp js/server_sqlite.js js/server_sqlite.js.bak

# Find the best place to insert our endpoints (before the 'Start the server' line)
LINE_NUMBER=\$(grep -n 'app.listen(' js/server_sqlite.js | cut -d: -f1)
if [ -z \"\$LINE_NUMBER\" ]; then
    echo 'Could not find app.listen line'
    exit 1
fi

# Insert our new endpoints before the app.listen line
sed -i \"\${LINE_NUMBER}i\\
// Unauthenticated debug endpoint for testing\\
app.get('/api/debug/posts', (req, res) => {\\
    console.log('Debug endpoint accessed');\\
    res.json([\\
        { id: 999, title: 'Debug Post', content: 'This is a debug post', post_type: 'player', username: 'debug_user' }\\
    ]);\\
});\\
\\
// Get all posts (mainly for debugging/admin purposes)\\
app.get('/api/posts', authenticateToken, (req, res) => {\\
    console.log('GET /api/posts endpoint accessed by user:', req.user ? req.user.username : 'unknown');\\
    \\
    db.all('SELECT p.*, u.username FROM posts p LEFT JOIN users u ON p.author_id = u.id ORDER BY p.created_at DESC LIMIT 50', (err, rows) => {\\
        if (err) {\\
            console.error('Error fetching posts:', err);\\
            return res.status(500).json({ error: 'Database error' });\\
        }\\
        res.json(rows);\\
    });\\
});\\
\" js/server_sqlite.js

echo 'Debug endpoints added to server_sqlite.js'
"

echo "SQLite server file updated with debug endpoints"

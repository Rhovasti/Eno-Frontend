const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');

const app = express();
const port = 3001;

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../data');
if (\!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Create database file
const dbFile = path.join(dataDir, 'test.db');
const db = new sqlite3.Database(dbFile);

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../')));

// JWT Secret
const JWT_SECRET = 'test-secret-key';

// Initialize database
db.serialize(() => {
    // Create tables if they don't exist
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        roles TEXT DEFAULT '["player"]',
        is_admin INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS chapters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER NOT NULL,
        sequence_number INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS beats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chapter_id INTEGER NOT NULL,
        sequence_number INTEGER NOT NULL,
        title TEXT,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        beat_id INTEGER NOT NULL,
        author_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        post_type TEXT DEFAULT 'player',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Check if admin user exists, if not create one
    db.get("SELECT * FROM users WHERE email = 'admin@example.com'", (err, row) => {
        if (err) {
            console.error("Error checking for admin user:", err);
            return;
        }

        if (\!row) {
            bcrypt.hash('admin123', 10, (err, hash) => {
                if (err) {
                    console.error("Error hashing password:", err);
                    return;
                }

                db.run(
                    "INSERT INTO users (username, email, password, roles, is_admin) VALUES (?, ?, ?, ?, ?)",
                    ["admin", "admin@example.com", hash, JSON.stringify(["admin", "gm", "player"]), 1],
                    (err) => {
                        if (err) {
                            console.error("Error creating admin user:", err);
                            return;
                        }
                        console.log("Admin user created successfully");
                    }
                );
            });
        }
    });

    // Create test game and chapter if they don't exist
    db.get("SELECT * FROM games WHERE name = 'Test Game'", (err, row) => {
        if (err) {
            console.error("Error checking for test game:", err);
            return;
        }

        if (\!row) {
            db.run(
                "INSERT INTO games (name, description) VALUES (?, ?)",
                ["Test Game", "This is a test game"],
                function (err) {
                    if (err) {
                        console.error("Error creating test game:", err);
                        return;
                    }
                    
                    const gameId = this.lastID;
                    console.log("Test game created with ID:", gameId);

                    // Create a chapter
                    db.run(
                        "INSERT INTO chapters (game_id, sequence_number, title, description) VALUES (?, ?, ?, ?)",
                        [gameId, 1, "Chapter 1", "First chapter"],
                        function (err) {
                            if (err) {
                                console.error("Error creating test chapter:", err);
                                return;
                            }
                            
                            const chapterId = this.lastID;
                            console.log("Test chapter created with ID:", chapterId);

                            // Create a beat
                            db.run(
                                "INSERT INTO beats (chapter_id, sequence_number, title, content) VALUES (?, ?, ?, ?)",
                                [chapterId, 1, "Beat 1", "First beat content"],
                                function (err) {
                                    if (err) {
                                        console.error("Error creating test beat:", err);
                                        return;
                                    }
                                    console.log("Test beat created with ID:", this.lastID);
                                }
                            );
                        }
                    );
                }
            );
        }
    });
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (\!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }
};

// Role-based authorization middleware
const authorize = (roles) => {
    return (req, res, next) => {
        if (\!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Admin can access everything
        if (req.user.is_admin) {
            return next();
        }

        // Check if user has any of the required roles
        let userRoles = [];
        try {
            userRoles = JSON.parse(req.user.roles);
        } catch (e) {
            userRoles = [];
        }

        const hasRole = roles.some(role => userRoles.includes(role));
        
        if (\!hasRole) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

// Routes
app.get('/sqlite-api', (req, res) => {
    res.json({ message: 'SQLite API is running' });
});

// Login
app.post('/sqlite-api/login', (req, res) => {
    const { email, password } = req.body;

    if (\!email || \!password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error("Login error:", err);
            return res.status(500).json({ error: 'Login failed' });
        }

        if (\!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        try {
            const match = await bcrypt.compare(password, user.password);
            if (\!match) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            const token = jwt.sign({
                id: user.id,
                username: user.username,
                email: user.email,
                roles: user.roles,
                is_admin: user.is_admin
            }, JWT_SECRET, { expiresIn: '24h' });

            res.cookie('token', token, {
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000
            });

            const userInfo = { ...user };
            delete userInfo.password;

            res.json({
                message: 'Login successful',
                user: userInfo,
                token: token
            });
        } catch (error) {
            console.error("Bcrypt error:", error);
            res.status(500).json({ error: 'Login failed' });
        }
    });
});

// Get chapters
app.get('/sqlite-api/chapters/:gameId', authenticateToken, (req, res) => {
    const gameId = req.params.gameId;
    
    db.all('SELECT * FROM chapters WHERE game_id = ? ORDER BY sequence_number ASC', [gameId], (err, chapters) => {
        if (err) {
            console.error("Error fetching chapters:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(chapters);
    });
});

// Get beats
app.get('/sqlite-api/beats/:chapterId', authenticateToken, (req, res) => {
    const chapterId = req.params.chapterId;
    
    db.all('SELECT * FROM beats WHERE chapter_id = ? ORDER BY sequence_number ASC', [chapterId], (err, beats) => {
        if (err) {
            console.error("Error fetching beats:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(beats);
    });
});

// Create post
app.post('/sqlite-api/posts', authenticateToken, authorize(['player', 'gm']), (req, res) => {
    const { beatId, title, content, postType } = req.body;
    const authorId = req.user.id;
    
    // Input validation
    if (\!beatId) {
        console.error('Missing beatId in request body:', req.body);
        return res.status(400).json({ error: 'Beat ID is required' });
    }
    
    if (\!title || \!content) {
        console.error('Missing title or content in request body:', req.body);
        return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // First, verify that the beat exists
    db.get('SELECT id FROM beats WHERE id = ?', [beatId], (err, beat) => {
        if (err) {
            console.error('Error checking beat existence:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (\!beat) {
            console.error('Attempted to create post for nonexistent beat:', beatId);
            return res.status(404).json({ error: 'Beat not found' });
        }
        
        // Create the post
        db.run(
            'INSERT INTO posts (beat_id, author_id, title, content, post_type) VALUES (?, ?, ?, ?, ?)',
            [beatId, authorId, title, content, postType || 'player'],
            function(err) {
                if (err) {
                    console.error('Error creating post:', err);
                    return res.status(500).json({ error: 'Error creating post' });
                }
                
                console.log('Post created successfully - ID:', this.lastID);
                res.status(201).json({ 
                    message: 'Post created successfully', 
                    id: this.lastID,
                    beatId: beatId
                });
            }
        );
    });
});

// Get posts
app.get('/sqlite-api/posts/:beatId', authenticateToken, (req, res) => {
    const beatId = req.params.beatId;
    
    db.all(
        `SELECT p.*, u.username
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.beat_id = ?
        ORDER BY p.created_at ASC`,
        [beatId],
        (err, posts) => {
            if (err) {
                console.error('Error fetching posts:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json(posts);
        }
    );
});

// Create a simple HTML file to test SQLite version
fs.writeFileSync(path.join(__dirname, '../sqlite_test.html'), `
<\!DOCTYPE html>
<html>
<head>
    <title>SQLite Test</title>
    <style>
        body { font-family: Arial; margin: 20px; }
        .step { margin-bottom: 20px; padding: 10px; border: 1px solid #ccc; }
        button { padding: 5px 10px; }
        input { margin-bottom: 5px; }
        pre { background: #f0f0f0; padding: 10px; }
    </style>
</head>
<body>
    <h1>SQLite Post Creation Test</h1>
    
    <div class="step">
        <h2>1. Login</h2>
        <input type="text" id="email" value="admin@example.com">
        <input type="password" id="password" value="admin123">
        <button id="loginBtn">Login</button>
        <pre id="loginOutput"></pre>
    </div>
    
    <div class="step">
        <h2>2. Create Post</h2>
        <p>Beat ID: (usually 1)</p>
        <input type="number" id="beatId" value="1">
        <p>Title:</p>
        <input type="text" id="title" value="Test Post">
        <p>Content:</p>
        <textarea id="content">This is a test post</textarea>
        <p>Post Type:</p>
        <select id="postType">
            <option value="player">Player</option>
            <option value="gm">GM</option>
        </select>
        <br><br>
        <button id="createPostBtn">Create Post</button>
        <pre id="postOutput"></pre>
    </div>
    
    <div class="step">
        <h2>3. View Posts</h2>
        <button id="viewPostsBtn">View Posts</button>
        <pre id="postsOutput"></pre>
    </div>
    
    <script>
        let token = '';
        let currentBeatId = 1;
        
        document.getElementById('loginBtn').addEventListener('click', async function() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const output = document.getElementById('loginOutput');
            
            try {
                const response = await fetch('/sqlite-api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                output.textContent = JSON.stringify(data, null, 2);
                
                if (data.token) {
                    token = data.token;
                }
            } catch (error) {
                output.textContent = 'Error: ' + error.message;
            }
        });
        
        document.getElementById('createPostBtn').addEventListener('click', async function() {
            if (\!token) {
                alert('Please login first');
                return;
            }
            
            const beatId = parseInt(document.getElementById('beatId').value);
            const title = document.getElementById('title').value;
            const content = document.getElementById('content').value;
            const postType = document.getElementById('postType').value;
            const output = document.getElementById('postOutput');
            
            try {
                const response = await fetch('/sqlite-api/posts', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        beatId: beatId,
                        title: title,
                        content: content,
                        postType: postType
                    })
                });
                
                const data = await response.json();
                output.textContent = JSON.stringify(data, null, 2);
                currentBeatId = beatId;
            } catch (error) {
                output.textContent = 'Error: ' + error.message;
            }
        });
        
        document.getElementById('viewPostsBtn').addEventListener('click', async function() {
            if (\!token) {
                alert('Please login first');
                return;
            }
            
            const beatId = currentBeatId;
            const output = document.getElementById('postsOutput');
            
            try {
                const response = await fetch('/sqlite-api/posts/' + beatId, {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });
                
                const data = await response.json();
                output.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                output.textContent = 'Error: ' + error.message;
            }
        });
    </script>
</body>
</html>
`);

// Start SQLite server 
console.log('Starting SQLite server on port 3001...');
app.listen(port, () => {
    console.log(`SQLite server is running on http://localhost:${port}`);
});

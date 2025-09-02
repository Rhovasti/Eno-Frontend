const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

// JWT Secret - in production this should be in an environment variable
const JWT_SECRET = 'eno-game-platform-secret-key-change-in-production';

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../')));
app.use(express.urlencoded({ extended: true }));

// SQLite database setup
const dbPath = path.join(__dirname, '../data/database.sqlite');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Create SQLite database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
    
    // Run in serialize mode to ensure all tables are created in order
    db.serialize(() => {
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');
        
        // Create users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            roles TEXT DEFAULT '["player"]',
            is_admin INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Create games table
        db.run(`CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Create chapters table
        db.run(`CREATE TABLE IF NOT EXISTS chapters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL,
            sequence_number INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
        )`);
        
        // Create beats table
        db.run(`CREATE TABLE IF NOT EXISTS beats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chapter_id INTEGER NOT NULL,
            sequence_number INTEGER NOT NULL,
            title TEXT,
            content TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
        )`);
        
        // Create posts table
        db.run(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            beat_id INTEGER NOT NULL,
            author_id INTEGER,
            title TEXT,
            content TEXT NOT NULL,
            post_type TEXT NOT NULL CHECK(post_type IN ('gm', 'player', 'op')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (beat_id) REFERENCES beats(id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
        )`);
        
        // Check if admin user exists, if not, create it
        db.get('SELECT * FROM users WHERE email = ?', ['admin@example.com'], (err, row) => {
            if (err) {
                console.error('Error checking for admin user:', err);
                return;
            }
            
            if (!row) {
                // Create admin user if it doesn't exist
                bcrypt.hash('admin123', 10, (err, hash) => {
                    if (err) {
                        console.error('Error hashing password:', err);
                        return;
                    }
                    
                    const roles = JSON.stringify(['admin', 'gm', 'player']);
                    
                    db.run('INSERT INTO users (username, email, password, roles, is_admin) VALUES (?, ?, ?, ?, ?)',
                        ['admin', 'admin@example.com', hash, roles, 1],
                        (err) => {
                            if (err) {
                                console.error('Error creating admin user:', err);
                                return;
                            }
                            console.log('Admin user created successfully');
                        }
                    );
                });
            }
        });
    });
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
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
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Admin can access everything
        if (req.user.is_admin) {
            return next();
        }

        // Check if user has any of the required roles
        const userRoles = JSON.parse(req.user.roles);
        const hasRole = roles.some(role => userRoles.includes(role));
        
        if (!hasRole) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

// Serve login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../hml/login.html'));
});

// Serve threads page
app.get('/threads.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../hml/threads.html'));
});

// Serve storyboard page
app.get('/storyboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../hml/storyboard.html'));
});

// Serve wiki page
app.get('/wiki.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../hml/wiki.html'));
});

// Serve admin page
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../hml/admin.html'));
});

// Serve registration page
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../hml/register.html'));
});

// User registration
app.post('/api/register', async (req, res) => {
    const { username, email, password, confirmPassword } = req.body;

    // Validate input
    if (!username || !email || !password || !confirmPassword) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }

    try {
        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Default role is player
        const roles = JSON.stringify(['player']);

        // Check if username or email already exists
        db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, user) => {
            if (err) {
                console.error('Registration error:', err);
                return res.status(500).json({ error: 'Error creating user' });
            }

            if (user) {
                if (user.username === username) {
                    return res.status(400).json({ error: 'Username already taken' });
                } else if (user.email === email) {
                    return res.status(400).json({ error: 'Email already registered' });
                }
            }

            // Insert user into database
            db.run('INSERT INTO users (username, email, password, roles) VALUES (?, ?, ?, ?)',
                [username, email, hashedPassword, roles],
                function(err) {
                    if (err) {
                        console.error('Registration error:', err);
                        return res.status(500).json({ error: 'Error creating user' });
                    }
                    
                    res.status(201).json({ message: 'User registered successfully', id: this.lastID });
                }
            );
        });
    } catch (error) {
        console.error('Bcrypt error:', error);
        res.status(500).json({ error: 'Error creating user' });
    }
});

// User login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user in database
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Login failed' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Compare passwords
        try {
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            // Create JWT token
            const token = jwt.sign({
                id: user.id,
                username: user.username,
                email: user.email,
                roles: user.roles,
                is_admin: user.is_admin
            }, JWT_SECRET, { expiresIn: '24h' });

            // Set token as cookie
            res.cookie('token', token, {
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000, // 24 hours
                sameSite: 'strict'
            });

            // Send user info (excluding password)
            const userInfo = { ...user };
            delete userInfo.password;

            res.json({
                message: 'Login successful',
                user: userInfo,
                token: token
            });
        } catch (error) {
            console.error('Bcrypt error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logout successful' });
});

// Get current user info
app.get('/api/user', authenticateToken, (req, res) => {
    // Find user in database to get the most up-to-date info
    db.get('SELECT id, username, email, roles, is_admin, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    });
});

// Get all games (now requires authentication)
app.get('/api/games', authenticateToken, (req, res) => {
    // Both admin and regular users can see all games
    db.all('SELECT id, name, description FROM games', (err, games) => {
        if (err) {
            console.error('Error fetching games:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(games);
    });
});

// Create a new game (only GMs can create games)
app.post('/api/games', authenticateToken, authorize(['gm']), (req, res) => {
    const { name, description } = req.body;
    
    // Check if game name already exists
    db.get('SELECT * FROM games WHERE name = ?', [name], (err, game) => {
        if (err) {
            console.error('Error checking game name:', err);
            return res.status(500).json({ error: 'Error creating game' });
        }
        
        if (game) {
            return res.status(400).json({ error: 'Game name already exists' });
        }
        
        // Create the game
        db.run('INSERT INTO games (name, description) VALUES (?, ?)', [name, description], function(err) {
            if (err) {
                console.error('Error creating game:', err);
                return res.status(500).json({ error: 'Error creating game' });
            }
            
            res.status(201).json({ message: 'Game created successfully', id: this.lastID });
        });
    });
});

// Get chapters for a game
app.get('/api/games/:gameId/chapters', authenticateToken, (req, res) => {
    const gameId = req.params.gameId;
    
    db.all('SELECT * FROM chapters WHERE game_id = ? ORDER BY sequence_number ASC', [gameId], (err, chapters) => {
        if (err) {
            console.error('Error fetching chapters:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(chapters);
    });
});

// Create a new chapter (only GMs can create chapters)
app.post('/api/games/:gameId/chapters', authenticateToken, authorize(['gm']), (req, res) => {
    const gameId = req.params.gameId;
    const { title, description } = req.body;

    // Get the current max sequence_number
    db.get('SELECT MAX(sequence_number) AS max_sequence FROM chapters WHERE game_id = ?', [gameId], (err, result) => {
        if (err) {
            console.error('Error fetching max sequence number:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const maxSequence = result ? (result.max_sequence || 0) : 0;
        const newSequenceNumber = maxSequence + 1;

        // Create the chapter
        db.run(
            'INSERT INTO chapters (game_id, sequence_number, title, description) VALUES (?, ?, ?, ?)',
            [gameId, newSequenceNumber, title, description],
            function(err) {
                if (err) {
                    console.error('Error creating chapter:', err);
                    return res.status(500).json({ error: 'Error creating chapter' });
                }
                
                res.status(201).json({ message: 'Chapter created successfully', id: this.lastID });
            }
        );
    });
});

// Get beats for a chapter
app.get('/api/chapters/:chapterId/beats', authenticateToken, (req, res) => {
    const chapterId = req.params.chapterId;
    
    // SQLite doesn't handle complex joins as well as MySQL, so we'll do this in two steps
    db.all('SELECT * FROM beats WHERE chapter_id = ? ORDER BY sequence_number ASC', [chapterId], (err, beats) => {
        if (err) {
            console.error('Error fetching beats:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        // If there are no beats, return an empty array
        if (beats.length === 0) {
            return res.json([]);
        }
        
        // Get the first post for each beat (if any)
        const beatsWithPosts = beats.map(beat => {
            return new Promise((resolve, reject) => {
                db.get(
                    `SELECT p.*, u.username 
                    FROM posts p
                    LEFT JOIN users u ON p.author_id = u.id
                    WHERE p.beat_id = ?
                    ORDER BY p.created_at ASC
                    LIMIT 1`,
                    [beat.id],
                    (err, post) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        // Combine beat and post info
                        resolve({
                            ...beat,
                            ...(post || {})
                        });
                    }
                );
            });
        });
        
        Promise.all(beatsWithPosts)
            .then(results => {
                res.json(results);
            })
            .catch(err => {
                console.error('Error fetching beat posts:', err);
                res.status(500).json({ error: 'Database error' });
            });
    });
});

// Create a new beat (only GMs can create beats)
app.post('/api/chapters/:chapterId/beats', authenticateToken, authorize(['gm']), (req, res) => {
    const chapterId = req.params.chapterId;
    const { title, content } = req.body;

    // Get the current max sequence_number
    db.get('SELECT MAX(sequence_number) AS max_sequence FROM beats WHERE chapter_id = ?', [chapterId], (err, result) => {
        if (err) {
            console.error('Error fetching max sequence number:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const maxSequence = result ? (result.max_sequence || 0) : 0;
        const newSequenceNumber = maxSequence + 1;

        // Create the beat
        db.run(
            'INSERT INTO beats (chapter_id, sequence_number, title, content) VALUES (?, ?, ?, ?)',
            [chapterId, newSequenceNumber, title || '', content || ''],
            function(err) {
                if (err) {
                    console.error('Error creating beat:', err);
                    return res.status(500).json({ error: 'Error creating beat' });
                }
                
                res.status(201).json({ message: 'Beat created successfully', id: this.lastID });
            }
        );
    });
});

// Get posts for a beat
app.get('/api/beats/:beatId/posts', authenticateToken, (req, res) => {
    const beatId = req.params.beatId;
    
    db.all(
        `SELECT p.*, u.username
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
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

// Create a new post (both players and GMs can create posts)
app.post('/api/posts', authenticateToken, authorize(['player', 'gm']), (req, res) => {
    const { beatId, title, content, postType } = req.body;
    const authorId = req.user.id;
    
    // Input validation
    if (!beatId) {
        console.error('Missing beatId in request body:', req.body);
        return res.status(400).json({ error: 'Beat ID is required' });
    }
    
    if (!title || !content) {
        console.error('Missing title or content in request body:', req.body);
        return res.status(400).json({ error: 'Title and content are required' });
    }
    
    // First, verify that the beat exists before adding a post to it
    db.get('SELECT id, chapter_id FROM beats WHERE id = ?', [beatId], (err, beat) => {
        if (err) {
            console.error('Error checking beat existence:', err);
            return res.status(500).json({ error: 'Database error checking beat' });
        }
        
        if (!beat) {
            console.error('Attempted to create post for nonexistent beat:', beatId);
            return res.status(404).json({ error: 'Beat not found' });
        }
        
        console.log('Creating post with data:', {
            beatId,
            authorId,
            title: title.substring(0, 20) + '...',
            contentLength: content ? content.length : 0,
            postType,
            beat: beat
        });
        
        // Validate postType based on user role
        let userRoles = [];
        try {
            userRoles = JSON.parse(req.user.roles);
            if (!Array.isArray(userRoles)) userRoles = [];
        } catch (error) {
            console.error('Error parsing user roles:', error);
            userRoles = [];
        }
        
        if (postType === 'gm' && !userRoles.includes('gm') && !req.user.is_admin) {
            return res.status(403).json({ error: 'Only GMs can create GM posts' });
        }

        // Create the post connected to the existing beat
        db.run(
            `INSERT INTO posts (beat_id, author_id, title, content, post_type)
            VALUES (?, ?, ?, ?, ?)`,
            [beatId, authorId, title, content, postType || 'player'],
            function(err) {
                if (err) {
                    console.error('Error creating post:', err);
                    return res.status(500).json({ error: 'Error creating post: ' + err.message });
                }
                
                // Log success message with more details
                console.log(`Post created successfully - ID: ${this.lastID}, Beat: ${beatId}, Author: ${authorId}`);
                
                res.status(201).json({ 
                    message: 'Post created successfully', 
                    id: this.lastID,
                    beatId: beatId
                });
            }
        );
    });
});

// ADMIN ROUTES: Managing users

// Get all users (admin only)
app.get('/api/users', authenticateToken, (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    db.all('SELECT id, username, email, roles, is_admin, created_at FROM users', (err, users) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(users);
    });
});

// Update user roles (admin only)
app.put('/api/users/:userId/roles', authenticateToken, (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const userId = req.params.userId;
    const { roles, is_admin } = req.body;

    // Validate roles
    if (!Array.isArray(roles) || !roles.every(role => ['player', 'gm'].includes(role))) {
        return res.status(400).json({ error: 'Invalid roles' });
    }

    // Prepare roles as JSON string
    const rolesJson = JSON.stringify(roles);

    db.run(
        'UPDATE users SET roles = ?, is_admin = ? WHERE id = ?',
        [rolesJson, is_admin ? 1 : 0, userId],
        function(err) {
            if (err) {
                console.error('Error updating user roles:', err);
                return res.status(500).json({ error: 'Database error' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'User not found' });
            }

            res.json({ message: 'User roles updated successfully' });
        }
    );
});

// Delete user (admin only)
app.delete('/api/users/:userId', authenticateToken, (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const userId = req.params.userId;

    // Prevent deleting oneself
    if (parseInt(userId) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
        if (err) {
            console.error('Error deleting user:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    });
});

// Add health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'SQLite Server is running',
        database: 'sqlite',
        version: '1.0.0'
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
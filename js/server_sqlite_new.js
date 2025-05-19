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
const schemaPath = path.join(__dirname, '../sql/sqlite_schema.sql');

// Ensure the data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Function to read and execute the schema SQL
function initializeDatabase(db) {
    return new Promise((resolve, reject) => {
        // Check if schema file exists
        if (!fs.existsSync(schemaPath)) {
            console.error(`Schema file not found at ${schemaPath}`);
            // Use inline schema if file doesn't exist
            setupInlineSchema(db)
                .then(resolve)
                .catch(reject);
            return;
        }
        
        // Read schema file
        fs.readFile(schemaPath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading schema file:', err);
                // Fallback to inline schema
                setupInlineSchema(db)
                    .then(resolve)
                    .catch(reject);
                return;
            }
            
            // Split the schema into individual statements
            const statements = data.split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0);
            
            // Execute each statement
            db.serialize(() => {
                db.run('PRAGMA foreign_keys = ON');
                
                let lastError = null;
                statements.forEach(stmt => {
                    db.run(stmt, err => {
                        if (err) {
                            console.error(`Error executing schema statement: ${stmt}`, err);
                            lastError = err;
                        }
                    });
                });
                
                if (lastError) {
                    reject(lastError);
                } else {
                    setupInitialUsers(db)
                        .then(resolve)
                        .catch(reject);
                }
            });
        });
    });
}

// Fallback inline schema setup
function setupInlineSchema(db) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Enable foreign keys
            db.run('PRAGMA foreign_keys = ON');
            
            // Create users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('op', 'gm', 'player')),
                email TEXT UNIQUE,
                password TEXT,
                is_admin INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`, err => {
                if (err) {
                    console.error('Error creating users table:', err);
                    reject(err);
                    return;
                }
            });
            
            // Create games table
            db.run(`CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            
            // Create chapters table
            db.run(`CREATE TABLE IF NOT EXISTS chapters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                game_id INTEGER NOT NULL,
                sequence_number INTEGER NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
            )`);
            
            // Create beats table
            db.run(`CREATE TABLE IF NOT EXISTS beats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chapter_id INTEGER NOT NULL,
                sequence_number INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (beat_id) REFERENCES beats(id) ON DELETE CASCADE,
                FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
            )`);
            
            // Create indexes
            db.run(`CREATE INDEX IF NOT EXISTS idx_posts_beat_id ON posts (beat_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts (author_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_beats_chapter_id ON beats (chapter_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_chapters_game_id ON chapters (game_id)`);
            
            // Create update triggers
            db.run(`CREATE TRIGGER IF NOT EXISTS update_games_timestamp 
                AFTER UPDATE ON games
                BEGIN
                    UPDATE games SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                END;`);
                
            db.run(`CREATE TRIGGER IF NOT EXISTS update_chapters_timestamp 
                AFTER UPDATE ON chapters
                BEGIN
                    UPDATE chapters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                END;`);
                
            db.run(`CREATE TRIGGER IF NOT EXISTS update_beats_timestamp 
                AFTER UPDATE ON beats
                BEGIN
                    UPDATE beats SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                END;`);
                
            db.run(`CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
                AFTER UPDATE ON users
                BEGIN
                    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                END;`);
                
            db.run(`CREATE TRIGGER IF NOT EXISTS update_posts_timestamp 
                AFTER UPDATE ON posts
                BEGIN
                    UPDATE posts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
                END;`);
            
            setupInitialUsers(db)
                .then(resolve)
                .catch(reject);
        });
    });
}

// Setup initial users
function setupInitialUsers(db) {
    return new Promise((resolve, reject) => {
        // Check if admin user exists
        db.get('SELECT * FROM users WHERE username = ?', ['admin'], (err, row) => {
            if (err) {
                console.error('Error checking for admin user:', err);
                reject(err);
                return;
            }
            
            if (!row) {
                // Create admin user
                bcrypt.hash('admin123', 10, (err, hash) => {
                    if (err) {
                        console.error('Error hashing password:', err);
                        reject(err);
                        return;
                    }
                    
                    db.run('INSERT INTO users (username, email, password, roles, is_admin) VALUES (?, ?, ?, ?, ?)',
                        ['admin', 'admin@example.com', hash, JSON.stringify(["admin", "gm", "player"]), 1],
                        err => {
                            if (err) {
                                console.error('Error creating admin user:', err);
                                reject(err);
                                return;
                            }
                            
                            console.log('Admin user created successfully');
                            
                            // Create additional test users
                            createTestUsers(db)
                                .then(resolve)
                                .catch(reject);
                        }
                    );
                });
            } else {
                resolve();
            }
        });
    });
}

// Create test users
function createTestUsers(db) {
    return new Promise((resolve, reject) => {
        bcrypt.hash('password123', 10, (err, hash) => {
            if (err) {
                console.error('Error hashing password:', err);
                reject(err);
                return;
            }
            
            db.run('INSERT INTO users (username, email, password, roles) VALUES (?, ?, ?, ?)',
                ['gm', 'gm@example.com', hash, JSON.stringify(["gm"])],
                err => {
                    if (err && err.code !== 'SQLITE_CONSTRAINT') {
                        console.error('Error creating GM user:', err);
                        reject(err);
                        return;
                    }
                    
                    db.run('INSERT INTO users (username, email, password, roles) VALUES (?, ?, ?, ?)',
                        ['player', 'player@example.com', hash, JSON.stringify(["player"])],
                        err => {
                            if (err && err.code !== 'SQLITE_CONSTRAINT') {
                                console.error('Error creating player user:', err);
                                reject(err);
                                return;
                            }
                            
                            console.log('Test users created successfully');
                            resolve();
                        }
                    );
                }
            );
        });
    });
}

// Create SQLite database connection
const db = new sqlite3.Database(dbPath, err => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    
    console.log('Connected to the database');
    
    // Initialize database with schema
    initializeDatabase(db)
        .then(() => {
            console.log('Database initialized successfully');
        })
        .catch(err => {
            console.error('Error initializing database:', err);
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
const authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Admin can access everything
        if (req.user.is_admin) {
            return next();
        }

        // Parse roles from JSON string if it's a string
        let userRoles = [];
        try {
            if (typeof req.user.roles === 'string') {
                userRoles = JSON.parse(req.user.roles);
            } else if (Array.isArray(req.user.roles)) {
                userRoles = req.user.roles;
            }
        } catch (error) {
            console.error('Error parsing user roles:', error);
        }

        // Check if any of user's roles is included in the allowed roles
        const hasRole = allowedRoles.some(role => userRoles.includes(role));
        
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

// Serve registration page
app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../hml/register.html'));
});

// Serve other HTML pages
app.get('/threads.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../hml/threads.html'));
});

app.get('/storyboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../hml/storyboard.html'));
});

app.get('/wiki.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../hml/wiki.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../hml/admin.html'));
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
                [username, email, hashedPassword, JSON.stringify(["player"])],
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
                is_admin: user.is_admin ? true : false
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
    db.get('SELECT id, username, email, role, is_admin, created_at FROM users WHERE id = ?', [req.user.id], (err, user) => {
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
app.post('/api/games', authenticateToken, authorize(['gm', 'op']), (req, res) => {
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

// Get chapters for a game (by default, exclude archived)
app.get('/api/games/:gameId/chapters', authenticateToken, (req, res) => {
    const gameId = req.params.gameId;
    const includeArchived = req.query.includeArchived === 'true';
    
    let query = 'SELECT * FROM chapters WHERE game_id = ?';
    if (!includeArchived) {
        query += ' AND (is_archived = 0 OR is_archived IS NULL)';
    }
    query += ' ORDER BY sequence_number ASC';
    
    db.all(query, [gameId], (err, chapters) => {
        if (err) {
            console.error('Error fetching chapters:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(chapters);
    });
});

// Create a new chapter (only GMs can create chapters)
app.post('/api/games/:gameId/chapters', authenticateToken, authorize(['gm', 'op']), (req, res) => {
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
    
    db.all('SELECT * FROM beats WHERE chapter_id = ? ORDER BY sequence_number ASC', [chapterId], (err, beats) => {
        if (err) {
            console.error('Error fetching beats:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(beats);
    });
});

// Create a new beat (only GMs can create beats)
app.post('/api/chapters/:chapterId/beats', authenticateToken, authorize(['gm', 'op']), (req, res) => {
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

        // Create the beat with title and content
        db.run(
            'INSERT INTO beats (chapter_id, sequence_number, title, content) VALUES (?, ?, ?, ?)',
            [chapterId, newSequenceNumber, title || null, content || null],
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
app.post('/api/posts', authenticateToken, (req, res) => {
    const { beatId, title, content, postType, archiveChapter } = req.body;
    const authorId = req.user.id;
    
    // Input validation
    if (!beatId) {
        console.error('Missing beatId in request body:', req.body);
        return res.status(400).json({ error: 'Beat ID is required' });
    }
    
    if (!content) {
        console.error('Missing content in request body:', req.body);
        return res.status(400).json({ error: 'Content is required' });
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
            title: title || '',
            contentLength: content ? content.length : 0,
            postType,
            beat: beat
        });
        
        // Validate postType based on user roles
        let userRoles = [];
        try {
            if (typeof req.user.roles === 'string') {
                userRoles = JSON.parse(req.user.roles);
            } else if (Array.isArray(req.user.roles)) {
                userRoles = req.user.roles;
            }
        } catch (error) {
            console.error('Error parsing user roles:', error);
            userRoles = [];
        }
        
        if (postType === 'gm' && !userRoles.includes('gm') && !userRoles.includes('admin') && !req.user.is_admin) {
            return res.status(403).json({ error: 'Only GMs can create GM posts' });
        }
        
        if (postType === 'op' && !userRoles.includes('admin') && !req.user.is_admin) {
            return res.status(403).json({ error: 'Only OPs can create OP posts' });
        }

        // Create the post connected to the existing beat
        db.run(
            `INSERT INTO posts (beat_id, author_id, title, content, post_type)
            VALUES (?, ?, ?, ?, ?)`,
            [beatId, authorId, title || '', content, postType || 'player'],
            function(err) {
                if (err) {
                    console.error('Error creating post:', err);
                    return res.status(500).json({ error: 'Error creating post: ' + err.message });
                }
                
                // Log success message with more details
                console.log(`Post created successfully - ID: ${this.lastID}, Beat: ${beatId}, Author: ${authorId}`);
                
                // Check if we should archive the chapter after posting
                if (archiveChapter) {
                    // Get chapter ID from the beat
                    db.get('SELECT chapter_id FROM beats WHERE id = ?', [beatId], (err, beatInfo) => {
                        if (err || !beatInfo) {
                            console.error('Error fetching beat info for archiving:', err);
                            // Still return success for the post creation
                            return res.status(201).json({ 
                                message: 'Post created successfully (archiving failed)', 
                                id: this.lastID,
                                beatId: beatId
                            });
                        }
                        
                        // Archive the chapter
                        const chapterId = beatInfo.chapter_id;
                        db.run(
                            'UPDATE chapters SET is_archived = 1, archived_at = CURRENT_TIMESTAMP WHERE id = ?',
                            [chapterId],
                            (err) => {
                                if (err) {
                                    console.error('Error archiving chapter:', err);
                                    return res.status(201).json({ 
                                        message: 'Post created successfully (archiving failed)', 
                                        id: this.lastID,
                                        beatId: beatId
                                    });
                                }
                                
                                console.log(`Chapter ${chapterId} archived successfully after posting`);
                                res.status(201).json({ 
                                    message: 'Post created and chapter archived successfully', 
                                    id: this.lastID,
                                    beatId: beatId,
                                    chapterArchived: true
                                });
                            }
                        );
                    });
                } else {
                    res.status(201).json({ 
                        message: 'Post created successfully', 
                        id: this.lastID,
                        beatId: beatId
                    });
                }
            }
        );
    });
});

// ADMIN ROUTES: Managing users

// Get all users (admin only)
app.get('/api/users', authenticateToken, (req, res) => {
    if (!req.user.is_admin && !JSON.parse(req.user.roles || '[]').includes('admin')) {
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
    if (!req.user.is_admin && !req.user.roles.includes('admin')) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const userId = req.params.userId;
    const { roles, is_admin } = req.body;

    // Ensure roles is valid
    let validRoles;
    try {
        if (typeof roles === 'string') {
            validRoles = JSON.parse(roles);
        } else if (Array.isArray(roles)) {
            validRoles = roles;
        } else {
            return res.status(400).json({ error: 'Invalid roles format' });
        }
        
        // Check if all roles are valid
        for (const role of validRoles) {
            if (!['player', 'gm', 'admin'].includes(role)) {
                return res.status(400).json({ error: `Invalid role: ${role}` });
            }
        }
    } catch (error) {
        console.error('Error parsing roles:', error);
        return res.status(400).json({ error: 'Invalid roles format' });
    }

    const rolesJSON = JSON.stringify(validRoles);
    
    db.run(
        'UPDATE users SET roles = ?, is_admin = ? WHERE id = ?',
        [rolesJSON, is_admin ? 1 : 0, userId],
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
    if (!req.user.is_admin && !req.user.roles.includes('admin')) {
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

// Chapter archiving endpoints

// Archive a chapter (GM only)
app.post('/api/chapters/:chapterId/archive', authenticateToken, authorize(['gm', 'op']), (req, res) => {
    const chapterId = req.params.chapterId;
    
    // First, get all beats for this chapter with their content
    db.all(
        `SELECT b.*, 
         COALESCE(b.title, 'Beat ' || b.sequence_number) as display_title,
         b.content
         FROM beats b
         WHERE b.chapter_id = ?
         ORDER BY b.sequence_number ASC`,
        [chapterId],
        (err, beats) => {
            if (err) {
                console.error('Error fetching beats:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            // Compile beats into a narrative
            let narrative = '';
            beats.forEach((beat, index) => {
                if (index > 0) narrative += '\n\n---\n\n';
                narrative += `## ${beat.display_title}\n\n`;
                if (beat.content) {
                    narrative += beat.content;
                }
            });
            
            // Update chapter with archive status and narrative
            db.run(
                `UPDATE chapters 
                 SET is_archived = 1, 
                     archived_at = CURRENT_TIMESTAMP, 
                     archived_narrative = ?
                 WHERE id = ?`,
                [narrative, chapterId],
                function(err) {
                    if (err) {
                        console.error('Error archiving chapter:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    if (this.changes === 0) {
                        return res.status(404).json({ error: 'Chapter not found' });
                    }
                    
                    res.json({ 
                        message: 'Chapter archived successfully',
                        narrative: narrative
                    });
                }
            );
        }
    );
});

// Get archived chapters for storyboard
app.get('/api/games/:gameId/archived-chapters', authenticateToken, (req, res) => {
    const gameId = req.params.gameId;
    
    db.all(
        `SELECT id, title, description, sequence_number, archived_at, archived_narrative
         FROM chapters
         WHERE game_id = ? AND is_archived = 1
         ORDER BY sequence_number ASC`,
        [gameId],
        (err, chapters) => {
            if (err) {
                console.error('Error fetching archived chapters:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json(chapters);
        }
    );
});

// Add health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'SQLite Server is running',
        database: 'sqlite',
        version: '1.1.0',
        schema: 'mysql-compatible'
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
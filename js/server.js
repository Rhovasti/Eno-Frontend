const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const app = express();
const port = 3000;

// JWT Secret - in production this should be in an environment variable
const JWT_SECRET = 'eno-game-platform-secret-key-change-in-production';

// Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../')));
app.use(express.urlencoded({ extended: true }));

// MySQL connection
const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root', // Adjust as needed
    password: '', // Adjust as needed
    database: 'Foorumi' // Updated to match the new schema
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    console.log('Authentication middleware - token:', token ? 'Token found' : 'No token');
    console.log('Authorization header:', req.headers.authorization);
    console.log('Cookies:', req.cookies);
    
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const user = jwt.verify(token, JWT_SECRET);
        console.log('Token verified, user:', user);
        req.user = user;
        next();
    } catch (error) {
        console.error('Token verification error:', error);
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

        // Insert user into database
        const query = 'INSERT INTO users (username, email, password, roles) VALUES (?, ?, ?, ?)';
        db.query(query, [username, email, hashedPassword, roles], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    if (err.sqlMessage.includes('username')) {
                        return res.status(400).json({ error: 'Username already taken' });
                    } else if (err.sqlMessage.includes('email')) {
                        return res.status(400).json({ error: 'Email already registered' });
                    }
                }
                console.error('Registration error:', err);
                return res.status(500).json({ error: 'Error creating user' });
            }

            res.status(201).json({ message: 'User registered successfully', id: result.insertId });
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
    const query = 'SELECT * FROM users WHERE email = ?';
    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Login failed' });
        }

        if (results.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = results[0];

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
    const query = 'SELECT id, username, email, roles, is_admin, created_at FROM users WHERE id = ?';
    db.query(query, [req.user.id], (err, results) => {
        if (err) {
            console.error('Error fetching user:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(results[0]);
    });
});

// Get all games (now requires authentication)
app.get('/api/games', authenticateToken, (req, res) => {
    let query;
    
    // If admin, show all games
    // If GM, show games they created
    // If player, show all games
    if (req.user.is_admin) {
        query = 'SELECT id, name, description FROM games';
        db.query(query, (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    } else {
        // Non-admin users can see all games
        query = 'SELECT id, name, description FROM games';
        db.query(query, (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(results);
        });
    }
});

// Create a new game (only GMs can create games)
app.post('/api/games', authenticateToken, authorize(['gm']), (req, res) => {
    const { name, description } = req.body;
    const query = 'INSERT INTO games (name, description) VALUES (?, ?)';
    db.query(query, [name, description], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Game name already exists' });
            }
            return res.status(500).json({ error: 'Error creating game' });
        }
        res.status(201).json({ message: 'Game created successfully', id: result.insertId });
    });
});

// Get chapters for a game
app.get('/api/games/:gameId/chapters', authenticateToken, (req, res) => {
    const gameId = req.params.gameId;
    const query = 'SELECT * FROM chapters WHERE game_id = ? ORDER BY sequence_number ASC';

    db.query(query, [gameId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Create a new chapter (only GMs can create chapters)
app.post('/api/games/:gameId/chapters', authenticateToken, authorize(['gm']), (req, res) => {
    const gameId = req.params.gameId;
    const { title, description } = req.body;

    // Get the current max sequence_number
    const getMaxSequenceQuery = 'SELECT MAX(sequence_number) AS max_sequence FROM chapters WHERE game_id = ?';

    db.query(getMaxSequenceQuery, [gameId], (err, results) => {
        if (err) {
            console.error('Error fetching max sequence number:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const maxSequence = results[0].max_sequence || 0;
        const newSequenceNumber = maxSequence + 1;

        const insertQuery = 'INSERT INTO chapters (game_id, sequence_number, title, description) VALUES (?, ?, ?, ?)';
        const params = [gameId, newSequenceNumber, title, description];

        db.query(insertQuery, params, (err, result) => {
            if (err) {
                console.error('Error creating chapter:', err);
                return res.status(500).json({ error: 'Error creating chapter' });
            }
            res.status(201).json({ message: 'Chapter created successfully', id: result.insertId });
        });
    });
});

// Get beats for a chapter
app.get('/api/chapters/:chapterId/beats', authenticateToken, (req, res) => {
    const chapterId = req.params.chapterId;
    const query = `
        SELECT b.*, p.*, u.username
        FROM beats b
        LEFT JOIN posts p ON p.beat_id = b.id
        LEFT JOIN users u ON p.author_id = u.id
        WHERE b.chapter_id = ?
        ORDER BY b.sequence_number ASC, p.created_at ASC
    `;

    db.query(query, [chapterId], (err, results) => {
        if (err) {
            console.error('Error fetching beats:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Create a new beat (only GMs can create beats)
app.post('/api/chapters/:chapterId/beats', authenticateToken, authorize(['gm']), (req, res) => {
    const chapterId = req.params.chapterId;
    const { title, content } = req.body;

    // Get the current max sequence_number
    const getMaxSequenceQuery = 'SELECT MAX(sequence_number) AS max_sequence FROM beats WHERE chapter_id = ?';

    db.query(getMaxSequenceQuery, [chapterId], (err, results) => {
        if (err) {
            console.error('Error fetching max sequence number:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const maxSequence = results[0].max_sequence || 0;
        const newSequenceNumber = maxSequence + 1;

        const insertQuery = 'INSERT INTO beats (chapter_id, sequence_number, title, content) VALUES (?, ?, ?, ?)';
        const params = [chapterId, newSequenceNumber, title || '', content || ''];

        db.query(insertQuery, params, (err, result) => {
            if (err) {
                console.error('Error creating beat:', err);
                return res.status(500).json({ error: 'Error creating beat' });
            }
            res.status(201).json({ message: 'Beat created successfully', id: result.insertId });
        });
    });
});

// Get posts for a beat
app.get('/api/beats/:beatId/posts', authenticateToken, (req, res) => {
    const beatId = req.params.beatId;
    const query = `
        SELECT p.*, u.username
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        WHERE p.beat_id = ?
        ORDER BY p.created_at ASC
    `;

    db.query(query, [beatId], (err, results) => {
        if (err) {
            console.error('Error fetching posts:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Create a new post (both players and GMs can create posts)
app.post('/api/posts', authenticateToken, authorize(['player', 'gm']), (req, res) => {
    const { beatId, title, content, postType } = req.body;
    const authorId = req.user.id;
    
    // Validate postType based on user role
    const userRoles = JSON.parse(req.user.roles);
    if (postType === 'gm' && !userRoles.includes('gm') && !req.user.is_admin) {
        return res.status(403).json({ error: 'Only GMs can create GM posts' });
    }

    const query = `
        INSERT INTO posts (beat_id, author_id, title, content, post_type)
        VALUES (?, ?, ?, ?, ?)
    `;
    const params = [beatId, authorId, title, content, postType];

    db.query(query, params, (err, result) => {
        if (err) {
            console.error('Error creating post:', err);
            return res.status(500).json({ error: 'Error creating post' });
        }
        res.status(201).json({ message: 'Post created successfully', id: result.insertId });
    });
});

// ADMIN ROUTES: Managing users

// Get all users (admin only)
app.get('/api/users', authenticateToken, (req, res) => {
    console.log('GET /api/users - User in request:', req.user);
    
    if (!req.user.is_admin) {
        console.log('User not admin, access denied');
        return res.status(403).json({ error: 'Admin access required' });
    }

    const query = 'SELECT id, username, email, roles, is_admin, created_at FROM users';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching users:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Update user roles (admin only)
app.put('/api/users/:userId/roles', authenticateToken, (req, res) => {
    console.log('Role update request received:', {
        requestUser: req.user,
        userId: req.params.userId,
        body: req.body,
        authHeader: req.headers.authorization
    });

    if (!req.user.is_admin) {
        console.log('User not admin. User data:', req.user);
        return res.status(403).json({ error: 'Admin access required' });
    }

    const userId = req.params.userId;
    const { roles, is_admin } = req.body;

    console.log('Updating user roles:', { userId, roles, is_admin });

    // Validate roles
    if (!Array.isArray(roles) || !roles.every(role => ['player', 'gm'].includes(role))) {
        console.log('Invalid roles format:', roles);
        return res.status(400).json({ error: 'Invalid roles' });
    }

    // Prepare roles as JSON string
    const rolesJson = JSON.stringify(roles);

    const query = 'UPDATE users SET roles = ?, is_admin = ? WHERE id = ?';
    db.query(query, [rolesJson, is_admin || false, userId], (err, result) => {
        if (err) {
            console.error('Error updating user roles:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (result.affectedRows === 0) {
            console.log('User not found:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log('User roles updated successfully:', { userId, roles, is_admin });
        res.json({ message: 'User roles updated successfully' });
    });
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

    const query = 'DELETE FROM users WHERE id = ?';
    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error deleting user:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'User deleted successfully' });
    });
});

// Special debug endpoint to check authentication
app.get('/api/auth-test', (req, res) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.json({ 
            authenticated: false,
            message: 'No token found',
            cookies: req.cookies,
            authHeader: req.headers.authorization
        });
    }
    
    try {
        const user = jwt.verify(token, JWT_SECRET);
        return res.json({
            authenticated: true,
            user: user,
            tokenSource: req.cookies.token ? 'cookie' : 'header'
        });
    } catch (error) {
        return res.json({
            authenticated: false,
            error: error.message,
            token: token.substring(0, 10) + '...'
        });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
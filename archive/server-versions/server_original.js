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

// Create a function to get a fresh database connection
function getDbConnection() {
    return mysql.createConnection({
        host: '127.0.0.1',
        user: 'eno_user', // Using dedicated application user
        password: 'password123', // Application user password
        database: 'Foorumi',
        charset: 'utf8mb4' // Support for Scandinavian characters and emoji
    });
}

// Global variable for database connection
let db = getDbConnection();

// Improved database connection with retry logic
function connectWithRetry(maxRetries = 5, delay = 5000) {
    let retries = 0;
    
    function tryConnect() {
        // Create a fresh connection
        db = getDbConnection();
        
        db.connect(err => {
            if (err) {
                console.error('Error connecting to the database:', err);
                
                if (retries < maxRetries) {
                    retries++;
                    console.log(`Retrying database connection (${retries}/${maxRetries}) in ${delay/1000} seconds...`);
                    setTimeout(tryConnect, delay);
                } else {
                    console.error('Maximum connection retries reached. Database connection failed.');
                    // The server will still run but database features won't work
                }
                return;
            }
            
            console.log('Connected to the database successfully');
            
            // Verify the database structure
            db.query('SHOW TABLES', (err, results) => {
                if (err) {
                    console.error('Error listing tables:', err);
                    return;
                }
                
                const tables = results.map(row => Object.values(row)[0]);
                console.log('Available tables:', tables.join(', '));
                
                // Check if essential tables exist
                const requiredTables = ['users', 'games', 'chapters', 'beats', 'posts'];
                const missingTables = requiredTables.filter(table => !tables.includes(table));
                
                if (missingTables.length > 0) {
                    console.error('Missing required tables:', missingTables.join(', '));
                    console.error('Database schema might be incomplete');
                }
            });
        });
        
        // Add error handler to recreate connection if it fails
        db.on('error', (err) => {
            console.error('Database connection error:', err);
            if (err.code === 'PROTOCOL_CONNECTION_LOST' || 
                err.code === 'PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR') {
                console.log('Reconnecting to database...');
                connectWithRetry();
            } else {
                throw err;
            }
        });
    }
    
    tryConnect();
}

// Start the connection process
connectWithRetry();

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
            console.error('Authorization failed: No user in request');
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Admin can access everything
        if (req.user.is_admin) {
            return next();
        }

        // Safely parse user roles with error handling
        let userRoles = [];
        try {
            userRoles = Array.isArray(req.user.roles) ? req.user.roles : JSON.parse(req.user.roles || '[]');
        } catch (error) {
            console.error('Error parsing user roles in authorization middleware:', error, req.user.roles);
            userRoles = [];
        }

        console.log('User roles for authorization:', {
            userId: req.user.id,
            username: req.user.username,
            userRoles,
            requiredRoles: roles
        });

        // Check if user has any of the required roles
        const hasRole = roles.some(role => userRoles.includes(role));
        
        if (!hasRole) {
            console.error('Authorization failed: Insufficient permissions', { 
                userId: req.user.id, 
                userRoles, 
                requiredRoles: roles 
            });
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
    console.log('Login attempt with email:', email);

    // Validate input
    if (!email || !password) {
        console.log('Missing email or password');
        return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user in database
    const query = 'SELECT * FROM users WHERE email = ?';
    console.log('Running query:', query, 'with params:', [email]);
    
    db.query(query, [email], async (err, results) => {
        if (err) {
            console.error('Login database error:', err);
            return res.status(500).json({ error: 'Login failed' });
        }

        console.log('Query results:', results ? `Found ${results.length} users` : 'No results');
        
        if (!results || results.length === 0) {
            console.log('No user found with email:', email);
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = results[0];
        console.log('User found:', { 
            id: user.id, 
            username: user.username, 
            hasPassword: !!user.password,
            passwordLength: user.password ? user.password.length : 0
        });

        // Compare passwords
        try {
            console.log('Comparing passwords...');
            const match = await bcrypt.compare(password, user.password);
            console.log('Password match result:', match);
            
            if (!match) {
                console.log('Password does not match');
                return res.status(401).json({ error: 'Invalid email or password' });
            }

            // Create JWT token
            console.log('Creating JWT token...');
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

            console.log('Login successful for user:', user.username);
            res.json({
                message: 'Login successful',
                user: userInfo,
                token: token
            });
        } catch (error) {
            console.error('Bcrypt error:', error);
            res.status(500).json({ error: 'Login failed - ' + error.message });
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
    const includeArchived = req.query.includeArchived === 'true';
    
    let query = 'SELECT * FROM chapters WHERE game_id = ?';
    if (!includeArchived) {
        query += ' AND (is_archived = 0 OR is_archived IS NULL)';
    }
    query += ' ORDER BY sequence_number ASC';

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

// Archive a chapter (only GMs can archive chapters)
app.put('/api/chapters/:chapterId/archive', authenticateToken, authorize(['gm']), (req, res) => {
    const chapterId = req.params.chapterId;
    const { archived_narrative } = req.body;
    
    let query;
    let params;
    
    if (archived_narrative) {
        query = `
            UPDATE chapters 
            SET is_archived = TRUE, 
                archived_at = CURRENT_TIMESTAMP,
                archived_narrative = ?
            WHERE id = ?
        `;
        params = [archived_narrative, chapterId];
    } else {
        query = `
            UPDATE chapters 
            SET is_archived = TRUE, 
                archived_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        params = [chapterId];
    }
    
    db.query(query, params, (err, result) => {
        if (err) {
            console.error('Error archiving chapter:', err);
            return res.status(500).json({ error: 'Error archiving chapter' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Chapter not found' });
        }
        
        res.json({ message: 'Chapter archived successfully' });
    });
});

// Get beats for a chapter
app.get('/api/chapters/:chapterId/beats', authenticateToken, (req, res) => {
    const chapterId = req.params.chapterId;
    
    // IMPORTANT: Changed to only return beats without posts to avoid duplicates
    const query = `
        SELECT b.*
        FROM beats b
        WHERE b.chapter_id = ?
        ORDER BY b.sequence_number ASC
    `;

    db.query(query, [chapterId], (err, results) => {
        if (err) {
            console.error('Error fetching beats:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        console.log(`Returning ${results.length} beats for chapter ${chapterId}`);
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

// Unauthenticated debug endpoint for testing
app.get('/api/debug/posts', (req, res) => {
    console.log('Debug endpoint accessed');
    res.json([
        { id: 999, title: 'Debug Post', content: 'This is a debug post', post_type: 'player', username: 'debug_user' }
    ]);
});

// Get all posts (mainly for debugging/admin purposes)
app.get('/api/posts', authenticateToken, (req, res) => {
    console.log('GET /api/posts endpoint accessed by user:', req.user ? req.user.username : 'unknown');
    
    const query = `
        SELECT p.*, u.username
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 50
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching posts:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Create a new post (both players and GMs can create posts)
app.post('/api/posts', authenticateToken, authorize(['player', 'gm']), (req, res) => {
    const { beatId, title, content, postType, archiveChapter } = req.body;
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
    
    // Safely parse user roles with error handling
    let userRoles = [];
    try {
        userRoles = Array.isArray(req.user.roles) ? req.user.roles : JSON.parse(req.user.roles || '[]');
    } catch (error) {
        console.error('Error parsing user roles:', error, req.user.roles);
        userRoles = [];
    }
    
    // First, verify that the beat exists before adding a post to it
    const checkBeatQuery = 'SELECT id, chapter_id FROM beats WHERE id = ?';
    db.query(checkBeatQuery, [beatId], (err, beatResults) => {
        if (err) {
            console.error('Error checking beat existence:', err);
            return res.status(500).json({ error: 'Database error checking beat' });
        }
        
        if (!beatResults || beatResults.length === 0) {
            console.error('Attempted to create post for nonexistent beat:', beatId);
            return res.status(404).json({ error: 'Beat not found' });
        }
        
        console.log('Creating post with data:', {
            beatId,
            authorId,
            title: title.substring(0, 20) + '...',
            contentLength: content.length, 
            postType,
            userRoles,
            beat: beatResults[0]
        });
        
        // Validate postType based on user role
        if (postType === 'gm' && !userRoles.includes('gm') && !req.user.is_admin) {
            return res.status(403).json({ error: 'Only GMs can create GM posts' });
        }

        // Set content encoding to handle Scandinavian characters properly
        // First, make sure the connection is using proper charset
        db.query('SET NAMES utf8mb4', (err) => {
            if (err) {
                console.error('Error setting charset:', err);
                return res.status(500).json({ error: 'Error setting database charset' });
            }
            
            // Now insert the post with the proper encoding
            const query = `INSERT INTO posts (beat_id, author_id, title, content, post_type) VALUES (?, ?, ?, ?, ?)`;
            const params = [beatId, authorId, title, content, postType || 'player'];

            db.query(query, params, (err, result) => {
                if (err) {
                    console.error('Error creating post:', err);
                    return res.status(500).json({ error: 'Error creating post: ' + err.message });
                }
                
                // Log success message with more details
                console.log(`Post created successfully - ID: ${result.insertId}, Beat: ${beatId}, Author: ${authorId}`);
                
                // If archiveChapter is true, archive the chapter
                if (archiveChapter) {
                    const chapterId = beatResults[0].chapter_id;
                    const archiveQuery = `
                        UPDATE chapters 
                        SET is_archived = TRUE, 
                            archived_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    `;
                    
                    db.query(archiveQuery, [chapterId], (archiveErr) => {
                        if (archiveErr) {
                            console.error('Error archiving chapter:', archiveErr);
                            // Post was created, so still return success but log the error
                        } else {
                            console.log(`Chapter ${chapterId} archived successfully`);
                        }
                    });
                }
                
                res.status(201).json({ 
                    message: 'Post created successfully', 
                    id: result.insertId,
                    beatId: beatId
                });
            });
        });
    });
});

// Get archived chapters for a game
app.get('/api/games/:gameId/archived-chapters', authenticateToken, (req, res) => {
    const gameId = req.params.gameId;
    
    const query = `
        SELECT id, title, description, sequence_number, archived_at, archived_narrative
        FROM chapters
        WHERE game_id = ? AND is_archived = 1
        ORDER BY sequence_number ASC
    `;
    
    db.query(query, [gameId], (err, results) => {
        if (err) {
            console.error('Error fetching archived chapters:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(results);
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

// Get user profile
app.get('/api/users/:userId/profile', authenticateToken, (req, res) => {
    const userId = req.params.userId;
    
    // Query to get user info with stats
    const query = `
        SELECT 
            u.id, 
            u.username, 
            u.email,
            u.roles,
            u.is_admin,
            u.created_at,
            u.bio,
            (SELECT COUNT(*) FROM games WHERE JSON_CONTAINS(player_ids, CONCAT('"', u.id, '"')) OR gm_id = u.id) as game_count,
            (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as post_count
        FROM users u
        WHERE u.id = ?
    `;
    
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user profile:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const profile = results[0];
        
        // Don't send email unless it's the user's own profile or admin
        if (req.user.id !== parseInt(userId) && !req.user.is_admin) {
            delete profile.email;
        }
        
        res.json(profile);
    });
});

// Update user profile
app.put('/api/users/:userId/profile', authenticateToken, (req, res) => {
    const userId = req.params.userId;
    
    // Users can only update their own profile
    if (req.user.id !== parseInt(userId) && !req.user.is_admin) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { bio, displayName, emailNotifications, gameInvites } = req.body;
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    
    if (bio !== undefined) {
        updates.push('bio = ?');
        values.push(bio);
    }
    
    if (displayName !== undefined) {
        updates.push('username = ?');
        values.push(displayName);
    }
    
    if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
    }
    
    values.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    
    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error updating profile:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'Profile updated successfully' });
    });
});

// Get user's recent posts
app.get('/api/users/:userId/posts', authenticateToken, (req, res) => {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 10;
    
    const query = `
        SELECT 
            p.id,
            p.title,
            p.content,
            p.created_at,
            p.post_type,
            b.id as beat_id,
            b.title as beat_title,
            c.id as chapter_id,
            c.title as chapter_title,
            g.id as game_id,
            g.name as game_name
        FROM posts p
        JOIN beats b ON p.beat_id = b.id
        JOIN chapters c ON b.chapter_id = c.id
        JOIN games g ON c.game_id = g.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
        LIMIT ?
    `;
    
    db.query(query, [userId, limit], (err, results) => {
        if (err) {
            console.error('Error fetching user posts:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(results);
    });
});

// Change password
app.put('/api/users/:userId/password', authenticateToken, (req, res) => {
    const userId = req.params.userId;
    
    // Users can only change their own password
    if (req.user.id !== parseInt(userId)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Both current and new passwords are required' });
    }
    
    // First verify the current password
    const verifyQuery = 'SELECT password FROM users WHERE id = ?';
    db.query(verifyQuery, [userId], async (err, results) => {
        if (err) {
            console.error('Error verifying password:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const isValidPassword = await bcrypt.compare(currentPassword, results[0].password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        
        // Update password
        const updateQuery = 'UPDATE users SET password = ? WHERE id = ?';
        db.query(updateQuery, [hashedNewPassword, userId], (err, result) => {
            if (err) {
                console.error('Error updating password:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({ message: 'Password updated successfully' });
        });
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

// Add health check endpoint
app.get('/health', (req, res) => {
    // Check database connection status
    let dbStatus = 'unknown';
    
    try {
        if (db && db.state === 'authenticated') {
            dbStatus = 'connected';
        } else {
            dbStatus = 'disconnected';
        }
    } catch (error) {
        dbStatus = 'error: ' + error.message;
    }
    
    res.json({ 
        status: 'ok', 
        message: 'Server is running',
        database: dbStatus
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});
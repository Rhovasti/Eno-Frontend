const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');
const app = express();
const port = 3000;

// Middleware
app.use(bodyParser.json());

// MySQL connection
const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'root', // Adjust as needed
    password: '', // Adjust as needed
    database: 'newform' // Ensure this matches the database name
});

db.connect(err => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database');
});

// Get all games
app.get('/api/games', (req, res) => {
    const query = 'SELECT id, name FROM games';
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Create a new game
app.post('/api/games', (req, res) => {
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
app.get('/api/games/:gameId/chapters', (req, res) => {
    const gameId = req.params.gameId;
    const query = 'SELECT * FROM chapters WHERE game_id = ? ORDER BY sequence_number ASC';

    db.query(query, [gameId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Create a new chapter
app.post('/api/games/:gameId/chapters', (req, res) => {
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
app.get('/api/chapters/:chapterId/beats', (req, res) => {
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

// Create a new beat
app.post('/api/chapters/:chapterId/beats', (req, res) => {
    const chapterId = req.params.chapterId;

    // Get the current max sequence_number
    const getMaxSequenceQuery = 'SELECT MAX(sequence_number) AS max_sequence FROM beats WHERE chapter_id = ?';

    db.query(getMaxSequenceQuery, [chapterId], (err, results) => {
        if (err) {
            console.error('Error fetching max sequence number:', err);
            return res.status(500).json({ error: 'Database error' });
        }

        const maxSequence = results[0].max_sequence || 0;
        const newSequenceNumber = maxSequence + 1;

        const insertQuery = 'INSERT INTO beats (chapter_id, sequence_number) VALUES (?, ?)';
        const params = [chapterId, newSequenceNumber];

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
app.get('/api/beats/:beatId/posts', (req, res) => {
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

// Create a new post
app.post('/api/posts', (req, res) => {
    const { beatId, authorId, title, content, postType } = req.body;

    const query = `
        INSERT INTO posts (beat_id, author_id, title, content, post_type)
        VALUES (?, ?, ?, ?, ?)
    `;
    // Use default authorId of 1 if none provided
    const params = [beatId, authorId || 1, title, content, postType];

    db.query(query, params, (err, result) => {
        if (err) {
            console.error('Error creating post:', err);
            return res.status(500).json({ error: 'Error creating post' });
        }
        res.status(201).json({ message: 'Post created successfully', id: result.insertId });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`);
});

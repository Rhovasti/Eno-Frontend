const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');
const DiceEngine = require('./diceEngine');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// JWT Secret - in production this should be in an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'eno-game-platform-secret-key-change-in-production';

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.AI_API_KEY || '',
});

// AI Configuration
const AI_CONFIG = {
    model: process.env.AI_MODEL || 'claude-3-haiku-20240307',
    maxTokensPerRequest: parseInt(process.env.AI_MAX_TOKENS_PER_REQUEST) || 1000,
    maxRequestsPerDay: parseInt(process.env.AI_MAX_REQUESTS_PER_DAY) || 100,
};

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

// In-memory usage tracking (in production, use database)
const aiUsageTracker = new Map();

// Function to track AI usage
function trackAIUsage(userId) {
    const today = new Date().toDateString();
    const key = `${userId}-${today}`;
    const currentUsage = aiUsageTracker.get(key) || 0;
    
    if (currentUsage >= AI_CONFIG.maxRequestsPerDay) {
        return false; // Rate limit exceeded
    }
    
    aiUsageTracker.set(key, currentUsage + 1);
    return true;
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
            
            // Split by semicolon and execute each statement
            const statements = data.split(';').filter(stmt => stmt.trim());
            let completed = 0;
            
            function executeNext() {
                if (completed >= statements.length) {
                    console.log('Database schema initialized successfully');
                    
                    // Add AI usage tracking table
                    db.run(`
                        CREATE TABLE IF NOT EXISTS ai_usage (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL,
                            endpoint TEXT NOT NULL,
                            tokens_used INTEGER NOT NULL,
                            cost_cents INTEGER DEFAULT 0,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users(id)
                        )
                    `, (err) => {
                        if (err) console.error('Error creating ai_usage table:', err);
                        
                        // Add dice rolls table
                        db.run(`
                            CREATE TABLE IF NOT EXISTS dice_rolls (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                post_id INTEGER NOT NULL,
                                user_id INTEGER NOT NULL,
                                dice_notation VARCHAR(50) NOT NULL,
                                dice_results TEXT NOT NULL,
                                modifiers INTEGER DEFAULT 0,
                                total INTEGER NOT NULL,
                                roll_purpose TEXT,
                                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                            )
                        `, (err) => {
                            if (err) console.error('Error creating dice_rolls table:', err);
                            
                            // Create indexes
                            db.run(`CREATE INDEX IF NOT EXISTS idx_dice_rolls_post_id ON dice_rolls(post_id)`, (err) => {
                                if (err) console.error('Error creating index:', err);
                            });
                            db.run(`CREATE INDEX IF NOT EXISTS idx_dice_rolls_user_id ON dice_rolls(user_id)`, (err) => {
                                if (err) console.error('Error creating index:', err);
                            });
                            
                            // Add post images table
                            db.run(`
                                CREATE TABLE IF NOT EXISTS post_images (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    post_id INTEGER NOT NULL,
                                    user_id INTEGER NOT NULL,
                                    prompt TEXT NOT NULL,
                                    negative_prompt TEXT,
                                    image_url TEXT NOT NULL,
                                    thumbnail_url TEXT,
                                    generation_params TEXT,
                                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                                )
                            `, (err) => {
                                if (err) console.error('Error creating post_images table:', err);
                                
                                // Create indexes for post_images
                                db.run(`CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON post_images(post_id)`, (err) => {
                                    if (err) console.error('Error creating index:', err);
                                });
                                db.run(`CREATE INDEX IF NOT EXISTS idx_post_images_user_id ON post_images(user_id)`, (err) => {
                                    if (err) console.error('Error creating index:', err);
                                });
                                
                                resolve();
                            });
                        });
                    });
                    return;
                }
                
                const stmt = statements[completed].trim();
                if (stmt) {
                    db.run(stmt, (err) => {
                        if (err && !err.message.includes('already exists')) {
                            console.error('Error executing statement:', err);
                            console.error('Statement:', stmt);
                        }
                        completed++;
                        executeNext();
                    });
                } else {
                    completed++;
                    executeNext();
                }
            }
            
            executeNext();
        });
    });
}

// Inline schema setup function (fallback)
function setupInlineSchema(db) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Create tables with proper schema
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    is_gm BOOLEAN DEFAULT 0,
                    is_admin BOOLEAN DEFAULT 0,
                    bio TEXT DEFAULT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS games (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    description TEXT,
                    created_by INTEGER,
                    genre TEXT DEFAULT 'fantasy',
                    gm_id INTEGER,
                    max_players INTEGER DEFAULT 5,
                    posting_frequency TEXT DEFAULT 'daily',
                    is_private BOOLEAN DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by) REFERENCES users(id),
                    FOREIGN KEY (gm_id) REFERENCES users(id)
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS chapters (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id INTEGER,
                    title TEXT NOT NULL,
                    sequence_number INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    is_archived BOOLEAN DEFAULT 0,
                    FOREIGN KEY (game_id) REFERENCES games(id)
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS beats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chapter_id INTEGER,
                    sequence_number INTEGER,
                    title TEXT,
                    content TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (chapter_id) REFERENCES chapters(id)
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS posts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    beat_id INTEGER,
                    user_id INTEGER,
                    title TEXT,
                    content TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (beat_id) REFERENCES beats(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS game_players (
                    game_id INTEGER,
                    user_id INTEGER,
                    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (game_id, user_id),
                    FOREIGN KEY (game_id) REFERENCES games(id),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS ai_usage (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    endpoint TEXT NOT NULL,
                    tokens_used INTEGER NOT NULL,
                    cost_cents INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS dice_rolls (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    post_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    dice_notation VARCHAR(50) NOT NULL,
                    dice_results TEXT NOT NULL,
                    modifiers INTEGER DEFAULT 0,
                    total INTEGER NOT NULL,
                    roll_purpose TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS post_images (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    post_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    prompt TEXT NOT NULL,
                    negative_prompt TEXT,
                    image_url TEXT NOT NULL,
                    thumbnail_url TEXT,
                    generation_params TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS game_outlines (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id INTEGER NOT NULL,
                    outline_data TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_by INTEGER NOT NULL,
                    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
                    FOREIGN KEY (created_by) REFERENCES users(id)
                )
            `);

            // AI GM tables
            db.run(`
                CREATE TABLE IF NOT EXISTS ai_gm_profiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    personality_traits TEXT NOT NULL,
                    response_style TEXT NOT NULL,
                    game_genres TEXT NOT NULL,
                    difficulty_level TEXT DEFAULT 'medium',
                    icon TEXT DEFAULT '🤖',
                    is_active BOOLEAN DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS player_game_requests (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    player_id INTEGER NOT NULL,
                    ai_gm_profile_id INTEGER NOT NULL,
                    game_title TEXT NOT NULL,
                    game_description TEXT NOT NULL,
                    genre TEXT NOT NULL,
                    theme TEXT,
                    max_players INTEGER DEFAULT 1,
                    status TEXT DEFAULT 'pending',
                    game_id INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    approved_at DATETIME,
                    FOREIGN KEY (player_id) REFERENCES users(id),
                    FOREIGN KEY (ai_gm_profile_id) REFERENCES ai_gm_profiles(id),
                    FOREIGN KEY (game_id) REFERENCES games(id)
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS ai_gm_responses (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id INTEGER NOT NULL,
                    beat_id INTEGER NOT NULL,
                    trigger_post_id INTEGER,
                    response_content TEXT,
                    response_type TEXT DEFAULT 'narrative',
                    scheduled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    processed_at DATETIME,
                    status TEXT DEFAULT 'pending',
                    FOREIGN KEY (game_id) REFERENCES games(id),
                    FOREIGN KEY (beat_id) REFERENCES beats(id),
                    FOREIGN KEY (trigger_post_id) REFERENCES posts(id)
                )
            `);

            // Add AI GM columns to games table if they don't exist
            db.run(`ALTER TABLE games ADD COLUMN is_ai_gm BOOLEAN DEFAULT 0`);
            db.run(`ALTER TABLE games ADD COLUMN ai_gm_profile_id INTEGER REFERENCES ai_gm_profiles(id)`);

            // Insert default AI GM profiles
            db.get(`SELECT COUNT(*) as count FROM ai_gm_profiles`, (err, row) => {
                if (!err && row && row.count === 0) {
                    const profiles = [
                        {
                            name: 'Klassinen Tarinankertoja',
                            description: 'Perinteinen GM joka keskittyy eeppisiin seikkailuihin ja sankaritarinoihin',
                            personality_traits: '["fair", "encouraging", "descriptive", "traditional"]',
                            response_style: 'Kuvaileva ja innostava, antaa pelaajille tilaa loistaa',
                            game_genres: '["fantasy", "adventure", "heroic"]',
                            icon: '🧙‍♂️'
                        },
                        {
                            name: 'Synkkä Salaisuuksien Vartija',
                            description: 'Mysteerien ja kauhun mestari, pitää pelaajat jännityksessä',
                            personality_traits: '["mysterious", "atmospheric", "challenging", "cryptic"]',
                            response_style: 'Arvoituksellinen ja tunnelmallinen, ei paljasta liikaa kerralla',
                            game_genres: '["horror", "mystery", "thriller"]',
                            icon: '🕵️',
                            difficulty_level: 'hard'
                        },
                        {
                            name: 'Humoristinen Seikkailija',
                            description: 'Kevytmielinen GM joka tuo huumoria peliin',
                            personality_traits: '["funny", "lighthearted", "creative", "spontaneous"]',
                            response_style: 'Leikkisä ja yllättävä, ei ota asioita liian vakavasti',
                            game_genres: '["comedy", "adventure", "fantasy"]',
                            icon: '🤡',
                            difficulty_level: 'easy'
                        },
                        {
                            name: 'Taktinen Strategi',
                            description: 'Keskittyy haastaviin taisteluihin ja strategiseen pelaamiseen',
                            personality_traits: '["analytical", "fair", "challenging", "detailed"]',
                            response_style: 'Tarkka ja yksityiskohtainen, antaa selkeät haasteet',
                            game_genres: '["strategy", "war", "scifi"]',
                            icon: '♟️',
                            difficulty_level: 'hard'
                        },
                        {
                            name: 'Improvisaation Mestari',
                            description: 'Mukautuu pelaajien valintoihin ja luo tarinan lennossa',
                            personality_traits: '["adaptive", "creative", "responsive", "collaborative"]',
                            response_style: 'Joustava ja pelaajavetoinen, "kyllä, ja..." -mentaliteetti',
                            game_genres: '["any"]',
                            icon: '🎭'
                        }
                    ];

                    profiles.forEach(profile => {
                        db.run(
                            `INSERT INTO ai_gm_profiles (name, description, personality_traits, response_style, game_genres, icon, difficulty_level) 
                             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                            [
                                profile.name,
                                profile.description,
                                profile.personality_traits,
                                profile.response_style,
                                profile.game_genres,
                                profile.icon,
                                profile.difficulty_level || 'medium'
                            ]
                        );
                    });
                    console.log('Default AI GM profiles inserted');
                }
            });

            // Final callback
            setTimeout(() => {
                console.log('Database schema initialized successfully (inline)');
                resolve();
            }, 1000);
        });
    });
}

// Initialize database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase(db).catch(console.error);
    }
});

// Authentication middleware
function authenticateToken(req, res, next) {
    const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid token.' });
        }
        req.user = user;
        next();
    });
}

// GM authorization middleware
function requireGM(req, res, next) {
    if (!req.user.is_gm && !req.user.is_admin) {
        return res.status(403).json({ error: 'GM privileges required' });
    }
    next();
}

// AI Endpoints

// Generate game description
app.post('/api/ai/generate-game-description', authenticateToken, requireGM, async (req, res) => {
    try {
        // Check rate limiting
        if (!trackAIUsage(req.user.id)) {
            return res.status(429).json({ error: 'Daily AI usage limit exceeded' });
        }

        const { genre, theme, keywords, targetAudience } = req.body;

        if (!genre || !theme) {
            return res.status(400).json({ error: 'Genre and theme are required' });
        }

        // Validate AI API key
        if (!process.env.AI_API_KEY) {
            return res.status(500).json({ error: 'AI service not configured' });
        }

        const prompt = `Generate a compelling game description for a ${genre} role-playing game with themes of ${theme}. 
${keywords && keywords.length > 0 ? `Include elements of: ${keywords.join(', ')}.` : ''}
${targetAudience ? `The game should appeal to ${targetAudience}.` : ''}
The description should be engaging, set the tone and atmosphere, and give potential players a clear idea of what to expect.
Maximum 200 words. Write in a captivating style that draws players in.`;

        const message = await anthropic.messages.create({
            model: AI_CONFIG.model,
            max_tokens: AI_CONFIG.maxTokensPerRequest,
            temperature: 0.7,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });

        const generatedText = message.content[0].text;
        
        // Log usage to database
        db.run(
            `INSERT INTO ai_usage (user_id, endpoint, tokens_used) VALUES (?, ?, ?)`,
            [req.user.id, 'generate-game-description', message.usage.output_tokens],
            (err) => {
                if (err) console.error('Error logging AI usage:', err);
            }
        );

        res.json({ 
            content: generatedText,
            tokens_used: message.usage.output_tokens
        });

    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({ error: 'Failed to generate content' });
    }
});

// Generate scene description
app.post('/api/ai/generate-scene', authenticateToken, requireGM, async (req, res) => {
    try {
        // Check rate limiting
        if (!trackAIUsage(req.user.id)) {
            return res.status(429).json({ error: 'Daily AI usage limit exceeded' });
        }

        const { briefDescription, previousScene, tone, gameContext } = req.body;

        if (!briefDescription) {
            return res.status(400).json({ error: 'Brief description is required' });
        }

        // Validate AI API key
        if (!process.env.AI_API_KEY) {
            return res.status(500).json({ error: 'AI service not configured' });
        }

        const prompt = `Enhance this scene description for a role-playing game:
Original: ${briefDescription}
${previousScene ? `Previous scene: ${previousScene}` : ''}
${tone ? `Tone: ${tone}` : 'Tone: Adventurous and engaging'}
${gameContext ? `Game context: ${gameContext}` : ''}

Add vivid sensory details, atmosphere, and environmental elements while maintaining the core events. 
Make it immersive and engaging for players. Maximum 300 words.`;

        const message = await anthropic.messages.create({
            model: AI_CONFIG.model,
            max_tokens: AI_CONFIG.maxTokensPerRequest,
            temperature: 0.8,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });

        const generatedText = message.content[0].text;
        
        // Log usage to database
        db.run(
            `INSERT INTO ai_usage (user_id, endpoint, tokens_used) VALUES (?, ?, ?)`,
            [req.user.id, 'generate-scene', message.usage.output_tokens],
            (err) => {
                if (err) console.error('Error logging AI usage:', err);
            }
        );

        res.json({ 
            content: generatedText,
            tokens_used: message.usage.output_tokens
        });

    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({ error: 'Failed to generate content' });
    }
});

// Enhance text
app.post('/api/ai/enhance-text', authenticateToken, requireGM, async (req, res) => {
    try {
        // Check rate limiting
        if (!trackAIUsage(req.user.id)) {
            return res.status(429).json({ error: 'Daily AI usage limit exceeded' });
        }

        const { text, enhancementType, context } = req.body;

        if (!text || !enhancementType) {
            return res.status(400).json({ error: 'Text and enhancement type are required' });
        }

        // Validate AI API key
        if (!process.env.AI_API_KEY) {
            return res.status(500).json({ error: 'AI service not configured' });
        }

        let prompt = '';
        switch (enhancementType) {
            case 'expand':
                prompt = `Expand and enhance this text with more detail and description:\n${text}\n${context ? `Context: ${context}` : ''}\nMaintain the original meaning while adding depth.`;
                break;
            case 'clarify':
                prompt = `Rewrite this text to be clearer and more concise:\n${text}\n${context ? `Context: ${context}` : ''}\nMaintain the original meaning.`;
                break;
            case 'dramatic':
                prompt = `Rewrite this text to be more dramatic and engaging:\n${text}\n${context ? `Context: ${context}` : ''}\nAdd tension and emotion.`;
                break;
            default:
                prompt = `Improve this text:\n${text}\n${context ? `Context: ${context}` : ''}`;
        }

        const message = await anthropic.messages.create({
            model: AI_CONFIG.model,
            max_tokens: AI_CONFIG.maxTokensPerRequest,
            temperature: 0.7,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });

        const generatedText = message.content[0].text;
        
        // Log usage to database
        db.run(
            `INSERT INTO ai_usage (user_id, endpoint, tokens_used) VALUES (?, ?, ?)`,
            [req.user.id, 'enhance-text', message.usage.output_tokens],
            (err) => {
                if (err) console.error('Error logging AI usage:', err);
            }
        );

        res.json({ 
            content: generatedText,
            tokens_used: message.usage.output_tokens
        });

    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({ error: 'Failed to enhance text' });
    }
});

// Get AI usage stats
app.get('/api/ai/usage', authenticateToken, (req, res) => {
    const today = new Date().toDateString();
    const key = `${req.user.id}-${today}`;
    const usageToday = aiUsageTracker.get(key) || 0;
    
    res.json({
        used_today: usageToday,
        limit_per_day: AI_CONFIG.maxRequestsPerDay,
        remaining: AI_CONFIG.maxRequestsPerDay - usageToday
    });
});

// Generate first chapter and description
app.post('/api/ai/generate-first-chapter', authenticateToken, requireGM, async (req, res) => {
    try {
        // Check rate limiting
        if (!trackAIUsage(req.user.id)) {
            return res.status(429).json({ error: 'Daily AI usage limit exceeded' });
        }

        const { gameId, gameName, gameDescription, genre } = req.body;

        if (!gameId || !gameName || !gameDescription) {
            return res.status(400).json({ error: 'Game ID, name, and description are required' });
        }

        // Validate AI API key
        if (!process.env.AI_API_KEY) {
            return res.status(500).json({ error: 'AI service not configured' });
        }

        const prompt = `Based on this ${genre || 'role-playing'} game:
Title: ${gameName}
Description: ${gameDescription}

Generate an engaging first chapter that:
1. Sets the stage for the adventure
2. Introduces the initial setting and atmosphere
3. Provides hooks for player characters to get involved
4. Leaves room for player agency and choices

Provide:
- Chapter Title (max 100 characters)
- Chapter Description (200-300 words)

Format your response as:
TITLE: [chapter title]
DESCRIPTION: [chapter description]`;

        const message = await anthropic.messages.create({
            model: AI_CONFIG.model,
            max_tokens: AI_CONFIG.maxTokensPerRequest,
            temperature: 0.8,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });

        const generatedText = message.content[0].text;
        
        // Parse the response
        const titleMatch = generatedText.match(/TITLE:\s*(.+)/);
        const descriptionMatch = generatedText.match(/DESCRIPTION:\s*([\s\S]+)/);
        
        if (!titleMatch || !descriptionMatch) {
            throw new Error('Failed to parse AI response');
        }

        const chapterTitle = titleMatch[1].trim();
        const chapterDescription = descriptionMatch[1].trim();

        // Log usage to database
        db.run(
            `INSERT INTO ai_usage (user_id, endpoint, tokens_used) VALUES (?, ?, ?)`,
            [req.user.id, 'generate-first-chapter', message.usage.output_tokens],
            (err) => {
                if (err) console.error('Error logging AI usage:', err);
            }
        );

        res.json({ 
            title: chapterTitle,
            description: chapterDescription,
            tokens_used: message.usage.output_tokens
        });

    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({ error: 'Failed to generate chapter' });
    }
});

// Generate story arc with multiple chapters
app.post('/api/ai/generate-story-arc', authenticateToken, requireGM, async (req, res) => {
    try {
        // Check rate limiting (this uses more tokens, so count as 3 requests)
        if (!trackAIUsage(req.user.id) || !trackAIUsage(req.user.id) || !trackAIUsage(req.user.id)) {
            return res.status(429).json({ error: 'Daily AI usage limit exceeded' });
        }

        const { gameId, gameName, gameDescription, genre, numberOfChapters = 5 } = req.body;

        if (!gameId || !gameName || !gameDescription) {
            return res.status(400).json({ error: 'Game ID, name, and description are required' });
        }

        if (numberOfChapters < 3 || numberOfChapters > 10) {
            return res.status(400).json({ error: 'Number of chapters must be between 3 and 10' });
        }

        // Validate AI API key
        if (!process.env.AI_API_KEY) {
            return res.status(500).json({ error: 'AI service not configured' });
        }

        const prompt = `Create a compelling story arc for this ${genre || 'role-playing'} game:
Title: ${gameName}
Description: ${gameDescription}

Generate ${numberOfChapters} connected chapters that form a complete narrative arc:
- Each chapter should build upon the previous ones
- Include rising action, climax, and resolution
- Leave room for player choices and agency
- Each chapter should have meaningful stakes and objectives

For each chapter provide:
- Title (max 100 characters)
- Brief Description (100-150 words)
- Key objectives or themes

Format your response as:
CHAPTER 1:
TITLE: [title]
DESCRIPTION: [description]

CHAPTER 2:
TITLE: [title]
DESCRIPTION: [description]

[Continue for all ${numberOfChapters} chapters]`;

        const message = await anthropic.messages.create({
            model: AI_CONFIG.model,
            max_tokens: AI_CONFIG.maxTokensPerRequest * 2, // Allow more tokens for multiple chapters
            temperature: 0.8,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });

        const generatedText = message.content[0].text;
        
        // Parse the chapters
        const chapters = [];
        const chapterRegex = /CHAPTER\s+\d+:\s*\nTITLE:\s*(.+)\s*\nDESCRIPTION:\s*([\s\S]+?)(?=\n\nCHAPTER|$)/gi;
        let match;

        while ((match = chapterRegex.exec(generatedText)) !== null) {
            chapters.push({
                title: match[1].trim(),
                description: match[2].trim()
            });
        }

        if (chapters.length === 0) {
            throw new Error('Failed to parse AI response');
        }

        // Log usage to database
        db.run(
            `INSERT INTO ai_usage (user_id, endpoint, tokens_used) VALUES (?, ?, ?)`,
            [req.user.id, 'generate-story-arc', message.usage.output_tokens],
            (err) => {
                if (err) console.error('Error logging AI usage:', err);
            }
        );

        res.json({ 
            chapters: chapters,
            tokens_used: message.usage.output_tokens
        });

    } catch (error) {
        console.error('AI generation error:', error);
        res.status(500).json({ error: 'Failed to generate story arc' });
    }
});

// Copy all existing endpoints from server_sqlite_new.js
// (Authentication, User management, Games, Chapters, Beats, Posts endpoints)

// User registration
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`,
            [username, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE constraint failed')) {
                        return res.status(409).json({ error: 'Username or email already exists' });
                    }
                    console.error('Registration error:', err);
                    return res.status(500).json({ error: 'Registration failed' });
                }

                const token = jwt.sign(
                    { id: this.lastID, username, is_gm: false, is_admin: false },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                res.cookie('token', token, { httpOnly: true, maxAge: 86400000 });
                res.status(201).json({ 
                    message: 'User registered successfully',
                    user: { id: this.lastID, username, email }
                });
            }
        );
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// User login
app.post('/api/login', async (req, res) => {
    const { username, email, password } = req.body;
    const loginIdentifier = username || email;

    if (!loginIdentifier || !password) {
        return res.status(400).json({ error: 'Username/email and password are required' });
    }

    db.get(
        `SELECT * FROM users WHERE username = ? OR email = ?`,
        [loginIdentifier, loginIdentifier],
        async (err, user) => {
            if (err) {
                console.error('Login error:', err);
                return res.status(500).json({ error: 'Login failed' });
            }

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            try {
                const validPassword = await bcrypt.compare(password, user.password);
                if (!validPassword) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                const token = jwt.sign(
                    { 
                        id: user.id, 
                        username: user.username, 
                        is_gm: user.is_gm || false,
                        is_admin: user.is_admin || false 
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );

                res.cookie('token', token, { httpOnly: true, maxAge: 86400000 });
                res.json({ 
                    message: 'Login successful',
                    user: { 
                        id: user.id, 
                        username: user.username,
                        email: user.email,
                        roles: user.roles,
                        is_gm: user.is_gm || false,
                        is_admin: user.is_admin || false
                    }
                });
            } catch (error) {
                console.error('Login error:', error);
                res.status(500).json({ error: 'Login failed' });
            }
        }
    );
});

// Logout
app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logout successful' });
});

// Get current user
app.get('/api/me', authenticateToken, (req, res) => {
    db.get(
        `SELECT id, username, email, is_gm, is_admin, bio FROM users WHERE id = ?`,
        [req.user.id],
        (err, user) => {
            if (err) {
                console.error('Error fetching user:', err);
                return res.status(500).json({ error: 'Failed to fetch user data' });
            }
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            res.json(user);
        }
    );
});

// Update user profile
app.put('/api/users/:userId/profile', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    
    // Users can only update their own profile unless they're admin
    if (req.user.id !== userId && !req.user.is_admin) {
        return res.status(403).json({ error: 'Not authorized to update this profile' });
    }
    
    const { bio } = req.body;
    
    db.run(
        `UPDATE users SET bio = ? WHERE id = ?`,
        [bio, userId],
        function(err) {
            if (err) {
                console.error('Error updating profile:', err);
                return res.status(500).json({ error: 'Failed to update profile' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            res.json({ message: 'Profile updated successfully' });
        }
    );
});

// Change password
app.put('/api/users/:userId/password', authenticateToken, async (req, res) => {
    const userId = parseInt(req.params.userId);
    
    // Users can only change their own password
    if (req.user.id !== userId) {
        return res.status(403).json({ error: 'Not authorized to change this password' });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new passwords are required' });
    }
    
    // Verify current password
    db.get(
        `SELECT password FROM users WHERE id = ?`,
        [userId],
        async (err, user) => {
            if (err || !user) {
                return res.status(404).json({ error: 'User not found' });
            }
            
            try {
                const validPassword = await bcrypt.compare(currentPassword, user.password);
                if (!validPassword) {
                    return res.status(401).json({ error: 'Current password is incorrect' });
                }
                
                // Hash new password
                const hashedPassword = await bcrypt.hash(newPassword, 10);
                
                // Update password
                db.run(
                    `UPDATE users SET password = ? WHERE id = ?`,
                    [hashedPassword, userId],
                    function(err) {
                        if (err) {
                            console.error('Error updating password:', err);
                            return res.status(500).json({ error: 'Failed to update password' });
                        }
                        
                        res.json({ message: 'Password updated successfully' });
                    }
                );
            } catch (error) {
                console.error('Password update error:', error);
                res.status(500).json({ error: 'Failed to update password' });
            }
        }
    );
});

// Get user statistics
app.get('/api/users/:userId/stats', authenticateToken, (req, res) => {
    const userId = parseInt(req.params.userId);
    
    db.serialize(() => {
        // Get user basic info
        db.get(
            `SELECT username, created_at FROM users WHERE id = ?`,
            [userId],
            (err, user) => {
                if (err || !user) {
                    return res.status(404).json({ error: 'User not found' });
                }
                
                // Get games created (for GMs)
                db.get(
                    `SELECT COUNT(*) as games_created FROM games WHERE created_by = ?`,
                    [userId],
                    (err, gameCount) => {
                        if (err) console.error('Error getting game count:', err);
                        
                        // Get posts count
                        db.get(
                            `SELECT COUNT(*) as total_posts FROM posts WHERE user_id = ?`,
                            [userId],
                            (err, postCount) => {
                                if (err) console.error('Error getting post count:', err);
                                
                                // Get games played in
                                db.get(
                                    `SELECT COUNT(*) as games_played FROM game_players WHERE user_id = ?`,
                                    [userId],
                                    (err, gamesPlayed) => {
                                        if (err) console.error('Error getting games played:', err);
                                        
                                        res.json({
                                            username: user.username,
                                            joined_date: user.created_at,
                                            games_created: gameCount?.games_created || 0,
                                            games_played: gamesPlayed?.games_played || 0,
                                            total_posts: postCount?.total_posts || 0
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    });
});

// Get all users (admin only)
app.get('/api/users', authenticateToken, (req, res) => {
    // Optional: Add admin check here
    
    db.all(
        `SELECT id, username, email, is_gm, is_admin, created_at FROM users`,
        [],
        (err, users) => {
            if (err) {
                console.error('Error fetching users:', err);
                return res.status(500).json({ error: 'Failed to fetch users' });
            }
            res.json(users);
        }
    );
});

// Create game
app.post('/api/games', authenticateToken, requireGM, (req, res) => {
    const { title, description, genre, maxPlayers, postingFrequency, isPrivate } = req.body;
    
    if (!title) {
        return res.status(400).json({ error: 'Game title is required' });
    }
    
    db.run(
        `INSERT INTO games (title, description, created_by, genre, gm_id, max_players, posting_frequency, is_private) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description || '', req.user.id, genre || 'fantasy', req.user.id, 
         maxPlayers || 5, postingFrequency || 'daily', isPrivate ? 1 : 0],
        function(err) {
            if (err) {
                console.error('Error creating game:', err);
                return res.status(500).json({ error: 'Failed to create game' });
            }
            
            // Add GM as a player
            db.run(
                `INSERT INTO game_players (game_id, user_id) VALUES (?, ?)`,
                [this.lastID, req.user.id],
                (err) => {
                    if (err) console.error('Error adding GM as player:', err);
                }
            );
            
            res.status(201).json({ 
                id: this.lastID,
                message: 'Game created successfully' 
            });
        }
    );
});

// Get all games (public endpoint for game listing)
app.get('/api/games', (req, res) => {
    db.all(
        `SELECT g.*, 
         CASE WHEN g.is_ai_gm = 1 THEN 
           (SELECT name FROM ai_gm_profiles WHERE id = g.ai_gm_profile_id)
         ELSE 
           'Admin'
         END as gm_username,
         (SELECT COUNT(*) FROM game_players WHERE game_id = g.id) as player_count,
         g.name as title
         FROM games g
         ORDER BY g.created_at DESC`,
        [],
        (err, games) => {
            if (err) {
                console.error('Error fetching games:', err);
                return res.status(500).json({ error: 'Failed to fetch games' });
            }
            res.json(games);
        }
    );
});

// Get single game
app.get('/api/games/:gameId', (req, res) => {
    const gameId = req.params.gameId;
    
    db.get(
        `SELECT g.*,
         CASE WHEN g.is_ai_gm = 1 THEN 
           (SELECT name FROM ai_gm_profiles WHERE id = g.ai_gm_profile_id)
         ELSE 
           'Admin'
         END as gm_username,
         g.name as title
         FROM games g
         WHERE g.id = ?`,
        [gameId],
        (err, game) => {
            if (err) {
                console.error('Error fetching game:', err);
                return res.status(500).json({ error: 'Failed to fetch game' });
            }
            if (!game) {
                return res.status(404).json({ error: 'Game not found' });
            }
            res.json(game);
        }
    );
});

// Create chapter
app.post('/api/games/:gameId/chapters', authenticateToken, requireGM, (req, res) => {
    const { title } = req.body;
    const gameId = req.params.gameId;
    
    if (!title) {
        return res.status(400).json({ error: 'Chapter title is required' });
    }
    
    // Get the next sequence number
    db.get(
        `SELECT MAX(sequence_number) as max_seq FROM chapters WHERE game_id = ?`,
        [gameId],
        (err, result) => {
            if (err) {
                console.error('Error getting sequence number:', err);
                return res.status(500).json({ error: 'Failed to create chapter' });
            }
            
            const nextSeq = (result.max_seq || 0) + 1;
            
            db.run(
                `INSERT INTO chapters (game_id, title, sequence_number) VALUES (?, ?, ?)`,
                [gameId, title, nextSeq],
                function(err) {
                    if (err) {
                        console.error('Error creating chapter:', err);
                        return res.status(500).json({ error: 'Failed to create chapter' });
                    }
                    
                    res.status(201).json({ 
                        id: this.lastID,
                        message: 'Chapter created successfully' 
                    });
                }
            );
        }
    );
});

// Get chapters for a game
app.get('/api/games/:gameId/chapters', (req, res) => {
    const gameId = req.params.gameId;
    
    db.all(
        `SELECT * FROM chapters 
         WHERE game_id = ? 
         ORDER BY sequence_number`,
        [gameId],
        (err, chapters) => {
            if (err) {
                console.error('Error fetching chapters:', err);
                return res.status(500).json({ error: 'Failed to fetch chapters' });
            }
            res.json(chapters);
        }
    );
});

// Get game outline
app.get('/api/games/:gameId/outline', authenticateToken, (req, res) => {
    const gameId = req.params.gameId;
    
    // Verify user is GM of this game
    db.get(
        `SELECT created_by FROM games WHERE id = ?`,
        [gameId],
        (err, game) => {
            if (err || !game) {
                return res.status(404).json({ error: 'Game not found' });
            }
            
            if (game.created_by !== req.user.id && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Get outline
            db.get(
                `SELECT * FROM game_outlines WHERE game_id = ? ORDER BY updated_at DESC LIMIT 1`,
                [gameId],
                (err, outline) => {
                    if (err) {
                        console.error('Error fetching outline:', err);
                        return res.status(500).json({ error: 'Failed to fetch outline' });
                    }
                    
                    if (!outline) {
                        return res.status(404).json({ error: 'No outline found' });
                    }
                    
                    res.json(outline);
                }
            );
        }
    );
});

// Save/update game outline
app.post('/api/games/:gameId/outline', authenticateToken, requireGM, (req, res) => {
    const gameId = req.params.gameId;
    const { outline_data } = req.body;
    
    if (!outline_data) {
        return res.status(400).json({ error: 'Outline data required' });
    }
    
    // Verify user is GM of this game
    db.get(
        `SELECT created_by FROM games WHERE id = ?`,
        [gameId],
        (err, game) => {
            if (err || !game) {
                return res.status(404).json({ error: 'Game not found' });
            }
            
            if (game.created_by !== req.user.id && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Check if outline exists
            db.get(
                `SELECT id FROM game_outlines WHERE game_id = ?`,
                [gameId],
                (err, existing) => {
                    if (err) {
                        console.error('Error checking outline:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    if (existing) {
                        // Update existing outline
                        db.run(
                            `UPDATE game_outlines 
                             SET outline_data = ?, updated_at = CURRENT_TIMESTAMP 
                             WHERE game_id = ?`,
                            [outline_data, gameId],
                            function(err) {
                                if (err) {
                                    console.error('Error updating outline:', err);
                                    return res.status(500).json({ error: 'Failed to update outline' });
                                }
                                res.json({ message: 'Outline updated successfully' });
                            }
                        );
                    } else {
                        // Create new outline
                        db.run(
                            `INSERT INTO game_outlines (game_id, outline_data, created_by) 
                             VALUES (?, ?, ?)`,
                            [gameId, outline_data, req.user.id],
                            function(err) {
                                if (err) {
                                    console.error('Error creating outline:', err);
                                    return res.status(500).json({ error: 'Failed to create outline' });
                                }
                                res.json({ message: 'Outline created successfully', id: this.lastID });
                            }
                        );
                    }
                }
            );
        }
    );
});

// Get recent posts for a game
app.get('/api/games/:gameId/recent-posts', authenticateToken, (req, res) => {
    const gameId = req.params.gameId;
    const limit = parseInt(req.query.limit) || 10;
    
    db.all(
        `SELECT p.*, u.username as author_name, c.title as chapter_title, b.title as beat_title
         FROM posts p
         JOIN users u ON p.author_id = u.id
         JOIN beats b ON p.beat_id = b.id
         JOIN chapters c ON b.chapter_id = c.id
         WHERE c.game_id = ?
         ORDER BY p.created_at DESC
         LIMIT ?`,
        [gameId, limit],
        (err, posts) => {
            if (err) {
                console.error('Error fetching recent posts:', err);
                return res.status(500).json({ error: 'Failed to fetch posts' });
            }
            res.json(posts);
        }
    );
});

// Update game settings
app.put('/api/games/:gameId', authenticateToken, requireGM, (req, res) => {
    const gameId = req.params.gameId;
    const { title, description, max_players, status } = req.body;
    
    // Verify user is GM of this game
    db.get(
        `SELECT created_by FROM games WHERE id = ?`,
        [gameId],
        (err, game) => {
            if (err || !game) {
                return res.status(404).json({ error: 'Game not found' });
            }
            
            if (game.created_by !== req.user.id && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            // Build update query dynamically
            const updates = [];
            const values = [];
            
            if (title !== undefined) {
                updates.push('title = ?');
                values.push(title);
            }
            if (description !== undefined) {
                updates.push('description = ?');
                values.push(description);
            }
            if (max_players !== undefined) {
                updates.push('max_players = ?');
                values.push(max_players);
            }
            if (status !== undefined) {
                updates.push('status = ?');
                values.push(status);
            }
            
            if (updates.length === 0) {
                return res.status(400).json({ error: 'No fields to update' });
            }
            
            values.push(gameId);
            
            db.run(
                `UPDATE games SET ${updates.join(', ')} WHERE id = ?`,
                values,
                function(err) {
                    if (err) {
                        console.error('Error updating game:', err);
                        return res.status(500).json({ error: 'Failed to update game' });
                    }
                    res.json({ message: 'Game updated successfully' });
                }
            );
        }
    );
});

// Archive/unarchive chapter
app.put('/api/chapters/:chapterId/archive', authenticateToken, requireGM, (req, res) => {
    const chapterId = req.params.chapterId;
    const { is_archived } = req.body;
    
    db.run(
        `UPDATE chapters SET is_archived = ? WHERE id = ?`,
        [is_archived ? 1 : 0, chapterId],
        function(err) {
            if (err) {
                console.error('Error archiving chapter:', err);
                return res.status(500).json({ error: 'Failed to archive chapter' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Chapter not found' });
            }
            
            res.json({ message: `Chapter ${is_archived ? 'archived' : 'unarchived'} successfully` });
        }
    );
});

// AI GM Endpoints

// Get AI GM profiles
app.get('/api/ai-gm-profiles', (req, res) => {
    db.all(
        `SELECT * FROM ai_gm_profiles WHERE is_active = 1`,
        [],
        (err, profiles) => {
            if (err) {
                console.error('Error fetching AI GM profiles:', err);
                return res.status(500).json({ error: 'Failed to fetch profiles' });
            }
            res.json(profiles);
        }
    );
});

// Create player game request
app.post('/api/player-game-requests', authenticateToken, async (req, res) => {
    console.log('DEBUG: Received request body:', req.body);
    const { ai_gm_profile_id, game_title, game_description, genre, theme, max_players } = req.body;
    const player_id = req.user.id;
    
    console.log('DEBUG: Extracted fields:', { ai_gm_profile_id, game_title, game_description, genre, theme, max_players, player_id });
    
    if (!ai_gm_profile_id || !game_title || !genre) {
        console.log('DEBUG: Missing required fields check failed');
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        // Get AI GM profile
        const profile = await new Promise((resolve, reject) => {
            db.get(
                `SELECT * FROM ai_gm_profiles WHERE id = ?`,
                [ai_gm_profile_id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (!profile) {
            return res.status(404).json({ error: 'AI GM profile not found' });
        }
        
        // Generate game description using AI
        let gameDescription = `${genre} peli`;
        if (process.env.AI_API_KEY && anthropic) {
            try {
                const prompt = `Create a game description for a ${genre} game titled "${game_title}".
${theme ? `Theme: ${theme}` : ''}
The game will be run by an AI GM with these traits: ${profile.personality_traits}
Write an engaging description (max 150 words) that reflects the GM's personality style.`;

                const message = await anthropic.messages.create({
                    model: AI_CONFIG.model,
                    max_tokens: 500,
                    temperature: 0.8,
                    messages: [{ role: 'user', content: prompt }]
                });
                
                gameDescription = message.content[0].text;
            } catch (aiError) {
                console.error('AI generation failed:', aiError);
                gameDescription = `${theme || genre} seikkailu odottaa! AI-pelinjohtaja ${profile.name} vie sinut unohtumattomaan matkaan.`;
            }
        }
        
        // Create the game (owned by admin user id 1)
        db.run(
            `INSERT INTO games (name, description, is_ai_gm, ai_gm_profile_id) 
             VALUES (?, ?, ?, ?)`,
            [game_title, gameDescription, 1, ai_gm_profile_id],
            function(err) {
                if (err) {
                    console.error('DEBUG: Error creating game:', err);
                    console.error('DEBUG: SQL error details:', err.message);
                    return res.status(500).json({ error: 'Failed to create game: ' + err.message });
                }
                
                console.log('DEBUG: Game created successfully with ID:', this.lastID);
                
                const gameId = this.lastID;
                
                // Add player to game
                db.run(
                    `INSERT INTO game_players (game_id, user_id) VALUES (?, ?)`,
                    [gameId, player_id],
                    (err) => {
                        if (err) console.error('Error adding player to game:', err);
                    }
                );
                
                // Create first chapter
                db.run(
                    `INSERT INTO chapters (game_id, title, description, sequence_number) 
                     VALUES (?, ?, ?, ?)`,
                    [gameId, 'Seikkailu alkaa', 'AI-pelinjohtaja valmistelee ensimmäistä lukuasi...', 1],
                    function(err) {
                        if (err) {
                            console.error('Error creating chapter:', err);
                            return res.status(500).json({ error: 'Failed to create chapter' });
                        }
                        
                        const chapterId = this.lastID;
                        
                        // Create first beat
                        db.run(
                            `INSERT INTO beats (chapter_id, title, content, sequence_number) 
                             VALUES (?, ?, ?, ?)`,
                            [chapterId, 'Alku', 'Tarinasi alkaa tästä. Odota AI-pelinjohtajan aloitusviestiä.', 1],
                            async function(err) {
                                if (err) {
                                    console.error('Error creating beat:', err);
                                    return res.status(500).json({ error: 'Failed to create beat' });
                                }
                                
                                const beatId = this.lastID;
                                
                                // Record the game request
                                db.run(
                                    `INSERT INTO player_game_requests 
                                     (player_id, ai_gm_profile_id, game_title, game_description, genre, theme, max_players, status, game_id, approved_at) 
                                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                                    [player_id, ai_gm_profile_id, game_title, gameDescription, genre, theme, max_players, 'approved', gameId],
                                    (err) => {
                                        if (err) console.error('Error recording game request:', err);
                                    }
                                );
                                
                                // Generate AI GM intro message
                                if (process.env.AI_API_KEY && anthropic) {
                                    try {
                                        const introPrompt = `You are an AI Game Master with these personality traits: ${profile.personality_traits}.
Your response style: ${profile.response_style}
Game genre: ${genre}
Game title: ${game_title}
Game description: ${gameDescription}
${theme ? `Theme: ${theme}` : ''}

Create an engaging introduction for this game that:
1. Sets the scene and atmosphere
2. Introduces the starting situation
3. Gives the player 2-3 clear options for their first action
4. Ends with a question about what the player wants to do

Write in Finnish. Maximum 250 words. Be engaging and match your personality style.`;

                                        const introMessage = await anthropic.messages.create({
                                            model: AI_CONFIG.model,
                                            max_tokens: 800,
                                            temperature: 0.9,
                                            messages: [{ role: 'user', content: introPrompt }]
                                        });
                                        
                                        const introContent = introMessage.content[0].text;
                                        
                                        // Save AI intro as the first post
                                        db.run(
                                            `INSERT INTO posts (beat_id, author_id, title, content, post_type) 
                                             VALUES (?, ?, ?, ?, ?)`,
                                            [beatId, 1, 'Pelin alku', introContent, 'gm'],
                                            (err) => {
                                                if (err) console.error('Error saving AI intro:', err);
                                            }
                                        );
                                    } catch (aiError) {
                                        console.error('Failed to generate AI intro:', aiError);
                                        // Create a fallback intro
                                        const fallbackIntro = `Tervetuloa peliin "${game_title}"!\n\n${gameDescription}\n\nAI-pelinjohtajasi ${profile.name} on valmis aloittamaan seikkailusi.\n\nKerro ensin hahmostasi: kuka olet ja miksi olet täällä?`;
                                        
                                        db.run(
                                            `INSERT INTO posts (beat_id, author_id, title, content, type) 
                                             VALUES (?, ?, ?, ?, ?)`,
                                            [beatId, 1, 'Pelin alku', fallbackIntro, 'gm'],
                                            (err) => {
                                                if (err) console.error('Error saving fallback intro:', err);
                                            }
                                        );
                                    }
                                }
                                
                                res.json({ 
                                    success: true, 
                                    game_id: gameId,
                                    chapter_id: chapterId,
                                    beat_id: beatId,
                                    message: 'Peli luotu onnistuneesti! AI-pelinjohtaja valmistelee aloitusviestiä...'
                                });
                            }
                        );
                    }
                );
            }
        );
        
    } catch (error) {
        console.error('Error processing game request:', error);
        res.status(500).json({ error: 'Failed to process game request' });
    }
});

// AI GM response generation for posts
app.post('/api/ai-gm/generate-response', authenticateToken, async (req, res) => {
    const { game_id, beat_id, trigger_post_id } = req.body;
    
    try {
        // Get game and AI GM profile
        const game = await new Promise((resolve, reject) => {
            db.get(
                `SELECT g.*, p.* FROM games g 
                 JOIN ai_gm_profiles p ON g.ai_gm_profile_id = p.id 
                 WHERE g.id = ? AND g.is_ai_gm = 1`,
                [game_id],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                }
            );
        });
        
        if (!game) {
            return res.status(404).json({ error: 'AI GM game not found' });
        }
        
        // Get recent posts for context
        const recentPosts = await new Promise((resolve, reject) => {
            db.all(
                `SELECT p.*, u.username FROM posts p 
                 JOIN users u ON p.author_id = u.id 
                 WHERE p.beat_id = ? 
                 ORDER BY p.created_at DESC 
                 LIMIT 5`,
                [beat_id],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
        
        if (!process.env.AI_API_KEY || !anthropic) {
            return res.status(503).json({ error: 'AI service not available' });
        }
        
        // Build context for AI
        const traits = JSON.parse(game.personality_traits || '[]');
        const context = recentPosts.reverse().map(p => `${p.username}: ${p.content}`).join('\n\n');
        
        const prompt = `You are an AI Game Master with these personality traits: ${traits.join(', ')}.
Your response style: ${game.response_style}
Game genre: ${game.genre}
Game title: ${game.title}
Game description: ${game.description}

Recent game context:
${context}

Respond to the latest player action as the GM. Keep your response engaging and in character.
Write in Finnish. Maximum 200 words.`;

        const message = await anthropic.messages.create({
            model: AI_CONFIG.model,
            max_tokens: 600,
            temperature: 0.9,
            messages: [{ role: 'user', content: prompt }]
        });
        
        const responseContent = message.content[0].text;
        
        // Save AI response as a post
        db.run(
            `INSERT INTO posts (beat_id, author_id, title, content, type) 
             VALUES (?, ?, ?, ?, ?)`,
            [beat_id, 1, 'GM', responseContent, 'gm'],
            function(err) {
                if (err) {
                    console.error('Error saving AI response:', err);
                    return res.status(500).json({ error: 'Failed to save response' });
                }
                
                res.json({
                    success: true,
                    response: responseContent,
                    post_id: this.lastID
                });
            }
        );
        
    } catch (error) {
        console.error('Error generating AI GM response:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

// Create beat
app.post('/api/chapters/:chapterId/beats', authenticateToken, requireGM, (req, res) => {
    const { title, content } = req.body;
    const chapterId = req.params.chapterId;
    
    // Get the next sequence number
    db.get(
        `SELECT MAX(sequence_number) as max_seq FROM beats WHERE chapter_id = ?`,
        [chapterId],
        (err, result) => {
            if (err) {
                console.error('Error getting sequence number:', err);
                return res.status(500).json({ error: 'Failed to create beat' });
            }
            
            const nextSeq = (result.max_seq || 0) + 1;
            
            db.run(
                `INSERT INTO beats (chapter_id, sequence_number, title, content) VALUES (?, ?, ?, ?)`,
                [chapterId, nextSeq, title || '', content || ''],
                function(err) {
                    if (err) {
                        console.error('Error creating beat:', err);
                        return res.status(500).json({ error: 'Failed to create beat' });
                    }
                    
                    res.status(201).json({ 
                        id: this.lastID,
                        message: 'Beat created successfully' 
                    });
                }
            );
        }
    );
});

// Get beats for a chapter (with posts)
app.get('/api/chapters/:chapterId/beats', (req, res) => {
    const chapterId = req.params.chapterId;
    
    db.all(
        `SELECT b.*, p.id as post_id, p.title as post_title, p.content as post_content, 
                p.created_at as post_created_at, p.author_id as post_user_id,
                p.post_type as post_type, u.username as post_username,
                dr.id as dice_roll_id, dr.dice_notation, dr.dice_results, dr.modifiers,
                dr.total as dice_total, dr.roll_purpose
         FROM beats b
         LEFT JOIN posts p ON b.id = p.beat_id
         LEFT JOIN users u ON p.author_id = u.id
         LEFT JOIN dice_rolls dr ON p.id = dr.post_id
         WHERE b.chapter_id = ?
         ORDER BY b.sequence_number`,
        [chapterId],
        (err, rows) => {
            if (err) {
                console.error('Error fetching beats:', err);
                return res.status(500).json({ error: 'Failed to fetch beats' });
            }
            
            // Group posts by beat
            const beatsMap = new Map();
            
            rows.forEach(row => {
                const beatId = row.id;
                
                if (!beatsMap.has(beatId)) {
                    // Create beat object - preserve beat ID!
                    const beat = {
                        id: beatId,  // Use beat ID, not post ID
                        chapter_id: row.chapter_id,
                        sequence_number: row.sequence_number,
                        title: row.title,
                        content: row.content,
                        created_at: row.created_at,
                        posts: []
                    };
                    beatsMap.set(beatId, beat);
                }
                
                // Add post if exists
                if (row.post_id) {
                    const post = {
                        id: row.post_id,
                        title: row.post_title,
                        content: row.post_content,
                        created_at: row.post_created_at,
                        user_id: row.post_user_id,
                        username: row.post_username,
                        post_type: row.post_type
                    };
                    
                    // Add dice roll if exists
                    if (row.dice_roll_id) {
                        post.diceRoll = {
                            id: row.dice_roll_id,
                            notation: row.dice_notation,
                            results: JSON.parse(row.dice_results || '[]'),
                            modifiers: row.modifiers,
                            total: row.dice_total,
                            purpose: row.roll_purpose
                        };
                    }
                    
                    beatsMap.get(beatId).posts.push(post);
                }
            });
            
            const beats = Array.from(beatsMap.values());
            res.json(beats);
        }
    );
});

// Create post
app.post('/api/beats/:beatId/posts', authenticateToken, (req, res) => {
    const { title, content, diceRoll } = req.body;
    const beatId = req.params.beatId;
    
    if (!content) {
        return res.status(400).json({ error: 'Post content is required' });
    }
    
    // Determine post type based on user role
    const postType = req.user.is_gm || req.user.is_admin ? 'gm' : 'player';
    
    db.run(
        `INSERT INTO posts (beat_id, author_id, title, content, post_type) VALUES (?, ?, ?, ?, ?)`,
        [beatId, req.user.id, title || '', content, postType],
        async function(err) {
            if (err) {
                console.error('Error creating post:', err);
                return res.status(500).json({ error: 'Failed to create post' });
            }
            
            const postId = this.lastID;
            
            // Save dice roll if provided
            if (diceRoll) {
                db.run(
                    `INSERT INTO dice_rolls (post_id, user_id, dice_notation, dice_results, modifiers, total, roll_purpose) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        postId,
                        req.user.id,
                        diceRoll.notation,
                        JSON.stringify(diceRoll.rolls),
                        diceRoll.modifier || 0,
                        diceRoll.total,
                        diceRoll.purpose || null
                    ],
                    (err) => {
                        if (err) {
                            console.error('Error saving dice roll:', err);
                        }
                    }
                );
            }
            
            // Check if this is an AI GM game and trigger response
            db.get(
                `SELECT g.*, c.id as chapter_id FROM games g 
                 JOIN chapters c ON c.game_id = g.id 
                 JOIN beats b ON b.chapter_id = c.id 
                 WHERE b.id = ? AND g.is_ai_gm = 1`,
                [beatId],
                async (err, gameInfo) => {
                    if (!err && gameInfo && postType === 'player') {
                        // Trigger AI GM response after a short delay
                        setTimeout(async () => {
                            try {
                                // Get AI GM profile
                                const profile = await new Promise((resolve, reject) => {
                                    db.get(
                                        `SELECT * FROM ai_gm_profiles WHERE id = ?`,
                                        [gameInfo.ai_gm_profile_id],
                                        (err, row) => {
                                            if (err) reject(err);
                                            else resolve(row);
                                        }
                                    );
                                });
                                
                                if (profile && process.env.AI_API_KEY && anthropic) {
                                    // Get recent posts for context
                                    const recentPosts = await new Promise((resolve, reject) => {
                                        db.all(
                                            `SELECT p.*, u.username FROM posts p 
                                             JOIN users u ON p.author_id = u.id 
                                             WHERE p.beat_id = ? 
                                             ORDER BY p.created_at DESC 
                                             LIMIT 5`,
                                            [beatId],
                                            (err, rows) => {
                                                if (err) reject(err);
                                                else resolve(rows);
                                            }
                                        );
                                    });
                                    
                                    const traits = JSON.parse(profile.personality_traits || '[]');
                                    const context = recentPosts.reverse().map(p => `${p.username}: ${p.content}`).join('\n\n');
                                    
                                    const responsePrompt = `You are an AI Game Master with these personality traits: ${traits.join(', ')}.
Your response style: ${profile.response_style}
Game genre: ${gameInfo.genre || 'fantasy'}
Game title: ${gameInfo.title}
Game description: ${gameInfo.description}

Recent game context:
${context}

Respond to the latest player action as the GM. Your response should:
1. React to what the player just did
2. Describe what happens as a result
3. Introduce any new elements or challenges
4. End with a clear prompt for the player's next action

Keep your response engaging and in character.
Write in Finnish. Maximum 200 words.`;

                                    const message = await anthropic.messages.create({
                                        model: AI_CONFIG.model,
                                        max_tokens: 600,
                                        temperature: 0.9,
                                        messages: [{ role: 'user', content: responsePrompt }]
                                    });
                                    
                                    const responseContent = message.content[0].text;
                                    
                                    // Save AI response as a post
                                    db.run(
                                        `INSERT INTO posts (beat_id, author_id, title, content, post_type) 
                                         VALUES (?, ?, ?, ?, ?)`,
                                        [beatId, 1, 'GM', responseContent, 'gm'],
                                        (err) => {
                                            if (err) console.error('Error saving AI response:', err);
                                            else console.log('AI GM response generated for game:', gameInfo.id);
                                        }
                                    );
                                }
                            } catch (error) {
                                console.error('Error generating AI GM response:', error);
                            }
                        }, 3000); // 3 second delay to make it feel more natural
                    }
                }
            );
            
            res.status(201).json({ 
                id: postId,
                message: 'Post created successfully',
                ai_gm_response: 'AI GM will respond shortly...' 
            });
        }
    );
});

// Get dice roll history for a user
app.get('/api/users/:userId/dice-rolls', authenticateToken, (req, res) => {
    const userId = req.params.userId;
    const limit = parseInt(req.query.limit) || 20;
    
    // Check if user is requesting their own data or is admin
    if (req.user.id !== parseInt(userId) && !req.user.is_admin) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    db.all(
        `SELECT dr.*, p.title as post_title, p.content as post_content,
                b.id as beat_id, c.id as chapter_id, c.title as chapter_title,
                g.id as game_id, g.title as game_title
         FROM dice_rolls dr
         JOIN posts p ON dr.post_id = p.id
         JOIN beats b ON p.beat_id = b.id
         JOIN chapters c ON b.chapter_id = c.id
         JOIN games g ON c.game_id = g.id
         WHERE dr.user_id = ?
         ORDER BY dr.created_at DESC
         LIMIT ?`,
        [userId, limit],
        (err, rolls) => {
            if (err) {
                console.error('Error fetching dice roll history:', err);
                return res.status(500).json({ error: 'Failed to fetch dice roll history' });
            }
            
            // Parse dice results
            rolls.forEach(roll => {
                roll.dice_results = JSON.parse(roll.dice_results || '[]');
            });
            
            res.json(rolls);
        }
    );
});

// Initialize Image Service
const ImageService = require('./services/imageService');
const imageService = new ImageService();

// Generate image for post
app.post('/api/posts/:postId/generate-image', authenticateToken, async (req, res) => {
    const { prompt, negativePrompt, style } = req.body;
    const postId = req.params.postId;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // Verify post belongs to user or user is admin
    db.get(
        `SELECT p.*, b.chapter_id, c.game_id 
         FROM posts p
         JOIN beats b ON p.beat_id = b.id
         JOIN chapters c ON b.chapter_id = c.id
         WHERE p.id = ?`,
        [postId],
        async (err, post) => {
            if (err || !post) {
                return res.status(404).json({ error: 'Post not found' });
            }
            
            if (post.author_id !== req.user.id && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied' });
            }
            
            try {
                // Check if Stability API key is configured
                if (!process.env.STABILITY_API_KEY || process.env.STABILITY_API_KEY === 'your-stability-api-key-here') {
                    return res.status(503).json({ error: 'Image generation service not configured' });
                }
                
                // Generate and upload image
                const result = await imageService.generateAndUpload({
                    prompt,
                    gameId: post.game_id,
                    postId: postId,
                    userId: req.user.id
                });
                
                // Save to database
                db.run(
                    `INSERT INTO post_images (post_id, user_id, prompt, negative_prompt, image_url, thumbnail_url, generation_params)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        postId,
                        req.user.id,
                        prompt,
                        negativePrompt || null,
                        result.imageUrl,
                        result.thumbnailUrl,
                        JSON.stringify({ style, ...result.metadata })
                    ],
                    function(err) {
                        if (err) {
                            console.error('Error saving image to database:', err);
                            return res.status(500).json({ error: 'Failed to save image' });
                        }
                        
                        res.json({
                            id: this.lastID,
                            imageUrl: result.imageUrl,
                            thumbnailUrl: result.thumbnailUrl,
                            prompt: prompt
                        });
                    }
                );
            } catch (error) {
                console.error('Image generation error:', error);
                res.status(500).json({ error: 'Failed to generate image: ' + error.message });
            }
        }
    );
});

// Get images for a post
app.get('/api/posts/:postId/images', (req, res) => {
    const postId = req.params.postId;
    
    db.all(
        `SELECT * FROM post_images WHERE post_id = ? ORDER BY created_at DESC`,
        [postId],
        (err, images) => {
            if (err) {
                console.error('Error fetching images:', err);
                return res.status(500).json({ error: 'Failed to fetch images' });
            }
            
            // Parse generation params
            images.forEach(img => {
                if (img.generation_params) {
                    img.generation_params = JSON.parse(img.generation_params);
                }
            });
            
            res.json(images);
        }
    );
});

// Test S3 connection endpoint (admin only)
app.get('/api/test-s3', authenticateToken, async (req, res) => {
    // Check if user is admin
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    try {
        const connected = await imageService.testS3Connection();
        res.json({ connected, bucket: process.env.AWS_BUCKET_NAME });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Serve HTML pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

app.get('/hml/:page', (req, res) => {
    const page = req.params.page;
    res.sendFile(path.join(__dirname, `../hml/${page}`));
});

app.listen(port, () => {
    console.log(`Server with AI features running on http://localhost:${port}`);
    console.log('AI Service:', process.env.AI_SERVICE || 'not configured');
    console.log('AI Model:', AI_CONFIG.model);
});
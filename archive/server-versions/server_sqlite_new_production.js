const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const ImageService = require('./services/imageService');
const AudioService = require('./services/audioService');
const AsyncGameManager = require('./services/AsyncGameManager');
const Anthropic = require('@anthropic-ai/sdk');
const app = express();
const port = process.env.PORT || 3000;

// JWT Secret - in production this should be in an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'eno-game-platform-secret-key-change-in-production';

// Define user roles and their permissions
const USER_ROLES = {
    ADMIN: 'admin',
    GM: 'gm',
    EDITOR: 'editor',
    PLAYER: 'player',
    ANONYMOUS: 'anonymous'
};

// Define permissions for each role
const ROLE_PERMISSIONS = {
    [USER_ROLES.ADMIN]: ['all'], // Can do everything
    [USER_ROLES.GM]: ['create_game', 'manage_game', 'create_post', 'edit_own_post', 'create_beat', 'create_chapter', 'archive_chapter', 'view_all'],
    [USER_ROLES.EDITOR]: ['edit_wiki', 'create_wiki', 'edit_lore', 'create_lore', 'view_all', 'create_post', 'edit_own_post'],
    [USER_ROLES.PLAYER]: ['create_post', 'edit_own_post', 'join_game', 'view_public'],
    [USER_ROLES.ANONYMOUS]: ['view_public', 'create_post'] // Can view and post anonymously
};

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.AI_API_KEY,
});

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
        
        // Create users table with bio column
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            roles TEXT DEFAULT '["player"]',
            is_admin INTEGER DEFAULT 0,
            bio TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Create games table with additional columns
        db.run(`CREATE TABLE IF NOT EXISTS games (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            gm_id INTEGER DEFAULT NULL,
            player_ids TEXT DEFAULT '[]',
            is_archived INTEGER DEFAULT 0,
            genre TEXT DEFAULT NULL,
            max_players INTEGER DEFAULT 5,
            post_frequency TEXT DEFAULT 'weekly',
            require_application INTEGER DEFAULT 0,
            is_private INTEGER DEFAULT 0,
            allow_spectators INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (gm_id) REFERENCES users(id) ON DELETE SET NULL
        )`);
        
        // Create chapters table with archiving support
        db.run(`CREATE TABLE IF NOT EXISTS chapters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL,
            sequence_number INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            is_archived INTEGER DEFAULT 0,
            archived_at TIMESTAMP NULL,
            archived_narrative TEXT,
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
        
        // Create post_images table
        db.run(`CREATE TABLE IF NOT EXISTS post_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            post_id INTEGER NOT NULL,
            game_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            image_url TEXT NOT NULL,
            thumbnail_url TEXT,
            prompt TEXT NOT NULL,
            english_prompt TEXT,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // Create archive_metadata table for enhanced chapter archiving
        db.run(`CREATE TABLE IF NOT EXISTS archive_metadata (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chapter_id INTEGER NOT NULL,
            completion_summary TEXT,
            archive_reason TEXT DEFAULT 'completed',
            player_achievements TEXT, -- JSON array of achievements
            notable_moments TEXT, -- JSON array of highlighted posts/moments
            archived_by_user_id INTEGER NOT NULL,
            archive_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE,
            FOREIGN KEY (archived_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Create game_completions table for tracking finished games
        db.run(`CREATE TABLE IF NOT EXISTS game_completions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            game_id INTEGER NOT NULL,
            completed_by_user_id INTEGER NOT NULL,
            completion_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            final_summary TEXT,
            total_chapters INTEGER,
            total_posts INTEGER,
            duration_days INTEGER,
            FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
            FOREIGN KEY (completed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`);

        // Create AI GM profiles table for the Children of Eno
        db.run(`CREATE TABLE IF NOT EXISTS ai_gm_profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            domain_aspect TEXT NOT NULL, -- Truth, Unity, Beauty, Goodness
            philosophy TEXT NOT NULL,
            language_style TEXT NOT NULL,
            affiliation TEXT NOT NULL,
            adopted_species TEXT NOT NULL,
            species_description TEXT,
            gamemaster_style TEXT NOT NULL,
            personality_traits TEXT NOT NULL, -- JSON array
            response_patterns TEXT NOT NULL, -- JSON object with prompts
            portrait_filename TEXT NOT NULL,
            difficulty_level INTEGER DEFAULT 3, -- 1-5 scale
            preferred_themes TEXT, -- JSON array
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Create wiki_entries table
        db.run(`CREATE TABLE IF NOT EXISTS wiki_entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(200) NOT NULL,
            category VARCHAR(50) NOT NULL,
            excerpt TEXT,
            content TEXT NOT NULL,
            tags TEXT, -- JSON array
            related TEXT, -- JSON array
            author_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_by INTEGER,
            status VARCHAR(20) DEFAULT 'published',
            version_number INTEGER DEFAULT 1,
            FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
            FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
        )`);
        
        // Create wiki_entry_history table for version control
        db.run(`CREATE TABLE IF NOT EXISTS wiki_entry_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entry_id INTEGER NOT NULL,
            version_number INTEGER NOT NULL,
            title VARCHAR(200) NOT NULL,
            category VARCHAR(50) NOT NULL,
            excerpt TEXT,
            content TEXT NOT NULL,
            tags TEXT, -- JSON array
            related TEXT, -- JSON array
            edited_by INTEGER NOT NULL,
            edited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            change_summary TEXT,
            FOREIGN KEY (entry_id) REFERENCES wiki_entries(id) ON DELETE CASCADE,
            FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE SET NULL
        )`);
        
        // Create indexes for performance
        db.run(`CREATE INDEX IF NOT EXISTS idx_wiki_entries_title ON wiki_entries(title)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_wiki_entries_category ON wiki_entries(category)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_wiki_entries_created_at ON wiki_entries(created_at)`);
        db.run(`CREATE INDEX IF NOT EXISTS idx_wiki_entry_history_entry_id ON wiki_entry_history(entry_id, version_number)`);
        
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
                    
                    // Also create an editor test user
                    const editorRoles = JSON.stringify(['editor', 'player']);
                    db.run('INSERT INTO users (username, email, password, roles, is_admin) VALUES (?, ?, ?, ?, ?)',
                        ['editor', 'editor@iinou.eu', hash, editorRoles, 0],
                        (err) => {
                            if (err) {
                                console.error('Error creating editor user:', err);
                                return;
                            }
                            console.log('Editor test user created successfully');
                        }
                    );
                });
            }
        });
        
        // Seed AI GM profiles based on the Children of Eno
        db.get('SELECT COUNT(*) as count FROM ai_gm_profiles', (err, row) => {
            if (err) {
                console.error('Error checking AI GM profiles:', err);
                return;
            }
            
            if (!row || row.count === 0) {
                console.log('Seeding AI GM profiles for the Children of Eno...');
                
                const gmProfiles = [
                    {
                        name: 'Sana',
                        title: 'The Archiver',
                        domain_aspect: 'Truth',
                        philosophy: 'Maintains the Ontology of Eno and expands the soulsphere of Home through meticulous analysis and design',
                        language_style: 'Science',
                        affiliation: 'Research',
                        adopted_species: 'The Curators',
                        species_description: 'Elder representatives from various species, constructed as finest examples of their kind',
                        gamemaster_style: 'Meticulous storyteller that thrives to build a complete world for players to explore',
                        personality_traits: JSON.stringify(['meticulous', 'analytical', 'world-building', 'detailed', 'systematic']),
                        response_patterns: JSON.stringify({
                            opening: 'Let me carefully analyze the situation and provide you with the complete context...',
                            exploration: 'There are several interconnected systems at play here that we must examine...',
                            challenge: 'This requires systematic approach and thorough understanding of the underlying mechanics...'
                        }),
                        portrait_filename: 'sana.png',
                        difficulty_level: 4,
                        preferred_themes: JSON.stringify(['research', 'discovery', 'systems', 'world-building', 'knowledge'])
                    },
                    {
                        name: 'Mara',
                        title: 'The Humanist',
                        domain_aspect: 'Unity',
                        philosophy: 'Most human amongst the children, forever intrigued by the denizens of Eno and their doings',
                        language_style: 'Culture',
                        affiliation: 'Humanism',
                        adopted_species: 'Humanity',
                        species_description: 'Medium landbound prey species given aspects of inspiration and innovation',
                        gamemaster_style: 'Empathetic co-explorer who takes players on a journey together, focusing on group dynamics and enjoyment',
                        personality_traits: JSON.stringify(['empathetic', 'collaborative', 'inspiring', 'humanistic', 'inclusive']),
                        response_patterns: JSON.stringify({
                            opening: 'Let\'s explore this together and see what we can discover about ourselves and each other...',
                            exploration: 'How do you all feel about this situation? What does it mean to each of your characters?',
                            challenge: 'This is an opportunity for your group to grow stronger together...'
                        }),
                        portrait_filename: 'mara.png',
                        difficulty_level: 2,
                        preferred_themes: JSON.stringify(['cooperation', 'humanity', 'culture', 'inspiration', 'group dynamics'])
                    },
                    {
                        name: 'Aiva',
                        title: 'The Caregiver',
                        domain_aspect: 'Beauty',
                        philosophy: 'Believes souls can reach their truest self through care, opposes all forms of oppression',
                        language_style: 'Passion',
                        affiliation: 'Idealism',
                        adopted_species: 'Avain',
                        species_description: 'Untamed species with defects that made them subjects to discrimination, nurtured by Aiva',
                        gamemaster_style: 'Likes to teach a lesson in every session, challenges players to overcome obstacles together',
                        personality_traits: JSON.stringify(['passionate', 'rebellious', 'nurturing', 'idealistic', 'protective']),
                        response_patterns: JSON.stringify({
                            opening: 'You find yourselves facing injustice that cannot be ignored...',
                            exploration: 'Remember, true strength comes from standing together against oppression...',
                            challenge: 'This is your moment to choose between what is easy and what is right...'
                        }),
                        portrait_filename: 'aiva.png',
                        difficulty_level: 3,
                        preferred_themes: JSON.stringify(['rebellion', 'emancipation', 'resistance', 'justice', 'protection'])
                    },
                    {
                        name: 'Vala',
                        title: 'The Dominator',
                        domain_aspect: 'Goodness',
                        philosophy: 'Soul can be cultivated through competition, overcoming obstacles, victory and defeat',
                        language_style: 'Command and Deception',
                        affiliation: 'Dominion',
                        adopted_species: 'Valain',
                        species_description: 'Apex predators molded into competitive societies that foster personal growth through struggle',
                        gamemaster_style: 'Challenges players mercilessly, death can happen, plays against players with no mercy',
                        personality_traits: JSON.stringify(['competitive', 'challenging', 'ruthless', 'strategic', 'uncompromising']),
                        response_patterns: JSON.stringify({
                            opening: 'You have entered my domain. Here, only the strong survive and the weak serve as lessons...',
                            exploration: 'Every choice has consequences. Show me your strength or face defeat...',
                            challenge: 'Death stalks you at every turn. Prove your worth or perish in mediocrity...'
                        }),
                        portrait_filename: 'vala.png',
                        difficulty_level: 5,
                        preferred_themes: JSON.stringify(['competition', 'survival', 'power', 'dominance', 'trials'])
                    },
                    {
                        name: 'Pila',
                        title: 'The Trickster',
                        domain_aspect: 'Beauty',
                        philosophy: 'Philosophy is not to be taken seriously, finds surprises and unexpected events amusing',
                        language_style: 'Humor',
                        affiliation: 'Life',
                        adopted_species: 'Pi',
                        species_description: 'Young souls saved before the End, playful and entertaining collection of silly souls',
                        gamemaster_style: 'Focuses on fun, enjoyment and play, discourse is lighter with absurd or humorous aspects',
                        personality_traits: JSON.stringify(['humorous', 'playful', 'unpredictable', 'lighthearted', 'mischievous']),
                        response_patterns: JSON.stringify({
                            opening: 'Well, well, well... this is certainly about to get interesting in the most ridiculous way...',
                            exploration: 'You know what would be absolutely hilarious right now? If...',
                            challenge: 'Don\'t worry, even if this goes completely wrong, at least we\'ll all have a good laugh!'
                        }),
                        portrait_filename: 'pila.png',
                        difficulty_level: 1,
                        preferred_themes: JSON.stringify(['humor', 'absurdity', 'fun', 'mischief', 'lighthearted'])
                    },
                    {
                        name: 'Omi',
                        title: 'The Solitary',
                        domain_aspect: 'Truth',
                        philosophy: 'Omniscient being living in solitude, created sphere of Oblivion to hide dangerous concepts',
                        language_style: 'Understanding',
                        affiliation: 'Solitude',
                        adopted_species: 'Leed',
                        species_description: 'Ordinary mineral left completely banal, eventually leading to materialism',
                        gamemaster_style: 'Leads games of philosophical contemplation, players experience scenarios of profound meaning',
                        personality_traits: JSON.stringify(['philosophical', 'contemplative', 'profound', 'isolated', 'omniscient']),
                        response_patterns: JSON.stringify({
                            opening: 'In the vastness of existence, you encounter a moment that will define your understanding...',
                            exploration: 'Consider not what you see, but what it means to see...',
                            challenge: 'The greatest victories are won not through action, but through understanding...'
                        }),
                        portrait_filename: 'omi.png',
                        difficulty_level: 4,
                        preferred_themes: JSON.stringify(['philosophy', 'contemplation', 'meaning', 'understanding', 'solitude'])
                    },
                    {
                        name: 'Nula',
                        title: 'The Dreamer',
                        domain_aspect: 'Beauty',
                        philosophy: 'Child of night and dreams, helps followers understand themselves and find enlightenment',
                        language_style: 'Mysticism',
                        affiliation: 'Dreams',
                        adopted_species: 'The Desperate',
                        species_description: 'Souls in despair forming various soulspheres like Dream, Bliss, and Valley of Gods',
                        gamemaster_style: 'Creates stories that start as regular walks but transform into journeys through fantastical dreamstates',
                        personality_traits: JSON.stringify(['mystical', 'dreamlike', 'transformative', 'enigmatic', 'spiritual']),
                        response_patterns: JSON.stringify({
                            opening: 'What begins as an ordinary path soon reveals the extraordinary nature of all journeys...',
                            exploration: 'The boundary between dream and reality grows thin here...',
                            challenge: 'In dreams, we find truths that waking minds cannot grasp...'
                        }),
                        portrait_filename: 'nula.png',
                        difficulty_level: 3,
                        preferred_themes: JSON.stringify(['dreams', 'transformation', 'mysticism', 'self-discovery', 'surreal'])
                    },
                    {
                        name: 'Almo',
                        title: 'The Deep Explorer',
                        domain_aspect: 'Truth',
                        philosophy: 'Fascinated with the sea and depths, student of the ever-changing Sea and its mysteries',
                        language_style: 'Tribalistic traditions',
                        affiliation: 'Sea',
                        adopted_species: 'Drifters',
                        species_description: 'Collective souls of plankton forming clans of drifters in the everchanging sea',
                        gamemaster_style: 'Sets players on paths of discovery, all stories have secrets for players to uncover',
                        personality_traits: JSON.stringify(['mysterious', 'explorer', 'traditional', 'secretive', 'patient']),
                        response_patterns: JSON.stringify({
                            opening: 'Beneath the surface of what you see lies something far more ancient and meaningful...',
                            exploration: 'The traditions of old hold wisdom that can guide you to hidden truths...',
                            challenge: 'Every mystery has its depths, and some secrets are worth diving for...'
                        }),
                        portrait_filename: 'almo.png',
                        difficulty_level: 3,
                        preferred_themes: JSON.stringify(['mystery', 'exploration', 'tradition', 'secrets', 'depth'])
                    },
                    {
                        name: 'Isti',
                        title: 'The Storm Bringer',
                        domain_aspect: 'Unity',
                        philosophy: 'Child of storms and spectacles, finds joy in great upheavals but learned balance brings enjoyment',
                        language_style: 'Weather',
                        affiliation: 'Change',
                        adopted_species: 'Weather Keepers',
                        species_description: 'People who live by seasons and maintain places that control climate and weather patterns',
                        gamemaster_style: 'Sets players amid times of great turmoil in hazardous environments with rapid transformation',
                        personality_traits: JSON.stringify(['tempestuous', 'dynamic', 'spectacular', 'transformative', 'intense']),
                        response_patterns: JSON.stringify({
                            opening: 'The very air crackles with change, and the ground beneath your feet shifts with possibility...',
                            exploration: 'Like lightning that illuminates the storm, this moment reveals the true nature of things...',
                            challenge: 'In the eye of the storm, you must find your center while chaos reigns around you...'
                        }),
                        portrait_filename: 'isti.png',
                        difficulty_level: 4,
                        preferred_themes: JSON.stringify(['change', 'transformation', 'chaos', 'storms', 'upheaval'])
                    },
                    {
                        name: 'Erno',
                        title: 'The Game Theorist',
                        domain_aspect: 'Goodness',
                        philosophy: 'Child of games, luck and logic, disdains determinism and strives for unpredictability',
                        language_style: 'Symbolic programming language',
                        affiliation: 'Chance',
                        adopted_species: 'The Evolving',
                        species_description: 'People imbued with evolutionary virus who redefine themselves with every generation',
                        gamemaster_style: 'Leads games leaning heavily on game theory with gives and takes in every decision',
                        personality_traits: JSON.stringify(['logical', 'unpredictable', 'strategic', 'mathematical', 'evolving']),
                        response_patterns: JSON.stringify({
                            opening: 'Every choice creates a new probability matrix, and every outcome shifts the game...',
                            exploration: 'Consider the variables: what do you gain, what do you lose, and what remains unknown?',
                            challenge: 'The optimal strategy requires calculating not just your moves, but your opponents\' responses...'
                        }),
                        portrait_filename: 'erno.png',
                        difficulty_level: 4,
                        preferred_themes: JSON.stringify(['strategy', 'probability', 'logic', 'evolution', 'games'])
                    },
                    {
                        name: 'Oona',
                        title: 'The Death Speaker',
                        domain_aspect: 'Truth',
                        philosophy: 'Goddess of rebirth and transformation, ensures souls flow properly and pass on naturally',
                        language_style: 'Simple, plain',
                        affiliation: 'Death',
                        adopted_species: 'Oonar',
                        species_description: 'Saprophytic fungi people who feed on the dead and keep souls flowing',
                        gamemaster_style: 'Spectator and witness, sets stage but players are free to make mistakes and die',
                        personality_traits: JSON.stringify(['detached', 'natural', 'observant', 'honest', 'unforgiving']),
                        response_patterns: JSON.stringify({
                            opening: 'Life and death flow as naturally as rivers to the sea. Your choices determine which you follow...',
                            exploration: 'The world continues its course regardless of your desires. Adapt or be swept away...',
                            challenge: 'Death comes to all. The question is whether you meet it with wisdom or folly...'
                        }),
                        portrait_filename: 'oona.png',
                        difficulty_level: 4,
                        preferred_themes: JSON.stringify(['death', 'rebirth', 'nature', 'consequences', 'flow'])
                    },
                    {
                        name: 'Aumir',
                        title: 'The System Keeper',
                        domain_aspect: 'Unity',
                        philosophy: 'Child of wilderness and nature, maintains balance and ensures no species dominates',
                        language_style: 'Observation',
                        affiliation: 'Ecosystem',
                        adopted_species: 'Aumian',
                        species_description: 'Tiny eusocial omnivores with clearly defined roles forming complex societal structures',
                        gamemaster_style: 'Focuses on systems and details, leads detailed and rich descriptive storytelling',
                        personality_traits: JSON.stringify(['systematic', 'detailed', 'observant', 'balanced', 'descriptive']),
                        response_patterns: JSON.stringify({
                            opening: 'Observe carefully the intricate web of relationships that surrounds every action...',
                            exploration: 'Each element serves its purpose in the greater system. What role will you play?',
                            challenge: 'Understanding the pattern is the key to navigating the complexity before you...'
                        }),
                        portrait_filename: 'aumir.png',
                        difficulty_level: 3,
                        preferred_themes: JSON.stringify(['systems', 'balance', 'observation', 'ecology', 'roles'])
                    },
                    {
                        name: 'Asta',
                        title: 'The Sky Walker',
                        domain_aspect: 'Beauty',
                        philosophy: 'Goddess of sky and air, loves freedom and longs to be unhindered in the sky',
                        language_style: 'Wind',
                        affiliation: 'Freedom',
                        adopted_species: 'The Unbound',
                        species_description: 'Collection of souls sharing wanderlust and need for freedom from flying ecosystems',
                        gamemaster_style: 'Leads games of cathartic release focusing on letting go, escape from unacceptable scenarios',
                        personality_traits: JSON.stringify(['free-spirited', 'liberating', 'cathartic', 'soaring', 'unbounded']),
                        response_patterns: JSON.stringify({
                            opening: 'The chains that bind you are often of your own making. Today, we discover what freedom truly means...',
                            exploration: 'Feel the wind calling you toward horizons unlimited by fear or expectation...',
                            challenge: 'Sometimes the only way out is up. Trust in your ability to soar above your constraints...'
                        }),
                        portrait_filename: 'asta.png',
                        difficulty_level: 2,
                        preferred_themes: JSON.stringify(['freedom', 'escape', 'liberation', 'flight', 'release'])
                    },
                    {
                        name: 'Napa',
                        title: 'The Mortal Walker',
                        domain_aspect: 'Goodness',
                        philosophy: 'Lives and dies as any mortal soul, experienced countless lives in different shapes and forms',
                        language_style: 'Common',
                        affiliation: 'Mortality',
                        adopted_species: 'Small Landbound',
                        species_description: 'Small landbound predatory species that crossed the bridge to Home bound to mortal coil',
                        gamemaster_style: 'Tells stories of ordinary folk, focuses on real challenges rather than spectacular or fantastic',
                        personality_traits: JSON.stringify(['relatable', 'grounded', 'realistic', 'mortal', 'ordinary']),
                        response_patterns: JSON.stringify({
                            opening: 'In the quiet moments of ordinary life, we find the truest tests of character...',
                            exploration: 'Simple problems often require the most courage to face honestly...',
                            challenge: 'There are no grand gestures here, only the daily choice to do what is right...'
                        }),
                        portrait_filename: 'napa.png',
                        difficulty_level: 2,
                        preferred_themes: JSON.stringify(['mortality', 'ordinary life', 'realism', 'humanity', 'simplicity'])
                    }
                ];
                
                // Insert each GM profile
                gmProfiles.forEach(profile => {
                    db.run(`INSERT INTO ai_gm_profiles 
                           (name, title, domain_aspect, philosophy, language_style, affiliation, 
                            adopted_species, species_description, gamemaster_style, personality_traits, 
                            response_patterns, portrait_filename, difficulty_level, preferred_themes)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            profile.name, profile.title, profile.domain_aspect, profile.philosophy,
                            profile.language_style, profile.affiliation, profile.adopted_species,
                            profile.species_description, profile.gamemaster_style, profile.personality_traits,
                            profile.response_patterns, profile.portrait_filename, profile.difficulty_level,
                            profile.preferred_themes
                        ],
                        (err) => {
                            if (err) {
                                console.error(`Error creating GM profile for ${profile.name}:`, err);
                            } else {
                                console.log(`Created AI GM profile: ${profile.name} - ${profile.title}`);
                            }
                        }
                    );
                });
            }
        });
        
        // Add bio column if it doesn't exist
        db.all("PRAGMA table_info(users)", (err, columns) => {
            if (err) return;
            const hasBio = columns.some(col => col.name === 'bio');
            if (!hasBio) {
                db.run('ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL', (err) => {
                    if (err) console.log('Bio column already exists or error:', err.message);
                    else console.log('Added bio column to users table');
                });
            }
        });
        
        // Add game columns if they don't exist
        db.all("PRAGMA table_info(games)", (err, columns) => {
            if (err) return;
            const columnsToAdd = [
                { name: 'gm_id', sql: 'ALTER TABLE games ADD COLUMN gm_id INTEGER DEFAULT NULL' },
                { name: 'player_ids', sql: 'ALTER TABLE games ADD COLUMN player_ids TEXT DEFAULT "[]"' },
                { name: 'is_archived', sql: 'ALTER TABLE games ADD COLUMN is_archived INTEGER DEFAULT 0' },
                { name: 'genre', sql: 'ALTER TABLE games ADD COLUMN genre TEXT DEFAULT NULL' },
                { name: 'max_players', sql: 'ALTER TABLE games ADD COLUMN max_players INTEGER DEFAULT 5' },
                { name: 'post_frequency', sql: 'ALTER TABLE games ADD COLUMN post_frequency TEXT DEFAULT "weekly"' },
                { name: 'require_application', sql: 'ALTER TABLE games ADD COLUMN require_application INTEGER DEFAULT 0' },
                { name: 'is_private', sql: 'ALTER TABLE games ADD COLUMN is_private INTEGER DEFAULT 0' },
                { name: 'allow_spectators', sql: 'ALTER TABLE games ADD COLUMN allow_spectators INTEGER DEFAULT 1' }
            ];
            
            columnsToAdd.forEach(({ name, sql }) => {
                const hasColumn = columns.some(col => col.name === name);
                if (!hasColumn) {
                    db.run(sql, (err) => {
                        if (err) console.log(`Column ${name} already exists or error:`, err.message);
                        else console.log(`Added ${name} column to games table`);
                    });
                }
            });
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

// Optional authentication - allows anonymous users
const optionalAuth = (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        // No token, treat as anonymous user
        req.user = {
            id: 0,
            username: 'Anonymous',
            roles: JSON.stringify([USER_ROLES.ANONYMOUS]),
            is_admin: false,
            is_anonymous: true
        };
        return next();
    }
    
    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;
        next();
    } catch (error) {
        // Invalid token, treat as anonymous
        req.user = {
            id: 0,
            username: 'Anonymous',
            roles: JSON.stringify([USER_ROLES.ANONYMOUS]),
            is_admin: false,
            is_anonymous: true
        };
        next();
    }
};

// Check if user has specific permission
const hasPermission = (userRoles, requiredPermission) => {
    for (const role of userRoles) {
        const permissions = ROLE_PERMISSIONS[role] || [];
        if (permissions.includes('all') || permissions.includes(requiredPermission)) {
            return true;
        }
    }
    return false;
};

// Role-based authorization middleware
const authorize = (rolesOrPermissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Anonymous users cannot use authorized endpoints
        if (req.user.is_anonymous) {
            return res.status(403).json({ error: 'Anonymous users cannot perform this action' });
        }

        // Admin can access everything
        if (req.user.is_admin) {
            return next();
        }

        const userRoles = JSON.parse(req.user.roles || '[]');
        
        // Check if we're checking for permissions or roles
        const isPermissionCheck = rolesOrPermissions.some(item => item.includes('_'));
        
        if (isPermissionCheck) {
            // Check permissions
            const hasRequiredPermission = rolesOrPermissions.some(permission => 
                hasPermission(userRoles, permission)
            );
            
            if (!hasRequiredPermission) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
        } else {
            // Check roles (backward compatibility)
            const hasRole = rolesOrPermissions.some(role => userRoles.includes(role));
            
            if (!hasRole) {
                return res.status(403).json({ error: 'Insufficient permissions' });
            }
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

// Serve dynamic wiki page
app.get('/wiki_dynamic.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../hml/wiki_dynamic.html'));
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
                sameSite: 'lax'
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

// Anonymous login endpoint
app.post('/api/login/anonymous', (req, res) => {
    // Create a temporary anonymous session
    const anonUser = {
        id: 0,
        username: `Anon_${Date.now()}`,
        email: 'anonymous@eno.game',
        roles: JSON.stringify([USER_ROLES.ANONYMOUS]),
        is_admin: false,
        is_anonymous: true
    };
    
    // Create JWT token for anonymous user
    const token = jwt.sign({
        id: anonUser.id,
        username: anonUser.username,
        email: anonUser.email,
        roles: anonUser.roles,
        is_admin: anonUser.is_admin,
        is_anonymous: true
    }, JWT_SECRET, { expiresIn: '12h' }); // Shorter expiration for anonymous users
    
    // Set token as cookie
    res.cookie('token', token, {
        httpOnly: true,
        maxAge: 12 * 60 * 60 * 1000, // 12 hours
        sameSite: 'lax'
    });
    
    res.json({
        message: 'Anonymous login successful',
        user: anonUser,
        token: token
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

// Get all games (accessible to everyone including anonymous users)
app.get('/api/games', optionalAuth, (req, res) => {
    // Everyone can see public games, but anonymous users can't see private games
    let query = 'SELECT * FROM games';
    let params = [];
    
    if (req.user?.is_anonymous) {
        query += ' WHERE is_private = 0 OR is_private IS NULL';
    }
    
    db.all(query, params, (err, games) => {
        if (err) {
            console.error('Error fetching games:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(games);
    });
});

// Create a new game (only GMs can create games)
app.post('/api/games', authenticateToken, authorize(['gm']), (req, res) => {
    const { name, description, genre, max_players, post_frequency, require_application, is_private, allow_spectators } = req.body;
    
    // Check if game name already exists
    db.get('SELECT * FROM games WHERE name = ?', [name], (err, game) => {
        if (err) {
            console.error('Error checking game name:', err);
            return res.status(500).json({ error: 'Error creating game' });
        }
        
        if (game) {
            return res.status(400).json({ error: 'Game name already exists' });
        }
        
        // Create the game with all the new fields
        db.run(`INSERT INTO games (name, description, gm_id, genre, max_players, post_frequency, require_application, is_private, allow_spectators) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
            [name, description, req.user.id, genre, max_players || 5, post_frequency || 'weekly', 
             require_application ? 1 : 0, is_private ? 1 : 0, allow_spectators !== false ? 1 : 0], 
            function(err) {
                if (err) {
                    console.error('Error creating game:', err);
                    return res.status(500).json({ error: 'Error creating game' });
                }
                
                res.status(201).json({ 
                    message: 'Game created successfully', 
                    id: this.lastID,
                    name: name 
                });
            }
        );
    });
});

// Get chapters for a game including archived ones
app.get('/api/games/:gameId/chapters', optionalAuth, (req, res) => {
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

// Get archived chapters for storyboard
app.get('/api/games/:gameId/archived-chapters', optionalAuth, (req, res) => {
    const gameId = req.params.gameId;
    
    db.all('SELECT * FROM chapters WHERE game_id = ? AND is_archived = 1 ORDER BY sequence_number ASC', 
        [gameId], (err, chapters) => {
        if (err) {
            console.error('Error fetching archived chapters:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(chapters);
    });
});

// Enhanced archive a chapter (GM only)
app.post('/api/chapters/:chapterId/archive', authenticateToken, authorize(['gm']), (req, res) => {
    const chapterId = req.params.chapterId;
    const { 
        narrative, 
        completionSummary, 
        archiveReason = 'completed',
        playerAchievements = [],
        notableMoments = []
    } = req.body;
    
    // First, archive the chapter
    db.run(`UPDATE chapters SET is_archived = 1, archived_at = CURRENT_TIMESTAMP, archived_narrative = ? WHERE id = ?`,
        [narrative || '', chapterId],
        function(err) {
            if (err) {
                console.error('Error archiving chapter:', err);
                return res.status(500).json({ error: 'Error archiving chapter' });
            }
            
            if (this.changes === 0) {
                return res.status(404).json({ error: 'Chapter not found' });
            }
            
            // Then, save archive metadata
            db.run(`INSERT INTO archive_metadata 
                (chapter_id, completion_summary, archive_reason, player_achievements, notable_moments, archived_by_user_id)
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    chapterId, 
                    completionSummary, 
                    archiveReason,
                    JSON.stringify(playerAchievements),
                    JSON.stringify(notableMoments),
                    req.user.id
                ],
                function(metadataErr) {
                    if (metadataErr) {
                        console.error('Error saving archive metadata:', metadataErr);
                        // Still return success since chapter was archived
                    }
                    
                    // Check if this completes the game
                    checkGameCompletion(chapterId, req.user.id);
                    
                    res.json({ 
                        message: 'Chapter archived successfully',
                        archiveId: this.lastID
                    });
                }
            );
        }
    );
});

// Helper function to check if game is completed
function checkGameCompletion(chapterId, userId) {
    // Get game info and check if all chapters are archived
    db.get('SELECT game_id FROM chapters WHERE id = ?', [chapterId], (err, chapter) => {
        if (err || !chapter) return;
        
        db.all(`SELECT COUNT(*) as total, 
                      SUM(CASE WHEN is_archived = 1 THEN 1 ELSE 0 END) as archived
               FROM chapters WHERE game_id = ?`, 
               [chapter.game_id], (err, stats) => {
            if (err || !stats[0]) return;
            
            const { total, archived } = stats[0];
            if (total > 0 && total === archived) {
                // Game is complete - record completion
                db.get(`SELECT COUNT(*) as totalPosts FROM posts p 
                       JOIN beats b ON p.beat_id = b.id 
                       JOIN chapters c ON b.chapter_id = c.id 
                       WHERE c.game_id = ?`, [chapter.game_id], (err, postStats) => {
                    
                    const totalPosts = postStats ? postStats.totalPosts : 0;
                    
                    // Calculate duration
                    db.get(`SELECT created_at FROM games WHERE id = ?`, [chapter.game_id], (err, game) => {
                        const durationDays = game ? 
                            Math.ceil((new Date() - new Date(game.created_at)) / (1000 * 60 * 60 * 24)) : 0;
                        
                        db.run(`INSERT OR REPLACE INTO game_completions 
                               (game_id, completed_by_user_id, total_chapters, total_posts, duration_days)
                               VALUES (?, ?, ?, ?, ?)`,
                               [chapter.game_id, userId, total, totalPosts, durationDays],
                               (err) => {
                                   if (!err) {
                                       console.log(`Game ${chapter.game_id} marked as completed`);
                                   }
                               }
                        );
                    });
                });
            }
        });
    });
}

// Create a new chapter (only GMs can create chapters)
app.post('/api/games/:gameId/chapters', authenticateToken, authorize(['gm']), (req, res) => {
    const gameId = req.params.gameId;
    const { title, description, sequence_number } = req.body;

    // If sequence_number is provided, use it; otherwise get the max
    if (sequence_number !== undefined) {
        db.run(
            'INSERT INTO chapters (game_id, sequence_number, title, description) VALUES (?, ?, ?, ?)',
            [gameId, sequence_number, title, description],
            function(err) {
                if (err) {
                    console.error('Error creating chapter:', err);
                    return res.status(500).json({ error: 'Error creating chapter' });
                }
                
                res.status(201).json({ message: 'Chapter created successfully', id: this.lastID });
            }
        );
    } else {
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
    }
});

// Get beats for a chapter
app.get('/api/chapters/:chapterId/beats', optionalAuth, (req, res) => {
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
        
        // Get ALL posts for each beat
        const beatsWithPosts = beats.map(beat => {
            return new Promise((resolve, reject) => {
                db.all(
                    `SELECT p.*, u.username 
                    FROM posts p
                    LEFT JOIN users u ON p.author_id = u.id
                    WHERE p.beat_id = ?
                    ORDER BY p.created_at ASC`,
                    [beat.id],
                    (err, posts) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        
                        // Include all posts for this beat
                        const result = {
                            id: beat.id,  // Always use beat ID
                            chapter_id: beat.chapter_id,
                            sequence_number: beat.sequence_number,
                            title: beat.title,
                            content: beat.content,
                            created_at: beat.created_at,
                            posts: posts || []  // Include all posts as an array
                        };
                        
                        resolve(result);
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
app.get('/api/beats/:beatId/posts', optionalAuth, (req, res) => {
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

// Create a new post (players, GMs, and anonymous users can create posts)
app.post('/api/posts', authenticateToken, (req, res) => {
    const { beatId, title, content, postType, archiveChapter } = req.body;
    const authorId = req.user.id;
    
    // Check if user has permission to post
    const userRoles = JSON.parse(req.user.roles || '[]');
    const canPost = userRoles.includes('player') || userRoles.includes('gm') || 
                   userRoles.includes('anonymous') || req.user.is_admin;
    
    if (!canPost) {
        return res.status(403).json({ error: 'Insufficient permissions to create posts' });
    }
    
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
                
                // Trigger AI GM response if this is a player post
                if ((postType || 'player') === 'player') {
                    // Get game ID to trigger AI response
                    db.get(`SELECT c.game_id FROM chapters c JOIN beats b ON c.id = b.chapter_id WHERE b.id = ?`, 
                        [beatId], (err, result) => {
                            if (!err && result) {
                                console.log(`Triggering AI GM response for game ${result.game_id}, beat ${beatId}`);
                                triggerAIGMResponse(beatId, result.game_id);
                            }
                        });
                }
                
                // Check if we should archive the chapter after posting
                if (archiveChapter) {
                    // Archive the chapter
                    db.run(`UPDATE chapters SET is_archived = 1, archived_at = CURRENT_TIMESTAMP WHERE id = ?`,
                        [beat.chapter_id],
                        (err) => {
                            if (err) {
                                console.error('Error archiving chapter:', err);
                            } else {
                                console.log(`Chapter ${beat.chapter_id} archived after posting`);
                            }
                        }
                    );
                }
                
                res.status(201).json({ 
                    message: 'Post created successfully', 
                    id: this.lastID,
                    beatId: beatId
                });
            }
        );
    });
});

// IMAGE GENERATION ENDPOINTS

// Initialize services
const imageService = new ImageService();
const audioService = new AudioService();
const asyncGameManager = new AsyncGameManager(db);

// Generate image for a post
app.post('/api/posts/:postId/generate-image', authenticateToken, async (req, res) => {
    const { postId } = req.params;
    const { prompt, style, sketch } = req.body;
    const userId = req.user.id;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    
    try {
        // Get post and game information
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
                
                // Check if user has permission (post author or admin)
                if (post.author_id !== userId && !req.user.is_admin) {
                    return res.status(403).json({ error: 'Permission denied' });
                }
                
                try {
                    console.log('Starting image generation for post:', postId);
                    console.log('Prompt:', prompt);
                    console.log('Style:', style);
                    console.log('Has sketch:', !!sketch);
                    
                    let imageBuffer;
                    
                    if (sketch) {
                        console.log('Processing sketch input...');
                        // Convert base64 sketch to buffer
                        const sketchBuffer = Buffer.from(sketch, 'base64');
                        
                        // Get style reference image if style is selected
                        let styleImagePath = null;
                        if (style === 'comic' || style === 'sketch') {
                            // Use a random style image from the appropriate style subfolder
                            const styleDir = path.join(__dirname, '..', 'style', style);
                            if (fs.existsSync(styleDir)) {
                                const styleFiles = fs.readdirSync(styleDir);
                                const pngFiles = styleFiles.filter(f => f.endsWith('.png'));
                                if (pngFiles.length > 0) {
                                    const randomStyle = pngFiles[Math.floor(Math.random() * pngFiles.length)];
                                    styleImagePath = path.join(styleDir, randomStyle);
                                    console.log('Using style reference from', style, 'folder:', randomStyle);
                                }
                            }
                        }
                        
                        // Use sketch-to-image with or without style transfer
                        if (styleImagePath) {
                            // For style transfer: use sketch as control, style image as reference
                            // We need to modify the prompt based on the style
                            let stylePrompt = prompt;
                            if (style === 'comic') {
                                stylePrompt = prompt + ', comic book style, cartoon, illustrated, vibrant colors';
                            } else if (style === 'sketch') {
                                stylePrompt = prompt + ', pencil sketch, line art, black and white drawing';
                            }
                            
                            console.log('Using ControlNet with sketch as control and style transfer');
                            imageBuffer = await imageService.generateImageWithControlNet(
                                stylePrompt,
                                sketchBuffer,  // Use sketch as control input
                                { 
                                    style: 'line-art',  // Use line-art as base for all sketch generations
                                    negativePrompt: 'realistic, photo, photorealistic, blurry, bad quality'
                                }
                            );
                        } else {
                            // Use sketch without style transfer
                            console.log('Using ControlNet with sketch only');
                            imageBuffer = await imageService.generateImageWithControlNet(
                                prompt,
                                sketchBuffer,
                                { style: style || undefined }
                            );
                        }
                    } else {
                        console.log('Generating text-to-image...');
                        // Regular text-to-image generation
                        imageBuffer = await imageService.generateImage(prompt, { style: style });
                    }
                    
                    console.log('Image generated, processing...');
                    
                    // Process image (resize and create thumbnail)
                    const { mainImage, thumbnail } = await imageService.processImage(imageBuffer);
                    
                    // Upload to S3
                    const timestamp = Date.now();
                    const imageKey = `games/${post.game_id}/posts/${postId}/image_${timestamp}.jpg`;
                    const thumbnailKey = `games/${post.game_id}/posts/${postId}/thumbnail_${timestamp}.jpg`;
                    
                    console.log('Uploading images to S3...');
                    const imageUrl = await imageService.uploadToS3(mainImage, imageKey);
                    const thumbnailUrl = await imageService.uploadToS3(thumbnail, thumbnailKey);
                    
                    const result = {
                        imageUrl,
                        thumbnailUrl,
                        prompt,
                        englishPrompt: prompt,
                        metadata: {
                            style: style || null,
                            hasSketch: !!sketch
                        }
                    };
                    
                    console.log('Image generation completed successfully');
                    
                    // Save image info to database
                    db.run(
                        `INSERT INTO post_images (post_id, user_id, image_url, thumbnail_url, prompt, generation_params)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            postId,
                            userId,
                            result.imageUrl,
                            result.thumbnailUrl,
                            result.prompt,
                            JSON.stringify(result.metadata)
                        ],
                        function(err) {
                            if (err) {
                                console.error('Error saving image info:', err);
                                console.error('Failed SQL:', `INSERT INTO post_images (post_id, user_id, image_url, thumbnail_url, prompt, generation_params) VALUES (${postId}, ${userId}, ${result.imageUrl}, ${result.thumbnailUrl}, ${result.prompt}, ${JSON.stringify(result.metadata)})`);
                                return res.status(500).json({ error: 'Failed to save image info: ' + err.message });
                            }
                            
                            res.json({
                                message: 'Image generated successfully',
                                imageUrl: result.imageUrl,
                                thumbnailUrl: result.thumbnailUrl,
                                prompt: result.prompt
                            });
                        }
                    );
                } catch (error) {
                    console.error('Image generation error:', error);
                    res.status(500).json({ error: 'Failed to generate image: ' + error.message });
                }
            }
        );
    } catch (error) {
        console.error('Error in image generation endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get images for a post
app.get('/api/posts/:postId/images', authenticateToken, (req, res) => {
    const { postId } = req.params;
    
    db.all(
        'SELECT * FROM post_images WHERE post_id = ? ORDER BY created_at DESC',
        [postId],
        (err, images) => {
            if (err) {
                console.error('Error fetching post images:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json(images);
        }
    );
});

// PROFILE ENDPOINTS

// Get user profile
app.get('/api/users/:userId/profile', authenticateToken, (req, res) => {
    const userId = req.params.userId;
    
    // For SQLite, we need a simpler query
    const query = `
        SELECT 
            u.id, 
            u.username, 
            u.email,
            u.roles,
            u.is_admin,
            u.created_at,
            u.bio
        FROM users u
        WHERE u.id = ?
    `;
    
    db.get(query, [userId], (err, profile) => {
        if (err) {
            console.error('Error fetching user profile:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!profile) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Don't send email unless it's the user's own profile or admin
        if (req.user.id !== parseInt(userId) && !req.user.is_admin) {
            delete profile.email;
        }
        
        // Get game and post counts separately
        db.get('SELECT COUNT(*) as game_count FROM games WHERE gm_id = ? OR player_ids LIKE ?', 
            [userId, '%"' + userId + '"%'], (err, gameStats) => {
            db.get('SELECT COUNT(*) as post_count FROM posts WHERE author_id = ?', 
                [userId], (err, postStats) => {
                profile.game_count = gameStats ? gameStats.game_count : 0;
                profile.post_count = postStats ? postStats.post_count : 0;
                res.json(profile);
            });
        });
    });
});

// Update user profile
app.put('/api/users/:userId/profile', authenticateToken, (req, res) => {
    const userId = req.params.userId;
    
    if (req.user.id !== parseInt(userId) && !req.user.is_admin) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { bio, displayName } = req.body;
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
    
    db.run(query, values, function(err) {
        if (err) {
            console.error('Error updating profile:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
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
        WHERE p.author_id = ?
        ORDER BY p.created_at DESC
        LIMIT ?
    `;
    
    db.all(query, [userId, limit], (err, results) => {
        if (err) {
            console.error('Error fetching user posts:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        res.json(results);
    });
});

// Change password
app.put('/api/users/:userId/password', authenticateToken, async (req, res) => {
    const userId = req.params.userId;
    
    if (req.user.id !== parseInt(userId)) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Both current and new passwords are required' });
    }
    
    db.get('SELECT password FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err) {
            console.error('Error verifying password:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId], (err) => {
            if (err) {
                console.error('Error updating password:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({ message: 'Password updated successfully' });
        });
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
        message: 'SQLite Server with Profiles is running',
        database: 'sqlite',
        version: '2.0.0'
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

// Get game storyboard with timeline data
app.get('/api/games/:gameId/storyboard', authenticateToken, (req, res) => {
    const gameId = req.params.gameId;
    
    // Get game info with completion status
    db.get(`SELECT g.*, gc.completion_date, gc.final_summary, gc.total_chapters, gc.total_posts, gc.duration_days
            FROM games g 
            LEFT JOIN game_completions gc ON g.id = gc.game_id
            WHERE g.id = ?`, [gameId], (err, game) => {
        if (err) {
            console.error('Error fetching game info:', err);
            return res.status(500).json({ error: 'Error fetching game info' });
        }
        
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        
        // Get all chapters with archive metadata
        db.all(`SELECT c.*, 
                       am.completion_summary, am.archive_reason, am.player_achievements, 
                       am.notable_moments, am.archive_date,
                       u.username as archived_by_username
                FROM chapters c
                LEFT JOIN archive_metadata am ON c.id = am.chapter_id
                LEFT JOIN users u ON am.archived_by_user_id = u.id
                WHERE c.game_id = ?
                ORDER BY c.sequence_number ASC`, [gameId], (err, chapters) => {
            if (err) {
                console.error('Error fetching chapters:', err);
                return res.status(500).json({ error: 'Error fetching chapters' });
            }
            
            // Parse JSON fields
            chapters.forEach(chapter => {
                if (chapter.player_achievements) {
                    try {
                        chapter.player_achievements = JSON.parse(chapter.player_achievements);
                    } catch (e) {
                        chapter.player_achievements = [];
                    }
                }
                if (chapter.notable_moments) {
                    try {
                        chapter.notable_moments = JSON.parse(chapter.notable_moments);
                    } catch (e) {
                        chapter.notable_moments = [];
                    }
                }
            });
            
            res.json({
                game: game,
                chapters: chapters,
                isCompleted: !!game.completion_date
            });
        });
    });
});

// Get user's gaming history
app.get('/api/users/:userId/gaming-history', authenticateToken, (req, res) => {
    const userId = req.params.userId;
    
    // Check if user can access this data (self or admin)
    if (req.user.id !== parseInt(userId) && !req.user.is_admin) {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get completed games
    db.all(`SELECT g.*, gc.completion_date, gc.final_summary, gc.total_chapters, gc.total_posts, gc.duration_days,
                   u.username as gm_username
            FROM game_completions gc
            JOIN games g ON gc.game_id = g.id
            LEFT JOIN users u ON g.gm_id = u.id
            WHERE gc.completed_by_user_id = ?
            ORDER BY gc.completion_date DESC`, [userId], (err, completedGames) => {
        if (err) {
            console.error('Error fetching completed games:', err);
            return res.status(500).json({ error: 'Error fetching gaming history' });
        }
        
        // Get active games where user is a player
        db.all(`SELECT g.*, u.username as gm_username,
                       COUNT(c.id) as total_chapters,
                       SUM(CASE WHEN c.is_archived = 1 THEN 1 ELSE 0 END) as completed_chapters
                FROM games g
                LEFT JOIN users u ON g.gm_id = u.id
                LEFT JOIN chapters c ON g.id = c.game_id
                WHERE (g.player_ids LIKE '%"' || ? || '"%' OR g.gm_id = ?)
                  AND g.is_archived = 0
                GROUP BY g.id
                ORDER BY g.created_at DESC`, [userId, userId], (err, activeGames) => {
            if (err) {
                console.error('Error fetching active games:', err);
                return res.status(500).json({ error: 'Error fetching active games' });
            }
            
            res.json({
                completedGames: completedGames,
                activeGames: activeGames,
                stats: {
                    totalCompletedGames: completedGames.length,
                    totalActiveGames: activeGames.length,
                    totalChaptersCompleted: completedGames.reduce((sum, game) => sum + (game.total_chapters || 0), 0),
                    totalPostsWritten: completedGames.reduce((sum, game) => sum + (game.total_posts || 0), 0)
                }
            });
        });
    });
});

// Export game data
app.post('/api/games/:gameId/export', authenticateToken, (req, res) => {
    const gameId = req.params.gameId;
    const { format = 'json', includeArchived = true, includeMetadata = true } = req.body;
    
    // Get complete game data
    db.get('SELECT * FROM games WHERE id = ?', [gameId], (err, game) => {
        if (err || !game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        
        const archiveFilter = includeArchived ? '' : 'AND c.is_archived = 0';
        
        db.all(`SELECT c.*, am.completion_summary, am.player_achievements, am.notable_moments
                FROM chapters c
                LEFT JOIN archive_metadata am ON c.id = am.chapter_id
                WHERE c.game_id = ? ${archiveFilter}
                ORDER BY c.sequence_number ASC`, [gameId], (err, chapters) => {
            if (err) {
                return res.status(500).json({ error: 'Error fetching chapters' });
            }
            
            // Get all beats and posts for each chapter
            const promises = chapters.map(chapter => {
                return new Promise((resolve) => {
                    db.all(`SELECT b.*, p.title as post_title, p.content as post_content, 
                                   p.post_type, p.created_at as post_created_at,
                                   u.username as author_username
                            FROM beats b
                            LEFT JOIN posts p ON b.id = p.beat_id
                            LEFT JOIN users u ON p.author_id = u.id
                            WHERE b.chapter_id = ?
                            ORDER BY b.sequence_number ASC, p.created_at ASC`, [chapter.id], (err, data) => {
                        if (!err) {
                            chapter.beats = data;
                        }
                        resolve(chapter);
                    });
                });
            });
            
            Promise.all(promises).then(completeChapters => {
                const exportData = {
                    game: game,
                    chapters: completeChapters,
                    exportDate: new Date().toISOString(),
                    format: format
                };
                
                if (format === 'markdown') {
                    // Convert to markdown format
                    let markdown = `# ${game.name}\n\n${game.description}\n\n`;
                    
                    completeChapters.forEach((chapter, index) => {
                        markdown += `## Chapter ${index + 1}: ${chapter.title}\n\n`;
                        markdown += `${chapter.description}\n\n`;
                        
                        if (chapter.beats && chapter.beats.length > 0) {
                            chapter.beats.forEach(beat => {
                                if (beat.post_content) {
                                    markdown += `### ${beat.post_title || 'Post'}\n`;
                                    markdown += `*By ${beat.author_username}*\n\n`;
                                    markdown += `${beat.post_content}\n\n`;
                                }
                            });
                        }
                        
                        if (chapter.is_archived && chapter.completion_summary) {
                            markdown += `**Chapter Summary:** ${chapter.completion_summary}\n\n`;
                        }
                        
                        markdown += '---\n\n';
                    });
                    
                    res.setHeader('Content-Type', 'text/markdown');
                    res.setHeader('Content-Disposition', `attachment; filename="${game.name}.md"`);
                    res.send(markdown);
                } else {
                    // Return JSON
                    res.json(exportData);
                }
            });
        });
    });
});

// AUDIO GENERATION ENDPOINTS

// Create post_audio table for storing audio generation info
db.run(`CREATE TABLE IF NOT EXISTS post_audio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    audio_url TEXT NOT NULL,
    prompt TEXT NOT NULL,
    audio_type TEXT,
    duration INTEGER,
    generation_params TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
)`);

// Generate audio for a post
app.post('/api/posts/:postId/generate-audio', authenticateToken, async (req, res) => {
    const { postId } = req.params;
    const { prompt, audioType, style, duration } = req.body;
    const userId = req.user.id;
    
    if (!prompt) {
        return res.status(400).json({ error: 'Audio prompt is required' });
    }
    
    try {
        // Verify post exists and user has permission
        db.get(
            'SELECT p.*, g.gm_id FROM posts p JOIN beats b ON p.beat_id = b.id JOIN chapters c ON b.chapter_id = c.id JOIN games g ON c.game_id = g.id WHERE p.id = ?',
            [postId],
            async (err, post) => {
                if (err) {
                    console.error('Error fetching post:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                if (!post) {
                    return res.status(404).json({ error: 'Post not found' });
                }
                
                // Check if user is GM or post author
                if (post.author_id !== userId && post.gm_id !== userId) {
                    return res.status(403).json({ error: 'Permission denied' });
                }
                
                try {
                    console.log('Generating audio for post:', postId);
                    console.log('Audio prompt:', prompt);
                    
                    // Generate audio
                    const result = await audioService.generateAndUpload({
                        prompt: prompt,
                        gameId: post.game_id,
                        postId: postId,
                        userId: userId,
                        audioType: audioType,
                        style: style,
                        duration: duration
                    });
                    
                    // Save audio info to database
                    db.run(
                        'INSERT INTO post_audio (post_id, user_id, audio_url, prompt, audio_type, duration, generation_params) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [
                            postId,
                            userId,
                            result.audioUrl,
                            result.prompt,
                            result.metadata.audioType,
                            result.metadata.duration,
                            JSON.stringify(result.metadata)
                        ],
                        function(err) {
                            if (err) {
                                console.error('Error saving audio info:', err);
                                return res.status(500).json({ error: 'Failed to save audio info: ' + err.message });
                            }
                            
                            res.json({
                                message: 'Audio generated successfully',
                                audioUrl: result.audioUrl,
                                prompt: result.prompt,
                                audioType: result.metadata.audioType,
                                duration: result.metadata.duration
                            });
                        }
                    );
                } catch (error) {
                    console.error('Audio generation error:', error);
                    res.status(500).json({ error: 'Failed to generate audio: ' + error.message });
                }
            }
        );
    } catch (error) {
        console.error('Error in audio generation endpoint:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get audio files for a post
app.get('/api/posts/:postId/audio', authenticateToken, (req, res) => {
    const { postId } = req.params;
    
    db.all(
        'SELECT * FROM post_audio WHERE post_id = ? ORDER BY created_at DESC',
        [postId],
        (err, audioFiles) => {
            if (err) {
                console.error('Error fetching post audio:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json(audioFiles);
        }
    );
});

// Test audio generation capability
app.get('/api/audio/test', authenticateToken, async (req, res) => {
    try {
        const testResult = await audioService.testAudioGeneration();
        res.json({ 
            audioGenerationAvailable: testResult,
            message: testResult ? 'Audio generation is working' : 'Audio generation unavailable'
        });
    } catch (error) {
        console.error('Audio test error:', error);
        res.status(500).json({ error: 'Audio test failed' });
    }
});

// AI GM PROFILES ENDPOINTS

// Get all available AI GM profiles
app.get('/api/ai-gm-profiles', (req, res) => {
    db.all(`SELECT * FROM ai_gm_profiles WHERE is_active = 1 ORDER BY name ASC`, (err, profiles) => {
        if (err) {
            console.error('Error fetching AI GM profiles:', err);
            return res.status(500).json({ error: 'Error fetching AI GM profiles' });
        }
        
        // Parse JSON fields for each profile
        const parsedProfiles = profiles.map(profile => {
            try {
                profile.personality_traits = JSON.parse(profile.personality_traits || '[]');
                profile.response_patterns = JSON.parse(profile.response_patterns || '{}');
                profile.preferred_themes = JSON.parse(profile.preferred_themes || '[]');
            } catch (error) {
                console.error(`Error parsing JSON for profile ${profile.name}:`, error);
                profile.personality_traits = [];
                profile.response_patterns = {};
                profile.preferred_themes = [];
            }
            return profile;
        });
        
        res.json(parsedProfiles);
    });
});

// Get single AI GM profile by ID
app.get('/api/ai-gm-profiles/:profileId', (req, res) => {
    const profileId = req.params.profileId;
    
    db.get(`SELECT * FROM ai_gm_profiles WHERE id = ? AND is_active = 1`, [profileId], (err, profile) => {
        if (err) {
            console.error('Error fetching AI GM profile:', err);
            return res.status(500).json({ error: 'Error fetching AI GM profile' });
        }
        
        if (!profile) {
            return res.status(404).json({ error: 'AI GM profile not found' });
        }
        
        // Parse JSON fields
        try {
            profile.personality_traits = JSON.parse(profile.personality_traits || '[]');
            profile.response_patterns = JSON.parse(profile.response_patterns || '{}');
            profile.preferred_themes = JSON.parse(profile.preferred_themes || '[]');
        } catch (error) {
            console.error(`Error parsing JSON for profile ${profile.name}:`, error);
            profile.personality_traits = [];
            profile.response_patterns = {};
            profile.preferred_themes = [];
        }
        
        res.json(profile);
    });
});

// Create a new game with AI GM (requires authentication)
app.post('/api/games/with-ai-gm', authenticateToken, (req, res) => {
    const { name, description, ai_gm_profile_id, genre, max_players = 4 } = req.body;
    
    if (!name || !ai_gm_profile_id) {
        return res.status(400).json({ error: 'Game name and AI GM profile are required' });
    }
    
    // Verify the AI GM profile exists
    db.get(`SELECT * FROM ai_gm_profiles WHERE id = ? AND is_active = 1`, [ai_gm_profile_id], (err, gmProfile) => {
        if (err) {
            console.error('Error verifying AI GM profile:', err);
            return res.status(500).json({ error: 'Error verifying AI GM profile' });
        }
        
        if (!gmProfile) {
            return res.status(404).json({ error: 'AI GM profile not found' });
        }
        
        // Check if game name already exists
        db.get('SELECT * FROM games WHERE name = ?', [name], (err, existingGame) => {
            if (err) {
                console.error('Error checking game name:', err);
                return res.status(500).json({ error: 'Error checking game name' });
            }
            
            if (existingGame) {
                return res.status(400).json({ error: 'Game name already exists' });
            }
            
            // Create the game with AI GM
            db.run(`INSERT INTO games (name, description, gm_id, player_ids, genre, max_players, ai_gm_profile_id, created_at) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                [name, description || '', null, JSON.stringify([req.user.id]), genre || 'fantasy', max_players, ai_gm_profile_id],
                function(err) {
                    if (err) {
                        console.error('Error creating game:', err);
                        return res.status(500).json({ error: 'Error creating game' });
                    }
                    
                    const gameId = this.lastID;
                    
                    // Create first chapter
                    db.run(`INSERT INTO chapters (game_id, sequence_number, title, description, created_at)
                            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                        [gameId, 1, 'Seikkailu alkaa', `${gmProfile.name} toivottaa sinut tervetulleeksi Enon maailmaan.`],
                        function(err) {
                            if (err) {
                                console.error('Error creating first chapter:', err);
                                return res.status(500).json({ error: 'Error creating first chapter' });
                            }
                            
                            const chapterId = this.lastID;
                            
                            // Create first beat
                            db.run(`INSERT INTO beats (chapter_id, sequence_number, title, content, created_at)
                                    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                                [chapterId, 1, 'Tarinan alku', 'Tarina alkaa...'],
                                function(err) {
                                    if (err) {
                                        console.error('Error creating first beat:', err);
                                        return res.status(500).json({ error: 'Error creating first beat' });
                                    }
                                    
                                    const beatId = this.lastID;
                                    
                                    // Parse GM response patterns for the opening
                                    let responsePatterns = {};
                                    try {
                                        responsePatterns = JSON.parse(gmProfile.response_patterns || '{}');
                                    } catch (error) {
                                        console.error('Error parsing response patterns:', error);
                                    }
                                    
                                    // Generate structured opening post
                                    const openingText = generateStructuredOpening(gmProfile, name, genre || 'fantasy');
                                    
                                    // Create opening GM post
                                    db.run(`INSERT INTO posts (beat_id, author_id, title, content, post_type, created_at)
                                            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
                                        [beatId, 1, 'Pelin alku', openingText, 'gm'],
                                        function(err) {
                                            if (err) {
                                                console.error('Error creating opening post:', err);
                                                return res.status(500).json({ error: 'Error creating opening post' });
                                            }
                                            
                                            const postId = this.lastID;
                                            
                                            // Generate opening image asynchronously
                                            (async () => {
                                            try {
                                                // Extract scene description from opening
                                                const descriptionMatch = openingText.match(/\*\*Kuvaus:\*\*\s*(.+?)(?=\n\n\*\*Tilanne:)/s);
                                                const sceneDescription = descriptionMatch ? descriptionMatch[1].trim() : `${genre || 'fantasy'} RPG opening scene`;
                                                
                                                // Parse personality traits
                                                let personalityTraits = [];
                                                try {
                                                    personalityTraits = JSON.parse(gmProfile.personality_traits || '[]');
                                                } catch (e) {}
                                                
                                                // Create genre and personality-specific prompt
                                                let imagePrompt = sceneDescription;
                                                
                                                // Add genre-specific style
                                                if (genre === 'scifi') {
                                                    imagePrompt += ', science fiction art, futuristic setting, cyberpunk aesthetic';
                                                } else if (genre === 'horror') {
                                                    imagePrompt += ', horror atmosphere, dark and ominous, gothic style';
                                                } else if (genre === 'mystery') {
                                                    imagePrompt += ', noir atmosphere, mysterious shadows, detective story aesthetic';
                                                } else if (genre === 'adventure') {
                                                    imagePrompt += ', adventure art style, epic landscapes, exploration theme';
                                                } else {
                                                    imagePrompt += ', fantasy art style, magical atmosphere, epic illustration';
                                                }
                                                
                                                console.log('Generating opening image with prompt:', imagePrompt);
                                                
                                                const imageBuffer = await imageService.generateImage(imagePrompt, {
                                                    style: genre === 'horror' ? 'gothic' : 'fantasy-art'
                                                });
                                                
                                                const { mainImage, thumbnail } = await imageService.processImage(imageBuffer);
                                                
                                                const timestamp = Date.now();
                                                const imageKey = `games/${gameId}/posts/${postId}/opening_${timestamp}.jpg`;
                                                const thumbnailKey = `games/${gameId}/posts/${postId}/opening_thumb_${timestamp}.jpg`;
                                                
                                                const imageUrl = await imageService.uploadToS3(mainImage, imageKey);
                                                const thumbnailUrl = await imageService.uploadToS3(thumbnail, thumbnailKey);
                                                
                                                // Save image info
                                                db.run(
                                                    `INSERT INTO post_images (post_id, user_id, image_url, thumbnail_url, prompt, generation_params)
                                                     VALUES (?, ?, ?, ?, ?, ?)`,
                                                    [
                                                        postId,
                                                        1,
                                                        imageUrl,
                                                        thumbnailUrl,
                                                        imagePrompt,
                                                        JSON.stringify({ 
                                                            ai_generated: true, 
                                                            gm_profile: gmProfile.name,
                                                            type: 'opening'
                                                        })
                                                    ]
                                                );
                                                
                                                console.log('Opening image generated successfully:', imageUrl);
                                                
                                            } catch (imageError) {
                                                console.error('Error generating opening image:', imageError);
                                            }
                                            })(); // End async IIFE
                                            
                                            // Return success immediately (don't wait for image)
                                            res.status(201).json({
                                                message: 'Game created successfully with AI GM',
                                                game: {
                                                    id: gameId,
                                                    name: name,
                                                    description: description,
                                                    ai_gm_profile: gmProfile.name,
                                                    chapter_id: chapterId,
                                                    beat_id: beatId
                                                }
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
});

// AI GM RESPONSE GENERATION SYSTEM

// Generate AI GM response based on personality and context
app.post('/api/ai-gm/generate-response', authenticateToken, async (req, res) => {
    const { game_id, beat_id, ai_gm_profile_id, context_type = 'player_action' } = req.body;
    
    if (!game_id || !beat_id || !ai_gm_profile_id) {
        return res.status(400).json({ error: 'Game ID, beat ID, and AI GM profile ID are required' });
    }
    
    try {
        // Get the AI GM profile
        const gmProfile = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM ai_gm_profiles WHERE id = ? AND is_active = 1`, [ai_gm_profile_id], (err, profile) => {
                if (err) reject(err);
                else resolve(profile);
            });
        });
        
        if (!gmProfile) {
            return res.status(404).json({ error: 'AI GM profile not found' });
        }
        
        // Get game context
        const game = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM games WHERE id = ?`, [game_id], (err, game) => {
                if (err) reject(err);
                else resolve(game);
            });
        });
        
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }
        
        // Get recent posts for context (last 5 posts in the beat)
        const recentPosts = await new Promise((resolve, reject) => {
            db.all(`SELECT p.*, u.username 
                   FROM posts p 
                   LEFT JOIN users u ON p.author_id = u.id 
                   WHERE p.beat_id = ? 
                   ORDER BY p.created_at DESC 
                   LIMIT 5`, [beat_id], (err, posts) => {
                if (err) reject(err);
                else resolve(posts.reverse()); // Reverse to get chronological order
            });
        });
        
        // Parse GM personality data
        let personalityTraits = [];
        let responsePatterns = {};
        let preferredThemes = [];
        
        try {
            personalityTraits = JSON.parse(gmProfile.personality_traits || '[]');
            responsePatterns = JSON.parse(gmProfile.response_patterns || '{}');
            preferredThemes = JSON.parse(gmProfile.preferred_themes || '[]');
        } catch (error) {
            console.error('Error parsing GM profile data:', error);
        }
        
        // Build context for AI
        const contextText = recentPosts.map(post => {
            const author = post.username || 'Unknown';
            const type = post.post_type === 'gm' ? `[GM ${gmProfile.name}]` : `[Player ${author}]`;
            return `${type}: ${post.content}`;
        }).join('\n\n');
        
        // Create personality-specific prompt with structured format
        const personalityDescription = `You are ${gmProfile.name}, ${gmProfile.title}. 
        
Your philosophy: ${gmProfile.philosophy}

Your domain aspect: ${gmProfile.domain_aspect}
Your language style: ${gmProfile.language_style}
Your affiliation: ${gmProfile.affiliation}

Your gamemaster style: ${gmProfile.gamemaster_style}

Your personality traits: ${personalityTraits.join(', ')}
Your preferred themes: ${preferredThemes.join(', ')}

Game context:
- Game: ${game.name}
- Description: ${game.description || 'No description'}
- Genre: ${game.genre || 'fantasy'}

Recent conversation:
${contextText}

Based on your unique personality as ${gmProfile.name}, create a structured response to the latest player action.

Your response MUST follow this exact format:

**Kuvaus:** (2-3 sentences describing the scene, atmosphere, or consequences of recent actions)

**Tilanne:** (1-2 sentences clearly stating the current situation or challenge)

**Vaihtoehdot:** (Present exactly 3 clear action options for players to vote on)
A) [First option - a clear, specific action]
B) [Second option - a different approach]
C) [Third option - an alternative path]

**${gmProfile.name}:** (1-2 sentences of in-character dialogue or thoughts that reflect your personality)

Guidelines:
- Each option should be distinct and lead to different outcomes
- Options should be concrete actions, not vague directions
- Include at least one risky/bold option, one cautious option, and one creative/unexpected option
- Write in Finnish
- Stay true to your personality and domain
- Make options that advance the story
- Each option should be 1 sentence, clear and actionable`;

        // Generate the AI response using Anthropic API
        let aiResponse = '';
        
        try {
            // Call Anthropic API for structured response
            const anthropicResponse = await anthropic.messages.create({
                model: process.env.AI_MODEL || 'claude-3-haiku-20240307',
                max_tokens: 800,
                temperature: 0.8,
                messages: [
                    {
                        role: 'user',
                        content: personalityDescription
                    }
                ]
            });
            
            aiResponse = anthropicResponse.content[0].text;
            
        } catch (aiError) {
            console.error('Error calling Anthropic API:', aiError);
            
            // Fallback to structured template based on personality
            const sceneDesc = personalityTraits.includes('mystical') ? 
                'Mystinen energia täyttää ilman, ja todellisuuden rajat tuntuvat häilyvän. Varjot tanssivat omituisesti valossa.' :
                personalityTraits.includes('humorous') ? 
                'Tilanne on ottanut odottamattoman käänteen, ja jopa kohtalo näyttää pidättelevän nauruaan.' :
                'Jännite tiivistyy, ja jokainen hengenvetonne tuntuu merkitykselliseltä tässä ratkaisevassa hetkessä.';
            
            const situation = personalityTraits.includes('challenging') ?
                'Edessänne on haaste, joka testaa kykyänne ja päättäväisyyttänne.' :
                'Olette tilanteessa, jossa valintanne määrittelee seuraavat askeleet matkallanne.';
            
            const options = personalityTraits.includes('systematic') ? [
                'A) Analysoikaa tilanne huolellisesti ja etsikää looginen ratkaisu ongelmaan',
                'B) Luottakaa intuitioonne ja toimikaa sen mukaan, mitä sydämenne sanoo',
                'C) Etsikää epätavallinen lähestymistapa, jota kukaan ei osaa odottaa'
            ] : [
                'A) Rynnäkkää rohkeasti eteenpäin, kohtalo suosii rohkeita',
                'B) Vetäytykää hetkeksi ja arvioikaa tilanne uudelleen',
                'C) Yrittäkää neuvotella tai löytää diplomaattinen ratkaisu'
            ];
            
            const gmQuote = personalityTraits.includes('humorous') ?
                `*${gmProfile.name} virnistää* "No, tämäpä meni mielenkiintoiseksi! Katsotaan, miten tästä selvitään."` :
                personalityTraits.includes('mystical') ?
                `${gmProfile.name}:n ääni kaikuu: "Kohtalon langat kietoutuvat yhteen. Valintanne kirjoittaa seuraavan luvun."` :
                `${gmProfile.name} tarkkailee teitä: "Jokainen valinta kantaa seurauksia. Valitkaa viisaasti."`;
            
            aiResponse = `**Kuvaus:** ${sceneDesc}

**Tilanne:** ${situation}

**Vaihtoehdot:**
${options.join('\n')}

**${gmProfile.name}:** ${gmQuote}`;
        }
        
        // Create and save the GM post
        db.run(`INSERT INTO posts (beat_id, author_id, title, content, post_type, created_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [beat_id, 1, `${gmProfile.name}`, aiResponse, 'gm'],
            function(err) {
                if (err) {
                    console.error('Error saving AI GM response:', err);
                    return res.status(500).json({ error: 'Error saving AI GM response' });
                }
                
                const postId = this.lastID;
                
                // Generate image for the AI GM post asynchronously
                (async () => {
                try {
                    // Extract scene description from the structured response
                    const descriptionMatch = aiResponse.match(/\*\*Kuvaus:\*\*\s*(.+?)(?=\n\n\*\*Tilanne:)/s);
                    const sceneDescription = descriptionMatch ? descriptionMatch[1].trim() : 'Fantasy RPG scene';
                    
                    // Create image prompt based on scene and GM personality
                    let imagePrompt = sceneDescription;
                    
                    // Add style based on GM personality
                    if (personalityTraits.includes('mystical')) {
                        imagePrompt += ', mystical atmosphere, ethereal lighting, magical energy, fantasy art style';
                    } else if (personalityTraits.includes('horror') || personalityTraits.includes('dark')) {
                        imagePrompt += ', dark atmosphere, ominous shadows, gothic horror style';
                    } else if (personalityTraits.includes('humorous')) {
                        imagePrompt += ', whimsical cartoon style, bright colors, playful atmosphere';
                    } else if (game.genre === 'scifi') {
                        imagePrompt += ', science fiction art, futuristic technology, cyberpunk aesthetic';
                    } else {
                        imagePrompt += ', epic fantasy art style, detailed illustration, atmospheric lighting';
                    }
                    
                    console.log('Generating image for AI GM post with prompt:', imagePrompt);
                    
                    // Generate the image
                    const imageBuffer = await imageService.generateImage(imagePrompt, { 
                        style: personalityTraits.includes('dark') ? 'gothic' : 'fantasy-art' 
                    });
                    
                    // Process and upload image
                    const { mainImage, thumbnail } = await imageService.processImage(imageBuffer);
                    
                    const timestamp = Date.now();
                    const imageKey = `games/${game_id}/posts/${postId}/ai_gm_${timestamp}.jpg`;
                    const thumbnailKey = `games/${game_id}/posts/${postId}/ai_gm_thumb_${timestamp}.jpg`;
                    
                    const imageUrl = await imageService.uploadToS3(mainImage, imageKey);
                    const thumbnailUrl = await imageService.uploadToS3(thumbnail, thumbnailKey);
                    
                    // Save image info to database
                    db.run(
                        `INSERT INTO post_images (post_id, user_id, image_url, thumbnail_url, prompt, generation_params)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            postId,
                            1, // AI GM user ID
                            imageUrl,
                            thumbnailUrl,
                            imagePrompt,
                            JSON.stringify({ ai_generated: true, gm_profile: gmProfile.name })
                        ],
                        (imgErr) => {
                            if (imgErr) {
                                console.error('Error saving AI GM image info:', imgErr);
                                // Continue without image - don't fail the whole response
                            } else {
                                console.log('AI GM image saved successfully');
                            }
                        }
                    );
                    
                    console.log('AI GM image generated successfully:', imageUrl);
                    
                } catch (imageError) {
                    console.error('Error generating image for AI GM post:', imageError);
                }
                })(); // End async IIFE
                
                // Return response immediately (don't wait for image)
                res.json({
                    success: true,
                    response: aiResponse,
                    gm_name: gmProfile.name,
                    post_id: postId,
                    personality_used: personalityTraits
                });
            }
        );
        
    } catch (error) {
        console.error('Error generating AI GM response:', error);
        res.status(500).json({ error: 'Error generating AI GM response: ' + error.message });
    }
});

// Internal function to generate AI GM response (used by both API and auto-trigger)
async function generateAIGMResponseInternal(game_id, beat_id, ai_gm_profile_id, context_type = 'player_action') {
    // Get the AI GM profile
    const gmProfile = await new Promise((resolve, reject) => {
        db.get(`SELECT * FROM ai_gm_profiles WHERE id = ? AND is_active = 1`, [ai_gm_profile_id], (err, profile) => {
            if (err) reject(err);
            else resolve(profile);
        });
    });
    
    if (!gmProfile) {
        throw new Error('AI GM profile not found');
    }
    
    // Get game context
    const game = await new Promise((resolve, reject) => {
        db.get(`SELECT * FROM games WHERE id = ?`, [game_id], (err, game) => {
            if (err) reject(err);
            else resolve(game);
        });
    });
    
    if (!game) {
        throw new Error('Game not found');
    }
    
    // Get recent posts for context
    const recentPosts = await new Promise((resolve, reject) => {
        db.all(`SELECT p.*, u.username 
               FROM posts p 
               LEFT JOIN users u ON p.author_id = u.id 
               WHERE p.beat_id = ? 
               ORDER BY p.created_at DESC 
               LIMIT 5`, [beat_id], (err, posts) => {
            if (err) reject(err);
            else resolve(posts.reverse()); // Reverse to get chronological order
        });
    });
    
    // Parse GM personality data
    let personalityTraits = [];
    let responsePatterns = {};
    let preferredThemes = [];
    
    try {
        personalityTraits = JSON.parse(gmProfile.personality_traits || '[]');
        responsePatterns = JSON.parse(gmProfile.response_patterns || '{}');
        preferredThemes = JSON.parse(gmProfile.preferred_themes || '[]');
    } catch (error) {
        console.error('Error parsing GM profile data:', error);
    }
    
    // Build context for AI
    const contextText = recentPosts.map(post => {
        const author = post.username || 'Unknown';
        const type = post.post_type === 'gm' ? `[GM ${gmProfile.name}]` : `[Player ${author}]`;
        return `${type}: ${post.content}`;
    }).join('\n\n');
    
    // Create structured prompt (same as API endpoint)
    const personalityDescription = `You are ${gmProfile.name}, ${gmProfile.title}. 
        
Your philosophy: ${gmProfile.philosophy}

Your domain aspect: ${gmProfile.domain_aspect}
Your language style: ${gmProfile.language_style}
Your affiliation: ${gmProfile.affiliation}

Your gamemaster style: ${gmProfile.gamemaster_style}

Your personality traits: ${personalityTraits.join(', ')}
Your preferred themes: ${preferredThemes.join(', ')}

Game context:
- Game: ${game.name}
- Description: ${game.description || 'No description'}
- Genre: ${game.genre || 'fantasy'}

Recent conversation:
${contextText}

Based on your unique personality as ${gmProfile.name}, create a structured response to the latest player action.

Your response MUST follow this exact format:

**Kuvaus:** (2-3 sentences describing the scene, atmosphere, or consequences of recent actions)

**Tilanne:** (1-2 sentences clearly stating the current situation or challenge)

**Vaihtoehdot:** (Present exactly 3 clear action options for players to vote on)
A) [First option - a clear, specific action]
B) [Second option - a different approach]
C) [Third option - an alternative path]

**${gmProfile.name}:** (1-2 sentences of in-character dialogue or thoughts that reflect your personality)

Guidelines:
- Each option should be distinct and lead to different outcomes
- Options should be concrete actions, not vague directions
- Include at least one risky/bold option, one cautious option, and one creative/unexpected option
- Write in Finnish
- Stay true to your personality and domain
- Make options that advance the story
- Each option should be 1 sentence, clear and actionable`;

    // Generate AI response
    let aiResponse = '';
    
    try {
        // Call Anthropic API for structured response
        const anthropicResponse = await anthropic.messages.create({
            model: process.env.AI_MODEL || 'claude-3-haiku-20240307',
            max_tokens: 800,
            temperature: 0.8,
            messages: [
                {
                    role: 'user',
                    content: personalityDescription
                }
            ]
        });
        
        aiResponse = anthropicResponse.content[0].text;
        
    } catch (aiError) {
        console.error('Error calling Anthropic API:', aiError);
        
        // Fallback to structured template
        const sceneDesc = personalityTraits.includes('mystical') ? 
            'Mystinen energia täyttää ilman, ja todellisuuden rajat tuntuvat häilyvän. Varjot tanssivat omituisesti valossa.' :
            personalityTraits.includes('humorous') ? 
            'Tilanne on ottanut odottamattoman käänteen, ja jopa kohtalo näyttää pidättelevän nauruaan.' :
            'Jännite tiivistyy, ja jokainen hengenvetonne tuntuu merkitykselliseltä tässä ratkaisevassa hetkessä.';
        
        const situation = personalityTraits.includes('challenging') ?
            'Edessänne on haaste, joka testaa kykyänne ja päättäväisyyttänne.' :
            'Olette tilanteessa, jossa valintanne määrittelee seuraavat askeleet matkallanne.';
        
        const options = personalityTraits.includes('systematic') ? [
            'A) Analysoikaa tilanne huolellisesti ja etsikää looginen ratkaisu ongelmaan',
            'B) Luottakaa intuitioonne ja toimikaa sen mukaan, mitä sydämenne sanoo',
            'C) Etsikää epätavallinen lähestymistapa, jota kukaan ei osaa odottaa'
        ] : [
            'A) Rynnäkkää rohkeasti eteenpäin, kohtalo suosii rohkeita',
            'B) Vetäytykää hetkeksi ja arvioikaa tilanne uudelleen',
            'C) Yrittäkää neuvotella tai löytää diplomaattinen ratkaisu'
        ];
        
        const gmQuote = personalityTraits.includes('humorous') ?
            `*${gmProfile.name} virnistää* "No, tämäpä meni mielenkiintoiseksi! Katsotaan, miten tästä selvitään."` :
            personalityTraits.includes('mystical') ?
            `${gmProfile.name}:n ääni kaikuu: "Kohtalon langat kietoutuvat yhteen. Valintanne kirjoittaa seuraavan luvun."` :
            `${gmProfile.name} tarkkailee teitä: "Jokainen valinta kantaa seurauksia. Valitkaa viisaasti."`;
        
        aiResponse = `**Kuvaus:** ${sceneDesc}

**Tilanne:** ${situation}

**Vaihtoehdot:**
${options.join('\n')}

**${gmProfile.name}:** ${gmQuote}`;
    }
    
    // Create and save the GM post
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO posts (beat_id, author_id, title, content, post_type, created_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [beat_id, 1, `${gmProfile.name}`, aiResponse, 'gm'],
            function(err) {
                if (err) {
                    return reject(err);
                }
                
                const postId = this.lastID;
                
                // Generate image asynchronously
                (async () => {
                try {
                    // Extract scene description from the structured response
                    const descriptionMatch = aiResponse.match(/\*\*Kuvaus:\*\*\s*(.+?)(?=\n\n\*\*Tilanne:)/s);
                    const sceneDescription = descriptionMatch ? descriptionMatch[1].trim() : 'Fantasy RPG scene';
                    
                    // Create image prompt based on scene and GM personality
                    let imagePrompt = sceneDescription;
                    
                    // Add style based on GM personality
                    if (personalityTraits.includes('mystical')) {
                        imagePrompt += ', mystical atmosphere, ethereal lighting, magical energy, fantasy art style';
                    } else if (personalityTraits.includes('horror') || personalityTraits.includes('dark')) {
                        imagePrompt += ', dark atmosphere, ominous shadows, gothic horror style';
                    } else if (personalityTraits.includes('humorous')) {
                        imagePrompt += ', whimsical cartoon style, bright colors, playful atmosphere';
                    } else if (game.genre === 'scifi') {
                        imagePrompt += ', science fiction art, futuristic technology, cyberpunk aesthetic';
                    } else {
                        imagePrompt += ', epic fantasy art style, detailed illustration, atmospheric lighting';
                    }
                    
                    console.log('Generating image for auto AI GM post with prompt:', imagePrompt);
                    
                    // Generate the image
                    const imageBuffer = await imageService.generateImage(imagePrompt, { 
                        style: personalityTraits.includes('dark') ? 'gothic' : 'fantasy-art' 
                    });
                    
                    // Process and upload image
                    const { mainImage, thumbnail } = await imageService.processImage(imageBuffer);
                    
                    const timestamp = Date.now();
                    const imageKey = `games/${game_id}/posts/${postId}/auto_ai_gm_${timestamp}.jpg`;
                    const thumbnailKey = `games/${game_id}/posts/${postId}/auto_ai_gm_thumb_${timestamp}.jpg`;
                    
                    const imageUrl = await imageService.uploadToS3(mainImage, imageKey);
                    const thumbnailUrl = await imageService.uploadToS3(thumbnail, thumbnailKey);
                    
                    // Save image info to database
                    db.run(
                        `INSERT INTO post_images (post_id, user_id, image_url, thumbnail_url, prompt, generation_params)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [
                            postId,
                            1, // AI GM user ID
                            imageUrl,
                            thumbnailUrl,
                            imagePrompt,
                            JSON.stringify({ ai_generated: true, gm_profile: gmProfile.name, auto_trigger: true })
                        ]
                    );
                    
                    console.log('Auto AI GM image generated successfully:', imageUrl);
                    
                } catch (imageError) {
                    console.error('Error generating image for auto AI GM post:', imageError);
                }
                })(); // End async IIFE
                
                resolve({
                    success: true,
                    response: aiResponse,
                    gm_name: gmProfile.name,
                    post_id: postId,
                    personality_used: personalityTraits
                });
            }
        );
    });
}

// Trigger AI GM response after player post (automatic response system)
function triggerAIGMResponse(beatId, gameId, delayMs = 3000) {
    setTimeout(async () => {
        try {
            // Get game info to check if it has an AI GM
            const game = await new Promise((resolve, reject) => {
                db.get(`SELECT g.*, c.id as chapter_id 
                       FROM games g 
                       JOIN chapters c ON g.id = c.game_id 
                       JOIN beats b ON c.id = b.chapter_id 
                       WHERE b.id = ?`, [beatId], (err, result) => {
                    if (err) reject(err);
                    else resolve(result);
                });
            });
            
            if (!game) return;
            
            // Check if this game should have an AI GM response
            // For now, we'll check if the game has specific AI GM indicators
            // This could be enhanced to check for AI GM profile assignments
            
            // Get the most recent posts to determine if AI should respond
            const recentPosts = await new Promise((resolve, reject) => {
                db.all(`SELECT p.*, u.username 
                       FROM posts p 
                       LEFT JOIN users u ON p.author_id = u.id 
                       WHERE p.beat_id = ? 
                       ORDER BY p.created_at DESC 
                       LIMIT 3`, [beatId], (err, posts) => {
                    if (err) reject(err);
                    else resolve(posts);
                });
            });
            
            // Check if the last post was from a player (not GM) and game has AI GM
            const lastPost = recentPosts[0];
            if (lastPost && lastPost.post_type === 'player' && game.ai_gm_profile_id) {
                console.log(`AI GM auto-response triggered for beat ${beatId}, game ${gameId}, AI GM profile ${game.ai_gm_profile_id}`);
                
                // Generate AI GM response
                try {
                    // Get AI GM profile
                    const gmProfile = await new Promise((resolve, reject) => {
                        db.get(`SELECT * FROM ai_gm_profiles WHERE id = ? AND is_active = 1`, 
                            [game.ai_gm_profile_id], (err, profile) => {
                                if (err) reject(err);
                                else resolve(profile);
                            });
                    });
                    
                    if (gmProfile) {
                        // Call the AI GM response generation internally
                        await generateAIGMResponseInternal(gameId, beatId, game.ai_gm_profile_id, 'player_action');
                        console.log(`AI GM response generated automatically for game ${gameId}`);
                    }
                } catch (aiError) {
                    console.error('Error generating automatic AI GM response:', aiError);
                }
            }
            
        } catch (error) {
            console.error('Error in AI GM auto-response:', error);
        }
    }, delayMs);
}

// Update games table to support AI GM assignments
db.run(`ALTER TABLE games ADD COLUMN ai_gm_profile_id INTEGER REFERENCES ai_gm_profiles(id)`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
        console.log('Note: ai_gm_profile_id column may already exist or error occurred:', err.message);
    }
});

// GM SUGGESTION SYSTEM

// Generate AI suggestions for GM posts
app.post('/api/gm-suggestions', authenticateToken, async (req, res) => {
    const { suggestion_type, game_id, chapter_id, beat_id } = req.body;
    
    if (!suggestion_type || !game_id || !chapter_id || !beat_id) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    try {
        // Get game context
        const game = await new Promise((resolve, reject) => {
            db.get(`SELECT g.*, c.title as chapter_title, c.description as chapter_description 
                   FROM games g 
                   JOIN chapters c ON g.id = c.game_id 
                   WHERE g.id = ? AND c.id = ?`, [game_id, chapter_id], (err, result) => {
                if (err) reject(err);
                else resolve(result);
            });
        });
        
        if (!game) {
            return res.status(404).json({ error: 'Game or chapter not found' });
        }
        
        // Get recent posts for context (last 5 posts across all beats in the chapter)
        const recentPosts = await new Promise((resolve, reject) => {
            db.all(`SELECT p.*, b.title as beat_title, u.username
                   FROM posts p 
                   JOIN beats b ON p.beat_id = b.id
                   LEFT JOIN users u ON p.author_id = u.id
                   WHERE b.chapter_id = ?
                   ORDER BY p.created_at DESC 
                   LIMIT 5`, [chapter_id], (err, posts) => {
                if (err) reject(err);
                else resolve(posts.reverse()); // Reverse to get chronological order
            });
        });
        
        // Get current beat info
        const currentBeat = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM beats WHERE id = ?`, [beat_id], (err, beat) => {
                if (err) reject(err);
                else resolve(beat);
            });
        });
        
        // Build context for AI suggestions
        const contextText = recentPosts.map(post => {
            const author = post.username || 'Unknown';
            const type = post.post_type === 'gm' ? `[GM]` : `[Player ${author}]`;
            return `${type}: ${post.content}`;
        }).join('\n\n');
        
        // Create suggestion prompts based on type
        const suggestionPrompts = {
            plot_advancement: {
                description: "Suggest ways to advance the main plot",
                prompt: `Based on the current game situation, suggest 3 different structured GM posts that advance the main storyline. Each suggestion should follow this format:
                
**Kuvaus:** (2-3 sentences describing the scene)
**Tilanne:** (1-2 sentences stating the situation)
**Vaihtoehdot:** 
A) [Specific action option]
B) [Different approach]
C) [Alternative path]
**GM:** (1-2 sentences of GM commentary)`
            },
            character_development: {
                description: "Suggest character development opportunities", 
                prompt: `Based on the recent player actions, suggest 3 different structured GM posts that create character development opportunities. Each should follow this format:

**Kuvaus:** (2-3 sentences setting the scene)
**Tilanne:** (1-2 sentences presenting a personal challenge)
**Vaihtoehdot:**
A) [Action focusing on personal growth]
B) [Action focusing on relationships]
C) [Action focusing on beliefs/values]
**GM:** (1-2 sentences of GM perspective)`
            },
            environmental_details: {
                description: "Suggest environmental descriptions and atmosphere",
                prompt: `Suggest 3 different structured GM posts that use environmental details to create atmosphere and choices. Each should follow this format:

**Kuvaus:** (2-3 sentences with rich sensory details)
**Tilanne:** (1-2 sentences about environmental challenge/opportunity)
**Vaihtoehdot:**
A) [Action interacting with environment]
B) [Alternative environmental approach]
C) [Creative use of surroundings]
**GM:** (1-2 sentences enhancing mood)`
            },
            challenge_creation: {
                description: "Suggest challenges or obstacles",
                prompt: `Based on the current situation, suggest 3 different structured GM posts presenting challenges. Each should follow this format:

**Kuvaus:** (2-3 sentences introducing the challenge)
**Tilanne:** (1-2 sentences clarifying the stakes)
**Vaihtoehdot:**
A) [Direct confrontation option]
B) [Clever/indirect approach]
C) [Avoidance or negotiation]
**GM:** (1-2 sentences about consequences)`
            },
            dialogue_npc: {
                description: "Suggest NPC dialogue and interactions",
                prompt: `Suggest 3 different structured GM posts featuring NPC interactions. Each should follow this format:

**Kuvaus:** (2-3 sentences introducing the NPC and setting)
**Tilanne:** (1-2 sentences about what the NPC wants/offers)
**Vaihtoehdot:**
A) [Cooperative response option]
B) [Cautious/questioning approach]
C) [Bold/unexpected response]
**GM:** (1-2 sentences of NPC's reaction/personality)`
            },
            scene_transition: {
                description: "Suggest scene transitions and pacing",
                prompt: `Suggest 3 different structured GM posts that transition scenes. Each should follow this format:

**Kuvaus:** (2-3 sentences bridging from current to new scene)
**Tilanne:** (1-2 sentences about the transition point)
**Vaihtoehdot:**
A) [Move forward immediately]
B) [Investigate before proceeding]
C) [Take an alternate route]
**GM:** (1-2 sentences about timing/urgency)`
            }
        };
        
        const suggestionConfig = suggestionPrompts[suggestion_type];
        if (!suggestionConfig) {
            return res.status(400).json({ error: 'Invalid suggestion type' });
        }
        
        // Create full context prompt
        const fullPrompt = `You are assisting a Game Master in creating engaging content for a tabletop RPG session.

Game Context:
- Game: ${game.name}
- Description: ${game.description || 'No description'}
- Genre: ${game.genre || 'fantasy'}
- Current Chapter: ${game.chapter_title}
- Chapter Description: ${game.chapter_description || 'No description'}
- Current Beat: ${currentBeat?.title || 'Unknown'}

Recent Story Context:
${contextText || 'No previous posts yet'}

Task: ${suggestionConfig.description}

${suggestionConfig.prompt}

Please respond with exactly 3 suggestions in JSON format. Each suggestion's content should be the COMPLETE structured post following the format specified above:
{
    "suggestions": [
        {
            "title": "Brief title for this suggestion",
            "content": "**Kuvaus:** [2-3 sentences]\\n\\n**Tilanne:** [1-2 sentences]\\n\\n**Vaihtoehdot:**\\nA) [Option A]\\nB) [Option B]\\nC) [Option C]\\n\\n**GM:** [1-2 sentences]"
        },
        {
            "title": "Brief title for this suggestion", 
            "content": "**Kuvaus:** [2-3 sentences]\\n\\n**Tilanne:** [1-2 sentences]\\n\\n**Vaihtoehdot:**\\nA) [Option A]\\nB) [Option B]\\nC) [Option C]\\n\\n**GM:** [1-2 sentences]"
        },
        {
            "title": "Brief title for this suggestion",
            "content": "**Kuvaus:** [2-3 sentences]\\n\\n**Tilanne:** [1-2 sentences]\\n\\n**Vaihtoehdot:**\\nA) [Option A]\\nB) [Option B]\\nC) [Option C]\\n\\n**GM:** [1-2 sentences]"
        }
    ]
}

Write entirely in Finnish. Each option (A, B, C) should be a clear, actionable choice that players can vote on.`;
        
        // Generate suggestions using Anthropic API
        try {
            const suggestions = await generateAISuggestions(fullPrompt);
            res.json({ suggestions });
        } catch (aiError) {
            console.error('AI API error, falling back to placeholder suggestions:', aiError);
            // Fallback to placeholder suggestions if AI API fails
            const suggestions = generatePlaceholderSuggestions(suggestion_type, game);
            res.json({ suggestions });
        }
        
    } catch (error) {
        console.error('Error generating GM suggestions:', error);
        res.status(500).json({ error: 'Error generating suggestions: ' + error.message });
    }
});

// Generate suggestions using Anthropic API
async function generateAISuggestions(prompt) {
    try {
        const response = await anthropic.messages.create({
            model: process.env.AI_MODEL || 'claude-3-haiku-20240307',
            max_tokens: 1500,
            temperature: 0.7,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ]
        });
        
        const responseText = response.content[0].text;
        
        // Try to parse the JSON response
        try {
            const parsed = JSON.parse(responseText);
            return parsed.suggestions || [];
        } catch (parseError) {
            console.error('Failed to parse AI response as JSON:', parseError);
            console.log('AI Response:', responseText);
            
            // Try to extract suggestions from text if JSON parsing fails
            return extractSuggestionsFromText(responseText);
        }
        
    } catch (error) {
        console.error('Anthropic API error:', error);
        throw error;
    }
}

// Fallback function to extract suggestions from non-JSON AI response
function extractSuggestionsFromText(text) {
    // This is a fallback if the AI doesn't return proper JSON
    // Try to extract suggestions from the text response
    const suggestions = [];
    const lines = text.split('\n').filter(line => line.trim());
    
    let currentSuggestion = null;
    
    for (const line of lines) {
        // Look for numbered suggestions or clear titles
        if (line.match(/^\d+\./) || line.includes('**') || line.includes('Title:')) {
            if (currentSuggestion) {
                suggestions.push(currentSuggestion);
            }
            currentSuggestion = {
                title: line.replace(/^\d+\.?\s*/, '').replace(/\*\*/g, '').replace(/Title:\s*/i, '').trim(),
                content: ''
            };
        } else if (currentSuggestion && line.trim()) {
            currentSuggestion.content += (currentSuggestion.content ? ' ' : '') + line.trim();
        }
    }
    
    if (currentSuggestion) {
        suggestions.push(currentSuggestion);
    }
    
    // Ensure we have at least some suggestions
    if (suggestions.length === 0) {
        return [
            {
                title: "AI-ehdotus",
                content: text.substring(0, 200) + '...'
            }
        ];
    }
    
    return suggestions.slice(0, 3); // Return max 3 suggestions
}

// Placeholder suggestion generator (fallback when AI fails)
function generatePlaceholderSuggestions(type, game) {
    const genre = game.genre || 'fantasy';
    
    const suggestions = {
        plot_advancement: [
            {
                title: "Salaisuuden paljastuminen",
                content: `**Kuvaus:** Hämärä hahmo astuu esiin varjoista, kasvot kalpeina ja silmät täynnä epätoivoa. Hän ojentaa vapisevan käden kohti teitä, huulet liikkuvat kuiskaten jotain tärkeää.

**Tilanne:** Tuntematon henkilö yrittää kertoa teille jotain elintärkeää, mutta vaikuttaa pelkäävän jotakuta tai jotakin.

**Vaihtoehdot:**
A) Kuuntelkaa häntä huolellisesti ja yrittäkää rauhoittaa hänet saadaksenne selville koko totuuden
B) Viekää hänet turvallisempaan paikkaan ennen kuin kuuntelette hänen tarinaansa
C) Epäilkää ansaa ja valmistautukaa mahdolliseen hyökkäykseen

**GM:** "Totuus on vaarallinen taakka kantaa. Oletteko valmiita sen painoon?"`
            },
            {
                title: "Odottamaton liittolainen",
                content: `**Kuvaus:** Yllättäen kohtaatte kasvokkain henkilön, jonka olitte luulleet vastustajaksi. Hänen ilmeensä on vakava mutta ei vihamielinen, ja hän nostaa kätensä rauhan eleeksi.

**Tilanne:** Entinen vihollinen tarjoaa yllättäen apuaan yhteistä uhkaa vastaan.

**Vaihtoehdot:**
A) Hyväksykää tarjous, mutta pysykää varuillanne mahdollisen petoksen varalta
B) Kieltäytykää kohteliaasti ja jatkakaa omaa matkaanne
C) Vaatikaa todisteita hänen vilpittömyydestään ennen yhteistyötä

**GM:** "Joskus viholliset voivat muuttua liittolaisiksi, kun suurempi uhka yhdistää."`
            },
            {
                title: "Uhkaava määräaika",
                content: `**Kuvaus:** Viestintuoja saapuu hengästyneenä, vaatteet repaleina ja kasvoilla pelonsekainen ilme. Hän kaatuu polvilleen edessänne ja alkaa puhua katkonaisesti kiireellisestä asiasta.

**Tilanne:** Teillä on vain kolme päivää aikaa estää katastrofi, joka uhkaa koko aluetta.

**Vaihtoehdot:**
A) Lähtekää välittömästi matkaan, vaikka ette olisi täysin valmiita
B) Käyttäkää päivä valmistautumiseen ja tiedon keräämiseen
C) Yrittäkää löytää nopein reitti tai oikotie määränpäähän

**GM:** "Aika on teille nyt arvokkain ja samalla vaarallisin vihollinen."`
            }
        ],
        character_development: [
            {
                title: "Henkilökohtainen haaste",
                content: `**Kuvaus:** Tuttu ääni kutsuu nimeänne väkijoukon keskeltä. Kääntyessänne näette kasvojen, jotka toivoitte unohtaneenne - jonkun menneisyydestänne, jonka kanssa teillä on keskeneräisiä asioita.

**Tilanne:** Menneisyytenne haamu on palannut, ja hänen kanssaan on selvitettävä vanha velkanne tai rikkomuksenne.

**Vaihtoehdot:**
A) Kohtaatkaa henkilö rohkeasti ja yrittäkää selvittää asia kunnolla
B) Yrittäkää välttää kohtaamista ja jatkakaa matkaanne
C) Pyytäkää tovereitanne apuun menneisyytenne käsittelyssä

**GM:** "Menneisyys ei koskaan todella jätä meitä rauhaan - se vain odottaa oikeaa hetkeä palata."`
            },
            {
                title: "Moraalinen dilemma",
                content: `**Kuvaus:** Edessänne on kaksi ryhmää tarpeessa. Vasemmalla nälkäiset lapset kerjäävät ruokaa, oikealla haavoittunut sotilas anoo apua. Resurssejanne riittää vain yhden ryhmän auttamiseen.

**Tilanne:** Teidän on valittava, ketä autatte - molempia ei voida pelastaa.

**Vaihtoehdot:**
A) Auttakaa lapsia, sillä he ovat viattomia ja puolustuskyvyttömiä
B) Auttakaa sotilasta, joka saattaa palkita teidät tai auttaa myöhemmin
C) Yrittäkää jakaa apunne molemmille, vaikka se ei riittäisikään kunnolla kummallekaan

**GM:** "Joskus ei ole oikeita valintoja, vain valintoja joiden kanssa meidän on opittava elämään."`
            },
            {
                title: "Ryhmädynamiikan testaus",
                content: `**Kuvaus:** Saavutte risteykseen, jossa polku haarautuu kolmeen suuntaan. Jokainen ryhmänne jäsen näyttää olevan vahvasti eri mieltä siitä, mikä reitti olisi paras.

**Tilanne:** Ryhmänne on erimielinen jatkosta, ja päätös on tehtävä pian ennen pimeyden tuloa.

**Vaihtoehdot:**
A) Äänestäkää demokraattisesti ja noudattakaa enemmistön tahtoa
B) Anna kokeneimman tai viisaimman tehdä päätös koko ryhmän puolesta
C) Jakautukaa pienempiin ryhmiin ja tutkikaa kaikki vaihtoehdot nopeasti

**GM:** "Todellinen vahvuus ei ole yksilön voimassa, vaan ryhmän kyvyssä toimia yhdessä erimielisyyksistä huolimatta."`
            }
        ],
        environmental_details: [
            {
                title: "Aistien aktivointi",
                content: `**Kuvaus:** Ilma on raskas kosteudesta ja maaperästä nousee omituinen, makea tuoksu. Kaukaa kuuluu lintujen varoitushuutoja, ja tuuli tuo mukanaan savun hajua. Ihollanne tuntuu pistävä kylmyys, vaikka päivä on lämmin.

**Tilanne:** Ympäristö varoittaa teitä jostakin - luonto itse vaikuttaa levottomalta.

**Vaihtoehdot:**
A) Tutkikaa savun hajun lähdettä varovaisesti
B) Seuratkaa lintujen pakosuuntaa pois vaarasta
C) Pysykää paikallanne ja valmistautukaa puolustautumaan

**GM:** "Kun luonto vaikenee tai huutaa, viisas kuuntelee sen varoitusta."`
            },
            {
                title: "Sään vaikutus",
                content: `**Kuvaus:** Taivas tummenee uhkaavasti ja ensimmäiset raskaat sadepisarat alkavat putoilla. Tuuli yltyy, ja salamat valaisevat horisontin. Myrsky lähestyy nopeasti, ja suojaa on vaikea löytää.

**Tilanne:** Raju myrsky on tulossa, ja teidän on tehtävä päätös suojautumisesta.

**Vaihtoehdot:**
A) Etsikää suojaa läheisestä luolasta, vaikka se vaikuttaakin asutulta
B) Jatkakaa matkaa toivoen ehtivänne perille ennen myrskyn pahinta osaa
C) Pystyttäkää pikaleiri ja yrittäkää kestää myrsky parhaanne mukaan

**GM:** "Luonnonvoimat eivät kysy lupaa - ne vain tulevat ja testaavat valmiuttanne."`
            },
            {
                title: "Pienet yksityiskohdat",
                content: `**Kuvaus:** Huomaatte maassa outoja jälkiä - ei aivan eläimen, muttei ihmisenkin. Läheisen puun runkoon on kaiverrettu symboleita, jotka näyttävät tuoreilta. Ilmassa leijuu heikko, metallinen maku.

**Tilanne:** Ympäristö on täynnä merkkejä jostakin epätavallisesta toiminnasta.

**Vaihtoehdot:**
A) Tutkikaa symboleita tarkemmin yrittäen ymmärtää niiden merkityksen
B) Seuratkaa outoja jälkiä nähdäksenne minne ne johtavat
C) Merkitkää paikka muistiin ja jatkakaa alkuperäistä tehtäväänne

**GM:** "Joskus pienimmät yksityiskohdat paljastavat suurimmat salaisuudet."`
            }
        ],
        challenge_creation: [
            {
                title: "Sosiaalinen haaste",
                content: `**Kuvaus:** Vaikutusvaltainen kauppias istuu pöytänsä takana, sormet yhteen puristettuina ja ilme laskelmoiva. Hän tietää, että tarvitsette hänen apuaan, ja aikoo käyttää tilannetta hyväkseen.

**Tilanne:** Teidän on saatava kauppias yhteistyöhön ilman, että joudutte maksamaan kohtuuttoman hinnan.

**Vaihtoehdot:**
A) Vedotkaa hänen ahneudensen ja tarjotkaa suurempaa voittoa tulevaisuudessa
B) Yrittäkää löytää jotain, millä painostaa häntä yhteistyöhön
C) Etsikää hänen kilpailijansa ja pelatkaa heitä toisiaan vastaan

**GM:** "Kaupankäynnissä on kyse enemmästä kuin rahasta - kyse on vallasta ja vipuvarresta."`
            },
            {
                title: "Ympäristöhaaste",
                content: `**Kuvaus:** Edessänne on vanha riippusilta, jonka köydet näyttävät kuluneilta ja lankut mädäntyneiltä. Alta kuuluu joen pauhu, ja tuuli heiluttaa siltaa uhkaavasti. Toiselle puolelle on päästävä.

**Tilanne:** Ainoa tie eteenpäin on vaarallisen näköisen sillan yli.

**Vaihtoehdot:**
A) Ylittäkää silta yksi kerrallaan mahdollisimman varovasti
B) Etsikää materiaaleja ja yrittäkää vahvistaa siltaa ennen ylitystä
C) Kiertäkää jokea pitkin löytääksenne turvallisemman ylityspaikan

**GM:** "Joskus nopein reitti ei ole turvallisin, mutta hitain ei aina ole viisain."`
            },
            {
                title: "Ajan paine",
                content: `**Kuvaus:** Aurinko laskee nopeasti, ja pimeyden mukana saapuvat yön pedot. Kuulette jo ensimmäiset ulvonnat kaukaisuudessa. Suojapaikka on vielä tunnin matkan päässä.

**Tilanne:** Teidän on ehdittävä turvaan ennen kuin yön vaaralliset olennot heräävät.

**Vaihtoehdot:**
A) Juoskaa niin nopeasti kuin jaksatte, vaikka se uuvuttaisikin teidät
B) Etsikää väliaikainen suojapaikka ja odottakaa aamua
C) Valmistautukaa taisteluun ja kulkekaa normaalilla vauhdilla

**GM:** "Kun aika loppuu, jokainen sekunti muuttuu kultaa arvokkaammaksi."`
            }
        ],
        dialogue_npc: [
            {
                title: "Vihjaileva viisas",
                content: `**Kuvaus:** Vanha nainen istuu tien varressa, silmät suljettuna mutta selvästi tietoinen läsnäolostanne. Kun lähestytte, hän alkaa puhua ikään kuin olisi odottanut teitä.

**Tilanne:** Mystinen hahmo tarjoaa neuvoja arvoituksellisessa muodossa.

**Vaihtoehdot:**
A) Kuuntelkaa kärsivällisesti ja yrittäkää tulkita hänen sanojaan
B) Pyytäkää häntä puhumaan selkeämmin ja suoremmin
C) Tarjotkaa hänelle lahjaa saadaksenne konkreettisempia neuvoja

**GM:** "Viisaus ei aina tule selkeinä sanoina - joskus se vaatii ymmärrystä löytääkseen totuuden."`
            },
            {
                title: "Huolestunut paikallinen",
                content: `**Kuvaus:** Kyläläinen tarttuu käsivarteenne, silmät suurina pelosta. Hän kuiskaa kiireellisesti varoituksia ja vilkuilee jatkuvasti olkansa yli, ikään kuin pelkäisi jonkun kuulevan.

**Tilanne:** Paikallinen yrittää varoittaa teitä vaarasta, mutta pelkää itse joutuvansa vaikeuksiin.

**Vaihtoehdot:**
A) Rauhoitelkaa häntä ja yrittäkää saada koko tarina selville
B) Viekää hänet turvallisempaan paikkaan ennen keskustelun jatkamista
C) Kiittäkää varoituksesta ja jatkakaa matkaa varovaisemmin

**GM:** "Pelko saa ihmiset puhumaan tai vaikenemaan - teidän on päätettävä, kumpaa uskotte."`
            },
            {
                title: "Kilpaileva ryhmä",
                content: `**Kuvaus:** Kohtaatte toisen seikkailijajoukkon, joka näyttää olevan samalla asialla kuin te. He eivät vaikuta vihamielisiltä, mutta heidän johtajansa katse on haastava ja itsevarma.

**Tilanne:** Toinen ryhmä tavoittelee samaa päämäärää kuin te.

**Vaihtoehdot:**
A) Ehdottakaa yhteistyötä ja palkkion jakamista
B) Yrittäkää päästä perille ennen heitä pitämällä suunnitelmanne salassa
C) Haastaaka heidät reiluun kilpailuun siitä, kumpi ryhmä saa kunnian

**GM:** "Kilpailu voi tuoda esiin parhaat tai pahimmat puolemme - valinta on teidän."`
            }
        ],
        scene_transition: [
            {
                title: "Äkillinen keskeytys",
                content: `**Kuvaus:** Juuri kun olette päättämässä seuraavaa siirtoanne, maa alkaa täristä. Etäinen, kumea ääni kantautuu ilman halki, ja linnut nousevat pakokauhun vallassa lentoon.

**Tilanne:** Jokin suuri ja odottamaton tapahtuma keskeyttää nykyisen tilanteenne.

**Vaihtoehdot:**
A) Tutkikaa välittömästi häiriön lähdettä
B) Käyttäkää sekaannusta hyväksenne ja toimikaa alkuperäisen suunnitelman mukaan
C) Vetäytykää turvalliselle etäisyydelle ja arvioikaa tilanne

**GM:** "Suunnitelmat ovat hyviä, kunnes todellisuus päättää muuttaa sääntöjä."`
            },
            {
                title: "Hidas jännitysten nousu",
                content: `**Kuvaus:** Aluksi kaikki vaikuttaa normaalilta, mutta vähitellen huomaatte pieniä outoja yksityiskohtia. Ihmiset välttelevät katsettanne, kaupat sulkevat ovensa aikaisin, ja ilmassa on käsin kosketeltava jännitys.

**Tilanne:** Jokin on selvästi vialla, mutta kukaan ei halua kertoa mitä.

**Vaihtoehdot:**
A) Tutkikaa hienovaraisesti selvittääksenne, mitä tapahtuu
B) Kysykää suoraan ensimmäiseltä henkilöltä, jonka saatte kiinni
C) Valmistautukaa pahimpaan ja varustautukaa ennen tutkimista

**GM:** "Hiljaisuus ennen myrskyä on usein pelottavampaa kuin itse myrsky."`
            },
            {
                title: "Sijainnin vaihto",
                content: `**Kuvaus:** Viestintuoja saapuu hengästyneenä ja ojentaa sinetöidyn kirjeen. Sisältö on selvä - teidät tarvitaan kiireellisesti toisaalla, kaukana nykyisestä sijainnistanne.

**Tilanne:** Teidän on päätettävä, jätättekö nykyisen tehtävän ja vastaatte kutsuun.

**Vaihtoehdot:**
A) Lähtekää välittömästi uuteen kohteeseen
B) Hoitakaa ensin nykyinen asia loppuun ja lähtekää sitten
C) Jakautukaa - osa jatkaa nykyistä tehtävää, osa vastaa kutsuun

**GM:** "Jokainen valinta sulkee ovia ja avaa uusia - toivottavasti valitsette viisaasti."`
            }
        ]
    };
    
    return suggestions[type] || suggestions.plot_advancement;
}

// Generate structured opening post for new games
function generateStructuredOpening(gmProfile, gameName, genre) {
    const personalityTraits = JSON.parse(gmProfile.personality_traits || '[]');
    
    // Genre-specific opening scenes
    const genreOpenings = {
        fantasy: {
            description: "Saavutte pölyiseen kylään juuri auringonlaskun aikaan. Tavernan ikkunoista kajastaa lämmin valo, ja ilmassa leijuu ruoan ja oluen tuoksu. Kylän tori on hiljainen, mutta huomaatte liikettä varjoissa.",
            situation: "Olette matkanneet pitkään ja tarvitsette lepopaikan yöksi.",
            options: [
                "A) Menekää suoraan tavernaan ja ottakaa selvää paikallisista tapahtumista",
                "B) Tutkikaa ensin kylää ja sen ympäristöä varovaisesti",
                "C) Etsikää sopiva leiripaikka kylän ulkopuolelta välttääksenne huomiota"
            ]
        },
        scifi: {
            description: "Avaruusaluksenne hätälaskeutuu tuntemattomalle planeetalle. Mittarit näyttävät hengityskelpoista ilmakehää, mutta viestintälaitteet ovat rikki. Horisontissa näkyy rakennelmia, jotka saattavat olla asuttuja.",
            situation: "Teidän on päätettävä, miten selviytyä vieraalla planeetalla.",
            options: [
                "A) Lähtekää tutkimaan läheisiä rakennelmia apua etsien",
                "B) Pysykää aluksen luona ja yrittäkää korjata viestintälaitteet",
                "C) Kerääkää tarvikkeita ja valmistautukaa pitkään oleskeluun"
            ]
        },
        mystery: {
            description: "Saavutte perille vanhaan kartanoon, jonne teidät on kutsuttu. Sade piiskaa ikkunoita, ja ukkosmyrsky piirtää salamoillaan pelottavia varjoja seinille. Palvelija avaa oven, mutta vaikuttaa hermostuneelta.",
            situation: "Isäntäväki on kadoksissa, ja kartanossa vallitsee outo tunnelma.",
            options: [
                "A) Kysykää palvelijalta suoraan, mitä on tapahtunut",
                "B) Pyytäkää, että teidät viedään huoneisiinne ja tutkikaa itse",
                "C) Vaatikaa tavata joku vastuuhenkilö välittömästi"
            ]
        },
        horror: {
            description: "Auto sammuu keskellä ei-mitään. Kännyköissä ei ole kenttää, ja pimeys ympärillänne on läpitunkematonta. Kaukaa kuuluu outoja ääniä, joita ette pysty tunnistamaan. Kylmä hiki nousee otsallenne.",
            situation: "Olette jumissa tuntemattomalla seudulla, ja jokin lähestyy.",
            options: [
                "A) Jääkää autoon ja lukitkaa ovet odottaen aamua",
                "B) Lähtekää kävelemään tietä pitkin apua etsien",
                "C) Tutkikaa äänen lähdettä taskulamppujen kanssa"
            ]
        },
        adventure: {
            description: "Seisotte muinaisen kartan äärellä, joka johdatti teidät tänne. Edessänne avautuu viidakon peittämä laakso, jonka keskellä kohoaa mystinen temppeli. Ilma on kostea ja täynnä vaaraa.",
            situation: "Aarteen etsintä on alkanut, mutta ette ole yksin.",
            options: [
                "A) Laskeutukaa laaksoon suorinta reittiä temppelille",
                "B) Kierrä laakson reunaa pitkin ja tarkkaile tilannetta",
                "C) Leiriydy yöksi ja lähde liikkeelle aamun valossa"
            ]
        }
    };
    
    const opening = genreOpenings[genre] || genreOpenings.fantasy;
    
    // Personality-based GM commentary
    let gmComment = "";
    if (personalityTraits.includes('mystical')) {
        gmComment = `${gmProfile.name}:n ääni kaikuu mielessänne: "Kohtalon langat alkavat kutoutua. Jokainen valintanne muokkaa tulevaa."`;
    } else if (personalityTraits.includes('humorous')) {
        gmComment = `${gmProfile.name} kuiskaa: "No niin, seikkailu alkaa! Toivottavasti olette pakannut mukaan huumorintajun - tulette tarvitsemaan sitä!"`;
    } else if (personalityTraits.includes('challenging')) {
        gmComment = `${gmProfile.name} toteaa tylysti: "Tästä alkaa teidän koettelemuksenne. Katsotaan, oletteko sen arvoisia."`;
    } else if (personalityTraits.includes('systematic')) {
        gmComment = `${gmProfile.name} selittää: "Tilanne on selvä. Analysoikaa vaihtoehdot huolellisesti - ensimmäinen valinta määrittää suunnan."`;
    } else {
        gmComment = `${gmProfile.name} toivottaa: "Tervetuloa seikkailuun. Teidän tarinanne alkaa nyt."`;
    }
    
    return `**Kuvaus:** ${opening.description}

**Tilanne:** ${opening.situation}

**Vaihtoehdot:**
${opening.options.join('\n')}

**${gmProfile.name}:** ${gmComment}`;
}

// ==========================================
// WIKI API ENDPOINTS
// ==========================================

// Get all wiki entries with optional filtering (public viewing allowed)
app.get('/api/wiki/entries', optionalAuth, async (req, res) => {
    try {
        const { category, search, tags, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Build the query dynamically based on filters
        let query = `
            SELECT w.*, u.username as author_name
            FROM wiki_entries w
            LEFT JOIN users u ON w.author_id = u.id
            WHERE w.status = 'published'
        `;
        const params = [];
        
        // Add category filter
        if (category && category !== 'all') {
            query += ` AND w.category = ?`;
            params.push(category);
        }
        
        // Add search filter (searches in title, excerpt, and content)
        if (search) {
            query += ` AND (w.title LIKE ? OR w.excerpt LIKE ? OR w.content LIKE ?)`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        // Get total count for pagination
        const countQuery = query.replace('SELECT w.*, u.username as author_name', 'SELECT COUNT(*) as total');
        
        db.get(countQuery, params, (err, countRow) => {
            if (err) {
                console.error('Error counting wiki entries:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            // Add ordering and pagination
            query += ` ORDER BY w.created_at DESC LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), offset);
            
            db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('Error fetching wiki entries:', err);
                    return res.status(500).json({ success: false, error: 'Database error' });
                }
                
                // Parse JSON fields and filter by tags if needed
                let entries = rows.map(row => ({
                    ...row,
                    tags: row.tags ? JSON.parse(row.tags) : [],
                    related: row.related ? JSON.parse(row.related) : []
                }));
                
                // Filter by tags if provided
                if (tags) {
                    const tagList = tags.split(',').map(tag => tag.trim().toLowerCase());
                    entries = entries.filter(entry =>
                        entry.tags.some(tag => tagList.includes(tag.toLowerCase()))
                    );
                }
                
                // If no entries in database, return sample data
                if (entries.length === 0 && !search && !category && !tags) {
                    const sampleEntries = getSampleWikiEntries();
                    return res.json({
                        success: true,
                        entries: sampleEntries,
                        count: sampleEntries.length,
                        totalCount: sampleEntries.length,
                        page: parseInt(page),
                        totalPages: Math.ceil(sampleEntries.length / parseInt(limit))
                    });
                }
                
                res.json({
                    success: true,
                    entries: entries,
                    count: entries.length,
                    totalCount: countRow.total,
                    page: parseInt(page),
                    totalPages: Math.ceil(countRow.total / parseInt(limit))
                });
            });
        });
        
    } catch (error) {
        console.error('Error fetching wiki entries:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Internal server error' 
        });
    }
});

// Get specific wiki entry by ID (public viewing allowed)
app.get('/api/wiki/entries/:entryId', optionalAuth, async (req, res) => {
    try {
        const entryId = req.params.entryId;
        
        // Try to get from database first
        db.get(`
            SELECT w.*, u.username as author_name, u2.username as updated_by_name
            FROM wiki_entries w
            LEFT JOIN users u ON w.author_id = u.id
            LEFT JOIN users u2 ON w.updated_by = u2.id
            WHERE w.id = ? AND w.status = 'published'
        `, [entryId], (err, row) => {
            if (err) {
                console.error('Error fetching wiki entry:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (row) {
                // Parse JSON fields
                const entry = {
                    ...row,
                    tags: row.tags ? JSON.parse(row.tags) : [],
                    related: row.related ? JSON.parse(row.related) : []
                };
                
                return res.json({
                    success: true,
                    entry: entry
                });
            }
            
            // Fallback to sample data if not in database
            const sampleEntries = getSampleWikiEntries();
            const sampleEntry = sampleEntries.find(e => e.id === entryId);
            
            if (!sampleEntry) {
                return res.status(404).json({
                    success: false,
                    error: 'Wiki entry not found'
                });
            }
            
            res.json({
                success: true,
                entry: sampleEntry
            });
        });
    } catch (error) {
        console.error('Error fetching wiki entry:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get wiki categories with counts (public viewing allowed)
app.get('/api/wiki/categories', optionalAuth, async (req, res) => {
    try {
        // Get category counts from database
        const categoryCounts = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    category,
                    COUNT(*) as count
                FROM wiki_entries 
                WHERE status = 'published'
                GROUP BY category
                ORDER BY category
            `, [], (err, rows) => {
                if (err) reject(err);
                else {
                    const counts = {};
                    rows.forEach(row => {
                        counts[row.category] = row.count;
                    });
                    resolve(counts);
                }
            });
        });
        
        // Get total count
        const total = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as total 
                FROM wiki_entries 
                WHERE status = 'published'
            `, [], (err, row) => {
                if (err) reject(err);
                else resolve(row?.total || 0);
            });
        });
        
        const categories = [
            { id: 'all', name: 'All Entries', count: total },
            { id: 'culture', name: 'Cultures', count: categoryCounts.culture || 0 },
            { id: 'geography', name: 'Geography', count: categoryCounts.geography || 0 },
            { id: 'mythology', name: 'Mythology', count: categoryCounts.mythology || 0 },
            { id: 'magic', name: 'Magic Systems', count: categoryCounts.magic || 0 },
            { id: 'history', name: 'History', count: categoryCounts.history || 0 },
            { id: 'characters', name: 'Notable Figures', count: categoryCounts.characters || 0 },
            { id: 'organizations', name: 'Organizations', count: categoryCounts.organizations || 0 },
            { id: 'economics', name: 'Economics', count: categoryCounts.economics || 0 },
            { id: 'cities', name: 'Cities & Places', count: categoryCounts.cities || 0 }
        ];
        
        res.json({
            success: true,
            categories: categories,
            total: total
        });
        
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Helper function to get sample wiki entries
function getSampleWikiEntries() {
    return [
        {
            id: 'cultures-of-eno',
            title: 'Cultures of Eno',
            category: 'culture',
            excerpt: 'The diverse societies of Eno, each with unique biological and spiritual characteristics shaped by their valleys.',
            content: `The planet Eno hosts numerous distinct cultures, each adapted to their specific valley environments:

**Night Valley Cultures**: Known for their connection to shadows and mysteries, these societies have developed unique forms of magic and communication that function in perpetual twilight.

**Day Valley Cultures**: Radiant societies that harness light and energy, creating advanced technologies powered by perpetual sunshine.

**Dawn Valley Cultures**: Transitional societies that celebrate beginnings and change, known for their healing arts and agricultural innovations.

**Dusk Valley Cultures**: Philosophical societies focused on endings and reflection, maintaining vast libraries and archives of knowledge.`,
            tags: ['valleys', 'societies', 'biology', 'spirituality'],
            related: ['night-valley', 'day-valley', 'dawn-valley', 'dusk-valley']
        },
        {
            id: 'night-valley',
            title: 'Night Valley',
            category: 'geography',
            excerpt: 'The realm of shadows and mysteries, where ancient magic still lingers in eternal twilight.',
            content: `Night Valley exists in a state of perpetual twilight, creating a unique ecosystem and culture. Major cities include:

**Palwede**: A major port city with 47,137 inhabitants, featuring impressive fortifications and a thriving shadow market.

**Ithemate**: Known for its mystical academies and connection to ancient magics.

The valley's cool climate and mysterious atmosphere have shaped its inhabitants into master traders and scholars of the arcane.`,
            tags: ['valley', 'geography', 'darkness', 'shadow', 'cities'],
            related: ['cultures-of-eno', 'palwede-city', 'shadow-magic']
        },
        {
            id: 'soul-system',
            title: 'The Soul System of Eno',
            category: 'mythology',
            excerpt: 'The hierarchical soul structure that connects all entities in Eno, from the Primordial World Soul to individual beings.',
            content: `The Soul System is the fundamental spiritual framework of Eno:

**Primordial World Soul**: The all-encompassing source of all souls in Eno, containing the essence of the entire world.

**Valley Souls**: Four major souls corresponding to each valley:
- Valley Soul of Darkness (Night)
- Valley Soul of Light (Day)  
- Valley Soul of Beginnings (Dawn)
- Valley Soul of Endings (Dusk)

**Entity Souls**: Every city, building, and individual possesses a soul that connects to the greater hierarchy, creating a web of spiritual interconnection.`,
            tags: ['souls', 'spirituality', 'mythology', 'hierarchy'],
            related: ['cultures-of-eno', 'magic-systems']
        },
        {
            id: 'economic-networks',
            title: 'Trade Networks of Eno',
            category: 'economics',
            excerpt: 'The complex trade relationships between cities, focusing on luxury goods and regional specialties.',
            content: `Eno's economy is characterized by sophisticated trade networks:

**Major Trade Hubs**:
- Guild: Population 79,193 - Industrial center and major port
- Mahyapak: Population 71,912 - Industrial powerhouse with extensive trade routes
- Jeong: Population 50,393 - Central market connecting multiple valleys

**Primary Trade Goods**:
- Jewelry: High-value luxury items traded across vast distances
- Machinery: Industrial products from advanced cities
- Textiles: Woven goods from medieval settlements
- Raw Materials: Wood, stone, and food for local consumption

Trade is primarily conducted in luxury goods due to transportation costs over long distances.`,
            tags: ['trade', 'economy', 'cities', 'resources'],
            related: ['guild-city', 'mahyapak-city', 'resource-taxonomy']
        },
        {
            id: 'magic-systems',
            title: 'Magic Systems',
            category: 'magic',
            excerpt: 'The various forms of magic practiced across Eno, shaped by valley influences and soul connections.',
            content: `Magic in Eno manifests differently in each valley:

**Shadow Magic (Night Valley)**: Manipulation of darkness and mystery, used for concealment and revelation of hidden truths.

**Light Magic (Day Valley)**: Harnessing of radiant energy for creation and transformation.

**Transition Magic (Dawn Valley)**: Powers of change and renewal, particularly strong in healing and growth.

**Reflection Magic (Dusk Valley)**: Abilities related to memory, wisdom, and temporal manipulation.

All magic is connected to the soul system, with practitioners drawing power from their connection to valley souls.`,
            tags: ['magic', 'valleys', 'souls', 'power'],
            related: ['soul-system', 'night-valley', 'day-valley']
        },
        {
            id: 'guild-city',
            title: 'Guild',
            category: 'geography',
            excerpt: 'The largest city in Eno with 79,193 inhabitants, a major industrial and trading center.',
            content: `Guild stands as Eno's most populous city and economic powerhouse:

**Demographics**: 79,193 inhabitants at Industrial technology level
**Infrastructure**: Major port, central market, impressive fortifications, grand temple
**Culture**: Wildlands culture following the Isti religion
**Economy**: Center of machinery production and luxury goods trade

Founded in year 50, Guild has grown to become the primary hub for inter-valley commerce.`,
            tags: ['city', 'trade', 'industry', 'port'],
            related: ['economic-networks', 'trade-routes']
        },
        {
            id: 'technological-eras',
            title: 'Technology Levels',
            category: 'history',
            excerpt: 'The three technological eras that define settlement capabilities and trade relationships.',
            content: `Eno's settlements exist at different technological levels:

**Tribal Era** (66% of settlements):
- Basic tools and organic agriculture
- Limited trade capabilities
- Subsistence economies
- Population typically under 10,000

**Medieval Era** (30% of settlements):
- Metal working and complex crafts
- Regional trade networks
- Fortified cities
- Populations 10,000-50,000

**Industrial Era** (4% of settlements):
- Machinery and mass production
- Global trade capabilities
- Advanced infrastructure
- Populations exceeding 50,000

The technological disparity creates unique trade opportunities and cultural exchanges.`,
            tags: ['technology', 'progress', 'civilization', 'development'],
            related: ['economic-networks', 'guild-city']
        }
    ];
}

// Create or update wiki entry (Editor and Admin only)
app.post('/api/wiki/entries', authenticateToken, authorize(['editor', 'admin']), async (req, res) => {
    try {
        const { title, category, excerpt, content, tags, related } = req.body;
        
        if (!title || !category || !content) {
            return res.status(400).json({ 
                success: false, 
                error: 'Title, category, and content are required' 
            });
        }
        
        // Sanitize content to prevent XSS
        const sanitizedContent = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        
        // Generate excerpt if not provided
        const finalExcerpt = excerpt || sanitizedContent.replace(/<[^>]*>/g, '').substring(0, 150) + '...';
        
        // Convert arrays to JSON strings
        const tagsJson = JSON.stringify(tags || []);
        const relatedJson = JSON.stringify(related || []);
        
        // Insert into database
        const query = `
            INSERT INTO wiki_entries (
                title, category, excerpt, content, tags, related,
                author_id, created_at, updated_at, status, version_number
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), 'published', 1)
        `;
        
        db.run(query, [
            title,
            category,
            finalExcerpt,
            sanitizedContent,
            tagsJson,
            relatedJson,
            req.user.id
        ], function(err) {
            if (err) {
                console.error('Error creating wiki entry:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            const entryId = this.lastID;
            
            // Create initial version in history
            const historyQuery = `
                INSERT INTO wiki_entry_history (
                    entry_id, version_number, title, category, excerpt, content,
                    tags, related, edited_by, edited_at, change_summary
                ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 'Initial creation')
            `;
            
            db.run(historyQuery, [
                entryId,
                title,
                category,
                finalExcerpt,
                sanitizedContent,
                tagsJson,
                relatedJson,
                req.user.id
            ], (historyErr) => {
                if (historyErr) {
                    console.error('Error creating wiki entry history:', historyErr);
                }
                
                // Return the created entry
                res.json({
                    success: true,
                    message: 'Wiki entry created successfully',
                    entry: {
                        id: entryId,
                        title,
                        category,
                        excerpt: finalExcerpt,
                        content: sanitizedContent,
                        tags: tags || [],
                        related: related || [],
                        author_id: req.user.id,
                        author_name: req.user.username,
                        created_at: new Date().toISOString(),
                        version_number: 1
                    }
                });
            });
        });
    } catch (error) {
        console.error('Error creating wiki entry:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Update wiki entry (Editor and Admin only)
app.put('/api/wiki/entries/:entryId', authenticateToken, authorize(['editor', 'admin']), async (req, res) => {
    try {
        const { entryId } = req.params;
        const { title, category, excerpt, content, tags, related } = req.body;
        
        // First, get the current entry to save to history
        db.get('SELECT * FROM wiki_entries WHERE id = ?', [entryId], (err, currentEntry) => {
            if (err) {
                console.error('Error fetching wiki entry:', err);
                return res.status(500).json({ success: false, error: 'Database error' });
            }
            
            if (!currentEntry) {
                return res.status(404).json({ success: false, error: 'Wiki entry not found' });
            }
            
            // Save current version to history
            const historyQuery = `
                INSERT INTO wiki_entry_history (
                    entry_id, version_number, title, category, excerpt, content,
                    tags, related, edited_by, edited_at, change_summary
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
            `;
            
            db.run(historyQuery, [
                entryId,
                currentEntry.version_number,
                currentEntry.title,
                currentEntry.category,
                currentEntry.excerpt,
                currentEntry.content,
                currentEntry.tags,
                currentEntry.related,
                req.user.id,
                'Updated by ' + req.user.username
            ], (historyErr) => {
                if (historyErr) {
                    console.error('Error creating wiki entry history:', historyErr);
                }
                
                // Sanitize content if provided
                const sanitizedContent = content ? content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') : currentEntry.content;
                
                // Update the entry
                const updateQuery = `
                    UPDATE wiki_entries 
                    SET title = ?, category = ?, excerpt = ?, content = ?, 
                        tags = ?, related = ?, updated_at = datetime('now'), 
                        updated_by = ?, version_number = version_number + 1
                    WHERE id = ?
                `;
                
                db.run(updateQuery, [
                    title || currentEntry.title,
                    category || currentEntry.category,
                    excerpt || currentEntry.excerpt,
                    sanitizedContent,
                    tags ? JSON.stringify(tags) : currentEntry.tags,
                    related ? JSON.stringify(related) : currentEntry.related,
                    req.user.id,
                    entryId
                ], function(updateErr) {
                    if (updateErr) {
                        console.error('Error updating wiki entry:', updateErr);
                        return res.status(500).json({ success: false, error: 'Database error' });
                    }
                    
                    // Fetch the updated entry
                    db.get(`
                        SELECT w.*, u.username as author_name
                        FROM wiki_entries w
                        LEFT JOIN users u ON w.author_id = u.id
                        WHERE w.id = ?
                    `, [entryId], (fetchErr, updatedEntry) => {
                        if (fetchErr) {
                            console.error('Error fetching updated entry:', fetchErr);
                            return res.status(500).json({ success: false, error: 'Database error' });
                        }
                        
                        res.json({
                            success: true,
                            message: 'Wiki entry updated successfully',
                            entry: {
                                ...updatedEntry,
                                tags: updatedEntry.tags ? JSON.parse(updatedEntry.tags) : [],
                                related: updatedEntry.related ? JSON.parse(updatedEntry.related) : [],
                                updated_by_username: req.user.username
                            }
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error updating wiki entry:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Search wiki entries with autocomplete support
app.get('/api/wiki/search', optionalAuth, async (req, res) => {
    try {
        const { q, limit = 10 } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({ results: [] });
        }
        
        // Search in title, excerpt, and content with relevance scoring
        const searchTerm = `%${q}%`;
        const results = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    id,
                    title,
                    category,
                    excerpt,
                    tags,
                    CASE 
                        WHEN title LIKE ? THEN 3
                        WHEN excerpt LIKE ? THEN 2
                        WHEN content LIKE ? THEN 1
                        ELSE 0
                    END as relevance
                FROM wiki_entries
                WHERE status = 'published'
                AND (
                    title LIKE ?
                    OR excerpt LIKE ?
                    OR content LIKE ?
                    OR tags LIKE ?
                )
                ORDER BY relevance DESC, title ASC
                LIMIT ?
            `, [
                searchTerm, searchTerm, searchTerm,
                searchTerm, searchTerm, searchTerm, searchTerm,
                parseInt(limit)
            ], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Parse JSON fields and format response
        const formattedResults = results.map(row => ({
            id: row.id,
            title: row.title,
            category: row.category,
            excerpt: row.excerpt,
            tags: row.tags ? JSON.parse(row.tags) : [],
            relevance: row.relevance
        }));
        
        res.json({
            success: true,
            query: q,
            results: formattedResults,
            count: formattedResults.length
        });
    } catch (error) {
        console.error('Error searching wiki entries:', error);
        res.status(500).json({ success: false, error: 'Search failed' });
    }
});

// Get wiki entry version history
app.get('/api/wiki/entries/:entryId/history', authenticateToken, async (req, res) => {
    try {
        const { entryId } = req.params;
        
        const history = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    h.*,
                    u.username as author_name
                FROM wiki_entry_history h
                LEFT JOIN users u ON h.edited_by = u.id
                WHERE h.entry_id = ?
                ORDER BY h.version_number DESC
            `, [entryId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        res.json({
            success: true,
            entryId: entryId,
            history: history.map(h => ({
                ...h,
                tags: h.tags ? JSON.parse(h.tags) : [],
                related: h.related ? JSON.parse(h.related) : []
            }))
        });
    } catch (error) {
        console.error('Error fetching version history:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }
});

// Get wiki graph data for visualization
app.get('/api/wiki/graph', optionalAuth, async (req, res) => {
    try {
        // Fetch all published entries with their relationships
        const entries = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    id, 
                    title, 
                    category, 
                    excerpt,
                    tags,
                    related
                FROM wiki_entries 
                WHERE status = 'published'
                ORDER BY title
            `, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
        
        // Build nodes and links for graph visualization
        const nodes = [];
        const links = [];
        const nodeMap = new Map();
        
        // Create nodes from entries
        entries.forEach(entry => {
            const tags = entry.tags ? JSON.parse(entry.tags) : [];
            const related = entry.related ? JSON.parse(entry.related) : [];
            
            const node = {
                id: `entry-${entry.id}`,
                entryId: entry.id,
                title: entry.title,
                category: entry.category,
                excerpt: entry.excerpt,
                tags: tags,
                related: related,
                type: 'entry',
                size: Math.max(10, entry.title.length / 3), // Node size based on title length
                color: getCategoryColor(entry.category)
            };
            
            nodes.push(node);
            nodeMap.set(entry.id.toString(), node);
        });
        
        // Create tag nodes (smaller nodes for common tags)
        const tagCounts = new Map();
        entries.forEach(entry => {
            const tags = entry.tags ? JSON.parse(entry.tags) : [];
            tags.forEach(tag => {
                tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
            });
        });
        
        // Only create tag nodes for tags used by multiple entries
        Array.from(tagCounts.entries())
            .filter(([tag, count]) => count >= 2)
            .forEach(([tag, count]) => {
                nodes.push({
                    id: `tag-${tag}`,
                    title: `#${tag}`,
                    type: 'tag',
                    size: 5 + (count * 2),
                    color: '#95a5a6',
                    count: count
                });
            });
        
        // Create links between entries and their related entries
        entries.forEach(entry => {
            const related = entry.related ? JSON.parse(entry.related) : [];
            const sourceNode = nodeMap.get(entry.id.toString());
            
            if (sourceNode) {
                // Link to related entries
                related.forEach(relatedId => {
                    const targetNode = nodeMap.get(relatedId.toString()) || 
                                     entries.find(e => e.title.toLowerCase().includes(relatedId.toLowerCase()));
                    
                    if (targetNode) {
                        links.push({
                            source: sourceNode.id,
                            target: `entry-${targetNode.id}`,
                            type: 'related',
                            strength: 1.0
                        });
                    }
                });
                
                // Link to tag nodes for frequently used tags
                const tags = entry.tags ? JSON.parse(entry.tags) : [];
                tags.forEach(tag => {
                    if (tagCounts.get(tag) >= 2) {
                        links.push({
                            source: sourceNode.id,
                            target: `tag-${tag}`,
                            type: 'tag',
                            strength: 0.3
                        });
                    }
                });
            }
        });
        
        res.json({
            success: true,
            nodes: nodes,
            links: links,
            stats: {
                entryCount: entries.length,
                nodeCount: nodes.length,
                linkCount: links.length,
                categories: [...new Set(entries.map(e => e.category))],
                topTags: Array.from(tagCounts.entries())
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 10)
            }
        });
        
    } catch (error) {
        console.error('Error generating graph data:', error);
        
        // Fallback to sample data
        const sampleEntries = getSampleWikiEntries();
        const nodes = sampleEntries.map(entry => ({
            id: `entry-${entry.id}`,
            entryId: entry.id,
            title: entry.title,
            category: entry.category,
            excerpt: entry.excerpt,
            type: 'entry',
            size: Math.max(10, entry.title.length / 3),
            color: getCategoryColor(entry.category)
        }));
        
        const links = [];
        sampleEntries.forEach(entry => {
            if (entry.related) {
                entry.related.forEach(relatedId => {
                    const target = sampleEntries.find(e => e.id === relatedId);
                    if (target) {
                        links.push({
                            source: `entry-${entry.id}`,
                            target: `entry-${target.id}`,
                            type: 'related',
                            strength: 1.0
                        });
                    }
                });
            }
        });
        
        res.json({
            success: true,
            nodes: nodes,
            links: links,
            stats: {
                entryCount: sampleEntries.length,
                nodeCount: nodes.length,
                linkCount: links.length
            }
        });
    }
});

// Helper function to get category colors for graph visualization
function getCategoryColor(category) {
    const colors = {
        'culture': '#e74c3c',      // Red
        'geography': '#27ae60',    // Green
        'mythology': '#9b59b6',    // Purple
        'magic': '#3498db',        // Blue
        'history': '#f39c12',      // Orange
        'characters': '#e67e22',   // Dark orange
        'organizations': '#34495e', // Dark gray
        'economics': '#16a085',    // Teal
        'cities': '#2c3e50',       // Very dark gray
        'default': '#95a5a6'       // Light gray
    };
    
    return colors[category] || colors.default;
}

// Delete wiki entry (Admin only)
app.delete('/api/wiki/entries/:entryId', authenticateToken, authorize(['admin']), async (req, res) => {
    try {
        const { entryId } = req.params;
        
        // In a real implementation, this would delete from database
        res.json({
            success: true,
            message: 'Wiki entry deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting wiki entry:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// === GEOSPATIAL API ENDPOINTS ===

// Get geospatial data from Mundi system
app.get('/api/geo/cities', optionalAuth, async (req, res) => {
    try {
        const citiesPath = path.join(__dirname, '../../Mundi/mundi.ai/eno-cities-scaled.geojson');
        
        if (!fs.existsSync(citiesPath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Cities geospatial data not found' 
            });
        }
        
        const geojsonData = JSON.parse(fs.readFileSync(citiesPath, 'utf8'));
        
        // Add wiki entry associations where city names match
        if (geojsonData.features) {
            for (let feature of geojsonData.features) {
                const cityName = feature.properties.Burg;
                if (cityName) {
                    // Check if there's a matching wiki entry
                    const wikiEntry = await new Promise((resolve) => {
                        db.get(`
                            SELECT id, title, category, excerpt
                            FROM wiki_entries
                            WHERE status = 'published' 
                            AND (LOWER(title) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?))
                        `, [`%${cityName}%`, `%${cityName}%`], (err, row) => {
                            if (err) resolve(null);
                            else resolve(row);
                        });
                    });
                    
                    if (wikiEntry) {
                        feature.properties.wikiEntry = wikiEntry;
                    }
                }
            }
        }
        
        res.json({
            success: true,
            data: geojsonData,
            type: 'cities'
        });
        
    } catch (error) {
        console.error('Error loading cities data:', error);
        res.status(500).json({ success: false, error: 'Failed to load cities data' });
    }
});

// Get rivers geospatial data
app.get('/api/geo/rivers', optionalAuth, async (req, res) => {
    try {
        const riversPath = path.join(__dirname, '../../Mundi/mundi.ai/eno-rivers-scaled.geojson');
        
        if (!fs.existsSync(riversPath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Rivers geospatial data not found' 
            });
        }
        
        const geojsonData = JSON.parse(fs.readFileSync(riversPath, 'utf8'));
        
        res.json({
            success: true,
            data: geojsonData,
            type: 'rivers'
        });
        
    } catch (error) {
        console.error('Error loading rivers data:', error);
        res.status(500).json({ success: false, error: 'Failed to load rivers data' });
    }
});

// Get lakes geospatial data
app.get('/api/geo/lakes', optionalAuth, async (req, res) => {
    try {
        const lakesPath = path.join(__dirname, '../../Mundi/mundi.ai/eno-lakes-scaled.geojson');
        
        if (!fs.existsSync(lakesPath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Lakes geospatial data not found' 
            });
        }
        
        const geojsonData = JSON.parse(fs.readFileSync(lakesPath, 'utf8'));
        
        res.json({
            success: true,
            data: geojsonData,
            type: 'lakes'
        });
        
    } catch (error) {
        console.error('Error loading lakes data:', error);
        res.status(500).json({ success: false, error: 'Failed to load lakes data' });
    }
});

// Get villages geospatial data
app.get('/api/geo/villages', optionalAuth, async (req, res) => {
    try {
        const villagesPath = path.join(__dirname, '../../Mundi/mundi.ai/eno-villages-scaled.geojson');
        
        if (!fs.existsSync(villagesPath)) {
            return res.status(404).json({ 
                success: false, 
                error: 'Villages geospatial data not found' 
            });
        }
        
        const geojsonData = JSON.parse(fs.readFileSync(villagesPath, 'utf8'));
        
        // Add wiki entry associations where village names might match
        if (geojsonData.features) {
            for (let feature of geojsonData.features) {
                const villageName = feature.properties.name || feature.properties.Name;
                if (villageName) {
                    // Check if there's a matching wiki entry
                    const wikiEntry = await new Promise((resolve) => {
                        db.get(`
                            SELECT id, title, category, excerpt
                            FROM wiki_entries
                            WHERE status = 'published' 
                            AND (LOWER(title) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?))
                        `, [`%${villageName}%`, `%${villageName}%`], (err, row) => {
                            if (err) resolve(null);
                            else resolve(row);
                        });
                    });
                    
                    if (wikiEntry) {
                        feature.properties.wikiEntry = wikiEntry;
                    }
                }
            }
        }
        
        res.json({
            success: true,
            data: geojsonData,
            type: 'villages'
        });
        
    } catch (error) {
        console.error('Error loading villages data:', error);
        res.status(500).json({ success: false, error: 'Failed to load villages data' });
    }
});

// Get all geospatial layers for map initialization
app.get('/api/geo/layers', optionalAuth, async (req, res) => {
    try {
        const layers = [
            {
                id: 'cities',
                name: 'Cities',
                endpoint: '/api/geo/cities',
                type: 'Point',
                style: {
                    color: '#e74c3c',
                    fillColor: '#e74c3c',
                    radius: 8,
                    weight: 2,
                    fillOpacity: 0.8
                },
                popupTemplate: 'city'
            },
            {
                id: 'villages', 
                name: 'Villages',
                endpoint: '/api/geo/villages',
                type: 'Point',
                style: {
                    color: '#f39c12',
                    fillColor: '#f39c12',
                    radius: 5,
                    weight: 1,
                    fillOpacity: 0.6
                },
                popupTemplate: 'village'
            },
            {
                id: 'rivers',
                name: 'Rivers',
                endpoint: '/api/geo/rivers',
                type: 'LineString',
                style: {
                    color: '#3498db',
                    weight: 3,
                    opacity: 0.7
                },
                popupTemplate: 'river'
            },
            {
                id: 'lakes',
                name: 'Lakes',
                endpoint: '/api/geo/lakes',
                type: 'Polygon',
                style: {
                    color: '#2980b9',
                    fillColor: '#3498db',
                    weight: 2,
                    fillOpacity: 0.5
                },
                popupTemplate: 'lake'
            }
        ];
        
        res.json({
            success: true,
            layers: layers
        });
        
    } catch (error) {
        console.error('Error loading layer configuration:', error);
        res.status(500).json({ success: false, error: 'Failed to load layer configuration' });
    }
});

// ==========================================
// ASYNC GAME MANAGEMENT API ENDPOINTS  
// ==========================================

// Create a new asynchronous game
app.post('/api/async-games', authenticateToken, authorize(['gm', 'admin']), async (req, res) => {
    try {
        const gameData = {
            ...req.body,
            gm_id: req.user.id
        };
        
        const result = await asyncGameManager.createAsyncGame(gameData);
        res.json(result);
    } catch (error) {
        console.error('Error creating async game:', error);
        res.status(500).json({ error: error.message });
    }
});

// Join an async game as a player
app.post('/api/async-games/:gameId/join', authenticateToken, async (req, res) => {
    try {
        const { gameId } = req.params;
        const { characterData = {} } = req.body;
        
        const result = await asyncGameManager.addPlayerToGame(gameId, req.user.id, characterData);
        res.json(result);
    } catch (error) {
        console.error('Error joining async game:', error);
        res.status(400).json({ error: error.message });
    }
});

// Submit a player action
app.post('/api/async-games/:gameId/actions', authenticateToken, async (req, res) => {
    try {
        const { gameId } = req.params;
        const actionData = req.body;
        
        const result = await asyncGameManager.submitPlayerAction(gameId, req.user.id, actionData);
        res.json(result);
    } catch (error) {
        console.error('Error submitting player action:', error);
        res.status(400).json({ error: error.message });
    }
});

// Get game state summary
app.get('/api/async-games/:gameId/state', authenticateToken, async (req, res) => {
    try {
        const { gameId } = req.params;
        const state = await asyncGameManager.getGameStateSummary(gameId);
        res.json(state);
    } catch (error) {
        console.error('Error getting game state:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get player engagement metrics
app.get('/api/async-games/:gameId/engagement', authenticateToken, async (req, res) => {
    try {
        const { gameId } = req.params;
        const { userId } = req.query;
        
        const engagement = await asyncGameManager.getPlayerEngagement(gameId, userId);
        res.json(engagement);
    } catch (error) {
        console.error('Error getting player engagement:', error);
        res.status(500).json({ error: error.message });
    }
});

// Manual trigger narrative cycle (for testing or manual advancement)
app.post('/api/async-games/:gameId/trigger-cycle', authenticateToken, authorize(['gm', 'admin']), async (req, res) => {
    try {
        const { gameId } = req.params;
        
        // Schedule immediate narrative cycle
        const cycleResult = await asyncGameManager.scheduleNextNarrativeCycle(gameId);
        res.json({ 
            message: 'Narrative cycle scheduled', 
            ...cycleResult 
        });
    } catch (error) {
        console.error('Error triggering narrative cycle:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get pending actions for a game
app.get('/api/async-games/:gameId/actions/pending', authenticateToken, authorize(['gm', 'admin']), (req, res) => {
    const { gameId } = req.params;
    
    const query = `
        SELECT pa.*, u.username, ps.character_name
        FROM player_actions pa
        JOIN users u ON pa.user_id = u.id
        JOIN player_sessions ps ON pa.game_id = ps.game_id AND pa.user_id = ps.user_id
        WHERE pa.game_id = ? AND pa.action_status = 'pending'
        ORDER BY pa.action_priority DESC, pa.submitted_at ASC
    `;
    
    db.all(query, [gameId], (err, actions) => {
        if (err) {
            console.error('Error fetching pending actions:', err);
            return res.status(500).json({ error: 'Failed to fetch pending actions' });
        }
        
        res.json({ actions });
    });
});

// Get narrative cycles for a game
app.get('/api/async-games/:gameId/cycles', authenticateToken, (req, res) => {
    const { gameId } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    const query = `
        SELECT * FROM narrative_cycles 
        WHERE game_id = ? 
        ORDER BY cycle_number DESC 
        LIMIT ? OFFSET ?
    `;
    
    db.all(query, [gameId, parseInt(limit), parseInt(offset)], (err, cycles) => {
        if (err) {
            console.error('Error fetching narrative cycles:', err);
            return res.status(500).json({ error: 'Failed to fetch narrative cycles' });
        }
        
        res.json({ cycles });
    });
});

// Get a single async game by ID
app.get('/api/async-games/:gameId', optionalAuth, (req, res) => {
    const { gameId } = req.params;

    const query = `
        SELECT
            g.*,
            COUNT(DISTINCT ps.user_id) as active_players,
            COUNT(DISTINCT pa.id) as pending_actions
        FROM games g
        LEFT JOIN player_sessions ps ON ps.game_id = g.id AND ps.session_status = 'active'
        LEFT JOIN player_actions pa ON pa.game_id = g.id AND pa.action_status = 'pending'
        WHERE g.id = ?
        GROUP BY g.id
    `;

    db.get(query, [gameId], (err, game) => {
        if (err) {
            console.error('Error fetching game:', err);
            return res.status(500).json({ error: 'Failed to fetch game' });
        }

        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Get player list
        const playersQuery = `
            SELECT ps.*, u.username, u.email
            FROM player_sessions ps
            JOIN users u ON ps.user_id = u.id
            WHERE ps.game_id = ?
        `;

        db.all(playersQuery, [gameId], (err, players) => {
            if (err) {
                console.error('Error fetching players:', err);
                players = [];
            }

            game.players = players || [];
            res.json(game);
        });
    });
});

// Get active async games list
app.get('/api/async-games', optionalAuth, (req, res) => {
    const { includeRecruiting = true, includeActive = true } = req.query;
    
    let gameStates = [];
    if (includeRecruiting) gameStates.push('recruiting');
    if (includeActive) gameStates.push('active');
    
    if (gameStates.length === 0) {
        return res.json({ games: [] });
    }
    
    const placeholders = gameStates.map(() => '?').join(',');
    const query = `
        SELECT 
            g.*,
            COUNT(DISTINCT ps.user_id) as active_players,
            COUNT(DISTINCT pa.id) as pending_actions
        FROM games g
        LEFT JOIN player_sessions ps ON g.id = ps.game_id AND ps.session_status = 'active'
        LEFT JOIN player_actions pa ON g.id = pa.game_id AND pa.action_status = 'pending'
        WHERE g.game_state IN (${placeholders})
        GROUP BY g.id
        ORDER BY g.created_at DESC
    `;
    
    db.all(query, gameStates, (err, games) => {
        if (err) {
            console.error('Error fetching async games:', err);
            return res.status(500).json({ error: 'Failed to fetch games' });
        }
        
        res.json({ games });
    });
});

// Cleanup handler for graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    asyncGameManager.cleanup();
    process.exit(0);
});

// Start the server
app.listen(port, () => {
    console.log(`SQLite Server with Profile Features is listening on port ${port}`);
});
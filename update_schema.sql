-- Update schema for AI features

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN is_gm BOOLEAN DEFAULT 0;
ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL;

-- Create AI usage tracking table
CREATE TABLE IF NOT EXISTS ai_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    tokens_used INTEGER NOT NULL,
    cost_cents INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create game_players table if missing
CREATE TABLE IF NOT EXISTS game_players (
    game_id INTEGER,
    user_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (game_id, user_id),
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Update admin users to have GM role
UPDATE users SET is_gm = 1 WHERE is_admin = 1 OR roles LIKE '%gm%';

-- Add any missing game columns
-- Note: These might fail if columns already exist, that's OK
ALTER TABLE games ADD COLUMN created_by INTEGER;
ALTER TABLE games ADD COLUMN genre TEXT DEFAULT 'fantasy';
ALTER TABLE games ADD COLUMN gm_id INTEGER;
ALTER TABLE games ADD COLUMN max_players INTEGER DEFAULT 5;
ALTER TABLE games ADD COLUMN posting_frequency TEXT DEFAULT 'daily';
ALTER TABLE games ADD COLUMN is_private BOOLEAN DEFAULT 0;
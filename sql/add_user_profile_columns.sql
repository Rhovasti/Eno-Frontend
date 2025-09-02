-- Add bio column to users table for profile functionality
ALTER TABLE users ADD COLUMN bio TEXT DEFAULT NULL AFTER is_admin;

-- Add columns for tracking which games users are part of
ALTER TABLE games ADD COLUMN gm_id INT DEFAULT NULL AFTER description;
ALTER TABLE games ADD COLUMN player_ids JSON DEFAULT '[]' AFTER gm_id;
ALTER TABLE games ADD COLUMN is_archived BOOLEAN DEFAULT FALSE AFTER player_ids;
ALTER TABLE games ADD COLUMN genre VARCHAR(50) DEFAULT NULL AFTER is_archived;
ALTER TABLE games ADD COLUMN max_players INT DEFAULT 5 AFTER genre;
ALTER TABLE games ADD COLUMN post_frequency VARCHAR(20) DEFAULT 'weekly' AFTER max_players;
ALTER TABLE games ADD COLUMN require_application BOOLEAN DEFAULT FALSE AFTER post_frequency;
ALTER TABLE games ADD COLUMN is_private BOOLEAN DEFAULT FALSE AFTER require_application;
ALTER TABLE games ADD COLUMN allow_spectators BOOLEAN DEFAULT TRUE AFTER is_private;

-- Add foreign key for gm_id
ALTER TABLE games ADD CONSTRAINT fk_games_gm_id FOREIGN KEY (gm_id) REFERENCES users(id) ON DELETE SET NULL;

-- Fix the posts table to use user_id instead of author_id
ALTER TABLE posts CHANGE COLUMN author_id user_id INT;

-- Update index name
ALTER TABLE posts DROP INDEX idx_posts_author_id;
CREATE INDEX idx_posts_user_id ON posts (user_id);
-- Add character tracking columns to posts table
-- This migration adds support for tracking character references in posts

-- Add character reference column to posts table
ALTER TABLE posts ADD COLUMN character_references TEXT;

-- Add column to track if character detection was performed
ALTER TABLE posts ADD COLUMN characters_detected BOOLEAN DEFAULT FALSE;

-- Add index for character-based queries
CREATE INDEX idx_posts_character_references ON posts(character_references);

-- Update existing posts to have default values
UPDATE posts SET characters_detected = FALSE WHERE characters_detected IS NULL;
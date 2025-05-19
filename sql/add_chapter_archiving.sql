-- SQLite migration to add chapter archiving functionality

-- Add columns to chapters table for archiving
ALTER TABLE chapters ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE chapters ADD COLUMN archived_at TIMESTAMP;
ALTER TABLE chapters ADD COLUMN archived_narrative TEXT;

-- Add columns to beats table to track title and content
ALTER TABLE beats ADD COLUMN title TEXT;
ALTER TABLE beats ADD COLUMN content TEXT;

-- Create index for archived chapters
CREATE INDEX idx_chapters_archived ON chapters(is_archived, game_id);
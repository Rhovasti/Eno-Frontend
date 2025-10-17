-- Add character tracking columns to posts table (SQLite version)
-- This migration adds support for tracking character references in posts

-- Add character reference column to posts table
ALTER TABLE posts ADD COLUMN character_references TEXT;

-- Add column to track if character detection was performed
ALTER TABLE posts ADD COLUMN characters_detected BOOLEAN DEFAULT FALSE;

-- Note: SQLite doesn't support adding indexes to TEXT columns with ADD COLUMN
-- The index will be created automatically for queries or can be added separately
-- if needed for performance optimization
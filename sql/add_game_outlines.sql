-- Add game outline functionality
-- This stores the story arc/outline that GMs create for their games

CREATE TABLE IF NOT EXISTS game_outlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    outline_data TEXT NOT NULL, -- JSON data containing chapters and descriptions
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Add game statistics columns to games table
ALTER TABLE games ADD COLUMN total_posts INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN last_post_at DATETIME;
ALTER TABLE games ADD COLUMN current_chapter_id INTEGER;

-- Create index for faster queries
CREATE INDEX idx_game_outlines_game_id ON game_outlines(game_id);

-- Example outline_data JSON structure:
-- {
--   "chapters": [
--     {
--       "id": 1,
--       "title": "The Beginning",
--       "description": "Heroes meet in a tavern...",
--       "status": "completed",
--       "notes": "GM notes here"
--     },
--     {
--       "id": 2,
--       "title": "The Journey",
--       "description": "The party travels north...",
--       "status": "in_progress",
--       "notes": "Remember the secret door"
--     }
--   ],
--   "overall_notes": "This is a story about...",
--   "ai_generated": false
-- }
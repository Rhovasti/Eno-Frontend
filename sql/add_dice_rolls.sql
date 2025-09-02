-- Add dice rolls table
CREATE TABLE dice_rolls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    dice_notation VARCHAR(50) NOT NULL,  -- e.g., "2d6+3", "1d20", "3d8-2"
    dice_results TEXT NOT NULL,          -- JSON array of individual die results
    modifiers INTEGER DEFAULT 0,         -- Total modifiers applied
    total INTEGER NOT NULL,              -- Final total result
    roll_purpose TEXT,                   -- Optional description of what the roll is for
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for quick lookups
CREATE INDEX idx_dice_rolls_post_id ON dice_rolls(post_id);
CREATE INDEX idx_dice_rolls_user_id ON dice_rolls(user_id);
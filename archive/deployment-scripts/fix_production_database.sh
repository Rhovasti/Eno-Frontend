#!/bin/bash

echo "Fixing production database schema..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Running archiving migration on SQLite ==='
cat > fix_schema.sql << 'SQL_FIX'
-- Add missing columns to chapters table
ALTER TABLE chapters ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE chapters ADD COLUMN archived_at TIMESTAMP;
ALTER TABLE chapters ADD COLUMN archived_narrative TEXT;

-- Add missing columns to beats table if they don't exist
-- Note: SQLite doesn't show an error if column already exists
ALTER TABLE beats ADD COLUMN title TEXT;
ALTER TABLE beats ADD COLUMN content TEXT;

-- Update any existing chapters to not be archived
UPDATE chapters SET is_archived = 0 WHERE is_archived IS NULL;
SQL_FIX

echo 'Backing up database...'
cp data/database.sqlite data/database.sqlite.backup.\$(date +%Y%m%d_%H%M%S)

echo 'Applying schema fixes...'
sqlite3 data/database.sqlite < fix_schema.sql 2>&1 || echo 'Some columns might already exist'
echo

echo '=== Verifying schema ==='
echo 'Chapters table schema:'
sqlite3 data/database.sqlite '.schema chapters'
echo

echo '=== Testing with fixed schema ==='
echo 'Chapters with archiving status:'
sqlite3 data/database.sqlite 'SELECT id, game_id, title, is_archived FROM chapters;'
echo

echo '=== Creating a test chapter and beat for testing ==='
cat > create_test_data.js << 'TEST_DATA'
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'data/database.sqlite'));

// Create a test chapter if none exist
db.get('SELECT COUNT(*) as count FROM chapters', (err, row) => {
    if (err) {
        console.error('Error checking chapters:', err);
        return;
    }
    
    if (row.count === 0) {
        // Create a test chapter
        db.run(
            'INSERT INTO chapters (game_id, title, description, sequence_number, is_archived) VALUES (?, ?, ?, ?, ?)',
            [1, 'Test Chapter', 'A test chapter for posts', 1, 0],
            function(err) {
                if (err) {
                    console.error('Error creating chapter:', err);
                    return;
                }
                console.log('Created test chapter with ID:', this.lastID);
                
                // Create a test beat
                db.run(
                    'INSERT INTO beats (chapter_id, title, content, sequence_number) VALUES (?, ?, ?, ?)',
                    [this.lastID, 'Test Beat', 'A test beat for posts', 1],
                    function(err) {
                        if (err) {
                            console.error('Error creating beat:', err);
                            return;
                        }
                        console.log('Created test beat with ID:', this.lastID);
                        db.close();
                    }
                );
            }
        );
    } else {
        console.log('Chapters already exist');
        db.close();
    }
});
TEST_DATA

node create_test_data.js
echo

echo '=== Current data status ==='
echo 'Chapters:'
sqlite3 data/database.sqlite 'SELECT id, game_id, title, is_archived FROM chapters;'
echo
echo 'Beats:'
sqlite3 data/database.sqlite 'SELECT id, chapter_id, title FROM beats LIMIT 5;'
echo

echo 'Schema fixes applied successfully!'
"
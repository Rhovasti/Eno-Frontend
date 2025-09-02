#!/bin/bash

echo "Investigating data structure on production..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Games in database ==='
sqlite3 data/database.sqlite 'SELECT id, name FROM games;'
echo

echo '=== Chapters in database ==='
sqlite3 data/database.sqlite 'SELECT id, game_id, title, is_archived FROM chapters;'
echo

echo '=== Beats in database ==='
sqlite3 data/database.sqlite 'SELECT id, chapter_id, title, sequence_number FROM beats;'
echo

echo '=== Posts in database ==='
sqlite3 data/database.sqlite 'SELECT id, beat_id, title FROM posts ORDER BY id DESC LIMIT 10;'
echo

echo '=== Testing the flow manually ==='
cat > manual_flow_test.js << 'MANUAL_TEST'
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database.sqlite');

console.log('Testing data relationships:');

// Find a game with chapters
db.get('SELECT g.id, g.name, COUNT(c.id) as chapter_count FROM games g LEFT JOIN chapters c ON g.id = c.game_id GROUP BY g.id HAVING chapter_count > 0 LIMIT 1', (err, game) => {
    if (err || !game) {
        console.error('No game with chapters found');
        db.close();
        return;
    }
    
    console.log(`Game: ${game.name} (ID: ${game.id}) has ${game.chapter_count} chapters`);
    
    // Get a chapter from this game
    db.get('SELECT id, title, is_archived FROM chapters WHERE game_id = ? LIMIT 1', [game.id], (err, chapter) => {
        if (err || !chapter) {
            console.error('No chapter found');
            db.close();
            return;
        }
        
        console.log(`Chapter: ${chapter.title} (ID: ${chapter.id}, Archived: ${chapter.is_archived})`);
        
        // Check if this chapter has beats
        db.all('SELECT id, title, sequence_number FROM beats WHERE chapter_id = ?', [chapter.id], (err, beats) => {
            if (err) {
                console.error('Error getting beats:', err);
            } else {
                console.log(`Beats in chapter ${chapter.id}:`, beats.length);
                beats.forEach(beat => {
                    console.log(`  Beat ${beat.id}: ${beat.title || 'Untitled'}`);
                });
                
                if (beats.length === 0) {
                    console.log('No beats found. Creating a test beat...');
                    db.run('INSERT INTO beats (chapter_id, title, sequence_number) VALUES (?, ?, ?)', 
                        [chapter.id, 'Test Beat', 1], 
                        function(err) {
                            if (err) {
                                console.error('Error creating beat:', err);
                            } else {
                                console.log('Created beat with ID:', this.lastID);
                            }
                            db.close();
                        }
                    );
                } else {
                    // Check posts in the first beat
                    const beatId = beats[0].id;
                    db.all('SELECT id, title, post_type FROM posts WHERE beat_id = ?', [beatId], (err, posts) => {
                        if (err) {
                            console.error('Error getting posts:', err);
                        } else {
                            console.log(`Posts in beat ${beatId}:`, posts.length);
                            posts.forEach(post => {
                                console.log(`  Post ${post.id}: ${post.title} (${post.post_type})`);
                            });
                        }
                        db.close();
                    });
                }
            }
        });
    });
});
MANUAL_TEST

node manual_flow_test.js
echo

echo '=== Creating a complete test structure ==='
cat > create_test_structure.js << 'CREATE_TEST'
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database.sqlite');

async function createTestStructure() {
    return new Promise((resolve, reject) => {
        // First check if test game exists
        db.get('SELECT id FROM games WHERE name = ?', ['Test Game'], (err, game) => {
            if (err) {
                reject(err);
                return;
            }
            
            const gameId = game ? game.id : null;
            
            if (!gameId) {
                // Create test game
                db.run('INSERT INTO games (name, description) VALUES (?, ?)', 
                    ['Test Game', 'A test game for debugging'], 
                    function(err) {
                        if (err) {
                            reject(err);
                            return;
                        }
                        const newGameId = this.lastID;
                        console.log('Created test game with ID:', newGameId);
                        createChapter(newGameId);
                    }
                );
            } else {
                console.log('Test game already exists with ID:', gameId);
                createChapter(gameId);
            }
        });
        
        function createChapter(gameId) {
            // Create test chapter
            db.run('INSERT INTO chapters (game_id, title, sequence_number, is_archived) VALUES (?, ?, ?, ?)', 
                [gameId, 'Test Chapter', 1, 0], 
                function(err) {
                    if (err) {
                        console.log('Chapter might already exist:', err.message);
                        // Try to get existing chapter
                        db.get('SELECT id FROM chapters WHERE game_id = ?', [gameId], (err, chapter) => {
                            if (chapter) {
                                createBeat(chapter.id);
                            } else {
                                reject(err);
                            }
                        });
                        return;
                    }
                    const chapterId = this.lastID;
                    console.log('Created test chapter with ID:', chapterId);
                    createBeat(chapterId);
                }
            );
        }
        
        function createBeat(chapterId) {
            // Create test beat
            db.run('INSERT INTO beats (chapter_id, title, sequence_number) VALUES (?, ?, ?)', 
                [chapterId, 'Test Beat', 1], 
                function(err) {
                    if (err) {
                        console.log('Beat might already exist:', err.message);
                        resolve();
                        return;
                    }
                    console.log('Created test beat with ID:', this.lastID);
                    resolve();
                }
            );
        }
    });
}

createTestStructure()
    .then(() => {
        console.log('Test structure created successfully');
        
        // Verify the structure
        db.all(`
            SELECT g.name, c.title as chapter_title, b.title as beat_title, b.id as beat_id
            FROM games g
            JOIN chapters c ON g.id = c.game_id
            JOIN beats b ON c.id = b.chapter_id
            WHERE g.name = 'Test Game'
        `, (err, results) => {
            if (err) {
                console.error('Error verifying structure:', err);
            } else {
                console.log('Test structure:');
                results.forEach(row => {
                    console.log(`${row.name} > ${row.chapter_title} > ${row.beat_title} (Beat ID: ${row.beat_id})`);
                });
            }
            db.close();
        });
    })
    .catch(err => {
        console.error('Error creating test structure:', err);
        db.close();
    });
CREATE_TEST

node create_test_structure.js
"
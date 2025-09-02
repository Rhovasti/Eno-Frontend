// Test script to validate Phase 2 functionality
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data/database.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('=== Phase 2 Functionality Test ===\n');

// Test 1: Verify database structure
console.log('1. Testing database structure...');
db.get("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'", (err, row) => {
    if (err) {
        console.error('❌ Database error:', err);
        return;
    }
    console.log(`✅ Database has ${row.count} tables`);
});

// Test 2: Check game-chapter-beat-post relationships
console.log('\n2. Testing data relationships...');
db.all(`
    SELECT g.name as game_name, 
           COUNT(DISTINCT c.id) as chapters,
           COUNT(DISTINCT b.id) as beats,
           COUNT(DISTINCT p.id) as posts
    FROM games g
    LEFT JOIN chapters c ON g.id = c.game_id
    LEFT JOIN beats b ON c.id = b.chapter_id
    LEFT JOIN posts p ON b.id = p.beat_id
    GROUP BY g.id, g.name
    HAVING chapters > 0 OR beats > 0 OR posts > 0
    ORDER BY g.id
    LIMIT 5
`, (err, rows) => {
    if (err) {
        console.error('❌ Relationship query error:', err);
        return;
    }
    
    console.log('Games with content:');
    rows.forEach(row => {
        console.log(`  ${row.game_name}: ${row.chapters} chapters, ${row.beats} beats, ${row.posts} posts`);
    });
});

// Test 3: Check recent posts
console.log('\n3. Testing recent posts...');
db.all(`
    SELECT p.id, p.title, p.post_type, u.username, 
           g.name as game_name
    FROM posts p
    JOIN users u ON p.author_id = u.id
    JOIN beats b ON p.beat_id = b.id
    JOIN chapters c ON b.chapter_id = c.id
    JOIN games g ON c.game_id = g.id
    ORDER BY p.created_at DESC
    LIMIT 5
`, (err, rows) => {
    if (err) {
        console.error('❌ Posts query error:', err);
        return;
    }
    
    console.log('Recent posts:');
    rows.forEach(row => {
        console.log(`  Post ${row.id}: "${row.title}" by ${row.username} (${row.post_type}) in ${row.game_name}`);
    });
});

// Test 4: Check dice rolls
console.log('\n4. Testing dice rolls...');
db.all(`
    SELECT dr.id, dr.dice_notation, dr.total, p.title
    FROM dice_rolls dr
    JOIN posts p ON dr.post_id = p.id
    LIMIT 3
`, (err, rows) => {
    if (err) {
        console.error('❌ Dice roll query error:', err);
        return;
    }
    
    if (rows.length > 0) {
        console.log('Posts with dice rolls:');
        rows.forEach(row => {
            console.log(`  "${row.title}" - Rolled: ${row.dice_notation} = ${row.total}`);
        });
    } else {
        console.log('ℹ️  No dice rolls found in database');
    }
});

// Test 5: Check archived chapters
console.log('\n5. Testing archived chapters...');
db.all(`
    SELECT c.id, c.title, c.is_archived, c.archived_narrative
    FROM chapters c
    WHERE c.is_archived = 1
    LIMIT 3
`, (err, rows) => {
    if (err) {
        console.error('❌ Archived chapters query error:', err);
        return;
    }
    
    if (rows.length > 0) {
        console.log('Archived chapters:');
        rows.forEach(row => {
            console.log(`  Chapter ${row.id}: "${row.title}" - Archived: Yes`);
        });
    } else {
        console.log('ℹ️  No archived chapters found');
    }
});

// Test 6: Check AI image generation data
console.log('\n6. Testing image generation data...');
db.all(`
    SELECT pi.id, pi.prompt, pi.image_url, p.title as post_title
    FROM post_images pi
    JOIN posts p ON pi.post_id = p.id
    LIMIT 3
`, (err, rows) => {
    if (err) {
        console.error('❌ Image generation query error:', err);
        return;
    }
    
    if (rows.length > 0) {
        console.log('Generated images:');
        rows.forEach(row => {
            console.log(`  Image ${row.id}: "${row.prompt}" for post "${row.post_title}"`);
        });
    } else {
        console.log('ℹ️  No generated images found');
    }
    
    // Close database connection
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        }
        console.log('\n=== Phase 2 Test Complete ===');
    });
});
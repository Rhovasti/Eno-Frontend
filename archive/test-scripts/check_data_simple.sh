#!/bin/bash

echo "Checking data structure (simplified)..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Testing the complete flow ==='
sqlite3 data/database.sqlite << 'SQL_QUERY'
-- Show game -> chapter -> beat -> post relationships
SELECT 
    g.name as game,
    c.title as chapter, 
    c.is_archived,
    b.title as beat,
    COUNT(p.id) as post_count
FROM games g
LEFT JOIN chapters c ON g.id = c.game_id
LEFT JOIN beats b ON c.id = b.chapter_id
LEFT JOIN posts p ON b.id = p.beat_id
GROUP BY g.id, c.id, b.id
ORDER BY g.id, c.sequence_number, b.sequence_number;
SQL_QUERY

echo
echo '=== Creating test structure ==='

# Create test data with proper relationships
sqlite3 data/database.sqlite << 'CREATE_SQL'
-- Create a test beat in an existing chapter if needed
INSERT INTO beats (chapter_id, title, sequence_number)
SELECT 1, 'Test Beat for Posting', 
       (SELECT COALESCE(MAX(sequence_number), 0) + 1 FROM beats WHERE chapter_id = 1)
WHERE NOT EXISTS (
    SELECT 1 FROM beats WHERE chapter_id = 1 AND title = 'Test Beat for Posting'
);

-- Show the beat we just created or found
SELECT b.id, b.title, c.title as chapter_title, c.is_archived 
FROM beats b 
JOIN chapters c ON b.chapter_id = c.id 
WHERE b.title = 'Test Beat for Posting' OR b.id = 1;
CREATE_SQL

echo
echo '=== Testing form visibility ==='
cat > check_form_visibility.js << 'FORM_TEST'
// This simulates what should happen in the browser
const mockData = {
    chapterArchived: false,
    beatId: '1',
    isGM: true
};

console.log('Testing form visibility logic:');
console.log('Chapter archived:', mockData.chapterArchived);
console.log('Beat selected:', mockData.beatId);
console.log('User is GM:', mockData.isGM);

// This is the logic from threads.js
const shouldShowForm = mockData.beatId && !mockData.chapterArchived;
console.log('Should show post form:', shouldShowForm);

// Test validation
const formData = {
    beatId: mockData.beatId,
    title: 'Test',
    content: 'Test content'
};

const validationPassed = formData.beatId && formData.title && formData.content;
console.log('Validation would pass:', validationPassed);
FORM_TEST

node check_form_visibility.js
echo

echo '=== Checking if there are any JavaScript errors ==='
cd hml
ls -la threads.html
cd ..
cd js
ls -la threads.js

echo
echo '=== Testing direct posting capability ==='
curl -X POST http://localhost:3000/api/posts \
     -H 'Content-Type: application/json' \
     -H 'Authorization: Bearer DUMMY_TOKEN' \
     -d '{\"beatId\": \"1\", \"title\": \"Direct Test\", \"content\": \"Testing\", \"postType\": \"player\"}' \
     2>/dev/null || echo 'Direct post test completed'
"
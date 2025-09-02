#!/bin/bash

echo "Debugging the complete posting flow..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Checking if post form is shown when beat is selected ==='
grep -A10 'beatSelect.addEventListener.*change' js/threads.js | grep -E 'newPostForm|display'
echo

echo '=== Checking visibility conditions for post form ==='
grep -B5 -A5 'newPostForm.style.display' js/threads.js
echo

echo '=== Verifying form element IDs ==='
echo 'Form elements in HTML:'
grep -E 'id=\"(createPostForm|postTitle|postContent|isGMPost)\"' hml/threads.html
echo
echo 'Element references in JS:'
grep -E 'getElementById.*(createPostForm|postTitle|postContent|isGMPost)' js/threads.js
echo

echo '=== Testing beat loading ==='
cat > test_beat_loading.js << 'BEAT_TEST'
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./data/database.sqlite');

console.log('Checking beats in database:');
db.all('SELECT b.id, b.chapter_id, b.title, c.title as chapter_title, c.is_archived FROM beats b JOIN chapters c ON b.chapter_id = c.id LIMIT 10', (err, rows) => {
    if (err) {
        console.error('Error:', err);
    } else {
        console.log('Beats found:');
        rows.forEach(row => {
            console.log(`Beat ${row.id}: "${row.title}" in Chapter "${row.chapter_title}" (archived: ${row.is_archived})`);
        });
    }
    db.close();
});
BEAT_TEST

node test_beat_loading.js
echo

echo '=== Checking if newPostForm element exists ==='
grep -n 'id=\"newPostForm\"' hml/threads.html
grep -n 'getElementById.*newPostForm' js/threads.js
echo

echo '=== Full post submission handler ==='
grep -A50 'createPostForm.*addEventListener.*submit' js/threads.js | head -60
echo

echo '=== Creating a simple test to verify posting ==='
cat > simple_post_test.html << 'SIMPLE_TEST'
<!DOCTYPE html>
<html>
<head>
    <title>Post Test</title>
</head>
<body>
    <h2>Simple Post Test</h2>
    <div id="result"></div>
    <script>
    // Get auth token from cookie
    function getCookie(name) {
        const value = '; ' + document.cookie;
        const parts = value.split('; ' + name + '=');
        if (parts.length === 2) return parts.pop().split(';')[0];
        return null;
    }
    
    // Test post creation
    const token = getCookie('token');
    if (!token) {
        document.getElementById('result').innerHTML = 'No auth token found. Please login first.';
    } else {
        fetch('/api/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                beatId: '1',
                title: 'Simple Test Post',
                content: 'Testing post creation',
                postType: 'player'
            })
        })
        .then(response => response.json())
        .then(data => {
            document.getElementById('result').innerHTML = 'Response: ' + JSON.stringify(data);
        })
        .catch(error => {
            document.getElementById('result').innerHTML = 'Error: ' + error;
        });
    }
    </script>
</body>
</html>
SIMPLE_TEST

echo 'Simple test page created at simple_post_test.html'
echo 'You can access it at https://www.iinou.eu/simple_post_test.html'
"
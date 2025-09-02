#!/bin/bash

echo "Diagnosing post creation issue on production..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Recent server logs ==='
tail -50 server.log | grep -E 'post|error|Error|POST' || echo 'No relevant logs found'
echo

echo '=== Checking API endpoints in server ==='
grep -n '/api/posts' js/server_sqlite_new.js | head -5
echo

echo '=== Checking database schema ==='
sqlite3 data/database.sqlite '.schema posts' || echo 'Posts table not found'
echo

echo '=== Checking beats table ==='
sqlite3 data/database.sqlite '.schema beats' || echo 'Beats table not found'
echo

echo '=== List current data ==='
echo 'Games:'
sqlite3 data/database.sqlite 'SELECT id, name FROM games;'
echo
echo 'Chapters:'
sqlite3 data/database.sqlite 'SELECT id, game_id, title, is_archived FROM chapters;'
echo
echo 'Beats:'
sqlite3 data/database.sqlite 'SELECT id, chapter_id, title FROM beats LIMIT 5;'
echo
echo 'Posts:'
sqlite3 data/database.sqlite 'SELECT id, beat_id, author_id, title FROM posts LIMIT 5;'
echo

echo '=== Checking file permissions ==='
ls -la data/database.sqlite
echo

echo '=== Testing post creation endpoint ==='
cat > test_create_post.js << 'TEST_POST'
const http = require('http');

// First login to get token
const loginData = JSON.stringify({
    email: 'admin@example.com',
    password: 'admin123'
});

const loginOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
};

const loginReq = http.request(loginOptions, (res) => {
    let responseData = '';
    res.on('data', (chunk) => responseData += chunk);
    res.on('end', () => {
        if (res.statusCode === 200) {
            const loginResponse = JSON.parse(responseData);
            const token = loginResponse.token;
            console.log('Login successful, testing post creation...');
            
            // Try to create a post
            const postData = JSON.stringify({
                beatId: '1',
                title: 'Test Post',
                content: 'This is a test post content',
                postType: 'player'
            });
            
            const postOptions = {
                hostname: 'localhost',
                port: 3000,
                path: '/api/posts',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': postData.length,
                    'Authorization': 'Bearer ' + token
                }
            };
            
            const postReq = http.request(postOptions, (res) => {
                let postResponse = '';
                res.on('data', (chunk) => postResponse += chunk);
                res.on('end', () => {
                    console.log('Post creation response:');
                    console.log('Status:', res.statusCode);
                    console.log('Body:', postResponse);
                });
            });
            
            postReq.on('error', (error) => {
                console.error('Post request error:', error);
            });
            
            postReq.write(postData);
            postReq.end();
        } else {
            console.log('Login failed:', responseData);
        }
    });
});

loginReq.on('error', (error) => {
    console.error('Login request error:', error);
});

loginReq.write(loginData);
loginReq.end();
TEST_POST

node test_create_post.js
"
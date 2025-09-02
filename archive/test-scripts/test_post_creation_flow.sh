#!/bin/bash

echo "Testing full post creation flow on production..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

cat > test_full_flow.js << 'FULL_TEST'
const http = require('http');

// Login first
const loginData = JSON.stringify({
    email: 'admin@example.com',
    password: 'admin123'
});

function makeRequest(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => responseData += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, data: responseData });
                }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function test() {
    try {
        // 1. Login
        console.log('1. Logging in...');
        const loginRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': loginData.length
            }
        }, loginData);
        
        if (loginRes.status !== 200) {
            console.error('Login failed:', loginRes.data);
            return;
        }
        
        const token = loginRes.data.token;
        console.log('✓ Login successful');
        
        // 2. Get games
        console.log('\\n2. Getting games...');
        const gamesRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/games',
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        
        if (gamesRes.data.length === 0) {
            console.error('No games found');
            return;
        }
        
        const gameId = gamesRes.data[0].id;
        console.log('✓ Found game:', gamesRes.data[0].name, '(ID:', gameId + ')');
        
        // 3. Get chapters
        console.log('\\n3. Getting chapters...');
        const chaptersRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/games/' + gameId + '/chapters?includeArchived=true',
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        
        if (chaptersRes.data.length === 0) {
            console.error('No chapters found');
            return;
        }
        
        const chapterId = chaptersRes.data[0].id;
        console.log('✓ Found chapter:', chaptersRes.data[0].title, '(ID:', chapterId + ')');
        
        // 4. Get beats
        console.log('\\n4. Getting beats...');
        const beatsRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/chapters/' + chapterId + '/beats',
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + token
            }
        });
        
        if (beatsRes.data.length === 0) {
            console.error('No beats found');
            return;
        }
        
        const beatId = beatsRes.data[0].id;
        console.log('✓ Found beat:', beatsRes.data[0].title || 'Beat ' + beatId, '(ID:', beatId + ')');
        
        // 5. Create a post
        console.log('\\n5. Creating a test post...');
        const postData = JSON.stringify({
            beatId: beatId.toString(),
            title: 'Test Post from Script',
            content: 'This is a test post created via script',
            postType: 'player'
        });
        
        const postRes = await makeRequest({
            hostname: 'localhost',
            port: 3000,
            path: '/api/posts',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length,
                'Authorization': 'Bearer ' + token
            }
        }, postData);
        
        console.log('Post creation response:');
        console.log('Status:', postRes.status);
        console.log('Response:', postRes.data);
        
        if (postRes.status === 201) {
            console.log('\\n✓ Post created successfully!');
            console.log('Post ID:', postRes.data.id);
        } else {
            console.log('\\n✗ Post creation failed');
        }
        
    } catch (error) {
        console.error('Error:', error);
    }
}

test();
FULL_TEST

node test_full_flow.js
echo

echo '=== Recent posts in database ==='
sqlite3 data/database.sqlite 'SELECT id, beat_id, author_id, title, created_at FROM posts ORDER BY id DESC LIMIT 5;'
"
#!/bin/bash

echo "Creating UI diagnostic tool..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

# Create a diagnostic page
cat > diagnostic.html << 'DIAGNOSTIC_HTML'
<!DOCTYPE html>
<html lang=\"fi\">
<head>
    <meta charset=\"UTF-8\">
    <title>Post Creation Diagnostic</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .section { margin: 20px 0; padding: 10px; border: 1px solid #ccc; }
        .success { color: green; }
        .error { color: red; }
        .info { color: blue; }
        button { margin: 5px; padding: 5px 10px; }
        #log { background: #f5f5f5; padding: 10px; height: 200px; overflow-y: auto; }
    </style>
</head>
<body>
    <h1>Post Creation Diagnostic Tool</h1>
    
    <div class=\"section\">
        <h3>1. Authentication Check</h3>
        <button onclick=\"checkAuth()\">Check Auth</button>
        <div id=\"authResult\"></div>
    </div>
    
    <div class=\"section\">
        <h3>2. Data Structure Check</h3>
        <button onclick=\"checkDataStructure()\">Check Data</button>
        <div id=\"dataResult\"></div>
    </div>
    
    <div class=\"section\">
        <h3>3. Manual Post Creation</h3>
        <select id=\"beatSelect\">
            <option value=\"\">Select a beat...</option>
        </select>
        <br><br>
        <input type=\"text\" id=\"postTitle\" placeholder=\"Post title\" style=\"width: 300px;\">
        <br><br>
        <textarea id=\"postContent\" placeholder=\"Post content\" style=\"width: 300px; height: 100px;\"></textarea>
        <br><br>
        <button onclick=\"createPost()\">Create Post</button>
        <div id=\"postResult\"></div>
    </div>
    
    <div class=\"section\">
        <h3>Debug Log</h3>
        <div id=\"log\"></div>
    </div>
    
    <script>
    function log(message, type = 'info') {
        const logDiv = document.getElementById('log');
        const time = new Date().toLocaleTimeString();
        const color = type === 'error' ? 'red' : type === 'success' ? 'green' : 'blue';
        logDiv.innerHTML += '<div style=\"color: ' + color + '\">' + time + ' - ' + message + '</div>';
        logDiv.scrollTop = logDiv.scrollHeight;
    }
    
    function getCookie(name) {
        const value = '; ' + document.cookie;
        const parts = value.split('; ' + name + '=');
        if (parts.length === 2) return parts.pop().split(';')[0];
        return null;
    }
    
    async function checkAuth() {
        log('Checking authentication...');
        const token = getCookie('token');
        const authDiv = document.getElementById('authResult');
        
        if (!token) {
            authDiv.innerHTML = '<span class=\"error\">No auth token found. Please login.</span>';
            log('No auth token found', 'error');
            return;
        }
        
        authDiv.innerHTML = '<span class=\"info\">Token found: ' + token.substring(0, 20) + '...</span>';
        log('Token found, testing validity...');
        
        try {
            const response = await fetch('/api/games', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            
            if (response.ok) {
                authDiv.innerHTML += '<br><span class=\"success\">Token is valid!</span>';
                log('Token is valid', 'success');
            } else {
                authDiv.innerHTML += '<br><span class=\"error\">Token is invalid or expired</span>';
                log('Token invalid: ' + response.status, 'error');
            }
        } catch (error) {
            authDiv.innerHTML += '<br><span class=\"error\">Error: ' + error.message + '</span>';
            log('Auth check error: ' + error.message, 'error');
        }
    }
    
    async function checkDataStructure() {
        log('Checking data structure...');
        const token = getCookie('token');
        const dataDiv = document.getElementById('dataResult');
        
        if (!token) {
            dataDiv.innerHTML = '<span class=\"error\">Please check auth first</span>';
            return;
        }
        
        try {
            // Get games
            const gamesResponse = await fetch('/api/games', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const games = await gamesResponse.json();
            
            dataDiv.innerHTML = '<div class=\"info\">Games found: ' + games.length + '</div>';
            log('Found ' + games.length + ' games');
            
            if (games.length > 0) {
                // Get chapters for first game
                const chaptersResponse = await fetch('/api/games/' + games[0].id + '/chapters?includeArchived=true', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                const chapters = await chaptersResponse.json();
                
                dataDiv.innerHTML += '<div class=\"info\">Chapters in \"' + games[0].name + '\": ' + chapters.length + '</div>';
                log('Found ' + chapters.length + ' chapters');
                
                if (chapters.length > 0) {
                    // Get beats for first chapter
                    const beatsResponse = await fetch('/api/chapters/' + chapters[0].id + '/beats', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    const beats = await beatsResponse.json();
                    
                    dataDiv.innerHTML += '<div class=\"info\">Beats in \"' + chapters[0].title + '\": ' + beats.length + '</div>';
                    log('Found ' + beats.length + ' beats');
                    
                    // Populate beat select
                    const beatSelect = document.getElementById('beatSelect');
                    beatSelect.innerHTML = '<option value=\"\">Select a beat...</option>';
                    beats.forEach(beat => {
                        const option = document.createElement('option');
                        option.value = beat.id;
                        option.textContent = beat.title || 'Beat ' + beat.id;
                        beatSelect.appendChild(option);
                    });
                    
                    if (beats.length > 0) {
                        dataDiv.innerHTML += '<div class=\"success\">Data structure is complete!</div>';
                        log('Data structure is complete', 'success');
                    } else {
                        dataDiv.innerHTML += '<div class=\"error\">No beats found - cannot create posts</div>';
                        log('No beats found', 'error');
                    }
                }
            }
        } catch (error) {
            dataDiv.innerHTML = '<span class=\"error\">Error: ' + error.message + '</span>';
            log('Data check error: ' + error.message, 'error');
        }
    }
    
    async function createPost() {
        log('Attempting to create post...');
        const token = getCookie('token');
        const beatId = document.getElementById('beatSelect').value;
        const title = document.getElementById('postTitle').value;
        const content = document.getElementById('postContent').value;
        const postDiv = document.getElementById('postResult');
        
        if (!token) {
            postDiv.innerHTML = '<span class=\"error\">No auth token</span>';
            return;
        }
        
        if (!beatId) {
            postDiv.innerHTML = '<span class=\"error\">Please select a beat</span>';
            return;
        }
        
        if (!title || !content) {
            postDiv.innerHTML = '<span class=\"error\">Please fill in title and content</span>';
            return;
        }
        
        const postData = {
            beatId: beatId,
            title: title,
            content: content,
            postType: 'player'
        };
        
        log('Sending POST request with data: ' + JSON.stringify(postData));
        
        try {
            const response = await fetch('/api/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify(postData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                postDiv.innerHTML = '<div class=\"success\">Post created! ID: ' + result.id + '</div>';
                log('Post created successfully with ID: ' + result.id, 'success');
                
                // Clear form
                document.getElementById('postTitle').value = '';
                document.getElementById('postContent').value = '';
            } else {
                postDiv.innerHTML = '<div class=\"error\">Error: ' + (result.error || 'Unknown error') + '</div>';
                log('Post creation failed: ' + (result.error || response.status), 'error');
            }
        } catch (error) {
            postDiv.innerHTML = '<div class=\"error\">Request error: ' + error.message + '</div>';
            log('Request error: ' + error.message, 'error');
        }
    }
    
    // Auto-check auth on load
    window.onload = function() {
        log('Diagnostic tool loaded');
        checkAuth();
    };
    </script>
</body>
</html>
DIAGNOSTIC_HTML

echo 'Diagnostic page created at diagnostic.html'
echo 'Access it at: https://www.iinou.eu/diagnostic.html'
echo
echo 'This tool will help identify:'
echo '1. Authentication issues'
echo '2. Data structure problems'
echo '3. API endpoint issues'
echo '4. Client-side errors'
"
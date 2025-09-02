#!/bin/bash

echo "Debugging authentication token issue..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Checking login endpoint implementation ==='
grep -A30 \"app.post('/api/login'\" js/server_sqlite_new.js | head -40
echo

echo '=== Checking how token is set in response ==='
grep -A10 'res.json.*token' js/server_sqlite_new.js | head -15
echo

echo '=== Updating diagnostic tool to check cookies better ==='
cat > diagnostic_fixed.html << 'DIAGNOSTIC_FIXED'
<!DOCTYPE html>
<html lang=\"fi\">
<head>
    <meta charset=\"UTF-8\">
    <title>Post Creation Diagnostic - Fixed</title>
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
    <h1>Post Creation Diagnostic Tool (Fixed)</h1>
    
    <div class=\"section\">
        <h3>0. Cookie Debug</h3>
        <button onclick=\"debugCookies()\">Debug Cookies</button>
        <div id=\"cookieResult\"></div>
    </div>
    
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
    
    function debugCookies() {
        const cookieDiv = document.getElementById('cookieResult');
        const allCookies = document.cookie;
        
        log('Debugging cookies...');
        cookieDiv.innerHTML = '<strong>All cookies:</strong><br>' + (allCookies || 'No cookies found');
        
        // Also check localStorage
        const userData = localStorage.getItem('user');
        cookieDiv.innerHTML += '<br><br><strong>LocalStorage user:</strong><br>' + (userData || 'No user data');
        
        // Try alternative ways to get token
        const token = getCookie('token');
        const authToken = getCookie('authToken');
        const jwtToken = getCookie('jwt');
        
        cookieDiv.innerHTML += '<br><br><strong>Token attempts:</strong>';
        cookieDiv.innerHTML += '<br>token: ' + (token || 'not found');
        cookieDiv.innerHTML += '<br>authToken: ' + (authToken || 'not found');
        cookieDiv.innerHTML += '<br>jwt: ' + (jwtToken || 'not found');
        
        // Check if we can extract token from localStorage
        if (userData) {
            try {
                const user = JSON.parse(userData);
                if (user.token) {
                    cookieDiv.innerHTML += '<br><br><strong>Token found in localStorage!</strong>';
                    cookieDiv.innerHTML += '<br>Setting cookie manually...';
                    document.cookie = 'token=' + user.token + '; path=/';
                    cookieDiv.innerHTML += '<br>Cookie set. Try auth check now.';
                }
            } catch (e) {
                log('Error parsing user data: ' + e.message, 'error');
            }
        }
    }
    
    async function checkAuth() {
        log('Checking authentication...');
        let token = getCookie('token');
        const authDiv = document.getElementById('authResult');
        
        // Try to get token from localStorage if not in cookie
        if (!token) {
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    if (user.token) {
                        token = user.token;
                        log('Using token from localStorage');
                    }
                } catch (e) {
                    log('Error parsing user data', 'error');
                }
            }
        }
        
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
                
                // Save token to cookie for future use
                document.cookie = 'token=' + token + '; path=/';
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
        let token = getCookie('token');
        
        // Try localStorage if no cookie
        if (!token) {
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    token = user.token;
                } catch (e) {}
            }
        }
        
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
        let token = getCookie('token');
        
        // Try localStorage if no cookie
        if (!token) {
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    const user = JSON.parse(userData);
                    token = user.token;
                } catch (e) {}
            }
        }
        
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
    
    // Auto-check on load
    window.onload = function() {
        log('Diagnostic tool loaded (fixed version)');
        debugCookies();
    };
    </script>
</body>
</html>
DIAGNOSTIC_FIXED

echo 'Fixed diagnostic tool created'
echo 'Access it at: https://www.iinou.eu/diagnostic_fixed.html'
echo
echo 'This version will:'
echo '1. Debug all cookies'
echo '2. Check localStorage for token'
echo '3. Try to recover token from different sources'
"
#!/bin/bash

echo "Checking login response handling..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Full login endpoint ==='
grep -A60 \"app.post('/api/login'\" js/server_sqlite_new.js | grep -B60 -A10 'res.json'
echo

echo '=== Creating a better login page that handles cookies properly ==='
cat > better_login.html << 'BETTER_LOGIN'
<!DOCTYPE html>
<html lang=\"fi\">
<head>
    <meta charset=\"UTF-8\">
    <title>Better Login</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto; }
        .login-form { border: 1px solid #ccc; padding: 20px; margin-top: 20px; }
        input { width: 100%; padding: 8px; margin: 8px 0; box-sizing: border-box; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; cursor: pointer; width: 100%; }
        button:hover { background: #0056b3; }
        .message { margin-top: 10px; padding: 10px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .info { background: #d1ecf1; color: #0c5460; }
        pre { background: #f5f5f5; padding: 10px; overflow: auto; }
    </style>
</head>
<body>
    <h1>Better Login with Cookie Handling</h1>
    
    <div class=\"info message\">
        <strong>Admin credentials:</strong><br>
        Email: admin@example.com<br>
        Password: admin123
    </div>
    
    <div class=\"login-form\">
        <h3>Login</h3>
        <input type=\"email\" id=\"email\" placeholder=\"Email\" value=\"admin@example.com\">
        <input type=\"password\" id=\"password\" placeholder=\"Password\">
        <button onclick=\"login()\">Login</button>
        <div id=\"message\"></div>
    </div>
    
    <div style=\"margin-top: 20px;\">
        <h3>Debug Info</h3>
        <pre id=\"debug\">Ready to login...</pre>
    </div>
    
    <script>
    function updateDebug(message) {
        const debug = document.getElementById('debug');
        debug.textContent += '\\n' + new Date().toISOString() + ': ' + message;
        debug.scrollTop = debug.scrollHeight;
    }
    
    async function login() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const messageDiv = document.getElementById('message');
        
        if (!email || !password) {
            messageDiv.className = 'error message';
            messageDiv.textContent = 'Please fill in both fields';
            return;
        }
        
        messageDiv.className = 'info message';
        messageDiv.textContent = 'Logging in...';
        updateDebug('Starting login request');
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            updateDebug('Response status: ' + response.status);
            updateDebug('Response data: ' + JSON.stringify(data));
            
            if (response.ok) {
                // Save user data to localStorage
                localStorage.setItem('user', JSON.stringify(data.user));
                updateDebug('Saved user to localStorage');
                
                // Set cookie manually if token is provided
                if (data.token) {
                    document.cookie = 'token=' + data.token + '; path=/; max-age=86400';
                    updateDebug('Set token cookie');
                    
                    // Also try setting as different cookie names
                    document.cookie = 'authToken=' + data.token + '; path=/; max-age=86400';
                    document.cookie = 'jwt=' + data.token + '; path=/; max-age=86400';
                }
                
                // Check if cookies were set
                updateDebug('Current cookies: ' + document.cookie);
                
                messageDiv.className = 'success message';
                messageDiv.innerHTML = 'Login successful!<br>User: ' + data.user.username + 
                                    '<br>Admin: ' + (data.user.is_admin ? 'Yes' : 'No') +
                                    '<br>Token: ' + (data.token ? 'Received' : 'Not received');
                
                // Test the token immediately
                if (data.token) {
                    updateDebug('Testing token validity...');
                    const testResponse = await fetch('/api/games', {
                        headers: { 'Authorization': 'Bearer ' + data.token }
                    });
                    updateDebug('Token test response: ' + testResponse.status);
                    
                    if (testResponse.ok) {
                        messageDiv.innerHTML += '<br><strong>Token is valid!</strong>';
                        messageDiv.innerHTML += '<br><br>Redirecting to threads...';
                        
                        setTimeout(() => {
                            window.location.href = '/hml/threads.html';
                        }, 3000);
                    } else {
                        messageDiv.innerHTML += '<br><strong>Token test failed!</strong>';
                    }
                }
            } else {
                messageDiv.className = 'error message';
                messageDiv.textContent = 'Login failed: ' + (data.error || 'Unknown error');
            }
        } catch (error) {
            messageDiv.className = 'error message';
            messageDiv.textContent = 'Network error: ' + error.message;
            updateDebug('Error: ' + error.message);
        }
    }
    
    // Allow Enter key to submit
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
    
    // Check existing auth on load
    window.onload = function() {
        updateDebug('Page loaded');
        updateDebug('Current cookies: ' + document.cookie);
        updateDebug('LocalStorage user: ' + (localStorage.getItem('user') ? 'exists' : 'none'));
        document.getElementById('password').focus();
    };
    </script>
</body>
</html>
BETTER_LOGIN

echo 'Better login page created'
echo 'Access it at: https://www.iinou.eu/better_login.html'
echo
echo 'This page will:'
echo '1. Show detailed debug information'
echo '2. Properly set cookies'
echo '3. Test the token immediately'
echo '4. Handle multiple cookie names'
"
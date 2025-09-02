#!/bin/bash

echo "Creating login helper page..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

# Check if proper login page exists
if [ -f hml/login.html ]; then
    echo 'Login page exists at /hml/login.html'
    echo 'You can access it at: https://www.iinou.eu/hml/login.html'
else
    echo 'Creating simple login page...'
    
    cat > login_helper.html << 'LOGIN_HTML'
<!DOCTYPE html>
<html lang=\"fi\">
<head>
    <meta charset=\"UTF-8\">
    <title>Login Helper</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
        .login-form { border: 1px solid #ccc; padding: 20px; margin-top: 20px; }
        input { width: 100%; padding: 8px; margin: 8px 0; box-sizing: border-box; }
        button { background: #007bff; color: white; padding: 10px 20px; border: none; cursor: pointer; }
        button:hover { background: #0056b3; }
        .message { margin-top: 10px; padding: 10px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        .info { background: #d1ecf1; color: #0c5460; }
    </style>
</head>
<body>
    <h1>Kirjaudu sisään</h1>
    
    <div class=\"info message\">
        <strong>Testikäyttäjätunnukset:</strong><br>
        Email: admin@example.com<br>
        Salasana: admin123
    </div>
    
    <div class=\"login-form\">
        <h3>Kirjautuminen</h3>
        <input type=\"email\" id=\"email\" placeholder=\"Sähköposti\" value=\"admin@example.com\">
        <input type=\"password\" id=\"password\" placeholder=\"Salasana\" value=\"\">
        <button onclick=\"login()\">Kirjaudu</button>
        <div id=\"message\"></div>
    </div>
    
    <div style=\"margin-top: 20px;\">
        <p>Kirjautumisen jälkeen voit:</p>
        <ul>
            <li><a href=\"/hml/threads.html\">Siirtyä lankoihin</a></li>
            <li><a href=\"/diagnostic.html\">Testata diagnostiikkatyökalua</a></li>
        </ul>
    </div>
    
    <script>
    async function login() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const messageDiv = document.getElementById('message');
        
        if (!email || !password) {
            messageDiv.className = 'error message';
            messageDiv.textContent = 'Täytä molemmat kentät';
            return;
        }
        
        messageDiv.className = 'info message';
        messageDiv.textContent = 'Kirjaudutaan...';
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Save user data to localStorage
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // The server should set a cookie, but we'll also save the token
                if (data.token) {
                    document.cookie = 'token=' + data.token + '; path=/';
                }
                
                messageDiv.className = 'success message';
                messageDiv.innerHTML = 'Kirjautuminen onnistui!<br>Käyttäjä: ' + data.user.username + 
                                    '<br>Rooli: ' + (data.user.is_admin ? 'Admin' : 'Käyttäjä') +
                                    '<br><br>Siirrytään lankoihin...';
                
                // Redirect after 2 seconds
                setTimeout(() => {
                    window.location.href = '/hml/threads.html';
                }, 2000);
            } else {
                messageDiv.className = 'error message';
                messageDiv.textContent = 'Kirjautuminen epäonnistui: ' + (data.error || 'Tuntematon virhe');
                console.error('Login error:', data);
            }
        } catch (error) {
            messageDiv.className = 'error message';
            messageDiv.textContent = 'Verkkovirhe: ' + error.message;
            console.error('Network error:', error);
        }
    }
    
    // Allow Enter key to submit
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
    
    // Auto-focus password field
    window.onload = function() {
        document.getElementById('password').focus();
    };
    </script>
</body>
</html>
LOGIN_HTML
    
    echo 'Login helper created at login_helper.html'
    echo 'Access it at: https://www.iinou.eu/login_helper.html'
fi

# Also check what login endpoints are available
echo
echo '=== Available login endpoints ==='
grep -n '/api/login' js/server_sqlite_new.js | head -5
echo

echo '=== Checking authentication middleware ==='
grep -n 'authenticateToken' js/server_sqlite_new.js | head -3
"
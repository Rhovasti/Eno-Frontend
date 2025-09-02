#!/bin/bash

echo "Creating fixed storyboard files..."

# Create a fixed HTML file
cat > /tmp/storyboard_fixed.html << 'EOF'
<!DOCTYPE html>
<html lang="fi">
    <head>
        <meta charset="UTF-8">
        <title>Story so far</title>
        <link rel="stylesheet" href="/css/styles.css">
        <style>
            #userControls {
                display: flex;
                align-items: center;
                margin-left: 20px;
            }
            
            #userInfo {
                margin-right: 15px;
            }
            
            .user-badge {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 12px;
                color: white;
                margin-left: 5px;
            }
            
            .admin-badge {
                background-color: #dc3545;
            }
            
            .gm-badge {
                background-color: #007bff;
            }
            
            .player-badge {
                background-color: #28a745;
            }
            
            .btn {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                color: white;
            }
            
            .btn-login {
                background-color: #007bff;
            }
            
            .btn-logout {
                background-color: #dc3545;
            }
            
            .game-section {
                margin: 20px 0;
                padding: 15px;
                border: 1px solid #ddd;
                border-radius: 8px;
            }
            
            .chapter-entry {
                margin: 15px 0;
                padding: 15px;
                background-color: #f8f9fa;
                border-radius: 5px;
            }
            
            .chapter-description {
                font-style: italic;
                color: #666;
                margin: 10px 0;
            }
            
            .archived-narrative {
                margin: 15px 0;
                padding: 15px;
                background-color: #e9ecef;
                border-left: 3px solid #007bff;
            }
            
            .archive-date {
                color: #6c757d;
                font-size: 0.9em;
                margin-top: 10px;
            }
        </style>
    </head>
<body>
    <header>
        <h1>Storyboard</h1>
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <nav id="navBar">
                <a href="/">Etusivu</a>
                <a href="/threads.html">Langat</a>
                <a href="/hml/storyboard.html">Storyboard</a>
                <a href="/wiki.html">Wiki</a>
            </nav>
            <div id="userControls">
                <div id="userInfo" style="display: none;">
                    <span>Tervetuloa, <span id="username"></span></span>
                    <span id="userEmail" style="margin-left: 5px; font-size: 12px; color: #666;"></span>
                    <span id="userBadges"></span>
                </div>
                <button id="loginBtn" class="btn btn-login">Kirjaudu sisään</button>
                <button id="logoutBtn" class="btn btn-logout" style="display: none;">Kirjaudu ulos</button>
            </div>
        </div>
    </header>
    <div class="container paper">
        <h2>Tarina tähän mennessä</h2>
        <div id="storyboard-content">
            <p>Ladataan arkistoituja lukuja...</p>
        </div>
    </div>
    <script src="/js/script.js"></script>
    <script src="/js/storyboard.js"></script>
</body>
</html>
EOF

# Copy the original storyboard.js file
cp /root/Eno/Eno-Frontend/js/storyboard.js /tmp/storyboard_fixed.js

# Upload the fixed files
echo "Uploading fixed storyboard files..."
sshpass -p 'ininFvTPNTguUtuuLbx3' sftp -o StrictHostKeyChecking=no root@95.217.21.111 << SFTP_CMD
cd /var/www/pelisivusto/hml
put /tmp/storyboard_fixed.html storyboard.html
cd ../js
put /tmp/storyboard_fixed.js storyboard.js
SFTP_CMD

echo "Fixed files deployed."
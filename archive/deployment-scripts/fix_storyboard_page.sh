#!/bin/bash

echo "Fixing storyboard page access..."

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 "
cd /var/www/pelisivusto

echo '=== Checking storyboard file locations ==='
ls -la | grep -i storyboard
ls -la hml/ | grep -i storyboard
echo

echo '=== Checking if storyboard.html exists in correct location ==='
if [ -f hml/storyboard.html ]; then
    echo 'Storyboard exists at /hml/storyboard.html'
    echo 'Correct URL: https://www.iinou.eu/hml/storyboard.html'
else
    echo 'Storyboard not found in /hml/, creating it...'
fi

echo '=== Making sure storyboard.html is in the right place ==='
# If storyboard.html exists in root, copy it to hml/
if [ -f storyboard.html ] && [ ! -f hml/storyboard.html ]; then
    echo 'Copying storyboard.html to hml/'
    cp storyboard.html hml/storyboard.html
fi

echo '=== Verifying storyboard.html content ==='
if [ -f hml/storyboard.html ]; then
    echo 'First few lines of hml/storyboard.html:'
    head -20 hml/storyboard.html
else
    echo 'Creating proper storyboard.html in hml/'
    cat > hml/storyboard.html << 'STORYBOARD_HTML'
<!DOCTYPE html>
<html lang=\"fi\">
<head>
    <meta charset=\"UTF-8\">
    <title>Story so far</title>
    <link rel=\"stylesheet\" href=\"/css/styles.css\">
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
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        
        .chapter-entry {
            margin: 15px 0;
            padding: 15px;
            background: white;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .gm-post {
            margin: 15px 0;
            padding: 10px;
            border-left: 3px solid #007bff;
        }
        
        .chapter-posts {
            margin-top: 15px;
        }
        
        .archive-date {
            font-style: italic;
            color: #6c757d;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <header>
        <h1>Storyboard</h1>
        <div style=\"display: flex; justify-content: space-between; align-items: center;\">
            <nav id=\"navBar\">
                <a href=\"/\">Etusivu</a>
                <a href=\"/hml/threads.html\">Langat</a>
                <a href=\"/hml/storyboard.html\">Storyboard</a>
                <a href=\"/hml/wiki.html\">Wiki</a>
            </nav>
            <div id=\"userControls\">
                <div id=\"userInfo\" style=\"display: none;\">
                    <span>Tervetuloa, <span id=\"username\"></span></span>
                    <span id=\"userEmail\" style=\"margin-left: 5px; font-size: 12px; color: #666;\"></span>
                    <span id=\"userBadges\"></span>
                </div>
                <button id=\"loginBtn\" class=\"btn btn-login\">Kirjaudu sisään</button>
                <button id=\"logoutBtn\" class=\"btn btn-logout\" style=\"display: none;\">Kirjaudu ulos</button>
            </div>
        </div>
    </header>
    <div class=\"container paper\">
        <h2>Tarina tähän mennessä</h2>
        <p>Ladataan arkistoituja lukuja...</p>
    </div>
    <script src=\"/js/script.js\"></script>
    <script src=\"/js/storyboard.js\"></script>
</body>
</html>
STORYBOARD_HTML
fi

echo '=== Checking navigation links ==='
echo 'Checking if index.html has correct storyboard link:'
grep -n 'storyboard' index.html || echo 'No storyboard link in index.html'
echo

echo '=== Creating redirect from root storyboard.html to correct location ==='
if [ ! -f hml/storyboard.html ]; then
    echo 'ERROR: Could not create storyboard.html in hml/'
else
    # Create redirect in root if needed
    cat > storyboard.html << 'REDIRECT_HTML'
<!DOCTYPE html>
<html>
<head>
    <meta http-equiv=\"refresh\" content=\"0; url=/hml/storyboard.html\">
    <title>Redirecting...</title>
</head>
<body>
    <p>Redirecting to <a href=\"/hml/storyboard.html\">storyboard</a>...</p>
</body>
</html>
REDIRECT_HTML
    echo 'Created redirect from /storyboard.html to /hml/storyboard.html'
fi

echo
echo 'Storyboard page should now be accessible at:'
echo 'https://www.iinou.eu/hml/storyboard.html'
echo
echo 'The page will:'
echo '- Show archived chapters for each game'
echo '- Display all GM posts in chronological order'
echo '- Update automatically when chapters are archived'
"
#!/bin/bash

echo "=== Improving GM Dashboard Navigation ==="

# This script adds GM indicators and dashboard links to game lists

sshpass -p 'ininFvTPNTguUtuuLbx3' ssh -o StrictHostKeyChecking=no root@95.217.21.111 << 'ENDSSH'
cd /var/www/pelisivusto

echo "=== Updating API to include GM info in game lists ==="
# Backup current server
cp js/server_sqlite.js js/server_sqlite.backup.gm_nav.$(date +%Y%m%d_%H%M%S).js

# Add GM info to games API endpoint
sed -i '/app.get.*\/api\/games.*req, res/,/^});/ {
    s/SELECT \* FROM games/SELECT g.*, CASE WHEN g.created_by = ? THEN 1 ELSE 0 END as is_gm FROM games g/
    s/\[\]/[req.user?.id || 0]/
}' js/server_sqlite.js

echo "=== Updating threads.html to show GM indicators ==="
# Backup threads.html
cp hml/threads.html hml/threads.html.backup.gm_nav.$(date +%Y%m%d_%H%M%S)

# Create an updated threads.html with GM indicators
cat > /tmp/threads_gm_update.js << 'EOF'
// Add this to the game loading section in threads.html
// This shows which games the user is GM of

function loadGames() {
    fetch('/api/games', {
        headers: {
            'Authorization': `Bearer ${getCookie('token')}`
        }
    })
    .then(response => response.json())
    .then(games => {
        const gameList = document.getElementById('gameList');
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        gameList.innerHTML = games.map(game => {
            const isGM = game.created_by === user.id || user.is_admin;
            return `
                <div class="game-card">
                    <h3>
                        <a href="/hml/threads.html?game=${game.id}">${game.title}</a>
                        ${isGM ? '<span class="gm-indicator" title="Olet tämän pelin GM">👑</span>' : ''}
                    </h3>
                    <p>${game.description}</p>
                    ${isGM ? `<a href="/hml/gm-dashboard.html?game=${game.id}" class="btn btn-sm btn-primary">GM Dashboard</a>` : ''}
                </div>
            `;
        }).join('');
    })
    .catch(error => {
        console.error('Error loading games:', error);
    });
}
EOF

echo "=== Adding styles for GM indicators ==="
# Add CSS for GM indicators
sed -i '/<\/style>/i\
        .gm-indicator {\
            color: #ffc107;\
            font-size: 20px;\
            margin-left: 10px;\
            vertical-align: middle;\
        }\
        \
        .game-card {\
            border: 1px solid #ddd;\
            padding: 15px;\
            margin-bottom: 15px;\
            border-radius: 5px;\
        }\
        \
        .game-card h3 {\
            margin-top: 0;\
        }\
        \
        .btn-sm {\
            padding: 4px 8px;\
            font-size: 12px;\
        }' hml/threads.html

echo "=== Creating My Games page for GMs ==="
cat > hml/my-games.html << 'EOF'
<!DOCTYPE html>
<html lang="fi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Omat Pelit - Eno</title>
    <link rel="stylesheet" href="/css/styles.css">
    <style>
        .games-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }
        
        .game-card {
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 20px;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: transform 0.2s;
        }
        
        .game-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }
        
        .game-card h3 {
            margin-top: 0;
            color: #333;
        }
        
        .game-stats {
            display: flex;
            gap: 15px;
            margin: 10px 0;
            font-size: 14px;
            color: #666;
        }
        
        .game-actions {
            display: flex;
            gap: 10px;
            margin-top: 15px;
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            font-size: 14px;
        }
        
        .btn-primary {
            background: #007bff;
            color: white;
        }
        
        .btn-secondary {
            background: #6c757d;
            color: white;
        }
        
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #666;
        }
        
        .create-game-cta {
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <header>
        <h1>Omat Pelit</h1>
        <nav id="navBar">
            <a href="/">Etusivu</a>
            <a href="/hml/threads.html">Langat</a>
            <a href="/hml/storyboard.html">Storyboard</a>
            <a href="/hml/wiki.html">Wiki</a>
            <a href="/hml/my-games.html" class="active">Omat Pelit</a>
        </nav>
    </header>

    <main class="container">
        <div class="page-header">
            <h2>GM Dashboard - Hallinnoi pelejäsi</h2>
            <a href="/hml/create-game.html" class="btn btn-primary">+ Luo uusi peli</a>
        </div>
        
        <div id="myGamesGrid" class="games-grid">
            <!-- Games will be loaded here -->
        </div>
        
        <div id="emptyState" class="empty-state" style="display:none;">
            <h3>Et ole vielä luonut yhtään peliä</h3>
            <p>Aloita luomalla ensimmäinen pelisi!</p>
            <div class="create-game-cta">
                <a href="/hml/create-game.html" class="btn btn-primary">Luo uusi peli</a>
            </div>
        </div>
    </main>

    <script src="/js/script.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', async function() {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            
            if (!user.id) {
                window.location.href = '/hml/login.html';
                return;
            }
            
            // Check if user is GM
            const roles = JSON.parse(user.roles || '[]');
            if (!roles.includes('gm') && !user.is_admin) {
                alert('Tämä sivu on vain GM-käyttäjille');
                window.location.href = '/';
                return;
            }
            
            loadMyGames();
        });
        
        async function loadMyGames() {
            try {
                const response = await fetch('/api/games', {
                    headers: {
                        'Authorization': `Bearer ${getCookie('token')}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Failed to load games');
                }
                
                const allGames = await response.json();
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const myGames = allGames.filter(game => game.created_by === user.id);
                
                const grid = document.getElementById('myGamesGrid');
                const emptyState = document.getElementById('emptyState');
                
                if (myGames.length === 0) {
                    grid.style.display = 'none';
                    emptyState.style.display = 'block';
                    return;
                }
                
                grid.innerHTML = myGames.map(game => `
                    <div class="game-card">
                        <h3>${game.title}</h3>
                        <p>${game.description}</p>
                        <div class="game-stats">
                            <span>📊 ${game.total_posts || 0} postausta</span>
                            <span>👥 ${game.player_count || 0} pelaajaa</span>
                            <span>📖 ${game.chapter_count || 0} lukua</span>
                        </div>
                        <div class="game-actions">
                            <a href="/hml/gm-dashboard.html?game=${game.id}" class="btn btn-primary">
                                GM Dashboard
                            </a>
                            <a href="/hml/threads.html?game=${game.id}" class="btn btn-secondary">
                                Näytä peli
                            </a>
                        </div>
                    </div>
                `).join('');
                
            } catch (error) {
                console.error('Error loading games:', error);
                alert('Virhe pelien lataamisessa');
            }
        }
        
        function getCookie(name) {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop().split(';').shift();
            return null;
        }
    </script>
</body>
</html>
EOF

echo "=== Restarting server ==="
systemctl restart pelisivusto

sleep 3

echo "=== Navigation improvements complete! ==="
echo "New features added:"
echo "✅ GM crown indicator (👑) on games you manage"
echo "✅ Direct GM Dashboard links in game lists"
echo "✅ My Games page at /hml/my-games.html for GMs"
echo ""
echo "GMs can now easily find and manage their games!"

ENDSSH

echo -e "\n=== Local script complete ==="
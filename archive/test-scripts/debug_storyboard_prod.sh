#!/bin/bash

# Create a temporary debug version of storyboard.js
cat > /tmp/storyboard_debug.js << 'EOF'
// storyboard.js - Debug version

document.addEventListener('DOMContentLoaded', function() {
    console.log('Storyboard script loaded');
    
    // User authentication elements
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('userInfo');
    const username = document.getElementById('username');
    const userEmail = document.getElementById('userEmail');
    const userBadges = document.getElementById('userBadges');
    
    console.log('DOM elements found:', {
        loginBtn: !!loginBtn,
        logoutBtn: !!logoutBtn,
        userInfo: !!userInfo
    });
    
    // Check if user is logged in
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isLoggedIn = !!user.id;
    const token = getCookie('token');
    
    console.log('Auth status:', {
        isLoggedIn,
        hasToken: !!token,
        userName: user.username
    });
    
    if (!isLoggedIn || !token) {
        console.log('Not logged in, redirecting to login page');
        window.location.href = '/hml/login.html';
        return;
    }
    
    // Update UI for logged in user
    if (loginBtn && logoutBtn && userInfo) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        userInfo.style.display = 'inline-block';
        username.textContent = user.username;
        userEmail.textContent = user.email;
        
        // Safely parse and display badges for user roles
        let roles = [];
        try {
            roles = JSON.parse(user.roles || '[]');
            if (!Array.isArray(roles)) roles = [];
        } catch (error) {
            console.error('Error parsing user roles:', error);
            roles = [];
        }
        
        if (user.is_admin) {
            userBadges.innerHTML += '<span class="user-badge admin-badge">Admin</span>';
        }
        if (roles.includes('gm')) {
            userBadges.innerHTML += '<span class="user-badge gm-badge">GM</span>';
        }
        if (roles.includes('player')) {
            userBadges.innerHTML += '<span class="user-badge player-badge">Pelaaja</span>';
        }
    }
    
    // Handle logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            fetch('/api/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getCookie('token')}`
                }
            })
            .then(() => {
                localStorage.removeItem('user');
                // Clear the token cookie
                document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                window.location.href = '/hml/login.html';
            })
            .catch(error => {
                console.error('Logout error:', error);
                // Even if there's an error, clear the local storage and redirect
                localStorage.removeItem('user');
                document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                window.location.href = '/hml/login.html';
            });
        });
    }
    
    // Load games and their archived chapters
    console.log('Loading archived content...');
    loadArchivedContent();
    
    function loadArchivedContent() {
        console.log('Fetching games with token:', token);
        
        fetch('/api/games', {
            headers: {
                'Authorization': `Bearer ${getCookie('token')}`
            }
        })
        .then(response => {
            console.log('Games response:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error('Failed to fetch games: ' + response.status);
            }
            return response.json();
        })
        .then(games => {
            console.log('Games loaded:', games);
            const container = document.querySelector('.container.paper');
            container.innerHTML = '<h2>Tarina tähän mennessä</h2>';
            
            if (!games || games.length === 0) {
                container.innerHTML += '<p>Ei pelejä saatavilla.</p>';
                return;
            }
            
            // For each game, load its archived chapters
            games.forEach(game => {
                console.log('Processing game:', game);
                const gameSection = document.createElement('section');
                gameSection.className = 'game-section';
                gameSection.innerHTML = `<h3>${game.name}</h3>`;
                
                if (game.description) {
                    gameSection.innerHTML += `<p class="game-description">${game.description}</p>`;
                }
                
                // Load archived chapters for this game
                console.log(`Fetching archived chapters for game ${game.id}`);
                fetch(`/api/games/${game.id}/archived-chapters`, {
                    headers: {
                        'Authorization': `Bearer ${getCookie('token')}`
                    }
                })
                .then(response => {
                    console.log(`Archived chapters response for game ${game.id}:`, response.status);
                    return response.json();
                })
                .then(chapters => {
                    console.log(`Archived chapters for game ${game.id}:`, chapters);
                    if (!chapters || chapters.length === 0) {
                        gameSection.innerHTML += '<p>Ei arkistoituja lukuja.</p>';
                    } else {
                        chapters.forEach(chapter => {
                            const chapterDiv = document.createElement('article');
                            chapterDiv.className = 'chapter-entry';
                            
                            const title = document.createElement('h4');
                            title.textContent = `Luku ${chapter.sequence_number}: ${chapter.title}`;
                            chapterDiv.appendChild(title);
                            
                            if (chapter.description) {
                                const desc = document.createElement('p');
                                desc.className = 'chapter-description';
                                desc.textContent = chapter.description;
                                chapterDiv.appendChild(desc);
                            }
                            
                            // Add archived narrative if available
                            if (chapter.archived_narrative) {
                                const narrativeDiv = document.createElement('div');
                                narrativeDiv.className = 'archived-narrative';
                                narrativeDiv.innerHTML = `<h5>Arkistoitu kertomusteksti:</h5><p>${chapter.archived_narrative}</p>`;
                                chapterDiv.appendChild(narrativeDiv);
                            }
                            
                            const archiveDate = document.createElement('p');
                            archiveDate.className = 'archive-date';
                            archiveDate.textContent = `Arkistoitu: ${new Date(chapter.archived_at).toLocaleDateString('fi-FI')}`;
                            chapterDiv.appendChild(archiveDate);
                            
                            gameSection.appendChild(chapterDiv);
                        });
                    }
                })
                .catch(error => {
                    console.error(`Error loading archived chapters for game ${game.id}:`, error);
                    gameSection.innerHTML += '<p>Virhe arkistoitujen lukujen lataamisessa.</p>';
                });
                
                container.appendChild(gameSection);
            });
        })
        .catch(error => {
            console.error('Error loading games:', error);
            const container = document.querySelector('.container.paper');
            container.innerHTML += '<p>Virhe pelien lataamisessa. Check console for details.</p>';
        });
    }
    
    // Helper function to get cookie value
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }
});
EOF

# Upload the debug version
echo "Uploading debug version of storyboard.js..."
sshpass -p 'ininFvTPNTguUtuuLbx3' sftp -o StrictHostKeyChecking=no root@95.217.21.111 << SFTP_CMD
cd /var/www/pelisivusto/js
put /tmp/storyboard_debug.js storyboard.js
SFTP_CMD

echo "Debug version deployed. Check browser console for detailed logs."
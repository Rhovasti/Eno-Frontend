// storyboard.js

document.addEventListener('DOMContentLoaded', function() {
    // User authentication elements
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userInfo = document.getElementById('userInfo');
    const username = document.getElementById('username');
    const userEmail = document.getElementById('userEmail');
    const userBadges = document.getElementById('userBadges');
    
    // Check if user is logged in
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isLoggedIn = !!user.id;
    
    if (!isLoggedIn) {
        // Redirect to login if not authenticated
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
    loadArchivedContent();
    
    function loadArchivedContent() {
        fetch('/api/games', {
            headers: {
                'Authorization': `Bearer ${getCookie('token')}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch games');
            }
            return response.json();
        })
        .then(games => {
            const container = document.querySelector('.container.paper');
            container.innerHTML = '<h2>Tarina tähän mennessä</h2>';
            
            if (games.length === 0) {
                container.innerHTML += '<p>Ei pelejä saatavilla.</p>';
                return;
            }
            
            // For each game, load its archived chapters
            games.forEach(game => {
                const gameSection = document.createElement('section');
                gameSection.className = 'game-section';
                gameSection.innerHTML = `<h3>${game.name}</h3>`;
                
                if (game.description) {
                    gameSection.innerHTML += `<p class="game-description">${game.description}</p>`;
                }
                
                // Load archived chapters for this game
                fetch(`/api/games/${game.id}/archived-chapters`, {
                    headers: {
                        'Authorization': `Bearer ${getCookie('token')}`
                    }
                })
                .then(response => response.json())
                .then(chapters => {
                    if (chapters.length === 0) {
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
                            
                            // Fetch all GM posts for this chapter
                            const postsDiv = document.createElement('div');
                            postsDiv.className = 'chapter-posts';
                            postsDiv.innerHTML = '<p>Ladataan viestejä...</p>';
                            chapterDiv.appendChild(postsDiv);
                            
                            // Get all beats for this chapter, then all GM posts
                            fetch(`/api/chapters/${chapter.id}/beats`, {
                                headers: {
                                    'Authorization': `Bearer ${getCookie('token')}`
                                }
                            })
                            .then(response => response.json())
                            .then(beats => {
                                // Collect all GM posts across all beats
                                const postPromises = beats.map(beat => 
                                    fetch(`/api/beats/${beat.id}/posts`, {
                                        headers: {
                                            'Authorization': `Bearer ${getCookie('token')}`
                                        }
                                    })
                                    .then(response => response.json())
                                    .then(posts => posts.filter(post => post.post_type === 'gm'))
                                );
                                
                                return Promise.all(postPromises);
                            })
                            .then(postArrays => {
                                // Flatten and sort all GM posts chronologically
                                const allGmPosts = postArrays.flat()
                                    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                                
                                postsDiv.innerHTML = '';
                                
                                if (allGmPosts.length === 0) {
                                    postsDiv.innerHTML = '<p>Ei GM-viestejä löytynyt.</p>';
                                } else {
                                    allGmPosts.forEach((post, index) => {
                                        const postDiv = document.createElement('div');
                                        postDiv.className = 'gm-post';
                                        postDiv.style.cssText = 'margin: 15px 0; padding: 10px; border-left: 3px solid #007bff;';
                                        
                                        const postTitle = document.createElement('h5');
                                        postTitle.textContent = post.title || `Viesti ${index + 1}`;
                                        postTitle.style.cssText = 'color: #007bff; margin: 0 0 5px 0;';
                                        postDiv.appendChild(postTitle);
                                        
                                        const postContent = document.createElement('p');
                                        postContent.textContent = post.content;
                                        postContent.style.cssText = 'margin: 0;';
                                        postDiv.appendChild(postContent);
                                        
                                        postsDiv.appendChild(postDiv);
                                        
                                        // Add separator between posts
                                        if (index < allGmPosts.length - 1) {
                                            const separator = document.createElement('hr');
                                            separator.style.cssText = 'margin: 15px 0; border: none; border-top: 1px dashed #ccc;';
                                            postsDiv.appendChild(separator);
                                        }
                                    });
                                }
                            })
                            .catch(error => {
                                console.error('Error loading posts:', error);
                                postsDiv.innerHTML = '<p>Virhe viestien lataamisessa.</p>';
                            });
                            
                            const archiveDate = document.createElement('p');
                            archiveDate.className = 'archive-date';
                            archiveDate.textContent = `Arkistoitu: ${new Date(chapter.archived_at).toLocaleDateString('fi-FI')}`;
                            chapterDiv.appendChild(archiveDate);
                            
                            gameSection.appendChild(chapterDiv);
                        });
                    }
                })
                .catch(error => {
                    console.error('Error loading archived chapters:', error);
                    gameSection.innerHTML += '<p>Virhe arkistoitujen lukujen lataamisessa.</p>';
                });
                
                container.appendChild(gameSection);
            });
        })
        .catch(error => {
            console.error('Error loading games:', error);
            const container = document.querySelector('.container.paper');
            container.innerHTML += '<p>Virhe pelien lataamisessa.</p>';
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
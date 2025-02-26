// threads.js

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
        
        // Display badges for user roles
        const roles = JSON.parse(user.roles || '[]');
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
    
    const gameSelect = document.getElementById('gameSelect');
    const chapterSelect = document.getElementById('chapterSelect');
    const beatSelect = document.getElementById('beatSelect');
    const postsContainer = document.getElementById('postsContainer');
    const newPostForm = document.getElementById('newPostForm');
    const createPostForm = document.getElementById('createPostForm');
    const isGMPostCheckbox = document.getElementById('isGMPost');
    
    // Handle creating chapters and beats - only for GMs
    const createChapterButton = document.getElementById('createChapterButton');
    const newChapterForm = document.getElementById('newChapterForm');
    const createChapterForm = document.getElementById('createChapterForm');
    const createBeatButton = document.getElementById('createBeatButton');
    const newBeatForm = document.getElementById('newBeatForm');
    const createBeatForm = document.getElementById('createBeatForm');
    
    const roles = JSON.parse(user.roles || '[]');
    const isGM = roles.includes('gm') || user.is_admin;
    
    // Check URL parameters for game ID
    const urlParams = new URLSearchParams(window.location.search);
    const selectedGameId = urlParams.get('gameId');
    
    // Fetch all games
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
        // Populate game select
        games.forEach(game => {
            const option = document.createElement('option');
            option.value = game.id;
            option.textContent = game.name;
            gameSelect.appendChild(option);
        });
        
        // If game ID in URL, select it
        if (selectedGameId) {
            gameSelect.value = selectedGameId;
            loadChapters(selectedGameId);
        }
    })
    .catch(error => console.error('Error fetching games:', error));
    
    // Event listener for game selection
    gameSelect.addEventListener('change', function() {
        const gameId = this.value;
        chapterSelect.disabled = !gameId;
        createChapterButton.disabled = !gameId || !isGM;
        
        if (gameId) {
            loadChapters(gameId);
        } else {
            // Clear chapter select
            chapterSelect.innerHTML = '<option value="">Valitse Luku</option>';
            chapterSelect.disabled = true;
            beatSelect.innerHTML = '<option value="">Valitse Beatti</option>';
            beatSelect.disabled = true;
            postsContainer.innerHTML = '';
            newPostForm.style.display = 'none';
        }
    });
    
    // Event listener for chapter selection
    chapterSelect.addEventListener('change', function() {
        const chapterId = this.value;
        beatSelect.disabled = !chapterId;
        createBeatButton.disabled = !chapterId || !isGM;
        
        if (chapterId) {
            loadBeats(chapterId);
        } else {
            // Clear beat select
            beatSelect.innerHTML = '<option value="">Valitse Beatti</option>';
            beatSelect.disabled = true;
            postsContainer.innerHTML = '';
            newPostForm.style.display = 'none';
        }
    });
    
    // Event listener for beat selection
    beatSelect.addEventListener('change', function() {
        const beatId = this.value;
        
        if (beatId) {
            loadPosts(beatId);
            newPostForm.style.display = 'block';
            
            // Hide GM post option if user is not a GM
            isGMPostCheckbox.parentElement.style.display = isGM ? 'block' : 'none';
        } else {
            postsContainer.innerHTML = '';
            newPostForm.style.display = 'none';
        }
    });
    
    // Show/hide new chapter form
    if (createChapterButton) {
        createChapterButton.addEventListener('click', function() {
            newChapterForm.style.display = newChapterForm.style.display === 'none' ? 'block' : 'none';
        });
    }
    
    // Show/hide new beat form
    if (createBeatButton) {
        createBeatButton.addEventListener('click', function() {
            newBeatForm.style.display = newBeatForm.style.display === 'none' ? 'block' : 'none';
        });
    }
    
    // Create new chapter
    if (createChapterForm) {
        createChapterForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const gameId = gameSelect.value;
            const title = document.getElementById('chapterTitle').value;
            const description = document.getElementById('chapterDescription').value;
            
            fetch(`/api/games/${gameId}/chapters`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getCookie('token')}`
                },
                body: JSON.stringify({ title, description })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to create chapter');
                }
                return response.json();
            })
            .then(data => {
                // Refresh chapters
                loadChapters(gameId);
                newChapterForm.style.display = 'none';
                createChapterForm.reset();
            })
            .catch(error => console.error('Error creating chapter:', error));
        });
    }
    
    // Create new beat
    if (createBeatForm) {
        createBeatForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const chapterId = chapterSelect.value;
            const title = document.getElementById('beatTitle').value;
            const content = document.getElementById('beatContent').value;
            
            fetch(`/api/chapters/${chapterId}/beats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getCookie('token')}`
                },
                body: JSON.stringify({ title, content })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to create beat');
                }
                return response.json();
            })
            .then(data => {
                // Refresh beats
                loadBeats(chapterId);
                newBeatForm.style.display = 'none';
                createBeatForm.reset();
            })
            .catch(error => console.error('Error creating beat:', error));
        });
    }
    
    // Create new post
    if (createPostForm) {
        createPostForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const beatId = beatSelect.value;
            const title = document.getElementById('postTitle').value;
            const content = document.getElementById('postContent').value;
            const postType = isGMPostCheckbox.checked ? 'gm' : 'player';
            
            fetch('/api/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getCookie('token')}`
                },
                body: JSON.stringify({ beatId, title, content, postType })
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Failed to create post');
                }
                return response.json();
            })
            .then(data => {
                // Refresh posts
                loadPosts(beatId);
                createPostForm.reset();
            })
            .catch(error => console.error('Error creating post:', error));
        });
    }
    
    // Functions to load data
    function loadChapters(gameId) {
        fetch(`/api/games/${gameId}/chapters`, {
            headers: {
                'Authorization': `Bearer ${getCookie('token')}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch chapters');
            }
            return response.json();
        })
        .then(chapters => {
            // Clear and populate chapter select
            chapterSelect.innerHTML = '<option value="">Valitse Luku</option>';
            
            chapters.forEach(chapter => {
                const option = document.createElement('option');
                option.value = chapter.id;
                option.textContent = chapter.title || `Luku ${chapter.sequence_number}`;
                chapterSelect.appendChild(option);
            });
            
            chapterSelect.disabled = false;
            createChapterButton.disabled = !isGM;
        })
        .catch(error => console.error('Error fetching chapters:', error));
    }
    
    function loadBeats(chapterId) {
        fetch(`/api/chapters/${chapterId}/beats`, {
            headers: {
                'Authorization': `Bearer ${getCookie('token')}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch beats');
            }
            return response.json();
        })
        .then(beats => {
            // Clear and populate beat select
            beatSelect.innerHTML = '<option value="">Valitse Beatti</option>';
            
            // Group beats by ID
            const groupedBeats = beats.reduce((acc, item) => {
                if (!acc[item.id]) {
                    acc[item.id] = {
                        id: item.id,
                        title: item.title,
                        sequence_number: item.sequence_number
                    };
                }
                return acc;
            }, {});
            
            Object.values(groupedBeats).sort((a, b) => a.sequence_number - b.sequence_number).forEach(beat => {
                const option = document.createElement('option');
                option.value = beat.id;
                option.textContent = beat.title || `Beatti ${beat.sequence_number}`;
                beatSelect.appendChild(option);
            });
            
            beatSelect.disabled = false;
            createBeatButton.disabled = !isGM;
        })
        .catch(error => console.error('Error fetching beats:', error));
    }
    
    function loadPosts(beatId) {
        fetch(`/api/beats/${beatId}/posts`, {
            headers: {
                'Authorization': `Bearer ${getCookie('token')}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch posts');
            }
            return response.json();
        })
        .then(posts => {
            // Clear and populate posts container
            postsContainer.innerHTML = '';
            
            if (posts.length === 0) {
                const message = document.createElement('p');
                message.textContent = 'Ei viestejä. Ole ensimmäinen joka kirjoittaa!';
                postsContainer.appendChild(message);
            } else {
                posts.forEach(post => {
                    const postElement = document.createElement('div');
                    postElement.className = `post ${post.post_type}-post`;
                    
                    const postHeader = document.createElement('div');
                    postHeader.className = 'post-header';
                    
                    const postTitle = document.createElement('h3');
                    postTitle.textContent = post.title;
                    
                    const postAuthor = document.createElement('span');
                    postAuthor.className = 'post-author';
                    postAuthor.textContent = post.post_type === 'gm' ? `GM: ${post.username}` : post.username;
                    
                    const postDate = document.createElement('span');
                    postDate.className = 'post-date';
                    postDate.textContent = new Date(post.created_at).toLocaleString();
                    
                    const postContent = document.createElement('div');
                    postContent.className = 'post-content';
                    postContent.textContent = post.content;
                    
                    postHeader.appendChild(postTitle);
                    postHeader.appendChild(postAuthor);
                    postHeader.appendChild(postDate);
                    
                    postElement.appendChild(postHeader);
                    postElement.appendChild(postContent);
                    
                    postsContainer.appendChild(postElement);
                });
            }
        })
        .catch(error => console.error('Error fetching posts:', error));
    }
    
    // Helper function to get cookie value
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }
});
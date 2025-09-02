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
    
    const gameSelect = document.getElementById('gameSelect');
    const chapterSelect = document.getElementById('chapterSelect');
    const beatSelect = document.getElementById('beatSelect');
    const postsContainer = document.getElementById('postsContainer');
    const newPostForm = document.getElementById('newPostForm');
    const createPostForm = document.getElementById('createPostForm');
    const isGMPostCheckbox = document.getElementById('isGMPost');
    const archiveChapterOnPostCheckbox = document.getElementById('archiveChapterOnPost');
    const archiveChapterLabel = document.getElementById('archiveChapterLabel');
    
    // Handle creating chapters and beats - only for GMs
    const createChapterButton = document.getElementById('createChapterButton');
    const newChapterForm = document.getElementById('newChapterForm');
    const createChapterForm = document.getElementById('createChapterForm');
    const createBeatButton = document.getElementById('createBeatButton');
    const newBeatForm = document.getElementById('newBeatForm');
    const createBeatForm = document.getElementById('createBeatForm');
    const archiveChapterButton = document.getElementById('archiveChapterButton');
    
    // Safely parse roles
    let roles = [];
    try {
        roles = JSON.parse(user.roles || '[]');
        if (!Array.isArray(roles)) roles = [];
    } catch (error) {
        console.error('Error parsing user roles:', error);
        roles = [];
    }
    
    const isGM = roles.includes('gm') || user.is_admin;
    
    // Toggle archive chapter option when GM checkbox is changed
    if (isGMPostCheckbox) {
        isGMPostCheckbox.addEventListener('change', function() {
            if (this.checked && isGM) {
                archiveChapterLabel.style.display = 'block';
            } else {
                archiveChapterLabel.style.display = 'none';
                archiveChapterOnPostCheckbox.checked = false;
            }
        });
    }
    
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
        const selectedOption = this.options[this.selectedIndex];
        const isArchived = selectedOption.dataset.archived === 'true';
        
        beatSelect.disabled = !chapterId;
        createBeatButton.disabled = !chapterId || !isGM || isArchived;
        archiveChapterButton.disabled = !chapterId || !isGM || isArchived;
        
        if (chapterId) {
            loadBeats(chapterId);
            
            // Show notice if chapter is archived
            if (isArchived) {
                if (!document.getElementById('archiveNotice')) {
                    const notice = document.createElement('div');
                    notice.id = 'archiveNotice';
                    notice.className = 'archive-notice';
                    notice.style.cssText = 'background-color: #f8f9fa; border: 1px solid #dee2e6; color: #6c757d; padding: 10px; margin: 10px 0; border-radius: 4px;';
                    notice.textContent = 'Tämä luku on arkistoitu. Uusien viestien ja beattien luominen on estetty.';
                    chapterSelect.parentNode.insertBefore(notice, chapterSelect.nextSibling);
                }
            } else {
                // Remove notice if it exists
                const notice = document.getElementById('archiveNotice');
                if (notice) notice.remove();
            }
        } else {
            // Clear beat select
            beatSelect.innerHTML = '<option value="">Valitse Beatti</option>';
            beatSelect.disabled = true;
            postsContainer.innerHTML = '';
            newPostForm.style.display = 'none';
            
            // Remove archive notice
            const notice = document.getElementById('archiveNotice');
            if (notice) notice.remove();
        }
    });
    
    // Event listener for beat selection
    beatSelect.addEventListener('change', function() {
        const beatId = this.value;
        const selectedChapterOption = chapterSelect.options[chapterSelect.selectedIndex];
        const isChapterArchived = selectedChapterOption.dataset.archived === 'true';
        
        if (beatId) {
            loadPosts(beatId);
            
            // Only show new post form if chapter is not archived
            if (!isChapterArchived) {
                newPostForm.style.display = 'block';
                
                // Hide GM post option if user is not a GM
                isGMPostCheckbox.parentElement.style.display = isGM ? 'block' : 'none';
                
                // Hide archive chapter option by default
                archiveChapterLabel.style.display = 'none';
                archiveChapterOnPostCheckbox.checked = false;
            } else {
                newPostForm.style.display = 'none';
            }
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
    
    // Archive chapter
    if (archiveChapterButton) {
        archiveChapterButton.addEventListener('click', function() {
            const chapterId = chapterSelect.value;
            const selectedOption = chapterSelect.options[chapterSelect.selectedIndex];
            const chapterTitle = selectedOption.textContent;
            
            if (!chapterId) {
                alert('Valitse ensin luku');
                return;
            }
            
            if (confirm(`Haluatko varmasti arkistoida luvun "${chapterTitle}"? Tämä kokoaa kaikki luvun beatit yhteen tarinaksi ja sulkee luvun.`)) {
                fetch(`/api/chapters/${chapterId}/archive`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${getCookie('token')}`
                    }
                })
                .then(response => {
                    if (!response.ok) {
                        return response.json().then(data => {
                            throw new Error(data.error || `Server error: ${response.status}`);
                        });
                    }
                    return response.json();
                })
                .then(data => {
                    alert('Luku arkistoitu onnistuneesti!');
                    // Reload chapters to update the list
                    loadChapters(gameSelect.value);
                })
                .catch(error => {
                console.error("Full error details:", error);
                    console.error('Error archiving chapter:', error);
                    alert(`Virhe luvun arkistoinnissa: ${error.message}`);
                });
            }
        });
    }
    
    // Create new chapter
    if (createChapterForm) {
        createChapterForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const gameId = gameSelect.value;
            const title = document.getElementById('chapterTitle').value;
            const description = document.getElementById('chapterDescription').value;
            
            // Basic validation
            if (!gameId) {
                alert('Valitse ensin peli');
                return;
            }
            
            if (!title) {
                alert('Otsikko vaaditaan');
                return;
            }
            
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
                    return response.json().then(data => {
                        throw new Error(data.error || `Server error: ${response.status}`);
                    }).catch(e => {
                        throw new Error(`Failed to create chapter: ${response.statusText}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                // Refresh chapters
                loadChapters(gameId);
                newChapterForm.style.display = 'none';
                createChapterForm.reset();
            })
            .catch(error => {
                console.error('Error creating chapter:', error);
                alert(`Virhe luvun luomisessa: ${error.message}`);
            });
        });
    }
    
    // Create new beat
    if (createBeatForm) {
        createBeatForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const chapterId = chapterSelect.value;
            const title = document.getElementById('beatTitle').value;
            const content = document.getElementById('beatContent').value;
            
            // Basic validation
            if (!chapterId) {
                alert('Valitse ensin luku');
                return;
            }
            
            if (!title) {
                alert('Otsikko vaaditaan');
                return;
            }
            
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
                    return response.json().then(data => {
                        throw new Error(data.error || `Server error: ${response.status}`);
                    }).catch(e => {
                        throw new Error(`Failed to create beat: ${response.statusText}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                // Refresh beats
                loadBeats(chapterId);
                newBeatForm.style.display = 'none';
                createBeatForm.reset();
            })
            .catch(error => {
                console.error('Error creating beat:', error);
                alert(`Virhe beatin luomisessa: ${error.message}`);
            });
        });
    }
    
    // Create new post on existing beat
    if (createPostForm) {
        createPostForm.addEventListener('submit', function(event) {
        console.log("Post form submitted");
            event.preventDefault();
            
            const beatId = beatSelect.value;
            const title = document.getElementById('postTitle').value;
            const content = document.getElementById('postContent').value;
            const postType = isGMPostCheckbox.checked ? 'gm' : 'player';
            const archiveChapter = archiveChapterOnPostCheckbox.checked;
        console.log("Form values:", {beatId, title, content, postType, archiveChapter});
            
            // Basic validation
            if (!beatId) {
                alert('Valitse ensin beatti');
                return;
            }
            
            if (!title || !content) {
                alert('Otsikko ja sisältö vaaditaan');
                return;
            }
            
            // Show loading state
            const submitButton = this.querySelector('button[type="submit"]');
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'Lähetetään...';
            
            console.log('Posting new message to existing beat:', { 
                beatId, 
                title,
                contentLength: content.length,
                postType,
                archiveChapter
            });
            
            console.log("Sending POST request to /api/posts");
        fetch('/api/posts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getCookie('token')}`
                },
                body: JSON.stringify({ beatId, title, content, postType, archiveChapter })
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.error || `Server error: ${response.status}`);
                    }).catch(e => {
                        // If JSON parsing fails, use status text
                        throw new Error(`Failed to create post: ${response.statusText}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log('Post created successfully:', data);
                // Refresh posts for the current beat
                loadPosts(beatId);
                createPostForm.reset();
                // Reset button state
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
                
                // If chapter was archived, reload chapters to update the list
                if (data.chapterArchived) {
                    alert('Luku arkistoitu onnistuneesti!');
                    loadChapters(gameSelect.value);
                }
            })
            .catch(error => {
                console.error('Error creating post:', error);
                alert(`Virhe viestin luomisessa: ${error.message}`);
                // Reset button state
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;
            });
        });
    }
    
    // Functions to load data
    function loadChapters(gameId) {
        fetch(`/api/games/${gameId}/chapters?includeArchived=true`, {
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
            
            // Sort chapters by sequence number and show all (including archived)
            chapters
                .sort((a, b) => a.sequence_number - b.sequence_number)
                .forEach(chapter => {
                    const option = document.createElement('option');
                    option.value = chapter.id;
                    option.textContent = chapter.title || `Luku ${chapter.sequence_number}`;
                    
                    // Style archived chapters differently
                    if (chapter.is_archived) {
                        option.textContent += ' (Arkistoitu)';
                        option.style.color = '#999';
                        option.style.fontStyle = 'italic';
                    }
                    
                    // Store archived status in data attribute
                    option.dataset.archived = chapter.is_archived ? 'true' : 'false';
                    
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
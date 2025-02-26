// threads.js

document.addEventListener('DOMContentLoaded', function() {
    const gameSelect = document.getElementById('gameSelect');
    const chapterSelect = document.getElementById('chapterSelect');
    const beatSelect = document.getElementById('beatSelect');
    const postsContainer = document.getElementById('postsContainer');
    const newPostForm = document.getElementById('newPostForm');
    const createPostForm = document.getElementById('createPostForm');
    const isGMPostCheckbox = document.getElementById('isGMPost');
    const postTitleInput = document.getElementById('postTitle');
    const postContentInput = document.getElementById('postContent');

    // New Elements for Creating Chapters and Beats
    const createChapterButton = document.getElementById('createChapterButton');
    const newChapterForm = document.getElementById('newChapterForm');
    const createChapterForm = document.getElementById('createChapterForm');
    const chapterTitleInput = document.getElementById('chapterTitle');
    const chapterDescriptionInput = document.getElementById('chapterDescription');

    const createBeatButton = document.getElementById('createBeatButton');
    const newBeatForm = document.getElementById('newBeatForm');
    const createBeatForm = document.getElementById('createBeatForm');
    const beatTitleInput = document.getElementById('beatTitle');
    const beatContentInput = document.getElementById('beatContent');

    // Function to get URL parameters
    function getUrlParameter(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    // Fetch the gameId from the URL
    const gameId = getUrlParameter('gameId');

    function fetchGames() {
        fetch('/api/games')
            .then(response => response.json())
            .then(games => {
                gameSelect.innerHTML = '<option value="">Valitse peli</option>';
                games.forEach(game => {
                    const option = document.createElement('option');
                    option.value = game.id;
                    option.textContent = game.name;
                    gameSelect.appendChild(option);
                });

                if (gameId) {
                    gameSelect.value = gameId;
                    fetchChapters(gameId);
                    gameSelect.disabled = false; // Enable game selection
                    createChapterButton.disabled = false;
                }
            })
            .catch(error => console.error('Error fetching games:', error));
    }

    function fetchChapters(gameId) {
        fetch(`/api/games/${gameId}/chapters`)
            .then(response => response.json())
            .then(chapters => {
                chapterSelect.innerHTML = '<option value="">Valitse Luku</option>';
                chapters.forEach(chapter => {
                    const option = document.createElement('option');
                    option.value = chapter.id;
                    option.textContent = chapter.title;
                    chapterSelect.appendChild(option);
                });
                chapterSelect.disabled = false;
            })
            .catch(error => console.error('Error fetching chapters:', error));
    }

    function fetchBeats(chapterId) {
        fetch(`/api/chapters/${chapterId}/beats`)
            .then(response => response.json())
            .then(beats => {
                beatSelect.innerHTML = '<option value="">Valitse Beatti</option>';
                beats.forEach(beat => {
                    const option = document.createElement('option');
                    option.value = beat.id;
                    option.textContent = beat.title;
                    beatSelect.appendChild(option);
                });
                beatSelect.disabled = false;
            })
            .catch(error => console.error('Error fetching beats:', error));
    }

    function fetchPosts(beatId) {
        fetch(`/api/beats/${beatId}/posts`)
            .then(response => response.json())
            .then(posts => {
                postsContainer.innerHTML = '';

                // Posts are ordered by created_at ascending
                posts.forEach(post => {
                    const postElement = document.createElement('div');
                    postElement.classList.add('post');

                    // Add class based on post type
                    if (post.post_type === 'gm') {
                        postElement.classList.add('gm-post');
                    } else {
                        postElement.classList.add('player-post');
                    }

                    postElement.innerHTML = `
                        <h3>${post.title}
                            <span class="post-type ${post.post_type}">
                                ${post.post_type.toUpperCase()}
                            </span>
                        </h3>
                        <p>${post.content}</p>
                        <small>Posted on ${new Date(post.created_at).toLocaleString()}</small>
                    `;
                    postsContainer.appendChild(postElement);
                });

                newPostForm.style.display = 'block';
            })
            .catch(error => console.error('Error fetching posts:', error));
    }

    function createPost(event) {
        event.preventDefault();
        const selectedGameId = gameSelect.value;
        const selectedChapterId = chapterSelect.value;
        const selectedBeatId = beatSelect.value;
        const title = postTitleInput.value;
        const content = postContentInput.value;
        const postType = isGMPostCheckbox.checked ? 'gm' : 'player';

        if (!selectedGameId || !selectedChapterId || !selectedBeatId) {
            alert('Valitse peli, luku ja beatti ennen viestin lähettämistä.');
            return;
        }

        fetch(`/api/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                gameId: selectedGameId,
                chapterId: selectedChapterId,
                beatId: selectedBeatId,
                title,
                content,
                postType
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(`Error creating post: ${data.error}`);
                } else {
                    alert('Viestisi on luotu onnistuneesti.');
                    fetchPosts(selectedBeatId);  // Refresh the posts
                    createPostForm.reset();
                }
            })
            .catch(error => console.error('Error creating post:', error));
    }

    function createChapter(event) {
        event.preventDefault();
        const selectedGameId = gameSelect.value;
        const title = chapterTitleInput.value;
        const description = chapterDescriptionInput.value;

        if (!selectedGameId) {
            alert('Peliä ei ole valittu.');
            return;
        }

        fetch(`/api/games/${selectedGameId}/chapters`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                description
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(`Error creating chapter: ${data.error}`);
                } else {
                    alert('Luku luotu onnistuneesti.');
                    fetchChapters(selectedGameId);  // Refresh the chapters
                    createChapterForm.reset();
                    newChapterForm.style.display = 'none';
                }
            })
            .catch(error => console.error('Error creating chapter:', error));
    }

    function createBeat(event) {
        event.preventDefault();
        const selectedChapterId = chapterSelect.value;
        const title = beatTitleInput.value;
        const content = beatContentInput.value;

        if (!selectedChapterId) {
            alert('Lukua ei ole valittu.');
            return;
        }

        fetch(`/api/chapters/${selectedChapterId}/beats`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title,
                content
            })
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(`Error creating beat: ${data.error}`);
                } else {
                    alert('Beatti luotu onnistuneesti.');
                    fetchBeats(selectedChapterId);  // Refresh the beats
                    createBeatForm.reset();
                    newBeatForm.style.display = 'none';
                }
            })
            .catch(error => console.error('Error creating beat:', error));
    }

    // Event Listeners

    gameSelect.addEventListener('change', (event) => {
        const selectedGameId = event.target.value;
        if (selectedGameId) {
            fetchChapters(selectedGameId);
            chapterSelect.disabled = false;
            createChapterButton.disabled = false;
        } else {
            chapterSelect.innerHTML = '<option value="">Valitse Luku</option>';
            chapterSelect.disabled = true;
            createChapterButton.disabled = true;

            beatSelect.innerHTML = '<option value="">Valitse Beatti</option>';
            beatSelect.disabled = true;
            createBeatButton.disabled = true;

            postsContainer.innerHTML = '';
            newPostForm.style.display = 'none';
        }
    });

    chapterSelect.addEventListener('change', (event) => {
        const selectedChapterId = event.target.value;
        if (selectedChapterId) {
            fetchBeats(selectedChapterId);
            beatSelect.disabled = false;
            createBeatButton.disabled = false;
        } else {
            beatSelect.innerHTML = '<option value="">Valitse Beatti</option>';
            beatSelect.disabled = true;
            createBeatButton.disabled = true;

            postsContainer.innerHTML = '';
            newPostForm.style.display = 'none';
        }
    });

    beatSelect.addEventListener('change', (event) => {
        const selectedBeatId = event.target.value;
        if (selectedBeatId) {
            fetchPosts(selectedBeatId);
        } else {
            postsContainer.innerHTML = '';
            newPostForm.style.display = 'none';
        }
    });

    createPostForm.addEventListener('submit', createPost);

    // Show/Hide Chapter Creation Form
    createChapterButton.addEventListener('click', () => {
        newChapterForm.style.display = newChapterForm.style.display === 'none' ? 'block' : 'none';
    });

    createChapterForm.addEventListener('submit', createChapter);

    // Show/Hide Beat Creation Form
    createBeatButton.addEventListener('click', () => {
        newBeatForm.style.display = newBeatForm.style.display === 'none' ? 'block' : 'none';
    });

    createBeatForm.addEventListener('submit', createBeat);

    // Initialize
    fetchGames();
});

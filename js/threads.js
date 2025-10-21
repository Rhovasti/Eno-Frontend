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
    
    // Check if elements exist
    if (!gameSelect) {
        console.error('gameSelect element not found!');
        return;
    }
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
                if (archiveChapterLabel) {
                    archiveChapterLabel.style.display = 'block';
                }
            } else {
                if (archiveChapterLabel) {
                    archiveChapterLabel.style.display = 'none';
                }
                if (archiveChapterOnPostCheckbox) {
                    archiveChapterOnPostCheckbox.checked = false;
                }
            }
        });
    }
    
    // Check URL parameters for game ID
    const urlParams = new URLSearchParams(window.location.search);
    const selectedGameId = urlParams.get('gameId');
    
    // Check for authentication (but allow anonymous users)
    const token = getCookie('token');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Check if user is anonymous (user already declared above at line 13)
    const isAnonymous = user.roles && JSON.parse(user.roles).includes('anonymous');
    
    // Fetch all games (with or without authentication)
    fetch('/api/games', {
        headers: headers,
        credentials: 'include'
    })
    .then(response => {
        if (!response.ok) {
            if (response.status === 401) {
                // Token is invalid or expired, redirect to login
                console.error('Authentication failed, redirecting to login');
                window.location.href = '/hml/login.html';
                return;
            }
            throw new Error('Failed to fetch games');
        }
        return response.json();
    })
    .then(games => {
        if (!games) return; // Guard against undefined response
        
        // Populate game select
        games.forEach(game => {
            const option = document.createElement('option');
            option.value = game.id;
            option.textContent = game.title || game.name;  // Support both title and name
            gameSelect.appendChild(option);
        });
        
        // If game ID in URL, select it
        if (selectedGameId) {
            gameSelect.value = selectedGameId;
            loadChapters(selectedGameId);
        }
    })
    .catch(error => {
        console.error('Error fetching games:', error);
        // Show user-friendly error message
        const errorOption = document.createElement('option');
        errorOption.textContent = 'Virhe pelien lataamisessa - kirjaudu uudelleen';
        gameSelect.appendChild(errorOption);
    });
    
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
        if (archiveChapterButton) {
            archiveChapterButton.disabled = !chapterId || !isGM || isArchived;
        }
        
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
            // Anonymous users can also post
            if (!isChapterArchived) {
                newPostForm.style.display = 'block';
                
                // Hide GM post option if user is not a GM
                isGMPostCheckbox.parentElement.style.display = isGM ? 'block' : 'none';
                
                // Hide archive chapter option by default
                if (archiveChapterLabel) {
                    archiveChapterLabel.style.display = 'none';
                }
                if (archiveChapterOnPostCheckbox) {
                    archiveChapterOnPostCheckbox.checked = false;
                }
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
                        'Authorization': token ? `Bearer ${token}` : undefined
                    },
                    credentials: 'include'
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
                    'Authorization': token ? `Bearer ${token}` : undefined
                },
                credentials: 'include',
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
                    'Authorization': token ? `Bearer ${token}` : undefined
                },
                credentials: 'include',
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
    
    // Dice roll functionality
    const rollDiceBtn = document.getElementById('rollDiceBtn');
    const diceNotationInput = document.getElementById('diceNotation');
    const rollPurposeInput = document.getElementById('rollPurpose');
    const diceResultDiv = document.getElementById('diceResult');
    let currentDiceRoll = null;
    
    if (rollDiceBtn) {
        rollDiceBtn.addEventListener('click', function() {
            const notation = diceNotationInput.value.trim();
            if (!notation) {
                alert('Anna noppanotaatio (esim. 2d6+3)');
                return;
            }
            
            try {
                const rollResult = DiceEngine.roll(notation);
                currentDiceRoll = {
                    ...rollResult,
                    purpose: rollPurposeInput.value.trim()
                };
                
                // Display result
                diceResultDiv.innerHTML = DiceEngine.formatRollResult(rollResult);
                if (rollPurposeInput.value) {
                    diceResultDiv.innerHTML = `<strong>${rollPurposeInput.value}:</strong><br>` + diceResultDiv.innerHTML;
                }
                diceResultDiv.style.display = 'block';
                
                // Add visual feedback based on roll
                if (rollResult.total >= 15) {
                    diceResultDiv.className = 'dice-result success';
                } else if (rollResult.total <= 5) {
                    diceResultDiv.className = 'dice-result failure';
                } else {
                    diceResultDiv.className = 'dice-result';
                }
            } catch (error) {
                alert('Virhe nopanheitossa: ' + error.message);
            }
        });
    }
    
    // Auto Media Generation System - DEFINE FUNCTIONS FIRST
    const autoGenerateImageCheckbox = document.getElementById('autoGenerateImageCheckbox');
    const autoGenerateAudioCheckbox = document.getElementById('autoGenerateAudioCheckbox');
    const moodSelectorContainer = document.getElementById('moodSelectorContainer');
    const moodSelector = document.getElementById('moodSelector');

    // Character selection elements
    const characterReferenceSection = document.getElementById('characterReferenceSection');
    const characterSelect = document.getElementById('characterSelect');
    const characterDetectionStatus = document.getElementById('characterDetectionStatus');

    // Show/hide mood selector and character reference based on checkbox state
    function updateMediaGenerationVisibility() {
        if (autoGenerateImageCheckbox && autoGenerateAudioCheckbox && moodSelectorContainer) {
            const showMoodSelector = autoGenerateImageCheckbox.checked || autoGenerateAudioCheckbox.checked;
            moodSelectorContainer.style.display = showMoodSelector ? 'block' : 'none';
        }

        // Show character reference if image generation is selected
        if (autoGenerateImageCheckbox && characterReferenceSection) {
            const showCharacterReference = autoGenerateImageCheckbox.checked;
            characterReferenceSection.style.display = showCharacterReference ? 'block' : 'none';
        }
    }

    if (autoGenerateImageCheckbox) {
        autoGenerateImageCheckbox.addEventListener('change', updateMediaGenerationVisibility);
    }

    if (autoGenerateAudioCheckbox) {
        autoGenerateAudioCheckbox.addEventListener('change', updateMediaGenerationVisibility);
    }

    // Load available characters when page loads
    loadAvailableCharacters();

    // Function to load available characters from server
    async function loadAvailableCharacters() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/characters/portraits', {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : undefined
                },
                credentials: 'include'
            });

            if (!response.ok) {
                console.error('Failed to load characters');
                return;
            }

            const data = await response.json();

            // Extract characters array from response
            const characters = data.characters || [];

            // Populate character select dropdown
            if (characterSelect) {
                // Clear existing options except the placeholder
                characterSelect.innerHTML = '<option value="">Ei hahmoa</option>';

                characters.forEach(character => {
                    const option = document.createElement('option');
                    option.value = character.id;
                    option.textContent = character.name;
                    option.dataset.characterName = character.id;
                    characterSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading characters:', error);
        }
    }

    // Function to derive prompts from post content
    async function deriveMediaPrompts(postContent, mood) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/posts/derive-prompts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : undefined
                },
                credentials: 'include',
                body: JSON.stringify({
                    postContent: postContent,
                    mood: mood || 'mysterious',
                    language: 'fi'
                })
            });

            if (!response.ok) {
                throw new Error('Failed to derive prompts');
            }

            const result = await response.json();

            // Handle character detection and auto-suggestion
            if (result.detectedCharacters && result.detectedCharacters.length > 0 && characterDetectionStatus) {
                // Show detected characters
                characterDetectionStatus.innerHTML = `
                    <span style="color: #4caf50;">✖</span> Hahmot havaittu: ${result.detectedCharacters.map(char => char.displayName).join(', ')}
                `;

                // Auto-select first detected character if available
                if (result.detectedCharacters.length > 0 && characterSelect) {
                    const firstCharacter = result.detectedCharacters[0];
                    characterSelect.value = firstCharacter.name;
                }
            } else if (characterDetectionStatus) {
                // Show no characters detected
                characterDetectionStatus.innerHTML = `
                    <span style="color: #999;">⚪</span> Ei hahmoja havaittu
                `;
            }

            return result;
        } catch (error) {
            console.error('Error deriving prompts:', error);
            throw error;
        }
    }

    // Function to auto-generate media after post creation
    // Parameters are passed directly to avoid reading from reset form
    async function autoGenerateMedia(postId, postContent, shouldGenerateImage, shouldGenerateAudio, mood) {
        console.log('=== autoGenerateMedia called ===');
        console.log('Post ID:', postId);
        console.log('Post Content:', postContent);
        console.log('Should generate image:', shouldGenerateImage);
        console.log('Should generate audio:', shouldGenerateAudio);
        console.log('Mood:', mood);

        if (!shouldGenerateImage && !shouldGenerateAudio) {
            console.log('No media generation requested - returning early');
            return; // Nothing to generate
        }

        try {
            console.log('Auto-generating media for post:', postId);
            console.log('Mood:', mood, 'Image:', shouldGenerateImage, 'Audio:', shouldGenerateAudio);

            // Derive prompts from content
            const derivedPrompts = await deriveMediaPrompts(postContent, mood);
            console.log('Derived prompts:', derivedPrompts);

            // Get selected character before showing status
            const selectedCharacter = characterSelect ? characterSelect.value : null;

            // Show status
            const statusDiv = document.createElement('div');
            statusDiv.id = 'autoGenerationStatus';
            statusDiv.style.cssText = 'background: #e3f2fd; border: 2px solid #2196f3; border-radius: 8px; padding: 15px; margin: 15px 0;';

            // Build status content with character enhancement indicator
            let characterInfo = selectedCharacter ? `<p style="margin: 5px 0;"><strong>Hahmo:</strong> ${selectedCharacter}</p>` : '';
            if (derivedPrompts.characterEnhanced) {
                characterInfo += `<p style="margin: 5px 0; color: #4caf50;">✨ Hahmon yhdenmukaisuus aktivoitu</p>`;
            }

            statusDiv.innerHTML = `
                <h4 style="margin: 0 0 10px 0;">🤖 AI-median automaattinen luonti</h4>
                <p style="margin: 5px 0;"><strong>Tunnelma:</strong> ${mood}</p>
                ${characterInfo}
                <p style="margin: 5px 0;"><strong>Kuvaprompti:</strong> ${derivedPrompts.imagePrompt}</p>
                <p style="margin: 5px 0;"><strong>Ääniprompti:</strong> ${derivedPrompts.audioPrompt}</p>
                <p style="margin: 10px 0 5px 0; font-style: italic; color: #666;">Luodaan mediaa...</p>
            `;

            const form = document.getElementById('createPostForm');
            if (form) {
                form.parentNode.insertBefore(statusDiv, form.nextSibling);
            }

            // Generate image if requested
            if (shouldGenerateImage) {
                try {
                    statusDiv.innerHTML += '<p style="color: #2196f3;">⏳ Luodaan kuvaa...</p>';

                    const token = localStorage.getItem('token');

                    // Prepare image generation request with character reference
                    const imageRequestData = {
                        prompt: derivedPrompts.imagePrompt,
                        style: derivedPrompts.stylePreset
                    };

                    // Add character reference if selected
                    if (selectedCharacter) {
                        imageRequestData.character = selectedCharacter;
                    }

                    const imageResponse = await fetch(`/api/posts/${postId}/generate-image`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token ? `Bearer ${token}` : undefined
                        },
                        credentials: 'include',
                        body: JSON.stringify(imageRequestData)
                    });

                    if (imageResponse.ok) {
                        const imageData = await imageResponse.json();
                        statusDiv.innerHTML += `<p style="color: #4caf50;">✓ Kuva luotu onnistuneesti!</p>`;
                        console.log('Image generated:', imageData);
                    } else {
                        throw new Error('Image generation failed');
                    }
                } catch (error) {
                    console.error('Error generating image:', error);
                    statusDiv.innerHTML += `<p style="color: #f44336;">✗ Kuvan luonti epäonnistui: ${error.message}</p>`;
                }
            }

            // Generate audio if requested
            if (shouldGenerateAudio) {
                try {
                    statusDiv.innerHTML += '<p style="color: #2196f3;">⏳ Luodaan ääntä...</p>';

                    const token = localStorage.getItem('token');
                    const audioResponse = await fetch(`/api/posts/${postId}/generate-audio`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token ? `Bearer ${token}` : undefined
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            prompt: derivedPrompts.audioPrompt,
                            audioType: derivedPrompts.audioType,
                            audioStyle: derivedPrompts.audioStyle,
                            duration: 30
                        })
                    });

                    if (audioResponse.ok) {
                        const audioData = await audioResponse.json();
                        statusDiv.innerHTML += `<p style="color: #4caf50;">✓ Ääni luotu onnistuneesti!</p>`;
                        console.log('Audio generated:', audioData);
                    } else {
                        throw new Error('Audio generation failed');
                    }
                } catch (error) {
                    console.error('Error generating audio:', error);
                    statusDiv.innerHTML += `<p style="color: #f44336;">✗ Äänen luonti epäonnistui: ${error.message}</p>`;
                }
            }

            // Reload posts to show the generated media
            const beatId = beatSelect.value;
            if (beatId) {
                setTimeout(() => loadPosts(beatId), 2000);
            }

            // Note: Form was already reset before this function ran, so checkboxes are already unchecked

        } catch (error) {
            console.error('Error in auto-generate media:', error);
            alert(`Median automaattinen luonti epäonnistui: ${error.message}`);
        }
    }

    // Create new post on existing beat
    if (createPostForm) {
        createPostForm.addEventListener('submit', function(event) {
            event.preventDefault();

            const beatId = beatSelect.value;
            const title = document.getElementById('postTitle').value;
            const content = document.getElementById('postContent').value;
            const postType = isGMPostCheckbox && isGMPostCheckbox.checked ? 'gm' : 'player';
            const archiveChapter = archiveChapterOnPostCheckbox && archiveChapterOnPostCheckbox.checked;
            
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
            
            // Prepare post data with optional dice roll
            const postData = { 
                beatId,
                title, 
                content,
                postType,
                archiveChapter
            };
            if (currentDiceRoll) {
                postData.diceRoll = currentDiceRoll;
            }
            
            fetch(`/api/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : undefined
                },
                credentials: 'include',
                body: JSON.stringify(postData)
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

                // IMPORTANT: Capture checkbox state BEFORE resetting form!
                const shouldGenerateImage = autoGenerateImageCheckbox && autoGenerateImageCheckbox.checked;
                const shouldGenerateAudio = autoGenerateAudioCheckbox && autoGenerateAudioCheckbox.checked;
                const selectedMood = moodSelector ? moodSelector.value : 'mysterious';

                console.log('Captured state before form reset - Image:', shouldGenerateImage, 'Audio:', shouldGenerateAudio, 'Mood:', selectedMood);

                // Reload beats to get the new post
                const currentChapterId = chapterSelect.value;
                if (currentChapterId) {
                    loadBeats(currentChapterId);
                    // Wait a bit then reload posts for the current beat
                    setTimeout(() => loadPosts(beatId), 500);
                }
                createPostForm.reset();
                // Reset dice roll
                currentDiceRoll = null;
                diceResultDiv.style.display = 'none';
                diceResultDiv.innerHTML = '';
                // Reset button state
                submitButton.disabled = false;
                submitButton.textContent = originalButtonText;

                // Store the new post ID for image and audio generation
                window.lastCreatedPostId = data.id;

                // Auto-generate media if requested (this will happen in background)
                // Pass captured checkbox state to function
                console.log('Post created, calling autoGenerateMedia with ID:', data.id, 'Content:', content);
                autoGenerateMedia(data.id, content, shouldGenerateImage, shouldGenerateAudio, selectedMood).catch(error => {
                    console.error('Auto-generation error:', error);
                    // Don't block the UI, just log the error
                });
                
                // If chapter was archived, reload chapters to update the list
                if (data.chapterArchived) {
                    alert('Luku arkistoitu onnistuneesti!');
                    loadChapters(gameSelect.value);
                }
                
                // Trigger AI GM response if this was a player post and game has AI GM
                if (postType === 'player') {
                    triggerAIGMResponseIfApplicable(beatId, gameSelect.value);
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

    // GM Assistance System
    const gmAssistanceSection = document.getElementById('gmAssistanceSection');
    const getSuggestionBtn = document.getElementById('getSuggestionBtn');
    const suggestionType = document.getElementById('suggestionType');
    const suggestionResults = document.getElementById('suggestionResults');
    const suggestionContent = document.getElementById('suggestionContent');
    const useSuggestionBtn = document.getElementById('useSuggestionBtn');
    const newSuggestionBtn = document.getElementById('newSuggestionBtn');

    let currentSuggestion = null;
    let currentSuggestions = [];
    
    if (isGMPostCheckbox && gmAssistanceSection) {
        isGMPostCheckbox.addEventListener('change', function() {
            gmAssistanceSection.style.display = this.checked ? 'block' : 'none';
        });
    }
    
    if (getSuggestionBtn) {
        getSuggestionBtn.addEventListener('click', async function() {
            const type = suggestionType.value;
            if (!type) {
                alert('Valitse ehdotustyyppi');
                return;
            }
            
            const gameId = gameSelect.value;
            const chapterId = chapterSelect.value;
            const beatId = beatSelect.value;
            
            if (!gameId || !chapterId || !beatId) {
                alert('Valitse peli, luku ja beatti ensin');
                return;
            }
            
            await generateGMSuggestions(type, gameId, chapterId, beatId);
        });
    }
    
    if (useSuggestionBtn) {
        useSuggestionBtn.addEventListener('click', function() {
            if (currentSuggestion) {
                const postContentField = document.getElementById('postContent');
                const postTitleField = document.getElementById('postTitle');
                
                if (currentSuggestion.title) {
                    postTitleField.value = currentSuggestion.title;
                }
                
                postContentField.value = currentSuggestion.content;
                suggestionResults.style.display = 'none';
            }
        });
    }
    
    if (newSuggestionBtn) {
        newSuggestionBtn.addEventListener('click', function() {
            if (suggestionType.value) {
                getSuggestionBtn.click();
            }
        });
    }
    
    async function generateGMSuggestions(type, gameId, chapterId, beatId) {
        try {
            getSuggestionBtn.disabled = true;
            getSuggestionBtn.textContent = '⏳ Generoidaan...';
            
            suggestionResults.style.display = 'block';
            suggestionContent.innerHTML = '<div class="suggestion-loading">🤖 AI luo ehdotuksia...</div>';
            
            const response = await fetch('/api/gm-suggestions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : undefined
                },
                credentials: 'include',
                body: JSON.stringify({
                    suggestion_type: type,
                    game_id: gameId,
                    chapter_id: chapterId,
                    beat_id: beatId
                })
            });
            
            if (!response.ok) {
                throw new Error('Virhe ehdotusten generoinnissa');
            }
            
            const data = await response.json();
            displaySuggestions(data.suggestions);
            
        } catch (error) {
            console.error('Error generating suggestions:', error);
            suggestionContent.innerHTML = `<div class="suggestion-error">Virhe: ${error.message}</div>`;
        } finally {
            getSuggestionBtn.disabled = false;
            getSuggestionBtn.textContent = '💡 Pyydä ehdotus';
        }
    }
    
    function displaySuggestions(suggestions) {
        if (!suggestions || suggestions.length === 0) {
            suggestionContent.innerHTML = '<div class="suggestion-error">Ei ehdotuksia saatavilla</div>';
            return;
        }
        
        currentSuggestions = suggestions;
        
        const suggestionsHtml = suggestions.map((suggestion, index) => `
            <div class="suggestion-item" data-index="${index}" onclick="selectSuggestion(${index})">
                <strong>${suggestion.title || 'Ehdotus ' + (index + 1)}</strong>
                <div>${suggestion.content}</div>
            </div>
        `).join('');
        
        suggestionContent.innerHTML = suggestionsHtml;
        
        // Auto-select first suggestion
        if (suggestions.length > 0) {
            selectSuggestion(0);
        }
    }
    
    function selectSuggestion(index) {
        // Clear previous selection
        document.querySelectorAll('.suggestion-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Select new item
        const selectedItem = document.querySelector(`[data-index="${index}"]`);
        if (selectedItem) {
            selectedItem.classList.add('selected');
            currentSuggestion = currentSuggestions[index];
        }
    }
    
    // Make selectSuggestion globally accessible
    window.selectSuggestion = selectSuggestion;

    // Functions to load data
    function loadChapters(gameId) {
        fetch(`/api/games/${gameId}/chapters?includeArchived=true`, {
            headers: {
                'Authorization': token ? `Bearer ${token}` : undefined
            },
            credentials: 'include'
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
    
    // Store beats data globally for the current chapter
    let currentBeatsData = {};
    
    function loadBeats(chapterId) {
        fetch(`/api/chapters/${chapterId}/beats`, {
            headers: {
                'Authorization': token ? `Bearer ${token}` : undefined
            },
            credentials: 'include'
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to fetch beats');
            }
            return response.json();
        })
        .then(beats => {
            // Store beats data for later use
            currentBeatsData = {};
            beats.forEach(beat => {
                currentBeatsData[beat.id] = beat;
            });
            
            // Clear and populate beat select
            beatSelect.innerHTML = '<option value="">Valitse Beatti</option>';
            
            beats.sort((a, b) => a.sequence_number - b.sequence_number).forEach(beat => {
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
        // Get posts from stored beats data
        const beat = currentBeatsData[beatId];
        if (!beat) {
            console.error('Beat not found in cached data');
            return;
        }
        
        const posts = beat.posts || [];
        
        // Clear and populate posts container
        postsContainer.innerHTML = '';
        
        if (posts.length === 0) {
            const message = document.createElement('p');
            message.textContent = 'Ei viestejä. Ole ensimmäinen joka kirjoittaa!';
            postsContainer.appendChild(message);
        } else {
            posts.forEach(post => {
                const postElement = document.createElement('div');
                postElement.className = `post ${post.post_type || 'player'}-post`;
                
                const postHeader = document.createElement('div');
                postHeader.className = 'post-header';
                
                const postTitle = document.createElement('h3');
                postTitle.textContent = post.title || 'Ei otsikkoa';
                
                const postAuthor = document.createElement('span');
                postAuthor.className = 'post-author';
                postAuthor.textContent = post.username || 'Tuntematon';
                
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
                
                // Add dice roll display if present
                if (post.diceRoll) {
                    const diceRollDiv = document.createElement('div');
                    diceRollDiv.className = 'post-dice-roll';
                    
                    const rollHeader = document.createElement('div');
                    rollHeader.innerHTML = `<strong>🎲 Nopanheitto${post.diceRoll.purpose ? ': ' + post.diceRoll.purpose : ''}</strong>`;
                    
                    const rollDetails = document.createElement('div');
                    rollDetails.innerHTML = `
                        <span class="dice-notation">${post.diceRoll.notation}</span> = 
                        [${post.diceRoll.results.join(', ')}]${post.diceRoll.modifiers !== 0 ? (post.diceRoll.modifiers > 0 ? '+' : '') + post.diceRoll.modifiers : ''} = 
                        <span class="dice-total">${post.diceRoll.total}</span>
                    `;
                    
                    diceRollDiv.appendChild(rollHeader);
                    diceRollDiv.appendChild(rollDetails);
                    postElement.appendChild(diceRollDiv);
                }
                
                postElement.appendChild(postContent);
                
                // Add post ID as data attribute for image loading
                postElement.dataset.postId = post.id;
                
                postsContainer.appendChild(postElement);
            });
            
            // Load images and audio for all posts
            loadPostImages();
            loadPostAudio();
        }
    }

    // Load images for displayed posts
    async function loadPostImages() {
        const postElements = document.querySelectorAll('.post[data-post-id]');
        
        for (const postElement of postElements) {
            const postId = postElement.dataset.postId;
            
            try {
                const response = await fetch(`/api/posts/${postId}/images`, {
                    headers: {
                        'Authorization': token ? `Bearer ${token}` : undefined
                    },
                    credentials: 'include'
                });
                
                if (response.ok) {
                    const images = await response.json();
                    
                    if (images.length > 0) {
                        const imagesContainer = document.createElement('div');
                        imagesContainer.className = 'post-images';
                        
                        images.forEach(image => {
                            const imageContainer = document.createElement('div');
                            imageContainer.className = 'post-image-container';
                            imageContainer.innerHTML = `
                                <img src="${image.thumbnail_url || image.image_url}" 
                                     alt="${image.prompt}" 
                                     onclick="window.open('${image.image_url}', '_blank')"
                                     title="Click to view full size">
                                <p class="post-image-prompt">${image.prompt}</p>
                            `;
                            imagesContainer.appendChild(imageContainer);
                        });
                        
                        postElement.appendChild(imagesContainer);
                    }
                }
            } catch (error) {
                console.error(`Error loading images for post ${postId}:`, error);
            }
        }
    }

    // Load audio for displayed posts
    async function loadPostAudio() {
        const postElements = document.querySelectorAll('.post[data-post-id]');

        for (const postElement of postElements) {
            const postId = postElement.dataset.postId;

            try {
                const response = await fetch(`/api/posts/${postId}/audio`, {
                    headers: {
                        'Authorization': token ? `Bearer ${token}` : undefined
                    },
                    credentials: 'include'
                });

                if (response.ok) {
                    const audioData = await response.json();

                    if (audioData.length > 0) {
                        const audioContainer = document.createElement('div');
                        audioContainer.className = 'post-audio-section';

                        audioData.forEach(audio => {
                            // Create audio player using AudioPlayer class
                            const player = new AudioPlayer(audio.audio_url, {
                                prompt: audio.prompt,
                                audioType: audio.audio_type,
                                duration: audio.duration,
                                showDownload: true
                            });

                            const playerElement = player.create();
                            audioContainer.appendChild(playerElement);
                        });

                        postElement.appendChild(audioContainer);
                    }
                }
            } catch (error) {
                console.error(`Error loading audio for post ${postId}:`, error);
            }
        }
    }

    // Helper function to get cookie value with localStorage fallback
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        
        // Fallback to localStorage if cookie not found
        if (name === 'token') {
            return localStorage.getItem('auth_token');
        }
        return null;
    }
    
    // Doodle Canvas Functionality
    const doodleCanvas = document.getElementById('doodleCanvas');
    const clearCanvasBtn = document.getElementById('clearCanvasBtn');
    const undoCanvasBtn = document.getElementById('undoCanvasBtn');
    const brushColor = document.getElementById('brushColor');
    const brushSize = document.getElementById('brushSize');
    const brushSizeDisplay = document.getElementById('brushSizeDisplay');
    
    let isDrawing = false;
    let drawingHistory = [];
    let currentPath = [];
    
    if (doodleCanvas) {
        const ctx = doodleCanvas.getContext('2d', { willReadFrequently: true });
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Initialize canvas with white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, doodleCanvas.width, doodleCanvas.height);
        
        // Save initial state
        drawingHistory.push(ctx.getImageData(0, 0, doodleCanvas.width, doodleCanvas.height));
        
        // Drawing functions
        function startDrawing(e) {
            isDrawing = true;
            currentPath = [];
            const pos = getMousePos(e);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
        }
        
        function draw(e) {
            if (!isDrawing) return;
            
            const pos = getMousePos(e);
            ctx.strokeStyle = brushColor.value;
            ctx.lineWidth = brushSize.value;
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            
            currentPath.push({x: pos.x, y: pos.y});
        }
        
        function stopDrawing() {
            if (!isDrawing) return;
            isDrawing = false;
            
            // Save state for undo
            if (currentPath.length > 0) {
                drawingHistory.push(ctx.getImageData(0, 0, doodleCanvas.width, doodleCanvas.height));
                // Keep only last 50 states
                if (drawingHistory.length > 50) {
                    drawingHistory.shift();
                }
            }
        }
        
        function getMousePos(e) {
            const rect = doodleCanvas.getBoundingClientRect();
            const scaleX = doodleCanvas.width / rect.width;
            const scaleY = doodleCanvas.height / rect.height;
            
            let clientX, clientY;
            if (e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            
            return {
                x: (clientX - rect.left) * scaleX,
                y: (clientY - rect.top) * scaleY
            };
        }
        
        // Mouse events
        doodleCanvas.addEventListener('mousedown', startDrawing);
        doodleCanvas.addEventListener('mousemove', draw);
        doodleCanvas.addEventListener('mouseup', stopDrawing);
        doodleCanvas.addEventListener('mouseout', stopDrawing);
        
        // Touch events for mobile
        doodleCanvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startDrawing(e);
        });
        doodleCanvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            draw(e);
        });
        doodleCanvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopDrawing();
        });
        
        // Clear canvas
        clearCanvasBtn.addEventListener('click', () => {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, doodleCanvas.width, doodleCanvas.height);
            drawingHistory = [ctx.getImageData(0, 0, doodleCanvas.width, doodleCanvas.height)];
        });
        
        // Undo
        undoCanvasBtn.addEventListener('click', () => {
            if (drawingHistory.length > 1) {
                drawingHistory.pop(); // Remove current state
                const previousState = drawingHistory[drawingHistory.length - 1];
                ctx.putImageData(previousState, 0, 0);
            }
        });
        
        // Brush size display
        brushSize.addEventListener('input', () => {
            brushSizeDisplay.textContent = brushSize.value + 'px';
        });
    }
    
    // Image Generation Functionality
    const generateImageBtn = document.getElementById('generateImageBtn');
    const imagePrompt = document.getElementById('imagePrompt');
    const styleSelect = document.getElementById('styleSelect');
    const imageGenerationStatus = document.getElementById('imageGenerationStatus');
    const generatedImagePreview = document.getElementById('generatedImagePreview');
    
    if (generateImageBtn) {
        generateImageBtn.addEventListener('click', async function() {
            const prompt = imagePrompt.value.trim();
            
            if (!prompt) {
                alert('Anna kuvaus kuvalle');
                return;
            }
            
            if (!window.lastCreatedPostId) {
                alert('Luo ensin viesti johon kuva liitetään');
                return;
            }
            
            // Get doodle data if available
            let sketchData = null;
            if (doodleCanvas) {
                // Check if canvas has any drawing (not just white)
                const ctx = doodleCanvas.getContext('2d');
                const imageData = ctx.getImageData(0, 0, doodleCanvas.width, doodleCanvas.height);
                const pixels = imageData.data;
                let hasDrawing = false;
                
                for (let i = 0; i < pixels.length; i += 4) {
                    // Check if any pixel is not white
                    if (pixels[i] !== 255 || pixels[i + 1] !== 255 || pixels[i + 2] !== 255) {
                        hasDrawing = true;
                        break;
                    }
                }
                
                if (hasDrawing) {
                    // Convert canvas to base64
                    sketchData = doodleCanvas.toDataURL('image/png').split(',')[1];
                }
            }
            
            // Get selected style
            const selectedStyle = styleSelect.value || 'cartoon';
            
            // Disable button and show loading
            generateImageBtn.disabled = true;
            generateImageBtn.textContent = '⏳ Luodaan kuvaa...';
            imageGenerationStatus.style.display = 'block';
            imageGenerationStatus.className = 'loading';
            imageGenerationStatus.textContent = 'Luodaan kuvaa... Tämä voi kestää 10-15 sekuntia.';
            
            try {
                const response = await fetch(`/api/posts/${window.lastCreatedPostId}/generate-image`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : undefined
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        prompt: prompt,
                        style: selectedStyle,
                        sketch: sketchData
                    })
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.error || 'Kuvan luonti epäonnistui');
                }
                
                // Show success
                imageGenerationStatus.className = 'success';
                imageGenerationStatus.textContent = 'Kuva luotu onnistuneesti!';
                
                // Display preview
                generatedImagePreview.style.display = 'block';
                generatedImagePreview.innerHTML = `
                    <img src="${data.thumbnailUrl || data.imageUrl}" alt="${prompt}" 
                         onclick="window.open('${data.imageUrl}', '_blank')">
                    <p class="post-image-prompt">${prompt}</p>
                `;
                
                // Reset form
                imagePrompt.value = '';
                styleSelect.value = '';
                
                // Clear doodle canvas
                if (doodleCanvas) {
                    const ctx = doodleCanvas.getContext('2d');
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, doodleCanvas.width, doodleCanvas.height);
                    drawingHistory = [ctx.getImageData(0, 0, doodleCanvas.width, doodleCanvas.height)];
                }
                
                // Hide image generation section after successful generation
                const imageSection = document.getElementById('imageGenerationSection');
                if (imageSection) {
                    setTimeout(() => {
                        imageSection.style.display = 'none';
                    }, 2000); // Hide after 2 seconds
                }
                
                // Immediately reload beats to get fresh data with the post and image
                const currentChapterId = chapterSelect.value;
                if (currentChapterId) {
                    loadBeats(currentChapterId);
                    // Wait a bit then reload posts for the current beat to show the updated post with image
                    setTimeout(() => {
                        const currentBeatId = beatSelect.value;
                        if (currentBeatId) {
                            loadPosts(currentBeatId);
                        }
                    }, 500);
                }
                
            } catch (error) {
                console.error('Image generation error:', error);
                imageGenerationStatus.className = 'error';
                imageGenerationStatus.textContent = `Virhe: ${error.message}`;
            } finally {
                // Re-enable button
                generateImageBtn.disabled = false;
                generateImageBtn.textContent = '🎨 Luo kuva';
            }
        });
    }
    
    // Audio Generation System
    const generateAudioBtn = document.getElementById('generateAudioBtn');
    const audioPrompt = document.getElementById('audioPrompt');
    const audioTypeSelect = document.getElementById('audioTypeSelect');
    const audioStyleSelect = document.getElementById('audioStyleSelect');
    const audioDurationSelect = document.getElementById('audioDurationSelect');
    const audioGenerationStatus = document.getElementById('audioGenerationStatus');
    const generatedAudioPreview = document.getElementById('generatedAudioPreview');
    
    if (generateAudioBtn) {
        generateAudioBtn.addEventListener('click', async function() {
            const prompt = audioPrompt.value.trim();
            if (!prompt) {
                alert('Anna äänikuvaus');
                return;
            }
            
            if (!window.lastCreatedPostId) {
                alert('Luo ensin viesti');
                return;
            }
            
            const audioType = audioTypeSelect.value;
            const style = audioStyleSelect.value;
            const duration = parseInt(audioDurationSelect.value);
            
            try {
                // Show loading state
                generateAudioBtn.disabled = true;
                generateAudioBtn.textContent = '⏳ Generoidaan...';
                
                audioGenerationStatus.style.display = 'block';
                audioGenerationStatus.className = 'loading';
                audioGenerationStatus.textContent = '🎵 AI luo ääntä, tämä voi kestää hetken...';
                
                const response = await fetch(`/api/posts/${window.lastCreatedPostId}/generate-audio`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : undefined
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        prompt: prompt,
                        audioType: audioType,
                        style: style,
                        duration: duration
                    })
                });
                
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Virhe äänen generoinnissa');
                }
                
                const data = await response.json();
                
                audioGenerationStatus.className = 'success';
                audioGenerationStatus.textContent = 'Ääni luotu onnistuneesti!';
                
                // Display preview
                generatedAudioPreview.style.display = 'block';
                generatedAudioPreview.innerHTML = `
                    <h4>Luotu ääni</h4>
                    <audio controls class="audio-player">
                        <source src="${data.audioUrl}" type="audio/mpeg">
                        Selain ei tue äänen toistoa.
                    </audio>
                    <div class="audio-info">
                        <p><strong>Kuvaus:</strong> ${prompt}</p>
                        <p><strong>Tyyppi:</strong> ${data.audioType || 'Ei määritelty'}</p>
                        <p><strong>Kesto:</strong> ${data.duration || 30} sekuntia</p>
                    </div>
                `;
                
                // Reset form
                audioPrompt.value = '';
                audioTypeSelect.value = '';
                audioStyleSelect.value = '';
                audioDurationSelect.value = '30';
                
                // Hide audio generation section after successful generation
                const audioSection = document.getElementById('audioGenerationSection');
                if (audioSection) {
                    setTimeout(() => {
                        audioSection.style.display = 'none';
                    }, 3000); // Hide after 3 seconds
                }
                
                // Reload beats to get fresh data
                const currentChapterId = chapterSelect.value;
                if (currentChapterId) {
                    loadBeats(currentChapterId);
                    // Wait a bit then reload posts for the current beat
                    setTimeout(() => {
                        const currentBeatId = beatSelect.value;
                        if (currentBeatId) {
                            loadPosts(currentBeatId);
                        }
                    }, 500);
                }
                
            } catch (error) {
                console.error('Audio generation error:', error);
                audioGenerationStatus.className = 'error';
                audioGenerationStatus.textContent = `Virhe: ${error.message}`;
            } finally {
                // Re-enable button
                generateAudioBtn.disabled = false;
                generateAudioBtn.textContent = '🎵 Luo ääni';
            }
        });
    }
    
    // AI GM Response System
    async function triggerAIGMResponseIfApplicable(beatId, gameId) {
        if (!beatId || !gameId) {
            console.log('Missing beatId or gameId for AI GM response');
            return;
        }
        
        try {
            // Get game info to check if it has an AI GM
            const gameResponse = await fetch(`/api/games/${gameId}`, {
                headers: {
                    'Authorization': token ? `Bearer ${token}` : undefined
                },
                credentials: 'include'
            });
            
            if (!gameResponse.ok) {
                console.log('Could not fetch game info for AI GM check');
                return;
            }
            
            const game = await gameResponse.json();
            
            // Check if this game has an AI GM assigned
            if (!game.ai_gm_profile_id) {
                console.log('Game does not have AI GM assigned');
                return;
            }
            
            console.log(`Triggering AI GM response for game ${gameId} with AI GM profile ${game.ai_gm_profile_id}`);
            
            // Wait a moment to simulate thinking time, then trigger AI GM response
            setTimeout(async () => {
                try {
                    const response = await fetch('/api/ai-gm/generate-response', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': token ? `Bearer ${token}` : undefined
                        },
                        credentials: 'include',
                        body: JSON.stringify({
                            game_id: gameId,
                            beat_id: beatId,
                            ai_gm_profile_id: game.ai_gm_profile_id,
                            context_type: 'player_action'
                        })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        console.log(`AI GM ${result.gm_name} responded to player action:`, result.response);
                        
                        // Reload posts to show the AI GM response
                        setTimeout(() => {
                            loadPosts(beatId);
                        }, 1000);
                        
                        // Show notification to user
                        showAIGMNotification(result.gm_name);
                        
                    } else {
                        console.error('AI GM response failed:', response.status);
                    }
                } catch (error) {
                    console.error('Error triggering AI GM response:', error);
                }
            }, 2000 + Math.random() * 3000); // Random delay between 2-5 seconds
            
        } catch (error) {
            console.error('Error checking for AI GM:', error);
        }
    }
    
    // Show notification that AI GM has responded
    function showAIGMNotification(gmName) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'ai-gm-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <strong>${gmName}</strong> vastasi viestiin!
                <button onclick="this.parentElement.parentElement.remove()" class="close-notification">×</button>
            </div>
        `;
        
        // Add styles if not already added
        if (!document.getElementById('ai-gm-notification-styles')) {
            const style = document.createElement('style');
            style.id = 'ai-gm-notification-styles';
            style.textContent = `
                .ai-gm-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: #27ae60;
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 1000;
                    animation: slideIn 0.3s ease-out;
                }
                
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .close-notification {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    margin-left: auto;
                }
                
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Add to page
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
});
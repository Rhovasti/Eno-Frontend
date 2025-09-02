// Storyboard page functionality - Enhanced with timeline view and export
let currentUser = null;
let currentGame = null;
let storyboardData = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    initializeStoryboard();
});

async function initializeStoryboard() {
    try {
        // Check authentication
        currentUser = await getCurrentUser();
        if (!currentUser) {
            window.location.href = '/hml/login.html';
            return;
        }

        // Load available games
        await loadAvailableGames();
        
        // Set up event listeners
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing storyboard:', error);
        showError('Virhe ladattaessa storyboard-sivua');
    }
}

function setupEventListeners() {
    const gameSelect = document.getElementById('gameSelect');
    if (gameSelect) {
        gameSelect.addEventListener('change', handleGameSelection);
    }
}

async function getCurrentUser() {
    try {
        const token = getCookie('token');
        if (!token) {
            return null;
        }
        
        const response = await fetch('/api/user', {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include'
        });
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Error fetching current user:', error);
        return null;
    }
}

async function loadAvailableGames() {
    try {
        const token = getCookie('token');
        if (!token) {
            throw new Error('No authentication token');
        }
        
        const response = await fetch('/api/games', {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error('Failed to fetch games');
        }

        const games = await response.json();
        populateGameSelector(games);
        
    } catch (error) {
        console.error('Error loading games:', error);
        showError('Virhe ladattaessa pelejä');
    }
}

function populateGameSelector(games) {
    const gameSelect = document.getElementById('gameSelect');
    if (!gameSelect) return;

    // Clear existing options except the default
    gameSelect.innerHTML = '<option value="">Valitse peli nähdäksesi sen storyboard...</option>';

    // Add games
    games.forEach(game => {
        const option = document.createElement('option');
        option.value = game.id;
        option.textContent = `${game.name} (${game.gm_username || 'Tuntematon GM'})`;
        gameSelect.appendChild(option);
    });
}

async function handleGameSelection(event) {
    const gameId = event.target.value;
    
    if (!gameId) {
        hideStoryboard();
        return;
    }

    try {
        showLoading();
        await loadGameStoryboard(gameId);
    } catch (error) {
        console.error('Error handling game selection:', error);
        showError('Virhe ladattaessa pelin storyboardia');
    }
}

async function loadGameStoryboard(gameId) {
    try {
        const token = getCookie('token');
        if (!token) {
            throw new Error('No authentication token');
        }
        
        // Load storyboard data
        const response = await fetch(`/api/games/${gameId}/storyboard`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include'
        });
        if (!response.ok) {
            throw new Error('Failed to fetch storyboard data');
        }

        storyboardData = await response.json();
        currentGame = storyboardData.game;

        // Display the storyboard
        displayStoryboard();
        
        // Load gaming history if user has permission
        if (currentUser.id) {
            await loadGamingHistory();
        }

    } catch (error) {
        console.error('Error loading storyboard:', error);
        showError('Virhe ladattaessa storyboard-tietoja');
    }
}

function displayStoryboard() {
    hideLoading();
    hideError();
    
    // Update game header
    updateGameHeader();
    
    // Display chapters timeline
    displayChaptersTimeline();
    
    // Show the storyboard container
    const storyboardContainer = document.getElementById('gameStoryboard');
    if (storyboardContainer) {
        storyboardContainer.style.display = 'block';
    }
}

function updateGameHeader() {
    const titleElement = document.getElementById('gameTitle');
    const descriptionElement = document.getElementById('gameDescription');
    const statusBadgeElement = document.getElementById('gameStatusBadge');
    const durationElement = document.getElementById('gameDuration');

    if (titleElement) {
        titleElement.textContent = currentGame.name || 'Nimetön peli';
    }

    if (descriptionElement) {
        descriptionElement.textContent = currentGame.description || 'Ei kuvausta';
    }

    if (statusBadgeElement) {
        const isCompleted = storyboardData.isCompleted;
        statusBadgeElement.textContent = isCompleted ? 'Valmis' : 'Aktiivinen';
        statusBadgeElement.className = `status-badge ${isCompleted ? 'status-completed' : 'status-active'}`;
    }

    if (durationElement) {
        const startDate = new Date(currentGame.created_at);
        const endDate = storyboardData.isCompleted ? 
            new Date(currentGame.completion_date) : 
            new Date();
        
        const durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        durationElement.textContent = `${durationDays} päivää`;
    }
}

function displayChaptersTimeline() {
    const timelineContainer = document.getElementById('chapterTimeline');
    if (!timelineContainer) return;

    timelineContainer.innerHTML = '';

    if (!storyboardData.chapters || storyboardData.chapters.length === 0) {
        timelineContainer.innerHTML = `
            <div class="empty-state">
                <h3>Ei lukuja vielä</h3>
                <p>Tämä peli ei sisällä vielä yhtään lukua.</p>
            </div>
        `;
        return;
    }

    storyboardData.chapters.forEach(chapter => {
        const chapterCard = createChapterCard(chapter);
        timelineContainer.appendChild(chapterCard);
    });
}

function createChapterCard(chapter) {
    const card = document.createElement('div');
    card.className = `chapter-card ${chapter.is_archived ? 'chapter-archived' : 'chapter-active'}`;

    const headerHtml = `
        <div class="chapter-header">
            <h3 class="chapter-title">${escapeHtml(chapter.title)}</h3>
            <div class="chapter-meta">
                <span>Luku ${chapter.sequence_number}</span>
                <span>Luotu: ${formatDate(chapter.created_at)}</span>
                ${chapter.is_archived ? `<span>Arkistoitu: ${formatDate(chapter.archived_at)}</span>` : ''}
            </div>
        </div>
    `;

    const contentHtml = `
        <div class="chapter-content">
            <div class="chapter-description">
                ${escapeHtml(chapter.description || 'Ei kuvausta')}
            </div>
            ${chapter.is_archived ? createCompletionSummary(chapter) : ''}
        </div>
    `;

    card.innerHTML = headerHtml + contentHtml;
    return card;
}

function createCompletionSummary(chapter) {
    let summaryHtml = '';

    if (chapter.completion_summary) {
        summaryHtml += `
            <div class="completion-summary">
                <h4>Luvun yhteenveto</h4>
                <p>${escapeHtml(chapter.completion_summary)}</p>
            </div>
        `;
    }

    if (chapter.player_achievements && chapter.player_achievements.length > 0) {
        summaryHtml += `
            <div class="achievements">
                <h4>Pelaajien saavutukset</h4>
                <div class="achievement-list">
                    ${chapter.player_achievements.map(achievement => 
                        `<span class="achievement-badge">${escapeHtml(achievement)}</span>`
                    ).join('')}
                </div>
            </div>
        `;
    }

    if (chapter.notable_moments && chapter.notable_moments.length > 0) {
        summaryHtml += `
            <div class="notable-moments">
                <h4>Merkittävät hetket</h4>
                <div class="moment-list">
                    ${chapter.notable_moments.map(moment => 
                        `<div class="moment-item">${escapeHtml(moment.description || moment)}</div>`
                    ).join('')}
                </div>
            </div>
        `;
    }

    return summaryHtml;
}

async function loadGamingHistory() {
    try {
        const token = getCookie('token');
        if (!token) {
            return; // No authentication token
        }
        
        const response = await fetch(`/api/users/${currentUser.id}/gaming-history`, {
            headers: {
                'Authorization': `Bearer ${token}`
            },
            credentials: 'include'
        });
        if (!response.ok) return; // User might not have permission

        const historyData = await response.json();
        displayGamingHistory(historyData);
        
    } catch (error) {
        console.error('Error loading gaming history:', error);
        // Don't show error - this is optional feature
    }
}

function displayGamingHistory(historyData) {
    const historyContainer = document.getElementById('gamingHistory');
    if (!historyContainer) return;

    const statsContainer = document.getElementById('historyStats');
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${historyData.stats.totalCompletedGames}</div>
                <div class="stat-label">Valmiita pelejä</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${historyData.stats.totalActiveGames}</div>
                <div class="stat-label">Aktiivisia pelejä</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${historyData.stats.totalChaptersCompleted}</div>
                <div class="stat-label">Valmistunutta lukua</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${historyData.stats.totalPostsWritten}</div>
                <div class="stat-label">Kirjoitettua viestiä</div>
            </div>
        `;
    }

    historyContainer.style.display = 'block';
}

// Export functions
function exportGame(format) {
    if (!currentGame) {
        showError('Ei peliä valittuna vientiin');
        return;
    }

    const exportData = {
        format: format,
        includeArchived: true,
        includeMetadata: true
    };

    // Show loading
    const originalText = event.target.textContent;
    event.target.textContent = 'Viedään...';
    event.target.disabled = true;

    fetch(`/api/games/${currentGame.id}/export`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getCookie('token')}`
        },
        credentials: 'include',
        body: JSON.stringify(exportData)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Export failed');
        }

        if (format === 'markdown') {
            return response.blob().then(blob => {
                // Download markdown file
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentGame.name}.md`;
                a.click();
                window.URL.revokeObjectURL(url);
            });
        } else {
            return response.json().then(data => {
                // Download JSON file
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentGame.name}.json`;
                a.click();
                window.URL.revokeObjectURL(url);
            });
        }
    })
    .catch(error => {
        console.error('Export error:', error);
        showError('Virhe viedessä pelin tietoja');
    })
    .finally(() => {
        // Reset button
        event.target.textContent = originalText;
        event.target.disabled = false;
    });
}

// Utility functions
function showLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'block';
    }
    hideStoryboard();
    hideError();
}

function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    hideLoading();
    hideStoryboard();
}

function hideError() {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

function hideStoryboard() {
    const storyboardContainer = document.getElementById('gameStoryboard');
    if (storyboardContainer) {
        storyboardContainer.style.display = 'none';
    }
    
    const historyContainer = document.getElementById('gamingHistory');
    if (historyContainer) {
        historyContainer.style.display = 'none';
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Ei päivämäärää';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fi-FI', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return 'Virheellinen päivämäärä';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to get cookie value (for backward compatibility)
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
// GM Selection functionality
let gmProfiles = [];
let selectedGM = null;
let currentUser = null;

// Initialize the page
document.addEventListener('DOMContentLoaded', () => {
    initializeGMSelection();
});

async function initializeGMSelection() {
    try {
        // Check authentication
        currentUser = await getCurrentUser();
        if (!currentUser) {
            window.location.href = '/login';
            return;
        }

        // Load GM profiles
        await loadGMProfiles();
        
    } catch (error) {
        console.error('Error initializing GM selection:', error);
        showError('Virhe ladattaessa AI-pelinjohtajia');
    }
}

async function getCurrentUser() {
    try {
        const response = await fetch('/api/user');
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        console.error('Error fetching current user:', error);
        return null;
    }
}

async function loadGMProfiles() {
    try {
        showLoading();
        
        const response = await fetch('/api/ai-gm-profiles');
        if (!response.ok) {
            throw new Error('Failed to fetch GM profiles');
        }

        gmProfiles = await response.json();
        displayGMProfiles();
        
    } catch (error) {
        console.error('Error loading GM profiles:', error);
        showError('Virhe ladattaessa AI-pelinjohtajia: ' + error.message);
    } finally {
        hideLoading();
    }
}

function displayGMProfiles() {
    const grid = document.getElementById('gmGrid');
    if (!grid) return;

    grid.innerHTML = '';
    grid.style.display = 'grid';

    gmProfiles.forEach(gm => {
        const card = createGMCard(gm);
        grid.appendChild(card);
    });
}

function createGMCard(gm) {
    const card = document.createElement('div');
    card.className = 'gm-card';
    card.dataset.gmId = gm.id;
    
    const domainClass = `domain-${gm.domain_aspect.toLowerCase()}`;
    const difficultyStars = createDifficultyStars(gm.difficulty_level);
    const traitBadges = gm.personality_traits.slice(0, 4).map(trait => 
        `<span class="trait-badge">${trait}</span>`
    ).join('');

    card.innerHTML = `
        <div class="gm-portrait">
            <img src="../portraits/${gm.portrait_filename}" alt="${gm.name}" onerror="this.src='../portraits/default.png'">
            <div class="domain-badge ${domainClass}">${gm.domain_aspect}</div>
        </div>
        <div class="gm-info">
            <h3 class="gm-name">${gm.name}</h3>
            <p class="gm-title">${gm.title}</p>
            <p class="gm-style">${gm.gamemaster_style}</p>
            <div class="gm-traits">
                ${traitBadges}
            </div>
            <div class="difficulty-level">
                <span>Vaikeustaso:</span>
                <div class="difficulty-stars">${difficultyStars}</div>
            </div>
            <div class="affiliation">${gm.affiliation}</div>
        </div>
    `;

    // Add click handlers
    card.addEventListener('click', () => selectGM(gm));
    card.addEventListener('dblclick', () => showGMDetails(gm));

    return card;
}

function createDifficultyStars(level) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        const filled = i <= level ? 'filled' : '';
        stars += `<div class="star ${filled}"></div>`;
    }
    return stars;
}

function selectGM(gm) {
    selectedGM = gm;
    
    // Update card selection
    document.querySelectorAll('.gm-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    document.querySelector(`[data-gm-id="${gm.id}"]`).classList.add('selected');
    
    // Show game creation form
    showGameCreationForm();
}

function showGameCreationForm() {
    if (!selectedGM) return;
    
    const form = document.getElementById('gameCreationForm');
    const gmName = document.getElementById('selectedGmName');
    const gmPhilosophy = document.getElementById('selectedGmPhilosophy');
    
    gmName.textContent = `${selectedGM.name} - ${selectedGM.title}`;
    gmPhilosophy.textContent = selectedGM.philosophy;
    
    form.style.display = 'block';
    form.scrollIntoView({ behavior: 'smooth' });
}

function cancelGameCreation() {
    selectedGM = null;
    
    // Clear selection
    document.querySelectorAll('.gm-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Hide form
    document.getElementById('gameCreationForm').style.display = 'none';
}

function showGMDetails(gm) {
    const modal = document.getElementById('gmModal');
    
    // Fill modal content
    document.getElementById('modalPortrait').src = `../portraits/${gm.portrait_filename}`;
    document.getElementById('modalName').textContent = gm.name;
    document.getElementById('modalTitle').textContent = gm.title;
    document.getElementById('modalPhilosophy').textContent = gm.philosophy;
    document.getElementById('modalGamemasterStyle').textContent = gm.gamemaster_style;
    document.getElementById('modalSpecies').textContent = gm.adopted_species;
    document.getElementById('modalSpeciesDescription').textContent = gm.species_description;
    document.getElementById('modalLanguage').textContent = gm.language_style;
    document.getElementById('modalAffiliation').textContent = gm.affiliation;
    
    // Fill themes
    const themesContainer = document.getElementById('modalThemes');
    themesContainer.innerHTML = gm.preferred_themes.map(theme => 
        `<span class="theme-tag">${theme}</span>`
    ).join('');
    
    // Fill difficulty
    const difficultyContainer = document.getElementById('modalDifficulty');
    difficultyContainer.innerHTML = createDifficultyStars(gm.difficulty_level);
    
    modal.classList.add('show');
}

function closeGmModal() {
    document.getElementById('gmModal').classList.remove('show');
}

// Game creation form handler
document.getElementById('createGameForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!selectedGM) {
        showError('Valitse ensin AI-pelinjohtaja');
        return;
    }
    
    const formData = new FormData(e.target);
    const gameData = {
        name: formData.get('gameName'),
        description: formData.get('gameDescription'),
        ai_gm_profile_id: selectedGM.id,
        genre: formData.get('gameGenre'),
        max_players: parseInt(formData.get('maxPlayers'))
    };
    
    try {
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Luodaan peliä...';
        
        const response = await fetch('/api/games/with-ai-gm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(gameData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create game');
        }
        
        const result = await response.json();
        
        // Success! Redirect to the new game
        alert(`Peli "${result.game.name}" luotu onnistuneesti! ${selectedGM.name} odottaa sinua.`);
        window.location.href = `/hml/threads.html?game=${result.game.id}`;
        
    } catch (error) {
        console.error('Error creating game:', error);
        showError('Virhe luotaessa peliä: ' + error.message);
        
        const submitButton = e.target.querySelector('button[type="submit"]');
        submitButton.disabled = false;
        submitButton.textContent = 'Luo peli';
    }
});

// Utility functions
function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('gmGrid').style.display = 'none';
    hideError();
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

function showError(message) {
    const errorElement = document.getElementById('error');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    hideLoading();
}

function hideError() {
    document.getElementById('error').style.display = 'none';
}

// Close modal when clicking outside
document.getElementById('gmModal').addEventListener('click', (e) => {
    if (e.target.id === 'gmModal') {
        closeGmModal();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeGmModal();
    }
});
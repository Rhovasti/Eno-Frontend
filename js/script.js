// script.js

document.addEventListener('DOMContentLoaded', function() {
    const availableGames = document.getElementById('availableGames');
    const createGameForm = document.getElementById('createGameForm');

    // Check if user is logged in
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const isLoggedIn = !!user.id;
    
    // Always attempt to fetch games (anonymous users can view them too)
    if (availableGames) {
        fetchGames();
    }

    function fetchGames() {
        const token = getCookie('token');
        
        // Fetch games with or without token (server handles anonymous access)
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        fetch('/api/games', {
            headers: headers,
            credentials: 'include'
        })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 401) {
                        // Redirect to login if not authenticated
                        console.error('Authentication failed, redirecting to login');
                        window.location.href = '/hml/login.html';
                        return;
                    }
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(games => {
                if (games) {
                    displayGames(games);
                }
            })
            .catch(error => {
                console.error('Error fetching games:', error);
                // Show user-friendly error in the games list
                if (availableGames) {
                    availableGames.innerHTML = '<li style="color: red;">Virhe pelien lataamisessa - yritä päivittää sivu tai kirjaudu uudelleen</li>';
                }
            });
    }

    function createGame(event) {
        event.preventDefault();
        const name = document.getElementById('gameName').value;
        const description = document.getElementById('gameDescription').value;

        // Check if user has GM role
        const roles = JSON.parse(user.roles || '[]');
        if (!roles.includes('gm') && !user.is_admin) {
            alert('Vain GM-roolilla varustetut käyttäjät voivat luoda pelejä.');
            return;
        }

        fetch('/api/games', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getCookie('token')}`
            },
            credentials: 'include',
            body: JSON.stringify({ name, description })
        })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 401) {
                        window.location.href = '/hml/login.html';
                        return;
                    }
                    if (response.status === 403) {
                        alert('Sinulla ei ole oikeuksia luoda pelejä.');
                        return;
                    }
                }
                return response.json();
            })
            .then(data => {
                if (data) {
                    if (data.error) {
                        alert(`Error creating game: ${data.error}`);
                    } else {
                        alert('Peli luotu onnistuneesti');
                        createGameForm.reset();
                        fetchGames();
                    }
                }
            })
            .catch(error => console.error('Error creating game:', error));
    }

    function displayGames(games) {
        if (!availableGames) return;
        
        availableGames.innerHTML = '';
        
        if (games.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'Ei pelejä saatavilla. Luo uusi peli GM-roolilla.';
            availableGames.appendChild(li);
            return;
        }
        
        games.forEach(game => {
            const li = document.createElement('li');
            li.textContent = game.name;
            li.addEventListener('click', () => {
                // Navigate to threads page with selected game
                window.location.href = `/threads.html?gameId=${game.id}`;
            });
            availableGames.appendChild(li);
        });
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
    
    // Logout function
    function handleLogout() {
        fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getCookie('token')}`
            },
            credentials: 'include'
        })
        .then(response => {
            localStorage.removeItem('user');
            localStorage.removeItem('auth_token');
            document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            window.location.href = '/';
        })
        .catch(error => console.error('Logout error:', error));
    }

    // Add event listener if form exists
    if (createGameForm) {
        createGameForm.addEventListener('submit', createGame);
    }
    
    // Add logout handler if button exists on this page
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});
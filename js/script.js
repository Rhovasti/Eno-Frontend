// script.js

document.addEventListener('DOMContentLoaded', function() {
    const availableGames = document.getElementById('availableGames');
    const createGameForm = document.getElementById('createGameForm');

    function fetchGames() {
        fetch('/api/games')
            .then(response => response.json())
            .then(games => {
                displayGames(games);
            })
            .catch(error => console.error('Error fetching games:', error));
    }

    function createGame(event) {
        event.preventDefault();
        const name = document.getElementById('gameName').value;
        const description = document.getElementById('gameDescription').value;

        fetch('/api/games', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description })
        })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    alert(`Error creating game: ${data.error}`);
                } else {
                    alert('Peli luotu onnistuneesti');
                    createGameForm.reset();
                    fetchGames();
                }
            })
            .catch(error => console.error('Error creating game:', error));
    }

    function displayGames(games) {
        availableGames.innerHTML = '';
        games.forEach(game => {
            const li = document.createElement('li');
            li.textContent = game.name;
            li.addEventListener('click', () => {
                // Navigate to threads page with selected game
                window.location.href = `threads.html?gameId=${game.id}`;
            });
            availableGames.appendChild(li);
        });
    }

    createGameForm.addEventListener('submit', createGame);

    fetchGames();
});

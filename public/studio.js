// API helper
function api(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return fetch(path, {
        ...options,
        headers,
    }).then(res => {
        if (!res.ok) {
            if (res.status === 401) {
                window.location.href = '/login.html';
                throw new Error('Unauthorized');
            }
            throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
    });
}

// Initialize
async function init() {
    try {
        const user = await api('/me');
        document.getElementById('user-info').textContent = user.username;
        await loadUserGames();
    } catch (err) {
        console.error('Init error:', err);
        window.location.href = '/login.html';
    }
}

let currentEditingGameId = null;

// Load user games
async function loadUserGames() {
    try {
        const res = await api('/games');
        const myGames = res.games ? res.games.filter(g => g.owner === (await api('/me')).id) : [];
        
        const gamesList = document.getElementById('games-list');
        if (myGames.length === 0) {
            gamesList.innerHTML = '<div class="empty-state">No games yet</div>';
            return;
        }

        gamesList.innerHTML = myGames.map(g => 
            `<div class="game-item" onclick="selectGame(${g.id})">${g.title || g.name || 'Untitled'}</div>`
        ).join('');
    } catch (err) {
        console.error('Load games error:', err);
    }
}

// Show new game form
function showNewGameForm() {
    currentEditingGameId = null;
    document.getElementById('welcome-section').style.display = 'none';
    document.getElementById('game-details').style.display = 'none';
    document.getElementById('editor-form').style.display = 'block';
    document.getElementById('form-title').textContent = 'Create New Game';
    document.getElementById('delete-btn').style.display = 'none';
    
    // Reset form
    document.getElementById('game-form').reset();
}

// Cancel edit
function cancelEdit() {
    currentEditingGameId = null;
    document.getElementById('editor-form').style.display = 'none';
    document.getElementById('game-details').style.display = 'none';
    document.getElementById('welcome-section').style.display = 'block';
}

// Show games list
function showGamesList() {
    currentEditingGameId = null;
    document.getElementById('editor-form').style.display = 'none';
    document.getElementById('game-details').style.display = 'none';
    document.getElementById('welcome-section').style.display = 'block';
    loadUserGames();
}

// Save game
async function saveGame(event) {
    event.preventDefault();

    const gameData = {
        title: document.getElementById('game-name').value,
        description: document.getElementById('game-description').value,
        genre: document.getElementById('game-genre').value,
        maxPlayers: parseInt(document.getElementById('game-max-players').value),
        thumbnail: document.getElementById('game-thumbnail').value || '',
    };

    try {
        let res;
        if (currentEditingGameId) {
            // Update existing game
            res = await api(`/games/${currentEditingGameId}`, {
                method: 'PUT',
                body: JSON.stringify(gameData),
            });
        } else {
            // Create new game
            res = await api('/games', {
                method: 'POST',
                body: JSON.stringify(gameData),
            });
        }

        if (res.ok || res.id) {
            showGamesList();
            loadUserGames();
        } else {
            alert('Error saving game: ' + (res.error || 'Unknown error'));
        }
    } catch (err) {
        console.error('Save game error:', err);
        alert('Error saving game');
    }
}

// Select game to view/edit
async function selectGame(gameId) {
    try {
        const res = await api(`/games/${gameId}`);
        if (!res.ok && !res.game) {
            alert('Game not found');
            return;
        }

        const game = res.game || res;
        currentEditingGameId = gameId;

        // Show game details
        document.getElementById('welcome-section').style.display = 'none';
        document.getElementById('editor-form').style.display = 'none';
        document.getElementById('game-details').style.display = 'block';

        // Populate details
        document.getElementById('detail-title').textContent = game.title || game.name || 'Untitled';
        document.getElementById('detail-description').textContent = game.description || 'No description';
        document.getElementById('detail-genre').textContent = game.genre || 'Unknown';
        document.getElementById('detail-max-players').textContent = game.maxPlayers || 10;
        document.getElementById('stat-plays').textContent = formatNumber(game.plays || 0);
        document.getElementById('stat-rating').textContent = ((game.rating || 0) / 100).toFixed(1) + '/5';
        document.getElementById('stat-favorites').textContent = formatNumber(game.favorites || 0);

        const createdDate = new Date(game.created_at).toLocaleDateString();
        document.getElementById('detail-created').textContent = createdDate;

        // Set game status
        document.getElementById('game-status').textContent = game.published ? 'Published' : 'Draft';
        document.getElementById('game-status').style.color = game.published ? '#1dc92a' : '#b0b0b0';

        // Update buttons
        document.getElementById('publish-btn').textContent = game.published ? 'Unpublish' : 'Publish';
    } catch (err) {
        console.error('Select game error:', err);
        alert('Error loading game');
    }
}

// Edit game
function editGame() {
    const title = document.getElementById('detail-title').textContent;
    const description = document.getElementById('detail-description').textContent;
    const genre = document.getElementById('detail-genre').textContent;
    const maxPlayers = document.getElementById('detail-max-players').textContent;

    document.getElementById('game-name').value = title;
    document.getElementById('game-description').value = description;
    document.getElementById('game-genre').value = genre.toLowerCase();
    document.getElementById('game-max-players').value = maxPlayers;

    document.getElementById('form-title').textContent = 'Edit Game';
    document.getElementById('delete-btn').style.display = 'block';
    document.getElementById('editor-form').style.display = 'block';
    document.getElementById('game-details').style.display = 'none';
}

// Publish game
async function publishGame() {
    if (!currentEditingGameId) return;

    try {
        const res = await api(`/games/${currentEditingGameId}/publish`, {
            method: 'POST',
        });

        if (res.ok) {
            await selectGame(currentEditingGameId);
            alert('Game publish status updated!');
        } else {
            alert('Error: ' + (res.error || 'Unknown error'));
        }
    } catch (err) {
        console.error('Publish error:', err);
        alert('Error updating game');
    }
}

// Delete game
async function deleteGame() {
    if (!currentEditingGameId) return;

    if (confirm('Are you sure you want to delete this game? This action cannot be undone.')) {
        try {
            const res = await api(`/games/${currentEditingGameId}`, {
                method: 'DELETE',
            });

            if (res.ok) {
                alert('Game deleted!');
                showGamesList();
                loadUserGames();
            } else {
                alert('Error: ' + (res.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Delete error:', err);
            alert('Error deleting game');
        }
    }
}

// Format large numbers
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Logout
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

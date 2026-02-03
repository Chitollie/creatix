// API helper function
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
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    });
}

// Initialize page
async function init() {
    try {
        // Check authentication
        const user = await api('/api/user');
        document.getElementById('welcome-name').textContent = user.username;
        document.getElementById('user-info').textContent = user.username;
        
        // Load and display currency (Creabux)
        if (user.creabux !== undefined) {
            document.getElementById('creabux-display').textContent = `💎 ${user.is_admin ? '∞' : formatNumber(user.creabux)} Creabux`;
        }

        // Load friends
        await loadFriends();

        // Load games
        await loadGames();
    } catch (error) {
        console.error('Error:', error);
        // Redirect to login if not authenticated
        if (error.message.includes('401') || error.message.includes('401')) {
            window.location.href = '/login.html';
        }
    }
}

// Load friends list
async function loadFriends() {
    try {
        // For now, create mock friends (you can replace with API call)
        const mockFriends = [
            { id: 1, username: 'Player1', status: 'online' },
            { id: 2, username: 'Player2', status: 'offline' },
            { id: 3, username: 'Player3', status: 'online' },
            { id: 4, username: 'Player4', status: 'online' },
            { id: 5, username: 'Player5', status: 'offline' },
        ];

        const friendsList = document.getElementById('friends-list');
        const friendCount = document.getElementById('friend-count');

        friendCount.textContent = mockFriends.length;
        friendsList.innerHTML = '';

        mockFriends.forEach(friend => {
            const friendElement = document.createElement('div');
            friendElement.className = 'friend-item';
            friendElement.innerHTML = `
                <div class="friend-avatar">${friend.username.charAt(0).toUpperCase()}</div>
                <div class="friend-info">
                    <div class="friend-name">${friend.username}</div>
                    <div class="friend-status ${friend.status}">${friend.status === 'online' ? '● Online' : '○ Offline'}</div>
                </div>
            `;
            friendsList.appendChild(friendElement);
        });
    } catch (error) {
        console.error('Error loading friends:', error);
    }
}

// Load games
async function loadGames() {
    try {
        const response = await api('/api/games');
        const games = Array.isArray(response) ? response : response.games || [];

        // Sort by popularity (plays descending)
        const sortedGames = games.sort((a, b) => (b.plays || 0) - (a.plays || 0));

        // Display popular games (top 4)
        displayGames(sortedGames.slice(0, 4), 'games-grid');

        // Display all games
        displayGames(sortedGames, 'all-games-grid');

        // Add sort button listeners
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                let sorted = [...games];
                if (e.target.dataset.sort === 'popular') {
                    sorted.sort((a, b) => (b.plays || 0) - (a.plays || 0));
                } else if (e.target.dataset.sort === 'trending') {
                    sorted.sort((a, b) => (b.plays || 0) - (a.plays || 0)); // Same for now
                } else if (e.target.dataset.sort === 'recent') {
                    sorted.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                }

                displayGames(sorted.slice(0, 4), 'games-grid');
            });
        });
    } catch (error) {
        console.error('Error loading games:', error);
        // Show demo games if API fails
        displayDemoGames();
    }
}

// Display games on the page
function displayGames(games, gridId) {
    const grid = document.getElementById(gridId);
    grid.innerHTML = '';

    if (games.length === 0) {
        grid.innerHTML = '<div class="empty-state" style="grid-column: 1/-1; padding: 2rem;">No games found</div>';
        return;
    }

    games.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-card';
        gameCard.innerHTML = `
            <div class="game-thumbnail">
                <img src="${game.thumbnail || `https://via.placeholder.com/180x100?text=${encodeURIComponent(game.name)}`}" 
                     alt="${game.name}" 
                     onerror="this.src='https://via.placeholder.com/180x100?text=Game'">
            </div>
            <div class="game-info">
                <div class="game-title">${game.name}</div>
                <div class="game-stats">
                    <div class="stat-item">
                        <span>👥</span>
                        <span>${formatNumber(game.plays || 0)}</span>
                    </div>
                    <div class="stat-item">
                        <span>⭐</span>
                        <span>${(game.rating || 0).toFixed(1)}</span>
                    </div>
                </div>
            </div>
        `;
        
        gameCard.addEventListener('click', () => {
            // Navigate to game detail page with friendly URL
            window.location.href = `/games/${game.id}/${encodeURIComponent(game.title || game.name)}`;
        });

        grid.appendChild(gameCard);
    });
}

// Display demo games if API fails
function displayDemoGames() {
    const demoGames = [
        { id: 1, name: 'Obby Island', plays: 2500000, rating: 4.8, thumbnail: 'https://via.placeholder.com/180x100?text=Obby+Island' },
        { id: 2, name: 'Parkour Paradise', plays: 1800000, rating: 4.6, thumbnail: 'https://via.placeholder.com/180x100?text=Parkour' },
        { id: 3, name: 'RPG Quest', plays: 1500000, rating: 4.7, thumbnail: 'https://via.placeholder.com/180x100?text=RPG+Quest' },
        { id: 4, name: 'Building Tycoon', plays: 1200000, rating: 4.5, thumbnail: 'https://via.placeholder.com/180x100?text=Tycoon' },
        { id: 5, name: 'Prison Escape', plays: 980000, rating: 4.4, thumbnail: 'https://via.placeholder.com/180x100?text=Prison' },
        { id: 6, name: 'Jailbreak 2', plays: 850000, rating: 4.3, thumbnail: 'https://via.placeholder.com/180x100?text=Jailbreak' },
        { id: 7, name: 'Adopt Me', plays: 750000, rating: 4.6, thumbnail: 'https://via.placeholder.com/180x100?text=Adopt+Me' },
        { id: 8, name: 'Bloxburg', plays: 620000, rating: 4.7, thumbnail: 'https://via.placeholder.com/180x100?text=Bloxburg' },
    ];

    displayGames(demoGames.slice(0, 4), 'games-grid');
    displayGames(demoGames, 'all-games-grid');
}

// Format number with K, M suffix
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

// Search functionality
async function handleSearch(event) {
    const query = document.getElementById('search-input').value.trim();
    const searchResults = document.getElementById('search-results');
    
    if (query.length < 2) {
        searchResults.style.display = 'none';
        return;
    }

    try {
        // Search for games
        const gamesResponse = await api(`/search/games?q=${encodeURIComponent(query)}`);
        const games = Array.isArray(gamesResponse) ? gamesResponse : gamesResponse.games || [];

        // Display results
        const gamesResultsDiv = document.getElementById('search-games-results');
        gamesResultsDiv.innerHTML = '';

        if (games.length > 0) {
            const gamesHeader = document.createElement('div');
            gamesHeader.style.cssText = 'padding: 0.5rem 1rem; color: var(--text-tertiary); font-size: 0.85rem; font-weight: 700;';
            gamesHeader.textContent = 'GAMES';
            gamesResultsDiv.appendChild(gamesHeader);

            games.slice(0, 5).forEach(game => {
                const resultItem = document.createElement('div');
                resultItem.className = 'search-result-item';
                resultItem.innerHTML = `
                    <div style="flex: 1;">
                        <div style="font-weight: 500;">${game.title || game.name}</div>
                        <div style="font-size: 0.85rem; color: var(--text-tertiary);">👥 ${formatNumber(game.plays || 0)} plays</div>
                    </div>
                `;
                resultItem.style.cursor = 'pointer';
                resultItem.addEventListener('click', () => {
                    window.location.href = `game.html?id=${game.id}`;
                });
                gamesResultsDiv.appendChild(resultItem);
            });
        }

        // Search for users (mock for now)
        // Search for users
        const playersResponse = await api(`/search/users?q=${encodeURIComponent(query)}`);
        const players = Array.isArray(playersResponse) ? playersResponse : playersResponse.users || [];

        const playersResultsDiv = document.getElementById('search-players-results');
        playersResultsDiv.innerHTML = '';

        if (players.length > 0) {
            const playersHeader = document.createElement('div');
            playersHeader.style.cssText = 'padding: 0.5rem 1rem; color: var(--text-tertiary); font-size: 0.85rem; font-weight: 700;';
            playersHeader.textContent = 'PLAYERS';
            playersResultsDiv.appendChild(playersHeader);

            players.slice(0,5).forEach(p => {
                const item = document.createElement('div');
                item.className = 'search-result-item';
                item.innerHTML = `
                    <div style="flex:1;">
                        <div style="font-weight:500;">${p.username}</div>
                        <div style="font-size:0.85rem;color:var(--text-tertiary);">Member</div>
                    </div>
                `;
                item.style.cursor = 'pointer';
                item.addEventListener('click', () => window.location.href = `/player/${p.id}/${encodeURIComponent(p.username)}`);
                playersResultsDiv.appendChild(item);
            });
        }

        searchResults.style.display = (games.length > 0 || players.length > 0) ? 'block' : 'none';
    } catch (error) {
        console.error('Error searching:', error);
        document.getElementById('search-results').style.display = 'none';
    }
}

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        document.getElementById('search-results').style.display = 'none';
    }
});

// Logout function
function logout() {
    localStorage.removeItem('token');
    window.location.href = '/login.html';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

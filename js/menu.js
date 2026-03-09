window.currentPlayer = "Guest"; 

function selectProfile(name) {
    window.currentPlayer = name;
    
    // Update the visual tag
    document.getElementById('player-name-display').innerText = name;
    
    // Hide the profile screen
    document.getElementById('profile-screen').style.display = 'none';
    
    console.log("Player selected:", window.currentPlayer);
}

// Allow clicking the "Playing as..." tag to switch profiles again
document.addEventListener('DOMContentLoaded', () => {
    const playerTag = document.getElementById('current-player-tag');
    if(playerTag) {
        playerTag.addEventListener('click', () => {
            document.getElementById('profile-screen').style.display = 'flex';
        });
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const songContainer = document.getElementById('song-list-container');
    const searchInput = document.getElementById('search-input');
    const menuScreen = document.getElementById('menu-screen');
    const gameScreen = document.getElementById('game-container');
    const backBtn = document.getElementById('back-to-menu-btn');

    let allSongs = [];

    // 1. Load the Song List
    // FIX: Removed the broken 'await fetch' line that was here
    fetch('assets/data/song_list.json')
        .then(response => response.json())
        .then(data => {
            allSongs = data;
            renderSongs(allSongs);
        })
        .catch(err => console.error("Error loading song list:", err));

    // 2. Render the List
    function renderSongs(songs) {
        if (!songContainer) return;
        songContainer.innerHTML = '';
        
        songs.forEach(song => {
            const card = document.createElement('div');
            card.className = 'song-card';
            
            card.innerHTML = `
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                    <div class="song-artist">${song.artist}</div>
                </div>
                <div class="song-difficulty">${song.difficulty || 'Normal'}</div>
            `;
            
            card.onclick = () => {
                launchGame(song);
            };
            songContainer.appendChild(card);
        });
    }

    // 3. Search Functionality
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allSongs.filter(song => 
            song.title.toLowerCase().includes(term) || 
            song.artist.toLowerCase().includes(term)
        );
        renderSongs(filtered);
    });

    // 4. Launch Game Logic
    function launchGame(songData) {
        // Hide Menu, Show Game
        menuScreen.style.display = 'none';
        gameScreen.style.display = 'block';

        if (window.gameInstance) {
            // Force the game to calculate its size now that it is visible
            window.gameInstance.resize(); 
            window.gameInstance.loadLevel(songData);
        } else {
            console.error("Game instance not found!");
        }
    }

    // 5. Back Button Logic
    backBtn.addEventListener('click', () => {
        if (window.gameInstance) {
            window.gameInstance.stopGame();
        }
        gameScreen.style.display = 'none';
        menuScreen.style.display = 'flex';
    });
});
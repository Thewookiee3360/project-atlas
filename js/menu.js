const menuScreen = document.getElementById('menu-screen');
const gameContainer = document.getElementById('game-container');
const songListEl = document.getElementById('song-list');
const playerBtns = document.querySelectorAll('.player-btn');
const currentPlayerEl = document.getElementById('player-name');

// Modal Elements
const modal = document.getElementById('song-modal');
const closeBtn = document.getElementById('close-modal-btn');
const groovyBtn = document.getElementById('groovy-btn');

let currentAudioPreview = null;
let previewTimeout = null;
let selectedSongData = null;

// --- 1. PLAYER SELECTION (Tap to Select, Tap to Confirm) ---
let pendingPlayer = null;

// Default player
window.currentPlayer = "Atlas";
currentPlayerEl.innerText = "Atlas";
if(playerBtns[0]) playerBtns[0].classList.add('confirmed');

playerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');

        if (pendingPlayer === name) {
            // SECOND TAP: Confirm and Lock In
            playerBtns.forEach(b => {
                b.classList.remove('selected');
                b.classList.remove('confirmed');
            });
            btn.classList.add('confirmed'); 
            
            currentPlayerEl.innerText = name;
            window.currentPlayer = name;
            pendingPlayer = null; 
            
            btn.style.transform = "scale(1.1)";
            setTimeout(() => btn.style.transform = "scale(1)", 200);

        } else {
            // FIRST TAP: Select (Pending)
            playerBtns.forEach(b => {
                b.classList.remove('selected');
                b.classList.remove('confirmed');
            });
            btn.classList.add('selected'); 
            pendingPlayer = name;
            
            currentPlayerEl.innerText = "Tap again to confirm " + name + "?";
        }
    });
});

// --- 2. LOAD SONG LIST ---
async function initMenu() {
    try {
        // FIX: The path is exactly 'assets' now
        const response = await fetch('assets/data/song_list.json');
        
        if (!response.ok) {
            throw new Error("Could not find the file! Check folder name.");
        }
        
        const songs = await response.json();
        
        songListEl.innerHTML = ''; 

        songs.forEach(song => {
            const card = document.createElement('div');
            card.className = 'song-card'; 
            card.innerHTML = `
                <h3>${song.title}</h3>
                <p>${song.difficulty || 'Normal'}</p>
            `;
            
            // Clicking a grid item opens the preview modal
            card.onclick = () => openSongPreview(song);
            songListEl.appendChild(card);
        });

    } catch (err) {
        console.error("Menu Load Error:", err);
        songListEl.innerHTML = `<p style="color:red">Error loading songs. Check console.</p>`;
    }
}
initMenu();

// Add a global variable at the top of menu.js near your other 'let' statements:
let selectedDifficulty = "Normal"; 

// Replace the openSongPreview function:
function openSongPreview(song) {
    selectedSongData = song;
    
    document.getElementById('modal-song-title').innerText = song.title;
    document.getElementById('modal-song-artist').innerText = song.artist || "Unknown Artist";

    // 1. Build Difficulty Buttons
    const diffContainer = document.getElementById('difficulty-selectors');
    diffContainer.innerHTML = '';
    
    // Fallback if you haven't added difficulties to your json yet
    const diffs = song.difficulties || ["Normal"]; 
    selectedDifficulty = diffs[0]; // Default to the first one

    diffs.forEach(diff => {
        const btn = document.createElement('button');
        btn.innerText = diff.toUpperCase();
        // Give them that Gold/Red styling!
        btn.style.cssText = `
            background: rgba(0,0,0,0.5); color: #888; border: 2px solid #333; 
            padding: 8px 15px; border-radius: 8px; cursor: pointer; 
            font-family: 'Rajdhani'; font-weight: bold; font-size: 14px;
        `;
        
        btn.onclick = () => {
            // Reset all buttons
            Array.from(diffContainer.children).forEach(b => {
                b.style.borderColor = '#333';
                b.style.color = '#888';
                b.style.boxShadow = 'none';
            });
            // Highlight selected button (Gold)
            btn.style.borderColor = '#ffd700';
            btn.style.color = 'white';
            btn.style.boxShadow = '0 0 10px #ffd700';
            
            selectedDifficulty = diff;
            updateLeaderboardDisplay(song.id, diff); // Refresh scores!
        };
        diffContainer.appendChild(btn);
    });

    // Auto-click the first difficulty to load the default leaderboard
    if (diffContainer.firstChild) diffContainer.firstChild.click();

    modal.style.display = 'flex';

    stopPreview(); 
    
    const audioUrl = song.video.includes('/') ? song.video : 'assets/video/' + song.video;
    currentAudioPreview = new Audio(audioUrl);
    currentAudioPreview.addEventListener('loadedmetadata', () => {
        currentAudioPreview.currentTime = currentAudioPreview.duration * 0.4;
        currentAudioPreview.play().then(() => {
            previewTimeout = setTimeout(() => {
                if (currentAudioPreview) currentAudioPreview.pause();
            }, 10000); 
        }).catch(e => console.log("Preview autoplay blocked", e));
    });
}

// 2. The function to swap leaderboards based on difficulty
function updateLeaderboardDisplay(songId, difficulty) {
    // Note how the save key now includes the difficulty! (e.g. "leaderboard_nc_rockefeller_Nightcore")
    const key = 'leaderboard_' + (songId || "unknown") + "_" + difficulty;
    let history = JSON.parse(localStorage.getItem(key)) || [];
    
    history.sort((a,b) => b.score - a.score); 
    
    let myBest = 0;
    history.forEach(entry => {
        if (entry.name === window.currentPlayer && entry.score > myBest) {
            myBest = entry.score;
        }
    });
    document.getElementById('modal-personal-best').innerText = myBest;

    const lbList = document.getElementById('modal-leaderboard-list');
    lbList.innerHTML = '';
    if (history.length === 0) {
        lbList.innerHTML = '<li><span style="color:#ffd700;">No scores yet for this difficulty!</span></li>';
    } else {
        history.slice(0, 3).forEach(entry => { 
            lbList.innerHTML += `<li><span style="color:#ffd700; font-weight:bold;">${entry.name}</span><span>${entry.score}</span></li>`;
        });
    }
}

// 3. Update the START button to pass the difficulty to the game
groovyBtn.onclick = () => {
    stopPreview(); 
    modal.style.display = 'none';
    menuScreen.style.display = 'none';
    gameContainer.style.display = 'block';
    
    if (window.gameInstance && selectedSongData) {
        // We now hand the game the specific difficulty Atlas clicked!
        window.gameInstance.loadLevel(selectedSongData, selectedDifficulty); 
    }
};

function stopPreview() {
    if (currentAudioPreview) {
        currentAudioPreview.pause();
        currentAudioPreview = null;
    }
    if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }
}

// --- 4. MODAL BUTTONS ---
closeBtn.onclick = () => {
    stopPreview();
    modal.style.display = 'none';
};

groovyBtn.onclick = () => {
    stopPreview(); 
    modal.style.display = 'none';
    menuScreen.style.display = 'none';
    gameContainer.style.display = 'block';
    
    if (window.gameInstance && selectedSongData) {
        window.gameInstance.loadLevel(selectedSongData);
    }
};

document.getElementById('back-to-menu-btn').addEventListener('click', () => {
    gameContainer.style.display = 'none';
    menuScreen.style.display = 'flex';
});
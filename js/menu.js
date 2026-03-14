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

function openSongPreview(song) {
    selectedSongData = song;
    
    document.getElementById('modal-song-title').innerText = song.title;
    document.getElementById('modal-song-artist').innerText = song.artist || "Unknown Artist";
    document.getElementById('modal-difficulty').innerText = song.difficulty || "Normal";

    const key = 'leaderboard_' + (song.id || song.title);
    let history = JSON.parse(localStorage.getItem(key)) || []
    
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
        lbList.innerHTML = '<li><span style="color:#ffd700;">No scores yet! Be the first!</span></li>'; // Gold text
    } else {
        history.slice(0, 3).forEach(entry => { 
            lbList.innerHTML += `<li><span style="color:#ffd700; font-weight:bold;">${entry.name}</span><span>${entry.score}</span></li>`; // Gold names
        });
    }

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
        }).catch(e => console.log("Preview autoplay blocked by browser", e));
    });
}

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
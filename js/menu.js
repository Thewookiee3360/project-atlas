const menuScreen = document.getElementById('menu-screen');
const gameContainer = document.getElementById('game-container');
const songListEl = document.getElementById('song-list');
const playerBtns = document.querySelectorAll('.player-btn');
const currentPlayerEl = document.getElementById('player-name');

const modal = document.getElementById('song-modal');
const closeBtn = document.getElementById('close-modal-btn');
const groovyBtn = document.getElementById('groovy-btn');

let currentAudioPreview = null;
let previewTimeout = null;
let selectedSongData = null;
let selectedDifficulty = "Normal"; // Default difficulty
let pendingPlayer = null;

// Default player
window.currentPlayer = "Atlas";
if(currentPlayerEl) currentPlayerEl.innerText = "Atlas";
if(playerBtns[0]) playerBtns[0].classList.add('confirmed');

playerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');

        if (pendingPlayer === name) {
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

async function initMenu() {
    try {
        const response = await fetch('assets/data/song_list.json');
        
        if (!response.ok) {
            throw new Error("Could not find the file! Check folder name.");
        }
        
        const songs = await response.json();
        
        songListEl.innerHTML = ''; 

        songs.forEach(song => {
            const card = document.createElement('div');
            card.className = 'song-card'; 
            
            // --- NEW: Apply the album cover background ---
            if (song.cover) {
                card.style.backgroundImage = `url('${song.cover}')`;
            }
            
            let diffLabel = song.difficulties ? song.difficulties.join(" / ") : (song.difficulty || 'Normal');
            
            card.innerHTML = `
                <h3>${song.title}</h3>
                <p style="color:#ff3333; margin-top:5px; font-size:14px;">${diffLabel}</p>
            `;
            
            card.onclick = () => openSongPreview(song);
            songListEl.appendChild(card);
        });

        // --- NEW: Jumpstart the rotating leaderboard ---
        buildRotatingLeaderboard(songs);

    } catch (err) {
        console.error("Menu Load Error:", err);
        songListEl.innerHTML = `<p style="color:#ff3333">Error loading songs. Check console or song_list.json syntax!</p>`;
    }
}
initMenu();

function openSongPreview(song) {
    selectedSongData = song;
    
    document.getElementById('modal-song-title').innerText = song.title;
    document.getElementById('modal-song-artist').innerText = song.artist || "Unknown Artist";

    // Build Difficulty Buttons
    const diffContainer = document.getElementById('difficulty-selectors');
    diffContainer.innerHTML = '';
    
    const diffs = song.difficulties || ["Normal"]; 
    selectedDifficulty = diffs[0]; 

    diffs.forEach(diff => {
        const btn = document.createElement('button');
        btn.innerText = diff.toUpperCase();
        btn.style.cssText = `
            background: rgba(0,0,0,0.5); color: #888; border: 2px solid #333; 
            padding: 8px 15px; border-radius: 8px; cursor: pointer; 
            font-family: 'Rajdhani'; font-weight: bold; font-size: 14px;
        `;
        
        btn.onclick = () => {
            Array.from(diffContainer.children).forEach(b => {
                b.style.borderColor = '#333';
                b.style.color = '#888';
                b.style.boxShadow = 'none';
            });
            btn.style.borderColor = '#ffd700';
            btn.style.color = 'white';
            btn.style.boxShadow = '0 0 10px #ffd700';
            
            selectedDifficulty = diff;
            updateLeaderboardDisplay(song.id, diff);
        };
        diffContainer.appendChild(btn);
    });

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
        }).catch(e => console.log("Preview autoplay blocked by browser", e));
    });
}

function updateLeaderboardDisplay(songId, difficulty) {
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
        window.gameInstance.loadLevel(selectedSongData, selectedDifficulty); 
    }
};

document.getElementById('back-to-menu-btn').addEventListener('click', () => {
    gameContainer.style.display = 'none';
    menuScreen.style.display = 'flex';
});

// --- SIDEBAR LOGIC ---
const hamburgerBtn = document.getElementById('hamburger-btn');
const sidebar = document.getElementById('sidebar');
const closeSidebar = document.getElementById('close-sidebar');

if (hamburgerBtn && sidebar && closeSidebar) {
    hamburgerBtn.onclick = () => {
        sidebar.classList.add('open');
    };
    closeSidebar.onclick = () => {
        sidebar.classList.remove('open');
    };
}

// --- NEW: ROTATING LEADERBOARD TICKER ---
let rotatingScores = [];
let currentRotationIndex = 0;

function buildRotatingLeaderboard(songs) {
    rotatingScores = []; 
    
    // Scan every song and difficulty for a #1 score
    songs.forEach(song => {
        const diffs = song.difficulties || ["Normal"];
        diffs.forEach(diff => {
            const key = 'leaderboard_' + (song.id || "unknown") + "_" + diff;
            let history = JSON.parse(localStorage.getItem(key)) || [];
            
            if (history.length > 0) {
                history.sort((a,b) => b.score - a.score);
                const champ = history[0]; // Grab the #1 player
                rotatingScores.push({
                    title: song.title,
                    difficulty: diff,
                    player: champ.name,
                    score: champ.score
                });
            }
        });
    });
    
    if (rotatingScores.length > 0) {
        updateRotationDisplay();
        setInterval(updateRotationDisplay, 3500); // Cycles every 3.5 seconds
    }
}

function updateRotationDisplay() {
    if (rotatingScores.length === 0) return;
    const display = document.getElementById('rotating-score');
    if (!display) return;
    
    const data = rotatingScores[currentRotationIndex];
    
    // Inject the champion data with a tiny fade effect
    display.style.opacity = 0;
    setTimeout(() => {
        display.innerHTML = `
            <span style="font-size: 13px; color: #ffd700; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.title} (${data.difficulty})</span>
            <span style="font-size: 18px; color: white; margin: 2px 0;">🏆 ${data.player}</span>
            <span style="font-size: 15px; color: #ff3333; font-weight: bold;">${data.score} pts</span>
        `;
        display.style.opacity = 1;
        display.style.transition = "opacity 0.3s ease";
    }, 300); // Waits 300ms for fade out before changing text
    
    currentRotationIndex++;
    if (currentRotationIndex >= rotatingScores.length) currentRotationIndex = 0;
}
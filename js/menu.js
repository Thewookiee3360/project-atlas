const menuScreen = document.getElementById('menu-screen');
const gameContainer = document.getElementById('game-container');
const songListEl = document.getElementById('song-list');
const playerBtns = document.querySelectorAll('.player-btn');
const currentPlayerEl = document.getElementById('player-name');

const modal = document.getElementById('song-modal');
const closeBtn = document.getElementById('close-modal-btn');
const groovyBtn = document.getElementById('groovy-btn');

// --- Sidebar Variables ---
const sidebar = document.getElementById('sidebar');
const hamburgerBtn = document.getElementById('hamburger-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const rotatingLbContainer = document.getElementById('rotating-leaderboard');

let currentAudioPreview = null;
let previewTimeout = null;
let selectedSongData = null;
let selectedDifficulty = "Normal"; 
let pendingPlayer = null;
let masterSongList = []; 
let rotatingIndex = 0;   

// Default player
window.currentPlayer = "Atlas";
if(currentPlayerEl) currentPlayerEl.innerText = "Atlas";
if(playerBtns[0]) playerBtns[0].classList.add('confirmed');

playerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        if (pendingPlayer === name) {
            playerBtns.forEach(b => { b.classList.remove('selected'); b.classList.remove('confirmed'); });
            btn.classList.add('confirmed'); 
            if(currentPlayerEl) currentPlayerEl.innerText = name;
            window.currentPlayer = name;
            pendingPlayer = null; 
            btn.style.transform = "scale(1.1)";
            setTimeout(() => btn.style.transform = "scale(1)", 200);
        } else {
            playerBtns.forEach(b => { b.classList.remove('selected'); b.classList.remove('confirmed'); });
            btn.classList.add('selected'); 
            pendingPlayer = name;
            if(currentPlayerEl) currentPlayerEl.innerText = "Tap again to confirm " + name + "?";
        }
    });
});

async function initMenu() {
    try {
        const response = await fetch('assets/data/song_list.json');
        if (!response.ok) throw new Error("Could not find song_list.json!");
        
        masterSongList = await response.json();
        if(songListEl) songListEl.innerHTML = ''; 

        masterSongList.forEach(song => {
            const card = document.createElement('div');
            card.className = 'song-card'; 
            
            // --- BULLETPROOF BACKGROUND FIX ---
            if (song.cover && song.cover !== "") {
                card.style.background = `linear-gradient(rgba(10,10,20,0.7), rgba(10,10,20,0.9)), url('assets/images/${song.cover}')`;
            } else {
                card.style.background = `rgba(20, 20, 35, 0.8)`; // Fallback if no cover
            }
            card.style.backgroundSize = "cover";
            card.style.backgroundPosition = "center";

            card.innerHTML = `
                <h3 style="text-shadow: 0 0 5px black;">${song.title}</h3>
                <p style="text-shadow: 0 0 5px black;">${song.artist}</p>
            `;
            
            card.onclick = () => openSongPreview(song);
            if(songListEl) songListEl.appendChild(card);
        });

        // Start the rotating leaderboard safely
        if(rotatingLbContainer) {
            updateRotatingLeaderboard();
            setInterval(updateRotatingLeaderboard, 5000); 
        }

    } catch (err) {
        console.error("Menu Load Error:", err);
        if(songListEl) songListEl.innerHTML = `<p style="color:red">Error loading songs. Check console.</p>`;
    }
}
initMenu();

// --- BULLETPROOF SIDEBAR LOGIC ---
if (hamburgerBtn && sidebar) {
    hamburgerBtn.onclick = () => sidebar.classList.add('open');
}
if (closeSidebarBtn && sidebar) {
    closeSidebarBtn.onclick = () => sidebar.classList.remove('open');
}

function updateRotatingLeaderboard() {
    if (masterSongList.length === 0 || !rotatingLbContainer) return;

    const song = masterSongList[rotatingIndex];
    const diff = song.difficulties ? song.difficulties[0] : "Normal"; 
    const key = 'leaderboard_' + (song.id || song.title) + "_" + diff;
    
    let history = JSON.parse(localStorage.getItem(key)) || [];
    history.sort((a,b) => b.score - a.score);

    let html = `<div class="lb-song-title">${song.title}<br><span style="font-size:12px; color:#aaa;">(${diff})</span></div>`;

    if (history.length === 0) {
        html += `<p style="text-align:center; color:#888;">No scores yet.</p>`;
    } else {
        history.slice(0, 10).forEach((entry, index) => {
            let rankStr = (index + 1) + ".";
            if (index < 3) {
                let medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
                html += `<div class="lb-top3"><span>${medal} ${entry.name}</span><span>${entry.score}</span></div>`;
            } else {
                html += `<div class="lb-others"><span>${rankStr} ${entry.name}</span><span>${entry.score}</span></div>`;
            }
        });
    }

    rotatingLbContainer.innerHTML = html;

    rotatingIndex++;
    if (rotatingIndex >= masterSongList.length) rotatingIndex = 0;
}

// --- MODAL UPDATE ---
function openSongPreview(song) {
    selectedSongData = song;
    
    // --- BULLETPROOF MODAL BACKGROUND ---
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        if (song.cover && song.cover !== "") {
            modalContent.style.background = `linear-gradient(rgba(0,0,0,0.85), rgba(15,0,0,0.95)), url('assets/images/${song.cover}')`;
        } else {
            modalContent.style.background = `#111`;
        }
        modalContent.style.backgroundSize = "cover";
        modalContent.style.backgroundPosition = "center";
    }

    const titleEl = document.getElementById('modal-song-title');
    const artistEl = document.getElementById('modal-song-artist');
    if(titleEl) titleEl.innerText = song.title;
    if(artistEl) artistEl.innerText = song.artist || "Unknown Artist";

    const diffContainer = document.getElementById('difficulty-selectors');
    if (diffContainer) {
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
                    b.style.borderColor = '#333'; b.style.color = '#888'; b.style.boxShadow = 'none';
                });
                btn.style.borderColor = '#ffd700'; btn.style.color = 'white'; btn.style.boxShadow = '0 0 10px #ffd700';
                
                selectedDifficulty = diff;
                updateLeaderboardDisplay(song.id || song.title, diff); 
            };
            diffContainer.appendChild(btn);
        });

        if (diffContainer.firstChild) diffContainer.firstChild.click();
    }

    if(modal) modal.style.display = 'flex';
    stopPreview(); 
    
    if (song.video) {
        const audioUrl = song.video.includes('/') ? song.video : 'assets/video/' + song.video;
        currentAudioPreview = new Audio(audioUrl);
        currentAudioPreview.addEventListener('loadedmetadata', () => {
            currentAudioPreview.currentTime = currentAudioPreview.duration * 0.4;
            currentAudioPreview.play().then(() => {
                previewTimeout = setTimeout(() => {
                    if (currentAudioPreview) currentAudioPreview.pause();
                }, 10000); 
            }).catch(e => console.log("Preview blocked", e));
        });
    }
}

function updateLeaderboardDisplay(songKey, difficulty) {
    const key = 'leaderboard_' + songKey + "_" + difficulty;
    let history = JSON.parse(localStorage.getItem(key)) || [];
    history.sort((a,b) => b.score - a.score); 
    
    let myBest = 0;
    history.forEach(entry => {
        if (entry.name === window.currentPlayer && entry.score > myBest) myBest = entry.score;
    });
    
    const bestEl = document.getElementById('modal-personal-best');
    if(bestEl) bestEl.innerText = myBest;

    const lbList = document.getElementById('modal-leaderboard-list');
    if (lbList) {
        lbList.innerHTML = '';
        if (history.length === 0) {
            lbList.innerHTML = '<li><span style="color:#ffd700;">No scores yet!</span></li>';
        } else {
            history.slice(0, 3).forEach(entry => { 
                lbList.innerHTML += `<li><span style="color:#ffd700; font-weight:bold;">${entry.name}</span><span>${entry.score}</span></li>`;
            });
        }
    }
}

if(closeBtn) {
    closeBtn.onclick = () => { stopPreview(); modal.style.display = 'none'; };
}

if(groovyBtn) {
    groovyBtn.onclick = () => {
        stopPreview(); 
        if(modal) modal.style.display = 'none';
        if(menuScreen) menuScreen.style.display = 'none';
        if(gameContainer) gameContainer.style.display = 'block';
        
        if (window.gameInstance && selectedSongData) {
            window.gameInstance.loadLevel(selectedSongData, selectedDifficulty); 
        }
    };
}

const backBtn = document.getElementById('back-to-menu-btn');
if (backBtn) {
    backBtn.addEventListener('click', () => {
        if(gameContainer) gameContainer.style.display = 'none';
        if(menuScreen) menuScreen.style.display = 'flex';
    });
}

function stopPreview() {
    if (currentAudioPreview) { currentAudioPreview.pause(); currentAudioPreview = null; }
    if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
}
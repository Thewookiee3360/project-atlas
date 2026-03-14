const menuScreen = document.getElementById('menu-screen');
const gameContainer = document.getElementById('game-container');
const songListEl = document.getElementById('song-list');
const playerBtns = document.querySelectorAll('.player-btn');
const currentPlayerEl = document.getElementById('player-name');

const modal = document.getElementById('song-modal');
const closeBtn = document.getElementById('close-modal-btn');
const groovyBtn = document.getElementById('groovy-btn');

// --- NEW: Sidebar Variables ---
const sidebar = document.getElementById('sidebar');
const hamburgerBtn = document.getElementById('hamburger-btn');
const closeSidebarBtn = document.getElementById('close-sidebar-btn');
const rotatingLbContainer = document.getElementById('rotating-leaderboard');

let currentAudioPreview = null;
let previewTimeout = null;
let selectedSongData = null;
let selectedDifficulty = "Normal"; 
let pendingPlayer = null;
let masterSongList = []; // Holds the songs for the rotator
let rotatingIndex = 0;   // Keeps track of which song is showing on the sidebar

// Default player
window.currentPlayer = "Atlas";
currentPlayerEl.innerText = "Atlas";
if(playerBtns[0]) playerBtns[0].classList.add('confirmed');

playerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        if (pendingPlayer === name) {
            playerBtns.forEach(b => { b.classList.remove('selected'); b.classList.remove('confirmed'); });
            btn.classList.add('confirmed'); 
            currentPlayerEl.innerText = name;
            window.currentPlayer = name;
            pendingPlayer = null; 
            btn.style.transform = "scale(1.1)";
            setTimeout(() => btn.style.transform = "scale(1)", 200);
        } else {
            playerBtns.forEach(b => { b.classList.remove('selected'); b.classList.remove('confirmed'); });
            btn.classList.add('selected'); 
            pendingPlayer = name;
            currentPlayerEl.innerText = "Tap again to confirm " + name + "?";
        }
    });
});

async function initMenu() {
    try {
        const response = await fetch('assets/data/song_list.json');
        if (!response.ok) throw new Error("Could not find the file!");
        
        masterSongList = await response.json();
        songListEl.innerHTML = ''; 

        masterSongList.forEach(song => {
            const card = document.createElement('div');
            card.className = 'song-card'; 
            
            // --- NEW: Album Cover Background (With Dark Overlay) ---
            const coverImage = song.cover ? `assets/images/${song.cover}` : ''; 
            card.style.backgroundImage = `linear-gradient(rgba(10,10,20,0.7), rgba(10,10,20,0.9)), url('${coverImage}')`;

            card.innerHTML = `
                <h3 style="text-shadow: 0 0 5px black;">${song.title}</h3>
                <p style="text-shadow: 0 0 5px black;">${song.artist}</p>
            `;
            
            card.onclick = () => openSongPreview(song);
            songListEl.appendChild(card);
        });

        // Start the rotating leaderboard!
        updateRotatingLeaderboard();
        setInterval(updateRotatingLeaderboard, 5000); // Rotates every 5 seconds

    } catch (err) {
        console.error("Menu Load Error:", err);
        songListEl.innerHTML = `<p style="color:red">Error loading songs. Check console.</p>`;
    }
}
initMenu();

// --- NEW: Sidebar Logic ---
hamburgerBtn.onclick = () => sidebar.classList.add('open');
closeSidebarBtn.onclick = () => sidebar.classList.remove('open');

function updateRotatingLeaderboard() {
    if (masterSongList.length === 0) return;

    const song = masterSongList[rotatingIndex];
    const diff = song.difficulties ? song.difficulties[0] : "Normal"; // Uses the first difficulty
    const key = 'leaderboard_' + (song.id || song.title) + "_" + diff;
    
    let history = JSON.parse(localStorage.getItem(key)) || [];
    history.sort((a,b) => b.score - a.score);

    let html = `<div class="lb-song-title">${song.title}<br><span style="font-size:12px; color:#aaa;">(${diff})</span></div>`;

    if (history.length === 0) {
        html += `<p style="text-align:center; color:#888;">No scores yet.</p>`;
    } else {
        // Top 10 Logic
        history.slice(0, 10).forEach((entry, index) => {
            let rankStr = (index + 1) + ".";
            if (index < 3) {
                // Top 3 are big and Gold
                let medal = index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉";
                html += `<div class="lb-top3"><span>${medal} ${entry.name}</span><span>${entry.score}</span></div>`;
            } else {
                // 4th to 10th are smaller
                html += `<div class="lb-others"><span>${rankStr} ${entry.name}</span><span>${entry.score}</span></div>`;
            }
        });
    }

    rotatingLbContainer.innerHTML = html;

    // Move to the next song for next time
    rotatingIndex++;
    if (rotatingIndex >= masterSongList.length) rotatingIndex = 0;
}

// --- MODAL UPDATE ---
function openSongPreview(song) {
    selectedSongData = song;
    
    // --- NEW: Album Cover Background for Modal ---
    const modalContent = document.querySelector('.modal-content');
    const coverImage = song.cover ? `assets/images/${song.cover}` : ''; 
    // Uses a heavily blurred/dark gradient so it looks premium but you can read the stats
    modalContent.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.85), rgba(15,0,0,0.95)), url('${coverImage}')`;

    document.getElementById('modal-song-title').innerText = song.title;
    document.getElementById('modal-song-artist').innerText = song.artist || "Unknown Artist";

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
                b.style.borderColor = '#333'; b.style.color = '#888'; b.style.boxShadow = 'none';
            });
            btn.style.borderColor = '#ffd700'; btn.style.color = 'white'; btn.style.boxShadow = '0 0 10px #ffd700';
            
            selectedDifficulty = diff;
            updateLeaderboardDisplay(song.id || song.title, diff); 
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
        }).catch(e => console.log("Preview blocked", e));
    });
}

function updateLeaderboardDisplay(songKey, difficulty) {
    const key = 'leaderboard_' + songKey + "_" + difficulty;
    let history = JSON.parse(localStorage.getItem(key)) || [];
    history.sort((a,b) => b.score - a.score); 
    
    let myBest = 0;
    history.forEach(entry => {
        if (entry.name === window.currentPlayer && entry.score > myBest) myBest = entry.score;
    });
    document.getElementById('modal-personal-best').innerText = myBest;

    const lbList = document.getElementById('modal-leaderboard-list');
    lbList.innerHTML = '';
    if (history.length === 0) {
        lbList.innerHTML = '<li><span style="color:#ffd700;">No scores yet!</span></li>';
    } else {
        history.slice(0, 3).forEach(entry => { 
            lbList.innerHTML += `<li><span style="color:#ffd700; font-weight:bold;">${entry.name}</span><span>${entry.score}</span></li>`;
        });
    }
}

closeBtn.onclick = () => { stopPreview(); modal.style.display = 'none'; };

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

function stopPreview() {
    if (currentAudioPreview) { currentAudioPreview.pause(); currentAudioPreview = null; }
    if (previewTimeout) { clearTimeout(previewTimeout); previewTimeout = null; }
}
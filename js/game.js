// --- PARTICLE SYSTEM ---
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.color = color;
        this.size = Math.random() * 6 + 2;
        this.speedX = Math.random() * 8 - 4;
        this.speedY = Math.random() * -8 - 2;
        this.life = 1.0;
    }
    update() {
        this.x += this.speedX; this.y += this.speedY;
        this.life -= 0.05; // Fade out
        this.size *= 0.95; // Shrink
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

// --- INPUT HANDLER ---
class InputHandler {
    constructor(laneCount, onDown, onUp) {
        this.laneCount = laneCount;
        this.onDown = onDown;
        this.onUp = onUp;
        
        this.keyMap = { 'a': 0, 'arrowleft': 0, 's': 1, 'arrowdown': 1, 'd': 2, 'arrowright': 2 };
        this.lanes = new Array(laneCount).fill(false);
        
        window.addEventListener('keydown', (e) => {
            const lane = this.keyMap[e.key.toLowerCase()];
            if (lane !== undefined && lane < this.laneCount && !this.lanes[lane]) {
                this.lanes[lane] = true;
                this.onDown(lane);
            }
        });

        window.addEventListener('keyup', (e) => {
            const lane = this.keyMap[e.key.toLowerCase()];
            if (lane !== undefined && lane < this.laneCount) {
                this.lanes[lane] = false;
                this.onUp(lane);
            }
        });
    }
}

// --- GAME CLASS ---
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('bg-video');
        this.startBtn = document.getElementById('start-btn');
        
        this.scoreEl = document.getElementById('score');
        this.comboHud = document.getElementById('combo-hud');
        this.comboCountEl = document.getElementById('combo-count');
        this.multHud = document.getElementById('multiplier-hud');
        this.multValEl = document.getElementById('multiplier-val');
        this.resultsScreen = document.getElementById('results-screen');
        
        this.laneCount = 3; 
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.multiplier = 1;
        this.laneWidth = 0;
        this.laneFlashes = [0, 0, 0]; 
        
        this.particles = []; // Particle Array
        this.isPlaying = false;
        this.currentSongId = "unknown"; // For Leaderboard
        
        this.noteManager = new NoteManager(this);
        this.input = new InputHandler(this.laneCount, (lane) => this.handleInputDown(lane), (lane) => {});

        this.init();
    }

    init() {
        window.addEventListener('resize', () => this.resize());
        this.resize();

        const startGameWrapper = (e) => { e.preventDefault(); this.startGame(); };
        this.startBtn.onclick = startGameWrapper;
        this.startBtn.ontouchstart = startGameWrapper;

        // Unified Touch Support
        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e, true), {passive: false});
        this.canvas.addEventListener('touchend', (e) => this.handleTouch(e, false), {passive: false});
        
        // Unified Mouse Support
        this.canvas.addEventListener('mousedown', (e) => this.handleMouse(e, true));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouse(e, false));
        
        document.getElementById('replay-btn').onclick = () => this.restartGame();
        document.getElementById('menu-btn').onclick = () => this.quitToMenu();
        this.video.onended = () => this.finishGame();

        document.getElementById('back-to-menu-btn').addEventListener('click', () => {
            this.isPlaying = false;
            this.video.pause();
            this.video.currentTime = 0;
        });
    }

    resize() {
        const container = document.getElementById('game-container');
        this.canvas.width = container.clientWidth || Math.min(window.innerWidth, 600);
        this.canvas.height = window.innerHeight;
        this.laneWidth = this.canvas.width / 3;
        if(this.noteManager) this.noteManager.laneWidth = this.laneWidth;
    }

    handleTouch(e, isDown) {
        if(e.target === this.canvas) e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        
        if (!isDown && e.touches.length === 0) this.input.lanes.fill(false); // Reset all if fingers lifted
        
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const relativeX = t.clientX - rect.left;
            
            if (relativeX >= 0 && relativeX <= rect.width) {
                const lane = Math.floor(relativeX / this.laneWidth);
                if (lane >= 0 && lane < this.laneCount) {
                    this.input.lanes[lane] = isDown; // Tell NoteManager the lane is held
                    if (isDown) this.handleInputDown(lane);
                }
            }
        }
    }

    handleMouse(e, isDown) {
        const rect = this.canvas.getBoundingClientRect();
        const relativeX = e.clientX - rect.left;
        if (relativeX >= 0 && relativeX <= rect.width) {
            const lane = Math.floor(relativeX / this.laneWidth);
            if (lane >= 0 && lane < this.laneCount) {
                this.input.lanes[lane] = isDown; // Tell NoteManager the lane is held
                if (isDown) this.handleInputDown(lane);
            }
        }
    }

    handleInputDown(lane) {
        if(!this.isPlaying) return;
        this.laneFlashes[lane] = 1.0; 
        
        const hitResult = this.noteManager.checkHit(lane, this.video.currentTime);
        
        if (hitResult === 'tap') {
            this.registerHit(lane, 100);
        } else if (hitResult === 'hold_start') {
            this.spawnParticles(lane); // Just visuals for starting the hold
        }
    }

    registerHit(lane, points) {
        this.combo++;
        if(this.combo > this.maxCombo) this.maxCombo = this.combo;
        
        this.multiplier = 1 + Math.floor(this.combo/10);
        if (this.multiplier > 4) this.multiplier = 4; 
        
        this.score += points * this.multiplier;
        this.updateHUD();
        this.spawnParticles(lane);

        // --- NEW: Haptic Pop (Success) ---
        // A crisp 40ms vibration feels like a physical button click
        if (navigator.vibrate) {
            navigator.vibrate(40);
        }
    }

    // Called by NoteManager when a hold finishes successfully
    handleHoldComplete(lane) {
        this.registerHit(lane, 200); 
    }

    // Called by NoteManager if user lets go too early
    handleHoldBreak(lane) {
        this.combo = 0;
        this.multiplier = 1;
        this.updateHUD();

        // --- NEW: Haptic Buzz (Combo Broken) ---
        // A longer 100ms buzz so you physically feel the mistake
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
    }
    
    // Called by NoteManager if note falls past screen completely
    handleMiss() {
        this.combo = 0;
        this.multiplier = 1;
        this.updateHUD();

        // --- NEW: Haptic Buzz (Combo Broken) ---
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
    }

    spawnParticles(lane) {
        const x = (lane * this.laneWidth) + (this.laneWidth / 2);
        const y = this.canvas.height * 0.85; // Hit line
        const colors = ['#FF0055', '#00eaff', '#00FF55']; // Match lane colors
        
        for(let i=0; i<15; i++) {
            this.particles.push(new Particle(x, y, colors[lane]));
        }
    }

    updateHUD() {
        this.scoreEl.innerText = "Score: " + this.score;
        this.comboCountEl.innerText = this.combo;
        if (this.multValEl) this.multValEl.innerText = "x" + this.multiplier;
        
        const showHud = this.combo > 1 ? "1" : "0";
        if (this.comboHud) this.comboHud.style.opacity = showHud;
        if (this.multHud) this.multHud.style.opacity = showHud;
    }

    loadLevel(songData) {
        this.currentSongKey = songData.id || songData.title;
        this.currentSongId = songData.id; // Save ID for Leaderboard
        const videoUrl = songData.video.includes('/') ? songData.video : 'assets/video/' + songData.video;
        const dataUrl = songData.data.includes('/') ? songData.data : 'assets/data/' + songData.data;

        this.video.src = videoUrl;
        this.video.muted = true;
        this.video.load();
        
        this.resize();
        
        fetch(dataUrl)
            .then(res => {
                if (!res.ok) throw new Error("Could not find file at: " + dataUrl);
                return res.json();
            })
            .then(data => this.noteManager.loadSong(data))
            .catch(err => console.error("Data Load Error:", err));
        
        this.score = 0; this.combo = 0; this.multiplier = 1; this.particles = [];
        this.updateHUD();
        this.resultsScreen.style.display = 'none';
        this.startBtn.style.display = 'block';
    }

    startGame() {
        this.startBtn.style.display = 'none';
        this.video.muted = false;
        this.video.play().then(() => {
            this.isPlaying = true;
            this.loop();
        }).catch(e => {
            this.video.muted = true;
            this.video.play();
            this.isPlaying = true;
            this.loop();
        });
    }

    loop() {
        if(!this.isPlaying) return;
        this.ctx.clearRect(0,0,this.canvas.width, this.canvas.height);
        
        // Draw Lane Separators
        for(let i=0; i<3; i++) {
            this.ctx.strokeStyle = "rgba(255,255,255,0.1)";
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(i*this.laneWidth, 0, this.laneWidth, this.canvas.height);
        }

        // Draw Gold Hit Targets
        const hitY = this.canvas.height * 0.85; 
        const targetHeight = 60;
        
        for(let i=0; i<3; i++) {
            const opacity = 0.2 + (this.laneFlashes[i] * 0.8); 
            this.ctx.strokeStyle = `rgba(255, 215, 0, ${opacity})`; // Glowing Gold!
            this.ctx.lineWidth = 4 + (this.laneFlashes[i] * 4);
            const w = this.laneWidth * 0.8;
            const x = (i * this.laneWidth) + (this.laneWidth * 0.1);
            this.ctx.strokeRect(x, hitY - (targetHeight/2), w, targetHeight);
            if (this.laneFlashes[i] > 0) this.laneFlashes[i] -= 0.1;
        }
        
        this.noteManager.update(this.video.currentTime);
        this.noteManager.draw(this.ctx);
        
        this.particles.forEach(p => { p.update(); p.draw(this.ctx); });
        this.particles = this.particles.filter(p => p.life > 0);
        
        requestAnimationFrame(() => this.loop());
    }

    finishGame() {
        this.isPlaying = false;
        
        // --- LEADERBOARD SAVE LOGIC FIX ---
        const playerName = window.currentPlayer || "Atlas";
        const key = 'leaderboard_' + this.currentSongKey; // Now perfectly matches the song!
        
        let hist = JSON.parse(localStorage.getItem(key)) || [];
        hist.push({ name: playerName, score: this.score, combo: this.maxCombo });
        hist.sort((a,b) => b.score - a.score);
        localStorage.setItem(key, JSON.stringify(hist.slice(0, 5))); 
        
        document.getElementById('final-score-val').innerText = this.score;
        document.getElementById('final-combo-val').innerText = this.maxCombo;
        this.resultsScreen.style.display = 'flex';
    }

    restartGame() {
        this.resultsScreen.style.display = 'none';
        this.startGame();
    }

    quitToMenu() {
        this.isPlaying = false;
        this.resultsScreen.style.display = 'none';
        document.getElementById('back-to-menu-btn').click();
    }
}

window.onload = () => { window.gameInstance = new Game(); };
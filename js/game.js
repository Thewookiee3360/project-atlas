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
        this.life -= 0.05; 
        this.size *= 0.95; 
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

// --- NEW: FLOATING TEXT SYSTEM ---
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.speedY = -1.5; // Drift upwards slowly
    }
    update() {
        this.y += this.speedY;
        this.life -= 0.03; // Fade out quickly
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        // Cool arcade font styling
        ctx.font = "bold 32px 'Rajdhani', sans-serif";
        ctx.textAlign = "center";
        
        // Add a black outline so it's readable over bright video backgrounds
        ctx.strokeStyle = "black";
        ctx.lineWidth = 4;
        ctx.strokeText(this.text, this.x, this.y);
        ctx.fillText(this.text, this.x, this.y);
        
        ctx.restore();
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
        
        this.particles = []; 
        this.floatingTexts = []; // Array to hold the accuracy pop-ups
        this.isPlaying = false;
        
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

        this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e, true), {passive: false});
        this.canvas.addEventListener('touchend', (e) => this.handleTouch(e, false), {passive: false});
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
        
        if (!isDown && e.touches.length === 0) this.input.lanes.fill(false); 
        
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const relativeX = t.clientX - rect.left;
            
            if (relativeX >= 0 && relativeX <= rect.width) {
                const lane = Math.floor(relativeX / this.laneWidth);
                if (lane >= 0 && lane < this.laneCount) {
                    this.input.lanes[lane] = isDown; 
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
                this.input.lanes[lane] = isDown; 
                if (isDown) this.handleInputDown(lane);
            }
        }
    }

    handleInputDown(lane) {
        if(!this.isPlaying) return;
        this.laneFlashes[lane] = 1.0; 
        
        const hitResult = this.noteManager.checkHit(lane, this.video.currentTime);
        
        if (hitResult) {
            // hitResult is now an object: { type, accuracy, points }
            this.registerHit(lane, hitResult.points, hitResult.accuracy);
        }
    }

    registerHit(lane, points, accuracyText) {
        this.combo++;
        if(this.combo > this.maxCombo) this.maxCombo = this.combo;
        
        this.multiplier = 1 + Math.floor(this.combo/10);
        if (this.multiplier > 4) this.multiplier = 4; 
        
        this.score += points * this.multiplier;
        this.updateHUD();
        this.spawnParticles(lane);

        // Determine Text Color based on Accuracy
        let textColor = "#00eaff"; // Cyan for GOOD
        if (accuracyText === "PERFECT") textColor = "#ffd700"; // Gold
        if (accuracyText === "GREAT") textColor = "#00FF55"; // Green

        this.spawnFloatingText(lane, accuracyText, textColor);

        if (navigator.vibrate) navigator.vibrate(40);
    }

    handleHoldComplete(lane) {
        // Holding successfully to the end is always a PERFECT 100 points
        this.registerHit(lane, 100, "PERFECT"); 
    }

    handleHoldBreak(lane) {
        this.combo = 0;
        this.multiplier = 1;
        this.updateHUD();
        this.spawnFloatingText(lane, "MISS", "#ff3333"); // Red Miss
        if (navigator.vibrate) navigator.vibrate(100);
    }
    
    // Now requires 'lane' parameter so it knows where to draw the MISS text
    handleMiss(lane) {
        this.combo = 0;
        this.multiplier = 1;
        this.updateHUD();
        
        // Failsafe: if lane is somehow undefined, draw it in the middle
        const targetLane = lane !== undefined ? lane : 1;
        this.spawnFloatingText(targetLane, "MISS", "#ff3333"); // Red Miss
        
        if (navigator.vibrate) navigator.vibrate(100);
    }

    spawnParticles(lane) {
        const x = (lane * this.laneWidth) + (this.laneWidth / 2);
        const y = this.canvas.height * 0.82; 
        const colors = ['#FF0055', '#00eaff', '#00FF55']; 
        
        for(let i=0; i<15; i++) {
            this.particles.push(new Particle(x, y, colors[lane]));
        }
    }

    // --- NEW: Helper function to spawn the text ---
    spawnFloatingText(lane, text, color) {
        const x = (lane * this.laneWidth) + (this.laneWidth / 2);
        const y = this.canvas.height * 0.78; // Spawn just slightly above the hit line
        this.floatingTexts.push(new FloatingText(x, y, text, color));
    }

    updateHUD() {
        this.scoreEl.innerText = "Score: " + this.score;
        this.comboCountEl.innerText = this.combo;
        if (this.multValEl) this.multValEl.innerText = "x" + this.multiplier;
        
        const showHud = this.combo > 1 ? "1" : "0";
        if (this.comboHud) this.comboHud.style.opacity = showHud;
        if (this.multHud) this.multHud.style.opacity = showHud;
    }

    loadLevel(songData, difficulty) {
        this.currentSongKey = (songData.id || songData.title) + "_" + difficulty; 

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
            .then(data => {
                let levelData = [];
                if (data[difficulty]) levelData = data[difficulty]; 
                else levelData = data; 
                this.noteManager.loadSong(levelData);
            })
            .catch(err => console.error("Data Load Error:", err));
        
        // Reset everything, including the text array
        this.score = 0; this.combo = 0; this.multiplier = 1; 
        this.particles = []; this.floatingTexts = [];
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
        
        for(let i=0; i<3; i++) {
            this.ctx.strokeStyle = "rgba(255,255,255,0.1)";
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(i*this.laneWidth, 0, this.laneWidth, this.canvas.height);
        }

        const hitY = this.canvas.height * 0.82; 
        const targetHeight = 60;
        
        for(let i=0; i<3; i++) {
            const opacity = 0.2 + (this.laneFlashes[i] * 0.8); 
            this.ctx.strokeStyle = `rgba(255, 215, 0, ${opacity})`; 
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

        // --- NEW: Draw the floating accuracy texts ---
        this.floatingTexts.forEach(t => { t.update(); t.draw(this.ctx); });
        this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);
        
        requestAnimationFrame(() => this.loop());
    }

    finishGame() {
        this.isPlaying = false;
        
        const playerName = window.currentPlayer || "Atlas";
        const key = 'leaderboard_' + this.currentSongKey; 
        
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
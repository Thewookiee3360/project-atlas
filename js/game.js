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

// --- FLOATING TEXT SYSTEM ---
class FloatingText {
    constructor(x, y, text, color) {
        this.x = x; this.y = y; this.text = text || "GOOD"; 
        this.color = color; this.life = 1.0; this.speedY = -1.5; 
        this.scale = 1.6;   
    }
    update() {
        this.y += this.speedY; this.life -= 0.03; 
        if (this.scale > 1.0) this.scale -= 0.1; 
    }
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.textAlign = "center";
        ctx.strokeStyle = "black"; ctx.lineWidth = 4;
        ctx.translate(this.x, this.y); ctx.scale(this.scale, this.scale);
        ctx.font = "bold 32px 'Rajdhani', sans-serif";
        ctx.strokeText(this.text, 0, 0); ctx.fillText(this.text, 0, 0);
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
            if (e.repeat) return; 
            const lane = this.keyMap[e.key.toLowerCase()];
            if (lane !== undefined && lane < this.laneCount && !this.lanes[lane]) {
                this.lanes[lane] = true; this.onDown(lane);
            }
        });

        window.addEventListener('keyup', (e) => {
            const lane = this.keyMap[e.key.toLowerCase()];
            if (lane !== undefined && lane < this.laneCount) {
                this.lanes[lane] = false; this.onUp(lane);
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
        this.score = 0; this.combo = 0; this.maxCombo = 0; this.multiplier = 1;
        this.laneWidth = 0; this.laneFlashes = [0, 0, 0]; 
        
        this.particles = []; this.floatingTexts = []; 
        this.stats = { perfect: 0, great: 0, good: 0, miss: 0 }; 
        this.isPlaying = false;

        // --- SILENT BACKGROUND RECORDER ---
        this.recordedNotes = [];
        this.pendingHolds = {};
        
        this.noteManager = new NoteManager(this);
        
        this.input = new InputHandler(this.laneCount, 
            (lane) => this.handleInputDown(lane), 
            (lane) => this.handleInputUp(lane)
        );

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
        
        if (!isDown && e.touches.length === 0) {
            for (let i = 0; i < this.laneCount; i++) {
                if (this.input.lanes[i]) {
                    this.input.lanes[i] = false;
                    this.handleInputUp(i);
                }
            }
        } 
        
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            const relativeX = t.clientX - rect.left;
            
            if (relativeX >= 0 && relativeX <= rect.width) {
                const lane = Math.floor(relativeX / this.laneWidth);
                if (lane >= 0 && lane < this.laneCount) {
                    if (isDown) {
                        if (!this.input.lanes[lane]) {
                            this.input.lanes[lane] = true;
                            this.handleInputDown(lane);
                        }
                    } else {
                        if (this.input.lanes[lane]) {
                            this.input.lanes[lane] = false;
                            this.handleInputUp(lane);
                        }
                    }
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
                if (isDown) {
                    if (!this.input.lanes[lane]) {
                        this.input.lanes[lane] = true;
                        this.handleInputDown(lane);
                    }
                } else {
                    if (this.input.lanes[lane]) {
                        this.input.lanes[lane] = false;
                        this.handleInputUp(lane);
                    }
                }
            }
        }
    }

    handleInputDown(lane) {
        if(!this.isPlaying) return;
        this.laneFlashes[lane] = 1.0; 
        
        // --- ALWAYS RECORD THE TAP ---
        this.pendingHolds[lane] = this.video.currentTime; 

        // Let the game play normally!
        const hitResult = this.noteManager.checkHit(lane, this.video.currentTime);
        if (hitResult) {
            this.registerHit(lane, hitResult.points, hitResult.accuracy);
        } else {
            // Still spawn particles so you can see your taps while recording empty lanes
            this.spawnParticles(lane); 
        }
    }

    handleInputUp(lane) {
        // --- ALWAYS RECORD THE LIFT OFF ---
        if (this.pendingHolds[lane] !== undefined) {
            const startTime = this.pendingHolds[lane];
            const duration = this.video.currentTime - startTime;
            
            let note = { time: parseFloat(startTime.toFixed(2)), lane: lane };
            
            // Only counts as a hold note if held longer than 0.35 seconds
            if (duration > 0.35) {
                note.duration = parseFloat(duration.toFixed(2));
            }
            
            this.recordedNotes.push(note);
            delete this.pendingHolds[lane];
        }
    }

    registerHit(lane, points, accuracyText) {
        if (accuracyText === "PERFECT") this.stats.perfect++;
        else if (accuracyText === "GREAT") this.stats.great++;
        else if (accuracyText === "GOOD") this.stats.good++;

        this.combo++;
        if(this.combo > this.maxCombo) this.maxCombo = this.combo;
        
        this.multiplier = 1 + Math.floor(this.combo/10);
        if (this.multiplier > 4) this.multiplier = 4; 
        
        this.score += points * this.multiplier;
        this.updateHUD();
        this.spawnParticles(lane);

        let textColor = "#00eaff"; 
        if (accuracyText === "PERFECT") textColor = "#ffd700"; 
        if (accuracyText === "GREAT") textColor = "#00FF55"; 

        this.spawnFloatingText(lane, accuracyText, textColor);
        if (navigator.vibrate) navigator.vibrate(40);
    }

    handleHoldComplete(lane) {
        this.registerHit(lane, 100, "PERFECT"); 
    }

    handleHoldBreak(lane) {
        this.stats.miss++; 
        this.combo = 0; this.multiplier = 1; this.updateHUD();
        this.spawnFloatingText(lane, "MISS", "#ff3333"); 
        if (navigator.vibrate) navigator.vibrate(100);
    }
    
    handleMiss(lane) {
        this.stats.miss++; 
        this.combo = 0; this.multiplier = 1; this.updateHUD();
        const targetLane = lane !== undefined ? lane : 1;
        this.spawnFloatingText(targetLane, "MISS", "#ff3333"); 
        if (navigator.vibrate) navigator.vibrate(100);
    }

    spawnParticles(lane) {
        const x = (lane * this.laneWidth) + (this.laneWidth / 2);
        const y = this.canvas.height * 0.82; 
        const colors = ['#FF0055', '#00eaff', '#00FF55']; 
        for(let i=0; i<15; i++) { this.particles.push(new Particle(x, y, colors[lane])); }
    }

    spawnFloatingText(lane, text, color) {
        const x = (lane * this.laneWidth) + (this.laneWidth / 2);
        const y = this.canvas.height * 0.78; 
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

        this.video.src = videoUrl; this.video.muted = true; this.video.load();
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
        
        this.score = 0; this.combo = 0; this.multiplier = 1; 
        this.particles = []; this.floatingTexts = [];
        this.stats = { perfect: 0, great: 0, good: 0, miss: 0 }; 
        
        // --- CLEARS PREVIOUS RECORDING ---
        this.recordedNotes = []; 
        this.pendingHolds = {};
        
        this.updateHUD();
        this.resultsScreen.style.display = 'none';
        this.startBtn.style.display = 'block';
    }

    startGame() {
        this.startBtn.style.display = 'none';
        this.video.muted = false;
        this.video.play().then(() => {
            this.isPlaying = true; this.loop();
        }).catch(e => {
            this.video.muted = true; this.video.play();
            this.isPlaying = true; this.loop();
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

        this.floatingTexts.forEach(t => { t.update(); t.draw(this.ctx); });
        this.floatingTexts = this.floatingTexts.filter(t => t.life > 0);
        
        requestAnimationFrame(() => this.loop());
    }

    finishGame() {
        this.isPlaying = false;
        
        const cheerAudio = new Audio('assets/audio/cheer.mp3'); 
        cheerAudio.play().catch(e => console.log("Cheer blocked by browser", e));

        const playerName = window.currentPlayer || "Atlas";
        const key = 'leaderboard_' + this.currentSongKey; 
        
        let hist = JSON.parse(localStorage.getItem(key)) || [];
        hist.push({ name: playerName, score: this.score, combo: this.maxCombo });
       
        hist.sort((a,b) => b.score - a.score);
        localStorage.setItem(key, JSON.stringify(hist.slice(0, 5))); 
        
        document.getElementById('final-score-val').innerText = this.score;
        document.getElementById('final-combo-val').innerText = this.maxCombo;

        const totalNotes = this.stats.perfect + this.stats.great + this.stats.good + this.stats.miss;
        let percent = 0;
        if (totalNotes > 0) {
            percent = ((this.stats.perfect * 100) + (this.stats.great * 80) + (this.stats.good * 50)) / totalNotes;
        }

        let grade = "F"; let color = "#ff3333"; 
        if (percent >= 95) { grade = "S"; color = "#ffd700"; }      
        else if (percent >= 85) { grade = "A"; color = "#00FF55"; } 
        else if (percent >= 75) { grade = "B"; color = "#00eaff"; } 
        else if (percent >= 60) { grade = "C"; color = "#ff8c00"; } 
        else if (percent >= 50) { grade = "D"; color = "#aaaaaa"; } 

        const gradeDisplay = document.getElementById('final-grade-display');
        gradeDisplay.innerText = grade;
        gradeDisplay.style.color = color;
        gradeDisplay.style.textShadow = `0 0 30px ${color}`;

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
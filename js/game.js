class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('bg-video');
        this.startBtn = document.getElementById('start-btn');
        this.scoreEl = document.getElementById('score');
        
        // HUD Elements
        this.comboHud = document.getElementById('combo-hud');
        this.comboCountEl = document.getElementById('combo-count');
        this.multHud = document.getElementById('multiplier-hud');
        this.multValEl = document.getElementById('multiplier-val');

        // UI Elements
        this.resultsScreen = document.getElementById('results-screen');
        this.finalScoreEl = document.getElementById('final-score-val');
        this.finalComboEl = document.getElementById('final-combo-val');
        this.replayBtn = document.getElementById('replay-btn');
        this.menuBtn = document.getElementById('menu-btn');
        this.cheerSfx = document.getElementById('cheer-sfx');

        this.laneCount = 3;
        this.score = 0;
        this.combo = 0; 
        this.maxCombo = 0; 
        this.multiplier = 1;
        this.currentSongId = "";

        this.isPlaying = false;
        this.lastTime = 0;
        
        // --- RECORDING STATE ---
        this.isRecording = false; 
        this.recordedNotes = []; 
        this.activeHolds = {}; 

        this.particles = []; 
        this.noteManager = new NoteManager(this);
        
        this.input = new InputHandler(
            this.laneCount, 
            (lane) => this.handleInputDown(lane), 
            (lane) => this.handleInputUp(lane)
        );

        this.init();
    }

    init() {
        window.addEventListener('resize', () => this.resize());
        this.resize();
        this.startBtn.addEventListener('click', () => this.startGame());

        this.replayBtn.addEventListener('click', () => this.restartGame());
        this.menuBtn.addEventListener('click', () => this.quitToMenu());
        
        this.video.addEventListener('ended', () => this.finishGame());
    }

    // --- INPUT HANDLING (PRESS) ---
    handleInputDown(lane) {
        if (!this.isPlaying) return;
        const currentTime = this.video.currentTime;

        // 1. RECORDING LOGIC
        if (this.isRecording) {
            this.activeHolds[lane] = currentTime;
            this.spawnExplosion(lane);
            return;
        }

        // 2. GAME LOGIC (TAP)
        if (this.noteManager.checkHit(lane, currentTime)) {
            this.combo++; 
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;

            this.multiplier = 1 + Math.floor(this.combo / 10);
            if (this.multiplier > 4) this.multiplier = 4;

            this.score += 100 * this.multiplier;
            this.updateHUD();
            this.spawnExplosion(lane);
        }
    }

    // --- INPUT HANDLING (RELEASE) ---
    handleInputUp(lane) {
        if (!this.isPlaying || !this.isRecording) return;
        
        const startTime = this.activeHolds[lane];
        if (startTime !== undefined) {
            const endTime = this.video.currentTime;
            let duration = endTime - startTime;
            if (duration < 0.15) duration = 0;

            const note = {
                time: Number(startTime.toFixed(2)),
                lane: lane,
                type: duration > 0 ? "hold" : "tap",
                duration: Number(duration.toFixed(2))
            };
            
            this.recordedNotes.push(note);
            console.log(`Recorded: ${note.type} (Dur: ${note.duration}s)`);
            delete this.activeHolds[lane];
        }
    }

    updateHUD() {
        this.scoreEl.innerText = "Score: " + this.score;
        this.comboCountEl.innerText = this.combo;
        this.multValEl.innerText = this.multiplier;

        this.comboHud.style.opacity = this.combo > 1 ? "1" : "0";
        this.multHud.style.opacity = this.multiplier > 1 ? "1" : "0";

        this.comboHud.classList.remove('pulse-active');
        void this.comboHud.offsetWidth; 
        this.comboHud.classList.add('pulse-active');
    }

    // --- STANDARD GAME METHODS ---
    loadLevel(songData) {
        this.currentSongId = songData.id;
        this.video.src = songData.video;
        this.video.load();

        // FIX: Changed from resizeCanvas() to resize()
        this.resize(); 
        
        // FIX: Removed the "Ghost Code" that forced 4 lanes here
        
        if(this.noteManager.loadSong) {
            this.noteManager.loadSong(songData.data);
        }
        
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.multiplier = 1;
        this.scoreEl.innerText = "Score: 0";
        this.updateHUD();
        
        this.resultsScreen.style.display = 'none';
        this.startBtn.style.display = 'block';
        this.startBtn.innerText = "TAP TO START";
        
        // Double check size
        setTimeout(() => this.resize(), 50);
    }

    finishGame() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        
        if (this.isRecording) {
            console.log("Recording Finished!");
            alert("Recording Done! Check Console.");
            return;
        }

        this.cheerSfx.currentTime = 0;
        this.cheerSfx.play().catch(e => console.log("Audio play failed"));

        const playerName = window.currentPlayer || "Guest";
        const storageKey = 'leaderboard_' + this.currentSongId;
        let history = JSON.parse(localStorage.getItem(storageKey)) || [];
        
        history.push({
            name: playerName,
            score: this.score,
            combo: this.maxCombo,
            date: new Date().toISOString()
        });

        history.sort((a, b) => b.score - a.score);
        history = history.slice(0, 5);
        localStorage.setItem(storageKey, JSON.stringify(history));

        this.finalScoreEl.innerText = this.score;
        if(this.finalComboEl) this.finalComboEl.innerText = this.maxCombo;
        
        const listEl = document.getElementById('leaderboard-list');
        if (listEl) {
            listEl.innerHTML = history.map((entry, index) => `
                <li>
                    <span class="rank">#${index + 1}</span>
                    <span class="p-name">${entry.name}</span>
                    <span class="p-score">${entry.score}</span>
                </li>
            `).join('');
        }

        this.resultsScreen.style.display = 'flex';
    }

    restartGame() {
        this.resultsScreen.style.display = 'none';
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.multiplier = 1;
        this.updateHUD();
        this.startGame();
    }

    quitToMenu() {
        this.stopGame();
        this.resultsScreen.style.display = 'none';
        document.getElementById('back-to-menu-btn').click();
    }

    stopGame() {
        this.isPlaying = false;
        this.video.pause();
        this.video.currentTime = 0;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    resize() {
        // Safe resize calculation
        const container = this.canvas.parentElement;
        if (container) {
            const rect = container.getBoundingClientRect();
            // Only update if the container actually has size
            if (rect.width > 0 && rect.height > 0) {
                this.canvas.width = rect.width;
                this.canvas.height = rect.height;
                this.laneWidth = this.canvas.width / this.laneCount;
            }
        }
    }

    startGame() {
        // Ensure size is correct right before playing
        this.resize();
        
        const playPromise = this.video.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                this.startBtn.style.display = 'none';
                this.isPlaying = true;
                this.lastTime = performance.now();
                requestAnimationFrame((ts) => this.gameLoop(ts));
            }).catch(error => console.error("Play prevented:", error));
        }
    }

    spawnExplosion(lane) {
        const x = (lane * this.laneWidth) + (this.laneWidth / 2);
        const y = this.canvas.height * 0.85; 
        for (let i = 0; i < 20; i++) {
            const colors = ['#00eaff', '#FFFFFF', '#FF0099']; 
            const color = colors[Math.floor(Math.random() * colors.length)];
            this.particles.push(new Particle(x, y, color));
        }
    }

    update(deltaTime) {
        if (this.isPlaying) {
            if (!this.isRecording) {
                this.noteManager.update(this.video.currentTime);
            }
            
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.update();
                if (p.life <= 0) this.particles.splice(i, 1);
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw Lanes
        for (let i = 0; i < this.laneCount; i++) {
            if (this.input.lanes[i]) {
                this.ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
                this.ctx.fillRect(i * this.laneWidth, 0, this.laneWidth, this.canvas.height);
            }
        }

        // Draw Hit Line
        const hitLineY = this.canvas.height * 0.85;
        this.ctx.beginPath();
        this.ctx.moveTo(0, hitLineY);
        this.ctx.lineTo(this.canvas.width, hitLineY);
        this.ctx.strokeStyle = this.isRecording ? 'red' : 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        if (!this.isRecording) {
            this.noteManager.draw(this.ctx);
        }
        this.particles.forEach(p => p.draw(this.ctx));
    }

    gameLoop(timestamp) {
        if (!this.isPlaying) return;
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        this.update(deltaTime);
        this.draw();
        requestAnimationFrame((ts) => this.gameLoop(ts));
    }
}

window.onload = () => {
    window.gameInstance = new Game();
};
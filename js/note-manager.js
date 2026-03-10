class NoteManager {
    constructor(game) {
        this.game = game;
        this.notes = [];       
        this.activeNotes = []; 
        this.laneWidth = 0;    
        
        this.noteSpeed = 2.0; 
        this.hitLineY = 0.85; 
    }

    loadSong(songData) {
        let extractedNotes = [];
        if (Array.isArray(songData)) extractedNotes = songData;
        else if (songData && Array.isArray(songData.notes)) extractedNotes = songData.notes; 
        else if (songData && Array.isArray(songData.data)) extractedNotes = songData.data; 

        this.notes = JSON.parse(JSON.stringify(extractedNotes));
        this.activeNotes = [];
    }

    update(currentTime) {
        if (!this.notes) return;

        const spawnWindow = currentTime + this.noteSpeed;
        
        for (let i = 0; i < this.notes.length; i++) {
            const note = this.notes[i];
            if (note.time <= spawnWindow) {
                this.activeNotes.push(note);
                this.notes.splice(i, 1);
                i--; 
            }
        }

        for (let i = this.activeNotes.length - 1; i >= 0; i--) {
            const note = this.activeNotes[i];
            
            // --- HOLD NOTE LOGIC ---
            if (note.isHeld) {
                note.y = this.game.canvas.height * this.hitLineY;
                
                if (currentTime >= note.time + note.duration) {
                    this.activeNotes.splice(i, 1);
                    if(this.game.handleHoldComplete) this.game.handleHoldComplete(note.lane);
                } else if (!this.game.input.lanes[note.lane]) {
                    this.activeNotes.splice(i, 1);
                    if(this.game.handleHoldBreak) this.game.handleHoldBreak(note.lane);
                }
            } else {
                // --- NORMAL FALLING LOGIC ---
                const timeUntilHit = note.time - currentTime;
                const progress = 1 - (timeUntilHit / this.noteSpeed);
                note.y = (progress * this.game.canvas.height * this.hitLineY);

                let holdDelay = (note.duration || 0) > 0 ? (note.duration / this.noteSpeed) * this.game.canvas.height : 0;

                if (note.y > this.game.canvas.height + 100 + holdDelay) {
                    this.activeNotes.splice(i, 1);
                    if(this.game.handleMiss) this.game.handleMiss(); 
                }
            }
        }
    }

    checkHit(lane, currentTime) {
        const hitWindow = 0.30; 

        for (let i = 0; i < this.activeNotes.length; i++) {
            const note = this.activeNotes[i];

            if (note.lane === lane && !note.isHeld) {
                const timeDiff = Math.abs(note.time - currentTime);
                
                if (timeDiff <= hitWindow) {
                    if (note.duration && note.duration > 0) {
                        note.isHeld = true;
                        return 'hold_start';
                    } else {
                        this.activeNotes.splice(i, 1);
                        return 'tap';
                    }
                }
            }
        }
        return false;
    }

    // --- DRAWING SECTION (SEMI-TRANSPARENT & LESS BRIGHT) ---
    draw(ctx) {
        if (!this.game.laneWidth) return; 
        const laneWidth = this.game.laneWidth;
        
        this.activeNotes.forEach(note => {
            const x = (note.lane * laneWidth) + (laneWidth / 2);
            const y = note.y;
            // Get the new semi-transparent rgba color
            const baseColor = this.getNoteColor(note.lane);

            const w = laneWidth * 0.7; 
            let h = 50; 
            
            if (note.duration && note.duration > 0) {
                if (note.isHeld) {
                    const remainingTime = (note.time + note.duration) - this.game.video.currentTime;
                    h = (remainingTime / this.noteSpeed) * (ctx.canvas.height * this.hitLineY);
                } else {
                    h = (note.duration / this.noteSpeed) * (ctx.canvas.height * this.hitLineY);
                }
            }
            if (isNaN(h) || h < 50) h = 50;

            ctx.save(); 

            // 1. The Glow (Reduced intensity)
            ctx.shadowBlur = 10; // Reduced from 20 for less brightness
            ctx.shadowColor = baseColor; // The glow itself is now semi-transparent too
            ctx.fillStyle = baseColor;

            const drawX = x - (w / 2);
            const drawY = y - h;
            const radius = 12;

            // 2. Draw Rounded Body (Semi-transparent fill)
            this.drawRoundedPath(ctx, drawX, drawY, w, h, radius);
            ctx.fill();

            // 3. Draw White Border (Kept opaque for definition)
            ctx.lineWidth = 2; // Slightly thinner border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.drawRoundedPath(ctx, drawX, drawY, w, h, radius);
            ctx.stroke();

            // 4. Draw "Hold Line" Stream (Toned down brightness)
            if (h > 60) { 
                ctx.beginPath();
                ctx.moveTo(x, drawY + radius); 
                ctx.lineTo(x, y - radius);     
                ctx.lineWidth = 4;
                // Toned down from 0.9 opacity to 0.5
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; 
                ctx.shadowBlur = 5; // Reduced glow on the center line
                ctx.shadowColor = 'white'; 
                ctx.stroke();
            }

            ctx.restore(); 
        });
    }

    // Helper function for rounded rectangles
    drawRoundedPath(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    getNoteColor(lane) {
        // CHANGED to RGBA for 60% opacity (semi-transparent)
        const colors = [
            'rgba(255, 0, 85, 0.6)',  // Pink
            'rgba(0, 234, 255, 0.6)', // Cyan
            'rgba(0, 255, 85, 0.6)'   // Green
        ]; 
        return colors[lane] || 'rgba(255, 255, 255, 0.6)';
    }
}
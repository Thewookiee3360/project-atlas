class NoteManager {
    constructor(game) {
        this.game = game;
        this.notes = [];       
        this.activeNotes = []; 
        this.laneWidth = 0;    
        
        this.noteSpeed = 2.0; 
        this.hitLineY = 0.82; 
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
            
            if (note.isHeld) {
                note.y = this.game.canvas.height * this.hitLineY;
                
                if (currentTime >= note.time + note.duration) {
                    this.activeNotes.splice(i, 1);
                    if(this.game.handleHoldComplete) this.game.handleHoldComplete(note.lane);
                } else if (!this.game.input.lanes[note.lane]) {
                    this.activeNotes.splice(i, 1);
                    // Tell the game exactly which lane we let go of early!
                    if(this.game.handleHoldBreak) this.game.handleHoldBreak(note.lane); 
                }
            } else {
                const timeUntilHit = note.time - currentTime;
                const progress = 1 - (timeUntilHit / this.noteSpeed);
                note.y = (progress * this.game.canvas.height * this.hitLineY);

                let holdDelay = (note.duration || 0) > 0 ? (note.duration / this.noteSpeed) * this.game.canvas.height : 0;

                if (note.y > this.game.canvas.height + 100 + holdDelay) {
                    this.activeNotes.splice(i, 1);
                    // Tell the game exactly which lane we missed!
                    if(this.game.handleMiss) this.game.handleMiss(note.lane); 
                }
            }
        }
    }

    checkHit(lane, currentTime) {
        const hitWindow = 0.20; // 200ms is the maximum window to get a "GOOD"

        for (let i = 0; i < this.activeNotes.length; i++) {
            const note = this.activeNotes[i];

            if (note.lane === lane && !note.isHeld) {
                const timeDiff = Math.abs(note.time - currentTime);
                
                if (timeDiff <= hitWindow) {
                    
                    // --- THE NEW ACCURACY MATH ---
                    let accuracy = "GOOD";
                    let points = 50;
                    
                    if (timeDiff <= 0.05) { 
                        accuracy = "PERFECT"; 
                        points = 100; 
                    } else if (timeDiff <= 0.12) { 
                        accuracy = "GREAT"; 
                        points = 75; 
                    }

                    if (note.duration && note.duration > 0) {
                        note.isHeld = true;
                        return { type: 'hold_start', accuracy: accuracy, points: points };
                    } else {
                        this.activeNotes.splice(i, 1);
                        return { type: 'tap', accuracy: accuracy, points: points };
                    }
                }
            }
        }
        return false; // Nothing hit
    }

    draw(ctx) {
        if (!this.game.laneWidth) return; 
        const laneWidth = this.game.laneWidth;
        
        this.activeNotes.forEach(note => {
            const x = (note.lane * laneWidth) + (laneWidth / 2);
            const y = note.y;
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
            ctx.shadowBlur = 10; 
            ctx.shadowColor = baseColor; 
            ctx.fillStyle = baseColor;

            const drawX = x - (w / 2);
            const drawY = y - h;
            const radius = 12;

            this.drawRoundedPath(ctx, drawX, drawY, w, h, radius);
            ctx.fill();

            ctx.lineWidth = 2; 
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            this.drawRoundedPath(ctx, drawX, drawY, w, h, radius);
            ctx.stroke();

            if (h > 60) { 
                ctx.beginPath();
                ctx.moveTo(x, drawY + radius); 
                ctx.lineTo(x, y - radius);     
                ctx.lineWidth = 4;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; 
                ctx.shadowBlur = 5; 
                ctx.shadowColor = 'white'; 
                ctx.stroke();
            }
            ctx.restore(); 
        });
    }

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
        const colors = [
            'rgba(255, 51, 51, 0.6)',   
            'rgba(255, 215, 0, 0.6)',   
            'rgba(255, 140, 0, 0.6)'    
        ]; 
        return colors[lane] || 'rgba(255, 215, 0, 0.6)';
    }
}
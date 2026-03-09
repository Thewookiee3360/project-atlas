class NoteManager {
    constructor(game) {
        this.game = game;
        this.notes = [];
        this.activeNotes = [];
        
        this.approachTime = 1.5; 
        this.nextNoteIndex = 0;
        this.hitWindow = 0.3; // 300ms window
    }

    async loadSong(url) {
        try {
            const response = await fetch(url);
            const data = await response.json();
            this.notes = data.notes.sort((a, b) => a.time - b.time);
            console.log("Song loaded:", data.title);
        } catch (err) {
            console.error("Failed to load song:", err);
        }
    }

    update(songTime) {
        // 1. SPAWN NOTES
        while (this.nextNoteIndex < this.notes.length) {
            const noteData = this.notes[this.nextNoteIndex];
            if (songTime + this.approachTime >= noteData.time) {
                this.spawnNote(noteData);
                this.nextNoteIndex++;
            } else {
                break;
            }
        }

        // 2. UPDATE ACTIVE NOTES
        for (let i = this.activeNotes.length - 1; i >= 0; i--) {
            const note = this.activeNotes[i];
            const endTime = note.time + (note.duration || 0);

            // --- HOLD LOGIC START ---
            if (note.isHolding) {
                // Check if user is STILL holding the lane?
                if (this.game.input.lanes[note.lane]) {
                    // YES: They are holding.
                    // Add Score continuously (every frame)
                    this.game.score += 1; 
                    this.game.scoreEl.innerText = "Score: " + this.game.score;
                    
                    // Spawn Sparks continuously
                    if (Math.random() > 0.5) { // 50% chance per frame to save performance
                        this.game.spawnExplosion(note.lane); 
                    }

                    // Check if the hold is finished
                    if (songTime >= endTime) {
                        // DONE!
                        this.activeNotes.splice(i, 1);
                        this.game.combo++; // Extra combo for finishing
                        console.log("Hold Complete!");
                    }
                } else {
                    // NO: They let go early!
                    note.isHolding = false;
                    console.log("Dropped Hold!");
                    // It becomes a normal falling note again (and will likely miss)
                }
            }
            // --- HOLD LOGIC END ---

            // Cleanup: If the END of the note has passed the hit window + buffer, remove it
            if (songTime > endTime + this.hitWindow) {
                this.activeNotes.splice(i, 1);
                // Reset combo if it wasn't a completed hold
                if (!note.isHolding) {
                    this.game.combo = 0;
                }
            }
        }
    }

    spawnNote(noteData) {
        this.activeNotes.push({
            time: noteData.time,
            lane: noteData.lane,
            type: noteData.type,
            duration: noteData.duration || 0,
            isHolding: false // New flag to track state
        });
    }

    checkHit(lane, songTime) {
        for (let i = 0; i < this.activeNotes.length; i++) {
            const note = this.activeNotes[i];

            if (note.lane === lane && !note.isHolding) {
                // Check collision with the HEAD of the note
                const timeDiff = Math.abs(note.time - songTime);

                if (timeDiff <= this.hitWindow) {
                    // HIT!
                    if (note.duration > 0) {
                        // It's a Hold Note -> Enable Holding Mode
                        note.isHolding = true;
                        return true; // Return true to trigger the initial "Bang"
                    } else {
                        // Normal Note -> Remove immediately
                        this.activeNotes.splice(i, 1);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    draw(ctx) {
        const currentSongTime = this.game.video.currentTime;
        const laneWidth = this.game.laneWidth;
        const hitLineY = this.game.canvas.height * 0.85;
        const speed = hitLineY / this.approachTime;

        this.activeNotes.forEach(note => {
            let y, tailLength;

            // VISUAL LOGIC: Is it being held?
            if (note.isHolding) {
                // PIN TO BOTTOM: The head stays at the hit line
                y = hitLineY;
                
                // TAIL SHRINKS: Calculate how much time is left
                const endTime = note.time + note.duration;
                const timeLeft = endTime - currentSongTime;
                tailLength = timeLeft * speed;
                
            } else {
                // FALLING NORMALLY
                const timeUntilHit = note.time - currentSongTime;
                y = hitLineY - (speed * timeUntilHit);
                
                // Tail is constant length
                tailLength = note.duration * speed;
            }

            const x = note.lane * laneWidth;
            const padding = 8;
            const noteHeight = 40;
            const cornerRadius = 10;

            // 1. DRAW TAIL (If it exists)
            if (tailLength > 0) {
                ctx.save();
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = note.isHolding ? '#FFFFFF' : '#00eaff'; // White if holding, Blue if falling
                
                const tailX = x + padding + 10;
                const tailWidth = laneWidth - (padding * 2) - 20;
                
                // Draw Upwards from Y
                ctx.fillRect(tailX, y - tailLength, tailWidth, tailLength);
                ctx.restore();
            }

            // 2. DRAW HEAD
            ctx.save();
            ctx.shadowBlur = 20;
            ctx.shadowColor = note.isHolding ? '#FFFFFF' : '#00eaff'; // Glow white if holding
            
            const grad = ctx.createLinearGradient(x, y - (noteHeight/2), x, y + (noteHeight/2));
            grad.addColorStop(0, '#00eaff');
            grad.addColorStop(1, '#008c99');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.roundRect(x + padding, y - (noteHeight/2), laneWidth - (padding*2), noteHeight, cornerRadius);
            ctx.fill();

            // Highlight
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.beginPath();
            ctx.roundRect(x + padding + 5, y - (noteHeight/2) + 5, laneWidth - (padding*2) - 10, noteHeight/2 - 5, cornerRadius);
            ctx.fill();

            ctx.restore();
        });
    }
}
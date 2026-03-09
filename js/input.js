class InputHandler {
    // UPDATED: Now accepts onPress AND onRelease
    constructor(laneCount, onPressCallback, onReleaseCallback) {
        this.laneCount = laneCount;
        this.onPress = onPressCallback;
        this.onRelease = onReleaseCallback; // New callback
        this.lanes = new Array(laneCount).fill(false);
        this.setupListeners();
    }

    triggerPress(lane) {
        if (this.onPress) this.onPress(lane);
    }

    triggerRelease(lane) {
        if (this.onRelease) this.onRelease(lane);
    }

    setupListeners() {
        // --- 1. KEYBOARD ---
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            const lane = this.getLaneFromKey(e.key);
            if (lane !== -1) {
                e.preventDefault();
                this.lanes[lane] = true;
                this.triggerPress(lane);
            }
        });

        window.addEventListener('keyup', (e) => {
            const lane = this.getLaneFromKey(e.key);
            if (lane !== -1) {
                e.preventDefault();
                this.lanes[lane] = false;
                this.triggerRelease(lane); // Trigger Release
            }
        });

        // --- 2. TOUCH ---
        const handleTouch = (e, isDown) => {
            // FIX: Allow buttons to be clicked!
            if (e.target.closest('button') || e.target.closest('.song-card') || e.target.id === 'search-input') {
                return; 
            }
            if(e.cancelable) e.preventDefault();

            const touches = e.changedTouches;
            for (let i = 0; i < touches.length; i++) {
                const touch = touches[i];
                const lane = this.getLaneFromX(touch.clientX);
                if (lane !== -1) {
                    if (isDown) {
                        if (!this.lanes[lane]) this.triggerPress(lane);
                    } else {
                        this.triggerRelease(lane); // Trigger Release
                    }
                    this.lanes[lane] = isDown;
                }
            }
        };

        document.addEventListener('touchstart', (e) => handleTouch(e, true), { passive: false });
        document.addEventListener('touchend', (e) => handleTouch(e, false));
        document.addEventListener('touchcancel', (e) => handleTouch(e, false));
        
        // --- 3. MOUSE ---
        document.addEventListener('mousedown', (e) => {
            if (e.target.closest('button') || e.target.closest('.song-card')) return;
            const lane = this.getLaneFromX(e.clientX);
            if (lane !== -1) {
                this.lanes[lane] = true;
                this.triggerPress(lane);
            }
        });

        document.addEventListener('mouseup', (e) => {
            // Find which lane was released (if any)
            this.lanes.forEach((held, lane) => {
                if (held) this.triggerRelease(lane);
            });
            this.lanes.fill(false);
        });
    }

    getLaneFromKey(key) {
        const k = key.toLowerCase();
        if (k === 'd' || k === '1' || k === 'arrowleft') return 0; 
        if (k === 'f' || k === '2' || k === ' ' || k === 'arrowdown' || k === 's') return 1; 
        if (k === 'j' || k === '3' || k === 'arrowright') return 2; 
        return -1; 
    }

    getLaneFromX(x) {
        const laneWidth = window.innerWidth / this.laneCount;
        const lane = Math.floor(x / laneWidth);
        if (lane >= 0 && lane < this.laneCount) return lane;
        return -1;
    }
}
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        
        // Random direction (0 to 360 degrees)
        const angle = Math.random() * Math.PI * 2;
        // Random speed
        const speed = Math.random() * 5 + 2;
        
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.life = 1.0; // Start fully visible
        this.decay = Math.random() * 0.03 + 0.02; // How fast it fades
        this.size = Math.random() * 5 + 3; // Random size
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        
        // Gravity (particles fall down slightly)
        this.vy += 0.2; 
        
        // Fade out
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life); // Prevent negative alpha
        ctx.fillStyle = this.color;
        
        // Draw a circle
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}
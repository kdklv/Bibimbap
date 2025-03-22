class RippleSystem {
    constructor() {
        this.ripples = [];
        this.velocityThreshold = 0.5; // Minimum velocity to create ripples
    }

    createRipple(x, y, speed, particleRadius = 15, particleVelocity = { x: 0, y: 0 }) {
        // Calculate total velocity magnitude
        const velocityMagnitude = Math.sqrt(particleVelocity.x ** 2 + particleVelocity.y ** 2);
        
        // Skip ripple creation if velocity is below threshold
        if (velocityMagnitude < this.velocityThreshold) {
            return;
        }

        const adjustedSpeed = speed * 8;
        
        // For collision ripples, make them bigger than the particle
        const rippleSize = speed > 0.5 ? particleRadius * 3 : particleRadius * 0.8;
        
        // Main ripple
        this.ripples.push(new Ripple(x, y, adjustedSpeed, rippleSize));
        
        // Secondary ripples for bigger impacts
        if (speed > 0.5) {
            for (let i = 0; i < 3; i++) {
                const offset = random(-15, 15);
                this.ripples.push(new Ripple(
                    x + offset,
                    y + offset,
                    adjustedSpeed * 0.8,
                    rippleSize * 0.8
                ));
            }
        }
    }

    update() {
        // Update and draw all ripples
        push();
        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const ripple = this.ripples[i];
            if (!ripple.update()) {
                this.ripples.splice(i, 1);
                continue;
            }
            ripple.draw();
        }
        pop();
    }
}

let rippleSystem;

function setupP5() {
    rippleSystem = new RippleSystem();
    // Currently empty, but good to have for future p5-specific setup
}

function createParticle(x, y) {
    if (x < 0 || x > width || y < 0 || y > height) {
        return;
    }

    const radius = random(10, 20);
    const particleOptions = { 
        restitution: bounciness, 
        friction: 0.001, 
        frictionAir: 0.001, 
        density: 0.01, 
        collisionFilter: { category: 0x0002 } 
    };
    const particle = Matter.Bodies.circle(x, y, radius, particleOptions);

    // Simplified particle properties
    particle.circleRadius = radius;
    particle.hue = random(100);
    particle.lastObstacleId = null;
    particle.soundType = floor(random(4));
    particle.noteOffset = floor(random(scales[currentScale].length));
    particle.originalRadius = radius;
    particle.isShrinking = false;
    particle.shrinkRate = 0.97;
    particle.trail = [];
    particle.maxTrailLength = 20; // Increased trail length
    particle.glowSize = random(1.2, 1.8);
    particle.pulseSpeed = random(0.02, 0.05);
    particle.pulsePhase = random(TWO_PI);

    Matter.Body.setVelocity(particle, { x: random(-2, 2), y: random(-1, 1) });
    Matter.Composite.add(world, particle);
    particles.push(particle);

    if (particles.length > 20) {
        Matter.Composite.remove(world, particles[0]);
        particles.shift();
    }

    if (audioInitialized) {
        playParticleSound(particle, scales[currentScale][particle.noteOffset], 0.5);
    }

    rippleSystem.createRipple(
        particle.position.x,
        particle.position.y,
        random(0.1, 1), // Example speed
        particle.circleRadius,
        particle.velocity
    );
}

function createVisualEffect(x, y, hue) {
    visualEffects.push({
        x: x,
        y: y,
        radius: 5,
        hue: hue,
        alpha: 1,
        growRate: random(2, 4),
    });
}

function updateVisualEffects() {
    for (let i = visualEffects.length - 1; i >= 0; i--) {
        let effect = visualEffects[i];
        noStroke();
        fill(effect.hue, 80, 95, effect.alpha);
        ellipse(effect.x, effect.y, effect.radius * 2);
        effect.radius += effect.growRate;
        effect.alpha -= 0.05;
        if (effect.alpha <= 0) {
            visualEffects.splice(i, 1);
        }
    }

    // Update particle trails
    particles.forEach(particle => {
        particle.trail.unshift({x: particle.position.x, y: particle.position.y});
        if (particle.trail.length > particle.maxTrailLength) {
            particle.trail.pop();
        }
    });
}

// Add new function to draw all elements
function drawPinballElements() {
    // Underwater effect
    drawWaterEffect();
    
    // Draw plankton-like bumpers
    bumpers.forEach(bumper => {
        push();
        // Organic movement
        let wobble = sin(frameCount * 0.05 + bumper.id) * 3;
        

        
        // Main body with tentacles
        stroke(180, 70, 100);
        strokeWeight(2);
        for(let i = 0; i < 8; i++) {
            let angle = i * TWO_PI/8 + frameCount * 0.02;
            let len = 15 + sin(frameCount * 0.1 + i) * 5;
            line(bumper.position.x, bumper.position.y + wobble,
                 bumper.position.x + cos(angle) * len,
                 bumper.position.y + wobble + sin(angle) * len);
        }
        
        fill(180, 80, 90);
        noStroke();
        circle(bumper.position.x, bumper.position.y + wobble, 
               bumper.circleRadius * 2);
        pop();
    });

    // Draw seaweed-like leaves with simpler structure
    leaves.forEach(leaf => {
        if (!leaf || !leaf.body) return;

        push();
        translate(leaf.body.position.x, leaf.body.position.y);
        rotate(leaf.body.angle);
        
        // Glowing effect
        let wobble = sin(frameCount * 0.03) * 0.1;
        
        // Draw multiple layers for glow
        for(let i = 2; i > 0; i--) {
            noStroke();
            fill(120, 80, 90, 0.1);
            rect(-LEAF_LENGTH/2, -LEAF_THICKNESS/2,
                 LEAF_LENGTH, LEAF_THICKNESS * (1 + i * 0.2), 4);
        }
        
        // Main leaf body
        fill(120, 70, 90);
        noStroke();
        rect(-LEAF_LENGTH/2, -LEAF_THICKNESS/2, 
             LEAF_LENGTH, LEAF_THICKNESS, 4);

        // Draw anchor point
        translate(-LEAF_LENGTH/2, 0);
        fill(120, 40, 60);
        circle(0, 0, 8);
        
        pop();
    });
}

class Ripple {
    constructor(x, y, speed, baseSize) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = baseSize * map(speed, 0.1, 0.5, 12, 20); // Increased max size
        this.speed = map(speed, 0.1, 0.5, 3, 6);
        this.alpha = 0.6; // Reduced initial opacity
        this.thickness = map(speed, 0.1, 0.5, 1, 4);
        this.rings = speed > 0.3 ? 3 : 2;
        this.startTime = frameCount; // Store creation time
    }

    update() {
        // Only start growing after a few frames
        if (frameCount >= this.startTime + 2) {
            this.radius += this.speed;
            
            // Make opacity drop faster at the start, then slower
            this.alpha = map(this.radius, 0, this.maxRadius, 0.6, 0);
            this.alpha = pow(this.alpha, 2.5); // Steeper fade curve
            
            // Increase ring size as it spreads
            this.thickness = map(this.radius, 0, this.maxRadius, this.thickness, this.thickness * 0.3);
        }
        return this.radius <= this.maxRadius;
    }

    draw() {
        push();
        noFill();
        for (let i = 0; i < this.rings; i++) {
            const ringRadius = this.radius - (i * 15);
            if (ringRadius > 0) {
                const ringAlpha = this.alpha * (1 - i * 0.4) * 0.2; // Reduced ring opacity
                stroke(200, 70, 100, ringAlpha);
                strokeWeight(this.thickness * (1 - i * 0.2));
                circle(this.x, this.y, ringRadius * 2.5);
                
                stroke(200, 20, 100, ringAlpha * 0.1); // Subtle outer glow
                strokeWeight(this.thickness * 0.3);
                circle(this.x, this.y, ringRadius * 2.7);
            }
        }
        pop();
    }
}

function drawWaterEffect() {
    push();
    // Draw caustics first (background layer)
    noStroke();
    for(let i = 0; i < 5; i++) {
        let x = (noise(frameCount * 0.01 + i * 1000) * width);
        let y = (noise(frameCount * 0.01 + i * 2000) * height);
        let size = noise(frameCount * 0.02 + i) * 100 + 50;
        fill(200, 30, 100, 0.05);
        circle(x, y, size);
    }
    
    // Update and draw ripples on top
    rippleSystem.update();
    pop();
}
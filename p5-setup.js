function setupP5() {
    // Currently empty, but good to have for future p5-specific setup
}

function createParticle(x, y) {
    if (x < 0 || x > width || y < 0 || y > height) {
        return;
    }

    const radius = random(10, 20);
    const hue = random(100);
    const particleOptions = { restitution: bounciness, friction: 0.001, frictionAir: 0.001, density: 0.01, collisionFilter: { category: 0x0002 } };
    const particle = Matter.Bodies.circle(x, y, radius, particleOptions);

    particle.circleRadius = radius;
    particle.hue = hue;
    particle.lastObstacleId = null;
    particle.soundType = floor(random(4));
    particle.noteOffset = floor(random(scales[currentScale].length));
    particle.originalRadius = radius;
    particle.isShrinking = false;
    particle.shrinkRate = 0.97;

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
}
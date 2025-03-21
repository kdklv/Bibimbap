
// Matter.js Engine and World (now in a separate file)
let engine;
let world;

function setupMatter() {
    engine = Matter.Engine.create();
    world = engine.world;
    world.gravity.y = 0.2;  // Initial gravity
    createWalls();
     // Set up collision events
    Matter.Events.on(engine, "collisionStart", handleCollisions);
}


function createWalls() {
    const wallThickness = 30;
    const wallOptions = { isStatic: true, restitution: 0.8, friction: 0.005 };

    let bottomWall = Matter.Bodies.rectangle(width / 2, height + wallThickness / 2, width + wallThickness * 2, wallThickness, wallOptions);
    let topWall = Matter.Bodies.rectangle(width / 2, -wallThickness / 2, width + wallThickness * 2, wallThickness, wallOptions);
    let leftWall = Matter.Bodies.trapezoid(-wallThickness / 2, height / 2, wallThickness, height, 0.2, wallOptions);
    let rightWall = Matter.Bodies.trapezoid(width + wallThickness / 2, height / 2, wallThickness, height, -0.2, wallOptions);

    walls = [bottomWall, topWall, leftWall, rightWall];
    Matter.Composite.add(world, walls);
}


function createRandomObstacles(count) {
    for (let obstacle of obstacles) {
        Matter.Composite.remove(world, obstacle);
    }
    obstacles = [];

    for (let i = 0; i < count; i++) {
        let x = random(50, width - 50);
        let y = random(50, height - 50);
        let type = floor(random(3));
        let obstacle;
        const obstacleOptions = { isStatic: true, restitution: bounciness, friction: 0.001, chamfer: { radius: 2 } };

        if (type === 0) {
            let radius = random(15, 40);
            obstacle = Matter.Bodies.circle(x, y, radius, obstacleOptions);
            obstacle.circleRadius = radius;
        } else if (type === 1) {
            let size = random(25, 60);
            obstacle = Matter.Bodies.polygon(x, y, 3, size, obstacleOptions);
        } else {
            let w = random(20, 80);
            let h = random(10, 30);
            obstacle = Matter.Bodies.rectangle(x, y, w, h, obstacleOptions);
            Matter.Body.rotate(obstacle, random(PI));
        }
        obstacles.push(obstacle);
        Matter.Composite.add(world, obstacle);
    }
}


function handleCollisions(event) {
    const pairs = event.pairs;
    const now = Tone.now();

    for (let pair of pairs) {
        let bodyA = pair.bodyA;
        let bodyB = pair.bodyB;
        let particle, other;

        if (particles.includes(bodyA)) {
            particle = bodyA;
            other = bodyB;
        } else if (particles.includes(bodyB)) {
            particle = bodyB;
            other = bodyA;
        } else {
            continue;
        }

        if (other.id === particle.lastObstacleId) {
            continue;
        }

        if (!particle.lastSoundTime || now - particle.lastSoundTime >= MIN_SOUND_INTERVAL)
        {
            particle.lastSoundTime = now;
            particle.lastObstacleId = other.id;

            const speed = Matter.Vector.magnitude(particle.velocity);
            const volume = map(speed, 0, 10, 0.1, 1);

            createVisualEffect(pair.collision.supports[0].x, pair.collision.supports[0].y, particle.hue);

            let scaleNotes = scales[currentScale];
            let noteIndex = (floor((other.position.y / height) * scaleNotes.length) + particle.noteOffset) % scaleNotes.length;
            let note = scaleNotes[noteIndex];

            if (walls.includes(other)) {
                playParticleSound(particle, note, volume, 3);
            } else if (obstacles.includes(other)) {
                playParticleSound(particle, note, volume, particle.soundType);
                const angle = random(TWO_PI);
                const force = random(0.001, 0.005);
                Matter.Body.applyForce(particle, particle.position, { x: cos(angle) * force, y: sin(angle) * force });
            }
        }
    }
}

function clearAll() {
    for (let particle of particles) {
        Matter.Composite.remove(world, particle);
    }
    particles = [];
    visualEffects = []; // Clear visual effects
    createRandomObstacles(15); // Reset obstacles
}

function updateAllBounciness(value) {
    obstacles.forEach(obstacle => { obstacle.restitution = value; Matter.Body.set(obstacle, "restitution", value); });
    particles.forEach(particle => { particle.restitution = value; Matter.Body.set(particle, "restitution", value); });
    walls.forEach(wall => { wall.restitution = value; Matter.Body.set(wall, "restitution", value); });
    Matter.Engine.update(engine);
}
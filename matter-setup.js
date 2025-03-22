// Matter.js Engine and World (now in a separate file)
let engine;
let world;

// Add new global variables
let springs = [];
let bumpers = [];
let leaves = [];
const BUMPER_FORCE = 0.015;
const SPRING_FORCE = 0.02;
const LEAF_LENGTH = 120;
const LEAF_THICKNESS = 4;

function setupMatter() {
    engine = Matter.Engine.create();
    world = engine.world;
    world.gravity.y = 0.2;  // Initial gravity
    createWalls();
    createPinballElements();
    createLeaves();
     // Set up collision events
    Matter.Events.on(engine, "collisionStart", handleCollisions);
}

function resetScene() {
    clearAll();
    createWalls();  // Re-create walls first
    createRandomObstacles(15);
    createPinballElements();
    createLeaves();
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

class Obstacle {
    constructor(type, body, properties = {}) {
        this.type = type;
        this.body = body;
        this.isMovable = properties.isMovable ?? true;
        this.isRotatable = properties.isRotatable ?? true;
        this.color = properties.color || color(200);
        this.restitution = properties.restitution || bounciness;
        this.friction = properties.friction || 0.001;
        
        // Type-specific properties
        switch (type) {
            case 'circle':
            case 'bumper':
                this.radius = properties.radius;
                break;
            case 'polygon':
                this.sides = properties.sides;
                this.size = properties.size;
                break;
            case 'rectangle':
                this.width = properties.width;
                this.height = properties.height;
                break;
            case 'spring':
            case 'leaf':
                this.components = properties.components;
                this.handlePosition = properties.handlePosition || { x: 0, y: 0 };
                this.handleOrientation = properties.handleOrientation || 0;
                this.leafLength = properties.leafLength || LEAF_LENGTH;
                break;
        }
    }
}

function createObstacle(type, x, y, properties = {}) {
    const baseOptions = {
        isStatic: properties.isStatic ?? true,
        restitution: properties.restitution || bounciness,
        friction: properties.friction || 0.001,
        chamfer: { radius: 2 }
    };

    let body;
    let obstacleProps = { ...properties };

    switch (type) {
        case 'circle':
            body = Matter.Bodies.circle(x, y, properties.radius, baseOptions);
            break;
        case 'bumper':
            baseOptions.restitution = 1.5;
            body = Matter.Bodies.circle(x, y, properties.radius, {
                ...baseOptions,
                plugin: { type: 'bumper' }
            });
            break;
        case 'polygon':
            body = Matter.Bodies.polygon(x, y, properties.sides, properties.size, baseOptions);
            break;
        case 'rectangle':
            body = Matter.Bodies.rectangle(x, y, properties.width, properties.height, baseOptions);
            break;
        // Spring and leaf creation handled separately due to composite nature
    }

    if (body) {
        const obstacle = new Obstacle(type, body, obstacleProps);
        obstacles.push(obstacle);
        Matter.Composite.add(world, body);
        return obstacle;
    }
    return null;
}

function createRandomObstacles(count) {
    const reducedCount = Math.floor(count * 0.6);
    for (let i = 0; i < reducedCount; i++) {
        let x = random(50, width - 50);
        let y = random(50, height - 50);
        let type = floor(random(3));
        
        if (type === 0) {
            createObstacle('circle', x, y, {
                radius: random(15, 40)
            });
        } else if (type === 1) {
            createObstacle('polygon', x, y, {
                sides: 3,
                size: random(25, 60)
            });
        } else {
            let obstacle = createObstacle('rectangle', x, y, {
                width: random(30, 80),
                height: random(30, 80)
            });
            if (obstacle) {
                Matter.Body.rotate(obstacle.body, random(PI));
            }
        }
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

        const speed = Matter.Vector.magnitude(particle.velocity);

        // Lower threshold for ripple creation (was 0.5)
        if (speed > 0.1) {
            particle.lastSoundTime = now;
            particle.lastObstacleId = other.id;

            // Get collision point from Matter.js
            const collision = pair.collision;
            const collisionPoint = collision.supports[0] || {
                x: (bodyA.position.x + bodyB.position.x) / 2,
                y: (bodyA.position.y + bodyB.position.y) / 2
            };

            // Amplify speed for more visible ripples
            const amplifiedSpeed = speed * 2;
            rippleSystem.createRipple(collisionPoint.x, collisionPoint.y, amplifiedSpeed);

            // ...rest of collision handling...
        }
    }
}

function clearAll() {
    // Clear particles
    particles.forEach(particle => {
        Matter.Composite.remove(world, particle);
    });
    particles = [];
    
    // Clear obstacles
    obstacles.forEach(obstacle => {
        Matter.Composite.remove(world, obstacle.body);
    });
    obstacles = [];
    
    // Clear bumpers
    bumpers.forEach(bumper => {
        Matter.Composite.remove(world, bumper);
    });
    bumpers = [];
    
    // Clear springs
    springs.forEach(spring => {
        Matter.Composite.remove(world, [spring.base, spring.top, spring.constraint]);
    });
    springs = [];
    
    // Clear leaves
    leaves.forEach(leaf => {
        Matter.Composite.remove(world, leaf.body);
    });
    leaves = [];
    
    // Clear visual effects
    visualEffects = [];
}

function updateAllBounciness(value) {
    obstacles.forEach(obstacle => { obstacle.restitution = value; Matter.Body.set(obstacle, "restitution", value); });
    particles.forEach(particle => { particle.restitution = value; Matter.Body.set(particle, "restitution", value); });
    walls.forEach(wall => { wall.restitution = value; Matter.Body.set(wall, "restitution", value); });
    Matter.Engine.update(engine);
}

function createPinballElements() {
    // Create bumpers
    for (let i = 0; i < 3; i++) {
        createObstacle('bumper', 
            random(width * 0.2, width * 0.8),
            random(height * 0.2, height * 0.6),
            {
                radius: 25,
                color: color(255, 0, 0)
            }
        );
    }

    // Springs remain unchanged for now due to composite nature
    const springBase = Matter.Bodies.rectangle(width * 0.85, height - 60, 40, 10, { isStatic: true });
    const springTop = Matter.Bodies.rectangle(width * 0.85, height - 90, 30, 20, {
        restitution: 1.5,
        density: 0.1
    });
    
    const spring = Matter.Constraint.create({
        bodyA: springBase,
        bodyB: springTop,
        stiffness: 0.1,
        damping: 0.1,
        length: 30
    });

    springs.push({ base: springBase, top: springTop, constraint: spring });
    Matter.Composite.add(world, [springBase, springTop, spring]);
    Matter.Composite.add(world, bumpers);
}

function createLeaves() {
    const leafCount = 5;
    const spacing = width / (leafCount + 1);
    
    for (let i = 0; i < leafCount; i++) {
        const pivotX = spacing * (i + 1);
        const pivotY = height * 0.6;
        const initialAngle = 0;
        
        // Create leaf body with center offset from pivot
        const leafCenterX = pivotX + cos(initialAngle) * (LEAF_LENGTH/2);
        const leafCenterY = pivotY + sin(initialAngle) * (LEAF_LENGTH/2);
        
        const leaf = Matter.Bodies.rectangle(leafCenterX, leafCenterY, LEAF_LENGTH, LEAF_THICKNESS, {
            isStatic: true,
            angle: initialAngle,
            restitution: 0.8,
            friction: 0.1,
            plugin: { type: 'leaf' }
        });

        const leafObstacle = new Obstacle('leaf', leaf, {
            handlePosition: { x: pivotX, y: pivotY },
            handleOrientation: initialAngle,
            leafLength: LEAF_LENGTH,
            components: { leaf }
        });
        
        obstacles.push(leafObstacle);
        leaves.push({ body: leaf, pivot: { x: pivotX, y: pivotY } });
        Matter.Composite.add(world, leaf);
    }
}
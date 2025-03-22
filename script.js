// Global Variables (used across multiple files)
let particles = [];
let obstacles = [];
let walls = [];
let activeSounds = {};
let showObstacles = true;
let bounciness = 0.8;
let selectedObstacle = null;
let isDraggingObstacle = false;
let lastClickTime = 0;
let floorY;
let audioInitialized = false;
let lastSoundTime = 0;
const MIN_SOUND_INTERVAL = 0.03; // Reduced from 0.05 to allow more frequent sounds

let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let dragOffset = { x: 0, y: 0 };

let canvasWidth, canvasHeight;
let currentScale = "pentatonic";

// Visual effects
let visualEffects = [];
let obstacleColors = [];

// Add to global variables
let gameMode = 'play';
const HANDLE_SIZE = 10;
const HANDLE_DISTANCE = {
    leaf: 50,  // Increased from 30
    triangle: 80  // Increased from obstacle.size
};
let selectedHandle = null; // 'position' or 'orientation'

function setup() {
  // Set up canvas dimensions
  canvasWidth = min(windowWidth * 0.9, 800);
  canvasHeight = min(windowHeight * 0.8, 800);

  let canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent("container");
  canvas.style('pointer-events', 'none');

  canvas.mousePressed(() => {
    if (!mouseOverUI()) {
      canvas.style('pointer-events', 'auto');
    }
  });

  canvas.mouseReleased(() => {
    canvas.style('pointer-events', 'none');
  });

  // Initialize Matter.js (call setup function)
  setupMatter();
    // Initialize Tone.js
  setupTone();
  // Initialize p5.js
  setupP5();

    // Start Matter.js engine
    Matter.Runner.run(engine);

  // Initialize event listeners for UI
  document.getElementById("clear-button").addEventListener("click", resetScene);
  document.getElementById("scale-select").addEventListener("change", (e) => {
    currentScale = e.target.value;
  });
  document.getElementById("gravity-slider").addEventListener("input", (e) => {
    const value = parseFloat(e.target.value);
    engine.world.gravity.y = value;
  });
  document.getElementById("bounce-slider").addEventListener("input", (e) => {
    bounciness = parseFloat(e.target.value);
    updateAllBounciness(bounciness);
  });

  // Initialize colors
  colorMode(HSB, 100);

  // Start audio context on first user interaction (moved here)
  document.addEventListener('click', initAudio, { once: true });

  // Generate random colors for obstacles
  for (let i = 0; i < 100; i++) {
    obstacleColors.push(color(random(100), 70, 80));
  }

  // Store floor Y position for particle shrinking
  floorY = height + 15; // middle of bottom wall

  // Remove old event listener and add new initialization (moved here)
  const overlay = document.getElementById('loading-overlay');
  overlay.addEventListener('click', async () => {
    await initAudio();
    overlay.style.display = 'none';
  });

  // UI event listeners and initializations (moved here)
  const scaleSelect = document.getElementById("scale-select");
  const gravitySlider = document.getElementById("gravity-slider");
  const bounceSlider = document.getElementById("bounce-slider");
  const gravityValue = document.querySelector("#gravity-slider + .slider-value");
  const bounceValue = document.querySelector("#bounce-slider + .slider-value");

  scaleSelect.addEventListener("change", function (e) {
    currentScale = e.target.value;
  });

  gravitySlider.addEventListener("input", function (e) {
    const value = parseFloat(e.target.value);
    engine.world.gravity.y = value;
    gravityValue.textContent = value.toFixed(2);
    Matter.Engine.update(engine); // Force update
  });

  bounceSlider.addEventListener("input", function (e) {
    const value = parseFloat(e.target.value);
    bounciness = value;
    updateAllBounciness(value);
    bounceValue.textContent = value.toFixed(2);
  });

  gravityValue.textContent = gravitySlider.value;
  bounceValue.textContent = bounceSlider.value;

  createWalls(width, height);      // Now called AFTER p5.js setup
  createRandomObstacles(15, width, height); // Pass width and height

  // Add mode toggle listener
  document.getElementById('mode-toggle').addEventListener('change', (e) => {
    gameMode = e.target.checked ? 'edit' : 'play';
    // Update cursor style
    document.body.style.cursor = gameMode === 'edit' ? 'move' : 'crosshair';
    // Clear selected obstacle when switching modes
    if (gameMode === 'play') {
        selectedObstacle = null;
        isDraggingObstacle = false;
    }
  });
}

function draw() {
  background(200, 70, 10); // Deep blue background

  drawWaterEffect();
  
  // Draw walls
  stroke(40, 40, 100);
  strokeWeight(2);
  noFill();
  walls.forEach((wall) => {
    beginShape();
    wall.vertices.forEach((v) => {
      vertex(v.x, v.y);
    });
    endShape(CLOSE);
  });

  // Draw obstacles
  if (showObstacles) {
    obstacles.forEach((obstacle, i) => {
      push();
      if (obstacle === selectedObstacle) {
        stroke(255, 255, 0);
        strokeWeight(2);
      } else if (obstacle.type === 'bumper') {
        stroke(80, 80, 100);
        strokeWeight(3);
      } else {
        noStroke();
      }

      // Set different fill for bumpers
      if (obstacle.type === 'bumper') {
        fill(obstacleColors[i % obstacleColors.length], 0.6); // Semi-transparent
      } else {
        fill(obstacleColors[i % obstacleColors.length]);
      }

      beginShape();
      obstacle.body.vertices.forEach((v) => {
        vertex(v.x, v.y);
      });
      endShape(CLOSE);
      pop();
    });
  }

  // Add this line to draw pinball elements
  drawPinballElements();

  // Update particle drawing with velocity-based effects
  particles.forEach((particle, i) => {
    // Draw trail with length based on velocity
    const speed = Matter.Vector.magnitude(particle.velocity);
    const trailLength = Math.min(particle.trail.length, Math.floor(speed * 3));
    
    for(let index = 0; index < trailLength; index++) {
      let pos = particle.trail[index];
      let alpha = map(index, 0, trailLength, 0.5, 0);
      fill(particle.hue, 90, 100, alpha);
      let size = map(index, 0, trailLength, 
                    particle.circleRadius * 2, particle.circleRadius * 0.5);
      circle(pos.x, pos.y, size);
    }

    // Single glow effect based on speed
    const glowSize = map(speed, 0, 10, 1, 1.5);
    fill(particle.hue, 90, 100, 0.2);
    circle(particle.position.x, particle.position.y, 
           particle.circleRadius * 2 * glowSize);

    // Main particle
    fill(particle.hue, 90, 100);
    circle(particle.position.x, particle.position.y, 
           particle.circleRadius * 2);
  });

  updateVisualEffects();

  // Draw edit mode handles
  if (gameMode === 'edit') {
    obstacles.forEach(obstacle => {
        if (obstacle.type === 'leaf' || 
            (obstacle.type === 'polygon' && obstacle.sides === 3) || 
            obstacle.type === 'circle' ||
            obstacle.type === 'bumper' ||
            obstacle.type === 'rectangle') {
            
            // Draw position handle
            push();
            stroke(255, 255, 0);
            fill(obstacle === selectedObstacle ? color(60, 100, 100) : color(30, 100, 100));
            
            // Position handle at center for all except leaves
            const handleX = obstacle.type === 'leaf' ? obstacle.handlePosition.x : obstacle.body.position.x;
            const handleY = obstacle.type === 'leaf' ? obstacle.handlePosition.y : obstacle.body.position.y;
            circle(handleX, handleY, HANDLE_SIZE);
            
            // Draw orientation handle for leaves, triangles, and rectangles (not for circles or bumpers)
            if (obstacle === selectedObstacle && 
                (obstacle.type === 'leaf' || 
                 obstacle.type === 'rectangle' || 
                 (obstacle.type === 'polygon' && obstacle.sides === 3))) {
                const handleDist = obstacle.type === 'leaf' ? HANDLE_DISTANCE.leaf : HANDLE_DISTANCE.triangle;
                const baseAngle = obstacle.type === 'leaf' ? obstacle.handleOrientation : obstacle.body.angle;
                
                const angleX = handleX + cos(baseAngle) * handleDist;
                const angleY = handleY + sin(baseAngle) * handleDist;
                
                line(handleX, handleY, angleX, angleY);
                fill(100, 100, 100);
                circle(angleX, angleY, HANDLE_SIZE * 0.8);
            }
            pop();
        }
    });
  }
}

function mousePressed() {
    if (mouseOverUI()) return true;

    if (gameMode === 'play') {
        createParticle(mouseX, mouseY);
        lastClickTime = millis();
        return false;
    }

    if (gameMode === 'edit') {
        const mousePos = { x: mouseX, y: mouseY };
        let clickedOnObstacle = false;

        // Check for handle selection first
        for (let obstacle of obstacles) {
            if (obstacle.type === 'leaf' || 
                (obstacle.type === 'polygon' && obstacle.sides === 3) || 
                obstacle.type === 'circle' || 
                obstacle.type === 'bumper' ||
                obstacle.type === 'rectangle') {
                
                const handleX = obstacle.type === 'leaf' ? obstacle.handlePosition.x : obstacle.body.position.x;
                const handleY = obstacle.type === 'leaf' ? obstacle.handlePosition.y : obstacle.body.position.y;
                
                // Check position handle
                if (dist(mouseX, mouseY, handleX, handleY) < HANDLE_SIZE) {
                    selectedObstacle = obstacle;
                    selectedHandle = 'position';
                    isDraggingObstacle = false;
                    return false;
                }
                
                // Check orientation handle for leaves, triangles, and rectangles (not for circles or bumpers)
                if (obstacle === selectedObstacle && 
                    (obstacle.type === 'leaf' || 
                     obstacle.type === 'rectangle' || 
                     (obstacle.type === 'polygon' && obstacle.sides === 3))) {
                    const handleDist = obstacle.type === 'leaf' ? HANDLE_DISTANCE.leaf : HANDLE_DISTANCE.triangle;
                    const baseAngle = obstacle.type === 'leaf' ? obstacle.handleOrientation : obstacle.body.angle;
                    
                    const angleX = handleX + cos(baseAngle) * handleDist;
                    const angleY = handleY + sin(baseAngle) * handleDist;
                    
                    if (dist(mouseX, mouseY, angleX, angleY) < HANDLE_SIZE) {
                        selectedHandle = 'orientation';
                        return false;
                    }
                }
            }
        }

        // If no handle was clicked, check for body selection
        for (let i = obstacles.length - 1; i >= 0; i--) {
            if (Matter.Vertices.contains(obstacles[i].body.vertices, mousePos)) {
                clickedOnObstacle = true;
                if (millis() - lastClickTime < 300) {
                    Matter.Composite.remove(world, obstacles[i].body);
                    obstacles.splice(i, 1);
                    return false;
                }

                selectedObstacle = obstacles[i];
                isDraggingObstacle = true;
                isDragging = true;

                dragOffset = {
                    x: selectedObstacle.body.position.x - mouseX,
                    y: selectedObstacle.body.position.y - mouseY
                };

                Matter.Body.setStatic(selectedObstacle.body, true);
                lastClickTime = millis();
                return false;
            }
        }

        // If clicked on empty space and it's a double click, create new triangle
        if (!clickedOnObstacle && millis() - lastClickTime < 300) {
            const size = random(80, 100); // Increased from (30, 50)
            const newTriangle = createPolygon(mouseX, mouseY, size/2, 3);
            Matter.Body.setStatic(newTriangle.body, true);
            obstacles.push(newTriangle);
        }

        lastClickTime = millis();
    }
    return false;
}

function mouseDragged() {
    if (mouseOverUI()) return true;

    if (gameMode === 'edit' && selectedObstacle) {
        if (selectedHandle === 'position') {
            if (selectedObstacle.type === 'leaf') {
                // Update handle position
                selectedObstacle.handlePosition.x = mouseX;
                selectedObstacle.handlePosition.y = mouseY;
                
                // Update leaf position while maintaining orientation
                const leafCenterX = mouseX + cos(selectedObstacle.handleOrientation) * (LEAF_LENGTH/2);
                const leafCenterY = mouseY + sin(selectedObstacle.handleOrientation) * (LEAF_LENGTH/2);
                Matter.Body.setPosition(selectedObstacle.body, {
                    x: leafCenterX,
                    y: leafCenterY
                });
                
            } else {
                Matter.Body.setPosition(selectedObstacle.body, {
                    x: mouseX,
                    y: mouseY
                });
            }
        } else if (selectedHandle === 'orientation') {
            const handleX = selectedObstacle.type === 'leaf' ? 
                selectedObstacle.handlePosition.x : selectedObstacle.body.position.x;
            const handleY = selectedObstacle.type === 'leaf' ? 
                selectedObstacle.handlePosition.y : selectedObstacle.body.position.y;
            
            const angle = atan2(
                mouseY - handleY,
                mouseX - handleX
            );
            
            if (selectedObstacle.type === 'leaf') {
                // Calculate new angle from handle to mouse
                const angle = atan2(
                    mouseY - selectedObstacle.handlePosition.y,
                    mouseX - selectedObstacle.handlePosition.x
                );
                
                selectedObstacle.handleOrientation = angle;
                
                // Update leaf position and rotation around pivot
                Matter.Body.setAngle(selectedObstacle.body, angle);
                Matter.Body.setPosition(selectedObstacle.body, {
                    x: selectedObstacle.handlePosition.x + cos(angle) * (LEAF_LENGTH/2),
                    y: selectedObstacle.handlePosition.y + sin(angle) * (LEAF_LENGTH/2)
                });
            } else {
                Matter.Body.setAngle(selectedObstacle.body, angle);
            }
        }
        return false;
    }

    // Handle regular obstacle dragging
    if (gameMode === 'edit' && isDraggingObstacle && selectedObstacle) {
        if (selectedObstacle.type === 'leaf') {
            // Update both body and handle positions for leaves
            const targetX = mouseX + dragOffset.x;
            const targetY = mouseY + dragOffset.y;
            Matter.Body.setPosition(selectedObstacle.body, { x: targetX, y: targetY });
            selectedObstacle.handlePosition = {
                x: targetX - cos(selectedObstacle.handleOrientation) * (LEAF_LENGTH/2),
                y: targetY - sin(selectedObstacle.handleOrientation) * (LEAF_LENGTH/2)
            };
        } else {
            // Regular obstacle dragging
            const targetX = mouseX + dragOffset.x;
            const targetY = mouseY + dragOffset.y;
            Matter.Body.setPosition(selectedObstacle.body, { x: targetX, y: targetY });
        }
        lastMousePos = { x: mouseX, y: mouseY };
        return false;
    }
    return false;
}

function mouseReleased() {
  if (isDraggingObstacle && selectedObstacle) {
    Matter.Body.setStatic(selectedObstacle.body, true);
    Matter.Body.setVelocity(selectedObstacle.body, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(selectedObstacle.body, 0);

    selectedObstacle = null;
    isDraggingObstacle = false;
    isDragging = false;
    dragOffset = { x: 0, y: 0 };
  }
  selectedHandle = null;
}

function mouseOverUI() {
  const controls = document.getElementById('controls-container');
  if (!controls) return false;
  const rect = controls.getBoundingClientRect();
  const clientY = (typeof event !== 'undefined') ? event.clientY : mouseY;
  const clientX = (typeof event !== 'undefined') ? event.clientX : mouseX;
  return (clientY >= rect.top && clientY <= rect.bottom && clientX >= rect.left && clientX <= rect.right);
}

function keyPressed() {
  if (gameMode === 'play') {
    if (key === " ") {
      createParticle(mouseX, mouseY); // Use createParticle
    }

    if (key >= "1" && key <= "5") {
      const count = parseInt(key);
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          createParticle(random(width), 20);
        }, i * 100);
      }
    }
  }

  // These commands work in both modes
  if (key === "c" || key === "C") {
    resetScene();
  }

  if (key === "r" || key === "R") {
    resetScene();
  }

  // Edit mode specific commands
  if (gameMode === 'edit') {
    if (keyCode === DELETE || keyCode === BACKSPACE) {
      if (selectedObstacle) {
        Matter.Composite.remove(world, selectedObstacle.body);
        obstacles = obstacles.filter((o) => o !== selectedObstacle);
        selectedObstacle = null;
      }
    }

    if (selectedObstacle) {
      if (keyCode === LEFT_ARROW) {
        Matter.Body.rotate(selectedObstacle.body, -0.1);
        return false;
      } else if (keyCode === RIGHT_ARROW) {
        Matter.Body.rotate(selectedObstacle.body, 0.1);
        return false;
      }
    }
  }

  return false; // Prevent default
}

function mouseWheel(event) {
  if (selectedObstacle) {
    const rotation = event.delta > 0 ? 0.1 : -0.1;
    Matter.Body.rotate(selectedObstacle.body, rotation);
    return false;
  }
}

function windowResized() {
  canvasWidth = min(windowWidth * 0.9, 800);
  canvasHeight = min(windowHeight * 0.8, 800);
  resizeCanvas(canvasWidth, canvasHeight);
  
  // Remove old walls
  walls.forEach(wall => Matter.Composite.remove(world, wall));
  walls = [];
  
  // Create new walls at new dimensions
  createWalls(canvasWidth, canvasHeight);
}

async function initAudio() {
if (!audioInitialized) {
  try {
    await Tone.start();
    await Tone.getContext().resume();

    // Initialize all synths after context is ready
    melodySynth.toDestination();
    metalSynth.toDestination();
    membraneSynth.toDestination();
    pluckSynth.toDestination();

    console.log('Audio ready');
    audioInitialized = true;

    // Fade out the loading overlay
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 500);
    }
  } catch (e) {
    console.error('Audio init error:', e);
  }
}
}

function createPolygon(x, y, radius, sides) {
    // Create vertices for the polygon
    const vertices = [];
    const angle = TWO_PI / sides;
    for (let i = 0; i < sides; i++) {
        vertices.push({
            x: x + radius * cos(angle * i - PI/2),
            y: y + radius * sin(angle * i - PI/2)
        });
    }

    // Create Matter.js body
    const body = Matter.Bodies.fromVertices(x, y, [vertices], {
        isStatic: false,
        restitution: bounciness,
        friction: 0.1,
        angle: random(TWO_PI)
    });

    // Create and return the obstacle object
    const obstacle = {
        body: body,
        type: 'polygon',
        sides: sides
    };

    Matter.Composite.add(world, body);
    return obstacle;
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

        // Calculate collision speed
        const speed = Matter.Vector.magnitude(particle.velocity);
        
        // Only play sound if speed is significant enough
        if (speed > 0.5 && (!particle.lastSoundTime || now - particle.lastSoundTime >= MIN_SOUND_INTERVAL)) {
            particle.lastSoundTime = now;
            particle.lastObstacleId = other.id;

            const volume = map(speed, 0, 10, 0.1, 1);
            createVisualEffect(pair.collision.supports[0].x, pair.collision.supports[0].y, particle.hue);

            let scaleNotes = scales[currentScale];
            let noteIndex = (floor((other.position.y / height) * scaleNotes.length) + particle.noteOffset) % scaleNotes.length;
            let note = scaleNotes[noteIndex];

            if (walls.includes(other)) {
                playParticleSound(particle, note, volume * 0.8, 3); // Wall collisions
            } else if (other.plugin && other.plugin.type === 'bumper') {
                playParticleSound(particle, note, volume * 1.2, 0); // Bumper collisions louder
            } else {
                playParticleSound(particle, note, volume, particle.soundType);
            }

            // Special collision handling for pinball elements
            if (other.plugin && other.plugin.type === 'bumper') {
                const angle = Matter.Vector.angle(other.position, particle.position);
                Matter.Body.setVelocity(particle, {
                    x: Math.cos(angle) * speed * 1.5,
                    y: Math.sin(angle) * speed * 1.5
                });
                createVisualEffect(other.position.x, other.position.y, 60);
            }
        }
    }
}
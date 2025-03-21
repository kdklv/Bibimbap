// Physics variables
let engine, render, world;
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
const MIN_SOUND_INTERVAL = 0.05; // Minimum time between sounds in seconds

// Add these variables at the top with other declarations
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let dragOffset = { x: 0, y: 0 };

// Canvas dimensions
let canvasWidth, canvasHeight;

// Sound variables
const scales = {
  pentatonic: [
    "C4",
    "D4",
    "E4",
    "G4",
    "A4",
    "C5",
    "D5",
    "E5",
    "G5",
    "A5",
    "C6",
  ],
  major: [
    "C3",
    "D3",
    "E3",
    "F3",
    "G3",
    "A3",
    "B3",
    "C4",
    "D4",
    "E4",
    "F4",
    "G4",
  ],
  minor: [
    "C3",
    "D3",
    "Eb3",
    "F3",
    "G3",
    "Ab3",
    "Bb3",
    "C4",
    "D4",
    "Eb4",
    "F4",
    "G4",
  ],
  blues: [
    "C3",
    "Eb3",
    "F3",
    "Gb3",
    "G3",
    "Bb3",
    "C4",
    "Eb4",
    "F4",
    "Gb4",
    "G4",
    "Bb4",
  ],
  gamelan: [
    "C3",
    "Db3",
    "Eb3",
    "G3",
    "Ab3",
    "C4",
    "Db4",
    "Eb4",
    "G4",
    "Ab4",
    "C5",
  ],
};

let currentScale = "pentatonic";

// Create synths
const melodySynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: {
    type: "triangle",
  },
  envelope: {
    attack: 0.02,
    decay: 0.1,
    sustain: 0.3,
    release: 1,
  },
}).toDestination();

const metalSynth = new Tone.MetalSynth({
  frequency: 200,
  envelope: {
    attack: 0.001,
    decay: 0.1,
    release: 0.2,
  },
  harmonicity: 3.1,
  modulationIndex: 16,
  resonance: 4000,
  octaves: 1.5,
}).toDestination();

const membraneSynth = new Tone.MembraneSynth({
  pitchDecay: 0.05,
  octaves: 4,
  oscillator: { type: "sine" },
  envelope: {
    attack: 0.001,
    decay: 0.4,
    sustain: 0.01,
    release: 1.4,
  },
}).toDestination();

const pluckSynth = new Tone.PluckSynth({
  attackNoise: 2,
  dampening: 4000,
  resonance: 0.7,
}).toDestination();

// Visual effects
let visualEffects = [];
let obstacleColors = [];

function setup() {
  // Set up canvas dimensions
  canvasWidth = min(windowWidth * 0.9, 800);
  canvasHeight = min(windowHeight * 0.8, 800);

  let canvas = createCanvas(canvasWidth, canvasHeight);
  canvas.parent("container");
  canvas.style('pointer-events', 'none'); // Disable initial pointer events

  // Re-enable pointer events only when interacting with canvas
  canvas.mousePressed(() => {
    if (!mouseOverUI()) {
      canvas.style('pointer-events', 'auto');
    }
  });

  canvas.mouseReleased(() => {
    canvas.style('pointer-events', 'none');
  });

  // Initialize Matter.js
  engine = Matter.Engine.create();
  world = engine.world;

  // Set initial gravity
  world.gravity.y = 0.2;

  // Create walls
  createWalls();

  // Create initial obstacles
  createRandomObstacles(15);

  // Start Matter.js engine
  Matter.Runner.run(engine);

  // Initialize event listeners
  document
    .getElementById("clear-button")
    .addEventListener("click", clearAll);
  document
    .getElementById("scale-select")
    .addEventListener("change", (e) => {
      currentScale = e.target.value;
      console.log("Scale select change event fired"); // Added log
      console.log("Scale changed to:", currentScale);
    });
  document
    .getElementById("gravity-slider")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      engine.world.gravity.y = value;
      console.log("Gravity slider input event fired"); // Added log
      console.log("Gravity updated:", value);
    });
  document
    .getElementById("bounce-slider")
    .addEventListener("input", (e) => {
      const value = parseFloat(e.target.value);
      bounciness = value;
      updateAllBounciness(value);
      console.log("Bounce slider input event fired"); // Added log
      console.log("Bounciness updated:", value);
    });

  // Initialize colors
  colorMode(HSB, 100);

  // Start audio context on first user interaction
  document.addEventListener('click', initAudio, { once: true });

  // Set up collision events
  Matter.Events.on(engine, "collisionStart", handleCollisions);

  // Generate random colors for obstacles
  for (let i = 0; i < 100; i++) {
    obstacleColors.push(color(random(100), 70, 80));
  }

  // Store floor Y position for particle shrinking
  floorY = height + 15; // middle of bottom wall

  // Remove old event listener and add new initialization
  const overlay = document.getElementById('loading-overlay');
  overlay.addEventListener('click', async () => {
    await initAudio();
    overlay.style.display = 'none';
  });

  // Update UI event listeners
  const scaleSelect = document.getElementById("scale-select");
  const gravitySlider = document.getElementById("gravity-slider");
  const bounceSlider = document.getElementById("bounce-slider");
  const gravityValue = document.querySelector("#gravity-slider + .slider-value");
  const bounceValue = document.querySelector("#bounce-slider + .slider-value");

  scaleSelect.addEventListener("change", function(e) {
    currentScale = e.target.value;
    console.log("Scale changed to:", currentScale);
  });

  gravitySlider.addEventListener("input", function(e) {
    const value = parseFloat(e.target.value);
    engine.world.gravity.y = value;
    gravityValue.textContent = value.toFixed(2);
    Matter.Engine.update(engine); // Force update
  });

  bounceSlider.addEventListener("input", function(e) {
    const value = parseFloat(e.target.value);
    bounciness = value;
    updateAllBounciness(value);
    bounceValue.textContent = value.toFixed(2);
  });

  // Initialize slider values
  gravityValue.textContent = gravitySlider.value;
  bounceValue.textContent = bounceSlider.value;
}

function draw() {
  background(10);

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
      // Highlight selected obstacle
      if (obstacle === selectedObstacle) {
        stroke(255, 255, 0);
        strokeWeight(2);
      } else {
        noStroke();
      }
      fill(obstacleColors[i % obstacleColors.length]);
      beginShape();
      obstacle.vertices.forEach((v) => {
        vertex(v.x, v.y);
      });
      endShape(CLOSE);
      pop();
    });
  }

  // Draw particles
  particles.forEach((particle, i) => {
    // Check if particle has touched floor
    if (!particle.isShrinking && particle.position.y >= floorY) {
      particle.isShrinking = true;
    }

    // Apply shrinking
    if (particle.isShrinking) {
      particle.circleRadius *= particle.shrinkRate;
      // Remove if too small
      if (particle.circleRadius < 0.5) {
        Matter.Composite.remove(world, particle);
        particles.splice(i, 1);
        return;
      }
    }

    // Draw glow effect
    fill(particle.hue, 70, 90, 0.3);
    noStroke();
    circle(
      particle.position.x,
      particle.position.y,
      particle.circleRadius * 3
    );

    // Draw particle
    fill(particle.hue, 80, 100);
    circle(
      particle.position.x,
      particle.position.y,
      particle.circleRadius * 2
    );
  });

  updateVisualEffects();
}

function createWalls() {
  const wallThickness = 30;
  const wallOptions = {
    isStatic: true,
    restitution: 0.8,
    friction: 0.005,
  };

  // Create angled walls
  // Bottom wall
  let bottomWall = Matter.Bodies.rectangle(
    width / 2,
    height + wallThickness / 2,
    width + wallThickness * 2,
    wallThickness,
    wallOptions
  );

  // Top wall
  let topWall = Matter.Bodies.rectangle(
    width / 2,
    -wallThickness / 2,
    width + wallThickness * 2,
    wallThickness,
    wallOptions
  );

  // Left wall (angled)
  let leftWall = Matter.Bodies.trapezoid(
    -wallThickness / 2,
    height / 2,
    wallThickness,
    height,
    0.2,
    wallOptions
  );

  // Right wall (angled)
  let rightWall = Matter.Bodies.trapezoid(
    width + wallThickness / 2,
    height / 2,
    wallThickness,
    height,
    -0.2,
    wallOptions
  );

  walls = [bottomWall, topWall, leftWall, rightWall];
  Matter.Composite.add(world, walls);
}

function createRandomObstacles(count) {
  // Remove existing obstacles
  for (let obstacle of obstacles) {
    Matter.Composite.remove(world, obstacle);
  }
  obstacles = [];

  // Create new obstacles
  for (let i = 0; i < count; i++) {
    let x = random(50, width - 50);
    let y = random(50, height - 50);

    // Randomly choose between circle, triangle, rectangle
    let type = floor(random(3));
    let obstacle;

    const obstacleOptions = {
      isStatic: true,
      restitution: bounciness,
      friction: 0.001,
      chamfer: { radius: 2 },
    };

    if (type === 0) {
      // Circle
      let radius = random(15, 40);
      obstacle = Matter.Bodies.circle(x, y, radius, obstacleOptions);
      obstacle.circleRadius = radius;
    } else if (type === 1) {
      // Triangle
      let size = random(25, 60);
      obstacle = Matter.Bodies.polygon(x, y, 3, size, obstacleOptions);
    } else {
      // Rectangle (possibly rotated)
      let w = random(20, 80);
      let h = random(10, 30);
      obstacle = Matter.Bodies.rectangle(x, y, w, h, obstacleOptions);
      Matter.Body.rotate(obstacle, random(PI));
    }

    obstacles.push(obstacle);
    Matter.Composite.add(world, obstacle);
  }
}

function createParticle(x, y) {
  // Check if position is valid (inside canvas)
  if (x < 0 || x > width || y < 0 || y > height) {
    return;
  }

  const radius = random(10, 20);
  const hue = random(100);

  const particleOptions = {
    restitution: bounciness,
    friction: 0.001,
    frictionAir: 0.001,
    density: 0.01,
    collisionFilter: {
      category: 0x0002,
    },
  };

  const particle = Matter.Bodies.circle(x, y, radius, particleOptions);

  // Add custom properties
  particle.circleRadius = radius;
  particle.hue = hue;
  particle.lastObstacleId = null;
  particle.soundType = floor(random(4)); // 0-3 for different sound types
  particle.noteOffset = floor(random(scales[currentScale].length));
  particle.originalRadius = radius;
  particle.isShrinking = false;
  particle.shrinkRate = 0.97; // will multiply size by this each frame

  // Apply initial velocity
  Matter.Body.setVelocity(particle, {
    x: random(-2, 2),
    y: random(-1, 1),
  });

  // Add to world and tracking array
  Matter.Composite.add(world, particle);
  particles.push(particle);

  // Limit number of particles for performance
  if (particles.length > 20) {
    Matter.Composite.remove(world, particles[0]);
    particles.shift();
  }

  // Play initial sound
  if (audioInitialized) {
    playParticleSound(
      particle,
      scales[currentScale][particle.noteOffset],
      0.5
    );
  }
}

function handleCollisions(event) {
  const pairs = event.pairs;
  const now = Tone.now();

  for (let pair of pairs) {
    let bodyA = pair.bodyA;
    let bodyB = pair.bodyB;

    // Check if a particle is involved
    let particle, other;

    if (particles.includes(bodyA)) {
      particle = bodyA;
      other = bodyB;
    } else if (particles.includes(bodyB)) {
      particle = bodyB;
      other = bodyA;
    } else {
      continue; // Neither body is a particle
    }

    // Don't trigger on collisions with the same obstacle in rapid succession
    if (other.id === particle.lastObstacleId) {
      continue;
    }

    // Add minimum time check between sounds for this particle
    if (!particle.lastSoundTime || now - particle.lastSoundTime >= MIN_SOUND_INTERVAL) {
      particle.lastSoundTime = now;
      particle.lastObstacleId = other.id;

      // Calculate velocity for volume
      const speed = Matter.Vector.magnitude(particle.velocity);
      const volume = map(speed, 0, 10, 0.1, 1);

      // Create visual effect at collision point
      createVisualEffect(
        pair.collision.supports[0].x,
        pair.collision.supports[0].y,
        particle.hue
      );

      // Choose note based on collision position and particle properties
      let scaleNotes = scales[currentScale];
      let noteIndex =
        (floor((other.position.y / height) * scaleNotes.length) +
          particle.noteOffset) %
        scaleNotes.length;
      let note = scaleNotes[noteIndex];

      // Play sound based on what was hit
      if (walls.includes(other)) {
        // Wall collision - use pluck sound
        playParticleSound(particle, note, volume, 3);
      } else if (obstacles.includes(other)) {
        // Obstacle collision - use random or assigned sound
        playParticleSound(particle, note, volume, particle.soundType);

        // Apply random impulse for more chaotic motion
        const angle = random(TWO_PI);
        const force = random(0.001, 0.005);
        Matter.Body.applyForce(particle, particle.position, {
          x: cos(angle) * force,
          y: sin(angle) * force,
        });
      }
    }
  }
}

function playParticleSound(particle, note, volume, soundType = null) {
  if (!audioInitialized || Tone.getContext().state !== 'running') return;

  const now = Tone.now();
  if (now - lastSoundTime < MIN_SOUND_INTERVAL) return;
  
  lastSoundTime = now;

  // Use the particle's assigned sound type if not specified
  if (soundType === null) {
    soundType = particle.soundType;
  }

  try {
    const playTime = now + 0.01; // Small offset to ensure proper scheduling
    // Use different synths based on sound type
    switch (soundType) {
      case 0:
        melodySynth.triggerAttackRelease(note, "16n", playTime, volume * 0.8);
        break;
      case 1:
        metalSynth.triggerAttackRelease(note, "32n", playTime, volume * 0.4);
        break;
      case 2:
        membraneSynth.triggerAttackRelease(note, "8n", playTime, volume * 0.6);
        break;
      case 3:
        pluckSynth.triggerAttackRelease(note, "16n", playTime, volume * 0.7);
        break;
    }
  } catch (e) {
    console.warn('Sound playback error:', e);
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

    // Draw the effect
    noStroke();
    fill(effect.hue, 80, 95, effect.alpha);
    ellipse(effect.x, effect.y, effect.radius * 2);

    // Update the effect
    effect.radius += effect.growRate;
    effect.alpha -= 0.05;

    // Remove faded effects
    if (effect.alpha <= 0) {
      visualEffects.splice(i, 1);
    }
  }
}

function clearAll() {
  // Remove all particles
  for (let particle of particles) {
    Matter.Composite.remove(world, particle);
  }
  particles = [];

  // Clear visual effects
  visualEffects = [];
  
  // Reset obstacles (like pressing 'R')
  createRandomObstacles(15);
}

function updateScale() {
  currentScale = document.getElementById("scale-select").value;
  console.log("Scale updated to:", currentScale);
}

function updateGravity() {
  const value = parseFloat(document.getElementById("gravity-slider").value);
  engine.world.gravity.y = value;
  Matter.Engine.update(engine);
}

function updateBounciness() {
  const value = parseFloat(document.getElementById("bounce-slider").value);
  bounciness = value;
  updateAllBounciness(value);
  Matter.Engine.update(engine);
}

function updateAllBounciness(value) {
  // Update existing obstacles
  obstacles.forEach(obstacle => {
    obstacle.restitution = value;
    Matter.Body.set(obstacle, "restitution", value);
  });

  // Update existing particles
  particles.forEach(particle => {
    particle.restitution = value;
    Matter.Body.set(particle, "restitution", value);
  });

  // Update walls
  walls.forEach(wall => {
    wall.restitution = value;
    Matter.Body.set(wall, "restitution", value);
  });

  Matter.Engine.update(engine); // Force physics engine update
}

function mousePressed() {
  if (mouseOverUI()) {
    return true; // Allow default behavior for UI elements
  }

  lastMousePos = { x: mouseX, y: mouseY };
  const mousePos = { x: mouseX, y: mouseY };

  // Check for double click on obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    if (Matter.Vertices.contains(obstacles[i].vertices, mousePos)) {
      if (millis() - lastClickTime < 300) {
        Matter.Composite.remove(world, obstacles[i]);
        obstacles.splice(i, 1);
        return false;
      }
      
      selectedObstacle = obstacles[i];
      isDraggingObstacle = true;
      isDragging = true;
      
      // Calculate offset from mouse to obstacle center
      dragOffset = {
        x: selectedObstacle.position.x - mouseX,
        y: selectedObstacle.position.y - mouseY
      };
      
      // Keep static but allow movement
      selectedObstacle.isStatic = true;
      selectedObstacle.isSleeping = false;
      
      lastClickTime = millis();
      return false;
    }
  }

  // Single click - create particle
  createParticle(mouseX, mouseY);
  lastClickTime = millis();
  return false;
}

function mouseDragged() {
  if (mouseOverUI()) {
    return true; // Allow default behavior for UI elements
  }

  if (!isDraggingObstacle || !selectedObstacle) return;

  const targetX = mouseX + dragOffset.x;
  const targetY = mouseY + dragOffset.y;

  // Move the obstacle
  Matter.Body.setPosition(selectedObstacle, {
    x: targetX,
    y: targetY
  });

  // Handle rotation
  if (keyIsDown(SHIFT)) {
    Matter.Body.rotate(selectedObstacle, 0.1);
  } else if (mouseX !== lastMousePos.x) { // Only rotate if mouse is moving
    const rotationAmount = (mouseX - lastMousePos.x) * 0.01;
    Matter.Body.rotate(selectedObstacle, rotationAmount);
  }

  lastMousePos = { x: mouseX, y: mouseY };
  return false;
}

function mouseReleased() {
  if (isDraggingObstacle && selectedObstacle) {
    // Ensure the obstacle is static and properly positioned
    selectedObstacle.isStatic = true;
    Matter.Body.setVelocity(selectedObstacle, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(selectedObstacle, 0);
    
    // Reset all states
    selectedObstacle = null;
    isDraggingObstacle = false;
    isDragging = false;
    dragOffset = { x: 0, y: 0 };
  }
}

function mouseOverUI() {
  // Check if mouse is over the controls container
  const controls = document.getElementById('controls-container');
  if (!controls) return false;

  const rect = controls.getBoundingClientRect();
  
  // Use event.clientY and event.clientX if event is defined, otherwise use mouseY and mouseX
  const clientY = (typeof event !== 'undefined') ? event.clientY : mouseY;
  const clientX = (typeof event !== 'undefined') ? event.clientX : mouseX;

  return (
    clientY >= rect.top &&
    clientY <= rect.bottom &&
    clientX >= rect.left &&
    clientX <= rect.right
  );
}

function keyPressed() {
  // Space bar to drop a particle
  if (key === " ") {
    dropParticle();
  }

  // 'C' to clear all
  if (key === "c" || key === "C") {
    clearAll();
  }

  // 'R' to randomize obstacles
  if (key === "r" || key === "R") {
    createRandomObstacles(15);
  }

  // Number keys 1-5 to drop multiple particles
  if (key >= "1" && key <= "5") {
    const count = parseInt(key);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        createParticle(random(width), 20);
      }, i * 100);
    }
  }

  // Delete selected obstacle with Delete or Backspace
  if (keyCode === DELETE || keyCode === BACKSPACE) {
    if (selectedObstacle) {
      Matter.Composite.remove(world, selectedObstacle);
      obstacles = obstacles.filter((o) => o !== selectedObstacle);
      selectedObstacle = null;
    }
  }

  // Add rotation controls with arrow keys
  if (selectedObstacle) {
    if (keyCode === LEFT_ARROW) {
      Matter.Body.rotate(selectedObstacle, -0.1);
      return false;
    } else if (keyCode === RIGHT_ARROW) {
      Matter.Body.rotate(selectedObstacle, 0.1);
      return false;
    }
  }

  return false; // Prevent default
}

function mouseWheel(event) {
  if (selectedObstacle) {
    // Rotate obstacle with mouse wheel
    const rotation = event.delta > 0 ? 0.1 : -0.1;
    Matter.Body.rotate(selectedObstacle, rotation);
    return false;
  }
}

function windowResized() {
  // Resize canvas while maintaining physics world
  canvasWidth = min(windowWidth * 0.9, 800);
  canvasHeight = min(windowHeight * 0.8, 800);

  resizeCanvas(canvasWidth, canvasHeight);
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

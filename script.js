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
const MIN_SOUND_INTERVAL = 0.05; // Minimum time between sounds in seconds

let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let dragOffset = { x: 0, y: 0 };

let canvasWidth, canvasHeight;
let currentScale = "pentatonic";

// Visual effects
let visualEffects = [];
let obstacleColors = [];

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
  document.getElementById("clear-button").addEventListener("click", clearAll);
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

  // Draw and update particles
  particles.forEach((particle, i) => {
    if (!particle.isShrinking && particle.position.y >= floorY) {
      particle.isShrinking = true;
    }

    if (particle.isShrinking) {
      particle.circleRadius *= particle.shrinkRate;
      if (particle.circleRadius < 0.5) {
        Matter.Composite.remove(world, particle);
        particles.splice(i, 1);
        return;
      }
    }

    fill(particle.hue, 70, 90, 0.3);
    noStroke();
    circle(particle.position.x, particle.position.y, particle.circleRadius * 3);

    fill(particle.hue, 80, 100);
    circle(particle.position.x, particle.position.y, particle.circleRadius * 2);
  });

  updateVisualEffects();
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

      dragOffset = {
        x: selectedObstacle.position.x - mouseX,
        y: selectedObstacle.position.y - mouseY
      };

      selectedObstacle.isStatic = true;
      selectedObstacle.isSleeping = false;

      lastClickTime = millis();
      return false;
    }
  }

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

  Matter.Body.setPosition(selectedObstacle, { x: targetX, y: targetY });

  if (keyIsDown(SHIFT)) {
    Matter.Body.rotate(selectedObstacle, 0.1);
  } else if (mouseX !== lastMousePos.x) {
    const rotationAmount = (mouseX - lastMousePos.x) * 0.01;
    Matter.Body.rotate(selectedObstacle, rotationAmount);
  }

  lastMousePos = { x: mouseX, y: mouseY };
  return false;
}


function mouseReleased() {
  if (isDraggingObstacle && selectedObstacle) {
    selectedObstacle.isStatic = true;
    Matter.Body.setVelocity(selectedObstacle, { x: 0, y: 0 });
    Matter.Body.setAngularVelocity(selectedObstacle, 0);

    selectedObstacle = null;
    isDraggingObstacle = false;
    isDragging = false;
    dragOffset = { x: 0, y: 0 };
  }
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
  if (key === " ") {
    createParticle(mouseX, mouseY); // Use createParticle
  }

  if (key === "c" || key === "C") {
    clearAll();
  }

  if (key === "r" || key === "R") {
      createRandomObstacles(15, width, height);
  }

  if (key >= "1" && key <= "5") {
    const count = parseInt(key);
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        createParticle(random(width), 20);
      }, i * 100);
    }
  }

  if (keyCode === DELETE || keyCode === BACKSPACE) {
    if (selectedObstacle) {
      Matter.Composite.remove(world, selectedObstacle);
      obstacles = obstacles.filter((o) => o !== selectedObstacle);
      selectedObstacle = null;
    }
  }

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
    const rotation = event.delta > 0 ? 0.1 : -0.1;
    Matter.Body.rotate(selectedObstacle, rotation);
    return false;
  }
}

function windowResized() {
  canvasWidth = min(windowWidth * 0.9, 800);
  canvasHeight = min(windowHeight * 0.8, 800);
  resizeCanvas(canvasWidth, canvasHeight);
  createWalls(canvasWidth, canvasHeight);
  createRandomObstacles(15, canvasWidth, canvasHeight)
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
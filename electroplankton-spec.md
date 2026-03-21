# Plankton — Technical Specification
**A weekend creative sprint.** Four interactive art toys, built as a homage to Electroplankton (NDS, 2005).

---

## Project shape

```
plankton/
├── index.html          ← menu / router
├── shared/
│   ├── audio.js        ← Tone.js init, scales, note mapping
│   ├── pointer.js      ← unified mouse + touch input
│   └── theme.css       ← CSS vars, resets
├── luminaria/index.html
├── hanenbow/index.html
├── tracy/index.html
└── nanocarp/index.html
```

Each module is a **fully self-contained HTML file**. No bundler, no npm, no build step. One `<script src="../shared/...">` per dependency. Open any file directly in a browser. Deploy by pushing to GitHub Pages.

**Only external library: Tone.js 14.8.49**
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
```
No Three.js. No p5.js. No physics library. Canvas 2D throughout. Custom physics where needed is ≤30 lines.

**Build order:** Luminaria → Hanenbow → Tracy → Nanocarp → index

---

## Shared systems

### `shared/audio.js`

Handles the one painful part of web audio: the gesture gate. Call `Audio.init()` inside your first pointer handler, then forget about it.

```js
const Audio = {
  async init() {
    await Tone.start();   // resumes AudioContext after user gesture
  },

  scales: {
    pentatonic: [0, 2, 4, 7, 9],
    gamelan:    [0, 1, 5, 7, 8],
    wholeTone:  [0, 2, 4, 6, 8, 10],
    major:      [0, 2, 4, 5, 7, 9, 11],
    minor:      [0, 2, 3, 5, 7, 8, 10],
  },

  // Maps a y position (0=top) to a MIDI note number within a scale.
  // y=0 → highest note, y=canvasHeight → lowest note.
  noteFromY(y, canvasHeight, scaleName = 'pentatonic', octaves = 2, rootMidi = 60) {
    const scale = this.scales[scaleName];
    const totalNotes = scale.length * octaves;
    const index = Math.floor((1 - y / canvasHeight) * totalNotes);
    const clamped = Math.max(0, Math.min(totalNotes - 1, index));
    const octave = Math.floor(clamped / scale.length);
    const degree = scale[clamped % scale.length];
    return rootMidi + octave * 12 + degree;
  },

  midiToNote(midi) {
    const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    return notes[midi % 12] + Math.floor(midi / 12 - 1);
  }
};
```

### `shared/pointer.js`

One API for mouse and touch. Every callback gets `{ x, y, id }` in canvas-local coordinates.

```js
const Pointer = {
  // el: the canvas element. All coords are relative to el's bounding rect.
  on(el, type, cb) {
    // type: 'down' | 'move' | 'up'
    // normalises PointerEvent, MouseEvent, TouchEvent → { x, y, id }
  }
};
```

Key behaviour:
- Touch: each finger gets a unique `id` matching `Touch.identifier`
- Mouse: `id` is always `0`
- Coordinates are always relative to the canvas — factor in `el.getBoundingClientRect()` on every event (not cached, so resize is handled automatically)
- `move` only fires while pointer is down (drag semantics). For hover/idle movement, use native `pointermove` directly.

### `shared/theme.css`

```css
:root {
  --bg:     #080c14;
  --fg:     #e8eaf0;
  --accent: #a0c4ff;
  --glow:   rgba(160, 196, 255, 0.15);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; background: var(--bg); }
canvas { display: block; width: 100vw; height: 100vh; touch-action: none; }

.begin-screen {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg);
  font-family: system-ui, sans-serif;
  font-size: 15px; font-weight: 400; letter-spacing: 0.08em;
  color: rgba(232, 234, 240, 0.5);
  transition: opacity 0.6s ease;
  pointer-events: none;
}
```

---

## Rendering engine (applies to all modules)

All modules use **Canvas 2D** with a consistent rendering approach.

### The frame loop

```js
function loop(timestamp) {
  update(timestamp);   // advance all state
  draw();              // render current state
  requestAnimationFrame(loop);
}
// Loop starts only after begin() is called — not on page load.
```

Always separate update and draw. Never mutate state inside draw.

### Two background strategies

**Motion-blur (persistence):** instead of `clearRect`, fill with a low-alpha background color. Trails appear naturally.
```js
ctx.fillStyle = 'rgba(8, 12, 20, 0.25)';  // tune alpha: lower = longer trails
ctx.fillRect(0, 0, W, H);
```
Used in: **Luminaria, Hanenbow, Nanocarp**

**Full clear:** `ctx.clearRect(0, 0, W, H)` each frame. Used when persistent trails would clutter or when you're drawing background elements explicitly.
Used in: **Tracy** (paths are drawn explicitly as persistent art, not as blur trails)

### Glow technique

`shadowBlur` is the primary glow mechanism. It's expensive — follow these rules:
- Set `ctx.shadowBlur` and `ctx.shadowColor` **before** the draw call that needs it
- Always `ctx.save()` / `ctx.restore()` around shadow draws to prevent bleed
- **Never** use shadowBlur inside a loop over more than ~15 objects. For Nanocarp fish (40 total): use the cheap alternative — draw a slightly larger, lower-opacity circle behind the main shape.
- After glow draw: explicitly reset `ctx.shadowBlur = 0` before drawing non-glow elements

```js
// Pattern for a glowing dot:
ctx.save();
ctx.shadowBlur = 24;
ctx.shadowColor = `hsla(${hue}, 80%, 70%, 0.7)`;
ctx.beginPath();
ctx.arc(x, y, radius, 0, Math.PI * 2);
ctx.fill();
ctx.restore();
```

### Canvas resolution (HiDPI)

```js
function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return ctx;  // all drawing coords are in CSS pixels
}
```

Call on load and on `window.resize`. Store `W = rect.width`, `H = rect.height` and use those everywhere.

---

## Tactility & interaction feedback

This is the core of the project. Every interaction must feel like touching something physical.

### Principles

**Immediate response.** Every pointer-down triggers something visible within the same frame.

**Audio and visual are simultaneous.** The note and the visual change happen on the same frame. Exception: Luminaria, where notes are quantised to BPM — the slight delay is part of the musical feel.

**Resting state is alive.** When nobody is touching, the canvas keeps moving. The world doesn't wait.

**Input leaves a trace.** Every touch has a brief visual echo — a ripple, flash, or trail. Nothing disappears silently.

**Resistance and weight.** Dragged objects feel like they have mass. Use lerp:
```js
// In update():
leaf.displayX += (leaf.targetX - leaf.displayX) * 0.18;
leaf.displayY += (leaf.targetY - leaf.displayY) * 0.18;
// Pointer sets targetX/Y. Canvas draws from displayX/Y.
// 0.18 = snappy but not instant. 0.08 = heavy. 0.35 = near-instant.
```

**Release feels like letting go.** Track the last 4 pointer positions + timestamps on move. On pointer-up, compute velocity and apply it as initial velocity to the released object.
```js
const vx = (positions[3].x - positions[0].x) / (positions[3].t - positions[0].t);
const vy = (positions[3].y - positions[0].y) / (positions[3].t - positions[0].t);
```

### Touch-specific

- `touch-action: none` on canvas (already in theme.css) — prevents scroll hijacking
- Hit targets for interactive elements (leaves, arrows) should be minimum 44×44px even if the visual is smaller — compute hits against an expanded radius
- Two-finger rotation: track two pointer ids, compute angle between them relative to the target centre, apply delta to the object's angle each frame

---

## Module 1: Luminaria

**Feel:** You are a conductor. The arrows are your score. The plankton are the performers.

### State

```js
let grid = [];       // grid[row][col] = { dir, animAngle, targetAngle }
let COLS, ROWS, offsetX, offsetY;
const CELL = 80;     // px desktop; 60 mobile (innerWidth < 768)

let plankton = [];   // max 5
const BPM = 90;
const BEAT_FRAMES = (60 / BPM) * 60;   // frames per cell crossing
const SPEED = CELL / BEAT_FRAMES;       // px/frame

let synths = [];     // pool of 5 Tone.Synth, created once
let currentScale = 'gamelan';
```

### Grid init

```js
function initGrid() {
  COLS = Math.floor(W / CELL);
  ROWS = Math.floor(H / CELL);
  offsetX = (W - COLS * CELL) / 2;
  offsetY = (H - ROWS * CELL) / 2;
  grid = Array.from({ length: ROWS }, (_, row) =>
    Array.from({ length: COLS }, (_, col) => {
      const dir = randomDir(row, col);  // biased inward on edges
      const angle = dirToAngle(dir);
      return { dir, animAngle: angle, targetAngle: angle };
    })
  );
}

const dirToAngle = d => ({ N: -Math.PI/2, E: 0, S: Math.PI/2, W: Math.PI }[d]);
```

Edge bias for `randomDir`: top edge → 70% S, bottom → 70% N, left → 70% E, right → 70% W. Interior: uniform random.

### Plankton data model

```js
{
  x, y,               // pixel position (interpolating between cells)
  col, row,           // current grid cell
  dir,                // current direction of travel
  trail: [{x,y}],     // last 12 positions
  hue: float,         // 0–360, assigned on spawn
  visitedCells: new Set(),
  state: 'alive' | 'fading' | 'dead',
  opacity: 1.0,
  synthIndex: int,    // which pool synth this plankton owns
}
```

### Plankton movement

Plankton moves in pixel space toward the centre of the next cell. On arrival (distance to target < 2px):
1. Read current cell's `dir`
2. Compute next `[col, row]`
3. Out of bounds → state = 'fading'
4. Next cell in `visitedCells` → state = 'fading' (loop detected)
5. Otherwise: update `col/row`, add to `visitedCells`, trigger note

### On cell click

```js
function onCellClick(col, row) {
  const dirs = ['N', 'E', 'S', 'W'];
  const cell = grid[row][col];
  cell.dir = dirs[(dirs.indexOf(cell.dir) + 1) % 4];
  cell.targetAngle += Math.PI / 2;  // cumulative — handles rapid clicks correctly
}

// In update():
cell.animAngle += (cell.targetAngle - cell.animAngle) * 0.2;
```

### Drawing order

1. Background persistence fill (`rgba(8,12,20,0.25)`)
2. Grid arrows — dim at rest, brighter + shadowBlur when plankton occupies cell
3. Plankton trails — fading polyline through trail array, hue-colored
4. Plankton bodies — circle r=6, shadowBlur=20
5. Cell pulse — expanding circle on cell entry, fades over 400ms

### Audio

```js
// Create once:
synths = Array.from({ length: 5 }, () =>
  new Tone.Synth({
    oscillator: { type: 'sine' },
    envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 0.8 }
  }).toDestination()
);

// On cell entry:
function triggerNote(plankton) {
  const midi = Audio.noteFromY(plankton.row * CELL, ROWS * CELL, currentScale, 3);
  synths[plankton.synthIndex].triggerAttackRelease(Audio.midiToNote(midi), '8n');
}
```

Auto-spawn: one new plankton every 4 seconds if below max 5. `Space` spawns immediately.

### Keyboard

```
Space     spawn plankton now
C         clear all plankton
R         randomise all arrows
1–5       switch scale (1=gamelan 2=pentatonic 3=wholeTone 4=major 5=minor)
↑/↓       BPM ±10
```

### Success criteria

- [ ] Grid reflows correctly on resize
- [ ] Cell click animates arrow rotation (not instant snap)
- [ ] Plankton follow arrows smoothly at 60fps
- [ ] Note fires on cell entry, pitch tracks row position
- [ ] Loop detection: looping plankton fade out after one full cycle
- [ ] Max 5 plankton enforced
- [ ] Works on mobile touch

---

## Module 2: Hanenbow

**Feel:** A living instrument. Drag the leaves until the ball makes the sounds you want.

### State

```js
let leaves = [];    // 7 on init, min 2, max 12
let ball = {};
let synth;
let currentScale = 'pentatonic';

// Each leaf:
{
  x, y,             // target position (set by pointer)
  displayX, displayY,  // lerped toward x,y (mass feel)
  angle,            // radians. Range: -Math.PI/3 to +Math.PI/3
  len,              // half-length, randomised 60–120px on creation
  dragging: false,
  dragOffsetX: 0, dragOffsetY: 0,
  velHistory: [],   // last 4 {x,y,t} for release momentum
  flashT: 0,        // timestamp of last ball hit
}

// Ball:
{
  x, y, vx, vy,
  r: 8,
  trail: [],        // last 20 {x,y}
  stuckTimer: 0,
}
```

### Physics

```js
function updateBall() {
  ball.vy += 0.25;  // gravity

  const spd = Math.hypot(ball.vx, ball.vy);
  if (spd > 18) { ball.vx *= 18/spd; ball.vy *= 18/spd; }

  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall bounce (silent)
  if (ball.x < ball.r)   { ball.x = ball.r;   ball.vx *= -0.9; }
  if (ball.x > W-ball.r) { ball.x = W-ball.r; ball.vx *= -0.9; }
  if (ball.y < ball.r)   { ball.y = ball.r;   ball.vy *= -0.9; }
  if (ball.y > H + 80)   { resetBall(); return; }

  for (const leaf of leaves) {
    if (!leafHit(ball, leaf)) continue;
    reflect(ball, leaf);
    ball.vx *= 1.05; ball.vy *= 1.05;   // small energy boost prevents dying
    leaf.flashT = performance.now();
    triggerLeafNote(leaf);
  }

  // Stuck detection
  if (spd < 0.5) ball.stuckTimer++; else ball.stuckTimer = 0;
  if (ball.stuckTimer > 120) resetBall();
}
```

**Leaf collision (point-to-segment, using displayX/Y):**
```js
function leafHit(ball, leaf) {
  const ax = leaf.displayX - Math.cos(leaf.angle) * leaf.len;
  const ay = leaf.displayY - Math.sin(leaf.angle) * leaf.len;
  const bx = leaf.displayX + Math.cos(leaf.angle) * leaf.len;
  const by = leaf.displayY + Math.sin(leaf.angle) * leaf.len;
  const dx = bx-ax, dy = by-ay;
  const t = Math.max(0, Math.min(1, ((ball.x-ax)*dx + (ball.y-ay)*dy) / (dx*dx+dy*dy)));
  const dist = Math.hypot(ball.x - (ax+t*dx), ball.y - (ay+t*dy));
  return dist < ball.r + 3;
}

function reflect(ball, leaf) {
  const nx = -Math.sin(leaf.angle), ny = Math.cos(leaf.angle);
  const dot = ball.vx*nx + ball.vy*ny;
  ball.vx -= 2*dot*nx;
  ball.vy -= 2*dot*ny;
}
```

### Leaf interaction

**Drag:** On pointer-down, check all leaves for hit (44px radius). If found: `leaf.dragging = true`, store offset. On move: `leaf.x = ptr.x - offsetX`, `leaf.y = ptr.y - offsetY`. Track `velHistory`. On up: apply release momentum to leaf.x/y if desired, clear dragging.

**Rotate (desktop):** `wheel` on canvas → find leaf under pointer → `leaf.angle += e.deltaY * 0.002` → clamp ±π/3.

**Rotate (touch):** Track two pointer ids. Each `pointermove`: compute angle between the two fingers relative to leaf centre, apply delta to `leaf.angle`. Clamp ±π/3.

**Add / Remove:** Double-click on empty space (no leaf within 50px): add leaf. Double-click on leaf: remove (if leaves.length > 2). Max 12.

### Pitch from angle

```js
function leafAngleToNote(leaf) {
  const t = (leaf.angle + Math.PI/3) / (2*Math.PI/3);  // 0..1
  const scale = Audio.scales[currentScale];
  const total = scale.length * 2;  // 2 octaves
  const idx = Math.clamp(Math.floor(t * total), 0, total-1);
  const octave = Math.floor(idx / scale.length);
  const degree = scale[idx % scale.length];
  return Audio.midiToNote(60 + octave*12 + degree);
}
```

Debounce: skip if `performance.now() - leaf.lastNoteTime < 80ms`.

### Audio

```js
synth = new Tone.PluckSynth({
  attackNoise: 1, dampening: 4000, resonance: 0.98
}).toDestination();
// PluckSynth retriggers cleanly — one shared instance is fine.
```

### Drawing

Leaf shape: `ctx.ellipse(0, 0, leaf.len, 8 + flash*6, 0, 0, Math.PI*2)`. Flash: `performance.now() - leaf.flashT` → interpolate fill lightness from 22% (rest) to 60% (hit) over 300ms.

Ball: circle r=8, white, `shadowBlur=24`. Trail: 20-point fading polyline.

Angle indicator: while user is rotating a leaf (within 1s of last rotate event), draw a subtle arc showing current angle from centre. Fades after 1s. Only UI hint — keeps interaction discoverable without cluttering.

### Keyboard

```
R         respawn ball
Space     randomise all leaf positions and angles
C         reset to default layout
1–5       switch scale
```

### Success criteria

- [ ] Ball bounces with gravity, reflects correctly off all leaves
- [ ] Leaf drag works on mouse and touch, has weighted feel (lerp)
- [ ] Scroll and pinch rotate leaves, constrained to ±60°
- [ ] Pitch tracks leaf angle correctly
- [ ] No audio double-trigger (80ms debounce)
- [ ] Ball resets when stuck or out of bounds
- [ ] Double-click add/remove works
- [ ] Flash animation visible on hit

---

## Module 3: Tracy

**Feel:** Drawing gives birth. You gesture, a creature is born from it, swims it forever.

### State

```js
let creatures = [];    // max 5
let drawing = null;    // in-progress raw path: [{x,y}]
let isDrawing = false;
const HUES = [200, 272, 344, 56, 128];  // one per slot
const SPEED = 1.5;                       // path-points per frame

// Each creature:
{
  path: [{x,y}],       // processed, evenly spaced 8px
  t: 0.0,              // float position, wraps at path.length
  hue: float,
  opacity: float,      // 0→1 on birth (500ms), 1→0 on removal
  synth: Tone.Synth,
  noteTimer: 0,
  noteEvery: int,
}
```

### Path processing (on pointer-up)

```js
function finalizePath(raw) {
  if (pathLength(raw) < 80) return;   // too short, discard silently

  let pts = chaikin(chaikin(raw));    // 2× Chaikin smoothing
  pts = resample(pts, 8);             // uniform 8px spacing
  // Close loop if endpoints are far apart:
  if (Math.hypot(pts[0].x - pts.at(-1).x, pts[0].y - pts.at(-1).y) > 16) {
    pts = [...pts, ...bridgeTo(pts.at(-1), pts[0], 8)];
  }
  spawnCreature(pts);
}

// Chaikin: each segment → two points at 25% and 75%
function chaikin(pts) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    out.push({ x: pts[i].x*0.75 + pts[i+1].x*0.25, y: pts[i].y*0.75 + pts[i+1].y*0.25 });
    out.push({ x: pts[i].x*0.25 + pts[i+1].x*0.75, y: pts[i].y*0.25 + pts[i+1].y*0.75 });
  }
  return out;
}
```

When spawning: if already 5 creatures, fade out oldest and remove it.

### Creature heading

```js
function headingAt(path, t) {
  const i = Math.floor(t) % path.length;
  const j = (i + 1) % path.length;
  return Math.atan2(path[j].y - path[i].y, path[j].x - path[i].x);
}
```

### Note timing

```js
// Target: one note every ~0.5s. At 60fps, SPEED=1.5: 90 pts/sec → 45 pts per 0.5s.
creature.noteEvery = Math.max(20, Math.round(path.length / (SPEED * 30)));
```

In update: advance `t`, decrement `noteTimer`, trigger note when it hits 0 (reset to `noteEvery`).

### Drawing

1. `clearRect` — full clear each frame
2. Each creature's path: thin polyline, `hsla(hue, 60%, 50%, 0.25)`
3. In-progress drawing: dashed white line following pointer
4. Each creature's fish body — see fish shape below

```js
function drawFish(ctx, x, y, angle, hue, opacity) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Body
  ctx.beginPath();
  ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI*2);
  ctx.fillStyle = `hsl(${hue}, 65%, 62%)`;
  ctx.shadowBlur = 14; ctx.shadowColor = `hsl(${hue}, 80%, 60%)`;
  ctx.fill();
  // Tail
  ctx.beginPath();
  ctx.moveTo(-12, 0); ctx.lineTo(-20, -6); ctx.lineTo(-20, 6);
  ctx.closePath();
  ctx.fillStyle = `hsl(${hue}, 55%, 48%)`;
  ctx.shadowBlur = 0;
  ctx.fill();
  ctx.restore();
}
```

### Audio

```js
// Per creature:
new Tone.Synth({
  oscillator: { type: 'triangle' },
  envelope: { attack: 0.05, decay: 0.2, sustain: 0.4, release: 1.2 }
}).toDestination()
// Note pitch: Audio.noteFromY(currentY, H, currentScale, 2)
// Duration: '16n'
```

### Keyboard

```
C / double-tap    clear all creatures
1–5               switch scale
```

### Success criteria

- [ ] Drawing creates smooth closed loop on canvas
- [ ] Creature spawns and swims at constant speed indefinitely
- [ ] Creature body faces direction of travel
- [ ] Max 5 creatures; 6th replaces oldest with fade
- [ ] Notes fire at consistent musical intervals
- [ ] Paths shorter than 80px discarded silently
- [ ] Double-click clears cleanly

---

## Module 4: Nanocarp

**Feel:** Disturbing a sleeping pond. The fish don't need you. But they notice you.

### State

```js
let fish = [];      // 40
let ripples = [];   // max 6
let synths = [];    // pool of 6 AMSynth
let currentScale = 'wholeTone';

// Each fish:
{
  x, y, vx, vy,
  angle: float,
  size: float,           // 6–9px
  hue: float,            // 170–210
  dartVx: 0, dartVy: 0,
  dartFrames: 0,
}

// Each ripple:
{
  x, y,
  r: 0,
  maxR: 280,
  speed: 2.5,
  opacity: 1.0,
  synthIndex: int,
  triggered: new Set(),
}
```

### Boids

```js
function boidForces(fish, all) {
  let sx=0,sy=0,ax=0,ay=0,cx=0,cy=0,sn=0,an=0,cn=0;
  for (const o of all) {
    if (o===fish) continue;
    const dx=o.x-fish.x, dy=o.y-fish.y, d=Math.hypot(dx,dy);
    if (d<30)  { sx-=dx/d; sy-=dy/d; sn++; }
    if (d<80)  { ax+=o.vx; ay+=o.vy; an++; }
    if (d<100) { cx+=o.x; cy+=o.y; cn++; }
  }
  let fx=0,fy=0;
  if (sn) { fx+=(sx/sn)*1.5; fy+=(sy/sn)*1.5; }
  if (an) { fx+=(ax/an-fish.vx)*0.8; fy+=(ay/an-fish.vy)*0.8; }
  if (cn) { fx+=(cx/cn-fish.x)*0.0005; fy+=(cy/cn-fish.y)*0.0005; }
  const m=60;
  if (fish.x<m) fx+=0.5; if (fish.x>W-m) fx-=0.5;
  if (fish.y<m) fy+=0.5; if (fish.y>H-m) fy-=0.5;
  return {fx,fy};
}
```

Speed cap: clamp `Math.hypot(vx,vy)` to 2.0. Min speed: 0.3 (add tiny random nudge if fish stalls).

### Ripple collision

```js
for (const f of fish) {
  if (ripple.triggered.has(f)) continue;
  const d = Math.hypot(f.x-ripple.x, f.y-ripple.y);
  if (d > ripple.r-8 && d < ripple.r+8) {
    ripple.triggered.add(f);
    const a = Math.atan2(f.y-ripple.y, f.x-ripple.x);
    f.dartVx = Math.cos(a)*5; f.dartVy = Math.sin(a)*5; f.dartFrames = 20;
    const midi = Audio.noteFromY(f.y, H, currentScale, 2);
    synths[ripple.synthIndex].triggerAttackRelease(Audio.midiToNote(midi), '8n');
  }
}
```

### Rendering

**Ripple:** Three concentric rings (r-6, r, r+6) at decreasing opacity — wave-packet look. No shadowBlur.

**Fish (no shadowBlur — 40 objects):**
```js
// Cheap glow alternative: faint oversized circle behind body
ctx.beginPath();
ctx.arc(0, 0, f.size*2, 0, Math.PI*2);
ctx.fillStyle = `hsla(${f.hue},50%,60%,0.12)`;
ctx.fill();
// Body
ctx.beginPath();
ctx.ellipse(0, 0, f.size, f.size*0.45, 0, 0, Math.PI*2);
ctx.fillStyle = `hsl(${f.hue},50%,${f.dartFrames>0?75:55}%)`;
ctx.fill();
```

### Audio

```js
synths = Array.from({length:6}, () =>
  new Tone.AMSynth({
    harmonicity: 3.5,
    envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.5 }
  }).toDestination()
);
```

Assign `synthIndex` to each ripple on spawn. Recycle the oldest ripple's synth if all 6 are active.

### Keyboard

```
Space     large ripple at canvas centre
R         scatter fish randomly
C         reset fish to default positions
1–5       switch scale
```

### Success criteria

- [ ] 40 fish exhibit visible flocking (separation, alignment, cohesion)
- [ ] Click spawns ripple, visibly expands
- [ ] Each fish triggered at most once per ripple
- [ ] Triggered fish dart away, then resume flocking
- [ ] Notes play on trigger, pitch tracks y-position
- [ ] Max 6 ripples; old ones fade correctly
- [ ] 60fps with 40 fish + 6 ripples simultaneously

---

## Index (`index.html`)

Simple routing menu. Four tiles, two columns, dark background. No canvas previews — keep it fast to build.

```html
<nav class="menu">
  <a href="luminaria/" class="tile">
    <span class="name">luminaria</span>
    <span class="desc">draw light paths through a living field</span>
  </a>
  <a href="hanenbow/" class="tile">
    <span class="name">hanenbow</span>
    <span class="desc">tune a bouncing instrument</span>
  </a>
  <a href="tracy/" class="tile">
    <span class="name">tracy</span>
    <span class="desc">draw a path, a creature is born in it</span>
  </a>
  <a href="nanocarp/" class="tile">
    <span class="name">nanocarp</span>
    <span class="desc">disturb a sleeping pond</span>
  </a>
</nav>
```

CSS: 2×2 grid desktop, single column mobile. Hover: subtle brighten + `scale(1.01)`. No further animation — the modules do the showing off.

---

## "Tap to begin" (every module)

```html
<div class="begin-screen" id="begin">touch to begin</div>
```

```js
const beginEl = document.getElementById('begin');
beginEl.style.pointerEvents = 'auto';

async function begin() {
  await Audio.init();
  beginEl.style.opacity = '0';
  beginEl.style.pointerEvents = 'none';
  setTimeout(() => beginEl.remove(), 700);
  startLoop();  // first call to requestAnimationFrame
}

beginEl.addEventListener('pointerdown', begin, { once: true });
```

The `requestAnimationFrame` loop does not start until `begin()` fires. Canvas is blank before first gesture.

---

## Definition of done

- [ ] All 4 modules run without errors in Chrome and Safari
- [ ] All modules work on iOS Safari (touch, audio gate)
- [ ] Every module has working "tap to begin" gate
- [ ] 60fps on a mid-range laptop under normal use
- [ ] No `console.error` during normal use
- [ ] Deployed to GitHub Pages, shareable URL
- [ ] `index.html` routes correctly to all four modules

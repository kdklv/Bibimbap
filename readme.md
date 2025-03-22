# Chaotic Physics Sound Sequencer 🎵

A generative music playground where chaos meets melody. Create unpredictable soundscapes by dropping particles into a physics-driven environment. Watch and listen as gravity, collisions, and rebounds transform random motion into emergent musical patterns.

## Quick Start
1. Open `index.html` in a modern browser
2. Click anywhere to begin
3. Drop particles and watch chaos unfold!

## Core Features
- **Chaotic Sound Generation** - Every collision creates unique melodic patterns
- **Physics-Driven Music** - Gravity and bounces influence the rhythm
- **Interactive Chaos** - Manipulate obstacles to shape the musical flow
- **Emergent Patterns** - Complex melodies from simple particle interactions
- **Multi-Particle System** - Create complex patterns with simultaneous particles
- **Advanced Obstacle Control** - Rotate and position obstacles with precision

## Controls

**Mouse**
- Click/Space: Drop particle
- Drag: Move obstacles
- Double-click: Remove obstacle
- Scroll: Rotate obstacle
- Middle-click: Alternative rotation method
- Right-click: Context menu for obstacle properties

**Keyboard**
- 1-5: Drop multiple particles
- R: Randomize obstacles
- C: Clear all
- Arrow keys: Rotate selected


**UI Elements**
- Scale selector
- Gravity control
- Bounce adjustment
- Sound preset selector
- Volume control
- Particle speed adjustment

## Tips for Chaos
- Stack obstacles to create complex bounce patterns
- Adjust gravity for different musical densities
- Use multiple particles for layered chaos
- Experiment with bounce values for varied rhythms
- Use different particle colors for visual tracking
- Combine rotation and positioning for intricate patterns
- Create symmetric layouts with mirrored obstacles
- Experiment with particle counts for density control

## Tech Stack
- p5.js (Graphics)
- Tone.js (Audio)
- Matter.js (Physics)

## Requirements
- Modern browser with Web Audio API
- JavaScript enabled

## Version History
- **v.01**: Initial release with basic physics, audio, and visual interactions.
- **v.02**: 
  - Revised Tone.js synth setup (in tone-setup.js) for better audio management.
  - Refined Matter.js obstacle and collision handling.
  - Enhanced UI controls with a glass-like overlay and updated interactivity.
  - Introduced a dedicated p5.js setup (p5-setup.js) for future improvements.
  - Additional visual effects for a richer experience.
- **v.03**:
  - Added multi-particle spawning system with number keys (1-5)
  - Implemented obstacle rotation controls with scroll wheel and arrow keys
  - Enhanced obstacle interaction with double-click removal feature
  - Introduced randomization feature with 'R' key for quick scene changes
  - Added 'C' key functionality for clearing all elements
  - Improved UI with scale selector and gravity/bounce controls
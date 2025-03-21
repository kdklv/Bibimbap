// Sound variables (now specific to Tone.js)
const scales = {
    pentatonic: ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5", "G5", "A5", "C6"],
    major: ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4", "D4", "E4", "F4", "G4"],
    minor: ["C3", "D3", "Eb3", "F3", "G3", "Ab3", "Bb3", "C4", "D4", "Eb4", "F4", "G4"],
    blues: ["C3", "Eb3", "F3", "Gb3", "G3", "Bb3", "C4", "Eb4", "F4", "Gb4", "G4", "Bb4"],
    gamelan: ["C3", "Db3", "Eb3", "G3", "Ab3", "C4", "Db4", "Eb4", "G4", "Ab4", "C5"],
};


// Create synths (now in a separate file)
let melodySynth;
let metalSynth;
let membraneSynth;
let pluckSynth;

function setupTone() {
    melodySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 },
    }).toDestination();

    metalSynth = new Tone.MetalSynth({
        frequency: 200,
        envelope: { attack: 0.001, decay: 0.1, release: 0.2 },
        harmonicity: 3.1,
        modulationIndex: 16,
        resonance: 4000,
        octaves: 1.5,
    }).toDestination();

    membraneSynth = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 },
    }).toDestination();

    pluckSynth = new Tone.PluckSynth({
        attackNoise: 2,
        dampening: 4000,
        resonance: 0.7,
    }).toDestination();
}

function playParticleSound(particle, note, volume, soundType = null) {
    if (!audioInitialized || Tone.getContext().state !== 'running') return;

    const now = Tone.now();
    if (now - lastSoundTime < MIN_SOUND_INTERVAL) return;

    lastSoundTime = now;

    if (soundType === null) {
        soundType = particle.soundType;
    }

    try {
        const playTime = now + 0.01;
        switch (soundType) {
            case 0: melodySynth.triggerAttackRelease(note, "16n", playTime, volume * 0.8); break;
            case 1: metalSynth.triggerAttackRelease(note, "32n", playTime, volume * 0.4); break;
            case 2: membraneSynth.triggerAttackRelease(note, "8n", playTime, volume * 0.6); break;
            case 3: pluckSynth.triggerAttackRelease(note, "16n", playTime, volume * 0.7); break;
        }
    } catch (e) {
        console.warn('Sound playback error:', e);
    }
}
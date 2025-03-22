// Sound variables (now specific to Tone.js)
const scales = {
    pentatonic: ["C4", "D4", "E4", "G4", "A4", "C5", "D5", "E5", "G5", "A5", "C6"],
    major: ["C3", "D3", "E3", "F3", "G3", "A3", "B3", "C4", "D4", "E4", "F4", "G4"],
    minor: ["C3", "D3", "Eb3", "F3", "G3", "Ab3", "Bb3", "C4", "D4", "Eb4", "F4", "G4"],
    blues: ["C3", "Eb3", "F3", "Gb3", "G3", "Bb3", "C4", "Eb4", "F4", "Gb4", "G4", "Bb4"],
    gamelan: ["C3", "Db3", "Eb3", "G3", "Ab3", "C4", "Db4", "Eb4", "G4", "Ab4", "C5"],
};


// Create synths with effects
let melodySynth;
let metalSynth;
let membraneSynth;
let pluckSynth;
let reverb;
let compressor;

function setupTone() {
    // Global effects to unify the sound palette
    const reverb = new Tone.Reverb({ decay: 1.5, preDelay: 0.01 }).toDestination();
    const compressor = new Tone.Compressor(-30, 3).toDestination();

    // Sound 0: MelodySynth - Smooth sine wave
    melodySynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "sine" },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
    }).connect(reverb).connect(compressor);

    // Sound 1: MetalSynth - Replaced with bell-like FMSynth
    metalSynth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 2,
        modulationIndex: 5,
        oscillator: { type: "sine" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.5 }
    }).connect(reverb).connect(compressor);

    // Sound 2: MembraneSynth - Kept as is, made polyphonic
    membraneSynth = new Tone.PolySynth(Tone.MembraneSynth, {
        pitchDecay: 0.05,
        octaves: 2,
        oscillator: { type: "sine" },
        envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.4 }
    }).connect(reverb).connect(compressor);

    // Sound 3: PluckSynth - Replaced with triangle-based MonoSynth
    pluckSynth = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 }
    }).connect(reverb).connect(compressor);
}

function playParticleSound(particle, note, volume, soundType = null) {
    if (!audioInitialized || Tone.getContext().state !== 'running') {
        console.log('Audio not initialized or running');
        return;
    }

    const now = Tone.now();
    console.log('Playing sound:', { note, volume, soundType }); // Add debug logging

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
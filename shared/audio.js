const Audio = {
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
  },
};

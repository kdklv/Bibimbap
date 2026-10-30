# Sound

Audio fidget language for the plankton toys. Web Audio only, no Tone.js, no samples.

The house sound is **pond**: dark warmth, slow chorus, quiet sub-bed, bubbles instead of clicks. There is no mix toggle.

The job is not “play a scale.” It is to make poking, dragging, looping, and releasing feel like a physical spinner: a detent on contact, a body that has weight, a room that answers.

Stolen from [Sound Machine](https://laurenloprete.github.io/sound-machine/) and rewritten as water:

- **Filter envelope** is the character of a note, not the oscillator type.
- **Bubbles** (`tick`) are contact. Pitch comes after.
- **Delay** is the room. Reverb is the water. Chorus is the underwater wobble.
- Held drones use `Audio.outDry` so they skip delay (delay on a drone flutters).
- Keys **1–5** still change scale.

Do not import square/saw defaults, SUCCESS/ERROR semantics, or the 4-step recorder. The toys already sequence in space.

---

## Signal chain

Everything lives in `shared/audio.js`. Call `Audio.init(opts)` inside the first pointer gesture.

```
toy voice
  → bus
      → master (dry)
      → convolver → reverbWet → master
      → delay ⇄ feedback → delayWet → master
      → chorus (modulated 24 ms) → chorusWet → master
  → warmth lowpass (~0.52 × toy cutoff) → speakers

pond bed (noise + beating 58/61 Hz)
  → warmth + a little reverb   (never into delay)

outDry (held drones)
  → master + reverb            (never delay / chorus)
```

`init` tames toy sends: reverb × 1.32 (cap 0.72), delay × 0.72, chorus default 0.26, bed default 0.024. Override with `opts.chorus` / `opts.bed`. Resumes on `visibilitychange` / `pageshow`.

---

## Shared verbs

### `Audio.tone(opts)`

Watery one-shot. Sine (optional quiet 3rd harmonic, fifth partial, or octave triangle) through a **closing lowpass**. Amp envelope is length. Filter envelope is identity.

| Field | Default | Notes |
|---|---|---|
| `midi` / `freq` | — | one required |
| `vol` | 0.12 | peak gain |
| `attack` | 0.01 | seconds |
| `decay` | 0.5 | seconds to near-silence |
| `filtOpen` | 2100 | Hz at start |
| `filtClose` | 230 | Hz after `filtTime` |
| `filtTime` | `decay * 0.55` | the fidget “give” |
| `harm` | 0 | 3rd-harmonic gain |
| `partial` | 0 | extra ratio (Tracy uses 1.5) |
| `oct` | 0 | octave-up triangle gain |
| `lfoHz` / `lfoDepth` | 0 | vibrato as fraction of freq |
| `slideFrom` / `slideTime` | 1 / 0 | pitch drop |
| `at` | 0 | start offset, seconds |

Hard cap: 10 overlapping tones.

### `Audio.tick(opts)`

A 110 ms pitch-slide bubble. Contact without a click.

### `Audio.ping(opts)`

Noise into a bandpass. Q and pitch are already muffled.

### `Audio.outDry(node)`

Held drones. Skips delay and chorus.

### `Audio.setDelay(wet)` / `Audio.setReverb(wet)`

Live sends. Slosh / Irid still drive delay from depth. Values are pond-scaled inside.

---

## Toy recipes

### Luminaria — grid spinner

Bus: reverb 0.36, delay 0.20 @ 250 ms.

| Event | Recipe | Why |
|---|---|---|
| Cell entry | `tick` 6 ms hp 2600 + `tone` close 3800→520 in 160 ms | detent of crossing a tooth |
| Loop lap (3rd pass, fade) | root `tone` then fifth at +90 ms | one lap around the fidget |

Pitch still tracks row via `noteFromY(..., 3 octaves)`.

### Hanenbow — wood + water

Bus: reverb 0.30, delay 0.16 @ 200 ms.

| Event | Recipe | Why |
|---|---|---|
| Leaf hit | `tick` 8 ms hp 1700 + `tone` close 3000→380 | wood, not a pad |
| Splash | pitch-slide sine + random 1.5/2/3 partial, `tick`, `ping` if speed > 3.5 | keep the 5-axis bloop; snap is the new contact |

Splash mapping (unchanged, still the best voice in the repo):

- x → base pitch
- speed → slide steepness + volume + ping
- ball radius → pitch inverse + decay
- random ±18% scatter

### Tracy — living path

Bus: reverb 0.42, delay 0.16 @ 280 ms (the path is a room).

| Event | Recipe | Why |
|---|---|---|
| Walk / draw | `tone` + 5th partial + 4.5 Hz vibrato, long decay, filter close over the tail | creature breath |
| Stir / scare | extra `tick` then shorter `tone` | poke vs presence |
| Spawn / meet | root + fifth, two `tone`s | bloom, not a fanfare |

### Nanocarp — school as harp

Bus: reverb 0.40, delay 0.13 @ 280 ms, chorus 0.20, bed 0.016.

| Event | Recipe | Why |
|---|---|---|
| Ripple tap | one low sine, 50 ms attack, 1.2 s decay, Q 0.65. No fifth. | the stone |
| Fish catch | that fish’s **stable scale degree**, 14 ms attack, 0.52 s decay, Q 0.6, quiet 3rd. Queued at 64 ms. | the wave is a pick; the school is the strings |
| Shore poke | same chirp queue | annoying them from the bank is the same verb |

Each fish keeps `voice` 0–9 across 2 octaves of the current scale, so teal vs blue stay distinct and overlapping notes are always in-key. High taps lift the school one octave. Queue (cap 18) staggers a dense wavefront into an arpeggio; same fish is not enqueued twice.

Unpleasant before: marimba 2nds + metallic fifth, then a boring unison octave ping. Harmonic swarm now.

### Cilia — kelp pad

Bus: reverb 0.42, delay 0.08 @ 340 ms, chorus 0.12, **bed off**. Drone is `outDry`.

| Event | Recipe | Why |
|---|---|---|
| Field drone | one 73 Hz sine. Comb opens the filter 120→880 Hz, barely moves pitch. | the grass humming, not a triad |
| Hair snap | one droplet per 180 ms, the most-bent hair only, 0.42 s decay, Q 0.65 | combing is a pad, not a machine gun |

Unpleasant before: 98/147/196 + triangle through slap delay + pond bed + a pluck every 80 ms. Mud plus kazoo.

### Slosh — blob as live knob

Bus: reverb 0.40, delay starts 0.10 @ 240 ms, **wet follows depth + roughness**.

| Event | Recipe | Why |
|---|---|---|
| Held drone | sine + octave, filter and Q from poke | the fidget’s continuous voice |
| Nucleus wall hit | `tick` + `tone` | membrane detent |
| Soft plucks | `tone` only | don’t click every stir |

Delay send: `0.08 + depth*0.22 + rough*0.18`.

### Irid — glass membrane

Bus: reverb 0.62 (already wet; do not add more), delay starts 0.12, **wet follows roughness**.

| Event | Recipe | Why |
|---|---|---|
| Held drone | same family as Slosh, more Q | the film singing |
| Finger down | `ping` at 2.2× the scale freq, Q 18, 90 ms throttle | glass tap |

### Lanterns — pulse bells

Bus: reverb 0.50, delay 0.16 @ 220 ms.

| Event | Recipe | Why |
|---|---|---|
| Fire | `playFlash` = `tick` + `ping`, then body `tone` with octave triangle | contact then glow |
| Overlap chord | fifth at +60 ms, other lantern at +120 ms | watery “ta-da”, not a brass hit |

---

## Adding a new toy

1. `Audio.init({ master, warmth, reverb, delay, delayTime, chorus, bed })` on first gesture.
2. Split **contact** (`tick`) from **body** (`tone`). Held drones use `Audio.outDry`.
3. Give a continuous fidget one live `setDelay` (depth, speed). Leave delay static on grids / paths / bells.
4. Stay sine. If a note needs identity, sweep the filter. Fire fewer notes than the physics would like.
5. Document the recipes in this file.

---

## What we did not steal

- Square / saw as the house oscillator
- Encoder knobs and an LCD
- A 4-step loop recorder
- Semantic UI slots (SUCCESS, ERROR, TAP)
- Kitten / Devo mood skins

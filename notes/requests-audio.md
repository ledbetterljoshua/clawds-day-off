# Audio: notes for the integrator and chapter authors

## Requests (core files I don't own)
1. **Remove two local overrides** so the library versions play: `audio.register('stamp', …)` in
   `src/core/diary.js` and `audio.register('crossing', …)` in `src/game.js`. Registered sounds win
   over the built-in library, and the built-ins are now richer (crossing is a distant two-bell
   signal on the ambience bus with reverb).
2. **Call `audio.stopLoops()` in `game.js` teardown** (and when an evening ends). Loops are global:
   a chapter that forgets `audio.loop('sizzle', 0)` would otherwise carry its sizzle into the diary.
3. **Settings UI**: `audio.setVolumes({ master, music, sfx, amb })`, `audio.volumes`, `audio.mute(v)`.
   Values are clamped 0..1 and applied with a short ramp. `game.js` already restores `save.setting('volumes')`.
4. Pause (`G.paused`) leaves music and ambience running, frozen at the paused sky phase. If you want
   the pause screen quieter, `audio.setMood('quiet')` on pause and restore the chapter mood after.

## How it behaves
- **Moods**: `setMood('day')` (the default) *follows the sky clock*: day → golden (王道進行) →
  dusk (丸サ進行) → night, `rain` while rain > 0.35, `title`/`quiet` on the cover/diary. Any other
  mood is held until changed: `title, golden, dusk, night, festival, quiet, rain, finale, off`.
  Changes land on the next bar line (≤ ~3 s).
- **Ambience** is automatic from `G.phase`: min-min cicadas by day, higurashi at dusk, crows at
  golden hour, crickets at night, wind, city hum, a far-off school chime when each evening starts,
  the odd bicycle bell and railway crossing. Override with
  `setAmbience({ cicada, higurashi, crickets, city, wind, rain, festival })`; `null` returns a key to
  automatic, `{}` clears everything. Rain hushes the insects.
- **Loops**: `audio.loop(name, level)` for `sizzle, bubble, water, steam, candle, sparkler, crowd,
  rain, wind`. Level 0 fades out and frees the nodes. Sparkler crackle density follows the level
  (drive it from the senkō stage).
- **One-shots**: `audio.sfx(name, { x, delay, gap, size, strength, pitch, i, n })`. Pass `x` (world x)
  for stereo placement. `voice` is called automatically from `crab.say`.
  Names: pop select deny chime done type stamp whoosh toast chop pour pick grind clunk slide scrape
  squeeze sprinkle flake slurp crunch ramune knock clack steam splash drip trickle paper fold snip brush
  tape match hiss creak thunder bell boom launch furin crossing chime-town voice.
- Loud sounds (`boom`, `thunder`) duck the music briefly.

## Tools
`tools/audio-lab.html` auditions everything (moods, sky phase, ambience overrides, loops, every
one-shot, the four voices) and has a "render & measure everything" button that renders each item
through the real mixer in an OfflineAudioContext and reports peak/RMS.

// Procedural audio: everything is synthesized ("made in code"). Three buses: music, sfx, ambience.
// Chapters add their own sounds with audio.register(name, fn) and play them with audio.sfx(name).
import { G } from './state.js';
import { clamp, rand, smooth } from './util.js';

const A = { ctx: null, buses: {}, noise: null, vol: { master: .8, music: .55, sfx: .8, amb: .7 }, muted: false, mood: 'day', amb: {} };
const registry = new Map();
let lastPlayed = new Map();

function ctxNow() { return A.ctx.currentTime; }

export const audio = {
  get ctx() { return A.ctx; },
  get ready() { return !!A.ctx; },
  get muted() { return A.muted; },

  init() {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const ctx = A.ctx = new (window.AudioContext || window.webkitAudioContext)();
    A.master = ctx.createGain(); A.master.gain.value = A.muted ? 0 : A.vol.master;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    A.master.connect(comp).connect(ctx.destination);
    for (const b of ['music', 'sfx', 'amb']) { const g = ctx.createGain(); g.gain.value = A.vol[b]; g.connect(A.master); A.buses[b] = g; }
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.noise = buf;
    startAmbience();
    startMusic();
  },

  mute(v = !A.muted) { A.muted = v; if (A.master) A.master.gain.value = v ? 0 : A.vol.master; return v; },
  setVolumes(v) { Object.assign(A.vol, v); for (const b in A.buses) A.buses[b].gain.value = A.vol[b]; if (A.master && !A.muted) A.master.gain.value = A.vol.master; },
  get volumes() { return { ...A.vol }; },

  // mood: 'day' | 'golden' | 'dusk' | 'night' | 'festival' | 'quiet' | 'title' | 'off'
  setMood(m) { A.mood = m; },
  // ambience levels 0..1: { cicada, higurashi, crickets, rain, city, wind }
  setAmbience(o) { Object.assign(A.amb, o); },

  register(name, fn) { registry.set(name, fn); },

  // play a named sound; opts are passed to the sound fn. Throttled per-name by opts.gap (seconds).
  sfx(name, opts = {}) {
    if (!A.ctx || A.muted) return;
    const fn = registry.get(name); if (!fn) return;
    const gap = opts.gap ?? 0, now = ctxNow();
    if (gap && now - (lastPlayed.get(name) || -9) < gap) return;
    lastPlayed.set(name, now);
    try { fn(opts); } catch (e) { console.warn('sfx', name, e); }
  },

  tone, noise,
  update(dt) { updateAmbience(dt); },
};

// ── primitives ──
export function tone(f, dur, type = 'sine', vol = .2, slide, { delay = 0, bus = 'sfx', attack = .01, pan = 0 } = {}) {
  if (!A.ctx) return; const c = A.ctx, t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  let out = g;
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
  o.connect(g); out.connect(A.buses[bus]); o.start(t); o.stop(t + dur + .05);
}
export function noise(dur, type, freq, vol, q = 1, { delay = 0, bus = 'sfx', attack = .002, pan = 0 } = {}) {
  if (!A.ctx) return; const c = A.ctx, t = c.currentTime + delay;
  const s = c.createBufferSource(); s.buffer = A.noise;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  let out = g;
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); out = p; }
  s.connect(f).connect(g); out.connect(A.buses[bus]); s.start(t, Math.random()); s.stop(t + dur + .05);
}

// ── core sound library ──
const R = (n, f) => audio.register(n, f);
R('pop', () => tone(380, .14, 'sine', .22, 900));
R('chime', () => { tone(880, .3, 'triangle', .12); tone(1318, .45, 'triangle', .1, null, { delay: .09 }); });
R('done', () => { tone(660, .2, 'triangle', .12); tone(990, .3, 'triangle', .1, null, { delay: .08 }); tone(1320, .5, 'triangle', .08, null, { delay: .16 }); });
R('grind', () => noise(.07, 'bandpass', 2600, .12, 1.5));
R('clunk', () => { tone(160, .12, 'square', .05, 90); noise(.06, 'lowpass', 900, .2); });
R('chop', () => { noise(.05, 'highpass', 2800, .3); tone(200, .06, 'square', .04); });
R('pour', () => noise(.18, 'bandpass', 700 + Math.random() * 300, .1, 3));
R('pick', () => noise(.08, 'highpass', 1800, .12));
R('slide', () => tone(300, .5, 'sine', .07, 520));
R('type', () => noise(.025, 'highpass', 3500, .05));
R('select', () => tone(520, .09, 'sine', .12, 780));
R('deny', () => { tone(240, .12, 'square', .04, 180); });
R('whoosh', () => noise(.4, 'bandpass', 900, .12, .7, { attack: .15 }));
R('boom', ({ delay = 0, size = 1 } = {}) => {
  noise(1.6 * size, 'lowpass', 140, .7 * size, 1, { delay });
  for (let i = 0; i < 10; i++) noise(.04, 'highpass', 5000, .05, 1, { delay: delay + .25 + Math.random() * .7 });
});
R('launch', () => noise(.9, 'bandpass', 1400, .06, 2, { attack: .3 }));
// furin: a small glass bell, a few inharmonic partials with a long tail
R('furin', ({ strength = .6 } = {}) => {
  const f = rand(2350, 2650), v = .03 + .05 * strength;
  [[1, 1], [2.32, .5], [3.9, .3], [5.4, .15]].forEach(([m, a], i) => tone(f * m, 2.2 - i * .35, 'sine', v * a, null, { bus: 'amb', attack: .003, pan: -.35 }));
});

// ── ambience: cicadas by day, higurashi at dusk, crickets at night ──
let ambNodes = null;
function startAmbience() {
  const ctx = A.ctx;
  const src = ctx.createBufferSource(); src.buffer = A.noise; src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4700; bp.Q.value = 6;
  const pulse = ctx.createGain(); pulse.gain.value = .5;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 42; const lg = ctx.createGain(); lg.gain.value = .5; lfo.connect(lg).connect(pulse.gain);
  const cic = ctx.createGain(); cic.gain.value = 0;
  src.connect(bp).connect(pulse).connect(cic).connect(A.buses.amb); src.start(); lfo.start();
  ambNodes = { cic, crickT: 0, higT: 3 };
}
function updateAmbience(dt) {
  if (!ambNodes) return;
  const p = G.phase;
  const cicada = A.amb.cicada ?? (1 - smooth(.55, .8, p));
  ambNodes.cic.gain.value = cicada * .05 * (.6 + .4 * Math.sin(G.time * .4));
  // higurashi: the descending "kana-kana-kana" of evening cicadas
  const hig = A.amb.higurashi ?? (smooth(.45, .65, p) * (1 - smooth(.85, .95, p)));
  ambNodes.higT -= dt;
  if (hig > .05 && ambNodes.higT <= 0) {
    ambNodes.higT = rand(5, 11);
    const base = rand(4200, 4800), n = 9 + Math.floor(Math.random() * 6), pan = rand(-.7, .7);
    for (let i = 0; i < n; i++) {
      const f = base * (1 - i * .012);
      tone(f, .09, 'sine', .018 * hig * (1 - i / n * .6), f * .93, { delay: i * .11, bus: 'amb', pan });
    }
  }
  // crickets at night
  const cr = A.amb.crickets ?? smooth(.8, 1, p);
  ambNodes.crickT -= dt;
  if (cr > .05 && ambNodes.crickT <= 0) {
    ambNodes.crickT = rand(.6, 1.6);
    const pan = rand(-.8, .8);
    for (let i = 0; i < 3; i++) tone(rand(4000, 4400), .05, 'sine', .015 * cr, null, { delay: i * .07, bus: 'amb', pan });
  }
}

// ── music: a slow music box that reads the mood ──
function startMusic() {
  const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19];
  let step = 0, note = 4;
  setInterval(() => {
    if (!A.ctx || A.muted || A.mood === 'off' || A.mood === 'quiet') return;
    step++;
    if (step % 8 === 0 || Math.random() < .55) {
      note = clamp(note + Math.floor(rand(-2, 3)), 0, scale.length - 1);
      const base = A.mood === 'night' || A.mood === 'dusk' ? 220 : 261.6;
      tone(base * Math.pow(2, scale[note] / 12) * 2, .9, 'triangle', .035, null, { bus: 'music' });
      if (step % 4 === 0) tone(base * Math.pow(2, scale[(note + 2) % scale.length] / 12), 1.4, 'sine', .03, null, { bus: 'music' });
    }
  }, 380);
}

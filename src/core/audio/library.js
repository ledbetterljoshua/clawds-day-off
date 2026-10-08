// The named sound library (one-shots) and the persistent loops. Every one-shot reads
// opts.delay; stereo position comes from opts.x via E.pan, which the primitives default to.
import { E, tone, noise, bell, rnd, dest, duck, env } from './engine.js';
import { crossing as crossingAt, chime } from './ambience.js';

export const library = new Map();
const R = (name, fn) => library.set(name, fn);
const T = o => E.cur.ctx.currentTime + (o.delay || 0);
const at = (o, extra = 0) => ({ t0: T(o) + extra });

// ── interface ──
R('pop', o => { tone(380, .14, 'sine', .1, 900, at(o)); noise(.02, 'highpass', 3200, .02, .7, at(o)); });
// a hop (pyon) and a soft wooden landing; helpers are smaller, so higher and quieter
R('jump', o => { const k = o.small ? 1.4 : 1, g = o.small ? .6 : 1; tone(260 * k, .17, 'sine', .075 * g, 700 * k, at(o)); tone(520 * k, .1, 'triangle', .022 * g, 1300 * k, at(o, .015)); });
R('land', o => { const k = o.small ? 1.35 : 1, v = (.35 + .65 * (o.v ?? 1)) * (o.small ? .6 : 1); tone(150 * k, .09, 'triangle', .085 * v, 80 * k, at(o)); noise(.045, 'bandpass', 650 * k, .05 * v, 1.3, at(o)); });
R('select', o => { tone(520, .08, 'sine', .1, 780, at(o)); tone(780, .1, 'sine', .055, 1040, at(o, .05)); });
R('deny', o => { tone(240, .14, 'triangle', .085, 170, at(o)); tone(180, .16, 'triangle', .065, 130, at(o, .09)); });
R('chime', o => { tone(880, .35, 'triangle', .1, null, { ...at(o), send: .2 }); tone(1318.5, .5, 'triangle', .085, null, { ...at(o, .09), send: .25 }); });
R('done', o => {
  [660, 990, 1320].forEach((f, i) => tone(f, .3 + i * .1, 'triangle', .1 - i * .015, null, { ...at(o, i * .08), send: .2 }));
  bell(T(o) + .24, 2640, .5, .012, [[1, 1], [2.1, .3]], { send: .3 });
});
R('type', o => { noise(.022, 'highpass', rnd(3200, 4800), .04, .7, at(o)); tone(rnd(140, 180), .02, 'square', .005, null, at(o)); });
R('stamp', o => {
  noise(.13, 'lowpass', 480, .22, .8, { ...at(o), color: 'brown' }); tone(110, .18, 'sine', .12, 68, at(o));
  noise(.09, 'bandpass', 2400, .03, .8, at(o, .02));
});
R('whoosh', o => noise(.45, 'bandpass', 600, .2, .8, { ...at(o), attack: .18, sweep: 2200, color: 'pink' }));
R('toast', o => { const t = T(o); bell(t, 1046.5, .7, .045, [[1, 1], [2.01, .2], [3, .08]], { send: .25 }); bell(t + .07, 1568, .8, .038, [[1, 1], [2.01, .2]], { send: .3 }); });

// ── kitchen ──
R('chop', o => {
  noise(.045, 'highpass', 2800, .09, .7, at(o));
  noise(.07, 'bandpass', 320, .06, 1.5, { ...at(o), color: 'brown' });
  tone(190, .06, 'triangle', .03, 140, at(o));
});
R('pour', o => {
  noise(.2, 'bandpass', rnd(650, 1000), .15, 3, { ...at(o), attack: .03, color: 'pink' });
  if (Math.random() < .6) tone(rnd(260, 380), .07, 'sine', .028, rnd(500, 700), at(o, rnd(0, .1)));
});
R('pick', o => { noise(.07, 'highpass', 1800, .065, .7, at(o)); tone(rnd(900, 1300), .03, 'triangle', .014, null, at(o)); });
R('grind', o => { noise(.07, 'bandpass', rnd(2200, 3200), .08, 1.4, at(o)); noise(.04, 'highpass', 5000, .036, .7, at(o, .02)); });
R('clunk', o => { tone(160, .13, 'square', .035, 90, at(o)); noise(.07, 'lowpass', 900, .17, .7, { ...at(o), color: 'brown' }); tone(320, .05, 'triangle', .03, null, at(o)); });
R('slide', o => { noise(.55, 'bandpass', 700, .07, 1.2, { ...at(o), attack: .12, sweep: 1100, color: 'pink' }); tone(300, .5, 'sine', .032, 520, at(o)); });
R('scrape', o => { const f = rnd(3000, 3800); noise(.16, 'bandpass', f, .22, 6, { ...at(o), attack: .01, sweep: f * rnd(.75, 1.15) }); tone(f * .85, .12, 'sawtooth', .012, null, at(o)); });
R('squeeze', o => { noise(.32, 'bandpass', 900, .2, 3, { ...at(o), attack: .04, sweep: 1700, color: 'pink' }); noise(.1, 'lowpass', 420, .12, 1, { ...at(o, .22), color: 'brown' }); });
R('sprinkle', o => { for (let i = 0; i < 14; i++) noise(.012, 'highpass', rnd(4000, 8000), rnd(.02, .045), 1, at(o, rnd(0, .45))); });
R('flake', o => { noise(.18, 'bandpass', rnd(3000, 5000), .055, 1.5, { ...at(o), attack: .04 }); for (let i = 0; i < 3; i++) noise(.006, 'highpass', 6000, .04, .7, at(o, rnd(.02, .16))); });
R('slurp', o => {
  // "zuzuzu": a fluttering, rising suck
  const c = E.cur.ctx, t = T(o), s = c.createBufferSource(); s.buffer = E.cur.noise.pink;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.5; bp.frequency.setValueAtTime(800, t); bp.frequency.exponentialRampToValueAtTime(1900, t + .55);
  const am = c.createGain(); am.gain.value = .55; const fl = c.createOscillator(); fl.frequency.value = rnd(22, 28); const fg = c.createGain(); fg.gain.value = .45; fl.connect(fg).connect(am.gain);
  const g = c.createGain(); env(g.gain, t, .05, .6, .36, .3);
  s.connect(bp).connect(am).connect(g).connect(dest('sfx', E.pan)); s.start(t, Math.random()); fl.start(t); s.stop(t + .7); fl.stop(t + .7);
});
R('crunch', o => { for (let i = 0; i < 4; i++) noise(.03, 'bandpass', rnd(1500, 4000), rnd(.07, .13), .8, at(o, i * rnd(.02, .05))); });
R('ramune', o => {
  // the marble drops into the bottle: a sharp tok, a fizz, the marble rattling
  tone(1400, .03, 'sine', .11, 700, at(o)); noise(.02, 'highpass', 2000, .14, .7, at(o));
  noise(.9, 'highpass', 5500, .045, .7, { ...at(o, .03), attack: .01 });
  bell(T(o) + .09, 2800, .18, .02, [[1, 1], [2.3, .4]]); bell(T(o) + .17, 3100, .14, .014, [[1, 1], [2.3, .4]]);
});
R('knock', o => {
  const f = 480 * (o.pitch || 1) * rnd(.95, 1.05);
  tone(f, .16, 'sine', .11, f * .97, at(o)); tone(f * 2.7, .06, 'sine', .028, null, at(o)); noise(.012, 'bandpass', f * 4, .055, 2, at(o));
});
R('clack', o => { for (const d of [0, .07]) { noise(.012, 'bandpass', 2600, .24, 4, at(o, d)); tone(1900, .025, 'triangle', .06, null, at(o, d)); } });
R('steam', o => noise(.7, 'highpass', 4200, .05, .7, { ...at(o), attack: .05 }));

// ── water ──
R('splash', o => {
  noise(.35, 'bandpass', 1200, .24, .7, { ...at(o), attack: .005, sweep: 500, color: 'pink' });
  for (let i = 0; i < 5; i++) tone(rnd(1000, 2200), .05, 'sine', .028, rnd(1800, 3000), at(o, rnd(.03, .25)));
});
R('drip', o => { tone(rnd(700, 900), .07, 'sine', .075, rnd(1500, 1900), at(o)); noise(.008, 'highpass', 3000, .018, .7, at(o)); });
R('trickle', o => { for (let i = 0; i < 8; i++) tone(rnd(700, 1300), .05, 'sine', .028, rnd(1400, 2400), at(o, i * rnd(.07, .12))); });

// ── paper & craft ──
R('paper', o => { for (let i = 0; i < 3; i++) noise(rnd(.07, .14), 'bandpass', rnd(3000, 4500), .075, .9, { ...at(o, i * rnd(.05, .09)), attack: .02 }); });
R('fold', o => { noise(.12, 'bandpass', 2500, .055, 1, { ...at(o), attack: .03, sweep: 4000 }); noise(.01, 'highpass', 4000, .055, .7, at(o, .11)); });
R('snip', o => {
  for (const d of [0, .06]) { noise(.015, 'highpass', 5000, .09, .7, at(o, d)); tone(3200, .03, 'triangle', .018, null, at(o, d)); }
  noise(.06, 'bandpass', 6000, .028, 2, at(o, .01));
});
R('brush', o => noise(.42, 'bandpass', 2200, .18, .8, { ...at(o), attack: .08, sweep: 1200, color: 'pink' }));
R('tape', o => {
  const c = E.cur.ctx, t = T(o), s = c.createBufferSource(); s.buffer = E.cur.noise.white;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 1.5;
  const am = c.createGain(); am.gain.value = .5; const fl = c.createOscillator(); fl.type = 'square'; fl.frequency.value = rnd(50, 65); const fg = c.createGain(); fg.gain.value = .5; fl.connect(fg).connect(am.gain);
  const g = c.createGain(); env(g.gain, t, .02, .38, .12, .2);
  s.connect(bp).connect(am).connect(g).connect(dest('sfx', E.pan)); s.start(t, Math.random()); fl.start(t); s.stop(t + .45); fl.stop(t + .45);
});

// ── fire ──
R('match', o => {
  noise(.12, 'highpass', 2500, .09, .8, { ...at(o), sweep: 6000 });
  noise(.5, 'lowpass', 500, .07, .7, { ...at(o, .08), attack: .12, color: 'brown' });
  for (let i = 0; i < 4; i++) noise(.006, 'highpass', 5000, .03, .7, at(o, rnd(.1, .4)));
});
R('hiss', o => noise(.6, 'highpass', 4500, .065, .7, { ...at(o), attack: .02 }));
// a senko sparkler's little pops
R('crackle', o => { const n = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) noise(.007, 'highpass', rnd(4000, 7000), rnd(.02, .045), .8, at(o, rnd(0, .09))); });
// the glowing bead falling off: a soft tsk and a short fizz
R('bead-drop', o => {
  const k = o && o.soft ? .5 : 1;
  noise(.05, 'bandpass', 2400, .05 * k, 1.2, at(o));
  noise(.35, 'highpass', 5200, .03 * k, .7, { ...at(o, .03), attack: .01 });
  tone(900, .12, 'sine', .02 * k, 300, at(o));
});

// ── outdoors ──
R('creak', o => {
  const c = E.cur.ctx, t = T(o), dur = .55 * (o.size || 1), osc = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain();
  osc.type = 'sawtooth';
  const curve = new Float32Array(16); for (let i = 0; i < 16; i++) curve[i] = rnd(95, 150);
  osc.frequency.setValueCurveAtTime(curve, t, dur);
  bp.type = 'bandpass'; bp.frequency.value = 750; bp.Q.value = 4;
  env(g.gain, t, .05, dur, .12, dur * .5);
  osc.connect(bp).connect(g).connect(dest('sfx', E.pan)); osc.start(t); osc.stop(t + dur + .05);
});
R('thunder', o => {
  // distant: a long rolling rumble; size > 1 brings it closer with a crack first
  const t = T(o), size = o.size || 1, dur = 2.6 + size * 1.4;
  if (size > 1.3) noise(.25, 'highpass', 1800, .1 * size, .7, { t0: t, attack: .003 });
  for (let i = 0; i < 5; i++) noise(dur * rnd(.4, .9), 'lowpass', rnd(90, 160), .2 * size * rnd(.5, 1), .7, { t0: t + rnd(0, dur * .4), attack: rnd(.05, .4), color: 'brown', send: .4, bus: 'amb' });
  duck(.7, o.delay || 0, 2.5);
});
R('bell', o => bell(T(o), 880 * (o.pitch || 1), 2.2, .055, [[1, 1, 1], [2.01, .4, .7], [2.76, .3, .5], [5.4, .12, .3]], { send: .35 }));
R('boom', o => {
  const t = T(o), size = o.size || 1;
  noise(1.6 * size, 'lowpass', 140, .55 * size, 1, { t0: t, attack: .004, color: 'brown', send: .45 });
  tone(62, .5, 'sine', .22 * size, 34, { t0: t, attack: .003 });
  noise(.06, 'highpass', 900, .08 * size, .7, { t0: t });
  for (let i = 0; i < 12; i++) noise(.035, 'highpass', rnd(4000, 7000), rnd(.02, .045), 1, { t0: t + .25 + Math.random() * .9, send: .3 });
  duck(.55, o.delay || 0, 1.8);
});
R('launch', o => {
  // the rising "hyuuu" whistle of a firework shell
  const c = E.cur.ctx, t = T(o), osc = c.createOscillator(), g = c.createGain(), vib = c.createOscillator(), vg = c.createGain();
  osc.frequency.setValueAtTime(rnd(500, 650), t); osc.frequency.exponentialRampToValueAtTime(rnd(1700, 2100), t + 1.05);
  vib.frequency.value = 14; vg.gain.value = 18; vib.connect(vg).connect(osc.frequency);
  g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.036, t + .15); g.gain.setValueAtTime(.036, t + .8); g.gain.exponentialRampToValueAtTime(.0001, t + 1.1);
  osc.connect(g).connect(dest('sfx', E.pan, .3)); osc.start(t); vib.start(t); osc.stop(t + 1.15); vib.stop(t + 1.15);
  noise(.9, 'bandpass', 1400, .025, 2, { t0: t, attack: .3 });
});
R('furin', o => {
  // a glass wind bell: inharmonic partials, a long tail, and the clapper's little second tap
  const t = T(o), s = o.strength ?? .6, f = rnd(2350, 2650), v = .022 + .04 * s, P = [[1, 1, 1], [2.32, .45, .7], [3.9, .28, .5], [5.4, .14, .35], [7.1, .06, .25]];
  bell(t, f, 2.6, v, P, { bus: 'amb', pan: -.25, send: .3 });
  if (s > .35) bell(t + rnd(.08, .13), f * 1.003, 1.6, v * .35, P, { bus: 'amb', pan: -.25, send: .3 });
});
R('crossing', o => { crossingAt(T(o), { far: o.far ?? .55, n: o.n ?? 10 }); });
R('chime-town', o => { chime(T(o), o.level ?? 1); });

// ── voices: soft babble when a crab talks. i: 0..2 helpers, 3 Clawd ──
const VOICES = [
  { base: 430, type: 'sine', formants: [1700, 2300], step: .068, vol: .13 },       // helper 1: bright, precise
  { base: 330, type: 'triangle', formants: [1100, 1500], step: .085, vol: .1, breath: true },    // helper 2: soft, breathy
  { base: 520, type: 'square', formants: [1400, 2000], step: .06, vol: .05 },      // helper 3: quick, buzzy
  { base: 175, type: 'triangle', formants: [700, 1100], step: .09, vol: .13 },     // clawd: low, warm
];
R('voice', o => {
  const V = VOICES[o.i ?? 3] || VOICES[3], c = E.cur.ctx, n = Math.max(1, Math.min(8, Math.round((o.n || 6) / 3)));
  let t = T(o);
  for (let k = 0; k < n; k++) {
    const last = k === n - 1, f = V.base * Math.pow(2, (rnd(-2, 3) + (last ? -1.5 : 0)) / 12);
    const osc = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain(), len = V.step * rnd(.75, 1.15) * (last ? 1.6 : 1);
    osc.type = V.type; osc.frequency.setValueAtTime(f, t); osc.frequency.linearRampToValueAtTime(f * (last ? .9 : rnd(.96, 1.06)), t + len);
    bp.type = 'bandpass'; bp.frequency.value = V.formants[k % 2] * rnd(.9, 1.1); bp.Q.value = 1.4;
    env(g.gain, t, .008, len, V.vol * rnd(.8, 1));
    osc.connect(bp).connect(g).connect(dest('sfx', E.pan)); osc.start(t); osc.stop(t + len + .03);
    if (V.breath) noise(len, 'bandpass', 2400, V.vol * .25, 1.2, { t0: t, attack: .01 });
    t += len + V.step * rnd(.15, .45);
  }
});

// ── loops: persistent sounds whose level is set by audio.loop(name, level) ──
function chain(src, nodes, out) { let n = src; for (const x of nodes) { n.connect(x); n = x; } n.connect(out); }
function noiseSrc(color) { const c = E.cur.ctx, s = c.createBufferSource(); s.buffer = E.cur.noise[color]; s.loop = true; s.start(c.currentTime, Math.random() * 2.5); return s; }
function filt(type, f, q = .7) { const x = E.cur.ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
function modGain(base, rate, depth, type = 'sine') {
  const c = E.cur.ctx, g = c.createGain(); g.gain.value = base;
  const o = c.createOscillator(); o.type = type; o.frequency.value = rate; const d = c.createGain(); d.gain.value = depth; o.connect(d).connect(g.gain); o.start();
  return { node: g, osc: o };
}

const LOOPS = {
  sizzle: {
    gain: .035, bus: 'sfx',
    build(out) { const s = noiseSrc('white'), m = modGain(.8, 7.3, .2, 'triangle'); chain(s, [filt('highpass', 2600), filt('peaking', 6000, 1.2), m.node], out); return [s, m.osc]; },
    rate: l => 6 + l * 34,
    grain(t, l) { noise(rnd(.006, .03), 'bandpass', rnd(2500, 7000), rnd(.02, .06) * l, 1.5, { t0: t, pan: rnd(-.25, .25) }); },
  },
  bubble: {
    gain: .04, bus: 'sfx',
    build(out) { const s = noiseSrc('brown'); chain(s, [filt('lowpass', 260)], out); return [s]; },
    rate: l => 3 + l * 12,
    grain(t, l) { const f = rnd(180, 380); tone(f, rnd(.04, .08), 'sine', rnd(.02, .04) * l, f * rnd(1.8, 2.6), { t0: t, pan: rnd(-.2, .2), attack: .004 }); },
  },
  water: {
    gain: .09, bus: 'amb',
    build(out) {
      const s = noiseSrc('pink'), bp = filt('bandpass', 1100, .6), c = E.cur.ctx;
      const o = c.createOscillator(); o.frequency.value = .13; const d = c.createGain(); d.gain.value = 350; o.connect(d).connect(bp.frequency); o.start();
      const m = modGain(.85, .7, .15);
      chain(s, [bp, m.node], out);
      const s2 = noiseSrc('white'), hp = filt('highpass', 5000), g2 = c.createGain(); g2.gain.value = .25; chain(s2, [hp, g2], out);
      return [s, s2, o, m.osc];
    },
    rate: l => 2 + l * 9,
    grain(t, l) { tone(rnd(800, 1500), .035, 'sine', rnd(.008, .02) * l, rnd(1600, 2600), { t0: t, bus: 'amb', pan: rnd(-.6, .6), attack: .003 }); },
  },
  steam: {
    gain: .03, bus: 'sfx',
    build(out) { const s = noiseSrc('white'), m = modGain(.75, .9, .25); chain(s, [filt('highpass', 4200), filt('bandpass', 7000, .5), m.node], out); return [s, m.osc]; },
  },
  candle: {
    gain: .028, bus: 'amb',
    build(out) { const s = noiseSrc('brown'), m = modGain(.6, .7, .4); chain(s, [filt('lowpass', 230), m.node], out); return [s, m.osc]; },
    rate: l => .4 + l * .8,
    grain(t, l) { noise(.008, 'highpass', 3500, .012 * l, .7, { t0: t, bus: 'amb' }); },
  },
  sparkler: {
    // senkō hanabi: a faint fizz plus crackles whose density follows the level
    gain: .012, bus: 'sfx',
    build(out) { const s = noiseSrc('white'); chain(s, [filt('highpass', 7000)], out); return [s]; },
    rate: l => 4 + l * 70,
    grain(t, l) {
      const big = Math.random() < .05 * l, n = big ? 5 : 1;
      for (let k = 0; k < n; k++) {
        const tt = t + k * rnd(.008, .02);
        if (Math.random() < .6) noise(rnd(.003, .012), 'highpass', rnd(4000, 9000), rnd(.02, .05) * (.4 + l * .6), .7, { t0: tt, pan: rnd(-.15, .15) });
        else tone(rnd(3000, 6500), .012, 'sine', rnd(.006, .014), null, { t0: tt, attack: .001, pan: rnd(-.15, .15) });
      }
    },
  },
  crowd: {
    gain: .11, bus: 'amb',
    build(out) {
      const c = E.cur.ctx, s = noiseSrc('pink'), mix = c.createGain(), nodes = [s];
      for (const f of [480, 1050, 2300]) {
        const bp = filt('bandpass', f, 3), m = modGain(.6, rnd(.2, .6), .4); s.connect(bp).connect(m.node).connect(mix); nodes.push(m.osc);
      }
      mix.connect(out); return nodes;
    },
    rate: l => .05 + l * .12,
    grain(t, l) { noise(1.6, 'bandpass', 900, .05 * l, 1.2, { t0: t, bus: 'amb', attack: .35, color: 'pink', send: .4 }); },
  },
};
export const LOOP_NAMES = [...Object.keys(LOOPS), 'rain', 'wind'];

export function loopState() { return {}; }

export function setLoop(ls, name, level, when = null) {
  const def = LOOPS[name]; if (!def) return false;
  const c = E.cur.ctx, now = when ?? c.currentTime;
  let L = ls[name];
  if (!L) L = ls[name] = { level: 0, nodes: null, out: null, nextT: now, zeroAt: null };
  L.level = Math.max(0, Math.min(1, level));
  if (L.level > 0 && !L.nodes) {
    L.out = c.createGain(); L.out.gain.value = 0; L.out.connect(dest(def.bus, 0, def.bus === 'amb' ? .15 : 0));
    L.nodes = def.build(L.out); L.nextT = now;
  }
  if (L.out) L.out.gain.setTargetAtTime(L.level * def.gain, now, .12);
  L.zeroAt = L.level > 0 ? null : now;
  return true;
}

export function scheduleLoops(ls, t0, t1) {
  for (const name in ls) {
    const L = ls[name], def = LOOPS[name];
    if (!L.nodes) continue;
    if (L.level <= 0) {
      if (L.zeroAt != null && t0 - L.zeroAt > 1.5) {   // fully faded: release the nodes
        for (const n of L.nodes) { try { n.stop(); } catch { } }
        L.out.disconnect(); L.nodes = null; L.out = null;
      }
      continue;
    }
    if (!def.grain) continue;
    if (L.nextT < t0) L.nextT = t0;
    let guard = 0;
    while (L.nextT < t1 && guard++ < 200) { def.grain(L.nextT, L.level); L.nextT += -Math.log(1 - Math.random()) / def.rate(L.level); }
  }
}

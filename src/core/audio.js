// Procedural audio: everything is synthesized ("made in code"). Three buses: music, sfx, ambience.
// Chapters add their own sounds with audio.register(name, fn) and play them with audio.sfx(name).
//
// Moods: title, day, golden, dusk, night, festival, quiet, rain, finale, off.
// 'day' (the default) follows the sky clock: day → golden → dusk → night, rain when it rains,
// and the title/diary screens get their own. Any other mood is held until changed.
import { G } from './state.js';
import { E, makeBundle, tone, noise, panOf } from './audio/engine.js';
import { musicState, scheduleMusic, MOODS } from './audio/music.js';
import { ambState, scheduleAmbience } from './audio/ambience.js';
import { library, loopState, setLoop, scheduleLoops, LOOP_NAMES } from './audio/library.js';

export { tone, noise };

const LOOKAHEAD = .35;
const A = {
  vol: { master: .8, music: .55, sfx: .8, amb: .7 }, muted: false, mood: 'day', amb: {},
  rainLoop: 0, windLoop: 0, pending: new Map(), timer: null, perf: { ticks: 0, ms: 0, max: 0 },
};
const user = new Map();
const lastPlayed = new Map();

function resolveMood() {
  const m = A.mood;
  if (m !== 'day' && m !== 'auto') return m;
  if (G.mode === 'title') return 'title';
  if (G.mode === 'diary') return 'quiet';
  if (Math.max(A.amb.rain ?? 0, A.rainLoop) > .35) return 'rain';
  const p = G.phase;
  return p < .42 ? 'day' : p < .68 ? 'golden' : p < .86 ? 'dusk' : 'night';
}

function ambInputs() { return { phase: G.phase, mode: G.mode, amb: A.amb, rainLoop: A.rainLoop, windLoop: A.windLoop }; }

// schedule everything that starts within the lookahead window; driven by the frame loop and,
// as a fallback, a timer (so music keeps time even when frames hitch)
function tick() {
  const b = E.live; if (!b || b.ctx.state !== 'running') return;
  const s = performance.now();
  E.cur = b; E.pan = 0;
  const t0 = b.ctx.currentTime, t1 = t0 + LOOKAHEAD;
  try {
    scheduleMusic(b.state.music, t0, t1, resolveMood());
    scheduleAmbience(b.state.amb, t0, t1, ambInputs());
    scheduleLoops(b.state.loops, t0, t1);
  } catch (e) { console.warn('audio tick', e); }
  const d = performance.now() - s; A.perf.ticks++; A.perf.ms += d; if (d > A.perf.max) A.perf.max = d;
}

function applyVolumes() {
  const b = E.live; if (!b) return; const t = b.ctx.currentTime;
  for (const k of ['music', 'sfx', 'amb']) { b.vol[k].gain.setTargetAtTime(A.vol[k], t, .05); b.wetIn[k].gain.setTargetAtTime(A.vol[k], t, .05); }
  b.master.gain.setTargetAtTime(A.muted ? 0 : A.vol.master, t, .05);
}

export const audio = {
  get ctx() { return E.live ? E.live.ctx : null; },
  get ready() { return !!E.live; },
  get muted() { return A.muted; },

  init() {
    if (E.live) { if (E.live.ctx.state === 'suspended') E.live.ctx.resume().catch(() => { }); return; }
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    const ctx = new Ctx({ latencyHint: 'interactive' });
    const b = makeBundle(ctx, A.vol);
    b.state = { music: musicState(), amb: ambState(), loops: loopState() };
    if (A.muted) b.master.gain.value = 0;
    E.live = E.cur = b;
    if (ctx.state === 'suspended') ctx.resume().catch(() => { });
    for (const [n, l] of A.pending) audio.loop(n, l);
    A.pending.clear();
    A.timer = setInterval(tick, 60);
  },

  mute(v = !A.muted) { A.muted = v; applyVolumes(); return v; },
  setVolumes(v) { for (const k in v) if (k in A.vol && Number.isFinite(+v[k])) A.vol[k] = Math.max(0, Math.min(1, +v[k])); applyVolumes(); },
  get volumes() { return { ...A.vol }; },

  setMood(m) { A.mood = m in MOODS || m === 'off' || m === 'auto' ? m : 'day'; },
  get mood() { return A.mood; },
  get playing() { return resolveMood(); },

  // ambience levels 0..1: { cicada, higurashi, crickets, city, wind, rain, festival }.
  // null clears one override (back to automatic); an empty object clears them all.
  setAmbience(o = {}) {
    if (!Object.keys(o).length) { A.amb = {}; return; }
    for (const k in o) { if (o[k] == null) delete A.amb[k]; else A.amb[k] = Math.max(0, Math.min(1, +o[k])); }
  },
  get ambience() { return E.live ? { ...E.live.state.amb.levels } : {}; },

  register(name, fn) { user.set(name, fn); },
  has(name) { return user.has(name) || library.has(name); },
  names() { return [...new Set([...library.keys(), ...user.keys()])].sort(); },

  // persistent loops: sizzle, bubble, water, steam, candle, sparkler, crowd, rain, wind.
  // level 0 fades out (and frees the nodes); >0 starts or sets the level.
  loop(name, level = 1) {
    level = Math.max(0, Math.min(1, +level || 0));
    if (name === 'rain') { A.rainLoop = level; return; }
    if (name === 'wind') { A.windLoop = level; return; }
    if (!E.live) { A.pending.set(name, level); return; }
    const prev = E.cur; E.cur = E.live;
    try { setLoop(E.live.state.loops, name, level); } finally { E.cur = prev; }
  },
  // fade every loop out (call at chapter teardown so a sizzle doesn't follow you into the diary)
  stopLoops() { for (const n of LOOP_NAMES) audio.loop(n, 0); A.pending.clear(); },
  loops: LOOP_NAMES,
  moods: Object.keys(MOODS),

  // play a named sound. opts: delay, x (world x → stereo), gap (per-name throttle, seconds), and
  // anything the sound itself reads (size, strength, i, n, pitch…)
  sfx(name, opts = {}) {
    if (!E.live || A.muted) return;
    const fn = user.get(name) || library.get(name); if (!fn) return;
    const now = E.live.ctx.currentTime, gap = opts.gap ?? 0;
    if (gap && now - (lastPlayed.get(name) ?? -9) < gap) return;
    lastPlayed.set(name, now);
    E.cur = E.live; E.pan = opts.x != null ? panOf(opts.x) : (opts.pan || 0);
    try { fn(opts); } catch (e) { console.warn('sfx', name, e); } finally { E.pan = 0; }
  },

  tone, noise,
  update(dt) { tick(); },
  get perf() { return { ...A.perf, avg: A.perf.ticks ? A.perf.ms / A.perf.ticks : 0 }; },
};

// ── measurement: render sounds through the same mixer into an OfflineAudioContext ──
// fn(bundle) must schedule synchronously; times start at 0.
export async function renderOffline(seconds, fn, sr = 44100) {
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * seconds), sr);
  const b = makeBundle(ctx, A.vol);
  b.state = { music: musicState(), amb: ambState(), loops: loopState() };
  const prev = E.cur, prevPan = E.pan;
  E.cur = b; E.pan = 0;
  try { fn(b); } finally { E.cur = prev; E.pan = prevPan; }
  return ctx.startRendering();
}

export function bufferStats(buf, from = 0, to = buf.duration) {
  const sr = buf.sampleRate, a = Math.floor(from * sr), z = Math.min(buf.length, Math.floor(to * sr));
  let peak = 0, sum = 0, n = 0, maxStep = 0, win = 0, winN = 0, loud = 0; const W = Math.floor(sr * .4);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch); let prev = 0; win = 0; winN = 0;
    for (let i = a; i < z; i++) {
      const v = d[i], av = Math.abs(v);
      if (av > peak) peak = av; sum += v * v; n++;
      const st = Math.abs(v - prev); if (st > maxStep) maxStep = st; prev = v;
      win += v * v; winN++;
      if (winN === W) { loud = Math.max(loud, Math.sqrt(win / W)); win = 0; winN = 0; }
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, n));
  const db = x => x > 0 ? 20 * Math.log10(x) : -Infinity;
  return { peak, rms, peakDb: db(peak), rmsDb: db(rms), loudDb: db(loud || rms), maxStep };
}

// the scenarios the lab measures; each returns { seconds, from, fn }. Everything starts after a
// short pre-roll because the mixer's compressors begin fully clamped in a fresh offline render.
const PRE = .5;
export const SCENARIOS = {
  sfx(name, opts = {}) {
    const long = { boom: 3.5, thunder: 7, crossing: 7.2, 'chime-town': 13, furin: 3.5, bell: 3, launch: 2 };
    return { seconds: (long[name] || 2) + PRE, from: PRE, fn: () => { const f = user.get(name) || library.get(name); E.pan = 0; f({ i: 3, n: 18, ...opts, delay: PRE + (opts.delay || 0) }); } };
  },
  mood(m, seconds = 20) {
    return { seconds: seconds + PRE, from: PRE, fn: b => { b.state.music.nextBar = PRE; for (let t = PRE; t < seconds + PRE; t += .5) scheduleMusic(b.state.music, t, t + .5, m); } };
  },
  ambience(phase, extra = {}, seconds = 15, mode = 'play') {
    return { seconds: seconds + PRE, from: PRE, fn: b => { for (let t = 0; t < seconds + PRE; t += .5) scheduleAmbience(b.state.amb, t, t + .5, { phase, mode, amb: extra, rainLoop: 0, windLoop: 0 }); } };
  },
  // loop body is measured from PRE+.5 to PRE+4.3, the start click over PRE..PRE+.05, the tail after PRE+6.5
  loop(name) {
    return {
      seconds: PRE + 7.5, from: PRE, fn: b => {
        setLoop(b.state.loops, name, 1, PRE);
        for (let t = PRE; t < PRE + 4.5; t += .25) scheduleLoops(b.state.loops, t, t + .25);
        const L = b.state.loops[name]; if (L && L.out) L.out.gain.setTargetAtTime(0, PRE + 4.5, .12);
      },
    };
  },
  // worst case: the festival finale with fireworks going off over a crowd
  finale(seconds = 12) {
    return {
      seconds: seconds + PRE, from: PRE, fn: b => {
        b.state.music.nextBar = PRE;
        for (let t = PRE; t < seconds + PRE; t += .5) scheduleMusic(b.state.music, t, t + .5, 'festival');
        for (let t = 0; t < seconds + PRE; t += .5) scheduleAmbience(b.state.amb, t, t + .5, { phase: .95, mode: 'ending', amb: { festival: 1 }, rainLoop: 0, windLoop: 0 });
        setLoop(b.state.loops, 'crowd', 1, PRE);
        for (let t = PRE; t < seconds + PRE; t += .25) scheduleLoops(b.state.loops, t, t + .25);
        for (let t = PRE + .5; t < seconds + PRE - 2; t += .45) { library.get('launch')({ delay: t }); library.get('boom')({ delay: t + 1.1, size: 1.3 }); }
      },
    };
  },
};

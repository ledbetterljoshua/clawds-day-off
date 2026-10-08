// The audio context "bundle" (mixer + reverb + noise tables) and the synthesis primitives every
// other audio module schedules through. A bundle can wrap a live AudioContext or an
// OfflineAudioContext, which is how the lab measures sounds without speakers.
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

// E.cur is the bundle sounds are scheduled into; E.pan is the stereo position of the sfx
// currently being dispatched (set from opts.x), picked up by primitives as their default pan.
export const E = { cur: null, live: null, pan: 0 };

const BUSES = ['music', 'sfx', 'amb'];

export function makeBundle(ctx, vol = { master: .8, music: .55, sfx: .8, amb: .7 }) {
  const b = { ctx, vol: {}, wetIn: {}, state: {} };
  b.master = ctx.createGain(); b.master.gain.value = vol.master;
  // glue compressor → peak limiter → soft clip ceiling at 0.89
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -20; glue.knee.value = 14; glue.ratio.value = 2.2; glue.attack.value = .012; glue.release.value = .28;
  const lim = ctx.createDynamicsCompressor();
  lim.threshold.value = -5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .15;
  const clip = ctx.createWaveShaper(); clip.curve = softClip(); clip.oversample = '2x';
  b.master.connect(glue).connect(lim).connect(clip).connect(ctx.destination);
  b.out = clip;

  // shared reverb: a synthesized stereo plate with a darkening tail
  b.verb = ctx.createConvolver(); b.verb.normalize = true; b.verb.buffer = impulse(ctx, 2.8, 2.4);
  const verbOut = ctx.createGain(); verbOut.gain.value = .42;
  b.verb.connect(verbOut).connect(b.master);

  for (const k of BUSES) {
    const g = ctx.createGain(); g.gain.value = vol[k]; g.connect(b.master); b.vol[k] = g;
    // wet path carries the bus volume too, so a quiet bus has a quiet tail
    const w = ctx.createGain(); w.gain.value = vol[k]; w.connect(b.verb); b.wetIn[k] = w;
  }

  // music chain: voices → tape wobble (modulated delay) → gentle rolloff → duck → bus (+ reverb)
  b.musicIn = ctx.createGain();
  const wob = ctx.createDelay(.06); wob.delayTime.value = .014;
  const lfoA = ctx.createOscillator(), lfoAg = ctx.createGain(); lfoA.frequency.value = .31; lfoAg.gain.value = .0012;
  const lfoB = ctx.createOscillator(), lfoBg = ctx.createGain(); lfoB.frequency.value = 5.1; lfoBg.gain.value = .00009;
  lfoA.connect(lfoAg).connect(wob.delayTime); lfoB.connect(lfoBg).connect(wob.delayTime); lfoA.start(); lfoB.start();
  const roll = ctx.createBiquadFilter(); roll.type = 'lowpass'; roll.frequency.value = 7200; roll.Q.value = .4;
  b.duck = ctx.createGain();
  b.mlevel = ctx.createGain();      // music on/off fades (mood 'off'); duck is for sfx ducking
  const trim = ctx.createGain(); trim.gain.value = .45;   // music sits under the world
  b.musicIn.connect(wob).connect(roll).connect(trim).connect(b.mlevel).connect(b.duck);
  b.duck.connect(b.vol.music);
  const mSend = ctx.createGain(); mSend.gain.value = .32; b.duck.connect(mSend).connect(b.wetIn.music);

  // electric piano sub-bus with a shared tremolo
  b.ep = ctx.createGain(); b.ep.gain.value = .84;
  const trem = ctx.createOscillator(), tremG = ctx.createGain(); trem.frequency.value = 4.6; tremG.gain.value = .16;
  trem.connect(tremG).connect(b.ep.gain); trem.start();
  b.ep.connect(b.musicIn);

  b.noise = { white: noiseBuf(ctx, 'white'), pink: noiseBuf(ctx, 'pink'), brown: noiseBuf(ctx, 'brown') };
  b.crackle = crackleBuf(ctx);
  return b;
}

// a curve that is linear to 0.6, then bends smoothly into a 0.89 ceiling
function softClip(n = 4096, knee = .6, ceil = .89) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1) * 2 - 1, a = Math.abs(x);
    const y = a < knee ? a : knee + (ceil - knee) * Math.tanh((a - knee) / (ceil - knee));
    c[i] = Math.sign(x) * y;
  }
  return c;
}

function impulse(ctx, dur, decay) {
  const sr = ctx.sampleRate, n = Math.floor(sr * dur), buf = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let y = 0;
    const pre = Math.floor(sr * (.008 + ch * .004));
    for (let i = 0; i < n; i++) {
      const t = i / n, x = i < pre ? 0 : (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      const a = .85 - .65 * t;          // the tail gets darker as it decays
      y += a * (x - y); d[i] = y;
    }
  }
  return buf;
}

function noiseBuf(ctx, color) {
  const sr = ctx.sampleRate, n = sr * 3, buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'white') d[i] = w;
    else if (color === 'pink') {
      // Paul Kellet's refined pink filter
      b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852;
      b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926;
    } else { last = (last + .02 * w) / 1.02; d[i] = last * 3.5; }
  }
  return buf;
}

// sparse vinyl crackle: mostly silence with small clicks and the odd pop
function crackleBuf(ctx) {
  const sr = ctx.sampleRate, n = sr * 5, buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
  for (let k = 0; k < 70; k++) {
    const at = Math.floor(Math.random() * (n - 400)), big = Math.random() < .08, len = big ? 120 : 18, amp = big ? .5 : .15 + Math.random() * .25;
    for (let i = 0; i < len; i++) d[at + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / (len * .25));
  }
  return buf;
}

// ── routing ──
export const now = () => E.cur.ctx.currentTime;
export const panOf = x => clampN((x || 0) / 10, -1, 1) * .7;

// returns the node a voice should connect to. Music voices go through the music chain.
export function dest(bus = 'sfx', pan = E.pan, send = 0) {
  const b = E.cur, c = b.ctx;
  const target = bus === 'music' ? b.musicIn : bus === 'ep' ? b.ep : b.vol[bus];
  if (!pan && !send) return target;
  const o = c.createGain();
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clampN(pan, -1, 1); o.connect(p).connect(target); }
  else o.connect(target);
  if (send && bus !== 'music' && bus !== 'ep') { const s = c.createGain(); s.gain.value = send; o.connect(s).connect(b.wetIn[bus]); }
  return o;
}

// an attack/decay envelope on a gain param; `hold` keeps it at peak before the decay
// The param is zeroed first: a fresh gain defaults to 1, and a source starting between samples
// can otherwise emit its first sample at full gain (an audible click).
export function env(param, t, attack, dur, peak, hold = 0) {
  param.value = 0;
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + attack);
  if (hold) param.setValueAtTime(peak, t + attack + hold);
  param.exponentialRampToValueAtTime(.0001, t + Math.max(attack + hold + .01, dur));
}

// ── primitives (signatures kept from the original audio.js) ──
export function tone(f, dur, type = 'sine', vol = .2, slide, { delay = 0, bus = 'sfx', attack = .01, pan = E.pan, send = 0, t0 = null, detune = 0 } = {}) {
  if (!E.cur) return null; const c = E.cur.ctx, t = (t0 ?? c.currentTime) + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(Math.max(1, f), t); if (detune) o.detune.value = detune;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t + dur);
  env(g.gain, t, attack, dur, vol);
  o.connect(g).connect(dest(bus, pan, send)); o.start(t); o.stop(t + dur + .05);
  return o;
}

export function noise(dur, type, freq, vol, q = 1, { delay = 0, bus = 'sfx', attack = .002, pan = E.pan, send = 0, color = 'white', sweep = 0, t0 = null, hold = 0 } = {}) {
  if (!E.cur) return null; const b = E.cur, c = b.ctx, t = (t0 ?? c.currentTime) + delay;
  const s = c.createBufferSource(); s.buffer = b.noise[color] || b.noise.white;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), t + dur);
  const g = c.createGain(); env(g.gain, t, attack, dur, vol, hold);
  s.connect(f).connect(g).connect(dest(bus, pan, send));
  s.start(t, Math.random() * 2.5); s.stop(t + dur + .05);
  return f;
}

// 2-operator FM note. index is in multiples of the carrier frequency and decays to indexEnd.
export function fm(t, f, dur, { ratio = 1, index = 1.5, indexEnd = .2, indexTime = .3, vol = .1, attack = .004, bus = 'music', pan = 0, send = 0, type = 'sine', release = null, sustain = .3, decay = 1.2 } = {}) {
  const c = E.cur.ctx;
  const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
  car.type = type; car.frequency.value = f; mod.frequency.value = f * ratio;
  mg.gain.setValueAtTime(f * index, t); mg.gain.exponentialRampToValueAtTime(Math.max(.01, f * indexEnd), t + indexTime);
  mod.connect(mg).connect(car.frequency);
  g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
  const rel = release ?? Math.min(.6, dur * .4);
  g.gain.setTargetAtTime(vol * sustain, t + attack, decay);
  g.gain.setTargetAtTime(0, t + dur, rel / 4);
  car.connect(g).connect(dest(bus, pan, send));
  car.start(t); mod.start(t); car.stop(t + dur + rel + .1); mod.stop(t + dur + rel + .1);
}

// sum of decaying sine partials: bells, glass, tines. partials = [[ratio, amp, decayScale], ...]
export function bell(t, f, dur, vol, partials, { bus = 'sfx', pan = E.pan, send = 0, attack = .002 } = {}) {
  const out = dest(bus, pan, send), c = E.cur.ctx;
  for (const [r, a, ds = 1] of partials) {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = f * r;
    env(g.gain, t, attack, dur * ds, vol * a);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur * ds + .05);
  }
}

// a looping noise source through a filter into a gain, for beds and loops
export function bed(color, type, freq, q, bus, { pan = 0, send = 0 } = {}) {
  const b = E.cur, c = b.ctx;
  const s = c.createBufferSource(); s.buffer = b.noise[color]; s.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain(); g.gain.value = 0;
  s.connect(f).connect(g).connect(dest(bus, pan, send));
  s.start(c.currentTime, Math.random() * 2.5);
  return { src: s, filter: f, gain: g, stop() { try { s.stop(); } catch { } g.disconnect(); } };
}

// an LFO driving an AudioParam: value = center + depth * wave
export function lfo(param, rate, depth, type = 'sine') {
  const c = E.cur.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = rate; g.gain.value = depth;
  o.connect(g).connect(param); o.start();
  return { osc: o, gain: g, stop() { try { o.stop(); } catch { } g.disconnect(); } };
}

// briefly lower the music under a loud sound
export function duck(amount = .55, at = 0, release = 1.6) {
  const b = E.cur; if (!b) return; const t = b.ctx.currentTime + at, p = b.duck.gain;
  p.cancelScheduledValues(t); p.setTargetAtTime(amount, t, .03); p.setTargetAtTime(1, t + .25, release / 3);
}

export const midi = n => 440 * Math.pow(2, (n - 69) / 12);
export const rnd = (a, b) => a + Math.random() * (b - a);

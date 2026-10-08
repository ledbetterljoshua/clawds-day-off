// The soundscape under everything: continuous beds (cicada chorus, city, wind, rain) plus
// scheduled creatures and distant events, all keyed to the sky clock.
import { E, tone, noise, bell, rnd, dest } from './engine.js';

const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function ambState() { return { beds: null, next: {}, lastMode: null, chimedAt: -99, levels: {} }; }

function makeBeds() {
  const b = E.cur, c = b.ctx;
  const src = color => { const s = c.createBufferSource(); s.buffer = b.noise[color]; s.loop = true; s.start(c.currentTime, Math.random() * 2.5); return s; };
  const filt = (type, f, q) => { const x = c.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; };
  const osc = (f, type = 'sine') => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };
  const gain = v => { const g = c.createGain(); g.gain.value = v; return g; };
  const beds = {};

  // distant cicada chorus: a pulsing band of noise with a slow swell
  {
    const am = gain(.5), swell = gain(.75), lvl = gain(0);
    osc(38, 'triangle').connect(gain(.45)).connect(am.gain);
    osc(.13).connect(gain(.25)).connect(swell.gain);
    src('white').connect(filt('bandpass', 4700, 5)).connect(filt('peaking', 6200, 2)).connect(am).connect(swell).connect(lvl).connect(dest('amb', .15));
    beds.cicada = lvl;
  }
  // city: low traffic rumble and a faint mid band
  {
    const lvl = gain(0);
    src('brown').connect(filt('lowpass', 170, .7)).connect(lvl);
    const mid = gain(.25); src('pink').connect(filt('bandpass', 520, .5)).connect(mid).connect(lvl);
    lvl.connect(dest('amb', -.1));
    beds.city = lvl;
  }
  // wind: a wandering band with slow gusts
  {
    const bp = filt('bandpass', 520, .9), gust = gain(.7), lvl = gain(0);
    osc(.07).connect(gain(240)).connect(bp.frequency);
    osc(.11).connect(gain(.3)).connect(gust.gain);
    src('pink').connect(bp).connect(gust).connect(lvl).connect(dest('amb', .1, .1));
    beds.wind = lvl;
  }
  // rain: hiss of drops on everything plus a soft roof rumble
  {
    const lvl = gain(0);
    src('white').connect(filt('highpass', 1300, .7)).connect(filt('lowpass', 8500, .5)).connect(lvl);
    const low = gain(.55); src('brown').connect(filt('lowpass', 420, .6)).connect(low).connect(lvl);
    lvl.connect(dest('amb', 0, .25));
    beds.rain = lvl;
  }
  return beds;
}

// ── creatures and distant things ──
// min-min zemi: a run of buzzing "miin" syllables, quickening, ending on a long "miiiin"
function minmin(t, lvl) {
  const c = E.cur.ctx, f = rnd(3700, 4800), n = 6 + Math.floor(Math.random() * 7), pan = rnd(-.85, .85);
  const s = c.createBufferSource(); s.buffer = E.cur.noise.white; s.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 9; bp.frequency.value = f;
  const am = c.createGain(); am.gain.value = .5;
  const buzz = c.createOscillator(); buzz.type = 'square'; buzz.frequency.value = rnd(105, 135);
  const bg = c.createGain(); bg.gain.value = .5; buzz.connect(bg).connect(am.gain);
  const g = c.createGain(); g.gain.value = 0;
  s.connect(bp).connect(am).connect(g).connect(dest('amb', pan, .12));
  const peak = rnd(.04, .065) * lvl; let tt = t;
  g.gain.setValueAtTime(.0001, tt);
  for (let i = 0; i < n; i++) {
    const len = Math.max(.2, .34 - i * .013);
    g.gain.setValueAtTime(.0001, tt); g.gain.exponentialRampToValueAtTime(peak, tt + len * .45); g.gain.exponentialRampToValueAtTime(.0001, tt + len);
    bp.frequency.setValueAtTime(f * .9, tt); bp.frequency.linearRampToValueAtTime(f * 1.06, tt + len * .5); bp.frequency.linearRampToValueAtTime(f * .97, tt + len);
    tt += len + .08;
  }
  g.gain.setValueAtTime(.0001, tt); g.gain.exponentialRampToValueAtTime(peak * 1.1, tt + .35); g.gain.setTargetAtTime(.0001, tt + .9, .22);
  bp.frequency.setValueAtTime(f * .93, tt); bp.frequency.linearRampToValueAtTime(f * 1.04, tt + .5); bp.frequency.linearRampToValueAtTime(f * .95, tt + 1.6);
  const end = tt + 2.1; s.start(t, Math.random() * 2); buzz.start(t); s.stop(end); buzz.stop(end);
  return end - t;
}
// higurashi: the evening cicada's falling "kana-kana-kana", echoing in the trees
function higurashi(t, lvl) {
  const c = E.cur.ctx, f0 = rnd(4300, 4900), n = 12 + Math.floor(Math.random() * 9), pan = rnd(-.8, .8);
  const o = c.createOscillator();
  const am = c.createGain(); am.gain.value = .5;
  const tr = c.createOscillator(); tr.frequency.value = rnd(55, 70); const tg = c.createGain(); tg.gain.value = .5; tr.connect(tg).connect(am.gain);
  const g = c.createGain(); g.gain.value = 0;
  o.connect(am).connect(g).connect(dest('amb', pan, .4));
  const peak = rnd(.035, .055) * lvl; let tt = t;
  g.gain.setValueAtTime(.0001, tt);
  for (let i = 0; i < n; i++) {
    const k = i / n, f = f0 * (1 - .18 * k), len = .15 + .05 * k, a = peak * (i < 2 ? .55 + i * .2 : 1 - .65 * k);
    o.frequency.setValueAtTime(f * 1.02, tt); o.frequency.linearRampToValueAtTime(f * .97, tt + len);
    g.gain.setValueAtTime(.0001, tt); g.gain.exponentialRampToValueAtTime(Math.max(.0002, a), tt + .025); g.gain.exponentialRampToValueAtTime(.0001, tt + len);
    tt += len + .045 + .035 * k;
  }
  o.start(t); tr.start(t); o.stop(tt + .1); tr.stop(tt + .1);
  return tt - t;
}
// suzumushi (bell cricket): short ringing trills, "riiin, riiin"
function suzumushi(t, lvl) {
  const c = E.cur.ctx, f = rnd(4100, 4600), n = 2 + Math.floor(Math.random() * 3), pan = rnd(-.9, .9);
  const o = c.createOscillator(); o.frequency.value = f;
  const am = c.createGain(); am.gain.value = .5; const tr = c.createOscillator(); tr.frequency.value = rnd(48, 62); const tg = c.createGain(); tg.gain.value = .5; tr.connect(tg).connect(am.gain);
  const g = c.createGain(); g.gain.value = 0;
  o.connect(am).connect(g).connect(dest('amb', pan, .2));
  const peak = rnd(.018, .03) * lvl; let tt = t;
  for (let i = 0; i < n; i++) {
    const len = rnd(.22, .36);
    g.gain.setValueAtTime(.0001, tt); g.gain.exponentialRampToValueAtTime(peak, tt + .04); g.gain.setValueAtTime(peak, tt + len - .05); g.gain.exponentialRampToValueAtTime(.0001, tt + len);
    tt += len + rnd(.18, .3);
  }
  o.start(t); tr.start(t); o.stop(tt); tr.stop(tt);
  return tt - t;
}
// matsumushi (pine cricket): "chin-chirorin"
function matsumushi(t, lvl) {
  const pan = rnd(-.9, .9), f = rnd(3600, 4000), v = rnd(.018, .026) * lvl;
  tone(f, .06, 'sine', v, null, { t0: t, bus: 'amb', pan, attack: .005 });
  tone(f * 1.04, .05, 'sine', v * .8, null, { t0: t + .13, bus: 'amb', pan, attack: .005 });
  for (let k = 0; k < 5; k++) tone(f * 1.02, .035, 'sine', v * .9, null, { t0: t + .26 + k * .045, bus: 'amb', pan, attack: .004 });
  return .6;
}
// crows heading home at sunset
function crows(t) {
  const pan = rnd(-.8, .8), n = 2 + Math.floor(Math.random() * 2), c = E.cur.ctx;
  for (let i = 0; i < n; i++) {
    const tt = t + i * rnd(.45, .7), o = c.createOscillator(), bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(rnd(520, 600), tt); o.frequency.exponentialRampToValueAtTime(rnd(380, 430), tt + .32);
    bp.type = 'bandpass'; bp.frequency.value = 1150; bp.Q.value = 2.2; lp.type = 'lowpass'; lp.frequency.value = 2600;
    g.gain.value = 0; g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(.04, tt + .03); g.gain.exponentialRampToValueAtTime(.0001, tt + .36);
    o.connect(bp).connect(lp).connect(g).connect(dest('amb', pan, .35)); o.start(tt); o.stop(tt + .4);
    noise(.3, 'bandpass', 1500, .014, 2, { t0: tt, bus: 'amb', pan, attack: .02 });
  }
  return 2;
}
// a far-off school/town chime (the Westminster quarters every Japanese school rings at day's end)
export function chime(t, lvl = 1) {
  const notes = [659.3, 523.3, 587.3, 392, 0, 392, 587.3, 659.3, 523.3];
  notes.forEach((f, i) => {
    if (!f) return;
    const tt = t + i * 1.05, long = i === notes.length - 1 ? 2.2 : 1;
    bell(tt, f, 3.4 * long, .036 * lvl, [[1, 1, 1], [2.0, .25, .6], [2.76, .35, .45], [5.4, .08, .25]], { bus: 'amb', pan: -.3, send: .7, attack: .006 });
  });
  return 11;
}
function bikeBell(t) {
  const pan = rnd(-.7, .7);
  for (const off of [0, .14, .55, .69]) bell(t + off, 3150, .45, .012, [[1, 1], [1.31, .7], [2.62, .3]], { bus: 'amb', pan, send: .2 });
  return 1.4;
}
function raindrop(t, lvl) {
  const pan = rnd(-.95, .95), f = rnd(2200, 5200);
  tone(f, .018, 'sine', rnd(.004, .012) * lvl, f * .6, { t0: t, bus: 'amb', pan, attack: .001 });
  if (Math.random() < .25) tone(rnd(600, 900), .05, 'sine', .006 * lvl, rnd(300, 450), { t0: t, bus: 'amb', pan, attack: .002 });   // a fat drip on wood
}
function farTaiko(t, lvl) {
  tone(rnd(70, 85), .6, 'sine', .06 * lvl, 48, { t0: t, bus: 'amb', pan: rnd(-.4, .4), send: .5, attack: .006 });
}

// distant railway crossing; exported so the library's 'crossing' sfx can reuse it
export function crossing(t, { far = .6, n = 10 } = {}) {
  const v = .042 * (1.1 - far), pan = .35;
  for (let i = 0; i < n; i++) {
    const f = i % 2 ? 880 : 740;
    bell(t + i * .62, f, .55, v, [[1, 1], [2.43, .5], [3.6, .25]], { bus: 'amb', pan, send: .35 * far + .1, attack: .002 });
  }
  return n * .62 + .6;
}

// levels: auto from the sky clock unless overridden (null = auto)
function levels(inp) {
  const { phase: p, mode, amb, rainLoop, windLoop } = inp;
  const auto = {
    cicada: 1 - sm(.5, .78, p),
    higurashi: sm(.36, .56, p) * (1 - sm(.8, .93, p)),
    crickets: sm(.72, .95, p),
    city: .35 + .45 * sm(.5, 1, p),
    wind: .3,
    rain: 0,
    festival: 0,
  };
  const L = {};
  for (const k in auto) L[k] = amb[k] ?? auto[k];
  L.rain = Math.max(L.rain, rainLoop || 0); L.wind = Math.max(L.wind, windLoop || 0);
  // rain hushes the insects
  L.cicada *= 1 - L.rain * .9; L.higurashi *= 1 - L.rain * .8; L.crickets *= 1 - L.rain * .6;
  if (mode === 'title' || mode === 'diary') for (const k in L) L[k] *= .45;
  return L;
}

const BED_GAIN = { cicada: .075, city: .05, wind: .055, rain: .07 };

export function scheduleAmbience(st, t0, t1, inp) {
  if (!st.beds) st.beds = makeBeds();
  const L = st.levels = levels(inp), N = st.next;
  // only touch the bed gains when a level actually moves (keeps the automation timeline short)
  st.bedLvl = st.bedLvl || {};
  for (const k in st.beds) {
    const v = (L[k] || 0) * BED_GAIN[k];
    if (st.bedLvl[k] == null || Math.abs(v - st.bedLvl[k]) > .0008) { st.beds[k].gain.setTargetAtTime(v, t0, .6); st.bedLvl[k] = v; }
  }
  for (const k of ['cicada', 'higurashi', 'suzu', 'matsu', 'crow', 'bike', 'train', 'rain', 'taiko']) {
    if (N[k] == null || N[k] < t0 - 1) N[k] = t0 + rnd(.5, 4);
  }
  const play = inp.mode === 'play' || inp.mode === 'ending';
  if (L.cicada > .08) while (N.cicada < t1) { minmin(N.cicada, L.cicada); N.cicada += rnd(2.5, 7) / L.cicada; }
  else N.cicada = Math.max(N.cicada, t1);
  if (L.higurashi > .05) while (N.higurashi < t1) { const d = higurashi(N.higurashi, L.higurashi); N.higurashi += d + rnd(4, 11) / L.higurashi; }
  else N.higurashi = Math.max(N.higurashi, t1);
  if (L.crickets > .05) {
    while (N.suzu < t1) { const d = suzumushi(N.suzu, L.crickets); N.suzu += d + rnd(.3, 1.6) / L.crickets; }
    while (N.matsu < t1) { matsumushi(N.matsu, L.crickets); N.matsu += rnd(3, 8) / L.crickets; }
  } else { N.suzu = Math.max(N.suzu, t1); N.matsu = Math.max(N.matsu, t1); }
  const golden = inp.phase > .42 && inp.phase < .74 && L.rain < .3;
  while (N.crow < t1) { if (golden && Math.random() < .6) crows(N.crow); N.crow += rnd(18, 40); }
  while (N.bike < t1) { if (inp.phase < .7 && L.rain < .2 && Math.random() < .45) bikeBell(N.bike); N.bike += rnd(50, 110); }
  while (N.train < t1) { if (play && inp.phase > .3 && Math.random() < .5) crossing(N.train, { far: .85, n: 8 }); N.train += rnd(80, 160); }
  if (L.rain > .03) while (N.rain < t1) { raindrop(N.rain, L.rain); N.rain += -Math.log(1 - Math.random()) / (4 + L.rain * 50); }
  else N.rain = Math.max(N.rain, t1);
  if (L.festival > .05) while (N.taiko < t1) { farTaiko(N.taiko, L.festival); N.taiko += rnd(.4, .9); }
  else N.taiko = Math.max(N.taiko, t1);
  // each evening opens with a far-off chime
  if (inp.mode === 'play' && st.lastMode !== 'play' && inp.phase < .2 && t0 - st.chimedAt > 30) { chime(t0 + 1.4); st.chimedAt = t0; }
  st.lastMode = inp.mode;
}

// Generative music: city-pop chords on a warm electric piano, a round bass, a sparse music-box
// melody, brushed percussion, and taiko for festivals. Scheduled bar by bar on AudioContext time.
// A mood is a progression plus an arrangement; mood changes land on the next bar line.
import { E, fm, tone, noise, bell, midi, rnd, env, dest } from './engine.js';

const KEY = 62;   // D major

const Q = {
  maj7: [0, 4, 7, 11], maj9: [4, 7, 11, 14], 'maj7#11': [4, 7, 11, 18], m7: [0, 3, 7, 10], m9: [3, 7, 10, 14],
  '7': [0, 4, 7, 10], '7sus': [0, 5, 7, 10], '9sus': [5, 7, 10, 14], '6': [0, 4, 7, 9], m6: [0, 3, 7, 9], add9: [0, 4, 7, 14],
};
// [root in semitones above D, quality, beats]
const PROG = {
  day: [[5, 'maj9', 4], [4, 'm7', 4], [9, 'm9', 4], [7, '9sus', 2], [7, '7', 2], [5, 'maj7', 4], [4, 'm7', 4], [2, 'm9', 4], [7, '7sus', 4]],
  // 王道進行, the J-pop "royal road": IV△7 – V7 – iii7 – vi7
  royal: [[5, 'maj7', 4], [7, '7', 4], [4, 'm7', 4], [9, 'm7', 4], [5, 'maj7', 4], [7, '7', 4], [4, 'm7', 2], [9, 'm7', 2], [2, 'm7', 2], [7, '7sus', 2]],
  // 丸サ進行: IV△7 – III7 – vi7 – v7 I7
  marusa: [[5, 'maj7', 4], [4, '7', 4], [9, 'm7', 4], [7, 'm7', 2], [0, '7', 2]],
  night: [[0, 'maj9', 8], [5, 'maj7#11', 8], [9, 'm9', 8], [7, '9sus', 8]],
  festival: [[0, '6', 4], [5, 'maj9', 4], [7, '7sus', 2], [7, '7', 2], [0, '6', 4], [9, 'm7', 4], [5, 'maj7', 4], [7, '7sus', 4], [0, 'add9', 4]],
  rain: [[9, 'm9', 8], [5, 'maj7', 8], [2, 'm9', 8], [4, 'm7', 8]],
  // the borrowed minor iv at the end is the bittersweet one
  finale: [[0, 'maj7', 8], [9, 'm7', 8], [5, 'maj7', 8], [5, 'm6', 8]],
  title: [[0, 'maj9', 4], [4, 'm7', 4], [5, 'maj7', 4], [7, '9sus', 4]],
};
const TL = {};
for (const [k, list] of Object.entries(PROG)) {
  let beat = 0; const segs = list.map(([root, q, len], i) => { const s = { i, root, q, len, beat }; beat += len; return s; });
  TL[k] = { segs, total: beat };
}

export const MOODS = {
  title: { bpm: 72, prog: 'title', ep: 'warm', bass: 'warm', mel: .42, perc: 0, pad: .35, motif: .55, lvl: .95, swing: .08 },
  day: { bpm: 78, prog: 'day', ep: 'city', bass: 'city', mel: .4, perc: .7, pad: 0, motif: .08, lvl: 1, swing: .1 },
  golden: { bpm: 74, prog: 'royal', ep: 'warm', bass: 'warm', mel: .4, perc: .45, pad: .25, motif: .1, lvl: 1, swing: .08 },
  dusk: { bpm: 70, prog: 'marusa', ep: 'warm', bass: 'warm', mel: .32, perc: .2, pad: .5, motif: .1, lvl: .95, swing: .06 },
  night: { bpm: 66, prog: 'night', ep: 'pad', bass: 'slow', mel: .28, perc: 0, pad: .65, motif: .12, lvl: .85, swing: 0 },
  festival: { bpm: 84, prog: 'festival', ep: 'stab', bass: 'fest', mel: .6, perc: 0, pad: 0, taiko: 1, flute: true, motif: .15, lvl: 1, swing: 0 },
  quiet: { bpm: 64, prog: 'night', ep: 'pad', bass: 'slow', mel: .18, perc: 0, pad: .35, motif: .2, lvl: .7, swing: 0 },
  rain: { bpm: 68, prog: 'rain', ep: 'pad', bass: 'slow', mel: .2, perc: 0, pad: .6, motif: 0, lvl: .85, swing: 0 },
  finale: { bpm: 60, prog: 'finale', ep: 'pad', bass: 'slow', mel: .35, perc: 0, pad: .7, motif: .6, lvl: .9, swing: 0 },
};

// D major pentatonic (D E F# A B), the melody's only notes
const PENTA = [2, 4, 6, 9, 11];
const MEL = []; for (let m = 72; m <= 95; m++) if (PENTA.includes(m % 12)) MEL.push(m);
// the leitmotif: [beat, midi, beats] over two bars. Title and finale state it; other moods quote it.
const MOTIF = [[0, 81, .5], [.5, 83, .5], [1, 86, 1], [2, 83, .5], [2.5, 81, .5], [3, 78, 1], [4, 76, .5], [4.5, 78, .5], [5, 81, 1], [6, 78, 2]];

const EP_PAT = {
  city: [[[0, 1.6, 1], [1.5, .9, .62], [3, .8, .7]], [[0, 2.4, 1], [2.5, 1.2, .6]], [[0, 1, 1], [1.5, .5, .55], [2.5, 1.4, .7]], [[.5, 1.4, .9], [2, .9, .6], [3.5, .5, .55]]],
  warm: [[[0, 2.8, 1], [2.5, 1.4, .55]], [[0, 3.8, 1]], [[0, 1.8, 1], [2, 1.8, .7]]],
  stab: [[[0, .45, .85], [1.5, .3, .6], [2.5, .3, .6], [3.5, .3, .6]], [[0, .45, .85], [1, .3, .55], [2, .45, .7], [3.5, .3, .6]]],
  pad: [[[0, 0, 1]]],
};
const BASS_PAT = {
  city: [[[0, 1.4, 1, 'R'], [1.5, .45, .55, '5'], [2, 1, .8, 'R'], [3.5, .45, .6, 'A']], [[0, 2.4, 1, 'R'], [2.5, .45, .6, '8'], [3, .9, .7, '5']]],
  warm: [[[0, 2.5, 1, 'R'], [2.5, 1.3, .7, '5']], [[0, 3.6, 1, 'R']]],
  slow: [[[0, 0, .9, 'R']]],
  fest: [[[0, .9, 1, 'R'], [1, .9, .7, '5'], [2, .9, .9, 'R'], [3, .9, .7, '5']], [[0, .9, 1, 'R'], [1, .45, .6, '8'], [1.5, .45, .6, '5'], [2, .9, .9, 'R'], [3, .9, .7, 'A']]],
};

const pc = n => ((n % 12) + 12) % 12;
const pick = a => a[Math.floor(Math.random() * a.length)];
const chordPcs = seg => Q[seg.q].map(iv => pc(KEY + seg.root + iv));

// voice-lead: of every inversion in the EP range, take the one closest to the previous chord
function voice(pcs, prev) {
  let best = null, bc = Infinity; const n = pcs.length;
  for (let inv = 0; inv < n; inv++) {
    const order = pcs.slice(inv).concat(pcs.slice(0, inv));
    for (let low = 52; low <= 62; low++) {
      if (pc(low) !== order[0]) continue;
      const v = [low];
      for (let i = 1; i < n; i++) { let m = v[i - 1] + 1; while (pc(m) !== order[i]) m++; v.push(m); }
      if (v[n - 1] > 77) continue;
      const cost = prev ? v.reduce((a, x, i) => a + Math.abs(x - prev[i]), 0) : Math.abs(v.reduce((a, x) => a + x, 0) / n - 64) * 4;
      if (cost < bc) { bc = cost; best = v; }
    }
  }
  return best || pcs.map(p => 60 + p);
}
const bassMidi = p => 38 + pc(p - 2);

// ── instruments ──
function ep(t, notes, dur, vel, roll = 0) {
  notes.forEach((n, i) => {
    const f = midi(n), tt = t + i * roll + rnd(0, .006), v = .042 * vel * rnd(.85, 1.05);
    fm(tt, f, dur, { ratio: 1, index: 1.7, indexEnd: .22, indexTime: .4, vol: v, attack: .004, bus: 'ep', release: .5 });
    tone(f * 3.98, .22, 'sine', v * .12, null, { t0: tt, bus: 'ep', attack: .002, pan: 0 });   // tine bark
  });
}
function bassNote(t, n, dur, vel) {
  const c = E.cur.ctx, f = midi(n), lp = c.createBiquadFilter(), g = c.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = .7;
  const a = c.createOscillator(), b = c.createOscillator(); a.type = 'triangle'; b.type = 'sine'; a.frequency.value = f; b.frequency.value = f;
  const v = .11 * vel;
  g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .012); g.gain.setTargetAtTime(v * .7, t + .02, .25); g.gain.setTargetAtTime(0, t + dur, .07);
  a.connect(lp); b.connect(lp); lp.connect(g).connect(dest('music', 0));
  a.start(t); b.start(t); a.stop(t + dur + .4); b.stop(t + dur + .4);
}
function celesta(t, n, dur, vel) {
  const f = midi(n);
  bell(t, f, Math.max(1.1, dur + .8), .04 * vel, [[1, 1, 1], [2, .1, .45], [3.01, .16, .3], [5.2, .05, .18]], { bus: 'music', pan: rnd(-.25, .25) });
}
function flute(t, n, dur, vel) {
  const c = E.cur.ctx, f = midi(n), o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
  o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2;
  const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5.4; vg.gain.value = 0; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * .007, t + Math.min(.3, dur));
  vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
  const g2 = c.createGain(); g2.gain.value = .12; o2.connect(g2).connect(g);
  const v = .035 * vel;
  g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .07); g.gain.setValueAtTime(v * .9, t + Math.max(.08, dur - .05)); g.gain.linearRampToValueAtTime(0, t + dur + .12);
  o.connect(g).connect(dest('music', .15));
  noise(dur + .1, 'bandpass', f * 1.5, v * .5, 2.5, { t0: t, bus: 'music', attack: .05, color: 'pink', pan: .15 });  // breath
  for (const x of [o, o2, vib]) { x.start(t); x.stop(t + dur + .2); }
}
function pad(t, notes, dur, vel) {
  const c = E.cur.ctx, lp = c.createBiquadFilter(), g = c.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = .3;
  const v = .011 * vel;
  g.gain.value = 0; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 1.1); g.gain.setValueAtTime(v, t + Math.max(1.2, dur - .2)); g.gain.linearRampToValueAtTime(0, t + dur + 1.4);
  lp.connect(g).connect(dest('music', 0));
  for (const n of notes) for (const d of [-7, 7]) {
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = midi(n); o.detune.value = d;
    o.connect(lp); o.start(t); o.stop(t + dur + 1.5);
  }
}
const swish = (t, v) => noise(.3, 'bandpass', 3400, .026 * v, .6, { t0: t, bus: 'music', attack: .06, pan: .2 });
const hat = (t, v) => noise(.05, 'highpass', 7500, .011 * v, .7, { t0: t, bus: 'music', pan: -.25 });
const kick = (t, v) => { tone(110, .22, 'sine', .07 * v, 46, { t0: t, bus: 'music', attack: .003, pan: 0 }); };
function taiko(t, v) {
  tone(92, .55, 'sine', .14 * v, 52, { t0: t, bus: 'music', attack: .003, pan: 0 });
  noise(.16, 'lowpass', 300, .1 * v, .8, { t0: t, bus: 'music', color: 'brown', pan: 0 });
}
const ka = (t, v) => { noise(.03, 'bandpass', 1600, .05 * v, 3, { t0: t, bus: 'music', pan: .3 }); tone(1150, .035, 'triangle', .012 * v, null, { t0: t, bus: 'music', pan: .3 }); };
const kane = (t, v) => bell(t, 2150, .32, .016 * v, [[1, 1], [1.62, .6], [2.71, .4], [3.93, .25]], { bus: 'music', pan: -.3 });

// ── state & scheduling ──
export function musicState() {
  return { cur: null, want: 'day', nextBar: 0, bar: 0, voicing: null, segVoice: {}, mel: 9, phrase: null, motifAt: -1, crackle: null, off: false, queue: [] };
}

function startCrackle(ms) {
  const b = E.cur, c = b.ctx, s = c.createBufferSource(), g = c.createGain(), hp = c.createBiquadFilter();
  s.buffer = b.crackle; s.loop = true; hp.type = 'highpass'; hp.frequency.value = 900; g.gain.value = .045;
  s.connect(hp).connect(g).connect(dest('music', 0)); s.start(c.currentTime + .01);
  ms.crackle = s;
}

// schedule every bar that starts before t1
export function scheduleMusic(ms, t0, t1, want) {
  const b = E.cur;
  ms.want = want;
  if (want === 'off') {
    if (!ms.off) { ms.off = true; b.mlevel.gain.setTargetAtTime(0, t0, .4); ms.queue.length = 0; }
    ms.nextBar = Math.max(ms.nextBar, t1);
    return;
  }
  if (ms.off) { ms.off = false; b.mlevel.gain.cancelScheduledValues(t0); b.mlevel.gain.setTargetAtTime(1, t0, .5); }
  if (!ms.crackle) startCrackle(ms);
  if (ms.nextBar < t0 - .05) ms.nextBar = t0 + .05;   // we fell behind (tab was hidden): restart on time
  let guard = 0;
  // plan a bar a little before it starts…
  while (ms.nextBar < t1 + .4 && guard++ < 8) {
    if (ms.cur !== ms.want) { ms.cur = ms.want; ms.bar = 0; ms.segVoice = {}; ms.motifAt = -1; }
    const M = MOODS[ms.cur] || MOODS.day, beat = 60 / M.bpm;
    scheduleBar(ms, M, ms.nextBar, beat);
    ms.nextBar += beat * 4; ms.bar++;
  }
  // …but build each note's nodes only when it is about to play, so the work is spread out
  const q = ms.queue;
  for (let i = q.length - 1; i >= 0; i--) if (q[i][0] < t1) { const f = q[i][1]; q.splice(i, 1); f(); }
}

function scheduleBar(ms, M, T, beat) {
  const Q = (t, f) => ms.queue.push([t, f]);
  const tl = TL[M.prog], bars = tl.total / 4, barIn = ms.bar % bars, b0 = barIn * 4;
  const arc = [.6, .7, .85, .9, 1, 1, .95, .75][ms.bar % 8], lvl = M.lvl;
  const breakdown = ms.bar % 16 === 15;
  const at = (beatInBar) => Math.max(0, T + beatInBar * beat + (M.swing && beatInBar % 1 === .5 ? M.swing * beat : 0) + rnd(-.005, .005));

  // chord pieces in this bar
  const pieces = [];
  for (const seg of tl.segs) {
    const s = Math.max(seg.beat, b0), e = Math.min(seg.beat + seg.len, b0 + 4);
    if (s < e) pieces.push({ seg, from: s - b0, len: e - s, starts: seg.beat >= b0 });
  }
  pieces.forEach((pz, k) => {
    const seg = pz.seg;
    let v = ms.segVoice[seg.i];
    if (!v || pz.starts) { v = voice(chordPcs(seg), ms.voicing); ms.segVoice[seg.i] = v; ms.voicing = v; }
    const t = at(pz.from);
    // electric piano comping
    const pat = M.ep === 'pad' ? (pz.starts ? [[0, seg.len, 1]] : []) : pick(EP_PAT[M.ep]);
    for (const [ob, dur, vel] of pat) {
      if (ob >= pz.len) continue;
      const d = (M.ep === 'pad' ? dur : Math.min(dur, pz.len - ob)) * beat;
      const te = at(pz.from + ob), ve = vel * lvl * (breakdown ? .8 : 1), ro = M.ep === 'pad' ? rnd(.02, .06) : rnd(0, .012);
      Q(te, () => ep(te, v, Math.max(.25, d - .05), ve, ro));
    }
    if (M.pad && pz.starts) Q(t, () => pad(t, v.map(n => n + 12).slice(1), seg.len * beat, M.pad * lvl * 1.6));
    if (breakdown) return;
    // bass
    const root = bassMidi(KEY + seg.root);
    const next = tl.segs[(seg.i + 1) % tl.segs.length], nextRoot = bassMidi(KEY + next.root);
    const bpat = M.bass === 'slow' ? (pz.starts ? [[0, seg.len, .9, 'R']] : []) : pick(BASS_PAT[M.bass]);
    for (const [ob, dur, vel, kind] of bpat) {
      if (ob >= pz.len) continue;
      let n = root;
      if (kind === '5') n = root + 7 > 50 ? root - 5 : root + 7;
      else if (kind === '8') n = root + 12 > 52 ? root : root + 12;
      else if (kind === 'A') n = nextRoot + (Math.random() < .6 ? -1 : 2);
      const d = (M.bass === 'slow' ? dur : Math.min(dur, pz.len - ob)) * beat;
      const tb = at(pz.from + ob); Q(tb, () => bassNote(tb, n, Math.max(.2, d - .04), vel * lvl));
    }
  });

  // melody: the motif, or a sparse pentatonic line with breathing room
  if (ms.bar % 4 === 0 && Math.random() < M.motif) ms.motifAt = ms.bar;
  const motifBar = ms.motifAt >= 0 && ms.bar - ms.motifAt < 2 ? ms.bar - ms.motifAt : -1;
  const voiceFn = M.flute ? flute : celesta;
  if (motifBar >= 0) {
    for (const [bt, n, d] of MOTIF) if (bt >= motifBar * 4 && bt < motifBar * 4 + 4) { const tm = at(bt - motifBar * 4); Q(tm, () => voiceFn(tm, n, d * beat, .95 * lvl)); }
  } else if (!breakdown && !(ms.bar % 4 === 3 && Math.random() < .7)) {
    const reuse = ms.phrase && ms.bar % 2 === 1 && Math.random() < .5;
    const slots = reuse ? ms.phrase : [];
    if (!reuse) {
      const dens = M.mel * arc;
      for (let s = 0; s < 8 && slots.length < (M.flute ? 6 : 4); s++) if (Math.random() < dens * (s % 2 ? .45 : 1) * (s === 0 ? 1.25 : 1)) slots.push(s);
      ms.phrase = slots;
    }
    const chordAt = beatIn => { const g = b0 + beatIn; return tl.segs.find(sg => g >= sg.beat && g < sg.beat + sg.len) || tl.segs[0]; };
    slots.forEach((s, k) => {
      const bt = s / 2, ch = chordAt(bt);
      ms.mel = Math.max(0, Math.min(MEL.length - 1, ms.mel + pick([-2, -1, -1, 0, 1, 1, 2]) + (reuse ? pick([-1, 1]) : 0)));
      let n = MEL[ms.mel];
      if (s % 2 === 0) {     // strong 8ths settle on a chord tone when one is near
        const tones = chordPcs(ch);
        for (const d of [0, -1, 1, -2, 2]) { const j = ms.mel + d; if (MEL[j] && tones.includes(pc(MEL[j]))) { ms.mel = j; n = MEL[j]; break; } }
      }
      const nextS = slots[k + 1] ?? 9, d = Math.min(3, (nextS - s) / 2 + (k === slots.length - 1 ? 1 : 0)) * beat;
      const tn = at(bt), nn = M.flute && n > 86 ? n - 12 : n, vv = rnd(.75, 1) * lvl; Q(tn, () => voiceFn(tn, nn, Math.max(.18, d), vv));
    });
  }

  // percussion
  if (M.perc && !breakdown) {
    const p = M.perc * arc;
    for (const bt of [1, 3]) if (Math.random() < .92) { const ts = at(bt); Q(ts, () => swish(ts, p)); }
    if (M.bass === 'city') { if (Math.random() < .8) { const tk = at(0); Q(tk, () => kick(tk, p)); } if (Math.random() < .3) { const tk = at(2.5); Q(tk, () => kick(tk, p * .7)); } }
    for (let s = 0; s < 8; s++) if (Math.random() < .3 * p) { const th = at(s / 2), vh = p * (s % 2 ? .6 : 1); Q(th, () => hat(th, vh)); }
  }
  if (M.taiko) {
    const pat = pick([[0, 1, 3], [0, 1, 2, 3, 3.5], [0, 2, 2.5, 3]]);
    for (const bt of pat) { const tt = at(bt); Q(tt, () => taiko(tt, (bt === 0 ? 1 : .7) * lvl)); }
    for (const bt of [.5, 1.5, 2.5, 3.5]) if (Math.random() < .8) { const tk = at(bt); Q(tk, () => ka(tk, .7)); }
    for (const bt of [0, 1, 2, 3]) if (Math.random() < .55) { const tk = at(bt + .5); Q(tk, () => kane(tk, .8)); }
  }
}

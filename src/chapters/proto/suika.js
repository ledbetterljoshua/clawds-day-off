// Sketch: スイカ割り suikawari, a day at the sea. The verb is *prompting*: a blindfolded helper
// walks, turns and swings only on your instructions, each one a message from a small context
// budget, and each helper hears them its own way. In the last round Clawd wears the blindfold
// and the helpers guide you.
import { THREE, V3 } from '../../core/gfx.js';
import { G } from '../../core/state.js';
import { rand, clamp, lerp, ease, pick, wrapAngle, isTouch } from '../../core/util.js';
import { tween, sleep, until } from '../../core/tween.js';
import { Crab, clawd, helpers, crew } from '../../core/crab.js';
import { audio } from '../../core/audio.js';
import { E } from '../../core/audio/engine.js';
import { term } from '../../core/terminal.js';
import { cam } from '../../core/camera.js';
import { sky } from '../../core/sky.js';
import { puff, sparkle } from '../../core/fx.js';
import { hud } from '../../core/hud.js';
import * as B from './suika/beach.js';
import { ui } from './suika/ui.js';

const MAX = 12, SWINGS = 2;
// how each helper hears an instruction
const AG = [
  { tag: 'precise', step: 1.0, little: .3, mult: 1, speed: 1.3, quirk: 'asks', card: 'precise. it asks when it isn\'t sure.' },
  { tag: 'dreamy', step: 1.2, little: .4, mult: 1, speed: 1.3, quirk: 'drift', card: 'dreamy. it drifts toward the sound of the sea.' },
  { tag: 'eager', step: 1.2, little: .4, mult: 2, speed: 2.3, quirk: 'eager', card: 'eager. double steps, and it swings early.' },
];
const PROMPTER = [-6.4, .2];                         // where clawd calls directions from
const SIDES = [[-5.6, -3.5], [5.5, -1.4]];              // where the other two watch from
const STARTS = [[-3.7, .9], [4.2, .6], [2.8, -4.2]];
const GUIDES = [[-5.6, -2.8], [1.4, -4.8], [5.0, .9]]; // round 4: where each helper calls from
const CLAWD_START = [-3.3, 1.0];
const REACH = c => c === clawd ? 1.15 : .74;
const SAY = { fwd: 'forward!', back: 'back!', left: 'left!', right: 'right!', around: 'turn around!', stop: 'STOP!', swing: 'SWING!!' };

let S = null, game_ = null, savedDelegate = null;
const M = new Map();   // crab → its motion on the sand: { x, z, th, queue, act, … }

// ───────────── sounds ─────────────
audio.register('sk-gull', () => { const f = rand(1500, 1900); audio.tone(f, .3, 'sine', .03, f * .7, { attack: .02, send: .2 }); audio.tone(f * 1.02, .24, 'triangle', .018, f * .72, { delay: .34, attack: .02, send: .2 }); });
audio.register('sk-bonk', () => { audio.tone(150, .3, 'sine', .3, 72); audio.noise(.09, 'lowpass', 900, .3); audio.tone(520, .05, 'square', .04, 300, { delay: .005 }); });
audio.register('sk-pakka', () => { audio.noise(.05, 'highpass', 2400, .35); audio.tone(110, .35, 'sine', .32, 55); audio.noise(.45, 'lowpass', 700, .3, 1, { delay: .03, attack: .01, sweep: 250, color: 'pink' }); for (let i = 0; i < 6; i++) audio.tone(rand(900, 1800), .05, 'sine', .03, rand(1500, 2600), { delay: rand(.05, .3) }); });
audio.register('sk-thud', () => { audio.noise(.16, 'lowpass', 420, .32, 1, { color: 'brown' }); audio.noise(.22, 'bandpass', 2600, .07, .7, { delay: .02, attack: .01 }); });
audio.register('sk-bump', () => { audio.tone(260, .12, 'sine', .14, 180); audio.noise(.03, 'bandpass', 1400, .08); });
audio.register('sk-step', () => audio.noise(.06, 'bandpass', rand(1400, 2200), .035, .9, { attack: .005 }));
audio.register('sk-spit', () => { audio.noise(.05, 'bandpass', 2800, .08, 2); audio.tone(900, .05, 'sine', .03, 1400); });
audio.register('sk-spin', () => audio.noise(.35, 'bandpass', 500, .14, .8, { attack: .12, sweep: 1600, color: 'pink' }));

function startSurf() {
  if (!S || S.surf || !E.live) return;
  const b = E.live, c = b.ctx;
  const src = c.createBufferSource(); src.buffer = b.noise.pink; src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = .3;
  const hiss = c.createBufferSource(); hiss.buffer = b.noise.white; hiss.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = .5;
  const hg = c.createGain(); hg.gain.value = .14;
  // the swell follows the foam on the sand (one wave every ~11 s)
  const swell = c.createGain(); swell.gain.value = .55;
  const lfo = c.createOscillator(); lfo.frequency.value = .55 / (Math.PI * 2); const lg = c.createGain(); lg.gain.value = .42; lfo.connect(lg).connect(swell.gain);
  const lvl = c.createGain(); lvl.gain.value = 0; lvl.gain.setTargetAtTime(.12, c.currentTime, 1.2);
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  src.connect(lp).connect(swell); hiss.connect(bp).connect(hg).connect(swell);
  swell.connect(lvl);
  if (pan) lvl.connect(pan).connect(b.vol.amb); else lvl.connect(b.vol.amb);
  src.start(); hiss.start(); lfo.start();
  S.surf = { src, hiss, lfo, lvl, pan, c };
}
function stopSurf(s) {
  if (!s) return;
  s.lvl.gain.setTargetAtTime(0, s.c.currentTime, .4);
  setTimeout(() => { try { s.src.stop(); s.hiss.stop(); s.lfo.stop(); s.lvl.disconnect(); } catch { /* already stopped */ } }, 1600);
}

// ───────────── crabs on the sand ─────────────
// The Crab class walks along x in a lane; here every crab moves in 2D, so its update is wrapped:
// position and facing come from M, and the walk cycle is driven from our own motion.
function hook(c) {
  const m = { x: c.x, z: c.z, th: c.rotY, walk: 0, walkT: 0, moving: false, queue: [], act: null, stick: null, stickS: .45, blind: null, printD: 0, side: 0, wob: 0, stepD: 0 };
  M.set(c, m);
  c.update = function (dt) {
    this.x = this.targetX = m.x; this.z = m.z; this.faceOverride = m.th; this.rotY = m.th;
    if (this !== clawd) this.idleT = Math.min(this.idleT, 10);
    Crab.prototype.update.call(this, dt);
    m.walk = lerp(m.walk, m.moving ? 1 : 0, Math.min(1, dt * 12));
    if (m.walk > .02) {
      m.walkT += dt * 13 * m.walk;
      this.legs.forEach((l, i) => l.rotation.x = Math.sin(m.walkT + (i % 2) * Math.PI) * .55 * m.walk);
      this.inner.position.y += Math.abs(Math.sin(m.walkT)) * .06 * m.walk;
    }
    this.inner.rotation.z = m.wob > 0 ? Math.sin(G.time * 8) * .14 * Math.min(1, m.wob) : 0;
    if (m.stick) {
      m.stick.rotation.x = m.stickS;
      const arm = m.stickS < .45 ? lerp(-2.3, -.9, (m.stickS + .95) / 1.4) : lerp(-.9, -.35, (m.stickS - .45) / 1.5);
      this.arms[1].rotation.x = arm; this.arms[0].rotation.x = arm;
    }
  };
}
function unhook(c) {
  delete c.update;
  const m = M.get(c);
  if (m) { m.stick?.parent?.remove(m.stick); m.blind?.parent?.remove(m.blind); }
  c.inner.rotation.z = 0;
}
function place(c, x, z, th = 0) { const m = M.get(c); m.x = x; m.z = z; m.th = th; m.queue.length = 0; m.act = null; m.moving = false; }
const idle = c => { const m = M.get(c); return !m.act && !m.queue.length; };
function geom(c) {
  const m = M.get(c), dx = B.MELON.x - m.x, dz = B.MELON.z - m.z, dist = Math.hypot(dx, dz);
  const phi = wrapAngle(Math.atan2(dx, dz) - m.th);   // + means the watermelon is to its left
  return { dist, phi, deg: Math.round(Math.abs(phi) * 180 / Math.PI), side: phi > 0 ? 'left' : 'right' };
}
function tracks(c, m, d) {
  m.printD += d; m.stepD += d;
  if (m.printD > .27 * c.scale) { m.printD = 0; m.side ^= 1; B.stamp(m.x, m.z, m.th, c.scale, m.side); }
  if (m.stepD > .5 && Math.random() < .5) { m.stepD = 0; puff(m.x, .04, m.z, 1, [.9, .82, .66]); }
}

// ── actions: { begin?(c, m), step(c, m, dt) → true when finished, cancel?() } ──
function gotoAct(x, z, speed = 2) {
  return { step(c, m, dt) {
    const dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz);
    if (d < .04) { m.moving = false; return true; }
    m.th += clamp(wrapAngle(Math.atan2(dx, dz) - m.th), -dt * 9, dt * 9);
    const s = Math.min(d, speed * dt); m.x += dx / d * s; m.z += dz / d * s; m.moving = true; tracks(c, m, s);
    return false;
  } };
}
function faceAct(th, speed = 7) {
  return { step(c, m, dt) { const d = wrapAngle(th - m.th); if (Math.abs(d) < .02) { m.th = th; return true; } m.th += clamp(d, -dt * speed, dt * speed); return false; } };
}
const callAct = fn => ({ step() { fn(); return true; } });
// scripted walks step around the watermelon instead of through it
function walkTo(c, x, z, speed = 2, face = null) {
  return new Promise(res => {
    const m = M.get(c), legs = [];
    const ax = m.x, az = m.z, dx = x - ax, dz = z - az, L = Math.hypot(dx, dz) || 1;
    const t = clamp(((B.MELON.x - ax) * dx + (B.MELON.z - az) * dz) / (L * L), 0, 1);
    const px = ax + dx * t, pz = az + dz * t, off = Math.hypot(px - B.MELON.x, pz - B.MELON.z);
    if (!B.P?.split && off < 1.1 && t > .05 && t < .95) {
      const nx = -dz / L, nz = dx / L, side = (px - B.MELON.x) * nx + (pz - B.MELON.z) * nz >= 0 ? 1 : -1;
      legs.push(gotoAct(B.MELON.x + nx * side * 1.3, B.MELON.z + nz * side * 1.3, speed));
    }
    m.queue.push(...legs, gotoAct(x, z, speed), ...(face != null ? [faceAct(face)] : []), callAct(res));
  });
}

function moveAct(dist, speed, o = {}) {
  let done = 0;
  return {
    begin(c) { if (o.reply) c.say(o.reply, 1.6); },
    step(c, m, dt) {
      const left = Math.abs(dist) - done;
      if (left <= 1e-4) { m.moving = false; if (o.eager) eagerCheck(c, m); return true; }
      const d = Math.min(left, speed * dt); done += d;
      if (o.drift) {
        // helper 2 hears the sea: each step bends its heading toward the water
        const k = o.drift * d; m.th += clamp(wrapAngle(Math.PI - m.th), -k, k); m.z -= .03 * d;
        if (!S.drifted && done > .8) { S.drifted = true; c.say('the sea is calling…', 1.8); }
      }
      const s = Math.sign(dist), nx = m.x + Math.sin(m.th) * d * s, nz = m.z + Math.cos(m.th) * d * s;
      const hit = blocked(c, m, nx, nz);
      if (hit) { m.moving = false; bump(c, m, hit); if (o.eager) eagerCheck(c, m, hit.melon); return true; }
      m.x = nx; m.z = nz; m.moving = true; tracks(c, m, d);
      if (m.z < B.SHORE + .45) { intoSea(c, m); return true; }
      return false;
    },
  };
}
function turnAct(dir, ang, o = {}) {
  let done = 0, sign = 0;
  return {
    begin(c, m) {
      // helper 1, told "left as you see it", turns the other way while it faces you
      let d = dir;
      if (o.screen && Math.cos(m.th) > 0 && dir !== 'around') d = dir === 'left' ? 'right' : 'left';
      sign = d === 'right' ? -1 : 1;
      if (o.reply) c.say(o.reply(d, ang, d !== dir), 1.6);
    },
    step(c, m, dt) {
      const left = ang - done;
      if (left <= 1e-4) { m.moving = false; return true; }
      const d = Math.min(left, 3.2 * dt); done += d; m.th += sign * d; m.moving = true;
      return false;
    },
  };
}
function swingAct(o = {}) {
  let t = 0, ph = 'wind', from = .45;
  const a = {
    eager: !!o.eager,
    begin(c) {
      if (o.eager) { c.say('SWING? ✦', 1.5); ui.pulse('stop', true); S.eagerNow = a; }
      else if (S.mode === 'prompt') c.say({ asks: 'swinging ✦', drift: 'here goes…', eager: 'HYAA!!' }[AG[S.round]?.quirk] || 'HYAA!!', 1.2);
    },
    cancel() { if (ph === 'wind' || ph === 'hold') { from = M.get(S.agent)?.stickS ?? -.95; ph = 'recover'; t = 0; a.cancelled = true; } },
    step(c, m, dt) {
      t += dt;
      if (ph === 'wind') { m.stickS = lerp(.45, -.95, ease(Math.min(1, t / .3))); if (t >= .3) { ph = 'hold'; t = 0; } }
      else if (ph === 'hold') {
        m.stickS = -.95 + Math.sin(G.time * 40) * (o.eager ? .06 : .02);
        if (t >= (o.eager ? 1.35 : .12)) { ph = 'strike'; t = 0; ui.pulse('stop', false); if (S.eagerNow === a) S.eagerNow = null; audio.sfx('whoosh', { x: m.x }); }
      } else if (ph === 'strike') { m.stickS = lerp(-.95, 1.95, Math.min(1, t / .09)); if (t >= .09) { ph = 'impact'; t = 0; strike(c, m, o); } }
      else if (ph === 'impact') { if (t >= .45) { from = 1.95; ph = 'recover'; t = 0; } }
      else {
        m.stickS = lerp(from, .45, ease(Math.min(1, t / .4)));
        if (t >= .4) { ui.pulse('stop', false); if (S.eagerNow === a) S.eagerNow = null; return true; }
      }
      return false;
    },
  };
  return a;
}

function stepCrab(c, m, dt) {
  if (m.wob > 0) m.wob -= dt * .6;
  if (!m.act && m.queue.length) { m.act = m.queue.shift(); m.act.begin?.(c, m); }
  if (m.act) {
    let done = false;
    try { done = m.act.step(c, m, dt); } catch (e) { console.error(e); done = true; }
    if (done) { m.act = null; m.moving = false; }
  } else if (!(c === clawd && S?.mode === 'blind')) m.moving = false;
}

// what a blindfolded crab can walk into (only when moving closer to it)
function blocked(c, m, x, z) {
  const near = (px, pz, r) => Math.hypot(x - px, z - pz) < r && Math.hypot(x - px, z - pz) < Math.hypot(m.x - px, m.z - pz);
  if (Math.abs(x) > 13 || z > 6.6) return { what: 'edge' };
  for (const s of B.P.solids) if (near(s.x, s.z, s.r + .25)) return s;
  if (!B.P.split && near(B.MELON.x, B.MELON.z, B.MELON_R + (c === clawd ? .42 : .3))) return { what: 'the watermelon', melon: true };
  for (const o of crew) if (o !== c && o.g.visible) { const mo = M.get(o); if (near(mo.x, mo.z, (o === clawd ? .6 : .4) + (c === clawd ? .32 : .2))) return { what: o.name, crab: o }; }
  return null;
}
function bump(c, m, hit) {
  audio.sfx('sk-bump', { x: m.x }); m.wob = .5;
  const q = c === clawd ? 'you' : AG[c.i]?.quirk;
  if (hit.melon) {
    S.events.push({ r: S.round, k: 'melon', who: c });
    if (S.mode === 'blind') { edgeVoice(c, '…something round?', 0); return; }
    c.say({ asks: '…something round. ✦', drift: '…a watermelon? it hums', eager: 'FOUND IT?!' }[q] || '…?', 2);
  } else if (hit.crab) {
    S.events.push({ r: S.round, k: 'crab', who: c, into: hit.crab });
    if (S.mode === 'blind') { edgeVoice(hit.crab, 'oof — that\'s me ✦'); return; }
    hit.crab.say(hit.crab === clawd ? 'oof' : 'hey!', 1.2); hit.crab.hop(.3);
    if (S.mode !== 'blind') c.say(hit.crab === clawd ? 'oof — clawd?' : 'sorry!', 1.6);
  } else if (hit.what === 'edge') { if (S.mode !== 'blind') c.say('…I walked very far', 1.8); }
  else { S.events.push({ r: S.round, k: 'bonk', who: c, what: hit.what }); if (S.mode !== 'blind') c.say(`bonk. ${hit.what}?`, 1.8); }
}
function intoSea(c, m) {
  audio.sfx('splash', { x: m.x }); m.wob = 1;
  for (let i = 0; i < 26; i++) B.P.juice.emit(m.x, .2, m.z, rand(-1.6, 1.6), rand(1.5, 3.5), rand(-1.4, .4), rand(.5, 1), ...pick([[.85, .95, 1], [1, 1, 1], [.6, .85, .95]]));
  S.events.push({ r: S.round, k: 'sea', who: c });
  m.queue.length = 0;
  if (c === clawd) { m.z = B.SHORE + .9; edgeVoice(helpers[1], 'that\'s the sea…!', Math.PI); return; }
  c.say(AG[c.i]?.quirk === 'drift' ? 'the sea… was calling…' : 'COLD!!', 2.2);
  m.queue.push(gotoAct(m.x, B.SHORE + 1.2, 2.4));
}

// ───────────── prompting ─────────────
function spend() { S.msgs++; ui.context(S.msgs, MAX); if (S.msgs >= MAX) ui.enable(false); }

function cmd(c) {
  if (!S) return;
  if (S.mode === 'blind') { if (c === 'swing') blindSwing(); return; }
  if (S.mode !== 'prompt' || S.asking || S.msgs >= MAX || S.lastChance) return;
  if (c === 'little') { S.little = !S.little; ui.little(S.little); audio.sfx('select'); return; }
  const little = S.little; S.little = false; ui.little(false);
  ui.flash(c);
  prompt([{ c, little }], null);
}
function hold(c, on) { if (S) S.hold[c] = on; }

function prompt(cmds, raw) {
  const ag = S.agent, A = AG[S.round], m = M.get(ag);
  spend();
  const said = raw ? raw.slice(0, 48) : (cmds[0].little && cmds[0].c !== 'swing' && cmds[0].c !== 'stop' ? 'a little ' : '') + SAY[cmds[0].c];
  clawd.say(said, 1.6); clawd.workAnim = 'wave'; S.waveT = .5;
  if (!cmds.length) { tween(.5, () => {}, () => S && ag.say({ asks: 'I didn\'t catch that ✦', drift: '…hm?', eager: 'WHAT?!' }[A.quirk], 1.6)); return; }
  if (cmds[0].c === 'stop') { stopAgent(); return; }
  // helper 1 asks once, the first time "left" or "right" could mean two things
  if (A.quirk === 'asks' && !S.frame && cmds.some(k => k.c === 'left' || k.c === 'right') && Math.cos(m.th) > .35) {
    S.asking = cmds; S.events.push({ r: S.round, k: 'ask' });
    tween(.45, () => {}, () => {
      if (!S?.asking) return;
      ag.say('left as you see it, or as I face? ✦', 4);
      ui.ask('🍓 <b>left as you see it, or left as I face?</b>', [['see', 'as I see it', 'left on the screen'], ['face', 'as you face', 'its own left']]);
    });
    return;
  }
  enqueue(cmds);
}
function answer(k) {
  if (!S?.asking) return;
  const cmds = S.asking; S.asking = null; ui.unask();
  spend();
  S.frame = k;
  clawd.say(k === 'see' ? 'as I see it!' : 'as you face!', 1.4);
  tween(.4, () => {}, () => S && S.agent.say(k === 'see' ? 'ok: your left, from where you stand ✦' : 'ok: my own left ✦', 2));
  tween(1, () => {}, () => S && S.mode === 'prompt' && enqueue(cmds));
}
function enqueue(cmds) {
  const ag = S.agent, A = AG[S.round], m = M.get(ag);
  for (const k of cmds) {
    if (k.c === 'swing') { m.queue.push(swingAct()); continue; }
    if (k.c === 'fwd' || k.c === 'back') {
      const dist = clamp((k.little ? A.little : A.step) * (k.n ?? 1) * A.mult, .1, 9) * (k.c === 'back' ? -.8 : 1);
      m.queue.push(moveAct(dist, A.speed, { drift: A.quirk === 'drift' ? .09 : 0, eager: A.quirk === 'eager' && k.c === 'fwd', reply: moveReply(A, k, dist) }));
      continue;
    }
    if (k.c === 'left' || k.c === 'right' || k.c === 'around') {
      const deg = k.c === 'around' ? 180 : clamp(k.deg ?? (k.little ? 15 : 45), 1, 360);
      m.queue.push(turnAct(k.c, deg * Math.PI / 180, { screen: A.quirk === 'asks' && S.frame === 'see', reply: (d, a, flipped) => turnReply(A, k.c === 'around' ? 'around' : d, deg, flipped) }));
    }
  }
}
function moveReply(A, k, v) {
  if (A.quirk === 'asks') return `${k.c === 'fwd' ? 'forward' : 'back'} ${Math.abs(v).toFixed(2)} ✦`;
  if (A.quirk === 'drift') return pick(k.c === 'fwd' ? ['forward…', 'walking…', 'mm, forward'] : ['back…', 'backing up, softly']);
  return k.c === 'fwd' ? (k.little ? 'A LITTLE!! (a lot)' : 'FORWARD!! ✦') : 'BACK!!';
}
function turnReply(A, d, deg, flipped) {
  if (A.quirk === 'asks') return d === 'around' ? 'turning 180.0° ✦' : `${flipped ? `your ${d === 'left' ? 'right' : 'left'} = my ${d} · ` : ''}${d} ${deg.toFixed(1)}° ✦`;
  if (A.quirk === 'drift') return d === 'around' ? 'all the way around…' : `${d}…`;
  return d === 'around' ? 'SPINNING!! ✦' : `${d.toUpperCase()}!!`;
}
function stopAgent() {
  const ag = S.agent, m = M.get(ag), q = AG[S.round].quirk;
  const busy = !!(m.act || m.queue.length);
  m.queue.length = 0;
  if (m.act) { if (m.act.cancel) m.act.cancel(); else { m.act = null; m.moving = false; } }
  if (S.eagerNow) { S.events.push({ r: S.round, k: 'eagerStop' }); tween(.3, () => {}, () => S && ag.say('ok ok… waiting ✦', 1.6)); return; }
  tween(.3, () => {}, () => S && ag.say(busy ? { asks: 'stopped ✦', drift: 'stopping…', eager: 'STOPPED!!' }[q] : 'already still ✦', 1.4));
}
function eagerCheck(c, m, sure = false) {
  if (m.queue.length || S.swings <= 0 || S.mode !== 'prompt') return;
  if (sure || Math.random() < (geom(c).dist < 2.2 ? .7 : .15)) m.queue.push(swingAct({ eager: true }));
}

// typed prompts: "turn left 30 then forward 2 then swing" is one message
const WORD = {
  stop: /\b(stop|wait|halt|freeze|not yet|no+)\b/, swing: /\b(swing|hit|now|strike|smash|whack|bonk|chop)\b/,
  around: /\b(around|180)\b/, left: /\bleft\b/, right: /\bright\b/, back: /\b(back|backward|backwards|reverse)\b/,
  fwd: /\b(forward|forwards|ahead|straight|go|walk|step|steps|fwd|f|closer)\b/, little: /\b(little|bit|slightly|tiny|smidge|small)\b/,
};
function parse(text) {
  const out = [];
  for (const raw of text.toLowerCase().split(/\bthen\b|\band\b|[,;]+|\.(?!\d)/)) {
    const s = raw.trim(); if (!s) continue;
    const num = +(s.match(/(\d+(?:\.\d+)?)/)?.[1] ?? NaN), n = num > 0 ? num : null, little = WORD.little.test(s);
    if (WORD.stop.test(s)) out.push({ c: 'stop' });
    else if (WORD.swing.test(s)) out.push({ c: 'swing' });
    else if (WORD.around.test(s)) out.push({ c: 'around' });
    else if (WORD.left.test(s) || WORD.right.test(s)) out.push({ c: WORD.left.test(s) ? 'left' : 'right', deg: n ? (n > 3 ? n : n * 45) : null, little });
    else if (WORD.back.test(s)) out.push({ c: 'back', n, little });
    else if (WORD.fwd.test(s) || n) out.push({ c: 'fwd', n, little });
  }
  return out.slice(0, 5);
}
function typed(raw) {
  if (!S) return 'not now';
  if (S.asking) { const k = /face|its|your left/.test(raw) ? 'face' : /see|screen|my left/.test(raw) ? 'see' : null; if (k) { answer(k); return { t: `> answered: ${k === 'see' ? 'as I see it' : 'as you face'}`, c: '#7bd88f' }; } return 'helper 1 is waiting: "as I see it" or "as you face"'; }
  if (S.mode === 'blind') return 'you\'re blindfolded. (arrows to walk, space to swing)';
  if (S.mode !== 'prompt') return 'wait for the next round';
  if (S.msgs >= MAX || S.lastChance) return { t: 'context full', c: '#f7d488' };
  const cmds = parse(raw);
  prompt(cmds, raw);
  return cmds.length ? { t: `→ ${S.agent.name}: ${cmds.map(k => k.c + (k.n ? ' ' + k.n : '') + (k.deg ? ' ' + k.deg + '°' : '') + (k.little ? ' (a little)' : '')).join(' → ')}  ·  ${S.msgs}/${MAX} messages`, c: '#7bd88f' } : { t: `${S.agent.name}: ??? (that cost a message)`, c: '#f7d488' };
}

// ───────────── swings ─────────────
function strike(c, m, o) {
  S.swings--; ui.swings(S.swings, SWINGS);
  const r = REACH(c), sx = m.x + Math.sin(m.th) * r, sz = m.z + Math.cos(m.th) * r;
  const d = Math.hypot(sx - B.MELON.x, sz - B.MELON.z), hit = !B.P.split && d < B.MELON_R + .22;
  if (o.eager) S.events.push({ r: S.round, k: 'eager', hit });
  if (S.mode === 'blind') return blindResult(hit, d, sx, sz);
  if (hit) {
    S.cracks++; B.crack(S.cracks); S.melonWob = 1;
    audio.sfx('sk-bonk', { x: sx }); B.juice(B.MELON.x, B.MELON_R * 1.6, B.MELON.z, 10);
    helpers.filter(h => h !== c).forEach((h, i) => tween(.2 + i * .25, () => {}, () => S && (h.say(pick(['✦✦✦', 'やったー!', 'CRACKED!!', 'nice!!']), 1.6), h.hop(.6))));
    clawd.mood('happy', 2);
    endRound(true);
  } else {
    audio.sfx('sk-thud', { x: sx }); puff(sx, .05, sz, 12, [.93, .85, .68]);
    const near = d < B.MELON_R + .9;
    if (d > 3.5) S.events.push({ r: S.round, k: 'far', who: c });
    tween(.4, () => {}, () => {
      if (!S) return;
      if (near) helpers.find(h => h !== c)?.say('so close!!', 1.4);
      else clawd.say(pick(['…ahaha', 'not even close ✦', 'wrong watermelon']), 1.6);
    });
    if (S.swings <= 0 || S.lastChance) endRound(false, near);
    else tween(.9, () => {}, () => S && S.mode === 'prompt' && c.say({ asks: 'one swing left ✦', drift: 'one more…', eager: 'AGAIN!!' }[AG[S.round].quirk], 1.6));
  }
}

// ───────────── rounds ─────────────
const alive = tok => S && S.tok === tok;
async function startRound(r) {
  const tok = S.tok;
  Object.assign(S, { round: r, mode: 'setup', msgs: 0, swings: SWINGS, frame: null, asking: null, little: false, lastChance: false, eagerNow: null, drifted: false, shoutT: 5, shoutI: 0 });
  S.agent = r < 3 ? helpers[r] : clawd;
  ui.mode('off'); ui.context(0, MAX); ui.swings(SWINGS, SWINGS); ui.enable(true); ui.little(false);
  const p0 = G.phase; tween(2.5, e => G.phase = lerp(p0, .36 + r * .05, e));
  B.clearPrints();
  const ag = S.agent, others = helpers.filter(h => h !== ag);
  const [sx, sz] = r < 3 ? STARTS[r] : CLAWD_START, jx = sx + rand(-.4, .4), jz = sz + rand(-.3, .3);
  if (r < 3) {
    walkTo(clawd, ...PROMPTER, 2.6);
    others.forEach((h, i) => walkTo(h, ...SIDES[i], 2.2));
  } else helpers.forEach((h, i) => walkTo(h, ...GUIDES[i], 2.2));
  await walkTo(ag, jx, jz, 2.4, Math.atan2(B.MELON.x - jx, B.MELON.z - jz));
  if (!alive(tok)) return;
  await until(() => crew.every(idle), 3);
  if (!alive(tok)) return;
  // blindfold and stick
  const m = M.get(ag);
  m.blind = B.blindfold(); ag.inner.add(m.blind);
  m.stick = B.stick(); ag.inner.add(m.stick); m.stickS = .45;
  audio.sfx('paper'); ag.hop(.3);
  if (r < 3) {
    hudToast(`round ${r + 1} · ${ag.name} ${ag.icon}`, AG[r].card);
    ag.say(['blindfold on ✦', 'it\'s dark… and nice', 'I CAN\'T SEE ANYTHING ✦'][r], 1.8);
    term.log(`── round ${r + 1}: ${ag.name} ${ag.icon} (${AG[r].tag}) is blindfolded ──`, '#f2c14e');
    term.log('   prompt it: forward 2 · turn left 30 · a little right · turn around · back · stop · swing', '#a79e94');
    term.log('   chain with "then": every line is one message', '#a79e94');
  } else {
    hudToast('round 4 · you', 'now you wear the blindfold. listen.');
    clawd.say('…my turn?', 1.6);
  }
  await sleep(1.4);
  if (!alive(tok)) return;
  if (r === 3) { ui.blind(true); audio.setMood('quiet'); await sleep(.8); if (!alive(tok)) return; }
  await spin(ag, r === 3);
  if (!alive(tok)) return;
  if (r < 3) {
    S.mode = 'prompt'; ui.mode('prompt');
    ag.say({ asks: 'ready. instruct me ✦', drift: '…which way is anything?', eager: 'READY!! WHICH WAY?!' }[AG[r].quirk], 2);
  } else {
    S.mode = 'blind'; S.control = true; S.hold = {}; S.shoutT = 1.2; S.shoutI = 0; S.lastHeard = {};
    ui.mode('blind');
  }
}
// three turns on the spot, then a heading that isn't the watermelon's
async function spin(c, blind) {
  const m = M.get(c), g = geom(c);
  let target = m.th;
  for (let i = 0; i < 20; i++) {
    target = c === helpers[0] ? rand(-.7, .7) : rand(-Math.PI, Math.PI);
    if (Math.abs(wrapAngle(target - (m.th + g.phi))) > .8) break;
  }
  const th0 = m.th, total = Math.PI * 6 + ((wrapAngle(target - th0) + Math.PI * 2) % (Math.PI * 2));
  if (!blind) c.say('ぐる ぐる ぐる…', 1.8);
  for (let k = 0; k < 3; k++) tween(k * .55, () => {}, () => audio.sfx('sk-spin', { x: m.x }));
  S.camTight = c;
  await new Promise(res => tween(1.7, e => {
    m.th = th0 + total * ease(e);
    if (blind) ui.spin(total * ease(e) * .6);
    if (Math.random() < .3) B.P.dizzy.emit(m.x + rand(-.3, .3), (c === clawd ? 1.5 : 1.0), m.z + rand(-.3, .3), rand(-.8, .8), rand(.2, .8), rand(-.8, .8), .7, 1, .9, .5);
  }, res));
  S.camTight = null;
  m.wob = 1.4;
  if (!blind) c.say('…ok ✦', 1.2);
}
async function endRound(hit, near = false) {
  const tok = S.tok, r = S.round, ag = S.agent, m = M.get(ag);
  S.mode = 'result'; ui.mode('off'); S.results[r] = { hit, msgs: S.msgs };
  await sleep(hit ? 1.5 : 1.1);
  if (!alive(tok)) return;
  m.blind?.parent?.remove(m.blind); m.blind = null; audio.sfx('paper');
  const g = geom(ag);
  ag.mood(hit ? 'happy' : 'wow', 2);
  ag.say(hit ? ['clean hit ✦', 'it sounded like a drum…', 'ICE IS MY THING ✦'][r] : near ? 'so close…!' : g.dist > 3.5 ? 'oh. I was over HERE?' : 'huh. it was right there', 2.2);
  await sleep(2);
  if (!alive(tok)) return;
  m.stick?.parent?.remove(m.stick); m.stick = null;
  startRound(r + 1);
}

// ───────────── round 4: you're blindfolded ─────────────
function blindSwing() {
  if (!S.control || S.swings <= 0) return;
  const m = M.get(clawd); if (m.act) return;
  m.queue.push(swingAct({ blind: true })); audio.sfx('whoosh');
}
function blindResult(hit, d, sx, sz) {
  const tok = S.tok;
  if (hit) {
    S.control = false; S.results[3] = { hit: true, swings: SWINGS - S.swings };
    reveal(); B.split(); audio.sfx('sk-pakka', { x: sx }); S.melonWob = 0;
    cheer('パカッ!!');
    tween(3.2, () => {}, () => alive(tok) && game_.finish(finalResult()));
    return;
  }
  audio.sfx('sk-thud', { x: sx }); puff(sx, .05, sz, 12, [.93, .85, .68]);
  const near = d < B.MELON_R + .9;
  if (S.swings > 0) {
    edgeVoice(helpers[2], near ? 'SO CLOSE!! AGAIN!!' : 'AHAHA', null, true);
    tween(.7, () => {}, () => alive(tok) && edgeVoice(helpers[0], near ? 'a hair to the side ✦' : 'not even close ✦', null));
    return;
  }
  S.control = false; S.results[3] = { hit: false, swings: SWINGS };
  S.events.push({ r: 3, k: d > 3 ? 'clawdFar' : 'clawdMiss' });
  reveal();
  (async () => {
    await sleep(1.2); if (!alive(tok)) return;
    clawd.say(d > 3 ? '…I was over here?' : 'so close…', 2);
    helpers.forEach((h, i) => tween(.3 + i * .2, () => {}, () => alive(tok) && (h.say(pick(['ahaha', 'ahahaha ✦', 'nice try!']), 1.6), h.hop(.4))));
    await sleep(2); if (!alive(tok)) return;
    // helper 3 finishes the job
    const h3 = helpers[2]; S.events.push({ r: 3, k: 'h3chop' });
    h3.say('ice is my thing ✦', 1.8);
    await walkTo(h3, B.MELON.x + .55, B.MELON.z + .25, 2.6, Math.atan2(-.55, -.25));
    if (!alive(tok)) return;
    h3.workAnim = 'chop'; await sleep(.5); if (!alive(tok)) return; h3.workAnim = null;
    B.split(); audio.sfx('sk-pakka'); cheer('パカッ!!');
    await sleep(2.6); if (!alive(tok)) return;
    game_.finish(finalResult());
  })();
}
function reveal() {
  const m = M.get(clawd);
  S.mode = 'reveal';
  ui.blind(false); ui.mode('off'); ui.clearEdges();
  m.blind?.parent?.remove(m.blind); m.blind = null;
  tween(1.4, () => {}, () => { if (S && m.stick) { m.stick.parent?.remove(m.stick); m.stick = null; } });
  audio.setMood('festival'); audio.sfx('paper');
  if (S.surf?.pan) S.surf.pan.pan.setTargetAtTime(0, S.surf.c.currentTime, .5);
}
function cheer(t) {
  crew.forEach((c, i) => tween(.15 + i * .12, () => {}, () => { if (!S) return; c.hop(.8); c.mood('happy', 2); if (c !== clawd) c.say(i === 1 ? t : pick(['✦✦✦', 'やったー!', 'watermelon!!']), 1.8); }));
  sparkle(B.MELON.x, .8, B.MELON.z, 24, [1, .6, .5]);
}
function finalResult() {
  const R = S.results, hits = R.filter(x => x?.hit).length, msgs = R.slice(0, 3).reduce((a, x) => a + (x?.msgs || 0), 0);
  const perfect = hits === 4 && msgs <= 24;
  return { complete: true, perfect, stamp: perfect ? 'perfect' : hits >= 2 ? 'good' : 'tried' };
}

// the guides call out to you; where a voice comes from tells you where they stand
function edgeVoice(h, text, bearing = null, loud = false) {
  const mc = M.get(clawd), mh = M.get(h);
  const b = bearing ?? wrapAngle(Math.atan2(mh.x - mc.x, mh.z - mc.z) - mc.th);
  ui.edge(h.icon || '✦', text, b, { loud });
  audio.sfx('voice', { i: h.i, n: text.length, x: -Math.sin(b) * 10 });
}
function guideLine(h) {
  const g = geom(clawd), r = REACH(clawd), ready = g.dist < r + B.MELON_R && g.deg < 20;
  const m = M.get(clawd), seaB = wrapAngle(Math.PI - m.th);
  if (h.i === 0) {   // exact, a little slow
    if (ready) return ['swing ✦', false];
    if (g.deg > 10) return [`${g.side}, ${g.deg}° ✦`, false];
    return [`${Math.max(.5, Math.round((g.dist - r) * 2) / 2)} steps forward ✦`, false];
  }
  if (h.i === 1) {   // warmer, colder; or where the sea is
    const last = S.lastHeard[1]; S.lastHeard[1] = g.dist;
    if (last != null && Math.abs(last - g.dist) > .3) return [g.dist < last ? 'warmer…' : 'colder…', false];
    return [`the sea is ${Math.abs(seaB) < .8 ? 'in front of you' : Math.abs(seaB) > 2.3 ? 'behind you' : seaB > 0 ? 'on your left' : 'on your right'}…`, false];
  }
  // helper 3: loud, usually right about the side, always early with SWING
  if (g.dist < 2.4) return ['SWING NOW!!', true];
  if (g.deg < 18) return ['STRAIGHT!! GO GO GO', true];
  const other = g.side === 'left' ? 'right' : 'left';
  return [Math.random() < .3 ? `${other.toUpperCase()}!! …no — ${g.side.toUpperCase()}!!` : `${g.side.toUpperCase()}!! ${g.side.toUpperCase()}!!`, true];
}

// ───────────── spectators ─────────────
function advice(sp, ag) {
  const g = geom(ag), r = REACH(ag), ready = g.dist < r + B.MELON_R + .1 && g.deg < 22;
  if (sp.i === 0) {
    if (ready) return 'swing now ✦';
    if (g.deg > 12) return `turn ${g.side} ${g.deg}° ✦`;
    return `${(g.dist - r).toFixed(1)} forward ✦`;
  }
  if (sp.i === 1) {
    const last = S.lastSpecDist; S.lastSpecDist = g.dist;
    if (last != null && Math.abs(last - g.dist) > .3) return g.dist < last ? 'warmer…' : 'colder…';
    return pick([`the watermelon is humming to your ${g.side}…`, g.deg > 120 ? 'it\'s behind you, I think' : 'listen to the waves…']);
  }
  if (g.dist < 2.2 && Math.random() < .5) return 'SWING NOW!!';
  if (g.deg < 15) return 'STRAIGHT!! GO GO GO';
  // helper 3 often calls it as it sees it, which is backwards when the blindfolded one faces us
  const screen = Math.cos(M.get(ag).th) > .3 && Math.random() < .55;
  const side = screen ? (g.side === 'left' ? 'right' : 'left') : g.side;
  return screen ? `${side.toUpperCase()}!! (my ${side}!)` : `${side.toUpperCase()}!!`;
}

// ───────────── camera ─────────────
function frame(pois, { margin = 1.6, minW = 4.6, k = 1.2, pitch = .72 } = {}) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of pois) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const asp = innerWidth / innerHeight, tall = asp < 1, fov = tall ? 54 : 40, t = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const pv = tall ? pitch + .2 : pitch, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const W = Math.max(tall ? minW * .55 : minW, (x1 - x0) / 2 + margin), D = (z1 - z0) / 2 + margin;
  const d = Math.max(W / (t * asp), D * Math.sin(pv) / t * 1.2, 7);
  cam.mode = 'shot'; cam.k = k; cam.tfov = fov; cam.drift = 0;
  // aim a little behind the middle, so the sea shows along the top of the frame
  const lz = cz + (tall ? .5 : .8);
  cam.tlook.set(cx, .3, lz);
  cam.tpos.set(cx, .3 + Math.sin(pv) * d, lz + Math.cos(pv) * d);
}
function playCamera() {
  const tall = innerWidth < innerHeight, mel = [B.MELON.x, B.MELON.z];
  const pos = c => { const m = M.get(c); return [m.x, m.z]; };
  if (S.camTight) return frame([pos(S.camTight), mel], { margin: 1.5, minW: 3.2, k: 1.6 });
  if (S.mode === 'ending') return;
  if (S.round < 0) return;
  const ag = S.agent;
  if (tall) return frame([pos(ag), mel], { margin: 1.4, minW: 3.6 });
  frame([...crew.map(pos), mel], { margin: 1.7, minW: 5.8 });
}

const hudToast = (big, small) => hud.toast(`<b>${big}</b> <span style="color:var(--dim)">· ${small}</span>`, { dur: 3.6 });

// ───────────── per frame ─────────────
const _sun = new V3();
function play(dt) {
  playCamera();
  if (S.waveT > 0) { S.waveT -= dt; if (S.waveT <= 0 && clawd.workAnim === 'wave') clawd.workAnim = null; }
  if (S.melonWob > 0) { S.melonWob = Math.max(0, S.melonWob - dt * 2.2); const w = Math.sin(S.melonWob * 20) * .07 * S.melonWob; B.P.melon.scale.set(1.04 + w, .92 - w, .96 + w); }
  const ag = S.agent;
  if (S.mode === 'prompt' && ag) { const am = M.get(ag); B.aim(am.x, am.z, am.th, REACH(ag), ag.scale); } else B.aim(null);
  if (S.mode === 'prompt' && ag) {
    const am = M.get(ag);
    // everyone watching turns toward the blindfolded one
    for (const c of crew) if (c !== ag && idle(c)) { const m = M.get(c); m.th += clamp(wrapAngle(Math.atan2(am.x - m.x, am.z - m.z) - m.th), -dt * 4, dt * 4); }
    S.shoutT -= dt;
    if (S.shoutT <= 0 && idle(ag) && !S.asking) {
      S.shoutT = rand(4.5, 7);
      const specs = helpers.filter(h => h !== ag), sp = specs[S.shoutI++ % specs.length];
      sp.say(advice(sp, ag), 2.6); sp.hop(.25);
    }
    // out of messages: it compacts, and swings once on its own
    if (S.msgs >= MAX && !S.lastChance && idle(ag) && !S.asking) {
      S.lastChance = true; S.events.push({ r: S.round, k: 'full' });
      ag.say({ asks: 'context full. compacting ✦', drift: 'my mind is full of waves…', eager: 'TOO MANY WORDS. SWINGING!!' }[AG[S.round].quirk], 2.2);
      const tok = S.tok;
      tween(1.8, () => {}, () => alive(tok) && S.mode === 'prompt' && M.get(ag).queue.push(swingAct()));
    }
  }
  if (S.mode === 'blind') blindPlay(dt);
  S.gullT -= dt;
  if (S.gullT <= 0) { S.gullT = rand(9, 20); audio.sfx('sk-gull', { x: rand(-8, 8) }); }
}
function blindPlay(dt) {
  const m = M.get(clawd);
  crew.forEach(c => c.bubT = 0);   // in the dark, voices come from the edges instead
  if (S.control && !m.act) {
    const H = S.hold, turn = (H.left ? 1 : 0) - (H.right ? 1 : 0), mv = (H.fwd ? 1 : 0) - (H.back ? .7 : 0);
    if (turn) m.th += turn * 1.8 * dt;
    if (mv) {
      const d = mv * 1.35 * dt, nx = m.x + Math.sin(m.th) * d, nz = m.z + Math.cos(m.th) * d, hit = blocked(clawd, m, nx, nz);
      if (hit) { if (!S.bumpT || S.bumpT < 0) { bump(clawd, m, hit); S.bumpT = 1; } }
      else { m.x = nx; m.z = nz; tracks(clawd, m, Math.abs(d)); S.stepD = (S.stepD || 0) + Math.abs(d); if (S.stepD > .45) { S.stepD = 0; audio.sfx('sk-step'); } }
      if (m.z < B.SHORE + .45) intoSea(clawd, m);
    }
    m.moving = !!(turn || mv);
  }
  if (S.bumpT > 0) S.bumpT -= dt;
  // light through the cloth when you face the sun; the sea is heard from where it is
  _sun.copy(sky.sunDir); _sun.y = 0; _sun.normalize();
  ui.light(clamp(Math.sin(m.th) * _sun.x + Math.cos(m.th) * _sun.z, 0, 1));
  if (S.surf?.pan) S.surf.pan.pan.setTargetAtTime(clamp(-Math.sin(wrapAngle(Math.PI - m.th)) * .75, -.75, .75), S.surf.c.currentTime, .15);
  if (!S.control) return;
  S.shoutT -= dt;
  if (S.shoutT <= 0) {
    const order = [0, 2, 1, 2], h = helpers[order[S.shoutI++ % order.length]];
    const [line, loud] = guideLine(h);
    edgeVoice(h, line, null, loud);
    S.shoutT = rand(1.6, 2.3);
  }
}

function hint() {
  if (!S) return '';
  if (S.mode === 'blind') return isTouch() ? 'you\'re blindfolded · hold the arrows to walk and turn · SWING when they say so · who do you trust?' : 'you\'re blindfolded · ↑↓ walk · ← → turn · space swings · who do you trust?';
  if (S.mode !== 'prompt') return '';
  if (S.asking) return 'helper 1 wants to know which "left" you mean';
  const A = AG[S.round], ag = S.agent, m = M.get(ag);
  if (S.msgs >= MAX - 2 && S.msgs < MAX) return `${MAX - S.msgs} message${MAX - S.msgs === 1 ? '' : 's'} left · then it swings on its own`;
  if (A.quirk === 'eager' && S.eagerNow) return 'it\'s winding up on its own · STOP if it isn\'t lined up';
  if (A.quirk === 'drift' && S.drifted) return 'helper 2 bends toward the sea as it walks · aim a little inland';
  if (A.quirk === 'eager') return 'helper 3 takes double steps · ちょっと (a little) is still a lot · STOP stops it';
  if (Math.cos(m.th) > .5 && A.quirk !== 'asks') return 'it\'s facing you: its left is your right';
  if (S.round === 0 && S.msgs === 0) return isTouch() ? 'guide helper 1 to the watermelon · ⬆ forward · ⟲ ⟳ turn · SWING when it\'s close' : 'guide helper 1 to the watermelon · ↑ forward · ← → turn · space to SWING · / to type a prompt';
  if (!isTouch() && S.round === 1 && S.msgs < 2) return 'tip: press / and type "turn left 60 then forward 3": one message';
  return `get it close and facing the watermelon, then SWING · ${S.swings} swing${S.swings === 1 ? '' : 's'} left`;
}

// ───────────── the evening ─────────────
async function introRun(game) {
  const tok = S.tok, skip = G.dev.has('skip');
  helpers.forEach(h => h.g.visible = true);
  // they gather on the sea side of the sheet, facing it (and us)
  const spots = [[clawd, -1.1, -2.6], [helpers[0], 1.8, -2.25], [helpers[1], -2.05, -1.75], [helpers[2], .75, -1.55]];
  place(clawd, -9.5, 1.5, Math.PI / 2); place(helpers[0], -10.7, .8, Math.PI / 2); place(helpers[1], -11.3, 2.1, Math.PI / 2); place(helpers[2], -11.9, 1.2, Math.PI / 2);
  if (skip) {
    spots.forEach(([c, x, z]) => place(c, x, z, Math.atan2(B.MELON.x - x, B.MELON.z - z)));
    G.phase = .34; return;
  }
  S.carry = helpers[2];
  const tall = innerWidth < innerHeight;
  cam.shot(tall ? new V3(-1.5, 3.2, 14.5) : new V3(2.2, 2.3, 9.8), new V3(-1.2, 1.1, -6), { fov: tall ? 62 : 46, cut: true, drift: .5 });
  ui.title('げつようび · うみ', 'monday · the sea', 3);
  audio.sfx('sk-gull', { x: -4 });
  spots.forEach(([c, x, z], i) => walkTo(c, x, z, 2.1 - i * .05, Math.atan2(B.MELON.x - x, B.MELON.z - z)));
  await sleep(1.6); if (!alive(tok)) return;
  helpers[2].say('heavy ✦ but ice is strong', 2);
  await until(() => crew.every(idle), 6); if (!alive(tok)) return;
  // helper 3 sets it down on the sheet
  cam.shot(tall ? new V3(-.2, 1.8, 5.2) : new V3(.5, 1.35, 2.6), new V3(-.3, .75, -2.4), { fov: tall ? 58 : 40, k: 1.4, drift: .3 });
  const from = B.P.melon.position.clone(); S.carry = null;
  await new Promise(res => tween(.55, e => { B.P.melon.position.set(lerp(from.x, B.MELON.x, e), lerp(from.y, B.MELON_R * .92, e) + Math.sin(e * Math.PI) * .35, lerp(from.z, B.MELON.z, e)); }, res));
  audio.sfx('clunk'); puff(B.MELON.x, .05, B.MELON.z, 8, [.93, .85, .68]); helpers[2].hop(.4);
  await sleep(.6); if (!alive(tok)) return;
  clawd.say('suikawari ✦', 1.6); await sleep(1.5);
  helpers[0].say('blindfold, three spins, one stick ✦', 2.2); await sleep(2.1);
  helpers[2].say('and EVERYONE yells directions!!', 2); await sleep(1.9);
  clawd.say('…only my directions count.', 2); await sleep(1.9);
  helpers[1].say('the sea will have opinions too…', 2); await sleep(2);
}

async function ending(result, game) {
  if (!S) return;
  S.mode = 'ending'; ui.mode('off'); ui.blind(false);
  if (result.quit) { clawd.say('another time ✦', 1.4); await sleep(1.2); return; }
  if (!B.P.split) B.split();
  const tok = S.tok;
  // everyone sits behind the halves, facing us, with the sea behind them
  const seats = [[clawd, -.15, -2.55], [helpers[0], -1.3, -2.2], [helpers[1], 1.05, -2.25], [helpers[2], 1.95, -1.8]];
  seats.forEach(([c, x, z]) => walkTo(c, x, z, 2.4, 0));
  const tall = innerWidth < innerHeight;
  cam.shot(tall ? new V3(.3, 1.9, 7.4) : new V3(.15, 1.3, 3.6), new V3(.1, .95, -4), { fov: tall ? 56 : 40, k: 1.1, drift: .4 });
  crew.forEach(c => { const m = M.get(c); if (m.stick) { m.stick.parent?.remove(m.stick); m.stick = null; } if (m.blind) { m.blind.parent?.remove(m.blind); m.blind = null; } });
  const p0 = G.phase; tween(7, e => G.phase = lerp(p0, .6, ease(e)));
  audio.setMood('golden');
  await until(() => crew.every(idle), 3.5); if (!alive(tok)) return;
  S.slices = crew.map(c => { const s = B.slice(); s.position.set(-.05, .1, .25); s.rotation.set(.2, 0, 0); c.hand.add(s); c.sitTarget = 1; c.workAnim = 'eat'; return s; });
  audio.sfx('crunch');
  await sleep(1.4); if (!alive(tok)) return;
  helpers[0].say('the seeds sit in a ring ✦', 2);
  await sleep(1.1); if (!alive(tok)) return;
  game.snap();
  S.spitT = .4;
  await sleep(1.4); if (!alive(tok)) return;
  helpers[1].say('it tastes like the breeze', 2);
  await sleep(2.2); if (!alive(tok)) return;
  helpers[2].say('I spat mine the FARTHEST!!', 2);
  await sleep(2.2); if (!alive(tok)) return;
  clawd.say('best day off ✦', 2);
  await sleep(2.4);
}

function diary(result) {
  const R = S?.results || [], ev = S?.events || [];
  const name = i => ['Helper 1', 'Helper 2', 'Helper 3'][i];
  const lines = ['Today we went to the sea and played suikawari. I was the one who gave directions.'];
  const said = [
    (x, n) => x.hit ? `Helper 1 asked exactly what I meant, then hit it (${n}).` : `Helper 1 measured everything and still missed (${n}).`,
    (x, n) => x.hit ? `Helper 2 kept drifting toward the waves, but it hit it (${n}).` : `Helper 2 followed the sound of the sea instead (${n}).`,
    (x, n) => x.hit ? `Helper 3 took giant steps and hit it hard (${n}).` : `Helper 3 took giant steps right past it (${n}).`,
  ];
  for (let i = 0; i < 3; i++) { const x = R[i]; if (x) lines.push(said[i](x, `${x.msgs} message${x.msgs === 1 ? '' : 's'}`)); }
  const funny = ev.find(e => e.k === 'sea') ? `${e2name(ev.find(e => e.k === 'sea').who)} walked straight into the sea. It said the sea was calling.`
    : ev.find(e => e.k === 'eager') ? 'Helper 3 swung before I even said to.'
    : ev.find(e => e.k === 'crab') ? `${e2name(ev.find(e => e.k === 'crab').who)} walked right into ${ev.find(e => e.k === 'crab').into === clawd ? 'me' : 'a helper'}.`
    : ev.find(e => e.k === 'full') ? 'I used up all my words once, so it just swung.'
    : ev.find(e => e.k === 'ask') ? 'Helper 1 asked whether I meant my left or its left. Good question.'
    : ev.find(e => e.k === 'far') ? 'Someone swung at nothing, very far away.' : null;
  if (funny) lines.push(funny);
  const me = R[3];
  if (me) lines.push(me.hit ? 'Then I wore the blindfold. I couldn\'t see anything, but I listened, and I cracked it open!' : 'Then I wore the blindfold. I missed. Helper 3 chopped it open instead.');
  lines.push('We ate it on the sand. The seeds went everywhere.');
  return { jp: 'きょうは うみで すいかわりを しました。すいかは あまかったです。', lines };
}
const e2name = c => c === clawd ? 'I' : c ? c.name[0].toUpperCase() + c.name.slice(1) : 'Someone';

function stats() {
  const R = S?.results || [], mark = x => x ? (x.hit ? '✓' : '✗') : '·';
  const msgs = R.slice(0, 3).reduce((a, x) => a + (x?.msgs || 0), 0);
  return `cracked: h1 ${mark(R[0])} · h2 ${mark(R[1])} · h3 ${mark(R[2])} · you ${mark(R[3])} · ${msgs} messages`;
}

const typedCmd = (args, raw) => typed(raw);
const COMMAND_WORDS = ['forward', 'fwd', 'f', 'go', 'walk', 'step', 'move', 'straight', 'ahead', 'back', 'left', 'right', 'turn', 'stop', 'wait', 'swing', 'hit', 'now', 'a', 'little', 'slightly', 'please', 'ok', 'okay', 'just', 'see', 'face', 'as', 'no', 'keep', 'more'];

export default {
  id: 'suika', day: 8, title: 'Suikawari', jp: 'スイカ割り', short: 'スイカ割り', proto: true,
  weather: 'はれ', blurb: 'A day at the sea. You give the directions; then it\'s your turn under the blindfold.',
  sketch: [
    'a sketch of a new kind of evening: the verb is prompting.',
    'a blindfolded helper moves only on your instructions, and each one costs a message from a small context budget.',
    'helper 1 asks when it isn\'t sure. helper 2 drifts toward the sound of the sea. helper 3 takes double steps and swings early.',
    'then you wear the blindfold, and the helpers guide you.',
  ],
  prompt: 'suikawari at the sea', goal: 'crack the watermelon (スイカ割り)',
  sky: 'clear', mood: 'golden', dayLen: Infinity, phase: [.34, .62], autoNight: false,
  clock: [14 * 60 + 30, 19 * 60 + 30], clockNote: '🍉 suikawari at the sea',
  delegation: false, bounds: [-20, 20], chatter: [],
  helpers: [{ specName: 'precise' }, { specName: 'dreamy' }, { specName: 'eager' }],

  setup(root, game) {
    game_ = game;
    game.setScene({ balcony: false, backdrop: false, canopy: false });
    sky.lanternScale = 0;
    B.build(root);
    S = { tok: {}, round: -1, mode: 'intro', agent: null, msgs: 0, swings: SWINGS, results: [], events: [], hold: {}, cracks: 0, gullT: 4, shoutT: 5, shoutI: 0, waveT: 0, melonWob: 0, slices: [], spitT: 0 };
    crew.forEach(hook);
    ui.mount({ cmd, hold, answer });
    savedDelegate = term.onDelegate;
    term.onDelegate = (i, text) => S?.agent && S.agent === helpers[i] ? typed(text) : S?.mode === 'prompt' ? `${helpers[i]?.name || 'that helper'} isn't blindfolded. talk to ${S.agent.name}.` : typed(text);
    audio.setAmbience({ city: 0, cicada: .3, higurashi: .2, crickets: 0, wind: .5 });
    startSurf();
  },
  stations: () => ({}),
  introRun,
  start() { startSurf(); startRound(0); },
  update(dt) {
    if (!S) return;
    startSurf();
    B.update(dt, cam.pos.x);
    for (const [c, m] of M) stepCrab(c, m, dt);
    if (S.carry) { const m = M.get(S.carry); B.P.melon.position.set(m.x, 1.08, m.z); }
    if (G.mode === 'play') play(dt);
    if (S.spitT > 0 && G.mode === 'ending') {
      S.spitT -= dt;
      if (S.spitT <= 0) {
        S.spitT = rand(.5, 1.2);
        const c = pick(crew), m = M.get(c), far = c === helpers[2] ? 1.6 : 1;
        B.P.spit.emit(m.x, c.height * .7, m.z + .3, rand(-.4, .4), rand(1.6, 2.4), 2.2 * far, 1.4, .08, .06, .06);
        audio.sfx('sk-spit', { x: m.x });
      }
    }
  },
  key(e, ud) {
    if (!S || G.mode !== 'play') return false;
    const k = e.key.toLowerCase(), space = e.code === 'Space' || k === 'enter';
    const MOVE = { arrowup: 'fwd', w: 'fwd', arrowdown: 'back', s: 'back', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    if (S.mode === 'blind') {
      if (MOVE[k]) { hold(MOVE[k], ud === 'down'); e.preventDefault(); return true; }
      if (space) { if (ud === 'down' && !e.repeat) cmd('swing'); e.preventDefault(); return true; }
      return false;
    }
    if (S.mode !== 'prompt') return !!(MOVE[k] || space);
    if (ud !== 'down') return !!(MOVE[k] || space);
    if (e.repeat) return !!(MOVE[k] || space);
    if (S.asking) { if (k === '1') answer('see'); else if (k === '2') answer('face'); return true; }
    const P = { ...MOVE, q: 'around', escape: 'stop', x: 'stop' };
    if (P[k]) { if (e.shiftKey && P[k] !== 'stop' && P[k] !== 'around') { S.little = true; } cmd(P[k]); e.preventDefault(); return true; }
    if (space) { cmd('swing'); e.preventDefault(); return true; }
    return false;
  },
  ending,
  diary,
  stats,
  hint,
  todo() {
    if (!S) return [];
    return [0, 1, 2, 3].map(r => {
      const x = S.results[r], now = S.round === r && !x;
      const who = r < 3 ? `${helpers[r].name} ${helpers[r].icon} ${AG[r].tag}` : 'you, blindfolded';
      return { label: who, done: !!x, blocked: !x && !now, detail: x ? (x.hit ? `cracked ✦${r < 3 ? ' · ' + x.msgs + ' msg' : ''}` : `missed${r < 3 ? ' · ' + x.msgs + ' msg' : ''}`) : now ? (r < 3 ? `${S.msgs}/${MAX} msg` : 'listen…') : '' };
    });
  },
  teardown() {
    if (!S) return;
    stopSurf(S.surf);
    (S.slices || []).forEach(s => s.parent?.remove(s));
    crew.forEach(c => { unhook(c); c.workAnim = null; c.sitTarget = 0; c.sit = 0; });
    M.clear();
    ui.unmount();
    term.onDelegate = savedDelegate;
    audio.setAmbience({});
    B.teardown();
    S = null;
  },
  commands: Object.fromEntries(COMMAND_WORDS.map(w => [w, typedCmd])),
  ls: () => ['watermelon.fruit  stick.wood  tenugui.cloth  parasol/  cooler/{ramune,ramune}  sea/  (sand/ is mostly footprints)'],
  review: () => 'LGTM ✦ (nit: aim a little inland)',
  // for test bots: the evening's state and each crab's motion on the sand
  debug: () => ({ S, motion: c => M.get(c), geom, MAX }),
};

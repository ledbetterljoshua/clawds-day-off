// Hands-on minigame panels. Each opener returns a controller that becomes G.mini:
//   { kind, update(dt), act(), actUp(), close(cancelled) }
// act/actUp map to Space down/up (and taps); the game loop calls update(dt).
import { G } from './state.js';
import { $, clamp, rand, forTouch } from './util.js';
import { toScreen } from './gfx.js';
import { clawd } from './crab.js';
import { audio } from './audio.js';

const el = $('#mini');

function place() {
  if (innerWidth < 700) { el.style.left = '50%'; return; }
  const sx = toScreen(clawd.x, .6, clawd.z).x / innerWidth;
  el.style.left = (sx < .5 ? Math.max(sx + .22, .5) : Math.min(sx - .22, .5)) * 100 + '%';
}

function open(kind, html, ctl, onClose) {
  mini.close(true);
  el.innerHTML = forTouch(html);
  place();
  el.classList.remove('hidden');
  const c = { kind, update() {}, act() {}, actUp() {}, ...ctl };
  c.close = (cancelled = false) => {
    if (G.mini !== c) return;
    G.mini = null; el.classList.add('hidden');
    try { onClose && onClose(cancelled); } catch (e) { console.error(e); }
  };
  G.mini = c;
  return c;
}
el.addEventListener('pointerdown', e => e.stopPropagation());

export const mini = {
  get active() { return G.mini; },
  close(cancelled = true) { G.mini && G.mini.close(cancelled); },

  // drag in circles (or mash space). onTurn receives fractions of a full turn.
  dial({ title, hint = 'drag in circles · or mash space', progress = () => 0, onTurn, onClose, knobColor = '#d8343c', perPress = .045 }) {
    const c = open('dial', `<div class="mt">${title}</div><div class="dial" id="dial"><div class="hub"></div><div class="knob" id="knob" style="background:${knobColor}"></div></div><div class="ms">${hint}</div>`, {}, onClose);
    const dial = $('#dial', el), knob = $('#knob', el); let last = null; c.ang = 0;
    const angOf = e => { const r = dial.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
    dial.onpointerdown = e => { dial.setPointerCapture(e.pointerId); last = angOf(e); e.stopPropagation(); };
    dial.onpointermove = e => {
      if (last == null) return; const a = angOf(e); let d = a - last;
      if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2;
      last = a; c.ang += d; onTurn && onTurn(clamp(Math.abs(d), 0, .7) / (Math.PI * 2));
    };
    dial.onpointerup = dial.onpointercancel = () => last = null;
    c.act = () => { c.ang += .6; onTurn && onTurn(perPress); };
    c.update = () => { dial.style.setProperty('--p', clamp(progress(), 0, 1)); knob.style.transform = `rotate(${c.ang}rad) translate(0,-57px)`; };
    return c;
  },

  // a line sweeps back and forth; tap when it's inside the green zone
  timing({ title, hint = 'tap or space when the line is in the green', cuts = 3, zoneW = .18, speed = i => 2.6 + i * .5, onCut, onDone, onClose }) {
    const c = open('timing', `<div class="mt">${title}</div><div class="bar" id="sbar"><div class="zone" id="zone"></div><div class="cur" id="cur"></div></div><div class="ms">${hint} · <span id="cuts">0/${cuts}</span></div><div class="res" id="res"></div>`, {}, onClose);
    let t = 0, n = 0, zone = rand(.2, .8), pos = .5, busy = false;
    const z = $('#zone', el), cur = $('#cur', el), res = $('#res', el), cn = $('#cuts', el);
    const placeZone = () => { z.style.left = (zone - zoneW / 2) * 100 + '%'; z.style.width = zoneW * 100 + '%'; };
    placeZone();
    c.act = () => {
      if (busy) return;
      const hit = Math.abs(pos - zone) < zoneW / 2;
      n++; cn.textContent = `${n}/${cuts}`;
      res.textContent = hit ? 'clean ✦' : 'a little wonky'; res.style.color = hit ? 'var(--ok)' : 'var(--warn)';
      onCut && onCut(hit, n, cuts);
      zone = rand(.2, .8); placeZone();
      if (n >= cuts) { busy = true; setTimeout(() => { if (G.mini === c) { c.close(false); onDone && onDone(); } }, 260); }
    };
    $('#sbar', el).onpointerdown = e => { e.stopPropagation(); c.act(); };
    c.update = dt => { t += dt; pos = .5 + .5 * Math.sin(t * speed(n)); cur.style.left = pos * 100 + '%'; };
    return c;
  },

  // hold to pour, release inside the band
  pour({ title, color = '#e8384c', start = 0, band = [.66, .88], onFill, onRelease, onClose, hint = 'let go inside the band', label = 'hold<br>to pour' }) {
    const c = open('pour', `<div class="mt">${title}</div><div class="pourwrap"><div class="gauge"><div class="band" style="bottom:${band[0] * 100}%;height:${(band[1] - band[0]) * 100}%"></div><div class="fill" id="gf" style="background:${color}"></div></div><button class="hold" id="hold">${label}</button></div><div class="ms">${hint}</div><div class="res" id="res"></div>`, {}, onClose);
    let fill = start, v = 0, holding = false, done = false;
    const hold = $('#hold', el), gf = $('#gf', el), res = $('#res', el);
    const release = () => {
      if (!holding || done) return; holding = false; hold.classList.remove('on');
      onFill && onFill(fill, false);
      if (fill < .12) return;
      done = true;
      const q = fill >= band[0] && fill <= band[1] ? 1 : fill < band[0] ? .45 + fill * .6 : .5;
      res.textContent = q === 1 ? 'perfect pour ✦' : fill < band[0] ? 'a bit light' : 'drippy — still delicious';
      setTimeout(() => { if (G.mini === c) { c.close(false); onRelease && onRelease(fill, q); } }, 350);
    };
    hold.onpointerdown = e => { e.stopPropagation(); hold.setPointerCapture(e.pointerId); if (!done) { holding = true; hold.classList.add('on'); } };
    hold.onpointerup = hold.onpointercancel = release;
    c.act = () => { if (!done) { holding = true; hold.classList.add('on'); } };
    c.actUp = release;
    c.update = dt => {
      if (holding) { v = Math.min(v + dt * 1.1, .9); fill += v * dt; onFill && onFill(Math.min(fill, 1), true); if (fill >= 1.05) release(); }
      gf.style.height = clamp(fill, 0, 1) * 100 + '%';
    };
    c.isHolding = () => holding;
    return c;
  },

  // hold a button until the ring fills
  hold({ title, hint = 'hold', label = 'hold', dur = 1.1, color = '#58b85a', start = 0, onProgress, onDone, onClose }) {
    const c = open('hold', `<div class="mt">${title}</div><button class="hold" id="hold" style="background:conic-gradient(${color} calc(var(--p,0)*1turn),#2c2733 0)">${label}</button><div class="ms">${hint}</div>`, {}, onClose);
    let p = start, holding = false;
    const hold = $('#hold', el);
    hold.onpointerdown = e => { e.stopPropagation(); hold.setPointerCapture(e.pointerId); holding = true; };
    hold.onpointerup = hold.onpointercancel = () => holding = false;
    c.act = () => holding = true; c.actUp = () => holding = false;
    c.update = dt => {
      if (holding) { p += dt / dur; onProgress && onProgress(p, true); } else onProgress && onProgress(p, false);
      hold.style.setProperty('--p', clamp(p, 0, 1));
      if (p >= 1) { c.close(false); onDone && onDone(); }
    };
    c.isHolding = () => holding;
    return c;
  },

  // anything else: provide html and wire it up in setup(el, controller)
  custom({ kind = 'custom', html, setup, update, act, actUp, onClose }) {
    const c = open(kind, html, { update: update || (() => {}), act: act || (() => {}), actUp: actUp || (() => {}) }, onClose);
    setup && setup(el, c);
    return c;
  },
};

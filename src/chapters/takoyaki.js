// Day 2 — Takoyaki (たこ焼き). Sixteen balls on one hot pan: every cup cooks on its own clock,
// most of them come due at once, and a sudden evening shower (夕立) arrives mid-cook.
// Then sauce, a drawn mayo zigzag, aonori, dancing katsuobushi, and a basket to the neighbor on 3F.
import { THREE, V3, mesh, box, hitMat, toScreen } from '../core/gfx.js';
import { G } from '../core/state.js';
import { $, rand, clamp, lerp, ease, easeOut, smooth, pick } from '../core/util.js';
import { tween, sleep } from '../core/tween.js';
import { clawd, helpers, crew } from '../core/crab.js';
import { lock, unlock, credit, isSpec } from '../core/agents.js';
import { mini } from '../core/minigames.js';
import { audio } from '../core/audio.js';
import { term } from '../core/terminal.js';
import { cam } from '../core/camera.js';
import { hud } from '../core/hud.js';
import { sky } from '../core/sky.js';
import { Particles, sparkle } from '../core/fx.js';
import {
  PAN_X, PAN_Z, CUP_Y, R, CUP_OFF, BOAT_X, BOAT_Z, BASKET_X, BASKET_Z, BOAT_SLOTS,
  buildBalls, buildStove, buildPrep, drawBatter, buildBoats, mayoLine, defaultZigzag,
  buildUmbrella, buildBasket, drawNote, pickProp, leafHat, heldBall,
} from './takoyaki/props.js';

const COOK = 17;              // seconds for a face to go raw → golden at heat 1
const SPOT = { batter: -3.6, tako: -1.55, panL: -1.0, panL2: -1.45, pan: 2.45, parasol: 2.45, plate: 3.25, basket: 6.8 };
const DRESS = [
  { key: 'sauce', verb: 'brushing sauce', dur: 2.4, anim: 'stir', label: 'sauce' },
  { key: 'mayo', verb: 'drawing mayo', dur: 2.0, anim: 'write', label: 'mayo' },
  { key: 'aonori', verb: 'sprinkling aonori', dur: 1.3, anim: 'pick', label: 'aonori' },
  { key: 'katsuo', verb: 'adding katsuobushi', dur: 1.5, anim: 'pick', label: 'katsuobushi' },
];
const ROT_TURN = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), -Math.PI / 2);
const AX = [new V3(1, 0, 0), new V3(0, 1, 0), new V3(0, 0, 1)];

let S = null, P = null, CSS = null, back = null, GAME = null;
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _s = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new V3(), _w = new V3();
const WHO = c => c === clawd ? 3 : c.i;

// ───────────── state helpers ─────────────
function newBall(i) {
  const cx = PAN_X + CUP_OFF[i % 4], cz = PAN_Z + CUP_OFF[Math.floor(i / 4)];
  const dist = Math.hypot(CUP_OFF[i % 4], CUP_OFF[Math.floor(i / 4)]);
  return {
    i, cx, cz, heat: 1.25 - dist * .5 + rand(-.04, .04), batter: false, tako: false, takoFly: null, turns: 0,
    P: [0, 0, 0], N: [0, 0, 0], fin: 0, done: false, plated: false, gone: false, slot: null, fly: null,
    claim: null, claimTurns: 0, claimTako: null, claimPlate: null,
    q: new THREE.Quaternion(), qFrom: new THREE.Quaternion(), qTo: new THREE.Quaternion(), animT: 1, hop: 0, noTako: false, eaten: false,
  };
}
// browning of the face that's currently down
function downFace(b) {
  _v.set(0, -1, 0).applyQuaternion(_q.copy(b.qTo).invert());
  let best = 0, bv = -1, sign = 1;
  for (let a = 0; a < 3; a++) { const c = _v.getComponent(a); if (Math.abs(c) > bv) { bv = Math.abs(c); best = a; sign = Math.sign(c); } }
  return { a: best, sign };
}
const faceVal = (b, f) => f.sign > 0 ? b.P[f.a] : b.N[f.a];
const downB = b => faceVal(b, downFace(b));
const maxB = b => Math.max(...b.P, ...b.N);
const cookingCount = () => S.balls.filter(b => b.batter && !b.plated).length;
const roundCount = () => S.balls.filter(b => b.turns >= 2).length;
const takoCount = () => S.balls.filter(b => b.tako).length;
const takoOpen = () => S.balls.filter(b => b.batter && !b.tako && b.turns === 0);
const takoDone = () => S.poured && takoOpen().length === 0 && S.toppings >= 1;
const allRound = () => S.poured && S.balls.every(b => b.turns >= 2);
const ready = () => S && S.plated >= 16 && S.dressStep >= 4 && S.basket === 'returned';
const atPan = () => Math.abs(clawd.x - SPOT.pan) < .2 && !clawd.pending;

// ───────────── props ─────────────
function build(root) {
  P = { root };
  Object.assign(P, buildStove(root));
  P.prep = buildPrep(root);
  P.balls = buildBalls(root);
  P.boats = buildBoats(root);
  P.umb = buildUmbrella(root);
  P.basket = buildBasket(root);
  P.basketHit = mesh(box(.9, .9, .8), hitMat, 0, .25, 0, P.basket.g, false);
  P.steam = new Particles({ max: 260, size: .42, gravity: .22, drag: 1.6, opacity: .16, parent: root });
  P.spit = new Particles({ max: 120, size: .05, gravity: -6, parent: root });
  P.breath = new Particles({ max: 160, size: .16, gravity: .3, drag: 1.2, opacity: .3, parent: root });
  P.picks = crew.map(c => { const p = pickProp(); p.visible = false; c.hand.add(p); return p; });
  P.leaves = crew.map(c => { const l = leafHat(); l.visible = false; c.headSlot.add(l); return l; });
  P.held = crew.map(c => { const b = heldBall(); b.visible = false; c.hand.add(b); return b; });
  drawBatter(P.prep.batterTex, 0);
}

function setPour(pp) {
  S.pourProg = Math.max(S.pourProg, clamp(pp, 0, 1));
  // the pitcher snakes row by row; cups fill as it passes
  S.balls.forEach(b => {
    const row = Math.floor(b.i / 4), col = row % 2 ? 3 - (b.i % 4) : b.i % 4, k = row * 4 + col;
    if (!b.batter && S.pourProg >= (k + 1) / 16 * .96) { b.batter = true; audio.sfx('pour', { gap: .06 }); }
  });
}
function finishPour(who, q = .8) {
  if (S.poured) return;
  setPour(1); S.poured = true; S.pouringNow = false; S.pourQ = q;
  P.prep.jugFill.visible = false;
  term.log(`${who.name} ▸ poured the batter — 16 cups sizzling`, '#f2c14e');
  audio.sfx('chime'); credit(who);
  if (who === clawd) clawd.say(takoOpen().length ? 'quick — octopus in every cup!' : 'sizzle ✦');
}
function mixedDone(who) {
  if (S.mixed) return;
  S.mixed = true; S.mix = 1; drawBatter(P.prep.batterTex, 1);
  P.prep.jugFill.visible = true;
  term.log(`${who.name} ▸ whisked the batter smooth`, '#9fd3ff');
  audio.sfx('chime'); credit(who);
}
function dropTako(b, who) {
  if (b.tako || b.turns > 0) return;
  b.tako = true;
  b.takoFly = { t: 0, from: new V3(who.x, .5 + who.height * .4, who.z) };
  S.cnt.tako[WHO(who)]++;
  audio.sfx('pop', { gap: .04 }); credit(who);
  P.prep.takoPile[S.cnt.tako.reduce((a, c) => a + c, 0) % P.prep.takoPile.length].visible = takoCount() < 14;
}
function toppingsDone(who) {
  if (S.toppings >= 1 && S.toppingsBy) return;
  S.toppings = 1; S.toppingsBy = who;
  term.log(`${who.name} ▸ tenkasu, beni-shōga, green onion`, '#f2c14e');
  audio.sfx('sprinkle'); credit(who);
}
function turnBall(b, who, quiet = false) {
  if (b.turns >= 2 || b.plated) return null;
  const bv = downB(b);
  const q = bv < .65 ? .55 : bv <= 1.1 ? 1 : bv <= 1.5 ? .6 : .35;
  if (b.turns === 0 && !b.tako) { b.noTako = true; S.noTako++; }
  b.turns++;
  b.qFrom.copy(b.q); b.qTo.premultiply(ROT_TURN); b.animT = 0; b.hop = 1;
  const w = WHO(who);
  S.cnt.turn[w]++; if (q === 1) S.cnt.perfect[w]++;
  if (q === 1) S.perfect++; if (q <= .35) S.crispy++; if (q === .55) S.early++;
  if (who === clawd) { G.stats.quality.push(q); if (q === 1) sparkle(b.cx, CUP_Y + .25, b.cz, 6); }
  audio.sfx('scrape', { gap: .03 });
  for (let k = 0; k < 3; k++) P.steam.emit(b.cx + rand(-.08, .08), CUP_Y + .12, b.cz, rand(-.1, .1), rand(.4, .8), rand(-.1, .1), rand(.6, 1.1));
  credit(who);
  if (!quiet && q <= .35 && Math.random() < .5) who.say('crispy!', 1.2);
  return q;
}
function plateBall(b, who) {
  if (b.plated || !b.done) return;
  const k = S.plated++, boat = Math.floor(k / 8), j = k % 8;
  b.plated = true; b.slot = { boat, j };
  b.fly = { t: 0, from: ballPos(b, new V3()) };
  S.cnt.plate[WHO(who)]++;
  audio.sfx('pop', { gap: .05 }); credit(who);
  if (S.plated === 16) { term.log('✓ all sixteen on the plates', '#7bd88f'); audio.sfx('done'); }
}
function dressDone(key, who, pts) {
  const st = DRESS[S.dressStep]; if (!st || st.key !== key) return;
  S.dressStep++; S.cnt.dress[WHO(who)]++; S.dressBy[key] = who;
  if (key === 'sauce') S.sauceAmt = 1;
  if (key === 'mayo') { S.mayoPts = pts || defaultZigzag(); P.boats.forEach(bt => mayoLine(bt, S.mayoPts)); audio.sfx('squeeze'); }
  if (key === 'aonori') S.aonoriAmt = 1;
  if (key === 'katsuo') {
    S.katsuoAmt = 1; S.danceT = 0;
    tween(.4, () => {}, () => { clawd.say('look — the katsuobushi is dancing ✦', 2.6); helpers.forEach((h, i) => tween(.3 + i * .25, () => {}, () => h.mood('wow', 1.4))); });
  }
  term.log(`${who.name} ▸ ${st.label}`, key === 'mayo' ? '#fffbe6' : key === 'aonori' ? '#7bd88f' : '#f2c14e');
  audio.sfx(key === 'sauce' ? 'pour' : key === 'katsuo' ? 'flake' : 'sprinkle'); credit(who);
  if (S.dressStep >= 4) { term.log('✓ sauce · mayo · aonori · katsuobushi', '#7bd88f'); audio.sfx('done'); }
}
function openUmbrella(who) {
  if (S.umbrella === 'open') return;
  S.umbrella = 'open'; S.umbrellaBy = who; S.umbrellaProg = 1;
  P.umb.closed.visible = false; P.umb.open.visible = true;
  term.log(`${who.name} ▸ opened the umbrella over the pan`, '#ff8a9a');
  audio.sfx('whoosh'); credit(who);
  if (S.flameOut) relight(who);
}
function flameOut() {
  S.flameOut = true; S.flameOuts++;
  audio.sfx('steam'); audio.sfx('splash');
  for (let k = 0; k < 14; k++) P.steam.emit(PAN_X + rand(-.7, .7), CUP_Y + .1, PAN_Z + rand(-.7, .7), rand(-.2, .2), rand(.5, 1.1), rand(-.2, .2), rand(.8, 1.4));
  clawd.say('the rain put the flame out!', 2.6); clawd.mood('wow', 1.5);
  term.log('⚠ rain on the pan — the flame went out', '#f7d488');
  hud.toast('🌧 the rain put the flame out — open the umbrella over the pan');
}
function relight(who = clawd) {
  if (!S.flameOut) return;
  S.flameOut = false; S.knobT = 1;
  audio.sfx('clunk'); tween(.18, () => {}, () => audio.sfx('clunk'));
  term.log(`${who.name} ▸ relit the stove (kachi-kachi)`, '#9fd3ff');
}
function sendBasket(who) {
  if (S.basket !== 'waiting' || S.dressStep < 4) return;
  S.basket = 'loading'; S.basketBy = who; credit(who);
  const boat = P.boats[0];
  const from = boat.g.position.clone(), to = new V3(BASKET_X, .07, BASKET_Z);
  audio.sfx('whoosh');
  tween(.9, e => { const k = ease(e); boat.g.position.lerpVectors(from, to, k); boat.g.position.y += Math.sin(e * Math.PI) * 1.1; boat.g.scale.setScalar(lerp(1, .7, k)); },
    () => {
      S.basket = 'rising'; audio.loop('creak', 1); audio.sfx('creak');
      term.log(`${who.name} ▸ sent eight up to 3F`, '#d97757');
      const g = P.basket.g, y0 = g.position.y;
      tween(3.2, e => { g.position.y = lerp(y0, 12, ease(e)); boat.g.position.y = g.position.y + .07; }, () => {
        audio.loop('creak', 0);
        S.basket = 'up'; boat.g.visible = false;
        S.balls.forEach(b => { if (b.slot?.boat === 0) b.gone = true; });
        tween(2.4, () => {}, () => {
          S.basket = 'returning'; P.basket.ramune.visible = true; drawNote(P.basket.noteTex, 'ありがとう!', '— 3F');
          audio.loop('creak', 1);
          tween(3.2, e => { g.position.y = lerp(12, .12, ease(e)); }, () => {
            audio.loop('creak', 0); audio.sfx('clunk');
            S.basket = 'returned';
            hud.toast('<b>📝 from 3F</b> 「ありがとう!」 <span style="color:var(--dim)">and a cold ramune</span>');
            term.log('✓ the basket came back with a ramune', '#7bd88f');
            clawd.say('a ramune came back down ✦', 2.6); clawd.hop(.5);
          });
        });
      });
    });
}

// ───────────── pan view (a close look at the pan while working it) ─────────────
// high and to the left of the pan (so Clawd, standing on its right, never blocks a cup), with the
// pan sitting in the upper half of the frame, clear of the minigame panel
function panShot() {
  const asp = innerWidth / innerHeight, fill = asp > 1 ? .46 : .8;
  const L = 1.75 / (fill * 2 * Math.tan(THREE.MathUtils.degToRad(21)) * asp), d = clamp(L / 1.11, 2.3, 7);
  // phones put the minigame panel at the top, so there the pan sits low in the frame instead
  if (asp < 1) return [new V3(PAN_X - .1, .4 + d * .95, PAN_Z + d * .55), new V3(PAN_X - .05, .3, PAN_Z - .52)];
  return [new V3(PAN_X - .25, .4 + d * .92, PAN_Z + d * .62), new V3(PAN_X - .12, .3, PAN_Z + .32)];
}
function enterPanView() {
  if (G.mode !== 'play') return;
  S.panView = true;
  const [p, l] = panShot();
  cam.shot(p, l, { fov: 42, k: 2.6 });
  back.classList.remove('hidden');
}
function exitPanView() {
  if (!S || !S.panView) return;
  S.panView = false;
  if (G.mode === 'play') cam.play();
  back.classList.add('hidden');
}

// ───────────── the player at the pan ─────────────
function cupAt(e) {
  let best = -1, bd = Infinity;
  const pts = S.balls.map(b => { const p = ballPos(b, _w); return toScreen(p.x, p.y, p.z); });
  const sp = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  const thr = Math.max(26, sp * .62);
  pts.forEach((p, i) => { if (S.balls[i].plated) return; const d = Math.hypot(p.x - e.clientX, p.y - e.clientY); if (d < bd) { bd = d; best = i; } });
  return bd < thr ? best : -1;
}
function clickBall(i, game) {
  const b = S.balls[i];
  if (G.selected) { const h = G.selected; game.assign(h, b.batter && !b.tako && b.turns === 0 ? 'tako' : 'pan'); game.select(null); return; }
  if (!atPan()) { S.queue = [i]; game.playerGo('pan'); enterPanView(); return; }
  playerActOnBall(b, game);
}
function playerActOnBall(b, game) {
  if (!S.mixed && !S.poured) { clawd.say('mix the batter first ←'); return; }
  if (!S.poured && !b.batter) { interact('pan', game); return; }
  if (b.plated) return;
  if (S.cd > 0) return;
  S.cd = .1;
  clawd.workAnim = 'chop'; S.clawdAnimT = .2;
  if (b.turns === 0 && !b.tako) { if (b.batter) dropTako(b, clawd); return; }
  if (b.turns < 2) {
    if (downB(b) < .4) { b.hop = .5; clawd.say('not set yet…', 1); audio.sfx('deny'); return; }
    if (b.claim) b.claim = null;
    turnBall(b, clawd);
    return;
  }
  b.hop = .6; audio.sfx('scrape', { gap: .05 });
  if (b.done && !b.plated) clawd.say('done ✓ — plate them →', 1.4);
}

// ───────────── helper jobs ─────────────
const jobs = {
  batter: {
    label: 'mix & pour the batter',
    done: () => S.poured,
    plan(h, sp) {
      if (!S.mixed) {
        if (G.locks.batter && G.locks.batter !== h) return { x: SPOT.batter + .6, wait: '⋯' };
        return { x: SPOT.batter, start: () => {
          if (!lock('batter', h)) return null;
          return { kind: 'whisk', lock: 'batter', anim: 'stir', face: -.7, verb: 'whisking batter', step(dt) {
            S.mix = Math.min(1, S.mix + dt / (4.4 / sp)); S.whisking = .2; S.whiskA += dt * 9 * sp;
            if (Math.random() < dt * 5) audio.sfx('pour', { gap: .2 });
            if (S.mix >= 1) { mixedDone(h); return true; }
          } };
        } };
      }
      if (G.locks.pour && G.locks.pour !== h) return { x: SPOT.panL2, wait: '⋯' };
      return { x: SPOT.panL, start: () => {
        if (!lock('pour', h)) return null;
        return { kind: 'pour', lock: 'pour', anim: 'pour', face: .9, verb: 'pouring batter',
          cancel() { S.pouringNow = false; },
          step(dt) {
            S.pouringNow = true; setPour(S.pourProg + dt / (2.6 / sp));
            if (S.pourProg >= 1) { finishPour(h, .8); return true; }
          } };
      } };
    },
  },
  tako: {
    label: 'octopus & toppings',
    done: takoDone,
    plan(h, sp) {
      if (!S.poured && S.pourProg <= 0) return { x: SPOT.tako, wait: '⋯ waiting for batter' };
      const b = takoOpen().filter(b => !b.claimTako).sort((a, c) => a.cx - c.cx)[0];
      if (b) return { x: SPOT.tako, start: () => {
        if (b.tako || b.claimTako || b.turns) return null;
        b.claimTako = h; let t = 0;
        return { kind: 'tako', anim: 'pick', face: .9, verb: 'adding octopus', cancel() { b.claimTako = null; },
          step(dt) { t += dt; if (t > .5 / sp) { dropTako(b, h); b.claimTako = null; return true; } } };
      } };
      if (S.poured && S.toppings < 1) {
        if (G.locks.toppings && G.locks.toppings !== h) return { x: SPOT.tako, wait: '⋯' };
        return { x: SPOT.tako, start: () => {
          if (!lock('toppings', h)) return null;
          return { kind: 'sprinkle', lock: 'toppings', anim: 'pick', face: .9, verb: 'sprinkling toppings', step(dt) {
            S.toppings = Math.min(1, S.toppings + dt / (1.8 / sp));
            if (Math.random() < dt * 4) audio.sfx('sprinkle', { gap: .2 });
            if (S.toppings >= 1) { toppingsDone(h); return true; }
          } };
        } };
      }
      return { x: h.x, wait: '⋯' };
    },
  },
  pan: {
    label: 'turn the balls',
    done: allRound,
    plan(h, sp) {
      const x = isSpec(h, 'pan') ? SPOT.panL : SPOT.panL2;
      if (!S.poured && S.pourProg <= 0) return { x, wait: '⋯ waiting for batter' };
      if (S.flameOut) return { x, wait: '⋯ the flame is out' };
      // the most urgent ball that's ready, unless someone already has it
      let best = null, bv = 0;
      for (const b of S.balls) {
        if (!b.batter || b.turns >= 2 || b.claim || b.animT < 1 || b.plated) continue;
        const v = downB(b);
        const react = sp >= 2 ? .72 : .8 + ((b.i * 7 + h.i * 3) % 5) / 18;
        if (v >= react && v > bv) { bv = v; best = b; }
      }
      if (!best) return { x, wait: '⋯ watching the pan' };
      return { x, start: () => {
        if (best.claim || best.turns >= 2) return null;
        best.claim = h; best.claimTurns = best.turns; let t = 0;
        return { kind: 'turn', anim: 'chop', face: .9, verb: 'turning', cancel() { best.claim = null; },
          step(dt) { t += dt; if (t > .7 / sp) { if (best.turns === best.claimTurns) turnBall(best, h); best.claim = null; return true; } } };
      } };
    },
  },
  parasol: {
    label: 'cover the pan',
    done: () => S.umbrella === 'open',
    plan(h, sp) {
      if (G.locks.parasol && G.locks.parasol !== h) return { x: SPOT.parasol + .5, wait: '⋯' };
      return { x: SPOT.parasol, start: () => {
        if (!lock('parasol', h)) return null;
        return { kind: 'umbrella', lock: 'parasol', anim: 'hold', face: -.4, verb: 'opening the umbrella', step(dt) {
          S.umbrellaProg = Math.min(1, S.umbrellaProg + dt / (1.6 / sp));
          if (S.umbrellaProg >= 1) { openUmbrella(h); return true; }
        } };
      } };
    },
  },
  plate: {
    label: 'plate & dress',
    done: () => S.plated >= 16 && S.dressStep >= 4,
    plan(h, sp) {
      const b = S.balls.find(b => b.done && !b.plated && !b.claimPlate);
      if (b) return { x: SPOT.plate, start: () => {
        if (b.plated || b.claimPlate) return null;
        b.claimPlate = h; let t = 0;
        return { kind: 'plate', anim: 'pick', face: -1, verb: 'plating', cancel() { b.claimPlate = null; },
          step(dt) { t += dt; if (t > .4 / sp) { plateBall(b, h); b.claimPlate = null; return true; } } };
      } };
      if (S.plated < 16) return { x: SPOT.plate, wait: S.poured ? '⋯ waiting for round ones' : '⋯' };
      const st = DRESS[S.dressStep]; if (!st) return null;
      if (G.locks.dress && G.locks.dress !== h) return { x: SPOT.plate + .45, wait: '⋯' };
      const spx = st.key === 'sauce' && isSpec(h, 'sauce') ? 2 : sp;
      return { x: SPOT.plate, start: () => {
        if (!lock('dress', h)) return null;
        let t = 0;
        return { kind: 'dress', lock: 'dress', anim: st.anim, face: -1, verb: st.verb, step(dt) {
          t += dt; const p = Math.min(1, t / (st.dur / spx));
          if (st.key === 'sauce') S.sauceAmt = p; if (st.key === 'aonori') S.aonoriAmt = p; if (st.key === 'katsuo') S.katsuoAmt = p;
          if (Math.random() < dt * 3) audio.sfx(st.key === 'mayo' ? 'squeeze' : 'sprinkle', { gap: .25 });
          if (p >= 1) { dressDone(st.key, h); return true; }
        } };
      } };
    },
  },
  basket: {
    label: 'send some to 3F',
    done: () => S.basket !== 'hidden' && S.basket !== 'descending' && S.basket !== 'waiting',
    canAssign: () => S.basket === 'waiting',
    refuse: 'the basket isn\'t here yet',
    plan(h, sp) {
      if (S.dressStep < 4) return { x: SPOT.basket, wait: '⋯ waiting for dressed takoyaki' };
      return { x: SPOT.basket, start: () => {
        if (!lock('basket', h)) return null;
        let t = 0;
        return { kind: 'basket', lock: 'basket', anim: 'hold', face: .7, verb: 'loading the basket', step(dt) {
          t += dt; if (t > 1.2 / sp) { sendBasket(h); return true; }
        } };
      } };
    },
  },
};

// ───────────── the player at a station ─────────────
function interact(k, game) {
  switch (k) {
    case 'batter':
      if (S.mixed) return clawd.say(S.poured ? 'the batter\'s in the pan ✓' : 'mixed ✓ — now pour it over the pan →');
      return game.work('batter', () => mini.dial({
        title: 'whisk the batter', hint: 'drag in circles · or mash space', knobColor: '#c9ccd2', progress: () => S.mix,
        onTurn(f) {
          if (S.mixed) return;
          S.mix = Math.min(1, S.mix + f / 2.2); S.whiskA += f * Math.PI * 2; S.whisking = .25; clawd.workAnim = 'stir';
          audio.sfx('pour', { gap: .18 });
          if (S.mix >= 1) { mixedDone(clawd); mini.close(false); clawd.say('smooth ✦ — now the pan →'); }
        },
      }));
    case 'pan': {
      if (!S.mixed && !S.poured) return clawd.say('mix the batter first ←');
      if (!S.poured) {
        if (G.locks.pour && G.locks.pour !== clawd) return clawd.say(`${G.locks.pour.name} is pouring`);
        enterPanView();
        return game.work('pour', () => mini.pour({
          title: 'pour the batter', color: '#f1dca2', band: [.66, .92], label: 'hold<br>to pour', hint: 'flood the whole pan · let go in the band',
          onFill(f, holding) { setPour(f / .66); S.pouringNow = holding; clawd.workAnim = holding ? 'pour' : null; },
          onRelease(f, q) { G.stats.quality.push(q); S.overflow = f > .92; finishPour(clawd, q); },
          onClose(cancelled) { S.pouringNow = false; if (cancelled && S.pourProg > 0 && !S.poured) finishPour(clawd, .5); },
        }));
      }
      enterPanView();
      if (S.queue.length) { const i = S.queue.shift(); playerActOnBall(S.balls[i], game); return; }
      if (allRound()) return clawd.say(S.plated < 16 ? 'all round ✓ — plate them →' : 'the pan is done ✓');
      if (takoOpen().length) return clawd.say('click the cups to drop octopus in', 2);
      return clawd.say('click a ball when its ring glows gold', 2);
    }
    case 'tako':
      if (!S.poured) return clawd.say(S.mixed ? 'pour the batter first →' : 'batter first ←');
      if (takoOpen().length) { S.queue = []; game.playerGo('pan'); enterPanView(); return clawd.say('click each cup to drop octopus in', 2); }
      if (S.toppings < 1) return game.work('toppings', () => mini.hold({
        title: 'sprinkle the toppings', hint: 'tenkasu · beni-shōga · green onion', label: 'hold<br>to sprinkle', dur: 1.4, color: '#f2c14e', start: S.toppings,
        onProgress(p, holding) { S.toppings = Math.min(1, p); clawd.workAnim = holding ? 'pick' : null; if (holding) audio.sfx('sprinkle', { gap: .15 }); },
        onDone() { toppingsDone(clawd); },
      }));
      return clawd.say('octopus and toppings are in ✓');
    case 'parasol':
      if (S.umbrella === 'open') return clawd.say('the pan is covered ✓');
      return game.work('parasol', () => mini.hold({
        title: 'open the umbrella', hint: 'hold to open the 蛇の目傘 over the pan', label: 'hold', dur: 1.2, color: '#c8323a', start: S.umbrellaProg,
        onProgress(p, holding) { S.umbrellaProg = Math.min(1, p); clawd.workAnim = holding ? 'hold' : null; },
        onDone() { openUmbrella(clawd); },
      }));
    case 'plate': {
      if (ready()) return game.finish({ complete: true, perfect: S.perfect >= 24 && S.crispy === 0 });
      if (S.plated < 16) {
        const todo = S.balls.filter(b => b.done && !b.plated && !b.claimPlate);
        if (!todo.length) return clawd.say(S.poured ? 'nothing\'s round enough to plate yet' : 'no takoyaki yet');
        todo.forEach((b, k) => { b.claimPlate = clawd; tween(k * .12, () => {}, () => { b.claimPlate = null; plateBall(b, clawd); }); });
        clawd.workAnim = 'pick'; tween(todo.length * .12 + .2, () => {}, () => { if (clawd.workAnim === 'pick') clawd.workAnim = null; });
        return;
      }
      if (S.dressStep < 4) return startDress(game);
      if (S.basket === 'waiting') return clawd.say('send eight up to 3F first →');
      return clawd.say('waiting on the basket…');
    }
    case 'basket':
      if (S.basket === 'hidden' || S.basket === 'descending') return clawd.say('nothing here yet');
      if (S.basket !== 'waiting') return clawd.say(S.basket === 'returned' ? 'the ramune is ours ✦' : 'the basket\'s on its way');
      if (S.dressStep < 4) return clawd.say('they deserve the dressed ones — finish the plates first');
      clawd.workAnim = 'hold'; tween(.6, () => {}, () => { clawd.workAnim = null; sendBasket(clawd); });
      return;
  }
}
function startDress(game) {
  const st = DRESS[S.dressStep];
  if (G.locks.dress && G.locks.dress !== clawd) return clawd.say(`${G.locks.dress.name} is on it`);
  if (st.key === 'sauce') return game.work('dress', () => mini.pour({
    title: 'brush on the sauce', color: '#6b3317', band: [.6, .9], label: 'hold<br>to brush', hint: 'glossy, not drowning',
    onFill(f, holding) { S.sauceAmt = Math.min(1, f / .75); clawd.workAnim = holding ? 'stir' : null; if (holding) audio.sfx('pour', { gap: .2 }); },
    onRelease(f, q) { G.stats.quality.push(q); dressDone('sauce', clawd); },
    onClose(cancelled) { if (cancelled && S.dressStep === 0) S.sauceAmt = 0; },
  }));
  if (st.key === 'mayo') return game.work('dress', () => mayoMini());
  if (st.key === 'aonori') return game.work('dress', () => mini.hold({
    title: 'sprinkle aonori', hint: 'hold to shake the seaweed flakes', label: 'hold<br>to shake', dur: 1.1, color: '#3d8a2a',
    onProgress(p, holding) { S.aonoriAmt = Math.min(1, p); clawd.workAnim = holding ? 'pick' : null; if (holding) audio.sfx('sprinkle', { gap: .15 }); },
    onDone() { G.stats.quality.push(1); dressDone('aonori', clawd); },
  }));
  return game.work('dress', () => mini.hold({
    title: 'add katsuobushi', hint: 'hold to drop the bonito flakes — watch them dance', label: 'hold', dur: 1.2, color: '#e0a983',
    onProgress(p, holding) { S.katsuoAmt = Math.min(1, p); clawd.workAnim = holding ? 'pick' : null; if (holding) audio.sfx('flake', { gap: .2 }); },
    onDone() { G.stats.quality.push(1); dressDone('katsuo', clawd); },
  }));
}
// draw a zigzag of mayo across a boat; the line you draw is the line that lands
function mayoMini() {
  const W = 300, H = 130;
  return mini.custom({
    kind: 'mayo',
    html: `<div class="mt">draw the mayo</div><canvas id="tk-mayo" width="${W * 2}" height="${H * 2}" style="width:${W}px;height:${H}px"></canvas><div class="ms">zigzag across all eight · <span id="tk-mz">space draws one for you</span></div>`,
    setup(el, c) {
      const cv = $('#tk-mayo', el), x = cv.getContext('2d'), note = $('#tk-mz', el);
      let pts = [], drawing = false, done = false;
      const paint = () => {
        x.setTransform(2, 0, 0, 2, 0, 0);
        x.fillStyle = '#3a2a20'; x.fillRect(0, 0, W, H);
        x.fillStyle = '#e7cc98'; x.beginPath(); x.roundRect(14, 20, W - 28, H - 40, 18); x.fill();
        for (let j = 0; j < 8; j++) { const u = .09 + (j % 4) * .274, v = j < 4 ? .3 : .7; x.fillStyle = '#5b2a12'; x.beginPath(); x.arc(14 + u * (W - 28), 20 + v * (H - 40), 17, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.arc(14 + u * (W - 28) - 5, 20 + v * (H - 40) - 6, 5, 0, 7); x.fill(); }
        if (pts.length > 1) { x.strokeStyle = '#fffbe6'; x.lineWidth = 5; x.lineCap = x.lineJoin = 'round'; x.beginPath(); pts.forEach(([u, v], i) => { const px = 14 + u * (W - 28), py = 20 + v * (H - 40); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); }
      };
      const at = e => { const r = cv.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width * W - 14, 0, W - 28) / (W - 28), clamp((e.clientY - r.top) / r.height * H - 20, 0, H - 40) / (H - 40)]; };
      const finish = (p, q) => { if (done) return; done = true; G.stats.quality.push(q); note.textContent = q === 1 ? 'beautiful zigzag ✦' : 'good enough!'; setTimeout(() => { if (G.mini === c) { c.close(false); dressDone('mayo', clawd, p); } }, 300); };
      const judge = () => {
        if (pts.length < 6) { pts = []; paint(); return; }
        const us = pts.map(p => p[0]), cover = Math.max(...us) - Math.min(...us);
        let zigs = 0, dir = 0, lastV = pts[0][1];
        for (const [, v] of pts) { const d = v - lastV; if (Math.abs(d) > .18) { const s = Math.sign(d); if (s !== dir) { zigs++; dir = s; } lastV = v; } }
        if (cover < .55) { note.textContent = 'all the way across ↔'; pts = []; paint(); return; }
        finish(pts.filter((_, i) => i % 2 === 0), zigs >= 6 ? 1 : zigs >= 3 ? .8 : .55);
      };
      cv.onpointerdown = e => { e.stopPropagation(); if (done) return; cv.setPointerCapture(e.pointerId); drawing = true; pts = [at(e)]; clawd.workAnim = 'write'; paint(); };
      cv.onpointermove = e => { if (!drawing) return; const p = at(e), l = pts[pts.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > .015) { pts.push(p); audio.sfx('squeeze', { gap: .12 }); paint(); } };
      cv.onpointerup = cv.onpointercancel = () => { if (!drawing) return; drawing = false; clawd.workAnim = null; judge(); };
      c.act = () => { if (done) return; pts = defaultZigzag(); paint(); finish(pts, .8); };
      paint();
    },
  });
}

// ───────────── per-frame ─────────────
function ballPos(b, out) {
  if (b.plated && b.slot) {
    const boat = P.boats[b.slot.boat];
    out.copy(BOAT_SLOTS[b.slot.j]); boat.g.localToWorld(out);
    if (b.fly) {
      const e = Math.min(1, b.fly.t / .45);
      _v.copy(out); out.lerpVectors(b.fly.from, _v, easeOut(e)); out.y += Math.sin(e * Math.PI) * .7;
    }
    return out;
  }
  const st = b.turns, k = b.animT < 1 ? ease(b.animT) : 1;
  const yA = [CUP_Y - .03, CUP_Y, CUP_Y + .03][Math.max(0, st - (b.animT < 1 ? 1 : 0))] ?? CUP_Y + .03;
  const yB = [CUP_Y - .03, CUP_Y, CUP_Y + .03][Math.min(2, st)];
  return out.set(b.cx, lerp(yA, yB, k) + Math.sin(Math.min(1, b.hop) * Math.PI) * .07, b.cz);
}
function updateBalls(dt) {
  const { im, cookP, cookN, sauce } = P.balls;
  for (const b of S.balls) {
    // cook: whichever face points down browns; after two turns the cook keeps it rolling
    if (b.batter && !b.plated && !S.flameOut) {
      const rate = b.heat * dt / COOK * (S.wet ? .35 : 1);
      if (b.turns < 2) {
        _v.set(0, -1, 0).applyQuaternion(_q.copy(b.qTo).invert());
        for (let a = 0; a < 3; a++) { const c = _v.getComponent(a); if (c > 0) b.P[a] += rate * c * c; else b.N[a] += rate * c * c; }
      } else {
        // rolling evens it out; a finished ball sits at the cool edge and barely darkens
        const k = b.done ? .05 : .3;
        for (let a = 0; a < 3; a++) { b.P[a] += rate * k; b.N[a] += rate * k; }
        b.fin += b.heat * dt / 9;
        if (!b.done && b.fin >= 1) { b.done = true; audio.sfx('select', { gap: .1 }); }
      }
    }
    if (b.animT < 1) { b.animT = Math.min(1, b.animT + dt / .22); b.q.slerpQuaternions(b.qFrom, b.qTo, ease(b.animT)); }
    if (b.hop > 0) b.hop = Math.max(0, b.hop - dt * 4);
    if (b.fly) { b.fly.t += dt; if (b.fly.t >= .45) b.fly = null; }
    if (b.takoFly) { b.takoFly.t += dt; if (b.takoFly.t > .28) b.takoFly = null; }
    const i = b.i;
    cookP.setXYZ(i, b.P[0], b.P[1], b.P[2]); cookN.setXYZ(i, b.N[0], b.N[1], b.N[2]);
    sauce.setX(i, b.plated ? Math.min(1, S.sauceAmt * 1.1) : 0);
    // matrix: flatten in world space so stage-0 batter sits low in the cup
    if (!b.batter || b.gone || b.eaten) { _m.makeScale(0, 0, 0); im.setMatrixAt(i, _m); continue; }
    const p = ballPos(b, _w);
    const st = b.turns, k = b.animT < 1 ? ease(b.animT) : 1;
    const syA = [.42, .8, 1][Math.max(0, st - (b.animT < 1 ? 1 : 0))], syB = [.42, .8, 1][Math.min(2, st)];
    const sy = b.plated ? 1 : lerp(syA, syB, k), sx = b.plated ? 1 : st === 0 ? 1.06 : 1;
    _r.makeRotationFromQuaternion(b.q); _s.makeScale(sx, sy, sx);
    _m.makeTranslation(p.x, p.y, p.z).multiply(_s).multiply(_r);
    im.setMatrixAt(i, _m);
  }
  im.instanceMatrix.needsUpdate = true; cookP.needsUpdate = true; cookN.needsUpdate = true; sauce.needsUpdate = true;

  // octopus pieces (flying in, then sticking out of the batter until the first turn)
  for (const b of S.balls) {
    if (!b.tako || b.turns > 0 || b.plated) { _m.makeScale(0, 0, 0); P.tako.setMatrixAt(b.i, _m); continue; }
    const end = _w.set(b.cx + .03, CUP_Y + .03, b.cz - .02);
    if (b.takoFly) { const e = Math.min(1, b.takoFly.t / .28); _v.lerpVectors(b.takoFly.from, end, e); _v.y += Math.sin(e * Math.PI) * .45; end.copy(_v); }
    _m.makeRotationY(b.i * 1.7).setPosition(end.x, end.y, end.z);
    P.tako.setMatrixAt(b.i, _m);
  }
  P.tako.instanceMatrix.needsUpdate = true;

  // status rings: gold = turn now, orange = hurry, dark = crispy, green = ready to plate, pink = needs octopus
  const pulse = 1 + Math.sin(G.time * 9) * .06, col = new THREE.Color();
  for (const b of S.balls) {
    let show = true, sc = 1;
    if (!b.batter || b.plated || G.mode !== 'play') show = false;
    else if (b.turns === 0 && !b.tako) col.setRGB(.95, .2, .75);
    else if (b.turns < 2) {
      const v = downB(b);
      if (v < .45) show = false;
      else if (v < .65) col.setRGB(.35, .35, .33);
      else if (v <= 1.1) { col.setRGB(1, .92, .05); sc = pulse; }
      else if (v <= 1.5) { col.setRGB(1, .12, .02); sc = pulse * 1.05; }
      else col.setRGB(.12, .02, .02);
    } else if (b.done) col.setRGB(.1, .95, .3);
    else show = false;
    if (show) { _m.makeScale(sc, 1, sc).setPosition(b.cx, CUP_Y + .012, b.cz); P.rings.setColorAt(b.i, col); }
    else _m.makeScale(0, 0, 0);
    P.rings.setMatrixAt(b.i, _m);
  }
  P.rings.instanceMatrix.needsUpdate = true; if (P.rings.instanceColor) P.rings.instanceColor.needsUpdate = true;
}

function updateDressing(dt) {
  S.danceT += dt;
  P.boats.forEach((bt, k) => {
    const n = bt.g.visible ? Math.round(S.aonoriAmt * 110) : 0;
    bt.ag.setDrawRange(0, n);
    const fc = Math.round(S.katsuoAmt * 48); bt.flakes.count = fc;
    const heat = .45 + .55 * Math.exp(-S.danceT / 40);
    bt.fl.forEach((f, i) => {
      if (i >= fc) return;
      const w = Math.sin(G.time * f.sp + f.ph) * .8 * heat;
      _m.makeRotationFromEuler(new THREE.Euler(-1.2 + w, f.ry + Math.sin(G.time * 2 + f.ph) * .3 * heat, w * .5));
      _s.makeScale(1, 1 + Math.sin(G.time * f.sp * .7 + f.ph) * .25 * heat, 1);
      _m.multiply(_s).setPosition(f.x, f.y + Math.abs(w) * .015, f.z);
      bt.flakes.setMatrixAt(i, _m);
    });
    bt.flakes.instanceMatrix.needsUpdate = true;
  });
}

function updateWeather(dt) {
  const p = G.phase;
  sky.rain = smooth(.195, .235, p) * (1 - smooth(.38, .45, p));
  sky.overcast = clamp(.55 + .4 * smooth(.1, .19, p) - .9 * smooth(.42, .58, p), 0, 1);
  sky.rainbow = smooth(.43, .49, p) * (1 - smooth(.56, .64, p));
  if (G.mode !== 'play') return;
  if (!S.thunder[0] && p > .16) { S.thunder[0] = true; audio.sfx('thunder'); helpers.forEach(h => h.mood('wow', 1)); }
  if (!S.thunder[1] && p > .2) {
    S.thunder[1] = true; S.rainSeen = true; audio.sfx('thunder'); cam.shake = .4;
    clawd.say('夕立だ! an evening shower', 2.4);
    if (S.umbrella !== 'open') hud.toast('🌧 夕立! a sudden shower — cover the pan with the umbrella');
  }
  S.wet = sky.rain > .25 && S.umbrella !== 'open';
  if (S.wet && S.poured && !allRound()) {
    S.wetT += dt;
    if (S.wetT > 2.6 && !S.flameOut) flameOut();
    if (Math.random() < dt * 8) { P.spit.emit(PAN_X + rand(-.7, .7), CUP_Y + .02, PAN_Z + rand(-.7, .7), rand(-.3, .3), rand(1, 1.8), rand(-.3, .3), .4, 1, 1, 1); }
  } else S.wetT = Math.max(0, S.wetT - dt);
  if (S.wet && S.plated > 0 && S.dressStep < 4) S.soggy += dt;
  if (S.flameOut && sky.rain < .05) relight(clawd);
}

function updateProps(dt) {
  // whisk + batter surface
  if (S.whisking > 0) { S.whisking -= dt; P.prep.whisk.position.set(.1 + Math.cos(S.whiskA) * .12, .34, Math.sin(S.whiskA) * .12); P.prep.whisk.rotation.z = .3; }
  else { P.prep.whisk.position.set(.1, .42, 0); P.prep.whisk.rotation.z = .5; }
  if (Math.abs(S.mix - S.mixDrawn) > .04) { S.mixDrawn = S.mix; drawBatter(P.prep.batterTex, S.mix); }
  P.prep.batterDisc.rotation.z = S.whiskA * .3;
  P.prep.batterDisc.visible = !S.poured;
  // pitcher sweeping over the pan
  const pouring = S.pouringNow && !S.poured;
  P.pitcher.visible = pouring; P.stream.visible = pouring;
  if (pouring) {
    const k = Math.min(15, Math.floor(S.pourProg * 16)), row = Math.floor(k / 4), col = row % 2 ? 3 - (k % 4) : k % 4;
    const tx = PAN_X + CUP_OFF[col], tz = PAN_Z + CUP_OFF[row];
    P.pitcher.position.x = lerp(P.pitcher.position.x, tx - .16, .3); P.pitcher.position.z = lerp(P.pitcher.position.z, tz, .3);
    P.pitcher.position.y = 1.05; P.pitcher.rotation.z = -.9;
    P.stream.position.set(P.pitcher.position.x + .2, (CUP_Y + .95) / 2, P.pitcher.position.z); P.stream.scale.set(1, .95 - CUP_Y, 1);
    audio.sfx('pour', { gap: .12 });
  }
  // the batter flood, tucked away as balls get turned
  const turnsTotal = S.balls.reduce((a, b) => a + b.turns, 0);
  const spillTarget = Math.min(1, S.pourProg) * (1 - turnsTotal / 32 * .92);
  P.spillMat.opacity = lerp(P.spillMat.opacity, spillTarget, Math.min(1, dt * 6));
  const set = clamp(S.balls.reduce((a, b) => a + (b.batter ? Math.min(1, b.N[1]) : 0), 0) / 16, 0, 1);
  P.spillMat.color.setRGB(1, lerp(1, .82, set), lerp(1, .58, set));
  P.sprinkleGeo.setDrawRange(0, Math.round(S.toppings * 220));
  P.sprinkles.material.opacity = Math.min(1, spillTarget * 1.3);
  // flame + knob
  const on = !S.flameOut;
  P.flame.visible = P.flameInner.visible = on;
  if (on) { const f = .9 + Math.sin(G.time * 31) * .06 + Math.sin(G.time * 17) * .05; P.flame.scale.set(f, f, 1 + Math.sin(G.time * 23) * .3); P.flame.material.opacity = .7 + Math.sin(G.time * 13) * .15; }
  if (S.knobT > 0) { S.knobT -= dt * 2; P.knob.rotation.z = Math.sin(S.knobT * 12) * .5; }
  // steam rises in proportion to what's cooking
  const n = S.flameOut ? 0 : cookingCount();
  if (n && Math.random() < dt * (2 + n * .7)) { const b = pick(S.balls.filter(b => b.batter && !b.plated)); P.steam.emit(b.cx + rand(-.1, .1), CUP_Y + .12, b.cz + rand(-.1, .1), rand(-.08, .08), rand(.3, .7), rand(-.08, .08), rand(.8, 1.6), .95, .95, .95); }
  if (S.plated > 8 && Math.random() < dt * 2) { const bt = P.boats[Math.random() < .5 ? 0 : 1]; if (bt.g.visible) P.steam.emit(bt.g.position.x + rand(-.3, .3), .4, BOAT_Z + rand(-.1, .1), 0, rand(.25, .5), 0, rand(.8, 1.4), .95, .95, .95); }
  // sound beds
  const sizzle = S.poured && on ? .15 + .85 * n / 16 : 0;
  if (Math.abs(sizzle - S.sizzleLvl) > .03) { S.sizzleLvl = sizzle; audio.loop('sizzle', sizzle); }
  const steamLvl = S.wet && S.poured ? .7 : 0;
  if (steamLvl !== S.steamLvl) { S.steamLvl = steamLvl; audio.loop('steam', steamLvl); }
  // umbrella opening
  const u = S.umbrella === 'open' ? 1 : 0;
  S.umbOpen = lerp(S.umbOpen, u, Math.min(1, dt * 3));
  if (S.umbOpen > .01) { P.umb.open.visible = true; const k = easeOut(S.umbOpen); P.umb.canopy.scale.set(.08 + .92 * k, lerp(2.6, 1, k), .08 + .92 * k); P.umb.pole.scale.y = .3 + .7 * k; }
  // the basket on its rope
  if (G.mode === 'play' && S.basket === 'hidden' && S.t > 10) {
    S.basket = 'descending'; drawNote(P.basket.noteTex, 'いい におい!', 'smells great! one please — 3F');
    audio.loop('creak', 1);
    const g = P.basket.g;
    tween(3.2, e => g.position.y = lerp(12, .12, ease(e)), () => {
      audio.loop('creak', 0); audio.sfx('clunk'); S.basket = 'waiting';
      hud.toast('<b>📝 a basket came down from 3F</b> 「いい におい! ひとつ ください」<br><span style="color:var(--dim)">"smells amazing — could we have some?"</span>', { dur: 4.5 });
      clawd.say('the neighbors upstairs want some ✦', 2.6); clawd.lookAt(new V3(BASKET_X, 1, BASKET_Z));
      tween(2.5, () => {}, () => clawd.lookAt(null));
    });
  }
  P.basket.g.rotation.z = Math.sin(G.time * 1.3) * .03;
  // what the crew holds or wears
  crew.forEach((c, i) => {
    const panWork = c === clawd ? (S.panView && atPan()) : (c.job === 'pan' || c.job === 'tako' || c.action?.kind === 'turn' || c.action?.kind === 'tako');
    P.picks[i].visible = !!panWork && G.mode === 'play' && c.g.visible;
    const covered = S.umbrella === 'open' && Math.abs(c.x - PAN_X) < 1.9;
    P.leaves[i].visible = sky.rain > .15 && !covered && c.g.visible;
  });
  if (S.clawdAnimT > 0) { S.clawdAnimT -= dt; if (S.clawdAnimT <= 0 && clawd.workAnim === 'chop' && !G.mini) clawd.workAnim = null; }
  if (S.cd > 0) S.cd -= dt;
}

// ───────────── the ending: hafu hafu ─────────────
async function ending(result, game) {
  exitPanView();
  audio.loop('sizzle', 0); audio.loop('steam', 0);
  if (result.quit) { clawd.say('another evening ✦', 2); await sleep(1.2); return; }
  const complete = !!result.complete;
  S.ending = true;
  // whatever's finished goes on a plate
  S.balls.filter(b => b.done && !b.plated).forEach((b, k) => tween(k * .1, () => {}, () => plateBall(b, clawd)));
  await sleep(.6);
  const food = S.balls.filter(b => b.plated && !b.gone);
  if (!complete) clawd.say(food.length ? 'it got dark — let\'s eat what we made' : 'no takoyaki tonight… the ramune was nice though', 3);
  else clawd.say('itadakimasu ✦', 2.4);
  // gather around whichever plates are still here
  const boatsHere = P.boats.filter(bt => bt.g.visible);
  const cx = boatsHere.length ? boatsHere.reduce((a, bt) => a + bt.g.position.x, 0) / boatsHere.length : 4.6;
  // a group photo: the crew close around the plates, the camera up high enough to see the food between them
  const half = boatsHere.length > 1 ? 1.0 : .5;
  await game.gather([[helpers[1], cx - half - .95, .66], [helpers[0], cx - half - .4, .6], [helpers[2], cx + half + .4, .62], [clawd, cx + half + 1.1, .58]], { timeout: 3.5 });
  crew.forEach(c => c.faceOverride = 0);
  const asp = innerWidth / innerHeight, d = clamp((half + 2.1) / (Math.tan(THREE.MathUtils.degToRad(17)) * asp), 6, 13);
  cam.shot(new V3(cx, .55 + d * .5, d * .82), new V3(cx, .45, -.25), { fov: 34, k: 1.4, drift: .4 });
  // the photo happens in the washed, golden light right after the shower
  const p0 = G.phase; tween(4, e => G.phase = lerp(p0, Math.max(p0, .6), ease(e)));
  audio.setMood('golden');
  await sleep(1.4);
  // each takes one
  const bites = food.slice(-8);
  crew.forEach((c, i) => tween(i * .35, () => {}, () => {
    const b = bites.pop(); if (b) b.eaten = true;
    if (b || !complete) { P.held[i].visible = !!b; c.workAnim = 'hold'; }
  }));
  await sleep(1.7);
  // hafu hafu: too hot!
  crew.forEach((c, i) => tween(i * .22, () => {}, () => { if (!P.held[i].visible) return; c.workAnim = 'eat'; c.mood('wow', 1.6); c.say('hafu hafu', 1.8); }));
  let puffT = 0;
  await new Promise(r => tween(2.4, (e, T) => {
    puffT -= 1 / 60;
    if (puffT <= 0) { puffT = .05; crew.forEach((c, i) => { if (P.held[i].visible) P.breath.emit(c.x + rand(-.08, .08), c.height * .75 + .05, c.z + .45, rand(-.12, .12), rand(.35, .7), .25, rand(.5, .9), 1, 1, 1); }); }
    if (e > .45 && !S.snapped) { S.snapped = true; game.snap(); }
  }, r));
  crew.forEach(c => { c.mood('happy', 3); c.blush = 1; });
  // ramune, if the neighbors sent one
  if (S.basket === 'returned') {
    P.basket.ramune.visible = false;
    const ram = P.basket.ramune; ram.parent?.remove(ram); ram.position.set(0, -.05, 0); ram.scale.setScalar(1.3); ram.visible = true; clawd.hand.add(ram); S.ramuneHeld = ram;
    clawd.workAnim = 'hold'; await sleep(.6);
    P.basket.marble.position.y = .2; audio.sfx('ramune'); sparkle(clawd.x + .5, 1.1, clawd.z + .2, 12, [.6, .95, 1]);
    clawd.say('ぷしゅっ ✦', 1.6); helpers.forEach(h => h.mood('wow', 1));
    await sleep(1.4);
  }
  crew.forEach((c, i) => { P.held[i].visible = false; c.workAnim = null; c.hop(.6); });
  // night, and one last note from upstairs
  const p1 = G.phase; tween(4.5, e => G.phase = lerp(p1, 1, ease(e)));
  audio.setMood('night');
  if (S.basket === 'returned') {
    await sleep(1.6);
    const g = P.basket.g; drawNote(P.basket.noteTex, 'ごちそうさま!', 'thanks for the meal — 3F');
    tween(2.6, e => g.position.y = lerp(.12, 1.6, ease(e)), () => { crew.forEach(c => { c.lookAt(new V3(BASKET_X, 3, BASKET_Z)); c.workAnim = 'wave'; }); clawd.say('おやすみ, 3F ✦', 2.4); });
    await sleep(3.4);
    crew.forEach(c => { c.workAnim = null; c.lookAt(null); });
  } else await sleep(3);
  await sleep(1.2);
}

function diary(result) {
  const s = G.stats, lines = [];
  const name = i => i === 3 ? 'I' : helpers[i].name[0].toUpperCase() + helpers[i].name.slice(1);
  lines.push(result.complete ? 'Today we made takoyaki on a little gas stove on the balcony.' : 'Today we tried to make takoyaki, but the evening ran out before we finished.');
  if (S.rainSeen) {
    if (S.umbrellaBy) lines.push(`It suddenly rained (夕立!), so ${S.umbrellaBy === clawd ? 'I' : S.umbrellaBy.name} held the big red umbrella over the pan.${S.flameOuts ? ' The flame went out once anyway.' : ''}`);
    else lines.push(S.flameOuts ? 'It suddenly rained and the flame went out. We relit it after the rain stopped.' : 'It suddenly rained. We all wore leaves on our heads.');
  }
  const turns = S.cnt.turn, top = [0, 1, 2, 3].sort((a, b) => turns[b] - turns[a])[0];
  if (turns[top] > 0) lines.push(`${name(top)} turned the most balls (${turns[top]} times).${top === 2 ? ' It says it doesn\'t mind the heat because it\'s made of ice.' : ''}`);
  const facts = [];
  if (S.perfect) facts.push(`${S.perfect} turns were perfect`);
  if (S.crispy) facts.push(`${S.crispy} came out crispy (crispy is good)`);
  if (facts.length) lines.push(facts.join(', ') + '.');
  if (S.noTako) lines.push(S.noTako === 1 ? 'One of them had no octopus inside. たこなし!' : `${S.noTako} of them had no octopus inside. たこなし!`);
  if (S.katsuoAmt >= 1) lines.push('The katsuobushi was dancing on top like it was alive.');
  if (S.basket === 'returned') lines.push('We sent eight up to the neighbors on the 3rd floor in a basket. It came back with a cold ramune and a note that said ありがとう!');
  if (result.complete) lines.push('They were very hot. Hafu hafu.');
  return { jp: result.complete ? 'きょうは たこやきを やきました。ゆうだちが ふったけど、すぐに やみました。' : 'きょうは たこやきを やきました。ちょっと まにあいませんでした。', lines };
}

// ───────────── chapter definition ─────────────
export default {
  id: 'takoyaki', day: 2, title: 'Takoyaki', jp: 'たこ焼き', short: 'たこ焼き', weather: 'くもり のち ゆうだち',
  blurb: 'Sixteen octopus balls, one hot pan, and a sudden summer shower.',
  jpPreview: 'きょうは たこやきを やく。',
  prompt: 'make takoyaki for the neighbors', goal: 'make takoyaki for the neighbors',
  sky: 'shower', mood: 'day', dayLen: 190, phase: [0, 1], clock: [17 * 60, 19 * 60 + 30], clockNote: '🌧 evening shower around 6',
  helpers: [
    { spec: ['tako', 'plate'], specName: 'octopus · plating' },
    { spec: ['batter', 'sauce'], specName: 'batter · sauce' },
    { spec: ['pan', 'parasol'], specName: 'turning · umbrella' },
  ],
  intro: [['$ git pull'], ['  Already up to date.', '#7bd88f'], ['$ npm run build'], ['  ✓ built in 1.8s', '#7bd88f'], ['  done for today ✦', '#f2c14e']],
  introShots: [
    { pos: [2, 1.7, 5.4], look: [0, 6, -20], fov: 50, dur: 2.4, to: { pos: [1.4, 1.9, 4.9], look: [0, 6.4, -20] } },
    { pos: [1.15, 1.2, 1.4], look: [.3, .38, -.35], fov: 32, dur: 2.2, to: { pos: [.9, 1.05, 1.15] } },
    { pos: [-1.95, .85, .9], look: [-2.55, .15, -.5], fov: 30, dur: 1.9, to: { pos: [-2.15, .8, .8] } },
    { pos: [-4.0, 1.05, .95], look: [-4.5, .25, -.4], fov: 30, dur: 1.8, to: { pos: [-4.2, 1.0, .85] } },
    // Clawd at the laptop, from out front, so the move to the screen never passes through Clawd
    { pos: [-5.6, 2.3, 7.2], look: [-7.6, .6, -.4], fov: 34, dur: 1.7, to: { pos: [-6.4, 2.0, 6.0] } },
  ],
  introSays() {
    helpers[2].say('I\'m cold, so I don\'t mind the heat ✦', 3);
    tween(.9, () => {}, () => helpers[0].say('🐙!', 2));
  },

  setup(root, game) {
    GAME = game;
    S = {
      t: 0, mix: 0, mixDrawn: -1, mixed: false, whiskA: 0, whisking: 0,
      pourProg: 0, poured: false, pouringNow: false, pourQ: 0, overflow: false,
      balls: Array.from({ length: 16 }, (_, i) => newBall(i)),
      toppings: 0, toppingsBy: null,
      flameOut: false, flameOuts: 0, wet: false, wetT: 0, knobT: 0, soggy: 0,
      umbrella: 'closed', umbrellaProg: 0, umbrellaBy: null, umbOpen: 0, rainSeen: false, thunder: [false, false],
      plated: 0, dressStep: 0, dressBy: {}, sauceAmt: 0, aonoriAmt: 0, katsuoAmt: 0, mayoPts: null, danceT: 0,
      basket: 'hidden', basketBy: null,
      cnt: { tako: [0, 0, 0, 0], turn: [0, 0, 0, 0], perfect: [0, 0, 0, 0], plate: [0, 0, 0, 0], dress: [0, 0, 0, 0] },
      perfect: 0, crispy: 0, noTako: 0, early: 0,
      panView: false, hover: -1, queue: [], cd: 0, clawdAnimT: 0, sizzleLvl: -1, steamLvl: -1, snapped: false, ending: false,
    };
    build(root);
    sky.overcast = .55; sky.rain = 0; sky.rainbow = 0;
    CSS = document.createElement('style');
    CSS.textContent = `
      #tk-back{position:fixed;left:14px;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 74px);z-index:6;padding:8px 13px;font:12px var(--mono);color:var(--ink);cursor:pointer;border-radius:999px;transition:opacity .3s}
      #tk-mayo{display:block;margin:4px auto;border-radius:10px;touch-action:none;cursor:crosshair;max-width:72vw;height:auto!important}
      @media (max-width:700px){#tk-back{left:10px;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 128px)}}`;
    document.head.appendChild(CSS);
    back = document.createElement('button');
    back.id = 'tk-back'; back.className = 'panel hidden'; back.textContent = '↩ step back from the pan';
    back.onclick = e => { e.stopPropagation(); exitPanView(); };
    document.body.appendChild(back);
  },

  stations: () => ({
    batter: { name: 'batter bowl', spot: SPOT.batter, job: 'batter', hit: [1.3, 1.0, 1.2, -4.35, .4, -.5], ring: [-4.5, -.4, 1.1], keywords: ['batter', 'mix', 'whisk', 'pour', 'flour', 'dough', 'bowl'],
      tip: () => `batter bowl · ${S.mixed ? (S.poured ? 'poured ✓' : 'mixed — pour it over the pan') : `whisking ${Math.round(S.mix * 100)}%`}` },
    tako: { name: 'octopus & toppings', spot: SPOT.tako, job: 'tako', hit: [1.55, .8, 1.0, -2.55, .3, -.5], ring: [-2.55, -.5, 1.2], keywords: ['octopus', 'tako', 'toppings', 'tenkasu', 'ginger', 'onion', 'sprinkle'],
      tip: () => `octopus & toppings · ${takoCount()}/16 octopus · ${S.toppings >= 1 ? 'toppings ✓' : 'toppings'}` },
    pan: { name: 'takoyaki pan', spot: SPOT.pan, job: 'pan', hit: [2.1, 1.1, 1.9, PAN_X, .35, PAN_Z], ring: [PAN_X, PAN_Z, 1.75], keywords: ['pan', 'turn', 'flip', 'balls', 'cook', 'pick', 'stove'],
      tip: () => {
        if (S.hover >= 0) { const b = S.balls[S.hover]; if (!b.batter) return 'an empty cup'; if (b.turns === 0 && !b.tako) return 'needs octopus — click to drop one in'; if (b.turns < 2) { const v = downB(b); return v < .45 ? 'still setting…' : v < .65 ? 'almost…' : v <= 1.1 ? 'turn it now ✦' : v <= 1.5 ? 'turn it! getting dark' : 'crispy… turn it anyway'; } return b.done ? 'round and done ✓' : 'rolling…'; }
        return `takoyaki pan · ${roundCount()}/16 round${S.flameOut ? ' · flame out!' : ''}`;
      } },
    parasol: { name: 'umbrella', spot: SPOT.parasol, job: 'parasol', hit: [.7, 1.7, .8, 3.0, .8, -.9], ring: [3.0, -.85, .8], keywords: ['umbrella', 'parasol', 'rain', 'cover', 'shower'],
      tip: () => S.umbrella === 'open' ? 'umbrella · the pan is covered ✓' : 'umbrella · for the evening shower' },
    plate: { name: 'boat plates', spot: SPOT.plate, job: 'plate', hit: [2.3, .8, 1.0, 4.83, .3, -.35], ring: [4.83, -.35, 1.6], keywords: ['plate', 'plates', 'boat', 'sauce', 'mayo', 'aonori', 'katsuobushi', 'dress', 'serve', 'eat'],
      tip: () => ready() ? 'takoyaki · click to eat together ✦' : `boat plates · ${S.plated}/16 · ${DRESS.map((d, i) => (i < S.dressStep ? '●' : '○') + ' ' + d.label).join('  ')}` },
    basket: { name: 'basket from 3F', spot: SPOT.basket, job: 'basket', hitObj: () => P.basketHit, ring: () => [BASKET_X, BASKET_Z, 1.0], keywords: ['basket', 'neighbor', 'neighbors', 'upstairs', '3f', 'send', 'rope'],
      tip: () => ({ hidden: '', descending: 'a basket is coming down…', waiting: S.dressStep >= 4 ? 'basket · send eight up to 3F' : 'basket · the neighbors want some', loading: 'basket · going up', rising: 'basket · going up', up: 'basket · upstairs', returning: 'basket · coming back down', returned: 'basket · ありがとう! ✓' }[S.basket]) },
  }),
  jobs,
  interact,
  ready,
  redirect: k => k,

  todo() {
    const who = j => { const w = helpers.filter(h => h.job === j).map(h => h.short); const lk = { batter: ['batter', 'pour'], tako: ['toppings'], parasol: ['parasol'], plate: ['dress'], basket: ['basket'] }[j] || []; if (lk.some(l => G.locks[l] === clawd) || (j === 'pan' && S.panView && atPan())) w.unshift('you'); return w; };
    const rows = [
      { label: 'mix the batter', done: S.mixed, detail: !S.mixed && S.mix > 0 ? `${Math.round(S.mix * 100)}%` : '', workers: who('batter') },
      { label: 'pour it over the pan', done: S.poured, blocked: !S.mixed, workers: who('batter') },
      { label: 'octopus & toppings', done: takoDone(), blocked: !S.poured, detail: S.poured ? `${takoCount()}/16 · ${S.toppings >= 1 ? '✓' : '○'}` : '', workers: who('tako') },
      { label: 'turn the balls', done: allRound(), blocked: !S.poured, detail: S.poured ? `${roundCount()}/16 round${S.crispy ? ` · ${S.crispy} crispy` : ''}` : '', workers: who('pan') },
    ];
    if (S.rainSeen && (sky.rain > .05 || S.umbrella !== 'open' || S.umbrellaProg > 0)) rows.push({ label: S.flameOut ? 'cover the pan · flame out!' : 'cover the pan (rain!)', done: S.umbrella === 'open', workers: who('parasol') });
    rows.push(
      { label: 'plate & dress', done: S.dressStep >= 4, blocked: !S.balls.some(b => b.done), detail: S.plated < 16 ? `${S.plated}/16` : DRESS.map((d, i) => i < S.dressStep ? '●' : '○').join(''), workers: who('plate') },
      { label: 'send some to 3F', done: S.basket === 'returned', blocked: S.basket !== 'waiting' || S.dressStep < 4, detail: S.basket === 'rising' || S.basket === 'up' || S.basket === 'returning' ? '↑ ↓' : '', workers: who('basket') },
      { label: 'eat together', done: false, blocked: !ready(), detail: ready() ? '← click the plates' : '' },
    );
    return rows;
  },
  hint() {
    if (ready()) return 'everything\'s ready — click the plates to eat together ✦';
    if (S.wet && S.umbrella !== 'open') return '🌧 rain on the pan! open the umbrella (or send helper 3)';
    if (!S.mixed) return G.stats.deleg === 0 ? 'whisk the batter at the bowl ← · or pick a helper below, then a station' : '';
    if (!S.poured) return 'tip: put helpers on the octopus and the pan before you pour — all 16 come due at once';
    if (takoOpen().length && S.panView) return 'click the pink cups to drop octopus in';
    if (S.panView && !allRound()) return 'click a ball when its ring glows gold · Esc steps back';
    if (allRound() && S.plated < 16) return 'all round — plate them at the boats →';
    if (S.plated >= 16 && S.dressStep < 4) return `dress them: ${DRESS[S.dressStep].label} next`;
    if (S.dressStep >= 4 && S.basket === 'waiting') return 'send eight up to 3F in the basket →';
    return '';
  },

  start() { S.t = 0; },
  update(dt) {
    if (!S) return;
    if (G.mode === 'play') S.t += dt;
    updateWeather(dt);
    updateBalls(dt);
    updateDressing(dt);
    updateProps(dt);
    // walking away from the pan steps back from the close view
    if (S.panView && clawd.pending && clawd.pending !== 'pan') exitPanView();
    if (S.panView && G.mode === 'play' && cam.mode === 'play') S.panView = false;
    // hover ring over the cup under the cursor
    P.hover.visible = G.mode === 'play' && S.hover >= 0 && !S.balls[S.hover].plated;
    if (P.hover.visible) { const b = S.balls[S.hover]; P.hover.position.set(b.cx, CUP_Y + .016, b.cz); P.hover.material.opacity = .55 + Math.sin(G.time * 8) * .2; }
  },
  pointer(type, e, ray) {
    if (!S || G.mode !== 'play') return false;
    if (type === 'move') { S.hover = cupAt(e); return false; }
    if (type === 'down') { S.down = [e.clientX, e.clientY]; return false; }
    if (type === 'up') {
      const d = S.down; S.down = null;
      if (!d || Math.hypot(e.clientX - d[0], e.clientY - d[1]) > 10) return false;
      const i = cupAt(e);
      if (i >= 0) { clickBall(i, GAME); return true; }
      if (S.panView) exitPanView();
      return false;
    }
    return false;
  },
  key(e) {
    if (e.key === 'Escape' && S?.panView) exitPanView();
    return false;
  },

  ending,
  diary,
  debug: () => S,
  debugProps: () => P,
  debugDownB: b => downB(b),
  teardown() {
    exitPanView();
    audio.loop('sizzle', 0); audio.loop('steam', 0); audio.loop('creak', 0);
    sky.rain = 0; sky.overcast = 0; sky.rainbow = 0;
    crew.forEach((c, i) => { c.hand.remove(P.picks[i]); c.headSlot.remove(P.leaves[i]); c.hand.remove(P.held[i]); c.lookAt(null); });
    if (S.ramuneHeld) clawd.hand.remove(S.ramuneHeld);
    CSS?.remove(); back?.remove(); CSS = back = null;
    S = null;
  },

  ls: () => ['pan/ (16 cups)  batter.bowl  octopus/  toppings/{tenkasu,beni_shoga,negi}  wagasa.umbrella  plates/{boat_a,boat_b}  basket → 3F'],
  review: () => !S ? 'nothing to review' : ready() ? 'LGTM ✦ ship it (eat it)' : `changes requested: ${!S.poured ? 'nothing in the pan yet' : !allRound() ? `${16 - roundCount()} still need turning` : S.plated < 16 ? 'plate them' : S.dressStep < 4 ? `needs ${DRESS[S.dressStep].label}` : 'the neighbors are waiting'}`,
  commands: {
    'cat recipe.md': () => [
      '# takoyaki (たこ焼き)',
      'osaka street food: batter balls with octopus inside, cooked in a cast-iron pan of half-round cups.',
      '- batter: flour, dashi, egg — thin and pourable. flood the whole pan.',
      '- in each cup: a piece of octopus, then tenkasu, beni-shōga, green onion',
      '- when the bottom sets, turn each ball 90° with a pick; the raw batter flows down to make the other half',
      '- turn again, then keep rolling until they\'re round and golden',
      '- finish: sauce, mayo, aonori, katsuobushi — the flakes dance in the heat',
      '- popularized in osaka in the 1930s. eat them hot. hafu hafu.',
    ],
    'cat note.txt': () => S && S.basket !== 'hidden' ? (S.basket === 'returned' ? ['ありがとう! — 3F', '(thank you!)'] : ['いい におい! ひとつ ください — 3F', '(smells great! could we have some?)']) : 'no such file (yet)',
  },
};

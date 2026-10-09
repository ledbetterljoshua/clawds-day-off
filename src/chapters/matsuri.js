// Sketch · 夏祭り Natsu-matsuri. Saturday night, the neighborhood summer festival on a street in
// the town below the balcony. The crew runs a kakigōri stall: shave → syrup → serve, one cup per
// customer in line. The helpers can staff it as standing jobs; staff it well and Clawd is free to
// go scoop goldfish and buy a mask with what the stall earns. Fireworks over the river at 8:30.
import { THREE, V3, toScreen } from '../core/gfx.js';
import { G, emit } from '../core/state.js';
import { $, rand, pick, clamp, lerp, smooth, damp, esc } from '../core/util.js';
import { tween, sleep, until } from '../core/tween.js';
import { clawd, helpers, crew } from '../core/crab.js';
import { lock, credit, unassign } from '../core/agents.js';
import { mini } from '../core/minigames.js';
import { cam } from '../core/camera.js';
import { sky } from '../core/sky.js';
import { world } from '../core/world.js';
import { audio } from '../core/audio.js';
import { hud } from '../core/hud.js';
import { term } from '../core/terminal.js';
import { sparkle, puff, firework } from '../core/fx.js';
import { X, FRONT, buildStreet, updateLanterns } from './matsuri/street.js';
import { FLAV, FLAVORS, SX, SPOT, QUEUE, buildStall, syncStall, makeCup, counterY as CY, counterZ as CZ } from './matsuri/stall.js';
import { Folk } from './matsuri/folk.js';
import { buildGoldfish, tubShot, TUB, FISH_NAME } from './matsuri/goldfish.js';
import { MASKS, maskMesh, buildMaskBoard, maskThumb } from './matsuri/masks.js';

const PRICE = { cup: 300, poi: 300, mask: 600, ice: 200 };
const LANES = [1.7, 2.1, 2.5];
const BROWSE = [X.gold, -6, -16, X.ice, X.mask, 16.2, 20.4];
const SERVE_FACE = Math.PI / 2;

let S = null, P = null, GF = null, GAME = null, CSS = null, UI = null, lightHome = null;
const crowd = [];
const _v = new V3(), _pos = new V3(), _look = new V3();

audio.register('coin', o => { audio.tone(2093, .09, 'triangle', .06, null, { delay: o.delay || 0 }); audio.tone(2794, .16, 'triangle', .045, null, { delay: (o.delay || 0) + .06 }); audio.noise(.02, 'highpass', 6000, .04, .7, { delay: o.delay || 0 }); });

// ───────────── the line ─────────────
function stroll(f, { x = null, dir = null } = {}) {
  f.reset();
  const d = dir ?? (Math.random() < .5 ? 1 : -1);
  f.x = x ?? (d > 0 ? -33 : 33); f.z = f.tz = pick(LANES) + rand(-.1, .1);
  f.tx = d > 0 ? 33 : -33; f.role = 'stroll'; f.g.visible = true; f.browsed = new Set(); f.cust = null;
}
const nextUnfilled = () => S.queue.find(c => c.arrived && !c.filled && !c.claimed);
const frontCustomer = () => S.queue[0]?.arrived ? S.queue[0] : null;
const readyFor = c => c && S.ready.find(r => r.c === c);

function newCustomer() {
  if (S.closed) return;
  if (S.queue.length >= 6) {
    // a full line turns people away: a lost sale, said out loud if Clawd is near enough to hear
    S.lost++;
    const f = crowd.find(f => f.role === 'stroll' && Math.abs(f.x - QUEUE.x0 - 6) < 4);
    if (f) f.say(pick(['the line is so long…', 'ながい…', 'maybe later']), 2);
    return;
  }
  let best = null, bd = 12;
  for (const f of crowd) if (f.role === 'stroll' && f.g.visible) { const d = Math.abs(f.x - (X.stall + 5)); if (d < bd) { bd = d; best = f; } }
  if (!best) {
    best = crowd.find(f => f.role === 'stroll' && Math.abs(f.x) > 31) || crowd.find(f => f.role === 'idle');
    if (!best) return;
    stroll(best, { x: clamp(cam.pos.x + (Math.random() < .5 ? -16 : 16), -32, 32) });
  }
  const c = { f: best, flavor: pick(FLAVORS), patience: 50, patience0: 50, filled: false, claimed: false, arrived: false, free: false };
  best.role = 'queue'; best.cust = c;
  S.queue.push(c);
}

function leaveLine(c, { sad = false, say = null } = {}) {
  const i = S.queue.indexOf(c); if (i >= 0) S.queue.splice(i, 1);
  const r = readyFor(c);
  if (r) { const n = S.queue.find(q => !q.filled && !q.claimed && q.flavor === r.flavor); if (n) { r.c = n; n.filled = true; } else r.c = null; }
  const f = c.f; f.cust = null; f.role = 'leave'; f.tz = pick(LANES); f.tx = Math.random() < .5 ? -33 : 33;
  if (sad) { f.sad = 3; f.say(say || pick(['…もういいや', '(´・ω・`)', 'too long…']), 2.2); S.lost++; term.log(`✗ a customer gave up (${FLAV[c.flavor].en})`, '#f7d488'); }
  else if (say) f.say(say, 2);
}

function updateCrowd(dt) {
  for (const f of crowd) {
    if (f.role === 'gone') continue;
    if (f.role === 'stroll' || f.role === 'leave') {
      if (Math.abs(f.x) > 32.5 && Math.abs(f.tx - f.x) < .1) { stroll(f, { dir: f.x > 0 ? -1 : 1 }); continue; }
      if (f.role === 'stroll' && f.tz > 1.4) for (const bx of BROWSE) if (!f.browsed.has(bx) && Math.abs(f.x - bx) < .25) {
        f.browsed.add(bx);
        if (Math.random() < .3) { f.role = 'browse'; f.wait = rand(2, 4.5); f.back = { tx: f.tx, tz: f.tz }; f.tx = f.x; f.tz = 1.2; f.face0 = Math.PI; }
      }
    } else if (f.role === 'browse') {
      f.wait -= dt;
      if (f.wait < 0) { f.role = 'stroll'; f.tx = f.back.tx; f.tz = f.back.tz; }
    }
    f.update(dt, toScreen);
  }
  // queue: shuffle forward, count down patience, show orders
  S.queue.forEach((c, i) => {
    const f = c.f;
    f.tx = QUEUE.x0 + i * QUEUE.step; f.tz = QUEUE.z + (i % 2) * .14;
    if (!c.arrived && f.arrived()) { c.arrived = true; f.face0 = -Math.PI / 2; if (!c.free) f.say(`${FLAV[c.flavor].kana} ください`, 1.4); }
    if (c.arrived && !c.filled && !c.claimed && !c.free && G.mode === 'play') {
      c.patience -= dt * (S.view === 'tub' ? .8 : 1);
      if (c.patience <= 0) leaveLine(c, { sad: true });
    }
  });
  S.chipT -= dt;
  if (S.chipT <= 0) {
    S.chipT = .2;
    S.queue.forEach((c, i) => {
      const f = c.f; if (!c.arrived || f.bubT > .35 && f.bub.dataset.chip !== '1') return;
      const pct = c.filled || c.free ? 100 : Math.round(100 * c.patience / c.patience0);
      const html = c.free ? '<span class="mt-ord">♡</span>' : `<span class="mt-ord"><i style="background:${FLAV[c.flavor].css}"></i>${FLAV[c.flavor].kana}${c.filled ? ' ✓' : ''}</span><b class="mt-pat ${pct < 35 ? 'low' : ''}"><i style="width:${pct}%"></i></b>`;
      if (f.bub.innerHTML !== html) f.bub.innerHTML = html;
      f.bub.dataset.chip = '1'; f.bubT = Math.max(f.bubT, .5);
    });
  }
  if (!S.closed && G.mode === 'play') {
    S.spawnT -= dt;
    const rush = G.phase > .895 && G.phase < .93;
    if (rush && !S.rushSaid) { S.rushSaid = true; hud.toast('🥁 the bon-odori just ended — everyone wants kakigōri!', { dur: 3.6 }); term.log('🥁 rush at the stalls', '#f2c14e'); }
    if (S.spawnT <= 0) { S.spawnT = rush ? rand(2.4, 3.2) : lerp(7.5, 4.2, smooth(.8, .98, G.phase)) + rand(-1.2, 1.2); newCustomer(); }
  }
}

// ───────────── the stall's production line ─────────────
function finishShave(who) {
  S.shaveProg = 0; S.hopper--; S.shaved++;
  audio.sfx('chime', { x: SX.shaver });
  for (let k = 0; k < 16; k++) P.snow.emit(SX.shaver + rand(-.12, .12), CY + .5, CZ + rand(-.1, .1), rand(-.3, .3), rand(-.5, .2), rand(-.2, .2), rand(.4, .8));
  credit(who);
}
function finishSyrup(who, c) {
  S.shaved--; S.pouring = null; c.claimed = false;
  if (!S.queue.includes(c)) c = S.queue.find(q => !q.filled && !q.claimed && q.flavor === c.flavor) || null;
  if (c) { c.filled = true; S.ready.push({ flavor: c.flavor, c }); }
  else { who.say('…nobody\'s waiting for this one. ✦', 2); who.mood('happy', 1.5); }
  audio.sfx('pour', { x: SX.bottles[1] });
  credit(who);
}
function serveCustomer(who, c, r) {
  const slot = S.ready.indexOf(r);
  S.ready.splice(slot, 1);
  const i = S.queue.indexOf(c); if (i >= 0) S.queue.splice(i, 1);
  const f = c.f, cup = makeCup(c.flavor), from = new V3(SX.ready[Math.max(0, slot)], CY, CZ + .05);
  P.root.add(cup); cup.position.copy(from);
  f.cust = null; f.role = 'served'; f.bub.dataset.chip = '';
  tween(.45, e => { f.hand.getWorldPosition(_v); cup.position.lerpVectors(from, _v, e); cup.position.y += Math.sin(e * Math.PI) * .5; }, () => {
    cup.position.set(0, 0, 0); f.hand.add(cup); f.eat = 1; f.hop = .35;
  });
  if (!c.free) {
    S.coins += PRICE.cup; S.earned += PRICE.cup; S.sold++;
    audio.sfx('coin', { x: SX.coins, delay: .3 });
    for (let k = 0; k < 8; k++) P.coinFx.emit(SX.coins, CY + .2, CZ + .1, rand(-.5, .5), rand(1.5, 2.6), rand(-.2, .2), .6, 1, .85, .4);
    floatText(`+¥${PRICE.cup}`, SX.coins, CY + .5, CZ);
    f.say(pick(['ありがとう!', '冷たい〜 ✦', 'おいしそう!', 'わーい']), 1.8);
    if (S.sold === 1) term.log('¥ first cup sold ✦', '#f2c14e');
  } else {
    f.say('ありがとう!!', 2.2); f.hop = .8; who.mood('love', 2);
    if (S.kid) { S.kid.phase = 'served'; S.kid.who = who; }
    term.log(`♡ ${who === clawd ? 'you' : who.name} gave the kid a new one`, '#ff9ab0');
  }
  credit(who);
  tween(.9, () => { }, () => {
    if (!S || f.role !== 'served') return;
    f.tz = pick(LANES); f.tx = Math.random() < .55 ? 33 : -33;
    if (f.sp.id === 'kid' && !S.kid && !c.free && G.t > 45) kidDrop(f, who, c.flavor);
    else tween(6, () => { }, () => { if (f.role === 'served') f.role = 'leave'; });
  });
}
// a kid trips and drops theirs; whoever is serving makes them a new one, free
function kidDrop(f, who, flavor) {
  S.kid = { who, phase: 'walking' };
  f.role = 'drop'; f.tx = f.x + 1.3; f.tz = f.z + .2;
  tween(1.0, () => { }, () => {
    if (!S) return;
    f.tx = f.x; f.tz = f.z;
    const cup = f.hand.children[0];
    if (cup) { f.hand.remove(cup); P.root.add(cup); cup.position.set(f.x + .3, .55, f.z + .1); const y0 = cup.position.y; tween(.35, e => { cup.position.y = lerp(y0, .02, e * e); cup.rotation.z = e * 1.9; }, () => { puff(cup.position.x, .05, cup.position.z, 10, [1, .9, .92]); audio.sfx('drip'); tween(2.5, () => { }, () => cup.parent?.remove(cup)); }); }
    f.sad = 4; f.say('あっ…', 2); audio.sfx('voice', { i: 0, n: 2 });
    tween(1.4, () => { }, () => {
      if (!S || G.mode !== 'play') return;
      const server = who;
      server.say(`ah — here, a new one ✦ (free)`, 2.4); server.mood('happy', 2);
      const c2 = { f, flavor, patience: 99, patience0: 99, filled: false, claimed: false, arrived: false, free: true };
      f.role = 'queue'; f.cust = c2; S.queue.unshift(c2); S.kid.phase = 'waiting'; S.kid.who = server;
    });
  });
}

// mid-evening one helper asks for a little break to go and look at the goldfish
function updateBreak(dt) {
  const B = S.brk;
  if (!B) {
    if (G.phase < .865 || S.breakDone) return;
    const h = helpers[1];
    if (!['shave', 'syrup', 'serve'].every(j => helpers.some(x => x.job === j)) || !h.job) return;
    S.brk = { h, t: 0, step: 'ask', role: { shave: 'shaver', syrup: 'syrup', serve: 'serve' }[h.job], job: h.job };
    h.say('can I take a little break? the goldfish… ✦', 2.8); h.mood('love', 2.5);
    term.log(`> ${h.name}: may I take a short break?`, '#9fd3ff');
    return;
  }
  const h = B.h; B.t += dt;
  if (B.step === 'ask' && B.t > 2.8) {
    unassign(h); h.say('back soon ✦', 1.5); h.targetX = X.gold + 1.3; h.speed = Math.max(h.speed, 2.6);
    B.step = 'away'; B.t = 0; S.breakDone = true;
    hud.toast(`${h.name} is on a break · nobody's on ${B.job === 'syrup' ? 'syrups' : B.job} for a bit`, { dur: 3.4 });
  } else if (B.step === 'away') {
    if (h.job) { h.say('ok ok, back to work ✦', 2); S.brk = null; S.breakCut = true; return; }
    if (Math.abs(h.x - h.targetX) < .1) { h.faceOverride = Math.PI; if (Math.random() < dt * .25) h.say(pick(['ahh…', 'so calm', 'the black one is my favorite']), 2); }
    if (B.t > 32) { B.step = 'back'; h.faceOverride = null; h.targetX = SPOT.syrup; h.say('thank you ✦', 1.6); }
  } else if (B.step === 'back' && (h.arrived() || h.job)) {
    if (!h.job) GAME.assign(h, B.role);
    S.brk = null; S.breakTaken = true;
  }
}

function floatText(t, x, y, z) {
  const p = toScreen(x, y, z); if (p.behind) return;
  const d = document.createElement('div'); d.className = 'mt-float'; d.textContent = t; d.style.left = p.x + 'px'; d.style.top = p.y + 'px';
  document.body.appendChild(d); setTimeout(() => d.remove(), 1300);
}

// ───────────── helper jobs (standing: a helper keeps a role until reassigned) ─────────────
const roleRelease = key => h => { S && (S.lastRole[h.i] = key); };
const jobs = {
  shave: {
    label: 'shave ice', done: () => false, release: roleRelease('shaver'),
    plan(h, sp) {
      if (S.closed) return null;
      if (S.shaved >= 3) return { x: SPOT.shave, wait: 'counter full ⋯', quiet: true };
      if (S.hopper <= 0) {
        if (S.box <= 0) return { x: SPOT.shave, wait: 'out of ice!' };
        return { x: SPOT.box, start: () => {
          if (S.box <= 0 || S.hopper > 0) return null;
          let t = 0;
          return { kind: 'load', anim: 'pick', face: -.7, verb: 'loading ice', step(dt) { t += dt; if (t > 1.0 / sp) { S.box--; S.hopper = 6; audio.sfx('clunk', { x: SX.shaver }); return true; } } };
        } };
      }
      if (G.locks.shaver) return { x: SPOT.shave + .6, wait: '⋯', quiet: true };
      return { x: SPOT.shave, start: () => {
        if (S.hopper <= 0 || S.shaved >= 3 || !lock('shaver', h)) return null;
        return { kind: 'crank', lock: 'shaver', anim: 'crank', face: -.8, verb: 'shaving', step(dt) {
          if (S.hopper <= 0 || S.shaved >= 3) return true;
          S.shaveProg += dt / (4.2 / sp); S.crankA += dt * 7 * sp; S.cranking = .2;
          if (Math.random() < dt * 8) audio.sfx('grind', { x: SX.shaver });
          if (S.shaveProg >= 1) { finishShave(h); return true; }
        } };
      } };
    },
  },
  syrup: {
    label: 'pour syrup', done: () => false, release: roleRelease('syrup'),
    plan(h, sp) {
      if (S.closed) return null;
      const c = nextUnfilled();
      if (!c) return { x: SPOT.syrup, wait: S.queue.length ? '⋯' : 'no orders ⋯', quiet: true };
      if (S.shaved <= 0) return { x: SPOT.syrup, wait: 'waiting for ice ⋯', quiet: true };
      if (S.ready.length >= 4) return { x: SPOT.syrup, wait: 'counter full ⋯', quiet: true };
      if (G.locks.syrup) return { x: SPOT.syrup + .6, wait: '⋯', quiet: true };
      return { x: SPOT.syrup, start: () => {
        const c = nextUnfilled();
        if (!c || S.shaved <= 0 || S.ready.length >= 4 || !lock('syrup', h)) return null;
        c.claimed = true; S.pouring = { flavor: c.flavor, c };
        let p = 0;
        return { kind: 'pour', lock: 'syrup', anim: 'pour', face: -.6, verb: `pouring ${FLAV[c.flavor].en}`,
          cancel() { c.claimed = false; S.pouring = null; },
          step(dt) { p += dt / (2.8 / sp); if (Math.random() < dt * 5) audio.sfx('pour', { x: SX.bottles[1] }); if (p >= 1) { finishSyrup(h, c); return true; } } };
      } };
    },
  },
  serve: {
    label: 'serve', done: () => false, release: roleRelease('serve'),
    plan(h, sp) {
      if (S.closed) return null;
      const c = frontCustomer(), r = readyFor(c);
      if (!c) return { x: SPOT.serve, wait: 'no one in line', quiet: true };
      if (!r) return { x: SPOT.serve, wait: c.free ? 'one for the kid ⋯' : `waiting on ${FLAV[c.flavor].en}`, quiet: true };
      if (G.locks.serve) return { x: SPOT.serve - .6, wait: '⋯', quiet: true };
      return { x: SPOT.serve, start: () => {
        const c = frontCustomer(), r = readyFor(c);
        if (!c || !r || !lock('serve', h)) return null;
        let p = 0;
        return { kind: 'serve', lock: 'serve', anim: 'hold', face: SERVE_FACE, verb: 'serving', step(dt) {
          if (!S.queue.includes(c)) return true;
          p += dt / (1.6 / sp); if (p >= 1) { serveCustomer(h, c, r); return true; }
        } };
      } };
    },
  },
  fetch: {
    label: 'fetch ice', done: () => S.box >= 4,
    release(h) {
      if (h.carry) { h.setCarry(false); S.box = Math.min(4, S.box + 2); }
      const back = S.lastRole[h.i];
      if (back) tween(.6, () => { }, () => { if (S && G.mode === 'play' && !h.job) { GAME.assign(h, back); } });
    },
    plan(h, sp) {
      if (h.carry) return { x: SPOT.box, start: () => { h.setCarry(false); S.box = Math.min(4, S.box + 2); audio.sfx('clunk', { x: SX.box }); h.say('two blocks ✦', 1.5); credit(h); return null; } };
      if (S.coins < PRICE.ice) return { x: h.x, wait: `ice is ¥${PRICE.ice} — no money yet` };
      return { x: X.ice + 1.5, start: () => {
        if (S.coins < PRICE.ice || S.box >= 4) return null;
        S.coins -= PRICE.ice; audio.sfx('coin', { x: X.ice });
        let t = 0;
        return { kind: 'buy', anim: 'pick', face: Math.PI * .85, verb: 'buying ice', step(dt) { t += dt; if (t > .9 / sp) { h.setCarry(true); return true; } } };
      } };
    },
  },
  gold: { label: 'goldfish', done: () => false, canAssign: () => false, refuse: 'this one\'s for you, clawd ✦', plan: () => null },
  masks: { label: 'masks', done: () => false, canAssign: () => false, refuse: 'pick one for yourself ✦', plan: () => null },
};

// ───────────── Clawd at a station ─────────────
function interact(k, game) {
  if (S.closed) return;
  switch (k) {
    case 'shaver': {
      if (clawd.carry) return dropIce();
      if (S.hopper <= 0) {
        if (S.box <= 0) return clawd.say('out of ice — the 氷屋 is down the street ←');
        S.box--; S.hopper = 6; audio.sfx('clunk', { x: SX.shaver }); clawd.say('loaded a block');
      }
      if (S.shaved >= 3) return clawd.say('counter\'s full — syrup next');
      return game.work('shaver', () => mini.dial({
        title: 'crank the shaver', hint: 'drag in circles · or mash space', progress: () => S.shaveProg,
        onTurn(f) {
          if (S.hopper <= 0 || S.shaved >= 3) return;
          S.shaveProg += f / 1.3; S.crankA += f * Math.PI * 2; S.cranking = .25; clawd.workAnim = 'crank';
          audio.sfx('grind', { gap: .05, x: SX.shaver });
          if (S.shaveProg >= 1) {
            finishShave(clawd);
            if (S.hopper <= 0 && S.box > 0) { S.box--; S.hopper = 6; audio.sfx('clunk', { x: SX.shaver }); }
            if (S.hopper <= 0 || S.shaved >= 3) mini.close(false);
          }
        },
      }));
    }
    case 'syrup': {
      const c = nextUnfilled();
      if (!c) return clawd.say(S.queue.length ? 'every order\'s covered ✦' : 'no orders yet');
      if (S.shaved <= 0) return clawd.say('shave some ice first ←');
      if (S.ready.length >= 4) return clawd.say('hand some out first →');
      if (G.locks.syrup && G.locks.syrup !== clawd) return clawd.say(`${G.locks.syrup.name} is pouring`);
      return game.work('syrup', () => (c.claimed = true, mini.pour({
        title: `<span style="color:${FLAV[c.flavor].css}">${FLAV[c.flavor].kana}</span> · ${FLAV[c.flavor].en}`, color: FLAV[c.flavor].css, band: [.6, .86],
        onFill(fl, holding) { S.pouring = holding ? { flavor: c.flavor, c } : null; clawd.workAnim = holding ? 'pour' : null; if (holding) audio.sfx('pour', { gap: .12 }); },
        onRelease(fl, q) { G.stats.quality.push(q); if (q === 1) sparkle(SX.shaved[0], CY + .6, CZ, 12); finishSyrup(clawd, c); },
        onClose(cancelled) { S.pouring = null; if (cancelled) c.claimed = false; },
      })));
    }
    case 'serve': {
      const c = frontCustomer(), r = readyFor(c);
      if (!c) return clawd.say('no one in line right now');
      if (!r) return clawd.say(`their ${FLAV[c.flavor].en} isn't ready ←`);
      if (G.locks.serve && G.locks.serve !== clawd) return clawd.say(`${G.locks.serve.name} has it`);
      clawd.faceOverride = SERVE_FACE; clawd.workAnim = 'hold';
      tween(.5, () => { }, () => { clawd.workAnim = null; clawd.faceOverride = null; });
      return serveCustomer(clawd, c, r);
    }
    case 'icebox':
      if (clawd.carry) return dropIce();
      return clawd.say(S.box ? `${S.box} block${S.box > 1 ? 's' : ''} in the box` : 'the box is empty — 氷屋 ←');
    case 'iceshop':
      if (clawd.carry) return clawd.say('got one → back to the stall');
      if (S.box >= 4) return clawd.say('the box is full');
      if (S.coins < PRICE.ice) return clawd.say(`ice is ¥${PRICE.ice}`);
      S.coins -= PRICE.ice; audio.sfx('coin', { x: X.ice }); clawd.setCarry(true); clawd.workAnim = 'pick';
      tween(.4, () => { }, () => { if (clawd.workAnim === 'pick') clawd.workAnim = null; });
      return clawd.say('two blocks → back to the stall');
    case 'goldfish':
      if (S.coins < PRICE.poi) { keeperSay('一回 300円 ✦'); return clawd.say(`¥${S.coins}… the stall will earn it`); }
      return enterTub();
    case 'masks': return openMasks();
  }
}
function dropIce() { clawd.setCarry(false); S.box = Math.min(4, S.box + 2); audio.sfx('clunk', { x: SX.box }); clawd.say('ice is in ✦'); credit(clawd); }

// ───────────── 金魚すくい ─────────────
let keeper = null, maskKeeper = null;
function keeperSay(t) { keeper && keeper.say(t, 2.4); }
function enterTub() {
  S.coins -= PRICE.poi; S.tries++;
  S.view = 'tub'; clawd.faceOverride = Math.PI * .9; clawd.workAnim = null;
  GF.start();
  const [p, l] = tubShot(); cam.shot(p, l, { fov: 40, k: 2.4 });
  UI.tub.classList.remove('hidden'); UI.tub.classList.remove('torn');
  keeperSay(pick(['はい、ポイ。 slide it in at an angle ✦', 'don\'t leave it in the water ✦', 'scoop near the surface ✦']));
  S.tipT = 6;
}
function exitTub() {
  if (S.view !== 'tub') return;
  S.view = 'street'; GF.stop(); UI.tub.classList.add('hidden');
  let k = GF.takeBowl();
  if (k.length) emit('sticker', 'kingyo');
  if (!k.length && !S.fish.length && !S.omake) { S.omake = true; k = ['wakin']; keeperSay('はい、おまけ ✦ (one for trying)'); }
  if (k.length) { S.fish.push(...k); setBag(); clawd.say(k.length > 1 ? `${k.length} goldfish ✦` : S.omake && k.length === 1 && S.fish.length === 1 ? 'a goldfish anyway ✦' : 'a goldfish ✦', 2.2); clawd.mood('happy', 2); }
  clawd.faceOverride = null;
}
function setBag() {
  if (P.bag) clawd.hand.remove(P.bag);
  const g = new THREE.Group(), n = Math.min(3, S.fish.length);
  const bag = new THREE.Mesh(new THREE.SphereGeometry(.17, 14, 10), new THREE.MeshBasicMaterial({ color: 0xcfeeff, transparent: true, opacity: .35, depthWrite: false })); bag.scale.set(1, 1.25, 1); bag.userData.noInk = true; g.add(bag);
  const water = new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 8, 0, Math.PI * 2, Math.PI * .35, Math.PI * .65), new THREE.MeshBasicMaterial({ color: 0x8fd0ff, transparent: true, opacity: .35, depthWrite: false })); water.userData.noInk = true; g.add(water);
  const tie = new THREE.Mesh(new THREE.CylinderGeometry(.03, .05, .1, 8), new THREE.MeshToonMaterial({ color: 0xd8343c })); tie.position.y = .22; g.add(tie);
  P.bagFish = [];
  for (let i = 0; i < n; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshToonMaterial({ color: S.fish[i] === 'demekin' ? 0x2a2830 : 0xff5a2a })); f.scale.set(1.8, .8, .9); g.add(f); P.bagFish.push({ m: f, a: i * 2.1 }); }
  g.position.set(0, -.36, .12); g.scale.setScalar(1.25);
  P.bag = g; clawd.hand.add(g);
}

// ───────────── お面 ─────────────
function openMasks() {
  S.view = 'masks'; clawd.faceOverride = Math.PI;
  UI.masks.querySelector('.mt-wallet').textContent = `¥${S.coins}`;
  UI.masks.querySelectorAll('button[data-id]').forEach(b => { b.classList.toggle('poor', S.coins < PRICE.mask); b.classList.toggle('on', S.mask === b.dataset.id); });
  UI.masks.classList.remove('hidden');
  maskKeeper && maskKeeper.say('いらっしゃい ✦ one for 600円', 2.2);
}
function closeMasks() { if (S.view !== 'masks') return; S.view = 'street'; UI.masks.classList.add('hidden'); clawd.faceOverride = null; }
function buyMask(id) {
  if (S.mask === id) return closeMasks();
  if (S.coins < PRICE.mask) { clawd.say(`¥${S.coins}… need ¥${PRICE.mask}`); audio.sfx('deny'); return; }
  S.coins -= PRICE.mask; audio.sfx('coin', { x: X.mask });
  wearMask(id);
  closeMasks();
  clawd.say('どう? ✦', 2); clawd.mood('happy', 2);
  const near = helpers.filter(h => Math.abs(h.x - clawd.x) < 6);
  if (near[0]) tween(.8, () => { }, () => near[0].say(id === 'clawd' ? 'a clawd… wearing a clawd? ✦' : 'にあう! ✦', 2));
}
function wearMask(id) {
  if (P.mask) clawd.inner.remove(P.mask);
  const m = maskMesh(id); m.position.set(.47, 1.06, .26); m.rotation.set(-.12, .62, -.3); m.scale.setScalar(.9);
  clawd.inner.add(m); P.mask = m; S.mask = id;
  sparkle(clawd.x + .5, 1.3, clawd.z, 14);
}

// ───────────── camera: follow Clawd down the street ─────────────
function streetCam(dt) {
  const asp = innerWidth / innerHeight, t = Math.tan(THREE.MathUtils.degToRad(20));
  const half = asp >= 1 ? 8.4 : 3.6, dist = clamp(half / (t * asp), 9, 22), hw = dist * t * asp;
  const lead = clamp(clawd.targetX - clawd.x, -2.5, 2.5);
  S.camX = lerp(S.camX, clawd.x + lead * .8 + (Math.abs(clawd.x - X.stall - 2) < 5 ? 1.5 : 0), damp(2.2, dt));
  const x = clamp(S.camX, -30 + hw - .6, 30 - hw + .6);
  _pos.set(x, 1.2 + dist * .1, .6 + dist); _look.set(x, 1.85, -1.4);
  cam.shot(_pos, _look, { fov: 40, k: 3, parallax: true });
}

// ───────────── UI ─────────────
function buildUI() {
  CSS = document.createElement('style');
  CSS.textContent = `
    .mt-ord{display:inline-flex;align-items:center;gap:5px;font-weight:600}
    .mt-ord i{width:9px;height:9px;border-radius:50%;display:inline-block}
    .mt-pat{display:block;height:3px;background:rgba(255,255,255,.14);border-radius:2px;margin-top:3px;overflow:hidden}
    .mt-pat i{display:block;height:100%;background:var(--ok);transition:width .2s}
    .mt-pat.low i{background:#ff8a7a}
    .mt-float{position:fixed;z-index:5;transform:translate(-50%,-50%);font:600 13px var(--mono);color:#f7d488;text-shadow:0 1px 4px rgba(0,0,0,.6);pointer-events:none;animation:mt-up 1.2s ease-out forwards}
    @keyframes mt-up{from{opacity:0;transform:translate(-50%,-30%)}15%{opacity:1}to{opacity:0;transform:translate(-50%,-180%)}}
    #mt-card{position:fixed;inset:0;z-index:7;display:grid;place-items:center;pointer-events:none;opacity:0;transition:opacity 1s}
    #mt-card.on{opacity:1}
    #mt-card div{text-align:center;color:#fff;text-shadow:0 2px 18px rgba(30,10,40,.7)}
    #mt-card b{display:block;font:800 clamp(40px,8vw,76px) 'M PLUS Rounded 1c',sans-serif;letter-spacing:.06em}
    #mt-card span{font:13px var(--mono);opacity:.9;letter-spacing:.12em}
    .mt-panel{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(max(14px,env(safe-area-inset-bottom)) + 96px);z-index:6;padding:10px 14px;font-size:12px;color:var(--ink);display:flex;align-items:center;gap:12px;touch-action:manipulation}
    .mt-panel button{font:12px var(--mono);color:var(--ink);background:#2c2733;border:1px solid var(--line);border-radius:999px;padding:7px 12px;cursor:pointer}
    .mt-panel button.go{background:#d97757;color:#fff;border-color:transparent}
    #mt-tub .mt-paper{width:84px;height:8px;border-radius:4px;background:#2c2733;overflow:hidden;display:inline-block;vertical-align:middle}
    #mt-tub .mt-paper i{display:block;height:100%;background:#f4efe2;transition:width .15s}
    #mt-tub .mt-again{display:none}
    #mt-tub.torn .mt-again{display:inline-block}
    #mt-masks{flex-direction:column;align-items:stretch;gap:8px;padding:12px 14px}
    #mt-masks .mt-row{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
    #mt-masks button[data-id]{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 4px;border-radius:12px;min-width:62px}
    #mt-masks button[data-id] img{width:52px;height:52px}
    #mt-masks button.poor{opacity:.45}
    #mt-masks button.on{border-color:#d97757}
    #mt-masks .mt-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
    .mt-panel b{white-space:nowrap}
    @media (max-width:700px){.mt-panel{bottom:calc(max(14px,env(safe-area-inset-bottom)) + 128px);width:max-content;max-width:calc(100vw - 20px);flex-wrap:wrap;justify-content:center;gap:8px 12px}#mt-masks .mt-row{grid-template-columns:repeat(3,1fr)}}`;
  document.head.appendChild(CSS);
  const el = (id, cls, html) => { const d = document.createElement('div'); d.id = id; d.className = cls; d.innerHTML = html; document.body.appendChild(d); d.addEventListener('pointerdown', e => e.stopPropagation()); d.addEventListener('pointerup', e => e.stopPropagation()); return d; };
  UI = {};
  UI.card = el('mt-card', '', '<div><b>土曜日 · 夏祭り</b><span>saturday · the summer festival</span></div>');
  UI.tub = el('mt-tub', 'mt-panel panel hidden', `<b>金魚すくい</b><span>paper <span class="mt-paper"><i></i></span></span><span class="mt-caught">caught 0</span><button class="go mt-again">another poi · ¥${PRICE.poi}</button><button class="mt-done">↩ done</button>`);
  UI.tub.querySelector('.mt-done').onclick = e => { e.stopPropagation(); exitTub(); };
  UI.tub.querySelector('.mt-again').onclick = e => {
    e.stopPropagation();
    if (S.coins < PRICE.poi) { keeperSay(`一回 ${PRICE.poi}円…`); return; }
    S.coins -= PRICE.poi; S.tries++; UI.tub.classList.remove('torn'); GF.start(); keeperSay(pick(['もう一回! ✦', 'gently this time ✦']));
  };
  UI.masks = el('mt-masks', 'mt-panel panel hidden', `<div class="mt-head"><b>お面 · ¥${PRICE.mask}</b><span>you have <b class="mt-wallet"></b></span><button class="mt-close">↩</button></div><div class="mt-row">${MASKS.map(m => `<button data-id="${m.id}"><img src="${maskThumb(m.id)}" alt=""><span>${esc(m.jp)}</span></button>`).join('')}</div>`);
  UI.masks.querySelector('.mt-close').onclick = e => { e.stopPropagation(); closeMasks(); };
  UI.masks.querySelectorAll('button[data-id]').forEach(b => b.onclick = e => { e.stopPropagation(); buyMask(b.dataset.id); });
}

function wallet() { const s = $('#clock .s'); if (!s) return; const t = `🎆 fireworks at 8:30 · ¥${S.coins.toLocaleString()}`; if (s.textContent !== t) s.textContent = t; }

// ───────────── the chapter ─────────────
export default {
  id: 'matsuri', day: 6, title: 'Natsu-matsuri', jp: '夏祭り', short: '夏祭り',
  weather: 'はれ', blurb: 'The summer festival. Run the kakigōri stall, then go and enjoy it.',
  jpPreview: 'きょうは なつまつり。',
  prompt: 'run the kakigōri stall', goal: 'run the stall · enjoy the festival',
  sky: 'clear', mood: 'festival', dayLen: 400, phase: [.78, 1], autoNight: false, bounds: [-30, 30],
  // the HUD reads the clock off the whole 0..1 sky phase; this puts .78 at 6:30 and 1 at 8:30
  clock: [11 * 60 + 25, 20 * 60 + 30], clockNote: '🎆 fireworks at 8:30',
  helpers: [
    { spec: ['serve'], specName: 'serving' },
    { spec: ['syrup'], specName: 'syrups' },
    { spec: ['shave', 'fetch'], specName: 'ice' },
  ],

  async introRun(game) {
    const skip = G.dev.has('skip');
    S.view = 'intro';
    helpers.forEach((h, i) => { h.g.visible = true; h.x = h.targetX = -12 - i * .9; h.mood('happy', 1); });
    clawd.x = clawd.targetX = -11; clawd.faceOverride = null;
    if (skip) {
      [clawd, ...helpers].forEach((c, i) => { c.x = c.targetX = [1.6, .6, -.4, -1.4][i]; });
      S.camX = clawd.x; S.view = 'street'; streetCam(1); cam.pos.copy(cam.tpos); cam.look.copy(cam.tlook);
      return;
    }
    cam.shot(new V3(-9, 3.4, 13), new V3(-6, 2.4, -2), { cut: true, fov: 42, drift: .3 });
    UI.card.classList.add('on'); audio.sfx('toast');
    await sleep(1.2);
    game.gather([[clawd, 1.6], [helpers[0], .6], [helpers[1], -.4], [helpers[2], -1.4]], { speed: 2.4, timeout: 9 });
    cam.shot(new V3(0, 3.0, 12.5), new V3(0, 2.1, -1.4), { k: .45, fov: 42, drift: .3 });
    await sleep(3.2);
    UI.card.classList.remove('on');
    await until(() => clawd.arrived(), 5);
    clawd.faceOverride = .4; clawd.say('our stall ✦', 2); clawd.mood('happy', 2); helpers.forEach(h => h.hop(.5));
    await sleep(1.4);
    helpers[2].say('ice is my thing ✦', 1.8);
    await sleep(1.4);
    clawd.faceOverride = null;
    S.camX = clawd.x; S.view = 'street';
  },

  setup(root, game) {
    GAME = game;
    game.setScene({ balcony: false, backdrop: false, canopy: false });
    S = {
      t: 0, view: 'intro', camX: 0, coins: 500, earned: 0, sold: 0, lost: 0, tries: 0,
      box: 4, hopper: 6, shaveProg: 0, crankA: 0, cranking: 0, shaved: 0, ready: [], pouring: null,
      queue: [], spawnT: 2.5, chipT: 0, lastRole: {}, fish: [], omake: false, mask: null, kid: null, closed: false, tipT: 0,
      brk: null, breakDone: false, breakTaken: false, breakCut: false, rushSaid: false,
    };
    const street = buildStreet(root, sky.tier);
    P = buildStall(root); P.street = street;
    buildMaskBoard(root);
    GF = buildGoldfish(root, { keeperSay: t => keeperSay(t) });
    GF.reset();
    GF.onTorn = () => UI && UI.tub.classList.add('torn');
    // the people of the town
    crowd.forEach(f => f.dispose()); crowd.length = 0;
    for (let i = 0; i < 16; i++) { const f = new Folk(root); crowd.push(f); if (i < 10) stroll(f, { x: rand(-29, 29) }); }
    keeper = new Folk(root); keeper.reset({ species: 'tanuki' }); keeper.x = keeper.tx = X.gold - .4; keeper.z = keeper.tz = TUB.z - .95; keeper.face0 = 0; keeper.g.visible = true; keeper.role = 'keeper'; crowd.push(keeper);
    maskKeeper = new Folk(root); maskKeeper.reset({ species: 'gramps' }); maskKeeper.x = maskKeeper.tx = X.mask + 1.3; maskKeeper.z = maskKeeper.tz = FRONT - .95; maskKeeper.face0 = 0; maskKeeper.g.visible = true; maskKeeper.role = 'keeper'; crowd.push(maskKeeper);
    for (const [x, sp] of [[-6, 'dog'], [-16, 'rabbit'], [X.ice - .3, 'cat'], [16.2, 'cat'], [20.4, 'dog']]) { const v = new Folk(root); v.reset({ species: sp }); v.x = v.tx = x + .4; v.z = v.tz = FRONT - 1.0; v.face0 = 0; v.g.visible = true; v.role = 'keeper'; crowd.push(v); }
    lightHome = sky.lights.lanterns.map(l => l.position.clone());
    sky.lanternScale = 1.25;
    buildUI();
    audio.setAmbience({ festival: .2 });
    audio.loop('crowd', .5);
  },

  start(game) {
    tween(10.5, () => { }, () => G.mode === 'play' && hud.toast('the stall runs while you\'re away ✦ staff it, then go and enjoy the festival', { dur: 4.2 }));
  },

  stations: () => ({
    shaver: { name: 'ice shaver', spot: SPOT.shave, job: 'shave', hit: [1.0, 1.5, 1.1, SX.shaver, CY + .55, CZ], ring: [SX.shaver + .3, FRONT + .5, 1], keywords: ['shave', 'shaver', 'crank', 'snow'],
      tip: () => `ice shaver · ${S.hopper ? `${S.hopper} cups left in the block` : 'empty'} · ${S.shaved}/3 shaved` },
    syrup: { name: 'syrups', spot: SPOT.syrup, job: 'syrup', hit: [1.1, 1.0, .9, X.stall + .92, CY + .3, CZ - .1], ring: [X.stall + .92, FRONT + .5, 1], keywords: ['syrup', 'syrups', 'pour', 'flavor'],
      tip: () => { const c = nextUnfilled(); return `syrups · ${c ? `next: ${FLAV[c.flavor].en}` : 'no orders waiting'}`; } },
    serve: { name: 'serving window', spot: SPOT.serve, job: 'serve', hit: [1.5, 1.0, 1.0, X.stall + 2.4, CY + .3, CZ], ring: [X.stall + 2.9, FRONT + .5, 1], keywords: ['serve', 'serving', 'hand', 'customers', 'sell', 'window'],
      tip: () => `serving · ${S.queue.length} in line · ${S.ready.length} ready` },
    icebox: { name: 'ice box', spot: SPOT.box, job: 'fetch', hit: [1.0, 1.1, 1.0, SX.box, CY + .3, CZ], ring: [SX.box, FRONT + .5, .9], keywords: ['fetch', 'block', 'box', 'buy'],
      tip: () => `ice box · ${S.box} block${S.box === 1 ? '' : 's'}${S.box < 4 ? ` · send a helper for more (¥${PRICE.ice})` : ''}` },
    iceshop: { name: '氷屋 ice shop', spot: X.ice + 1.5, job: 'fetch', hit: [3.4, 2.6, 1.8, X.ice, 1.3, FRONT - .9], ring: [X.ice + .8, FRONT + .6, 1.2], keywords: ['fetch', 'shop', 'buy', 'block'],
      tip: () => `氷屋 · ice blocks ¥${PRICE.ice} for two` },
    goldfish: { name: '金魚すくい', spot: X.gold + 2.25, job: 'gold', hitObj: () => GF.hit, ring: [X.gold + 1.2, FRONT + .6, 1.4],
      tip: () => `金魚すくい goldfish scooping · ¥${PRICE.poi} a try` },
    masks: { name: 'お面', spot: X.mask, job: 'masks', hit: [3.6, 2.4, 1.4, X.mask, 1.4, FRONT - 1.1], ring: [X.mask, FRONT + .6, 1.2],
      tip: () => `お面 masks · ¥${PRICE.mask}` },
  }),
  jobs,
  interact,

  todo() {
    const who = (j, lockKey) => { const w = helpers.filter(h => h.job === j).map(h => h.short); if (G.locks[lockKey] === clawd) w.unshift('you'); return w.length ? w : ['<i style="color:#ff9a8a">nobody</i>']; };
    const fishDots = S.fish.map(k => `<i style="color:${k === 'demekin' ? '#9a98a8' : '#ff7a4a'}">●</i>`).join('');
    return [
      { label: 'shave ice', done: false, detail: `❄${S.box + (S.hopper ? 1 : 0)}`, workers: who('shave', 'shaver'), blocked: S.box <= 0 && S.hopper <= 0 },
      { label: 'pour syrup', done: false, workers: who('syrup', 'syrup') },
      { label: 'serve', done: false, detail: `line ${S.queue.length}`, workers: who('serve', 'serve') },
      { label: 'sell 20 cups', done: S.sold >= 20, detail: `${S.sold}${S.lost ? ` · <i style="color:#f7d488">${S.lost} gave up</i>` : ''}` },
      { label: 'scoop a goldfish', done: S.fish.length > 0, detail: fishDots },
      { label: 'get a mask', done: !!S.mask, detail: S.mask ? MASKS.find(m => m.id === S.mask).jp : '' },
      { label: 'fireworks · 8:30', done: false, blocked: true },
    ].map(r => ({ ...r, workers: r.workers }));
  },
  hint() {
    if (S.view === 'tub') return GF.torn ? 'the paper tore · another poi, or ↩ done' : 'press to dip the poi · slide under a fish · let go to lift';
    if (S.view === 'masks') return 'pick a mask · ¥600';
    if (clawd.carry) return 'carrying ice → the ice box at the stall';
    const staffed = ['shave', 'syrup', 'serve'].map(j => helpers.some(h => h.job === j));
    if (G.stats.deleg === 0 && G.t < 40) return 'pick a helper, then a stall job (shaver · syrups · window) · the stall runs while you\'re away';
    if (S.box <= 0 && S.hopper <= 0) return 'out of ice! send a helper to the 氷屋 ← (or fetch it yourself)';
    const missing = ['shaving', 'syrup', 'serving'].filter((_, i) => !staffed[i]);
    if (missing.length && S.queue.length && Math.abs(clawd.x - X.stall - 1) > 5) return `nobody's on ${missing.join(' or ')} — the line is stuck`;
    if (!missing.length && Math.abs(clawd.x - X.stall - 1) < 5 && G.t > 20) return `the stall is running ✦ go and enjoy it · 金魚すくい ← · お面 →`;
    if (S.box <= 1 && S.hopper <= 3) return 'the ice is running low · a helper can fetch more from the 氷屋 ←';
    return '';
  },

  update(dt, game) {
    if (!S) return;
    updateLanterns(P.street.lanterns, world.wind || .5, S.view === 'tub');
    const cx = cam.pos.x, off = sky.lights.lanterns.length > 1 ? [-6.5, 0, 6.5] : [0];
    sky.lights.lanterns.forEach((l, i) => l.position.set(cx + off[i], 4.3, 1.7));
    S.cranking = Math.max(0, S.cranking - dt);
    if (clawd.workAnim === 'crank' && S.cranking <= 0 && G.mini?.kind === 'dial') clawd.workAnim = null;
    syncStall(P, S, G.time);
    if (S.cranking > 0 && Math.random() < dt * 30) P.snow.emit(SX.shaver + rand(-.08, .08), CY + .78, CZ + .08, rand(-.1, .1), -.6, rand(-.1, .1), rand(.3, .6));
    GF.update(dt);
    if (P.bagFish) for (const b of P.bagFish) { b.a += dt * 1.8; b.m.position.set(Math.cos(b.a) * .06, -.03, Math.sin(b.a) * .06); b.m.rotation.y = -b.a - Math.PI / 2; }
    if (G.mode === 'play' || G.mode === 'ending' || G.mode === 'intro') updateCrowd(dt);
    if (G.mode !== 'play') return;
    S.t += dt;
    if (S.view === 'street') streetCam(dt);
    updateBreak(dt);
    // walking away from the tub or the masks closes them
    if (S.view === 'tub') {
      const [tp, tl] = tubShot(); cam.shot(tp, tl, { fov: 40, k: 2.4 });
      UI.tub.querySelector('.mt-paper i').style.width = Math.max(0, GF.strength) * 100 + '%';
      UI.tub.querySelector('.mt-caught').textContent = `caught ${GF.roundCaught.length}`;
      S.tipT -= dt; if (S.tipT < 0 && !GF.torn) { S.tipT = rand(7, 10); keeperSay(pick(['ゆっくり… slowly ✦', 'the black ones are heavy ✦', 'aim for the small ones ✦', 'lift near the surface ✦'])); }
      if (clawd.pending || Math.abs(clawd.x - (X.gold + 2.25)) > 1) exitTub();
    }
    if (S.view === 'masks' && (clawd.pending || Math.abs(clawd.x - X.mask) > 1.2)) closeMasks();
    wallet();
    if (G.phase >= 1 - 1e-4 && !S.closed) {
      const fishOk = S.fish.length > 0 && !(S.omake && S.fish.length === 1);
      const stamp = S.sold >= 25 && S.lost <= 2 && fishOk && S.mask ? 'perfect' : S.sold >= 10 || S.fish.length ? 'good' : 'tried';
      game.finish({ complete: true, perfect: stamp === 'perfect', stamp });
    }
  },

  debug: () => ({ S, P, GF, crowd }),
  pointer(type, e, ray) { return S?.view === 'tub' && G.mode === 'play' ? GF.pointer(type, e, ray) : false; },
  key(e) {
    if (e.key === 'Escape' && S?.view === 'tub') { exitTub(); return true; }
    if (e.key === 'Escape' && S?.view === 'masks') { closeMasks(); return true; }
    return false;
  },

  async ending(result, game) {
    exitTub(); closeMasks();
    if (S.brk) { S.brk.h.faceOverride = null; S.brk = null; }
    S.closed = true;
    if (result.quit) { clawd.say('see you next summer ✦'); await sleep(1); return; }
    hud.toast('ドーン — the fireworks are starting over the river!', { dur: 3 });
    S.queue.slice().forEach(c => leaveLine(c, { say: pick(['はなびだ!', 'the fireworks!']) }));
    term.log(`🎆 stall closed · ${S.sold} cups sold · ¥${S.earned}`, '#f2c14e');
    await sleep(1.2);
    // cut to the embankment
    const bx = X.bank;
    [[clawd, bx + .3, .62], [helpers[0], bx - .6, .5], [helpers[1], bx + 1.25, .58], [helpers[2], bx - 1.45, .7]].forEach(([c, x, z]) => { c.x = c.targetX = x; c.z = z; c.faceOverride = Math.PI; c.setCarry(false); });
    crowd.filter(f => f.role !== 'keeper').slice(0, 7).forEach((f, i) => { f.reset(); f.g.visible = true; f.role = 'watch'; f.x = f.tx = bx - 3.5 + i * 1.6 + rand(-.3, .3); f.z = f.tz = -1.4 - (i % 3) * .7; f.face0 = Math.PI; });
    // only the watchers are out on the bank; everyone else is somewhere in the crowd
    crowd.forEach(f => { if (f.role !== 'watch' && f.role !== 'keeper') { f.g.visible = false; f.role = 'gone'; } });
    cam.shot(new V3(bx + .4, 2.0, 8.4), new V3(bx + 6, 7.0, -40), { cut: true, fov: 46, drift: .4 });
    sky.lanternScale = .8;
    await sleep(1.6);
    let fwT = 0, last = G.time, clawdDone = false;
    await new Promise(r => tween(15, e => {
      fwT -= G.time - last; last = G.time;
      if (!clawdDone && e > .42) {
        clawdDone = true; firework({ type: 'clawd', x: bx + 10, y: 24, z: -85, size: 1.1 });
        tween(2.0, () => { }, () => { game.snap(); helpers.forEach((h, i) => tween(.2 * i, () => { }, () => { h.say('!!', 1.5); h.mood('wow', 1.5); })); });
        fwT = 3.2;
      }
      // nothing else goes up just before the one shaped like Clawd, so it bursts alone
      if (fwT <= 0 && (clawdDone || e < .3)) { fwT = e > .82 ? rand(.2, .4) : rand(.55, 1.1); firework({ x: bx + rand(-28, 40), z: rand(-80, -95) }); if (Math.random() < .3) tween(.2, () => { }, () => firework({ x: bx + rand(-28, 40) })); }
    }, r));
    crew.forEach(c => { c.faceOverride = 0; c.mood('happy', 99); c.hop(.6); c.blush = 1; });
    cam.shot(new V3(bx + .2, 1.8, 6.8), new V3(bx + .2, 1.2, 0), { k: 1.2 });
    for (let i = 0; i < 3; i++) tween(i * .6, () => { }, () => firework({ x: bx + rand(-20, 20), y: rand(12, 20) }));
    await sleep(3.4);
  },

  diary(result) {
    const by = G.stats.byHelper.slice(0, 3), topI = by.indexOf(Math.max(...by)), top = helpers[topI];
    const real = S.fish.length - (S.omake ? 1 : 0);
    // the page holds about five lines: the evening's stories first, then whatever fits
    const middle = [
      S.kid?.phase === 'served' && (S.kid.who === clawd ? 'A little kid dropped theirs, so I made them a new one. For free.' : `A little kid dropped theirs, and ${S.kid.who.name} made them a new one, for free.`),
      real > 1 ? `I scooped ${real} goldfish!` : real === 1 ? `I scooped ${FISH_NAME[S.fish.find((k, i) => !(S.omake && i === 0)) || 'wakin']}.` : S.omake && 'The paper tore every time, but the goldfish man gave me one anyway.',
      S.breakTaken ? 'Helper 2 took a little break to look at the goldfish. It said the black one is its favorite.' : S.breakCut && 'Helper 2 wanted a little break, but I called it back to work. Sorry, helper 2.',
      S.mask && (S.mask === 'clawd' ? 'I bought a mask that looks like me and wore it on the side of my head.' : `I bought a ${MASKS.find(m => m.id === S.mask).name} mask and wore it on the side of my head.`),
      S.lost && `${S.lost} ${S.lost === 1 ? 'person' : 'people'} got tired of waiting. Next time I will set up the helpers better.`,
      by[topI] > 0 && `${top.name[0].toUpperCase() + top.name.slice(1)} worked the hardest. ${topI === 2 ? 'Ice really is its thing.' : 'I should say thank you.'}`,
    ].filter(Boolean).slice(0, 3);
    const lines = [`Today was the summer festival. We ran a kakigōri stall and sold ${S.sold} cup${S.sold === 1 ? '' : 's'} (¥${S.earned.toLocaleString()}).`, ...middle,
      'Then fireworks over the river, and one of them looked exactly like me!!'];
    const jp = 'きょうは なつまつりで かきごおりやさんを しました。' + (S.fish.length ? 'きんぎょを すくいました。' : '') + 'はなびが きれいでした。';
    return { jp, lines };
  },
  stats: () => `${S.sold} cups · ¥${S.earned.toLocaleString()} · ${S.lost} gave up · ${S.fish.length} goldfish${S.mask ? ' · a mask' : ''}`,

  teardown() {
    if (UI) { Object.values(UI).forEach(d => d.remove()); UI = null; }
    CSS?.remove(); CSS = null;
    if (P?.mask) clawd.inner.remove(P.mask);
    if (P?.bag) clawd.hand.remove(P.bag);
    crew.forEach(c => c.setCarry(false));
    crowd.forEach(f => f.dispose()); crowd.length = 0; keeper = maskKeeper = null;
    sky.lights.lanterns.forEach((l, i) => lightHome && l.position.copy(lightHome[i]));
    audio.setAmbience({ festival: null });
    S = null; P = null; GF = null;
  },

  ls: () => ['stall/{shaver,syrups/{ichigo,melon,blue_hawaii},cups,coin_tray}  ice_box  →  金魚すくい  お面  氷屋  river/'],
  review: () => !S ? 'nothing to review' : `${S.sold} shipped · ${S.lost} dropped · ${S.queue.length} in the queue${S.lost > 3 ? ' · suggestion: staff every role' : ' · LGTM ✦'}`,
  commands: {
    'cat menu.txt': () => ['# かき氷 · ¥300', '- いちご strawberry', '- メロン melon', '- ハワイ blue hawaii', '(ice from the 氷屋 down the street, ¥200 for two blocks)'],
  },
};

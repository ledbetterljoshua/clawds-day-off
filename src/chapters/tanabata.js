// Day 4 — Tanabata (七夕). Stand up a bamboo branch, make paper decorations at the craft
// table, write a wish on a tanzaku strip. At night the helpers write theirs, and Orihime and
// Hikoboshi meet across the Milky Way.
import { THREE, V3, mesh, group, box, toon, canvasTex, MAT, dotTex } from '../core/gfx.js';
import { G, emit } from '../core/state.js';
import { rand, clamp, lerp, ease, easeOut, easeOutBack, smooth, pick } from '../core/util.js';
import { tween, sleep, until } from '../core/tween.js';
import { clawd, helpers, crew } from '../core/crab.js';
import { lock, unlock, lockedBy, credit } from '../core/agents.js';
import { mini } from '../core/minigames.js';
import { audio } from '../core/audio.js';
import { term } from '../core/terminal.js';
import { cam } from '../core/camera.js';
import { sparkle, puff } from '../core/fx.js';
import { world } from '../core/world.js';
import { sky } from '../core/sky.js';
import { save } from '../core/save.js';
import { held } from '../core/input.js';
import { buildBamboo, setBundle, buildCraft, buildBasket, buildDesk, MAKERS, makeTanzaku, flutterStreamer, GOSHIKI } from './tanabata/props.js';
import { injectCSS, removeUI, openWish, wishOpen, showCard, hideCard, origami, ARROWS } from './tanabata/ui.js';

const BX = .95, BZ = -.72;                   // the bamboo's bucket
const LYING = { z: -Math.PI / 2 + .035, y: .16 }, STAND = { z: .05, y: 0 };
const SPOT = { fold: -3.6, cut: -1.55, stream: .15, bamboo: 2.05, wish: 5.85 };
const FROM = { fold: new V3(-4.4, .5, -.38), cut: new V3(-2.5, .5, -.35), stream: new V3(-.65, 1.1, -.62), wish: new V3(4.75, .4, -.22) };
const QUEUE = { fold: ['crane', 'crane', 'lantern', 'crane', 'lantern'], cut: ['chain', 'net', 'chain', 'net', 'chain'], stream: ['streamer', 'streamer', 'streamer'] };
const DUR = { crane: 3.4, lantern: 3.0, chain: 3.6, net: 3.0, streamer: 4.6 };
const NAME = { crane: 'string of cranes', lantern: 'lantern', chain: 'paper chain', net: 'net', streamer: 'streamer' };
const TOTAL = Object.values(QUEUE).flat().length;
const PAPER = ['#d8343c', '#f08aa8', '#e8b730', '#3a9a6e', '#3d7fd6', '#7b4fa0', '#ef8a3c'];
const HELPER_WISH = [
  { jp: 'いちごを ほしの かたちに きれますように', en: 'to cut a strawberry into a perfect star', color: GOSHIKI[1] },
  { jp: 'ミントの においの あめが ふりますように', en: 'for a rain that smells like mint', color: GOSHIKI[0] },
  { jp: 'あしたも また よばれますように', en: 'to be spawned again tomorrow', color: GOSHIKI[3] },
];

let S = null;   // the evening
let P = null;   // props
const _v = new V3();
const DECO = 1.3;      // decorations read better a touch larger than life from the play camera

const madeAll = () => Object.keys(QUEUE).every(k => S.made[k] >= QUEUE[k].length);
const ready = () => !!S && S.bambooUp && !!S.wish && S.items.filter(i => i.state === 'hung').length >= TOTAL + 1;
function missing() {
  if (!S.bambooUp) return 'the bamboo is still lying down';
  const left = Object.keys(QUEUE).reduce((a, k) => a + QUEUE[k].length - S.made[k], 0);
  if (left) return `${left} more decoration${left === 1 ? '' : 's'} to make`;
  if (!S.wish) return 'my wish isn\'t written yet';
  return 'almost — a few things are still on the way up';
}

// ───────────── decorations: make, carry, hang ─────────────
function pickAnchor(kind) {
  const free = P.bamboo.anchors.filter(a => !a.used);
  const minT = { streamer: .6, chain: .48, net: .4 }[kind] ?? 0;
  let pool = free.filter(a => a.t >= minT); if (!pool.length) pool = free;
  const usedL = P.bamboo.anchors.filter(a => a.used && a.side < 0).length, usedR = P.bamboo.anchors.filter(a => a.used && a.side > 0).length;
  const prefer = usedL <= usedR ? -1 : 1, long = kind === 'streamer' || kind === 'chain' || kind === 'net';
  pool.sort((a, b) => ((b.side === prefer) - (a.side === prefer)) * 2 + (long ? (b.f - a.f) : (a.f - b.f)) + rand(-.4, .4));
  let a = pool[0];
  if (a) a.used = true;
  else a = pick(P.bamboo.anchors);      // more decorations than branch tips: share one
  return a;
}
function addItem(kind, obj) {
  P.root.add(obj);
  const it = { kind, obj, anchor: pickAnchor(kind), state: 'made', sw: { ax: 0, az: 0, vx: 0, vz: 0, ph: rand(0, 6.28) } };
  S.items.push(it);
  return it;
}
function makeItem(st, kind, who) {
  S.made[st]++;
  const obj = MAKERS[kind]();
  const it = addItem(kind, obj);
  S.log.push({ who, kind });
  credit(who);
  term.log(`${who.name} ▸ made a ${NAME[kind]}`, '#f2a7b5');
  audio.sfx('done');
  sparkle(FROM[st].x, FROM[st].y + .2, FROM[st].z, 10, [1, .8, .9]);
  if (S.bambooUp) hang(it, FROM[st]); else toBasket(it, FROM[st]);
}
function toBasket(it, from) {
  const o = it.obj, slot = S.items.filter(i => i.state === 'basket' || i.state === 'tobasket').length;
  const to = new V3(1.95 + Math.cos(slot * 2.3) * .09, .13 + Math.floor(slot / 5) * .04, -.3 + Math.sin(slot * 2.3) * .09);
  it.state = 'tobasket'; o.position.copy(from);
  tween(.9, e => {
    o.position.lerpVectors(from, to, ease(e)); o.position.y += Math.sin(e * Math.PI) * .9;
    o.rotation.set(e * Math.PI / 2, e * 3, 0); o.scale.setScalar(lerp(1, .5, e));
  }, () => { it.state = 'basket'; audio.sfx('paper'); });
}
function hang(it, from, delay = 0) {
  if (!it.anchor) it.anchor = pickAnchor(it.kind);
  const o = it.obj, a = it.anchor.obj;
  it.state = 'flying';
  tween(delay, () => {}, () => {
    const f = from.clone(), s0 = o.scale.x, r0x = o.rotation.x;
    audio.sfx('whoosh');
    tween(1.15, e => {
      a.getWorldPosition(_v);
      const k = ease(e);
      o.position.lerpVectors(f, _v, k); o.position.y += Math.sin(e * Math.PI) * 1.15;
      o.rotation.set(lerp(r0x, 0, k), (1 - k) * 5, 0); o.scale.setScalar(lerp(s0, DECO, k));
    }, () => {
      it.state = 'hung'; it.sw.vz += rand(-2.4, 2.4); it.sw.vx += rand(-1, 1);
      a.getWorldPosition(_v); sparkle(_v.x, _v.y - .25, _v.z, 8, [1, .92, .7]);
      audio.sfx('tape');
      checkReady();
    });
  });
}

function bambooUp(who) {
  if (S.bambooUp) return;
  S.bambooUp = true; S.raise = 1;
  credit(who);
  term.log(`${who.name} ▸ stood the bamboo up · 笹`, '#7bd88f');
  P.bamboo.setHit(true);
  audio.sfx('whoosh'); audio.sfx('paper');
  tween(.5, e => P.stool.scale.setScalar(1 - e), () => P.stool.visible = false);
  // untie it: the branches swing open and the leaves spring out
  tween(1.3, e => { S.bundle = 1 - easeOutBack(e); });
  const top = P.bamboo.curve.getPointAt(.75);
  puff(BX + top.x, .4 + top.y, BZ, 14, [.62, .85, .5]);
  helpers.forEach(h => h.g.visible && h.hop(.5));
  S.items.filter(i => i.state === 'basket' || i.state === 'tobasket').forEach((it, n) => hang(it, it.obj.position.clone(), .7 + n * .32));
  checkReady();
}

function checkReady() {
  if (!S || S.announced || G.mode !== 'play' || !ready()) return;
  S.announced = true;
  term.log('✓ everything is on the bamboo', '#7bd88f');
  clawd.say('it looks like a festival ✦ click the bamboo', 5); clawd.mood('happy', 3);
  helpers.forEach(h => { h.hop(1); h.mood('happy', 2); });
  sparkle(BX + .2, 3.6, BZ, 26);
}

// ───────────── the wish ─────────────
function hangWish(text, color, from) {
  const it = addItem('tanzaku', makeTanzaku(text, color));
  if (S.bambooUp) hang(it, from); else toBasket(it, from);
  return it;
}
async function writePlayerWish({ ending = false } = {}) {
  if (S.wish || wishOpen()) return;
  lock('wish', clawd);
  clawd.workAnim = 'write'; clawd.action = { kind: 'player', verb: 'writing a wish' }; clawd.faceOverride = -.7;
  const r = await openWish({ ending });
  if (!S) return;
  unlock('wish', clawd);
  clawd.workAnim = null; clawd.action = null; clawd.faceOverride = null;
  if (!r) { clawd.say('later, then', 1.6); return; }
  setWish(r.text, r.color);
}
function setWish(text, color) {
  S.wish = { text, color };
  try { save.data.wishes.push({ day: 4, text, color: color.en, at: Date.now() }); save.write(); } catch (e) { console.warn(e); }
  emit('sticker', 'wish');
  term.log(`$ echo "${text}" > tanzaku.txt`, '#e8e2da');
  hangWish(text, color, FROM.wish);
  credit(clawd); G.stats.quality.push(1);
  clawd.mood('happy', 1.6); clawd.say('✦', 1.2);
}
function terminalWish(text) {
  text = (text || '').trim().replace(/^["']|["']$/g, '').slice(0, 40);
  if (!S || G.mode !== 'play') return { t: 'tanzaku are for tanabata evening', c: '#f7d488' };
  if (S.wish) return { t: 'your wish is already on the bamboo ✓ (one a year)', c: '#a79e94' };
  if (!text) return 'usage: wish <your wish>';
  setWish(text, GOSHIKI[Math.abs([...text].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7)) % 5]);
  return { t: `✓ hung on the bamboo: “${text}”`, c: '#7bd88f' };
}

// ───────────── helper jobs ─────────────
function craftJob(st, label, verbing, anim) {
  return {
    label,
    done: () => S.made[st] >= QUEUE[st].length,
    plan(h, sp) {
      if (lockedBy(st, h)) return { x: SPOT[st] + .75, wait: '⋯ waiting for the table' };
      return {
        x: SPOT[st], start: () => {
          const kind = QUEUE[st][S.made[st]];
          if (!kind || !lock(st, h)) return null;
          S.wip[st] = { kind, p: 0, who: h, color: pick(PAPER) };
          const dur = DUR[kind] / sp;
          return {
            kind: 'craft', lock: st, anim, face: -.75, verb: `${verbing} a ${NAME[kind]}`,
            cancel() { S.wip[st] = null; },
            step(dt) {
              const w = S.wip[st]; if (!w) return true;
              w.p += dt / dur;
              if (Math.random() < dt * 3) audio.sfx(st === 'cut' ? 'snip' : st === 'fold' ? 'fold' : 'paper');
              if (w.p >= 1) { S.wip[st] = null; makeItem(st, kind, h); return true; }
            },
          };
        },
      };
    },
  };
}
const jobs = {
  bamboo: {
    label: 'stand up the bamboo',
    done: () => S.bambooUp,
    plan(h, sp) {
      if (lockedBy('bamboo', h)) return { x: SPOT.bamboo + .75, wait: '⋯ holding it steady' };
      return {
        x: SPOT.bamboo, start: () => {
          if (!lock('bamboo', h)) return null;
          return {
            kind: 'lift', lock: 'bamboo', anim: 'cheer', face: -1.1, verb: 'lifting the bamboo',
            step(dt) {
              S.raise = Math.min(1, S.raise + dt / (4.6 / sp));
              if (Math.random() < dt * 1.5) audio.sfx('creak');
              if (S.raise >= 1) { bambooUp(h); return true; }
            },
          };
        },
      };
    },
  },
  fold: craftJob('fold', 'fold cranes & lanterns', 'folding', 'write'),
  cut: craftJob('cut', 'cut nets & chains', 'making', 'chop'),
  stream: craftJob('stream', 'make streamers', 'making', 'stir'),
  wish: { label: 'write your wish', done: () => !!S.wish, canAssign: () => false, refuse: 'everyone writes their own wish ✦', plan: () => null },
};

// ───────────── the player at a station ─────────────
function craftMini(st, kind) {
  const w = S.wip[st] = { kind, p: 0, who: clawd, color: pick(PAPER) };
  let done = false;      // pointer events can still arrive after the panel closes
  const finish = (q = 1) => { if (done || !S) return; done = true; G.stats.quality.push(q); S.wip[st] = null; makeItem(st, kind, clawd); };
  const onClose = cancelled => { if (cancelled && S && S.wip[st] === w) S.wip[st] = null; };
  if (st === 'fold') return origami(kind, kind === 'lantern' ? '#d8343c' : w.color, { onStep: p => { w.p = p; clawd.workAnim = 'write'; }, onDone: q => finish(q), onClose });
  if (kind === 'chain') return mini.dial({
    title: 'loop the paper chain · 輪つなぎ', hint: 'drag in circles · every loop adds a ring', progress: () => w.p, knobColor: '#e8b730',
    onTurn(f) {
      if (done) return;
      w.p += f / 2.2; clawd.workAnim = 'stir'; audio.sfx('paper', { gap: .25 });
      if (w.p >= 1) { mini.close(false); finish(1); }
    },
    onClose,
  });
  if (kind === 'net') return mini.timing({
    title: 'cut the net · 網飾り', hint: 'tap when the line is in the green, each cut opens the net', cuts: 4, zoneW: .2,
    onCut(hit, n, total) { G.stats.quality.push(hit ? 1 : .45); w.p = n / total; S.snip = .3; clawd.workAnim = 'chop'; audio.sfx('snip'); },
    onDone() { if (done || !S) return; done = true; S.wip[st] = null; makeItem(st, kind, clawd); },
    onClose,
  });
  return mini.hold({
    title: 'unroll the streamer · 吹き流し', hint: 'hold to let the strips fall', label: 'unroll', dur: 1.9, color: '#e8b730',
    onProgress(p, holding) { w.p = p; clawd.workAnim = holding ? 'pour' : null; if (holding) audio.sfx('paper', { gap: .3 }); },
    onDone() { finish(1); },
    onClose,
  });
}

function interact(k, game) {
  switch (k) {
    case 'bamboo':
      if (!S.bambooUp) return game.work('bamboo', () => mini.hold({
        title: 'stand up the bamboo · 笹', hint: 'hold to lift it into the bucket', label: 'lift', dur: 2.4, start: S.raise, color: '#5d9a3c',
        onProgress(p, holding) { S.raise = Math.min(1, p); clawd.workAnim = holding ? 'cheer' : null; if (holding) audio.sfx('creak', { gap: .5 }); },
        onDone() { G.stats.quality.push(1); bambooUp(clawd); },
      }));
      if (ready()) {
        const q = G.stats.quality, avg = q.length ? q.reduce((a, b) => a + b, 0) / q.length : 1;
        return game.finish({ complete: true, perfect: avg >= .8 && G.phase < .9 });
      }
      return clawd.say(missing(), 2.6);
    case 'fold': case 'cut': case 'stream': {
      const kind = QUEUE[k][S.made[k]];
      if (!kind) return clawd.say('all done here ✓');
      return game.work(k, () => craftMini(k, kind));
    }
    case 'wish':
      if (S.wish) return clawd.say('my wish is on the bamboo ✓');
      return writePlayerWish();
  }
}

// ───────────── the night sky moment ─────────────
function buildSkyBits(root) {
  const B = {};
  const birdTex = canvasTex(32, 32, c => { c.strokeStyle = '#fff'; c.lineWidth = 3.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(4, 15); c.quadraticCurveTo(10, 8, 16, 16); c.quadraticCurveTo(22, 8, 28, 15); c.stroke(); });
  const N = 140, pos = new Float32Array(N * 3).fill(0);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  B.birds = new THREE.Points(geo, new THREE.PointsMaterial({ size: 15, sizeAttenuation: false, map: birdTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: 0xdfe8ff, opacity: 0, toneMapped: false }));
  B.birds.frustumCulled = false; root.add(B.birds);
  B.data = Array.from({ length: N }, (_, i) => { const u = (i + .5) / N; return { u, from: u < .5 ? 0 : 1, delay: rand(0, 1.4) + Math.abs(u - (u < .5 ? 0 : 1)) * 1.2, ph: rand(0, 6.28), lift: rand(-.012, .012) }; });
  B.t = -1;
  // Vega and Altair: drawn here unless the sky module renders sky.starPair itself
  const glow = canvasTex(64, 64, c => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.18, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64); c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(31, 2, 2, 60); c.fillRect(2, 31, 60, 2);
  });
  B.stars = [['vega', 0xcfe0ff], ['altair', 0xfff2d6]].map(([k, col]) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0, toneMapped: false }));
    s.position.copy(sky.stars[k]).multiplyScalar(300); s.scale.setScalar(12); root.add(s); return s;
  });
  // a soft road of light under the birds, lit from both ends as they arrive
  const TN = 70, tpos = new Float32Array(TN * 3), tcol = new Float32Array(TN * 3);
  for (let i = 0; i < TN; i++) bridgePoint(i / (TN - 1), _v).toArray(tpos, i * 3);
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tpos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(tcol, 3));
  B.trail = new THREE.Points(tg, new THREE.PointsMaterial({ size: 26, sizeAttenuation: false, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
  B.trail.frustumCulled = false; root.add(B.trail);
  B.meetLevel = 0;
  B.meet = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xfff0d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0, toneMapped: false }));
  B.meet.scale.setScalar(16); root.add(B.meet);
  return B;
}
function bridgePoint(u, out) {
  out.copy(sky.stars.vega).lerp(sky.stars.altair, u);
  out.y += Math.sin(u * Math.PI) * .05;
  return out.normalize().multiplyScalar(296);
}
function updateSkyBits(dt) {
  const B = P.skyBits, ownStars = !sky.rendersStarPair;
  const lit = Math.max(sky.starPair, sky.milkyWay * .4);
  B.stars.forEach((s, i) => { s.material.opacity = ownStars ? lit * (.85 + .15 * Math.sin(G.time * 2.3 + i * 2)) : 0; s.scale.setScalar(10 + sky.starPair * 9); });
  if (B.t < 0) return;
  B.t += dt;
  const pos = B.birds.geometry.attributes.position.array;
  let arrived = 0;
  B.data.forEach((d, i) => {
    const e = clamp((B.t - d.delay) / 3.4, 0, 1); if (e >= 1) arrived++;
    bridgePoint(lerp(d.from, d.u, easeOut(e)), _v);
    _v.y += Math.sin(G.time * 9 + d.ph) * .5 * (1 - e * .6) + d.lift * 296;
    pos[i * 3] = _v.x; pos[i * 3 + 1] = _v.y; pos[i * 3 + 2] = _v.z;
  });
  B.birds.geometry.attributes.position.needsUpdate = true;
  B.birds.material.opacity = smooth(0, 1.2, B.t) * .9;
  const met = arrived / B.data.length;
  bridgePoint(.5, _v); B.meet.position.copy(_v);
  B.meetLevel = met > .95 ? Math.min(1, B.meetLevel + dt * .5) : 0;
  B.meet.material.opacity = B.meetLevel * .8 * (.85 + .15 * Math.sin(G.time * 3));
  B.meet.scale.setScalar(14 + B.meetLevel * 10);
  // trail: each point lights up once the birds from its end have flown past it
  const tc = B.trail.geometry.attributes.color.array, TN = tc.length / 3;
  for (let i = 0; i < TN; i++) {
    const u = i / (TN - 1), dist = u < .5 ? u : 1 - u, reach = clamp((B.t - .6) / 3.6, 0, 1) * .5;
    const k = smooth(dist - .06, dist + .02, reach) * (.16 + .06 * Math.sin(G.time * 2 + i));
    tc[i * 3] = k * .75; tc[i * 3 + 1] = k * .85; tc[i * 3 + 2] = k;
  }
  B.trail.geometry.attributes.color.needsUpdate = true;
}

// ───────────── the ending ─────────────
function strip(color) {
  const g = new THREE.Group();
  mesh(new THREE.PlaneGeometry(.12, .42).translate(0, .25, .02), toon(color.css, { side: THREE.DoubleSide }), 0, 0, 0, g, false);
  return g;
}
async function ending(result, game) {
  if (result.quit) { clawd.say('the stars will wait ✦', 2); await sleep(1.2); return; }
  if (wishOpen()) await until(() => !wishOpen(), 300);
  if (!S.bambooUp) {
    helpers[2].say('together — lift!', 1.8);
    await new Promise(r => tween(1.6, e => { S.raise = Math.max(S.raise, ease(e)); }, r));
    bambooUp(helpers[2]);
    await sleep(1.2);
  }
  if (!S.wish) await writePlayerWish({ ending: true });
  await until(() => S.items.every(i => i.state === 'hung' || i.state === 'made'), 8);

  const bx = BX, p0 = G.phase;
  audio.setMood('dusk');
  await game.gather([[helpers[0], bx - 1.75, .62], [helpers[1], bx - 1.1, .68], [clawd, bx + 1.1, .55], [helpers[2], bx + 1.8, .62]], { timeout: 4 });
  crew.forEach(c => c.faceOverride = 0);
  const portrait = innerWidth < innerHeight;
  cam.shot(new V3(bx + .2, 2.0, portrait ? 11 : 8.0), new V3(bx + .2, 2.05, -.6), { fov: portrait ? 50 : 40, k: 1.3, drift: .3 });
  tween(20, e => { G.phase = lerp(p0, Math.max(p0, .93), e); });
  await sleep(1.4);

  // clawd's wish is already up; read it back
  showCard('clawd\'s wish', S.wish.text, `“${S.wish.text}”`, S.wish.color);
  clawd.say('mine\'s already up there', 2.2);
  await sleep(3.2); hideCard(); await sleep(.7);

  for (const i of [0, 1, 2]) {
    const h = helpers[i], W = HELPER_WISH[i];
    if (i === 2) { audio.setMood('quiet'); await sleep(1.1); }
    const s = strip(W.color); h.hand.add(s);
    h.workAnim = 'write'; h.mood('focus', 3); audio.sfx('brush');
    await sleep(i === 2 ? 2.6 : 1.6);
    h.workAnim = 'hold'; h.mood(i === 2 ? 'normal' : 'happy', 4);
    showCard(`${h.name}'s wish`, W.jp, W.en, W.color);
    audio.sfx('paper');
    await sleep(i === 2 ? 3.8 : 3.3);
    if (i === 2) {
      // the quiet beat: nobody says anything for a moment
      const at = new V3(h.x, 1, h.z);
      clawd.lookAt(at); clawd.faceOverride = .6;
      helpers[0].lookAt(at); helpers[1].lookAt(at);
      await sleep(2.0);
      clawd.say('…you will be.', 2.8); await sleep(2.9);
      clawd.say('same time tomorrow ✦', 3); h.blush = 1; h.mood('happy', 3.5); h.hop(.5);
      await sleep(2.4);
      crew.forEach(c => c.lookAt(null)); clawd.faceOverride = 0;
    }
    hideCard();
    h.hand.getWorldPosition(_v); h.hand.remove(s); h.workAnim = null;
    hangWish(W.jp, W.color, _v.clone());
    await sleep(1.3);
  }

  // night: the river of stars, and the two stars meet
  audio.setMood('night');
  await sleep(.8);
  const p1 = G.phase;
  tween(5, e => { G.phase = lerp(p1, 1, ease(e)); sky.milkyWay = Math.max(sky.milkyWay, e); });
  // everyone goes to sit at the edge and look up
  game.gather([[helpers[0], bx + 2.0, .9], [helpers[1], bx + 2.65, .95], [clawd, bx + 3.4, .85], [helpers[2], bx + 4.1, .92]], { timeout: 5, face: Math.PI })
    .then(() => crew.forEach(c => c.sitTarget = 1));
  // from just in front of the counter, under the eaves: the beam and lanterns sit above the frame,
  // the bamboo and its wishes fill the right side, the two stars and the bridge the sky
  const camPos = portrait ? new V3(bx - .6, 1.2, .2) : new V3(bx - 1.93, 1.5, .62), lookLow = new V3(bx + .1, 2.5, -.7);
  const az = portrait ? .02 : .3, el = portrait ? .49 : .35;
  const lookHigh = camPos.clone().add(new V3(Math.sin(az), Math.tan(el), -Math.cos(az)).normalize().multiplyScalar(40));
  cam.shot(camPos, lookLow, { fov: portrait ? 84 : 56, k: 1.1, drift: .35 });
  await sleep(2.4);
  await new Promise(r => tween(4.5, e => { cam.tlook.lerpVectors(lookLow, lookHigh, ease(e)); }, r));
  P.skyBits.t = 0;
  audio.sfx('wind');
  await sleep(5.2);
  tween(2.5, e => { sky.starPair = Math.max(sky.starPair, e); });
  audio.sfx('chime');
  await sleep(1.8);
  game.snap();
  await sleep(1.2);
  helpers[0].say('they made it ✦', 2.6);
  await sleep(1.3);
  clawd.say('once a year. worth the wait.', 3.2);
  await sleep(3.6);
}

function diary(result) {
  const lines = [];
  if (result.quit) return { jp: 'きょうは たなばた。とちゅうで おわりに しました。', lines: ['Today was Tanabata. We stopped early. The bamboo can wait until next year.'] };
  lines.push(result.complete ? 'Today was Tanabata. We stood a bamboo branch in a bucket and hung paper decorations all over it.' : 'Today was Tanabata. We didn\'t finish every decoration, but the stars came out anyway.');
  // who made what, two busiest people, one sentence each
  const by = new Map();
  for (const { who, kind } of S.log) { const m = by.get(who.name) || new Map(); m.set(kind, (m.get(kind) || 0) + 1); by.set(who.name, m); }
  const say = { crane: n => n > 1 ? `folded ${n} strings of cranes` : 'folded a string of cranes', lantern: n => n > 1 ? `made ${n} lanterns` : 'made a lantern', chain: n => n > 1 ? `looped ${n} paper chains` : 'looped a paper chain', net: n => n > 1 ? `cut ${n} nets` : 'cut a net', streamer: n => n > 1 ? `made ${n} streamers` : 'made a streamer' };
  const busiest = [...by.entries()].sort((a, b) => [...b[1].values()].reduce((x, y) => x + y, 0) - [...a[1].values()].reduce((x, y) => x + y, 0)).slice(0, 2);
  for (const [who, kinds] of busiest) {
    const parts = [...kinds.entries()].map(([k, n]) => say[k](n));
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
    lines.push(`${who === 'clawd' ? 'I' : who[0].toUpperCase() + who.slice(1)} ${list}.`);
  }
  if (S.wish) lines.push(`My wish was “${S.wish.text}”.`);
  lines.push('Helper 3 wished to be spawned again tomorrow. I said it would be.');
  if (result.complete) lines.push('At night the magpies made a bridge, and Orihime and Hikoboshi met across the Milky Way.');
  return {
    jp: result.complete ? 'きょうは たなばた。ささに ねがいごとを かざりました。おりひめと ひこぼしが あえました。' : 'きょうは たなばた。かざりは ぜんぶ できなかったけど、ねがいごとは かけました。',
    lines,
  };
}

function introLines() {
  const done = save.data.days || {}, titles = { kakigori: 'kakigōri for four', takoyaki: 'takoyaki for the neighbors', somen: 'nagashi-sōmen' };
  const hex = s => (Math.abs([...s].reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 17)) * 2654435761 >>> 0).toString(16).padStart(7, '0').slice(0, 7);
  const rows = ['somen', 'takoyaki', 'kakigori'].filter(k => done[k]?.done).map(k => [`  ${hex(k)} ${titles[k]}`, '#f2c14e']);
  return [
    ['$ git log --oneline -3'],
    ...(rows.length ? rows : [['  (nothing yet: straight to thursday)', '#a79e94']]),
    ['$ date'], ['  Thu Aug 6 · 七夕 · Sendai Tanabata begins', '#a79e94'],
    ['$ cat wishes.txt'], ['  cat: wishes.txt: No such file or directory', '#f7d488'],
  ];
}

// ───────────── chapter ─────────────
const CH = {
  id: 'tanabata', day: 4, title: 'Tanabata', jp: '七夕', short: '七夕', weather: 'はれ · ほしぞら',
  blurb: 'Paper decorations, wishes on the bamboo, and two stars that meet once a year.',
  jpPreview: 'きょうは たなばた。ねがいごとを かく。',
  prompt: 'hang wishes on the bamboo', goal: 'hang wishes on the bamboo',
  sky: 'starry', mood: 'golden', dayLen: 200, phase: [.38, 1], clock: [16 * 60 + 37, 20 * 60 + 15], clockNote: '✨ stars out around 8',
  helpers: [
    { spec: ['fold'], specName: 'folding' },
    { spec: ['stream'], specName: 'streamers' },
    { spec: ['cut', 'bamboo'], specName: 'cutting · lifting' },
  ],
  introShots: [
    { pos: [3.1, 1.0, .95], look: [4.35, .42, -1.2], fov: 34, dur: 2.3, to: { pos: [2.7, .95, .85] } },
    { pos: [5.45, .82, .78], look: [4.9, .24, -.2], fov: 30, dur: 2.0, to: { pos: [5.25, .76, .66] } },
    { pos: [-3.95, 1.05, .9], look: [-4.4, .33, -.45], fov: 32, dur: 1.9, to: { pos: [-4.25, 1.0, .82] } },
  ],

  setup(root) {
    S = {
      t: 0, raise: 0, bundle: 1, bambooUp: false, announced: false, snip: 0, duskMood: false,
      made: { fold: 0, cut: 0, stream: 0 }, wip: { fold: null, cut: null, stream: null },
      items: [], wish: null, log: [],
    };
    P = { root };
    injectCSS();
    P.bamboo = buildBamboo(root, BX, BZ);
    P.bamboo.pivot.rotation.order = 'YZX';
    P.bamboo.setHit(false, LYING.y);
    P.stool = group(root, BX + 2.5, 0, BZ - 2.5 * Math.sin(LYING.y));      // the trestle it rests on until it's stood up
    for (const s of [-1, 1]) { const l = mesh(box(.05, .42, .05), MAT.woodDark, s * .1, .19, 0, P.stool); l.rotation.z = s * .3; }
    mesh(box(.08, .05, .34), MAT.woodDark, 0, .36, 0, P.stool);
    P.craft = buildCraft(root);
    P.basket = buildBasket(root, 1.95, -.3);
    P.desk = buildDesk(root, 4.75, -.2);
    P.skyBits = buildSkyBits(root);
    sky.milkyWay = 0; sky.starPair = 0;
    CH.intro = introLines();
  },

  stations: () => ({
    fold: { name: 'folding mat', spot: SPOT.fold, job: 'fold', hit: [1.25, 1.0, 1.0, -4.4, .45, -.45], ring: [-4.4, -.42, 1.25], keywords: ['fold', 'folding', 'crane', 'cranes', 'origami', 'lantern', 'lanterns'],
      tip: () => `folding mat · cranes & lanterns · ${S.made.fold}/${QUEUE.fold.length}` },
    cut: { name: 'scissors & paper', spot: SPOT.cut, job: 'cut', hit: [1.35, 1.0, 1.0, -2.45, .45, -.45], ring: [-2.45, -.42, 1.25], keywords: ['cut', 'net', 'nets', 'chain', 'chains', 'scissors', 'loop'],
      tip: () => `scissors & paper · nets & chains · ${S.made.cut}/${QUEUE.cut.length}` },
    stream: { name: 'streamer stand', spot: SPOT.stream, job: 'stream', hit: [.95, 1.45, .8, -.65, .7, -.6], ring: [-.65, -.5, 1.05], keywords: ['streamer', 'streamers', 'fukinagashi', 'ribbon', 'strips'],
      tip: () => `streamer stand · ${S.made.stream}/${QUEUE.stream.length}` },
    bamboo: { name: 'bamboo', spot: SPOT.bamboo, job: 'bamboo', hitObj: () => P.bamboo.hit, ring: () => [BX, BZ + .1, 1.35], keywords: ['bamboo', 'sasa', 'stand', 'raise', 'lift', 'up'],
      tip: () => !S.bambooUp ? 'bamboo · lying down, still tied' : ready() ? 'bamboo · click to look up ✨' : `bamboo · ${S.items.filter(i => i.state === 'hung').length}/${TOTAL + 1} hung` },
    wish: { name: 'wish desk', spot: SPOT.wish, job: 'wish', hit: [1.4, .9, 1.0, 4.75, .35, -.2], ring: [4.75, -.15, 1.25], keywords: ['wish', 'tanzaku', 'write', 'desk'],
      tip: () => S.wish ? 'wish desk · your wish is up ✓' : 'wish desk · write your wish (only you can)' },
  }),
  jobs,
  interact,
  ready,

  todo() {
    const who = j => { const w = helpers.filter(h => h.job === j).map(h => h.short); if (G.locks[j] === clawd) w.unshift('you'); return w; };
    const dots = st => '◆'.repeat(S.made[st]) + '◇'.repeat(QUEUE[st].length - S.made[st]);
    const hung = S.items.filter(i => i.state === 'hung').length;
    return [
      { label: 'raise the bamboo', done: S.bambooUp, detail: S.bambooUp ? '' : S.raise > .02 ? `${Math.round(S.raise * 100)}%` : 'tied', workers: who('bamboo') },
      { label: 'cranes & lanterns', done: S.made.fold >= QUEUE.fold.length, detail: dots('fold'), workers: who('fold') },
      { label: 'nets & chains', done: S.made.cut >= QUEUE.cut.length, detail: dots('cut'), workers: who('cut') },
      { label: 'streamers', done: S.made.stream >= QUEUE.stream.length, detail: dots('stream'), workers: who('stream') },
      { label: 'your wish', done: !!S.wish, detail: S.wish ? '' : 'only you', workers: G.locks.wish === clawd ? ['you'] : [] },
      { label: 'look up', done: false, blocked: !ready(), detail: ready() ? '← click the bamboo' : `${hung}/${TOTAL + 1} hung` },
    ];
  },
  hint() {
    if (!S) return '';
    if (ready()) return 'everything is hung · click the bamboo to look up ✨';
    if (G.stats.deleg === 0 && G.t < 22) return 'click a station to work it yourself · or pick a helper below, then a station';
    if (!S.bambooUp && S.items.some(i => i.state === 'basket')) return 'decorations wait in the basket until the bamboo is standing';
    if (!S.wish && madeAll()) return 'only you can write your wish · the desk on the right';
    if (G.stats.deleg > 0 && G.stats.deleg < 3 && G.t < 50) return 'helpers keep at a job until it\'s done · specialists ✦ work twice as fast';
    return '';
  },
  start() {
    const lines = [[2, 'bamboo! I can lift that ✦', 1.2], [0, 'cranes. so many cranes.', 2.6], [1, 'good breeze for streamers', 4.0]];
    for (const [i, t, d] of lines) tween(d, () => {}, () => { if (G.mode === 'play' && !helpers[i].job) helpers[i].say(t, 2.4); });
  },

  update(dt) {
    if (!S || !P) return;
    S.t += dt; S.snip = Math.max(0, S.snip - dt);
    const t = G.time, w = world.wind, B = P.bamboo;
    // raise + untie
    const r = ease(S.raise);
    B.pivot.rotation.z = lerp(LYING.z, STAND.z, r) + (S.raise > 0 && S.raise < 1 ? Math.sin(t * 9) * .012 : 0);
    B.pivot.rotation.y = lerp(LYING.y, STAND.y, r);
    setBundle(B, S.bambooUp ? clamp(S.bundle, -.25, 1) : 1);
    const up = S.bambooUp ? 1 : .15;
    B.sway.rotation.z = Math.sin(t * .8) * .014 * w * up; B.sway.rotation.x = Math.sin(t * .63 + 1) * .01 * w * up;
    B.branches.forEach(b => {
      const s = (Math.sin(t * 1.3 + b.ph) * .05 + Math.sin(t * 2.9 + b.ph * 1.7) * .02) * w * up;
      b.inner.rotation.z = b.open + s;
      b.g.rotation.x = Math.sin(t * 1.1 + b.ph * 2) * .04 * w * up;
      b.clusters.forEach(c => c.rotation.z = -b.inner.rotation.z * .85);
    });
    // hanging decorations: follow the anchors, swing like pendulums
    for (const it of S.items) {
      const o = it.obj, u = o.userData;
      if (it.state === 'hung') {
        it.anchor.obj.getWorldPosition(o.position);
        const sw = it.sw, fz = (Math.sin(t * 1.3 + sw.ph) * .3 + Math.sin(t * 3.1 + sw.ph * 2) * .07) * w, fx = Math.sin(t * .9 + sw.ph * 1.3) * .12 * w;
        sw.vz += ((fz - sw.az) * 9 - sw.vz * 1.6) * dt; sw.az += sw.vz * dt;
        sw.vx += ((fx - sw.ax) * 9 - sw.vx * 1.6) * dt; sw.ax += sw.vx * dt;
        o.rotation.set(sw.ax, Math.sin(t * .5 + sw.ph) * .3, sw.az);
      }
      if (u.kind === 'streamer' && it.state !== 'basket') flutterStreamer(o, t, w);
      if (u.glow) u.glow.emissiveIntensity = sky.night * .75;
    }
    // work in progress on the craft table
    const C = P.craft, wf = S.wip.fold, wc = S.wip.cut, ws = S.wip.stream;
    C.paper.visible = !!wf;
    if (wf) {
      const x = clamp(wf.p, 0, .999) * 5, k = x % 1;
      C.paperFlap.rotation.x = -Math.PI * ease(clamp(k * 1.5, 0, 1));
      C.paper.scale.setScalar(1 - .45 * wf.p); C.paper.rotation.y = Math.floor(x) * .8;
      C.paperMat.color.set(wf.kind === 'lantern' ? '#d8343c' : wf.color);
    }
    const snipping = !!wc && (wc.who !== clawd || S.snip > 0 || wc.kind === 'chain');
    const open = snipping ? .04 + Math.abs(Math.sin(t * 13)) * .32 : .14;
    C.blades[0].rotation.y = open; C.blades[1].rotation.y = -open;
    C.cutPaper.visible = !!wc && wc.kind === 'net';
    C.rings.forEach((rg, i) => rg.visible = !!wc && wc.kind === 'chain' && i < Math.floor(wc.p * 9 + .001));
    C.wipStrips.forEach((s, i) => { s.scale.y = ws ? Math.max(.001, clamp(ws.p, 0, 1) * .78) : .001; s.rotation.z = ws ? Math.sin(t * 3 + i) * .1 * w : 0; });
    if (G.mode === 'play' && !S.duskMood && G.phase > .72) { S.duskMood = true; audio.setMood('dusk'); }
    updateSkyBits(dt);
  },

  key(e, type) {
    if (wishOpen()) return true;
    if (type === 'down' && G.mini?.kind === 'origami' && ARROWS[e.key]) {
      e.preventDefault(); held[e.key.toLowerCase()] = false;
      G.mini.fold(ARROWS[e.key]); return true;
    }
  },

  ending,
  diary,
  teardown() {
    removeUI();
    sky.milkyWay = 0; sky.starPair = 0;
    S = null; P = null;
  },

  ls: () => ['bamboo/  origami/{cranes,lanterns}  scissors/{nets,chains}  streamers/  tanzaku/  legend.md  decorations.md  wishes.txt'],
  review: () => !S ? 'nothing to review' : ready() ? 'LGTM ✦ the bamboo looks like a festival' : `changes requested: ${missing()}`,
  commands: {
    'cat legend.md': () => [
      '# 七夕 · the tanabata legend',
      'Orihime (Vega), the weaver princess, and Hikoboshi (Altair), the cowherd, fell in love and stopped working.',
      'Her father, the King of the Sky, put the Milky Way (天の川) between them.',
      'Once a year, on the seventh night of the seventh month, magpies make a bridge so they can meet.',
      'If it rains, the river floods and they wait another year. Tonight is clear.',
    ],
    'cat decorations.md': () => [
      '# 七つ飾り · the seven decorations of Sendai Tanabata',
      '- 短冊 tanzaku: wishes, and better handwriting',
      '- 折鶴 orizuru: a long life for the family',
      '- 吹き流し fukinagashi: skill at weaving (Orihime\'s threads)',
      '- 投網 toami, the net: a good catch and a good harvest',
      '- 巾着 kinchaku: thrift and good fortune',
      '- 紙衣 kamigoromo: skill at sewing, and protection from illness',
      '- くずかご kuzukago: tidiness',
      'tonight: cranes, nets, paper chains, lanterns and streamers. close enough.',
    ],
    'cat wishes.txt': () => {
      const all = (save.data.wishes || []).map(w => w.text);
      return all.length ? all.map(w => ({ t: `  ✦ ${w}`, c: '#f2c14e' })) : { t: 'cat: wishes.txt: No such file or directory', c: '#f7d488' };
    },
    'wish': (a, raw) => terminalWish(raw.replace(/^\s*wish\s*/i, '')),
    'echo': (a, raw) => {
      const m = raw.match(/^\s*echo\s+(["']?)(.+?)\1\s*>>?\s*(tanzaku|wishes)(\.txt)?\s*$/i);
      if (m) return terminalWish(m[2]);
      return raw.replace(/^\s*echo\s*/i, '').replace(/^(["'])(.*)\1$/, '$2');
    },
  },
};

// dev hook for screenshots and tests
CH._debug = { get S() { return S; }, get P() { return P; }, makeItem, bambooUp, setWish, hang, fillAll() { if (!S.bambooUp) bambooUp(helpers[2]); for (const st of Object.keys(QUEUE)) while (S.made[st] < QUEUE[st].length) makeItem(st, QUEUE[st][S.made[st]], helpers[0]); if (!S.wish) setWish('to watch the stars with everyone', GOSHIKI[4]); } };
export default CH;

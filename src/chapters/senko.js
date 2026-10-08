// Day 5 — Senkō hanabi (線香花火). The finale: no jobs, no clock. Four sparklers, one candle,
// three rounds. Hold Clawd's sparkler still and let the bead hang through the four stages.
import { V3, camera, scene } from '../core/gfx.js';
import { G } from '../core/state.js';
import { rand, clamp, lerp, ease, smooth, pick, isTouch } from '../core/util.js';
import { tween, sleep, until } from '../core/tween.js';
import { clawd, helpers, crew } from '../core/crab.js';
import { audio } from '../core/audio.js';
import { term } from '../core/terminal.js';
import { cam } from '../core/camera.js';
import { Particles } from '../core/fx.js';
import { world } from '../core/world.js';
import { sky } from '../core/sky.js';
import { STAGES, SparkPool, Sparkler } from './senko/sparkler.js';
import { LAYOUT, buildProps, updateProps, addStick } from './senko/props.js';
import { ui } from './senko/ui.js';

const ROUNDS = 3;
const STICK_COLS = [0xf29ab8, 0xb48be0, 0xf2c14e, 0x9fd0ee];
const ROW_C = -.3;
const MOON_DIR = new V3(-.5, .5, -1).normalize();
const STAGE_NAMES = ['botan', 'matsuba', 'yanagi', 'chiri-giku'];

let S = null, P = null;
const tmp = new V3(), right = new V3(), up = new V3();

// ───────────── camera ─────────────
const portrait = () => innerWidth < innerHeight * .9;
const SHOTS = {
  // the play view: Clawd's own sparkler, close enough to see the sparks fork
  mine: () => portrait() ? [[-.32, .66, .9], [-.42, .1, -2.1], 46] : [[-.3, .6, .62], [-.42, .1, -2.1], 32],
  // over Clawd's shoulder, closer, for the last one
  mine2: () => portrait() ? [[-.3, .5, .35], [-.42, .12, -2.0], 42] : [[-.28, .44, .02], [-.42, .12, -2.0], 29],
  // lighting at the candle, from the city side
  light: () => portrait() ? [[-.5, .55, -3.6], [.1, .32, -1.05], 48] : [[-.6, .48, -2.75], [.1, .3, -1.05], 36],
  // all four, from the city side, faces lit by their own sparklers
  faces: () => portrait() ? [[-.1, .35, -6.9], [-.1, .55, -1.0], 54] : [[ROW_C, .3, -5.3], [ROW_C, .56, -1.0], 40],
  behind: () => portrait() ? [[.2, 1.6, 7.8], [-1.6, 6.5, -40], 58] : [[ROW_C + .6, 1.75, 6.9], [ROW_C - 3.5, 7.6, -40], 44],
  laptop: () => portrait() ? [[-8.1, 1.55, 4.3], [-8.3, .55, -.4], 50] : [[-7.65, 1.05, 2.0], [-8.4, .5, -.4], 40],
  wide: () => portrait() ? [[.4, 2.4, 10.5], [-1.4, 4.4, -40], 60] : [[ROW_C + 3.2, 2.3, 9.2], [ROW_C + 1.0, 4.6, -40], 46],
};
function shot(name, { cut = false, k = 1.2, drift = .35 } = {}) {
  const [p, l, fov] = SHOTS[name]();
  S.shot = name; S.aspect = innerWidth / innerHeight;
  cam.shot(new V3(...p), new V3(...l), { fov, k, cut, drift });
}

// where a crab's claw pinches the string, and where the string starts to hang: the twist
// arcs out from the claw, away from the body and toward the city
const REACH = new V3(-.2, -.02, -.11);
function clawPoint(c, out) {
  c.hand.updateWorldMatrix(true, false);
  c.hand.getWorldPosition(out);
  out.z -= .06 * c.scale; out.y -= .01;
  return out;
}
function handAnchor(c, out) { return clawPoint(c, out).addScaledVector(REACH, c.scale); }

// ───────────── holding ─────────────
function startHold(src, x = 0, y = 0) {
  if (!S) return;
  S.holding = true; S.holdSrc = src; S.ptr.x = x; S.ptr.y = y;
  if (S.state === 'ready') { S.state = 'lighting'; S.igniteT = 0; }
}
function endHold(src) {
  if (!S || !S.holding) return;
  if (src && S.holdSrc && src !== S.holdSrc && src !== 'any') return;
  S.holding = false; S.holdSrc = null;
}
function moveHold(x, y) {
  const dx = x - S.ptr.x, dy = y - S.ptr.y;
  S.ptr.x = x; S.ptr.y = y;
  const d = Math.hypot(dx, dy);
  if (d < 1.2) return;   // a resting finger trembles a little; that's fine
  const m = camera.matrixWorld.elements;
  right.set(m[0], m[1], m[2]); up.set(m[4], m[5], m[6]);
  const k = .0017;
  S.hand.addScaledVector(right, dx * k).addScaledVector(up, -dy * k);
  if (S.hand.length() > .15) S.hand.setLength(.15);
  S.moved += d;
}

function myAnchor(dt) {
  const a = S.mine.anchor;
  clawPoint(clawd, S.mine.hand).add(S.hand);
  handAnchor(clawd, a);
  S.hand.multiplyScalar(1 - Math.min(1, dt * 2.6));
  // how fast the player is moving the claw (pointer-driven only; the slow droop doesn't count)
  if (dt > 0) { const sp = tmp.subVectors(S.hand, S.prevHand).length() / dt; S.jolt += (sp - S.jolt) * Math.min(1, dt * 10); S.prevHand.copy(S.hand); }
  S.mine.jolt = S.holding ? S.jolt : 0;
  a.add(S.hand);
  a.y += Math.sin(G.time * 1.6) * .0025;
  const sag = S.sag;
  a.y -= .05 * sag;
  a.x += (Math.sin(G.time * 13) * .004 + Math.sin(G.time * 7.7) * .003) * sag;
  if (S.lightK > 0) { tmp.set(P.wickWorld.x, P.wickWorld.y + .035 + S.mine.len, P.wickWorld.z); a.lerp(tmp, ease(S.lightK)); }
}

// ───────────── wind ─────────────
function updateWind(dt) {
  S.windF.set((world.wind - .55) * .45, 0, (world.wind - .55) * .12);
  const F = world.furin;
  const burning = G.mode === 'play' && S.state === 'burning';
  if (F.lastRing !== S.lastRing) {
    S.lastRing = F.lastRing;
    if (burning && S.gust.t <= 0 && S.gust.wait <= 0 && S.gustCool <= 0) startGust();
  }
  // the evening's own gusts: nudge the furin; it rings, and the wind arrives right after
  if (burning && S.mine.burning) { S.nextGust -= dt; if (S.nextGust <= 0) { S.nextGust = rand(11, 17); F.v += (Math.random() < .5 ? -1 : 1) * rand(.9, 1.3); } }
  S.gustCool -= dt;
  const g = S.gust;
  if (g.wait > 0) { g.wait -= dt; if (g.wait <= 0) g.t = g.dur; }
  else if (g.t > 0) { g.t -= dt; const e = 1 - g.t / g.dur; S.windF.addScaledVector(g.dir, g.mag * Math.sin(e * Math.PI)); }
}
function startGust() {
  const s = Math.random() < .5 ? -1 : 1;
  S.gust = { wait: .3, t: 0, dur: rand(.8, 1.1), dir: new V3(s, 0, rand(-.35, .35)).normalize(), mag: rand(1.0, 1.7) * (.6 + .5 * world.wind) };
  S.gustCool = 8; S.rec.gusts++;
  if (!S.saidWind && S.mine.burning) { S.saidWind = true; tween(.6, () => {}, () => S && helpers[1].say('wind…', 1.6)); }
}

// ───────────── events ─────────────
function flashHint(text, dur = 3.2) { S.hintFlash = text; S.hintFlashT = dur; }

function onMyStage(stage) {
  S.roundStage = stage; S.rec.bestStage = Math.max(S.rec.bestStage, stage);
  const note = stage === 3 && !S.saidLife ? 'people say the four stages are a whole life.' : '';
  if (stage === 3) S.saidLife = true;
  ui.stage(STAGES[stage], note);
  const r = S.round;
  if (stage === 1 && r === 1) tween(1.2, () => {}, () => S && helpers[2].say('whoa—', 1.4));
  if (stage === 2 && r === 2) tween(1.5, () => {}, () => S && helpers[0].say('like willow branches', 2.2));
  if (stage === 3 && r === 1) tween(2, () => {}, () => S && helpers[1].say('…chiri-giku', 2));
  if (stage === 1 && (!S.snapped || (r === 2 && S.snapped !== 'faces'))) {
    const my = S;
    tween(2.6, () => {}, () => {
      if (S !== my || !S.mine.burning) return;
      const n = S.theirs.filter(s => s.burning).length;
      if (S.shot === 'faces' && n >= 2) { S.snapped = 'faces'; S.game.snap(); }
      else if (!S.snapped && n >= 1) { S.snapped = S.shot; S.game.snap(); }
    });
  }
}
function onMyDrop(cause) {
  if (cause === 'quit') return;
  ui.clearStage();
  // yours is out; watch theirs (and let them burn down a little quicker)
  const my = S;
  tween(1.3, () => {}, () => {
    if (S !== my || S.state !== 'burning' || !S.theirs.some(s => s.burning)) return;
    S.theirs.forEach(s => s.rate = 1.6);
    if (S.shot !== 'faces') shot('faces', { cut: true, k: 1, drift: .3 });
  });
  if (cause === 'end') {
    S.rec.completed++; clawd.mood('happy', 2.2); clawd.blush = 1;
    audio.sfx('bead-drop', { soft: true });
    tween(1, () => {}, () => S && pick(helpers).say(S.rec.completed > 1 ? 'again, all the way ✦' : 'all the way ✦', 2));
    return;
  }
  S.rec.drops++; if (cause === 'droop') S.rec.droopDrops++;
  clawd.mood('sad', 1.8); clawd.say('ah—', 1.3);
  audio.sfx('bead-drop');
  tween(1, () => {}, () => S && pick(helpers).say(pick(['it\'s okay', 'again?', 'that one was brave', 'mine fell too, last summer']), 2));
  flashHint(cause === 'droop' ? 'it droops when you let go — keep holding' : 'it fell. that happens. (it\'s part of it)');
}
function onTheirDrop(i) {
  const h = helpers[i];
  S.rec.helperDrops.push(i);
  h.mood('wow', 1); h.say('ah!', 1.2); audio.sfx('bead-drop', { soft: true });
  tween(1.3, () => {}, () => { if (!S) return; h.mood('happy', 1.6); h.say('ehehe', 1.4); h.hop(.3); });
}

function igniteMine() {
  S.mine.ignite(); S.state = 'burning'; S.igniteT = 0;
  const my = S, burnShot = ['mine', 'faces', 'mine2'][S.round - 1] || 'mine';
  tween(.9, () => {}, () => { if (S === my && S.state === 'burning') { shot(burnShot, { cut: true, k: 1.2, drift: .25 }); placeCandle('park'); } });
  audio.sfx('match');
  if (S.round === 1) tween(.9, () => {}, () => S && helpers[1].say('it\'s lit ✦', 1.6));
  // the others light theirs right after
  S.theirs.forEach((s, i) => tween(.55 + i * .5 + rand(0, .2), () => {}, () => { if (S && s.state === 'unlit') { s.ignite(); audio.sfx('match', { soft: true }); } }));
  // tonight's mishap: helper 3's bead falls early in the first round; later rounds are a coin toss
  S.plan = S.round === 1 ? { who: 2, at: rand(8, 11.5) } : S.round === 2 && Math.random() < .45 ? { who: Math.random() * 3 | 0, at: rand(11, 19) } : null;
}

function endRound(game) {
  S.state = 'between';
  S.rec.rounds.push({ stage: S.roundStage, completed: S.mine.completed, cause: S.mine.cause });
  const my = S;
  (async () => {
    await sleep(1.3); if (S !== my) return;
    shot('behind', { cut: true, k: .7, drift: .5 });
    // spent sticks into the bucket
    const all = [S.mine, ...S.theirs];
    all.forEach((s, i) => {
      const col = STICK_COLS[(i + S.round) % 4];
      const from = s.anchor.clone(), to = new V3(LAYOUT.bucket.x + rand(-.05, .05), .32, LAYOUT.bucket.z + rand(-.05, .05));
      const stick = addStick(P, col); stick.visible = false;
      tween(.25 + i * .22, () => {}, () => {
        if (S !== my) return;
        s.g.visible = false;
        const fly = stick.clone(); fly.visible = true; P.bucket.parent.add(fly);
        tween(.7, e => { fly.position.lerpVectors(from, to, ease(e)); fly.position.y += Math.sin(e * Math.PI) * .5; fly.rotation.z = e * 5; },
          () => {
            fly.parent?.remove(fly); stick.visible = true;
            audio.sfx('hiss');
            for (let k = 0; k < 6; k++) P.steam.emit(to.x + rand(-.06, .06), .24, to.z + rand(-.06, .06), rand(-.05, .05), rand(.2, .4), rand(-.05, .05), rand(.8, 1.4), .5, .5, .55);
          });
      });
    });
    await sleep(2.4); if (S !== my) return;
    if (S.round >= ROUNDS) {
      S.state = 'done';
      await sleep(1.2); if (S !== my) return;
      game.finish({ complete: true, perfect: S.rec.completed > 0 });
      return;
    }
    S.round++;
    ui.left(S.round - 1);
    S.mine.reset(); S.theirs.forEach(s => s.reset());
    audio.sfx('select');
    await sleep(.8); if (S !== my) return;
    shot('light', { cut: true, k: 1.1, drift: .3 }); placeCandle('home');
    S.lightK = 0; S.state = 'ready';
  })();
}

function placeCandle(where) {
  const p = where === 'park' ? LAYOUT.candlePark : LAYOUT.candle;
  P.candle.position.set(p.x, 0, p.z);
  P.wickWorld.set(p.x, .245, p.z);
}

async function lightCandle(my) {
  const hand = handAnchor(clawd, new V3());
  P.match.visible = true; P.match.position.copy(hand);
  audio.sfx('match');
  for (let k = 0; k < 10; k++) S.embers.emit(hand.x, hand.y, hand.z, rand(-.4, .4), rand(0, .5), rand(-.4, .4), rand(.15, .35), 1, .7, .3);
  const from = hand.clone(), to = P.wickWorld.clone().add(new V3(0, .03, 0));
  await new Promise(r => tween(.9, e => { P.match.position.lerpVectors(from, to, ease(e)); P.match.position.y += Math.sin(e * Math.PI) * .08; }, r));
  if (S !== my) return;
  tween(1, e => P.lit = ease(e));
  await sleep(.5); if (S !== my) return;
  tween(.5, e => P.matchFlame.material.opacity = .95 * (1 - e), () => { P.match.visible = false; P.matchFlame.material.opacity = .95; });
  for (let k = 0; k < 5; k++) S.smoke.emit(to.x, to.y + .05, to.z, rand(-.05, .05), .15, rand(-.05, .05), rand(1.5, 2.4), .6, .6, .65);
  crew.forEach(c => c.mood('happy', 1.2));
}

// ───────────── the evening ─────────────
function start(game) {
  S.game = game; S.state = 'gather';
  audio.setMood('night');
  const my = S;
  (async () => {
    const seats = [[helpers[2], LAYOUT.seat.h3], [helpers[0], LAYOUT.seat.h1], [clawd, LAYOUT.seat.clawd], [helpers[1], LAYOUT.seat.h2]];
    seats.forEach(([c, x]) => { c.wake(); c.faceOverride = null; c.targetX = x; c.speed = Math.max(c.baseSpeed, 2.6); });
    clawd.say('last night of the week.', 2.4);
    await until(() => seats.every(([c]) => c.arrived()), 7); if (S !== my) return;
    seats.forEach(([c]) => { const z0 = c.z; tween(.8, e => c.z = lerp(z0, LAYOUT.z, ease(e))); c.faceOverride = Math.PI; c.sitTarget = .55; });
    await sleep(.9); if (S !== my) return;
    shot('behind', { cut: true, k: .9, drift: .5 });
    seats.forEach(([c]) => c.workAnim = 'hold');
    S.mine.reset(); S.theirs.forEach(s => s.reset());
    S.mine.g.visible = true; S.theirs.forEach(s => s.g.visible = true);
    audio.sfx('select');
    await sleep(1.6); if (S !== my) return;
    await lightCandle(my); if (S !== my) return;
    await sleep(.8); if (S !== my) return;
    helpers[1].say('the wind is gentle tonight', 1.9);
    await sleep(2.1); if (S !== my) return;
    shot('light', { cut: true, k: 1.1, drift: .3 });
    S.round = 1; ui.left(0); ui.showLeft(true);
    S.state = 'ready';
  })();
}

function playLogic(dt, game) {
  switch (S.state) {
    case 'ready':
      S.lightK = Math.max(0, S.lightK - dt * 2);
      break;
    case 'lighting':
      if (S.holding) {
        S.lightK = Math.min(1, S.lightK + dt * 2.2);
        if (S.lightK > .9) {
          S.igniteT += dt;
          if (Math.random() < dt * 25) { const b = S.mine.beadPos; S.embers.emit(b.x, b.y, b.z, rand(-.3, .3), rand(0, .5), rand(-.3, .3), rand(.1, .25), 1, .7, .3); }
          if (S.igniteT > .65) igniteMine();
        }
      } else { S.state = 'ready'; S.igniteT = 0; }
      break;
    case 'burning': {
      S.lightK = Math.max(0, S.lightK - dt * 1.8);
      const m = S.mine;
      if (m.burning && !S.holding) {
        S.droopT += dt; S.sag = smooth(0, 1.2, S.droopT);
        m.droop = .32 * smooth(.4, 1.2, S.droopT); m.damping = .9;
      } else {
        S.droopT = 0; S.sag = Math.max(0, S.sag - dt * 2); m.droop = 0; m.damping = S.holding ? 2.0 : 1.6;
      }
      if (S.plan && S.theirs[S.plan.who].burning && S.theirs[S.plan.who].t > S.plan.at) { S.theirs[S.plan.who].drop('wobble'); S.plan = null; }
      if (m.out && S.theirs.every(s => s.out || s.state === 'unlit')) endRound(game);
      break;
    }
  }
}

// ───────────── the ending ─────────────
async function ending(result, game) {
  const my = S; if (!S) return;
  S.state = 'ending'; S.holding = false;
  ui.clearStage(); ui.showLeft(false);
  crew.forEach(c => { if (c.workAnim === 'hold') c.workAnim = null; });
  if (result.quit) {
    [S.mine, ...S.theirs].forEach(s => s.burning && s.drop('quit'));
    clawd.say('another night, then ✦', 2.2);
    tween(.8, e => P.lit = Math.min(P.lit, 1 - e));
    await sleep(1.2); if (S !== my) return;
    await term.typeLine('$ exit', '#e8e2da', .06);
    await new Promise(r => tween(1.2, e => world.screen.material.color.setScalar(1 - .97 * e), r));
    await sleep(.8);
    return;
  }
  audio.setMood('quiet');
  if (S.shot !== 'faces') shot('faces', { cut: true, k: .8, drift: .25 });
  await sleep(2.4); if (S !== my) return;
  helpers[2].mood('sleep', 999); helpers[2].say('ふぁ…', 1.6);
  await sleep(1.6); if (S !== my) return;
  clawd.say('fuu—', 1.2); audio.sfx('whoosh');
  await new Promise(r => tween(.9, e => P.lit = 1 - ease(e), r)); if (S !== my) return;
  for (let k = 0; k < 8; k++) S.smoke.emit(P.wickWorld.x, P.wickWorld.y, P.wickWorld.z, rand(-.03, .03), rand(.1, .2), rand(-.03, .03), rand(2, 3), .65, .65, .7);
  await sleep(1.6); if (S !== my) return;
  shot('behind', { cut: true, k: .5, drift: .6 });
  await sleep(1.4); if (S !== my) return;
  // one by one they lean on Clawd and fall asleep
  const LEANS = [[helpers[0], -.2, -.6, .3], [helpers[1], 1.7, -.62, -.3], [helpers[2], -.94, -.6, .26]];
  for (const [h, x, z, roll] of LEANS) {
    const x0 = h.x, z0 = h.z;
    tween(1.6, e => { const k = ease(e); h.x = h.targetX = lerp(x0, x, k); h.z = lerp(z0, z, k); h.g.rotation.z = roll * k; });
    h.mood('sleep', 999); h.say('z z z', 4); h.sitTarget = 1;
    S.sleepers.push(h.i);
    await sleep(1.5); if (S !== my) return;
  }
  clawd.lookAt(tmp.copy(MOON_DIR).multiplyScalar(80).add(new V3(clawd.x, 1, clawd.z)).clone());
  clawd.blush = 1;
  await sleep(2.2); if (S !== my) return;
  shot('laptop', { cut: true, k: 1, drift: .2 });
  await sleep(1.0); if (S !== my) return;
  await term.typeLine('$ exit', '#e8e2da', .09); if (S !== my) return;
  term.log('logout', '#a79e94'); term.log('[process completed]', '#a79e94');
  await sleep(1.1); if (S !== my) return;
  await new Promise(r => tween(2.4, e => world.screen.material.color.setScalar(1 - .97 * ease(e)), r)); if (S !== my) return;
  await sleep(.9); if (S !== my) return;
  const [p0, l0, fov] = SHOTS.wide();
  cam.shots([{ pos: p0, look: l0, fov, dur: 16, drift: .4, to: { pos: [p0[0] + .3, p0[1] + .9, p0[2] + 3.5], look: l0 } }]);
  if (!S.snapped) { S.snapped = true; await game.snap(); }
  await sleep(1.2); if (S !== my) return;
  helpers.forEach((h, i) => tween(i * .5, () => {}, () => S && h.say('z z z', 6)));
  await sleep(1.2); if (S !== my) return;
  audio.setMood('finale');
  await ui.credits();
}

function diary(result) {
  const R = S?.rec;
  if (result.quit || !R) return {
    jp: 'きょうは さいごの よる。でも はやく ねました。',
    lines: ['It was the last night of the week, but we went to bed early.',
      R && R.rounds.length ? 'We only lit a few. The rest are still in the packet. Maybe next summer.' : 'The sparklers are still in the packet. Maybe next summer.'],
  };
  const lines = ['It was the last night of summer vacation. We sat on the edge of the balcony with one candle and lit senko hanabi.'];
  if (R.completed) lines.push(R.completed === 3 ? 'All three of my sparklers lasted all the way to chiri-giku. I held very, very still.' : `${R.completed === 1 ? 'One' : 'Two'} of my sparklers lasted all the way to chiri-giku. The end goes quiet very slowly.`);
  else lines.push(`My best one reached ${STAGE_NAMES[Math.max(0, R.bestStage)]} before the little fireball fell.`);
  if (R.droopDrops) lines.push('When I let go, it drooped and fell. You have to keep holding.');
  else if (R.drops) lines.push(`The wind blew${R.gusts > 1 ? ' a few times' : ''} and ${R.drops === 1 ? 'one fireball' : `${R.drops} fireballs`} fell. Helper 2 said it was okay.`);
  if (R.helperDrops.length) lines.push(`Helper ${R.helperDrops[0] + 1}'s fell first. It laughed.`);
  lines.push('Afterwards helper 1, helper 2 and helper 3 fell asleep leaning on me. I didn\'t move for a long time.');
  lines.push('Summer was good.');
  return { jp: 'きょうは さいごの よる。みんなで せんこうはなびを しました。おつきさまが きれいでした。', lines };
}

// ───────────── chapter definition ─────────────
export default {
  id: 'senko', day: 5, title: 'Senkō hanabi', jp: '線香花火', short: '花火', weather: 'はれ · まんげつ',
  blurb: 'The last sparklers of summer. Keep your claw very still.',
  jpPreview: 'きょうは せんこうはなび。',
  prompt: 'one last sparkler each', goal: 'one last sparkler each',
  sky: 'moon', mood: 'night', dayLen: Infinity, phase: [1, 1], autoNight: false,
  clock: [22 * 60, 22 * 60], clockNote: '🌕 the last night',
  delegation: false,
  helpers: [{ specName: 'strawberry' }, { specName: 'mint' }, { specName: 'ice' }],
  intro: [
    ['$ git commit -am "summer"'], ['  [day-off 5f3a2c1] summer', '#a79e94'], ['  5 evenings changed, 0 regrets', '#7bd88f'],
    ['$ git push'], ['  everything up-to-date ✦', '#f2c14e'],
  ],
  introShots: [
    { pos: [-1.5, 1.0, 3.6], look: [-14, 9, -50], fov: 42, dur: 3.2, to: { pos: [-1.3, 1.15, 3.1] } },
    { pos: [-3.2, .34, .3], look: [-3.75, .17, -.5], fov: 30, dur: 2.6, to: { pos: [-3.35, .32, .2] } },
    { pos: [2.05, .44, .62], look: [2.6, .06, -.3], fov: 30, dur: 2.4, to: { pos: [2.2, .4, .5] } },
  ],

  setup(root) {
    ui.mount();
    P = buildProps(root);
    S = {
      state: 'intro', round: 0, holding: false, holdSrc: null, ptr: { x: 0, y: 0 }, hand: new V3(), prevHand: new V3(), jolt: 0, moved: 0,
      lightK: 0, igniteT: 0, droopT: 0, sag: 0, roundStage: -1, plan: null,
      windF: new V3(), gust: { wait: 0, t: 0, dur: 1, dir: new V3(1, 0, 0), mag: 0 }, gustCool: 0, nextGust: rand(7, 11), lastRing: world.furin.lastRing,
      snapped: false, saidLife: false, saidWind: false, hintFlash: '', hintFlashT: 0, sleepers: [],
      shot: null, aspect: innerWidth / innerHeight, sndSpark: -1, sndCandle: -1, game: null,
      rec: { rounds: [], helperDrops: [], gusts: 0, bestStage: -1, completed: 0, drops: 0, droopDrops: 0 },
    };
    S.pool = new SparkPool(root);
    S.embers = new Particles({ parent: root, max: 700, size: .024, additive: true, gravity: -2.4, drag: 1.3, fog: false });
    S.smoke = new Particles({ parent: root, max: 420, size: .3, additive: true, gravity: .22, drag: 1.6, opacity: .07 });
    S.pool.onLand = (x, z) => S.embers.emit(x, .01, z, rand(-.25, .25), rand(.15, .4), rand(-.25, .25), rand(.08, .18), 1, .55, .2);
    S.mine = new Sparkler(root, S.pool, S.embers, S.smoke, { scale: 1, len: .27, fragile: true, spread: 1.85 });
    S.theirs = helpers.map(() => new Sparkler(root, S.pool, S.embers, S.smoke, { scale: .8, len: .2, spread: 1.6 }));
    S.mine.onStage = onMyStage;
    S.mine.onDrop = onMyDrop;
    S.mine.onCrackle = () => audio.sfx('crackle', { gap: .05 });
    S.theirs.forEach((s, i) => s.onDrop = cause => { if (cause === 'wobble') onTheirDrop(i); });
    [S.mine, ...S.theirs].forEach(s => s.g.visible = false);
    world.screen.material.color.setScalar(1);
    S.onBlur = () => endHold('any');
    S.onUp = () => endHold('pointer');
    addEventListener('blur', S.onBlur); addEventListener('pointerup', S.onUp); addEventListener('pointercancel', S.onUp);
    // the lanterns are dimmed for the sparklers; scene.onBeforeRender runs after sky.update and before lights are set up
    S.dim = 1; S.dimTarget = 1; S.prevOBR = scene.onBeforeRender;
    scene.onBeforeRender = (...a) => { S?.prevOBR?.(...a); const L = sky.lights?.lantern; if (S && L) L.intensity *= S.dim; };
    if (G.dev.has('day')) window.__senko = { get S() { return S; }, get P() { return P; } };
  },
  stations: {},
  start,

  update(dt) {
    if (!S) return;
    const t = G.time;
    updateProps(P, dt, t);
    if (S.shot && Math.abs(innerWidth / innerHeight - S.aspect) > .05) shot(S.shot, { cut: true });
    updateWind(dt);
    S.theirs.forEach((s, i) => {
      if (!s.g.visible) return;
      clawPoint(helpers[i], s.hand); handAnchor(helpers[i], s.anchor); s.anchor.y += Math.sin(t * 1.1 + i * 2) * .004;
      s.update(dt, S.windF);
    });
    if (S.mine.g.visible) { myAnchor(dt); S.mine.update(dt, S.windF); }
    S.pool.update(dt);
    if (S.hintFlashT > 0) S.hintFlashT -= dt;
    S.dimTarget = S.state === 'ending' ? .22 : S.state === 'intro' || S.state === 'gather' ? 1 : S.state === 'burning' ? .3 : .45;
    S.dim += (S.dimTarget - S.dim) * Math.min(1, dt * 1.2);
    // sound: one crackle bed for all four, a softer one for the candle
    const lv = [S.mine, ...S.theirs].reduce((a, s, i) => a + (s.burning ? [.3, 1, .6, .25][Math.max(0, s.stage)] * (i ? .45 : 1) : 0), 0);
    const spark = Math.round(clamp(lv, 0, 1) * 20) / 20, candle = Math.round(P.lit * 10) / 10 * .5;
    if (spark !== S.sndSpark) { S.sndSpark = spark; audio.loop('sparkler', spark); }
    if (candle !== S.sndCandle) { S.sndCandle = candle; audio.loop('candle', candle); }
    if (G.mode === 'play') playLogic(dt, S.game);
  },

  pointer(type, e) {
    if (!S || G.mode !== 'play') return false;
    if (type === 'down') { startHold('pointer', e.clientX, e.clientY); return true; }
    if (type === 'move') { if (S.holding && S.holdSrc === 'pointer') moveHold(e.clientX, e.clientY); return true; }
    if (type === 'up') { endHold('pointer'); return true; }
    return false;
  },
  key(e, dir) {
    if (!S || G.mode !== 'play' || e.code !== 'Space') return false;
    e.preventDefault();
    if (dir === 'down' && !e.repeat && !S.holding) startHold('key');
    if (dir === 'up') endHold('key');
    return true;
  },

  hint() {
    if (!S) return '';
    if (S.hintFlashT > 0) return S.hintFlash;
    switch (S.state) {
      case 'ready': return S.round === 1 ? `press and hold to light your sparkler${isTouch() ? '' : ' · space works too'}` : `press and hold to light the next one · ${ROUNDS - S.round + 1} left`;
      case 'lighting': return 'hold it in the flame…';
      case 'burning':
        if (!S.mine.burning) return S.mine.completed ? '' : 'watch theirs';
        if (!S.holding) return 'keep holding — it droops when you let go';
        if (S.mine.meter > .45) return 'steady…';
        if (S.gust.t > 0 || S.gust.wait > 0) return 'a breeze… stay still';
        return '';
    }
    return '';
  },

  ending,
  diary,

  teardown() {
    if (!S) return;
    audio.loop('sparkler', 0); audio.loop('candle', 0);
    removeEventListener('blur', S.onBlur); removeEventListener('pointerup', S.onUp); removeEventListener('pointercancel', S.onUp);
    [S.mine, ...S.theirs].forEach(s => s.dispose());
    S.pool.dispose(); S.embers.dispose(); S.smoke.dispose(); P.pigSmoke.dispose(); P.steam.dispose();
    ui.unmount();
    crew.forEach(c => { c.g.rotation.z = 0; c.lookAt(null); });
    world.screen.material.color.setScalar(1);
    scene.onBeforeRender = S.prevOBR || function () {};
    S = null; P = null;
  },

  ls: () => ['senko_hanabi/  candle  bucket.water  kayari_buta  uchiwa  moon'],
  review: () => 'LGTM ✦ nothing to change tonight.',
  commands: {
    'cat recipe.md': () => [
      '# senkō hanabi (線香花火)',
      'the quietest firework: a twist of washi paper with a pinch of powder in the tip.',
      '- let it hang and hold still. the glowing bead is the hinotama (火の玉).',
      '- 牡丹 botan → 松葉 matsuba → 柳 yanagi → 散り菊 chiri-giku',
      '- keep a bucket of water close.',
      '- tradition: see whose lasts the longest.',
    ],
    'cat moon': () => '🌕 (it is full tonight)',
  },
};

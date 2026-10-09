// Sketch: 花火師 Hanabi-shi, the firework maker. Sunday night on the balcony, no jobs: design a
// shell star by star at the bench, test fire it over the city, put it on the rack with the
// helpers' shells, then run the show one beat at a time. A shell can be sent as a link; opening
// one plays "a firework from a friend" before the bench.
import { V3 } from '../core/gfx.js';
import { G, emit } from '../core/state.js';
import { rand, clamp, lerp, ease, pick, isTouch } from '../core/util.js';
import { tween, sleep, until } from '../core/tween.js';
import { clawd, helpers, crew } from '../core/crab.js';
import { audio } from '../core/audio.js';
import { E } from '../core/audio/engine.js';
import { MOODS } from '../core/audio/music.js';
import { term } from '../core/terminal.js';
import { cam } from '../core/camera.js';
import { hud } from '../core/hud.js';
import { sky } from '../core/sky.js';
import { held } from '../core/input.js';
import { firework, sparkle, puff } from '../core/fx.js';
import * as D from './hanabi/design.js';
import { build, setSlot, paintFace, resetFace, BENCH_X, RACK_X, SLOT_XZ } from './hanabi/props.js';
import * as UI from './hanabi/ui.js';

const YOU = [5, 6, 7];
const LINEUP = [
  { d: D.YAESHIN, who: 'classic', by: '八重芯 classic' },
  { d: D.SNOWFLAKE, who: 2, by: '🧊 helper 3' },
  { d: D.WILLOW, who: 1, by: '🌿 helper 2' },
  { d: D.STRAWBERRY, who: 0, by: '🍓 helper 1' },
  { d: D.KAMURO, who: 'classic', by: '錦冠 classic' },
];
const HELPER_SHELL = [3, 2, 1];   // helper index → rack slot
const HELPER_SAYS = ['my strawberry ✦ watch for the seeds', 'a willow… it falls slowly', 'a snowflake! cold fire ✦'];
// where everyone stands to watch: the middle of the sky stays clear for your shell
const CREW_SPOTS = [[0, -2.7], [1, -1.35], [-1, 1.55], [2, 2.85]];

let S = null, P = null, game_ = null, giftSeen = false;
let bench = null, rackCard = null, giftCard = null, shareCard = null, con = null, testPill = null;

const low = () => sky.tier === 'low';
const narrow = () => innerWidth <= 700;
const mineCount = () => YOU.filter(i => P.slots[i].design).length;

// ── the beat: read the music's bar clock so taps and bursts land on it ──
function beatInfo() {
  const b = E.live, ms = b?.state?.music;
  if (b && b.ctx.state === 'running' && ms?.cur && MOODS[ms.cur]) {
    const beat = 60 / MOODS[ms.cur].bpm;
    return { beat, ph: (((b.ctx.currentTime - ms.nextBar) / beat) % 1 + 1) % 1 };
  }
  const beat = 60 / 84;
  return { beat, ph: (performance.now() / 1000 / beat) % 1 };
}

// ── camera ──
function benchShot(cut = false) {
  if (narrow()) cam.shot(new V3(BENCH_X - .3, 2.5, 3.3), new V3(BENCH_X - .35, -.75, -.5), { k: 2.2, cut, fov: 44 });
  else cam.shot(new V3(BENCH_X + 1.9, 1.85, 4.2), new V3(BENCH_X - .25, .35, -.5), { k: 2.2, cut });
}
// looking straight at a burst at (x, y, z): telephoto on wide screens so the shell fills the sky
// low enough that the lantern string stays above the frame
const BURST_Y = 15.5, BURST_Z = -88;
// pictures burst wider than shells (and a gold frame wider still): start them a little lower
const lift = d => d.mode === 1 ? (d.frame ? -3.5 : -1.5) : 0;
function skyShot(x, k = 2.4) { cam.shot(new V3(x, 1.3, 7.0), new V3(x, 5.2, -40), { k, drift: .3, fov: narrow() ? 50 : 30 }); }
function showShot() {
  if (narrow()) cam.shot(new V3(0, 1.25, 5.0), new V3(0, 4.4, -40), { k: 1.1, drift: .35, fov: 50 });
  else cam.shot(new V3(0, 1.4, 7.4), new V3(0, 4.2, -40), { k: 1.1, drift: .35, fov: 40 });
}

// ── the bench ──
function openBench() {
  if (bench || S.phase !== 'workshop') return;
  closeCards();
  hud.hide(['#todo', '#hint', '#clock']);
  clawd.workAnim = 'write'; clawd.faceOverride = -1.2;
  benchShot();
  bench = UI.openBench(S, {
    label: () => S.replyTo ? `one back for “${S.replyTo}”` : S.editing != null ? `shell ${S.editing - 4} of 3 · on the rack` : `a new shell · ${mineCount()}/3 on the rack`,
    onChange: () => { S.dirty = true; },
    onClose: closeBench,
    onTest: d => testFire(d, { who: clawd }),
    onLoad: loadShell,
    onShare: shareOpen,
    surprise: () => D.surprise(),
    fresh: mode => { S.editing = null; return D.blank(mode); },
  });
  S.dirty = true;
}
function closeBench() {
  if (!bench) return;
  bench.close(); bench = null;
  clawd.workAnim = null; clawd.faceOverride = null;
  if (S.phase === 'workshop') { hud.show(['#todo', '#hint', '#clock']); cam.play(); }
}

function loadShell(d) {
  if (!D.starCount(d)) return;
  let i = S.editing ?? YOU.find(k => !P.slots[k].design);
  const replaced = i == null;
  if (i == null) i = YOU[2];
  setSlot(P, i, D.clone(d), 'you'); P.slots[i].byLabel = 'you ✦';
  S.editing = i; S.loads++;
  const s = P.slots[i];
  tween(.5, e => s.g.scale.setScalar(Math.max(.01, (1 - Math.pow(1 - e, 3)) * (1 + Math.sin(e * Math.PI) * .25))));
  const [sx, sz] = SLOT_XZ[i - 0];
  sparkle(RACK_X + sx, .7, sz, 16, [1, .85, .5]); puff(RACK_X + sx, .55, sz, 5);
  audio.sfx('clunk', { delay: .05 }); audio.sfx('select', { delay: .15 });
  closeBench();
  clawd.say(replaced ? 'swapped onto the rack ✦' : 'on the rack ✦', 2); clawd.mood('happy', 1.5);
  const n = mineCount();
  hud.toast(n >= 3 ? 'three shells on the rack · start the show when you\'re ready' : `on the rack (${n}/3) · make another, or start the show at the rack`, { dur: 3.4 });
  term.log(`$ git add shells/${D.displayName(d).replace(/\s+/g, '-')}.json  ✓`, '#7bd88f');
}

// ── test fire: up it goes, the camera looks up, then back to the bench ──
async function testFire(d, { who = clawd } = {}) {
  if (S.testing || !D.starCount(d)) return;
  S.testing = true; S.skipTest = false; S.tests++;
  bench?.hide(true); rackCard?.el.classList.add('off'); giftCard?.el.classList.add('off');
  hud.hide(['#todo', '#hint']);
  testPill = UI.pill(bench ? '↩ back to the bench' : '↩ back', () => { S.skipTest = true; });
  const x0 = clamp(cam.pos.x, -6, 6);
  skyShot(x0);
  crew.forEach(c => { if (c.g.visible) { c.faceOverride = Math.PI; c.lookAt?.(null); } });
  if (who !== clawd) who.mood('focus', 1.5);
  await sleep(.5);
  let burst = false;
  firework({ type: 'stars', stars: D.starsOf(d, { low: low() }), x: x0, y: BURST_Y + lift(d), z: BURST_Z, onBurst: () => {
    burst = true;
    tween(.35, () => {}, () => {
      if (who !== clawd) { who.say('✦', 1.4); who.mood('happy', 2); helpers.forEach(h => h !== who && h.g.visible && Math.random() < .6 && h.mood('wow', 1.4)); }
      else { clawd.mood('wow', 1.6); const h = pick(helpers.filter(h => h.g.visible)); h?.say(pick(['おお〜', 'わあ…', 'ooh ✦', 'again!']), 1.6); }
    });
  } });
  await until(() => !S || S.skipTest, 4.6 + (d.mode === 0 && d.fx.includes(2) ? 1.2 : 0));
  if (!S) return;
  testPill?.close(); testPill = null;
  crew.forEach(c => { c.faceOverride = null; });
  if (bench) { benchShot(); bench.hide(false); clawd.faceOverride = -1.2; }
  else { cam.play(); if (S.phase === 'workshop') hud.show(['#todo', '#hint']); }
  rackCard?.el.classList.remove('off'); giftCard?.el.classList.remove('off');
  if (!burst && who === clawd) clawd.say('hm, still climbing', 1.2);
  S.testing = false;
}

// ── the rack card ──
function openRack() {
  if (S.phase !== 'workshop') return;
  closeBench(); closeCards();
  rackCard = UI.openRack(P.slots, {
    onClose: closeCards,
    onTest: i => { const s = P.slots[i]; if (!s.design) return; if (typeof s.who === 'number') { helpers[s.who].say(HELPER_SAYS[s.who], 2); testFire(s.design, { who: helpers[s.who] }); } else testFire(s.design, { who: clawd }); },
    onEdit: i => { closeCards(); S.design = D.clone(P.slots[i].design); S.editing = i; S.undo = []; game_.playerGo('bench'); },
    onStart: () => { closeCards(); startShow(); },
  });
}
function closeCards() {
  rackCard?.close(); rackCard = null;
  giftCard?.close(); giftCard = null;
  shareCard?.close(); shareCard = null;
}

// ── sharing ──
function shareURL(d) { return `${location.origin}${location.pathname}?fw=${D.encode(d)}`; }
function shareOpen(d) {
  shareCard?.close();
  shareCard = UI.openShare(d, shareURL(d), { onClose: () => { shareCard?.close(); shareCard = null; }, onShared: () => { S.shared = true; emit('sticker', 'gift'); } });
}

// ── helpers show off their own shells ──
function helperShow(h) {
  if (S.testing || S.phase !== 'workshop') return;
  const i = HELPER_SHELL[h.i], s = P.slots[i];
  if (!s?.design) return;
  h.say(HELPER_SAYS[h.i], 2.2); h.hop(.3);
  testFire(s.design, { who: h });
}

// ── the show ──
function startShow() {
  if (!mineCount()) { clawd.say('a shell of my own first ✦', 2); return; }
  closeBench(); closeCards();
  game_.finish({ complete: true });
}

async function runShow(game) {
  S.phase = 'show';
  term.log('$ hanabi --show tonight', '#f2c14e');
  audio.setMood('festival');
  sky.lanternScale = .55;
  await game.gather(CREW_SPOTS.map(([i, x]) => [i < 0 ? clawd : helpers[i], x, .62]), { timeout: 3.2 });
  crew.forEach(c => { c.faceOverride = Math.PI; c.workAnim = null; });
  const p0 = G.phase; tween(3, e => G.phase = lerp(p0, 1, ease(e)));
  showShot();
  await sleep(1.6);
  if (!S) return;
  const list = P.slots.map((s, i) => ({ ...s, i })).filter(s => s.design);
  const lastMine = Math.max(...list.filter(s => s.who === 'you').map(s => s.i));
  const span = Math.max(3, Math.min(20, halfWidth() - 9));
  let next = 0, lastFire = G.time, mine = false, mineDone = false, autoAt = null;
  con = UI.openShow(list, { onFire: () => fire() });
  con.setNext(0);
  S.fire = () => fire();

  function launch(s, { size = 1, trails = 1, x, y } = {}) {
    const { beat } = beatInfo();
    firework({ type: 'stars', stars: D.starsOf(s.design, { low: low() || trails < 1 }), x: x ?? 0, y: y ?? rand(12, 15.5) + lift(s.design), z: rand(-86, -92), size, trails, rise: beat * 2, onBurst: () => onBurst(s) });
    P.slots[s.i].g.visible = false;
  }
  function onBurst(s) {
    if (!S) return;
    if (s.who === 'you') {
      crew.forEach((c, k) => tween(k * .12, () => {}, () => { c.mood('wow', 1.8); if (c !== clawd) c.say(pick(['!!', 'that\'s yours ✦', 'わあ…']), 1.6); }));
      clawd.blush = 1;
      if (s.i === lastMine && !S.snapped) { S.snapped = true; tween(.55, () => {}, () => game.snap()); }
    } else if (typeof s.who === 'number') { const h = helpers[s.who]; h.say('that\'s mine ✦', 1.6); h.hop(.4); }
    else if (Math.random() < .5) { const h = pick(helpers); h.say(pick(['たまや〜!', 'かぎや〜!']), 1.5); }
  }
  function fire() {
    if (!S || mineDone) return;
    const { beat, ph } = beatInfo(), off = Math.min(ph, 1 - ph);
    lastFire = G.time; autoAt = null;
    con.hit();
    if (mine) { mineDone = true; starMine(); return; }
    if (next >= list.length) return;
    const s = list[next], side = next % 2 ? 1 : -1;
    const good = off < .12, ok = off < .24;
    if (good) { S.onBeat++; con.judge('✦ on the beat'); } else if (ok) con.judge('nice');
    S.fired++;
    launch(s, { size: good ? 1.12 : 1, x: side * span * rand(.25, .9) * (next === list.length - 1 ? 0 : 1) });
    next++;
    con.setNext(next);
    if (next >= list.length) { mine = true; tween(beat * 3, () => {}, () => con && con.mine(true, 'the finale: one more press ✦')); }
  }
  async function starMine() {
    con.tip('スターマイン ✦');
    const { beat } = beatInfo(), shots = low() ? 12 : 18;
    for (let k = 0; k < shots && S; k++) {
      const s = pick(list);
      firework({ type: 'stars', stars: D.starsOf(s.design, { low: true }), x: rand(-span - 4, span + 4), y: rand(10, 19), z: rand(-84, -96), size: rand(.75, 1.05), trails: .4, rise: beat * 2 });
      if (k % 3 === 2) firework({ type: pick(['peony', 'chrysanthemum', 'ring']), x: rand(-span - 6, span + 6), y: rand(9, 16), z: rand(-84, -94) });
      await sleep(beat / 2);
    }
    if (!S) return;
    await sleep(3.4);
    S.showDone = true;
  }
  // nobody fires for a while: the barge goes ahead on the next beat
  S.showTick = () => {
    if (!con || mineDone) return;
    const { ph } = beatInfo();
    con.beat(ph);
    if (G.time - lastFire > 6.5 && autoAt == null) { autoAt = G.time; con.tip(isTouch() ? 'tap the button ✦' : 'press space, or click the button ✦'); }
    if (autoAt != null && G.time - autoAt > 3 && (ph < .06 || ph > .97)) fire();
  };
  await until(() => !S || S.showDone, 120);
  if (!S) return;
  S.showTick = null;
  con.close(); con = null;
  if (!S.snapped) await game.snap();
  crew.forEach((c, k) => tween(k * .15, () => {}, () => { c.faceOverride = 0; c.mood('happy', 99); c.hop(.6); c.say(k === 2 ? 'ahh ✦' : pick(['たまや〜!', '✦', 'again!']), 1.8); }));
  cam.shot(new V3(0, 2.1, 6.4), new V3(0, 1.9, 0), { k: 1.2 });
  await sleep(2.2);
  // send yours to someone
  const last = P.slots[lastMine]?.design;
  if (last && S) {
    await new Promise(r => {
      shareCard = UI.openShare(last, shareURL(last), { onClose: () => { shareCard?.close(); shareCard = null; r(); }, onShared: () => { S.shared = true; emit('sticker', 'gift'); } });
      const x = shareCard.el.querySelector('.hb-x'); if (x) { x.textContent = 'done ✦'; x.className = 'hb-btn go'; x.style.flex = 'none'; }
    });
  }
}
// half the visible width at the fireworks' distance, in the show framing
function halfWidth() { return 92 * Math.tan((narrow() ? 25 : 20) * Math.PI / 180) * innerWidth / innerHeight; }

// ── a firework from a friend ──
async function giftIntro(game) {
  giftSeen = true;
  G.phase = .995;
  const skip = G.dev.has('skip');
  CREW_SPOTS.forEach(([i, x]) => { const c = i < 0 ? clawd : helpers[i]; c.g.visible = true; c.x = c.targetX = x; c.z = .62; c.faceOverride = Math.PI; });
  showShot(); cam.pos.copy(cam.tpos); cam.look.copy(cam.tlook);
  audio.setMood('night');
  await sleep(skip ? .3 : 1.2);
  hud.toast(`🎆 someone sent you a firework · “${D.displayName(S.gift)}”`, { dur: 4 });
  await sleep(skip ? .3 : 1.4);
  const go = () => firework({ type: 'stars', stars: D.starsOf(S.gift, { low: low() }), x: 0, y: BURST_Y + lift(S.gift), z: BURST_Z, size: 1.08, onBurst: () => tween(.4, () => {}, () => crew.forEach((c, k) => tween(k * .1, () => {}, () => { c.mood('wow', 2); if (k === 1) c.say('わあ…', 1.6); }))) });
  go();
  await sleep(skip ? 1.5 : 4.6);
  if (!S) return;
  if (!skip) { go(); await sleep(4.4); }
  crew.forEach(c => { c.faceOverride = null; });
  clawd.say('one back, then ✦', 2);
  cam.play();
  await sleep(.6);
  S.showGiftCard = true;
}
function giftCardOpen() {
  closeCards();
  giftCard = UI.openGift(S.gift, {
    onWatch: () => testFire(S.gift, { who: clawd }),
    onReply: () => { closeCards(); S.replyTo = D.displayName(S.gift); game_.playerGo('bench'); },
  });
}

function shapedLike(d) {
  const n = D.displayName(d), named = !!(d.name || '').trim(), article = /^(a|an|the|my) /i.test(n);
  if (d.mode === 1) return article ? `a firework shaped like ${n}` : `a firework shaped like “${n}”`;
  return !named || article ? n : `a firework called “${n}”`;
}

// ───────────── chapter ─────────────
export default {
  id: 'hanabi', day: 7, title: 'Hanabi-shi', jp: '花火師', short: '花火師', weather: 'はれ',
  blurb: 'Make a firework of your own, then send it to a friend.',
  jpPreview: 'きょうは はなびを つくる。',
  prompt: 'design tonight\'s fireworks', goal: 'design tonight\'s fireworks',
  sky: 'clear', mood: 'day', dayLen: Infinity, autoNight: false, phase: [.95, .95],
  clock: [950, 1200], clockNote: '🎆 the show starts when you\'re ready',
  delegation: false,
  chatter: [
    { p: .958, who: 2, text: 'I can smell the gunpowder ✦' },
    { p: .968, who: 'clawd', text: 'almost dark enough' },
    { p: .978, who: 1, text: 'the river is full of boats' },
  ],
  intro: [['$ git log --oneline -1'], ['  a1b2c3d sunday: nothing scheduled', '#a79e94'], ['$ open bench/'], ['  hanabi workshop ready ✦', '#f2c14e']],
  get introRun() { return S?.gift && !giftSeen ? giftIntro : undefined; },
  introSays() {
    helpers[0].say('I made a strawberry ✦', 2.4);
    setTimeout(() => helpers[2]?.say('mine\'s a secret', 2.2), 900);
  },

  setup(root, game) {
    game_ = game;
    S = { design: D.blank(0), color: 1, undo: [], editing: null, phase: 'workshop', tests: 0, loads: 0, fired: 0, onBeat: 0, shared: false, gift: null, dirty: true, replyTo: null };
    resetFace();
    P = build(root);
    LINEUP.forEach((l, i) => { setSlot(P, i, D.clone(l.d), l.who); P.slots[i].byLabel = l.by; });
    const code = G.dev.get('fw');
    if (code) {
      S.gift = D.decode(code); if (!S.gift) S.badGift = true;
      // a gift plays once; replaying the evening from the diary is your own
      G.dev.delete('fw');
      try { history.replaceState(null, '', location.pathname + (G.dev.toString() ? `?${G.dev}` : '') + location.hash); } catch { /* sandboxed */ }
    }
  },

  stations: () => ({
    bench: { name: 'firework bench', spot: BENCH_X - 1.2, hit: [2.3, 1.3, 1.1, BENCH_X + .25, .55, -.5], ring: [BENCH_X + .25, -.5, 1.45],
      tip: () => `firework bench · ${mineCount() ? 'make another, or tweak yours' : 'design your shell'}`, keywords: ['bench', 'shell', 'design', 'star'] },
    rack: { name: 'shell rack', spot: RACK_X - 1.3, hit: [1.9, 1.2, 1.0, RACK_X, .5, -.55], ring: [RACK_X, -.55, 1.3],
      tip: () => `the rack · ${P.slots.filter(s => s.design).length}/8 shells${mineCount() ? ' · start the show' : ''}`, keywords: ['rack', 'show', 'launch'] },
  }),
  interact(k) {
    if (k === 'bench') openBench();
    if (k === 'rack') openRack();
  },
  highlight: () => bench || rackCard ? [] : mineCount() ? ['rack'] : ['bench'],

  todo() {
    const stars = D.starCount(S.design);
    return [
      { label: 'pack a shell with stars', done: stars >= 6 || mineCount() > 0, detail: stars ? `${stars}★` : '' },
      { label: 'test fire it', done: S.tests > 0 },
      { label: 'put it on the rack', done: mineCount() > 0, detail: `${mineCount()}/3` },
      { label: 'start the show', done: false, blocked: !mineCount(), detail: mineCount() ? '← at the rack' : '' },
    ];
  },
  hint() {
    if (S.testing) return '';
    if (!mineCount() && !D.starCount(S.design)) return 'click the firework bench to design tonight\'s shell · click a helper to see theirs';
    if (!mineCount()) return 'test fire it, then put it on the rack';
    return 'make another (up to 3), or start the show at the rack';
  },

  start() {
    [[0, -5.35, .5], [1, 5.35, .62], [2, 6.05, .5]].forEach(([i, x, z]) => { const h = helpers[i]; if (h.g.visible) { h.targetX = x; h.z = z; } });
    if (S.badGift) hud.toast('a firework was sent, but it got wet on the way (the link is broken)', { dur: 4 });
    if (S.showGiftCard) giftCardOpen();
  },

  update(dt) {
    if (!S) return;
    if (S.dirty) { S.dirty = false; paintFace(P, S.design); }
    if (G.mode === 'play' && S.phase === 'workshop') {
      if (G.phase < .985) G.phase = Math.min(.985, G.phase + dt / 240 * .035);
      if (bench) held.a = held.d = held.arrowleft = held.arrowright = false;
    }
    S.showTick && S.showTick();
  },

  pointer(type, e, ray) {
    if (!S) return false;
    if (S.phase === 'show') { if (type === 'down' && S.fire) S.fire(); return true; }
    if (S.testing) { if (type === 'down') S.skipTest = true; return true; }
    if (type === 'down') { S.down = [e.clientX, e.clientY]; return false; }
    if (type === 'up' && S.down && Math.hypot(e.clientX - S.down[0], e.clientY - S.down[1]) < 10) {
      S.down = null;
      const ms = []; helpers.forEach(h => h.g.visible && h.g.traverse(o => { if (o.isMesh && o !== h.sel && o.visible) ms.push(o); }));
      const hit = ray.intersectObjects(ms, false)[0];
      if (hit) { helperShow(hit.object.userData.crab); return true; }
    }
    return false;
  },
  key(e, dir) {
    if (!S) return false;
    const sp = e.code === 'Space';
    if (S.phase === 'show') { if (dir === 'down' && (sp || e.key === 'Enter')) { e.preventDefault(); if (!e.repeat && S.fire) S.fire(); } return sp || e.key === 'Enter'; }
    if (S.testing) { if (dir === 'down' && (sp || e.key === 'Escape')) { e.preventDefault(); S.skipTest = true; } return sp || e.key === 'Escape'; }
    if (bench) {
      if (dir === 'down' && e.key === 'Escape') { closeBench(); return true; }
      if (dir === 'down' && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); document.getElementById('hb-undo')?.click(); return true; }
      if (sp) { e.preventDefault(); return true; }
    }
    if ((rackCard || shareCard || giftCard) && dir === 'down' && e.key === 'Escape') { closeCards(); return true; }
    return false;
  },

  async ending(result, game) {
    closeBench(); closeCards(); testPill?.close(); testPill = null;
    if (result.quit) { clawd.say('another night ✦', 1.5); await sleep(1); return; }
    await runShow(game);
    if (S) result.perfect = S.fired > 0 && S.onBeat >= Math.ceil(S.fired * .5);
  },

  diary(result) {
    const mine = YOU.map(i => P.slots[i].design).filter(Boolean);
    const lines = [];
    if (mine.length === 1) lines.push(`Today I made ${shapedLike(mine[0])}.`);
    else if (mine.length > 1) lines.push(`Today I made ${mine.length} fireworks: ${mine.map(shapedLike).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`);
    if (S.gift) lines.push(`Someone sent me ${shapedLike(S.gift)}${mine.length ? ', so I made one back' : ''}.`);
    lines.push(`The helpers made a strawberry, a willow and a snowflake. ${S.onBeat ? `${S.onBeat === S.fired ? 'Every shell' : `${S.onBeat} of ${S.fired} shells`} went up right on the beat, then` : 'At the end there was'} a star mine, and the whole sky was full.`);
    if (S.shared) lines.push('I sent mine to a friend. I hope they make one back.');
    return { jp: 'きょうは はなびを つくりました。わたしの はなびが そらに さきました。', lines };
  },
  stats: () => `${mineCount()} shell${mineCount() === 1 ? '' : 's'} of my own · ${S.tests} test fire${S.tests === 1 ? '' : 's'} · ${S.onBeat}/${S.fired} on the beat${S.shared ? ' · sent one' : ''}`,

  teardown() {
    bench?.close(); bench = null; closeCards(); con?.close(); con = null; testPill?.close(); testPill = null;
    UI.clearUI();
    S = null; P = null;
  },

  ls: () => ['bench/  stars/{Sr,Ca,Na,Ba,Cu,Mg}  paste.pot  rack/  shells/*.json'],
  review: () => !S ? 'nothing to review' : mineCount() ? `LGTM ✦ ${mineCount()} shell${mineCount() === 1 ? '' : 's'} on the rack` : 'changes requested: needs more stars',
  commands: {
    'cat recipe.md': () => [
      '# 割物 warimono (a round japanese shell)',
      '1. line two paper hemispheres with stars (星), the little pellets that burn a color',
      '2. fill the middle with burst charge: rice hulls coated in black powder',
      '3. close it and paste kraft paper strips over it, layer after layer, for days (玉貼り)',
      '4. the layout of the stars is the shape in the sky; that\'s why japanese shells burst round',
      '- the colors are metals: strontium red, barium green, copper blue, sodium gold',
      '- purple is red and blue in one star, and the hardest to get right',
    ],
    'cat shell.json': () => {
      const d = S?.design; if (!d) return 'cat: shell.json: no such file';
      return d.mode === 0
        ? [`{ "name": "${D.displayName(d)}", "type": "割物",`, ...d.rings.map((r, i) => `  "ring${i + 1}": "${r.map(c => c ? D.COLORS[c].el : '·').join(' ')}"  (${D.EFFECTS[d.fx[i]].name})`), `  "core": "${d.core ? D.COLORS[d.core].el : '·'}" }`]
        : [`{ "name": "${D.displayName(d)}", "type": "型物", "stars": ${D.starCount(d)} }`];
    },
  },
};

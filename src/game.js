// The chapter runner: title → diary → an evening (intro at the laptop, play, ending) → diary page.
// Chapters are plain objects (see DESIGN.md, "Chapter contract"); this file drives them.
import { G, resetStats } from './core/state.js';
import { THREE, V3, scene, mesh, box, hitMat, COL } from './core/gfx.js';
import { $, clamp, rand, pick, lerp, easeOutBack } from './core/util.js';
import { tween, sleep, until } from './core/tween.js';
import { crew, clawd, helpers, PERSONA } from './core/crab.js';
import { assign, helperTick, cancelAction, unassign, jobDef, jobDone, lock, unlock, lockedBy, credit } from './core/agents.js';
import { hud } from './core/hud.js';
import { term } from './core/terminal.js';
import { cam } from './core/camera.js';
import { sky } from './core/sky.js';
import { world } from './core/world.js';
import { audio } from './core/audio.js';
import { diary } from './core/diary.js';
import { save } from './core/save.js';
import { mini } from './core/minigames.js';
import { settings } from './core/settings.js';
import { award, setStickerToast } from './core/stickers.js';
import { firework, sparkle, puff, disposeUnder } from './core/fx.js';
import { initInput, setHits, held, pointer } from './core/input.js';
import { CHAPTERS } from './chapters/index.js';

const ringMat = new THREE.MeshBasicMaterial({ color: COL.orange, transparent: true, opacity: .7, depthWrite: false, toneMapped: false });
let root = null, rings = {}, finishResolve = null, introTap = null, hover = null, runId = 0, snapWaiters = [], lastPhoto = null, chapterCmds = [];
const LANDING = [-6.95, -6.25, -5.55];

export const game = {
  CHAPTERS,
  get root() { return root; },
  get running() { return !!G.chapter; },

  async boot() {
    save.load();
    applySettings();
    settings.init();
    diary.init(CHAPTERS, def => game.run(def));
    setStickerToast(html => hud.toast(html, { dur: 3 }));
    clawd.reset({ x: -6.8, z: .55, face: -2.0 }); clawd.faceOverride = -2.0;
    helpers.forEach(h => h.reset({ visible: false }));
    const d = +G.dev.get('day');
    if (d && CHAPTERS[d - 1]) { game.run(CHAPTERS[d - 1]); return; }
    diary.showTitle();
  },

  // ── an evening ──
  async run(def) {
    const my = ++runId;
    audio.init();
    await fade(1, .45);
    if (my !== runId) return;
    teardown();
    diary.hide();
    G.chapter = def; G.locks = {}; G.t = 0; G.selected = null; G.effort = 0; resetStats(); lastPhoto = null; G.polaroid = null;
    chatter = (def.chatter || DEFAULT_CHATTER).map(c => ({ ...c, done: false }));
    G.speed = +(G.dev.get('speed') || 1);
    G.phase = def.phase?.[0] ?? 0;
    sky.setPreset(def.sky || 'clear');
    audio.setMood(def.mood || 'day'); audio.setAmbience({});
    root = new THREE.Group(); root.name = def.id; scene.add(root);
    clawd.reset({ x: -6.8, z: .55, face: -2.0 }); clawd.faceOverride = -2.0;
    helpers.forEach((h, i) => { h.reset({ visible: false, z: [.45, .7, .5][i] }); h.setRole({ ...PERSONA[i], spec: [], ...(def.helpers?.[i] || {}) }); });
    def.setup(root, game);
    G.stations = (typeof def.stations === 'function' ? def.stations(game) : def.stations) || {};
    buildStations();
    hud.setup(def);
    term.clearScreen();
    for (const [k, fn] of Object.entries(def.commands || {})) { term.register(k, fn, ''); chapterCmds.push(k); }

    G.mode = 'intro';
    fade(0, .8);
    if (def.introRun) await def.introRun(game); else await intro(def, my);
    if (my !== runId) return;

    G.mode = 'play';
    hud.show();
    if (def.delegation === false) hud.hide(['#crew']);
    if (!def.todo) hud.hide(['#todo']);
    def.start && def.start(game);
    if (!save.data.seenTips && def.delegation !== false) {
      save.data.seenTips = true; save.write();
      const tips = ['click a station to do the job yourself', 'or click a helper, then a station, to delegate it', 'specialists ✦ work twice as fast · press / for the terminal'];
      tips.forEach((t, i) => tween(1.2 + i * 3.4, () => {}, () => G.mode === 'play' && hud.toast(t, { dur: 3.2 })));
    }
    const result = await new Promise(r => finishResolve = r);
    if (my !== runId) return;

    G.mode = 'ending'; G.endPhase = G.phase;
    hud.hide(); mini.close(true); select(null); term.close(); hover = null; hud.tip(null);
    helpers.forEach(h => { if (h.job) unassign(h); h.speed = Math.max(h.speed, 2.6); });
    clawd.pending = null;
    try { await def.ending(result, game); } catch (e) { console.error(e); }
    if (my !== runId) return;
    if (result.quit) {
      // ending early doesn't fill in the diary page or unlock tomorrow
      audio.setMood('quiet');
      diary.showBook(def);
      return;
    }
    const photo = lastPhoto || await game.snap();
    const text = def.diary ? def.diary(result, G.stats) : { jp: '', lines: [] };
    const stamp = result.stamp || (result.complete ? (result.perfect ? 'perfect' : 'good') : 'tried');
    helpers.forEach((h, i) => { const m = save.data.helpers[i]; m.tasks += G.stats.byHelper[i]; m.days += 1; });
    if (!result.quit) {
      if (result.complete && G.stats.deleg === 0 && def.delegation !== false) award('diy');
      if (result.complete && G.stats.tasksYou === 0 && G.stats.tasksHelpers > 0) award('manager');
      if (result.night) award('nightowl');
      if (stamp === 'perfect') award('perfect');
    }
    save.setDay(def.id, { done: true, complete: !!result.complete, stamp, photo, text, stats: statsLine(result), at: Date.now(), ...(G.polaroid ? { polaroid: G.polaroid } : {}) });
    if (CHAPTERS.every(c => save.day(c.id)?.done)) award('week');
    await sleep(.6);
    if (my !== runId) return;
    audio.setMood('quiet');
    diary.showBook(def, { fresh: true });
  },

  finish(result = {}) { if (finishResolve) { const r = finishResolve; finishResolve = null; r(result); } },

  // capture a photo for the diary on the next rendered frame
  snap() { return game.capture().then(p => (lastPhoto = p)); },
  // a frame grab that doesn't become the evening's photo
  capture() { return new Promise(r => snapWaiters.push(r)); },
  afterRender() { if (snapWaiters.length) { const p = diary.capture(); snapWaiters.splice(0).forEach(f => f(p)); } },

  // walk the crew to x positions; resolves when everyone has arrived (or after timeout)
  async gather(spots, { face = null, timeout = 4, speed = 3 } = {}) {
    for (const [c, x, z] of spots) { c.wake(); c.targetX = x; if (z != null) c.z = z; c.speed = Math.max(c.speed, speed); c.faceOverride = null; }
    await until(() => spots.every(([c]) => c.arrived()), timeout);
    if (face != null) spots.forEach(([c]) => c.faceOverride = face);
  },

  // player works a station: takes the lock, opens a minigame, releases on close
  work(key, open) {
    const o = lockedBy(key, clawd);
    if (o) { clawd.say(`${o.name} is on it`); return null; }
    lock(key, clawd);
    clawd.action = { kind: 'player', verb: key }; clawd.faceOverride = -.6;
    const c = open();
    if (!c) { unlock(key, clawd); clawd.action = null; clawd.faceOverride = null; return null; }
    const inner = c.close;
    c.close = (cancelled) => { inner(cancelled); unlock(key, clawd); clawd.action = null; clawd.workAnim = null; clawd.faceOverride = null; };
    return c;
  },

  playerGo, select, spotOf, credit, firework, sparkle, puff, assign, lock, unlock, lockedBy,
  spawnHelper, clockText: p => hud.clockText(p),
  update,
};

// ── intro: Clawd at the laptop finishing work, then the prompt, then helpers ──
async function intro(def, my) {
  const skip = { skip: G.dev.has('skip') };
  const skipBtn = $('#skip'); skipBtn.classList.remove('hidden');
  skipBtn.onclick = () => { skip.skip = true; introTap && introTap(); };
  if (def.introShots && !skip.skip) await cam.shots(def.introShots, skip);
  if (my !== runId) return;
  // after an opening shot list, cut to the laptop rather than flying through the set
  cam.shot(...introFrame(), { k: 1.6, cut: !!def.introShots && !skip.skip });
  clawd.mood('focus', 99);
  const lines = def.intro || [['$ npm test'], ['  ✓ 42 passing', '#7bd88f'], ['$ git push'], ['  done for today ✦', '#f2c14e']];
  await sleep(skip.skip ? .1 : .6);
  for (const [t, c] of lines) {
    if (skip.skip) { term.log(t, c || '#e8e2da'); continue; }
    if (t.startsWith('$')) await term.typeLine(t, c || '#e8e2da'); else { term.log(t, c || '#e8e2da'); audio.sfx('pop'); }
    await sleep(.4);
  }
  // a stretch after closing the work for the day
  clawd.mood('happy', 1.8); clawd.workAnim = 'cheer'; clawd.faceOverride = .3;
  if (!skip.skip) { await sleep(1.1); clawd.say('ahh ✦', 1.2); await sleep(.5); }
  clawd.workAnim = null; clawd.faceOverride = -2.0;
  term.log('> ', '#d97757');
  if (!skip.skip) {
    clawd.say('press enter ↵ (or tap)', 99);
    await new Promise(r => introTap = () => { introTap = null; r(); });
    clawd.bubT = 0;
  }
  if (my !== runId) return;
  for (const ch of def.prompt) { term.amendLast(ch); if (!skip.skip) { audio.sfx('type'); await sleep(.05); } }
  await sleep(skip.skip ? .05 : .4);
  const count = def.helperCount ?? 3;
  const returning = Object.values(save.data.days).some(d => d.done);
  if (count > 0) term.log(returning ? '  resuming helpers from yesterday…' : '  spawning helpers…', '#a79e94');
  await sleep(skip.skip ? .05 : .5);
  for (let i = 0; i < count; i++) {
    const h = helpers[i], mem = save.data.helpers[i];
    term.log(`  ◆ ${h.name}  ${h.specName}${returning && mem.tasks ? `  · ${mem.tasks} task${mem.tasks === 1 ? '' : 's'} remembered` : ''}`, '#d97757');
    spawnHelper(h, LANDING[i]);
    await sleep(skip.skip ? .15 : .55);
  }
  clawd.mood('happy', 2); clawd.faceOverride = null;
  await sleep(skip.skip ? .3 : .8);
  cam.play();
  skipBtn.classList.add('hidden');
  await sleep(skip.skip ? .2 : 1.2);
  if (def.introSays) def.introSays(game);
}
// full-screen fade between evenings (real time, so it works while the game clock is reset)
function fade(to, dur) {
  const f = $('#fade');
  return new Promise(r => { f.style.transitionDuration = dur + 's'; f.style.opacity = to; setTimeout(r, dur * 1000); });
}

function introFrame() {
  if (innerWidth < innerHeight) return [new V3(-8.2, 2.1, 7.6), new V3(-8.2, .7, -.4)];
  return [new V3(-8.75, 1.45, 3.4), new V3(-8.3, .5, -.4)];
}

function spawnHelper(h, landX) {
  h.g.visible = true; audio.sfx('pop');
  const from = new V3(-8.5, .55, -.6), toZ = h.z;
  h.x = from.x; h.targetX = landX; h.speed = 0;
  tween(.7, e => {
    h.x = lerp(from.x, landX, e); h.y = lerp(from.y, 0, e) + Math.sin(e * Math.PI) * 1.1; h.z = lerp(from.z, toZ, e);
    h.g.scale.setScalar(h.scale * Math.min(1, e * 1.6 + .1) * (1 + Math.sin(e * Math.PI) * .15));
  }, () => { h.y = 0; h.z = toZ; h.speed = h.baseSpeed; h.g.scale.setScalar(h.scale); h.hop(.5); h.squash = 1; h.mood('happy', 1.2); audio.sfx('clunk'); });
}

// ── stations ──
function spotOf(k) {
  if (k === 'laptop') return world.LAPTOP.spot;
  const s = G.stations[k]; if (!s) return clawd.x;
  return typeof s.spot === 'function' ? s.spot() : s.spot;
}
function buildStations() {
  const list = [world.laptopHit];
  rings = {};
  for (const [k, s] of Object.entries(G.stations)) {
    if (s.hitObj) { const o = typeof s.hitObj === 'function' ? s.hitObj() : s.hitObj; o.userData.station = k; list.push(o); }
    else if (s.hit) { const [w, h, d, x, y, z] = s.hit; const m = mesh(box(w, h, d), hitMat, x, y, z, root, false); m.userData.station = k; list.push(m); }
    const r = new THREE.Mesh(new THREE.RingGeometry(.5, .6, 40), ringMat.clone()); r.rotation.x = -Math.PI / 2; r.visible = false; root.add(r); rings[k] = r;
  }
  setHits(list);
}
function ringOf(k) {
  const s = G.stations[k];
  if (!s) return null;
  if (s.ring) return typeof s.ring === 'function' ? s.ring() : s.ring;
  return [spotOf(k), .1, 1];
}

// ── player ──
function playerGo(k) {
  mini.close(true);
  clawd.wake();
  clawd.pending = k;
  clawd.targetX = clamp(spotOf(k), -9.8, 9.8);
}
function playerInteract(k) {
  const def = G.chapter;
  if (k === 'laptop' && !(def.stations && G.stations.laptop)) { clawd.faceOverride = -2.0; term.open(); setTimeout(() => clawd.faceOverride = null, 1200); return; }
  def.interact && def.interact(k, game);
}
function select(h) {
  G.selected = h; helpers.forEach(x => x.sel.visible = x === h);
  if (h) { h.wake(); h.say(h.job ? `on ${jobDef(h.job)?.label || h.job} — reassign?` : 'awaiting instructions…', 1.8); audio.sfx('select'); }
  hud.renderCrew();
}

// ── input handlers ──
initInput({
  introTap() { introTap && introTap(); },
  hover(hit, e) {
    hover = hit;
    const def = G.chapter;
    let txt = '';
    if (hit?.station) { const s = G.stations[hit.station]; txt = hit.station === 'laptop' ? 'laptop · open the terminal' : s ? (s.tip ? s.tip() : s.name) : ''; }
    else if (hit?.crab && hit.crab !== clawd) txt = `${hit.crab.name} · ${hit.crab.icon} ${hit.crab.specName}${def?.delegation === false ? '' : ' — click to select'}`;
    else if (hit?.crab) txt = 'clawd (you)';
    hud.tip(e && e.pointerType !== 'touch' ? txt : '', e?.clientX, e?.clientY);
    $('#c').style.cursor = hit ? 'pointer' : 'default';
  },
  click(hit) {
    const def = G.chapter; if (!def) return;
    if (hit?.crab && hit.crab !== clawd) {
      if (def.delegation === false) { const h = hit.crab; h.say(pick(h.voice) || '✦'); h.hop(.3); return; }
      select(G.selected === hit.crab ? null : hit.crab); return;
    }
    if (hit?.crab === clawd) { select(null); clawd.say(pick(['✦', 'hi', 'day off!', '(◕ᴗ◕)', 'mm, summer'])); clawd.hop(.4); return; }
    if (hit?.station) {
      let k = def.redirect ? (def.redirect(hit.station) || hit.station) : hit.station;
      if (G.selected) { assign(G.selected, k); select(null); }
      else playerGo(k);
      return;
    }
    select(null);
  },
  key(e) {
    if (G.mode === 'intro' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); introTap && introTap(); return; }
    if (G.mode !== 'play') return;
    if (e.repeat && e.code === 'Space') { e.preventDefault(); return; }
    if (e.code === 'Space') { e.preventDefault(); G.mini && G.mini.act(); return; }
    if (e.key === 'Escape') { mini.close(true); select(null); return; }
    if (e.key === '/' || e.key === '`') { e.preventDefault(); term.open(); return; }
    if (['1', '2', '3'].includes(e.key) && G.chapter.delegation !== false) { const h = helpers[+e.key - 1]; if (h.g.visible) select(G.selected === h ? null : h); return; }
    if (e.key === 'p' || e.key === 'P') { takePolaroid(); return; }
    if (e.key === 'm' || e.key === 'M') { const m = audio.mute(); hud.toast(m ? 'sound off' : 'sound on', { dur: 1.2 }); syncMute(); return; }
    if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') {
      let best = null, bd = 1.3;
      for (const k of Object.keys(G.stations)) { const d = Math.abs(spotOf(k) - clawd.x); if (d < bd) { bd = d; best = k; } }
      if (Math.abs(world.LAPTOP.spot - clawd.x) < bd) best = 'laptop';
      if (best) playerGo(best);
    }
  },
});

// ambient lines as the sky changes; who: 'clawd' or a helper index
const DEFAULT_CHATTER = [
  { p: .46, who: 'clawd', text: 'golden hour ✦' },
  { p: .64, who: 1, text: 'the sky is going pink' },
  { p: .8, who: 2, text: 'lanterns are on!' },
  { p: .92, who: 0, text: 'the first star ✦' },
];
let chatter = [];
function runChatter() {
  for (const c of chatter) {
    if (c.done || G.phase < c.p) continue;
    c.done = true;
    const who = c.who === 'clawd' ? clawd : helpers[c.who];
    if (who && who.g.visible && who.bubT <= 0 && !who.asleep) who.say(c.text, 2.6);
  }
}

// polaroid: the player's own photo, taped onto tonight's diary page
async function takePolaroid() {
  if (G.mode !== 'play' && G.mode !== 'ending') return;
  const f = $('#flash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 120);
  audio.sfx('shutter');
  G.polaroid = await game.capture();
  hud.toast('📷 taped into tonight\'s diary page', { dur: 2 });
  award('polaroid');
}
audio.register('shutter', () => { audio.noise(.05, 'highpass', 3000, .25); audio.noise(.08, 'bandpass', 1200, .15, 1, { delay: .07 }); });
$('#cam').onclick = e => { e.stopPropagation(); takePolaroid(); };

// ── per-frame ──
let wasWalking = false;
function update(dt) {
  if (G.effort > 0) G.effort -= dt;
  const def = G.chapter;
  if (G.mode === 'play' && def) {
    G.t += dt;
    const [p0, p1] = def.phase || [0, 1];
    if (G.dev.has('phase')) G.phase = +G.dev.get('phase');
    else if (def.dayLen !== Infinity) {
      G.phase = Math.min(p1, p0 + (G.t / (def.dayLen || 180)) * (p1 - p0));
      if (G.phase >= p1 && def.autoNight !== false) game.finish({ complete: false, night: true });
    }
    const L = held['a'] || held['arrowleft'], R = held['d'] || held['arrowright'];
    if (L || R) { mini.close(true); clawd.pending = null; clawd.targetX = clamp(clawd.x + (L ? -1 : 1), -9.6, 9.6); }
    else if (wasWalking && !clawd.pending && !G.mini) clawd.targetX = clawd.x;
    wasWalking = L || R;
    if (clawd.pending && clawd.arrived()) { const k = clawd.pending; clawd.pending = null; playerInteract(k); }
    runChatter();
    if (helpers.filter(h => h.action).length >= 3) award('parallel');
    if (def.delegation !== false) helpers.forEach(h => h.g.visible && helperTick(h, dt));
    if (G.mini) { G.stats.you += dt; G.mini.update(dt); }
  }
  if (def && def.update) { try { def.update(dt, game); } catch (e) { console.error(e); } }
  // station rings: hovered station, or every open job while a helper is selected
  const suggest = G.mode === 'play' && def?.highlight ? def.highlight() : null;
  for (const k in rings) {
    const r = rings[k], s = G.stations[k];
    const show = G.mode === 'play' && (hover?.station === k || (G.selected && s?.job && !jobDone(s.job)) || (suggest && suggest.includes(k)));
    r.visible = !!show;
    if (show) { const [x, z, sc = 1] = ringOf(k); r.position.set(x, .012, z); r.scale.setScalar(sc); r.material.opacity = (hover?.station === k ? .85 : .35) + Math.sin(G.time * 5) * .12; }
  }
}

function statsLine(result) {
  const s = G.stats;
  return `${result.complete ? 'finished' : 'night fell'} at ${hud.clockText(G.endPhase ?? G.phase)} · you ${s.tasksYou} tasks · helpers ${s.tasksHelpers} · ${s.deleg} delegations`;
}

function teardown() {
  const def = G.chapter;
  if (def) {
    try { def.teardown && def.teardown(game); } catch (e) { console.error(e); }
    helpers.forEach(h => { cancelAction(h); h.job = null; });
  }
  mini.close(true); select(null); term.close();
  audio.stopLoops && audio.stopLoops();
  chapterCmds.forEach(k => term.unregister(k)); chapterCmds = [];
  if (root) {
    disposeUnder(root);
    scene.remove(root);
    root.traverse(o => { if (o.isMesh || o.isPoints) { o.geometry?.dispose?.(); } });
    root = null;
  }
  finishResolve = null; introTap = null;
  hud.hide(); setHits([world.laptopHit]);
  G.chapter = null; G.stations = {};
}

// ── settings & mute ──
function syncMute() { const b = $('#mute'); if (b) b.textContent = audio.muted ? '♪ sound off' : '♪ sound on'; }
function applySettings() {
  const v = save.setting('volumes'); if (v) audio.setVolumes(v);
  if (save.setting('muted')) audio.mute(true);
  syncMute();
}
$('#mute').onclick = e => { e.stopPropagation(); const m = audio.mute(); save.setting('muted', m); syncMute(); };
$('#gear').onclick = e => { e.stopPropagation(); settings.open(); };
diary.onSettings = () => settings.open();
settings.onEndEvening = () => { if (G.mode === 'play') { mini.close(true); game.finish({ complete: false, quit: true }); } };
$('#menu').onclick = e => { e.stopPropagation(); if (G.mode === 'play') { mini.close(true); game.finish({ complete: false, quit: true }); } };

// ── terminal: gameplay commands & natural-language delegation ──
term.onDelegate = (i, text) => {
  const h = helpers[i];
  if (!h || !h.g.visible || G.mode !== 'play') return { t: `${h ? h.name : 'that helper'} isn't here right now`, c: '#f7d488' };
  if (G.chapter.delegation === false) return { t: 'tonight is for resting. nobody has a job.', c: '#a79e94' };
  const words = text.toLowerCase().split(/[^a-z0-9ōū]+/).filter(Boolean);
  let best = null, bs = 0;
  for (const [k, s] of Object.entries(G.stations)) {
    if (!s.job) continue;
    const hay = `${k} ${s.name} ${jobDef(s.job)?.label || ''} ${(s.keywords || []).join(' ')}`.toLowerCase();
    const sc = words.reduce((a, w) => a + (w.length > 2 && hay.includes(w) ? 1 : 0), 0);
    if (sc > bs) { bs = sc; best = k; }
  }
  if (!best) return { t: `${h.name}: ??? (try: ${Object.values(G.stations).filter(s => s.job).map(s => s.name).join(', ')})`, c: '#f7d488' };
  return assign(h, best) ? { t: `${h.name} ▸ ${jobDef(G.stations[best].job)?.label}`, c: '#7bd88f' } : { t: `${h.name} can't take that one right now`, c: '#f7d488' };
};
const R = (k, fn, help, o) => term.register(k, fn, help, o);
R('/agents', () => helpers.map((h, i) => {
  const m = save.data.helpers[i], job = h.job ? jobDef(h.job)?.label : null;
  return { t: `◆ ${h.name.padEnd(9)} ${h.icon} ${h.specName.padEnd(15)} ${h.g.visible ? (h.asleep ? 'asleep' : h.action ? '▸ ' + (h.action.verb || '') : job ? '→ ' + job : 'idle') : 'not spawned'}  · ${m.tasks + (G.stats?.byHelper[i] || 0)} tasks all week`, c: '#e8e2da' };
}), 'list your helpers');
R('/tasks', () => G.chapter?.todo ? G.chapter.todo().map(r => ({ t: `${r.done ? '✓' : '☐'} ${r.label}`, c: r.done ? '#7bd88f' : '#e8e2da' })) : 'no tasks tonight. just the sky.', 'tonight\'s todo list');
R('/todo', a => term.run('/tasks'), '', { hidden: true });
R('/effort', a => {
  if ((a[0] || '') === 'max') { award('effort'); G.effort = 30; crew.forEach(c => c.g.visible && c.hop(.5)); return { t: 'effort set to max for 30s. everyone moves 1.5× faster. (it\'s still a day off.)', c: '#f2c14e' }; }
  return 'usage: /effort max';
}, 'try: /effort max');
R('/model', () => 'you are talking to clawd. it has always been clawd.', 'which model is this');
R('/cost', () => ({ t: 'total cost: $0.00 · it\'s a day off', c: '#7bd88f' }), 'session cost');
R('/init', () => ['wrote CLAWD.md:', '  # CLAWD.md', '  - days off are for resting', '  - delegate the cranking', '  - always save a spoon for helper 3'], 'write CLAWD.md');
R('/review', () => G.chapter?.review ? G.chapter.review() : 'LGTM ✦ (1 nit: more syrup)', 'review tonight\'s work');
R('/compact', () => { const d = Object.keys(save.data.days).length; return { t: `✓ compacted ${d} evening${d === 1 ? '' : 's'} into one warm feeling`, c: '#7bd88f' }; }, 'compact the conversation');
R('/bug', () => 'no bugs on the balcony. (a mosquito drifts past, unbothered)', 'report a bug');
R('/vim', () => 'vim mode enabled. good luck getting out.', 'toggle vim mode');
R('/permissions', () => 'allow: everything. it\'s summer.', 'view permissions');
R('/resume', () => { setTimeout(() => { if (G.mode !== 'play') diary.showBook(); }, 200); return G.mode === 'play' ? 'finish the evening first — the diary waits.' : 'opening the diary…'; }, 'open the diary');
R('/memory', () => {
  const H = save.data.helpers, out = [{ t: '# CLAWD.md (memory)', c: '#f2c14e' }, '- days off are for resting', '- delegate the cranking'];
  helpers.forEach((h, i) => out.push(`- ${h.name} ${h.icon} remembers ${H[i].tasks} task${H[i].tasks === 1 ? '' : 's'} across ${H[i].days} evening${H[i].days === 1 ? '' : 's'}`));
  const w = save.data.wishes || []; if (w.length) out.push(`- wished for: "${w[w.length - 1].text}"`);
  return out;
}, 'what everyone remembers');
R('cat wishes.txt', () => { const w = save.data.wishes || []; return w.length ? w.map(x => ({ t: `🎋 ${x.text}`, c: '#9fd3ff' })) : 'cat: wishes.txt: not yet. (thursday)'; }, '', { hidden: true });
R('make', a => G.chapter && G.mode === 'play' ? `already on it ✦ (${G.chapter.goal || G.chapter.prompt})` : 'make: *** no evening in progress. stop.', '', { hidden: true });
R('/sound', () => { const m = audio.mute(); save.setting('muted', m); syncMute(); return m ? 'sound off' : 'sound on'; }, 'toggle sound');
R('ls', () => G.chapter?.ls ? G.chapter.ls() : 'laptop/  lanterns/  furin  plant.tsx', 'list files');
R('pwd', () => '/home/clawd/balcony', '', { hidden: true });
R('whoami', () => 'clawd (on a day off)', '', { hidden: true });
R('date', () => `${new Date(2026, 7, 2 + (G.chapter?.day || 1)).toDateString()} · ${hud.clockText()}`, '', { hidden: true });
R('weather', () => `${sky.preset} · wind ${(world.wind * 3).toFixed(1)} m/s · ${G.phase < .6 ? 'warm' : 'cooling off'}`, 'check the sky');
R('git status', () => ['On branch day-off', 'nothing to commit, working tree clean ✦'], '', { hidden: true });
R('git log', () => {
  const rows = CHAPTERS.map(c => ({ c, e: save.day(c.id) })).filter(r => r.e?.done);
  if (!rows.length) return 'fatal: your current branch \'day-off\' does not have any commits yet';
  return rows.reverse().map(({ c, e }) => ({ t: `${Math.abs(hash(c.id)).toString(16).slice(0, 7)} day ${c.day}: ${c.title.toLowerCase()} — ${e.complete ? 'shipped ✦' : 'mostly shipped'}`, c: '#f2c14e' }));
}, 'the week so far');
R('git push', () => 'Everything up-to-date. (go outside.)', '', { hidden: true });
R('npm test', () => ({ t: '✓ 42 passing', c: '#7bd88f' }), '', { hidden: true });
R('npm run dev', () => 'already running: the sun', '', { hidden: true });
R('sudo', () => ({ t: 'clawd is not in the sudoers file. this incident will be reported to helper 2.', c: '#f7d488' }), '', { hidden: true });
R('rm', () => 'nice try.', '', { hidden: true });
R('ping', () => 'pong ✦', '', { hidden: true });
R('claude', () => 'you\'re already here.', '', { hidden: true });
R('ultrathink', () => { clawd.say('…', 1.5); setTimeout(() => clawd.say('…kakigōri.', 2), 1500); return 'thinking very hard…'; }, '', { hidden: true });
R('fortune', () => pick(HAIKU), 'a summer haiku');
R('crabsay', a => (award('crabsay'), crabsay)(a.join(' ') || 'day off ✦'), 'like cowsay');
R('cowsay', a => crabsay(a.join(' ') || 'moo? no. day off.'), '', { hidden: true });
R('hanabi', () => { if (G.mode !== 'play' && G.mode !== 'ending') return 'not now'; firework({ y: rand(16, 26) }); award('hanabi'); return 'たまや〜!'; }, 'launch a firework');
R('fireworks', () => term.run('hanabi'), '', { hidden: true });
R('tamaya', () => { helpers.forEach((h, i) => h.g.visible && setTimeout(() => h.say('かぎや〜!', 1.8), i * 200)); return 'たまや〜!'; }, '', { hidden: true });
R('sl', () => { award('train'); trainPass(); return '🚃 …gatan goton… gatan goton…'; }, 'steam locomotive');
R('/skip', () => { if (G.mode === 'play') game.finish({ complete: G.chapter?.ready?.() ?? false }); return 'skipping to the end of the evening'; }, '', { hidden: true });
R('/speed', a => { G.speed = clamp(+a[0] || 1, .25, 8); return `time scale ${G.speed}×`; }, '', { hidden: true });

const HAIKU = [
  'summer evening / the shaved ice melts faster / than we can talk',
  'cicadas fall quiet — / one lantern, then another, / blinks on down the street',
  'a wind chime rings once / and the whole balcony / remembers the breeze',
  'helper three asleep / spoon still in its little claw / fireworks somewhere',
  'tests passing, laptop / closed. the sky does a long / slow git push to pink',
  'distant train crossing / kan-kan-kan, then only / the ice in the glass',
];
function crabsay(msg) {
  const line = '─'.repeat(msg.length + 2);
  return [`╭${line}╮`, `│ ${msg} │`, `╰${line}╯`, '   \\', '    ▐▛███▜▌', '   ▝▜█████▛▘', '     ▘▘ ▝▝'].map(t => ({ t, c: '#d97757' }));
}
function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h * 2654435761; }

// a little train crossing the city far below (sl easter egg + ambience)
const trainMat = new THREE.MeshLambertMaterial({ color: 0xe8e2d0, emissive: 0xffe0a0, emissiveIntensity: .4 });
function trainPass() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(box(6, 2.2, 2.6), trainMat); m.position.x = i * 6.6; g.add(m); }
  g.position.set(-200, -19, -70); scene.add(g);
  audio.sfx('crossing');
  tween(16, e => { g.position.x = -200 + e * 400; }, () => scene.remove(g));
}
game.trainPass = trainPass;

// Day 1 — Kakigōri (かき氷). The film's evening: shaved ice for four before the fireworks.
// A production line with one bottleneck (the shaver): fetch ice → crank → slide the bowl →
// pour three syrups → strawberry + mint on top → serve.
import { THREE, V3, mesh, group, box, rbox, cyl, sph, toon, canvasTex, MAT, hitMat } from '../core/gfx.js';
import { G } from '../core/state.js';
import { rand, clamp, lerp, ease, smooth, pick } from '../core/util.js';
import { tween, sleep } from '../core/tween.js';
import { clawd, helpers, crew, iceMat } from '../core/crab.js';
import { lock, unlock, credit } from '../core/agents.js';
import { mini } from '../core/minigames.js';
import { audio } from '../core/audio.js';
import { term } from '../core/terminal.js';
import { cam } from '../core/camera.js';
import { Particles, firework, sparkle, puff } from '../core/fx.js';
import { world } from '../core/world.js';
import { award } from '../core/stickers.js';

const COLORS = { red: '#e8384c', green: '#40c25c', blue: '#3d8fe3' };
const FLAVOR = { red: 'ichigo', green: 'melon', blue: 'blue hawaii' };
const ORDER = ['red', 'green', 'blue'];
const SECT = { red: [-.14, .17], green: [.14, .36], blue: [.33, .6] };
const SHAVER_X = -2.4, RACK_X = 1.8;

let S = null;   // evening state
let P = null;   // props

const blocksNeeded = () => 4 - S.mound - S.hopper - S.inTransit;
const syrDone = () => ORDER.every(c => S.syrOk[c]);
const ready = () => S.mound >= 4 && syrDone() && S.straw === 'placed' && S.mint === 'placed';

// ───────────── props ─────────────
function build(root) {
  P = {};
  // ice tray
  mesh(rbox(1.25, .1, .7, .03), toon(0x9fcfe8), -4.8, .05, -.35, root);
  P.tray = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) P.tray.push(mesh(rbox(.24, .2, .24, .04), iceMat, -4.8 + (i - 1.5) * .28, .17, -.35 + (j - .5) * .29, root));

  // shaver: cast-iron teal with a side crank
  const X = SHAVER_X;
  mesh(rbox(1.5, .12, 1.25, .04), MAT.teal, X, .06, -.4, root);
  mesh(rbox(.26, 2.5, .26, .05), MAT.teal, X, 1.3, -.95, root);
  mesh(rbox(.3, .2, .85, .05), MAT.teal, X, 2.45, -.6, root);
  mesh(rbox(.2, .12, .6, .03), MAT.teal, X, 1.8, -.65, root);
  mesh(cyl(.52, .52, .1, 28), MAT.metal, X, 1.8, -.25, root);
  P.blade = mesh(cyl(.4, .4, .02, 28), toon(0x8a9098), X, 1.74, -.25, root);
  mesh(cyl(.04, .04, .32), MAT.metal, X, 2.28, -.25, root);
  P.hopper = mesh(rbox(.38, .32, .38, .06), iceMat, X, 2.02, -.25, root); P.hopper.visible = false;
  mesh(cyl(.05, .05, .8, 10), MAT.metal, X + .4, 1.3, -.95, root).rotation.z = Math.PI / 2;
  P.crank = group(root, X + .78, 1.3, -.95);
  mesh(rbox(.08, .5, .1, .02), MAT.teal, 0, .22, 0, P.crank);
  mesh(cyl(.07, .07, .26), MAT.red, .14, .44, 0, P.crank).rotation.z = Math.PI / 2;

  // the bowl: footed glass, a snow mound whose texture carries the syrups
  P.bowl = group(root, X, .12, -.25);
  const prof = [[0, 0], [.28, 0], [.3, .03], [.1, .06], [.07, .12], [.08, .2], [.3, .26], [.5, .38], [.58, .5]].map(([a, b]) => new THREE.Vector2(a, b));
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xeaf8ff, transparent: true, opacity: .42, roughness: .05, side: THREE.DoubleSide, depthWrite: false, clearcoat: 1 });
  mesh(new THREE.LatheGeometry(prof, 36), glass, 0, 0, 0, P.bowl, false).renderOrder = 2;
  P.syrupTex = canvasTex(256, 256);
  P.mound = mesh(new THREE.SphereGeometry(.5, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xffffff, { map: P.syrupTex, emissive: 0x9ab0c8, emissiveIntensity: .12 }), 0, .48, 0, P.bowl);
  P.mound.scale.setScalar(.01);
  P.bowlHit = mesh(box(1.3, 1.8, 1.3), hitMat, 0, .8, 0, P.bowl, false);
  P.topStraw = group(P.bowl); P.topStraw.visible = false;
  { const a = strawHalf(); a.rotation.set(0, 0, -.5); a.position.set(-.1, 0, .05); P.topStraw.add(a); const b = strawHalf(); b.rotation.set(0, Math.PI, .4); b.position.set(.12, -.02, -.02); P.topStraw.add(b); }
  P.topMint = mintSprig(); P.bowl.add(P.topMint); P.topMint.visible = false;

  // syrup rack with three hanging bottles
  mesh(box(.14, 3.3, .14), MAT.woodDark, RACK_X - .8, 1.65, -.3, root); mesh(box(.14, 3.3, .14), MAT.woodDark, RACK_X + .8, 1.65, -.3, root);
  mesh(box(1.75, .14, .14), MAT.woodDark, RACK_X, 3.25, -.3, root);
  mesh(cyl(.78, .78, .04, 28), toon(0x9a6a40), RACK_X, .02, -.25, root);
  P.bottles = {}; P.streams = {};
  ORDER.forEach((c, i) => {
    const g = group(root, RACK_X - .38 + i * .38, 2.75, -.3), col = new THREE.Color(COLORS[c]);
    mesh(cyl(.15, .15, .5), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: .88, roughness: .15, emissive: col, emissiveIntensity: .15 }), 0, 0, 0, g);
    const label = canvasTex(128, 64, x => { x.fillStyle = '#fff6ea'; x.fillRect(0, 0, 128, 64); x.fillStyle = COLORS[c]; x.font = '800 30px "M PLUS Rounded 1c", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText({ red: 'いちご', green: 'メロン', blue: 'ハワイ' }[c], 64, 34); });
    mesh(cyl(.153, .153, .2, 20), toon(0xffffff, { map: label }), 0, .02, 0, g).rotation.y = -Math.PI / 2;
    mesh(cyl(.05, .1, .2), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: .9 }), 0, -.34, 0, g);
    mesh(box(.04, .22, .04), MAT.woodDark, 0, .36, 0, g);
    P.bottles[c] = g;
    const s = mesh(cyl(.028, .028, 1, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: .92, toneMapped: false }), 0, 0, 0, root, false);
    s.visible = false; P.streams[c] = s;
  });

  // cutting board, strawberry, knife
  mesh(rbox(1.3, .08, .78, .03), toon(0xe8c9a0), 4.6, .04, -.35, root);
  P.strawWhole = group(root, 4.45, .3, -.35);
  {
    const sp = [[0, -.26], [.12, -.18], [.2, 0], [.19, .12], [.1, .2], [0, .21]].map(([a, b]) => new THREE.Vector2(a, b));
    mesh(new THREE.LatheGeometry(new THREE.SplineCurve(sp).getPoints(28), 36), strawMat(), 0, 0, 0, P.strawWhole);
    mesh(new THREE.ConeGeometry(.15, .07, 6), MAT.leaf, 0, .23, 0, P.strawWhole).rotation.x = Math.PI;
    P.strawWhole.rotation.z = .2;
  }
  P.strawCut = group(root); P.strawCut.visible = false;
  { const a = strawHalf(); a.position.set(4.3, .27, -.35); a.rotation.set(0, .3, Math.PI / 2 + .1); P.strawCut.add(a); const b = strawHalf(); b.position.set(4.62, .27, -.4); b.rotation.set(0, Math.PI - .3, -Math.PI / 2 - .1); P.strawCut.add(b); }
  P.knife = group(root, 4.95, .14, -.2); P.knife.rotation.y = -.5;
  mesh(box(.6, .12, .02), MAT.metal, 0, 0, 0, P.knife); mesh(rbox(.28, .09, .07, .02), MAT.red, .43, 0, 0, P.knife);

  // potted mint
  mesh(cyl(.34, .26, .5), MAT.terracotta, -6.6, .25, -.55, root);
  mesh(cyl(.31, .31, .02), toon(0x4a3326), -6.6, .49, -.55, root, false);
  P.mintLeaves = [];
  const lm = [toon(0x58b85a), toon(0x3f9a48)];
  for (let i = 0; i < 16; i++) {
    const a = i * 2.4, r = rand(.05, .26);
    const m = mesh(sph(.13, 10, 8), lm[i % 2], -6.6 + Math.cos(a) * r, rand(.55, 1.05), -.55 + Math.sin(a) * r, root);
    m.scale.set(1, .42, .72); m.rotation.set(rand(-.5, .5), a, rand(-.4, .4)); P.mintLeaves.push(m);
  }

  // toy blocks with kana, stacked behind the counter like in the film
  const KANA = ['う', 'い', 'さ', 'え', 'き', 'あ', '2', '4', '5', 'お', '1', 'ね'], PASTEL = ['#7fc8a9', '#f2a7b5', '#f7d488', '#8fb8ef', '#c7a6e8', '#f4a875'];
  const kana = (x, y, z, s) => {
    const mats = [];
    for (let f = 0; f < 6; f++) { const bg = pick(PASTEL), ch = pick(KANA); mats.push(toon(0xffffff, { map: canvasTex(128, 128, c => { c.fillStyle = bg; c.fillRect(0, 0, 128, 128); c.fillStyle = '#fff'; c.fillRect(8, 8, 112, 112); c.fillStyle = bg; c.font = '800 78px "M PLUS Rounded 1c", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 64, 70); }) })); }
    const m = new THREE.Mesh(box(s, s, s), mats); m.position.set(x, y, z); m.rotation.y = rand(-.15, .15); m.castShadow = m.receiveShadow = true; root.add(m);
  };
  const s = .36;
  [[-.2, 0], [.18, 0], [.56, 0], [-.01, 1], [.37, 1], [.18, 2]].forEach(([i, row]) => kana(-.55 + i, s / 2 + row * s, -.95, s));
  kana(7.55, s / 2, .1, s);

  // 氷 flag: the kakigōri shop banner, hanging from the beam and moving in the breeze
  const flagTex = canvasTex(256, 320, x => {
    x.fillStyle = '#fbfbf7'; x.fillRect(0, 0, 256, 320);
    x.fillStyle = '#d8343c'; x.font = '800 170px "M PLUS Rounded 1c", serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('氷', 128, 132);
    x.fillStyle = '#2f6fd0';
    for (let k = 0; k < 3; k++) { x.beginPath(); for (let u = 0; u <= 256; u += 4) x.lineTo(u, 252 + k * 22 + Math.sin(u * .06 + k) * 8); x.lineTo(256, 320); x.lineTo(0, 320); x.closePath(); x.globalAlpha = .5 + k * .25; x.fill(); }
    x.globalAlpha = 1;
  });
  P.flagGeo = new THREE.PlaneGeometry(.9, 1.12, 10, 12);
  P.flagBase = P.flagGeo.attributes.position.array.slice();
  P.flag = mesh(P.flagGeo, new THREE.MeshToonMaterial({ map: flagTex, side: THREE.DoubleSide, gradientMap: MAT.wood.gradientMap }), 4.1, 5.2, -1.38, root);
  mesh(cyl(.02, .02, 1.1, 6), MAT.woodDark, 4.1, 5.78, -1.38, root).rotation.z = Math.PI / 2;

  // snow falling from the blade
  P.snow = new Particles({ max: 260, size: .07, gravity: -3, floor: () => Math.max(P.bowl.position.y + .48 + .5 * P.mound.scale.y - .1, 0), parent: root });
  P.mist = new Particles({ max: 120, size: .3, gravity: .25, drag: 1.5, opacity: .25, parent: root });
}
let _strawMat = null;
function strawMat() {
  if (_strawMat) return _strawMat;
  const t = canvasTex(128, 128, x => { x.fillStyle = '#e02a3a'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#ffd54a'; for (let i = 0; i < 70; i++) x.fillRect(Math.random() * 128, Math.random() * 128, 3, 4); });
  return _strawMat = toon(0xffffff, { map: t });
}
const cutMat = toon(0xffb8c0);
function strawHalf() {
  const g = new THREE.Group();
  const s = mesh(new THREE.SphereGeometry(.2, 18, 12, 0, Math.PI), strawMat(), 0, 0, 0, g); s.scale.y = 1.25;
  const f = mesh(new THREE.CircleGeometry(.2, 18), cutMat, 0, 0, 0, g); f.scale.y = 1.25; f.rotation.y = Math.PI;
  return g;
}
function mintSprig() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) { const m = mesh(sph(.11, 10, 8), MAT.leaf, Math.cos(i * 2.1) * .08, .02, Math.sin(i * 2.1) * .08, g); m.scale.set(1, .35, .6); m.rotation.y = i * 2.1; }
  return g;
}

let syrupSig = '';
function drawSyrup() {
  const sig = ORDER.map(c => S.syr[c].toFixed(2)).join();
  if (sig === syrupSig) return; syrupSig = sig;
  const { x } = P.syrupTex.userData, W = 256, H = 256;
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(170,200,230,.35)';
  for (let i = 0; i < 400; i++) x.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  for (const c of ORDER) {
    const amt = S.syr[c]; if (amt <= 0) continue;
    const [u0, u1] = SECT[c];
    for (const off of [0, 1]) {
      const a = (u0 + off) * W, b = (u1 + off) * W, depth = H * clamp(amt, 0, 1) * .8;
      x.beginPath(); x.moveTo(a, 0); x.lineTo(b, 0);
      for (let y = 0; y <= depth; y += 4) x.lineTo(b + Math.sin(y * .25) * 3, y);
      for (let u = b; u >= a; u -= 4) x.lineTo(u, depth + Math.sin(u * .45) * 6 + 4);
      for (let y = depth; y >= 0; y -= 4) x.lineTo(a + Math.sin(y * .25 + 1) * 3, y);
      x.closePath(); x.fillStyle = COLORS[c]; x.globalAlpha = .92; x.fill();
      x.globalAlpha = .35; x.fillStyle = '#fff'; x.fillRect(a + (b - a) * .3, 0, (b - a) * .12, depth * .8); x.globalAlpha = 1;
    }
  }
  P.syrupTex.needsUpdate = true;
}
const moundTop = () => new V3(P.bowl.position.x, P.bowl.position.y + .48 + .5 * P.mound.scale.y, P.bowl.position.z);
function updateTray() { P.tray.forEach((c, i) => c.visible = i < S.trayBlocks); }

// ───────────── events ─────────────
function completeBlock(who) {
  S.crankProg = 0; S.hopper--; S.mound++;
  audio.sfx('chime');
  for (let k = 0; k < 30; k++) P.snow.emit(SHAVER_X + rand(-.4, .4), 1.7, -.25 + rand(-.4, .4), rand(-.3, .3), rand(-1, 0), rand(-.3, .3), rand(.5, 1));
  term.log(`${who.name} ▸ shaved block ${S.mound}/4`, '#9fd3ff');
  credit(who);
  if (S.mound >= 4) onIceDone();
}
function onIceDone() {
  term.log('✓ ice mound complete', '#7bd88f');
  clawd.say('the mound is perfect ✦');
  tween(.7, () => {}, () => {
    S.bowlAt = 'moving'; audio.sfx('slide');
    const x0 = P.bowl.position.x;
    tween(1.6, e => { const k = ease(e); P.bowl.position.x = lerp(x0, RACK_X, k); P.bowl.position.y = lerp(.12, 0, k) + Math.sin(k * Math.PI) * .35; },
      () => { S.bowlAt = 'rack'; audio.sfx('clunk'); tryDeliver(); });
  });
}
function fly(obj, from, to, dur, done) {
  P.root.add(obj); obj.position.copy(from);
  tween(dur, e => { obj.position.lerpVectors(from, to, ease(e)); obj.position.y += Math.sin(e * Math.PI) * 1.4; obj.rotation.y = e * 6; }, () => { P.root.remove(obj); done(); });
}
function tryDeliver() {
  if (S.bowlAt !== 'rack') return;
  if (S.straw === 'sliced') {
    S.straw = 'flying'; P.strawCut.visible = false; const h = strawHalf(); h.scale.setScalar(1.2);
    fly(h, new V3(4.45, .3, -.35), moundTop(), .9, () => { S.straw = 'placed'; P.topStraw.visible = true; audio.sfx('pop'); term.log('✓ strawberry on top', '#7bd88f'); checkAll(); });
  }
  if (S.mint === 'picked') {
    S.mint = 'flying'; const m = mintSprig();
    fly(m, new V3(-6.6, 1, -.55), moundTop(), 1.3, () => { S.mint = 'placed'; P.topMint.visible = true; audio.sfx('pop'); term.log('✓ mint on top', '#7bd88f'); checkAll(); });
  }
}
function onPoured(who, c, q) {
  S.syrOk[c] = true; S.pouring = null; audio.sfx('chime');
  term.log(`${who.name} ▸ poured ${FLAVOR[c]}`, COLORS[c]);
  credit(who); checkAll();
}
function finishSlice(who) {
  S.straw = 'sliced'; P.strawWhole.visible = false; P.strawCut.visible = true; P.knife.position.y = .14; audio.sfx('chime');
  term.log(`${who.name} ▸ sliced the strawberry`, '#ff8a9a'); credit(who); tryDeliver();
}
function finishMint(who) {
  S.mint = 'picked'; P.mintLeaves.slice(0, 4).forEach(l => l.visible = false); audio.sfx('chime');
  term.log(`${who.name} ▸ picked mint`, '#7bd88f'); credit(who); tryDeliver();
}
function checkAll() {
  if (!ready() || G.mode !== 'play') return;
  term.log('✓ kakigōri for four — ready', '#7bd88f');
  clawd.say('ready! click the bowl to serve ✦', 5); clawd.mood('happy', 3);
  helpers.forEach(h => { h.hop(1.2); h.mood('happy', 2); });
  sparkle(P.bowl.position.x, 1.6, P.bowl.position.z, 24);
}

// ───────────── helper jobs ─────────────
const jobs = {
  ice: {
    label: 'shave ice',
    done: () => S.mound >= 4,
    release(h) { if (h.carry) { h.setCarry(false); S.inTransit--; S.trayBlocks++; updateTray(); } },
    plan(h, sp) {
      if (h.carry) {
        if (S.hopper < 2) return { x: -1.1 + .35, start: () => { S.hopper++; S.inTransit--; h.setCarry(false); audio.sfx('clunk'); return null; } };
        return { x: -1.1 + .7, wait: 'hopper full ⋯' };
      }
      if (S.hopper > 0 && S.bowlAt === 'shaver' && !G.locks.shaver) return {
        x: -1.1, start: () => {
          if (!lock('shaver', h)) return null;
          return { kind: 'crank', lock: 'shaver', anim: 'crank', face: -.7, verb: 'shaving', step(dt) {
            if (S.hopper <= 0) return true;
            S.crankProg += dt / (5.4 / sp); S.crankAngle += dt * 7 * sp; S.cranking = .2;
            if (Math.random() < dt * 9) audio.sfx('grind');
            if (S.crankProg >= 1) { completeBlock(h); return true; }
          } };
        } };
      if (blocksNeeded() > 0 && S.trayBlocks > 0) return {
        x: -3.95, start: () => {
          if (blocksNeeded() <= 0) return null;
          S.inTransit++; S.trayBlocks--; updateTray(); audio.sfx('pick');
          let t = 0;
          return { kind: 'pick', anim: 'pick', face: -.7, verb: 'grabbing ice',
            cancel() { S.inTransit--; S.trayBlocks++; updateTray(); },
            step(dt) { t += dt; if (t > .8 / sp) { h.setCarry(true); return true; } } };
        } };
      return { x: h.x, wait: G.locks.shaver ? '⋯ waiting for the shaver' : '⋯' };
    },
  },
  rack: {
    label: 'pour syrups',
    done: syrDone,
    plan(h, sp) {
      if (S.bowlAt !== 'rack') return { x: 3.1 + .5, wait: '⋯ waiting on ice' };
      if (G.locks.rack) return { x: 3.1 + .75, wait: '⋯ my turn next' };
      return {
        x: 3.1, start: () => {
          const c = ORDER.find(c => !S.syrOk[c]); if (!c || !lock('rack', h)) return null;
          S.pouring = c;
          return { kind: 'pour', lock: 'rack', anim: 'pour', face: -.6, verb: `pouring ${FLAVOR[c]}`,
            cancel() { if (S.pouring === c) S.pouring = null; },
            step(dt) {
              S.syr[c] = Math.min(.85, S.syr[c] + dt / (2.6 / sp) * .85);
              if (Math.random() < dt * 6) audio.sfx('pour');
              if (S.syr[c] >= .85) { onPoured(h, c, .8); return true; }
            } };
        } };
    },
  },
  board: {
    label: 'slice strawberry',
    done: () => S.straw !== 'whole',
    plan(h, sp) {
      if (G.locks.board) return { x: 5.75 + .6, wait: '⋯ board is busy' };
      return {
        x: 5.75, start: () => {
          if (!lock('board', h)) return null;
          return { kind: 'slice', lock: 'board', anim: 'chop', face: -.8, verb: 'slicing strawberry', step(dt) {
            S.sliceProg += dt / (4.6 / sp); P.knife.position.y = .14 + Math.abs(Math.sin(G.time * 14)) * .25;
            if (Math.random() < dt * 4) audio.sfx('chop');
            if (S.sliceProg >= 1) { finishSlice(h); return true; }
          } };
        } };
    },
  },
  mint: {
    label: 'pick mint',
    done: () => S.mint !== 'growing',
    plan(h, sp) {
      if (G.locks.mint) return { x: -5.75 + .6, wait: '⋯' };
      return {
        x: -5.75, start: () => {
          if (!lock('mint', h)) return null;
          return { kind: 'mint', lock: 'mint', anim: 'pick', face: -.8, verb: 'picking mint', step(dt) {
            S.mintProg += dt / (2.4 / sp);
            if (Math.random() < dt * 3) audio.sfx('pick');
            if (S.mintProg >= 1) { finishMint(h); return true; }
          } };
        } };
    },
  },
};

// ───────────── player at a station ─────────────
function interact(k, game) {
  switch (k) {
    case 'ice':
      if (clawd.carry) return clawd.say('hands full — to the shaver →');
      if (S.mound >= 4) return clawd.say('ice is done ✓');
      if (blocksNeeded() <= 0) return clawd.say('we have enough ice coming');
      S.trayBlocks--; S.inTransit++; updateTray(); clawd.setCarry(true); audio.sfx('pick');
      clawd.workAnim = 'pick'; tween(.35, () => {}, () => { if (clawd.workAnim === 'pick') clawd.workAnim = null; });
      return clawd.say('got one → shaver');
    case 'shaver': {
      if (S.mound >= 4) return clawd.say('ice is done ✓');
      if (clawd.carry) { if (S.hopper < 2) { S.hopper++; S.inTransit--; clawd.setCarry(false); audio.sfx('clunk'); } else return clawd.say('hopper\'s full'); }
      if (S.hopper <= 0) return clawd.say('need a block from the ice tray ←');
      return game.work('shaver', () => mini.dial({
        title: 'crank the shaver', progress: () => S.crankProg,
        onTurn(f) {
          if (S.hopper <= 0) return;
          S.crankProg += f / 2.2; S.crankAngle += f * Math.PI * 2; S.cranking = .25; clawd.workAnim = 'crank';
          audio.sfx('grind', { gap: .05 });
          if (S.crankProg >= 1) {
            completeBlock(clawd);
            if (S.hopper <= 0 || S.mound >= 4) { mini.close(false); if (S.mound < 4) clawd.say(blocksNeeded() > 0 ? 'need more ice ←' : 'nice'); }
          }
        },
      }));
    }
    case 'rack': {
      if (S.bowlAt !== 'rack') return clawd.say('ice first — then syrups');
      if (syrDone()) return clawd.say('all poured ✓');
      const c = ORDER.find(c => !S.syrOk[c] && S.pouring !== c);
      if (!c) return clawd.say('someone\'s pouring');
      const start = S.syr[c];
      return game.work('rack', () => mini.pour({
        title: `pour <span style="color:${COLORS[c]}">${FLAVOR[c]}</span>`, color: COLORS[c], start,
        onFill(f, holding) { S.syr[c] = Math.min(f, 1); S.pouring = holding ? c : null; clawd.workAnim = holding ? 'pour' : null; if (holding) audio.sfx('pour', { gap: .12 }); },
        onRelease(f, q) { if (q === 1) award('pour'); G.stats.quality.push(q); S.syr[c] = clamp(f, .45, 1); S.pouring = null; onPoured(clawd, c, q); if (q === 1) sparkle(P.bowl.position.x, 1.8, P.bowl.position.z, 16); },
        onClose(cancelled) { S.pouring = null; if (cancelled && !S.syrOk[c]) S.syr[c] = start; },
      }));
    }
    case 'board': {
      if (S.straw !== 'whole') return clawd.say('already sliced ✓');
      return game.work('board', () => mini.timing({
        title: 'slice the strawberry',
        onCut(hit, n, total) { G.stats.quality.push(hit ? 1 : .45); S.sliceProg = n / total; audio.sfx('chop'); S.chop = .2; clawd.workAnim = 'chop'; },
        onDone() { finishSlice(clawd); },
      }));
    }
    case 'mint': {
      if (S.mint !== 'growing') return clawd.say('mint picked ✓');
      return game.work('mint', () => mini.hold({
        title: 'pick the mint', hint: 'hold to pick a sprig', start: S.mintProg,
        onProgress(p, holding) { S.mintProg = p; clawd.workAnim = holding ? 'pick' : null; if (holding) audio.sfx('pick', { gap: .2 }); },
        onDone() { G.stats.quality.push(1); finishMint(clawd); },
      }));
    }
    case 'bowl':
      if (ready()) return game.finish({ complete: true });
      return clawd.say(S.mound < 4 ? 'needs ice first' : !syrDone() ? 'needs syrups' : 'needs toppings');
  }
}

// ───────────── the ending ─────────────
async function ending(result, game) {
  const complete = !!result.complete;
  if (result.quit) { clawd.say('another time ✦'); await sleep(1); return; }
  term.log(complete ? '$ serve --for four' : '🎆 the fireworks are starting!', '#f2c14e');
  if (!complete) { clawd.say('oh! the fireworks!', 2.5); clawd.mood('wow', 2); }
  else { clawd.say('itadakimasu ✦', 2.5); clawd.mood('happy', 2); }
  const bx = P.bowl.position.x;
  await game.gather([[helpers[2], bx - 1.55, .6], [helpers[0], bx - .9, .6], [helpers[1], bx + .9, .6], [clawd, bx + 1.65, .6]], { timeout: 3 });
  const p0 = G.phase; tween(6, e => G.phase = lerp(p0, 1, ease(e)));
  audio.setMood('festival');
  cam.shot(new V3(bx, 2.1, 7.2), new V3(bx, 3.2, -40), { k: 1.2, drift: .5 });
  crew.forEach(c => c.faceOverride = Math.PI);
  await sleep(2.2);
  if (S.mound > 0) crew.forEach(c => { c.spoon.visible = true; c.workAnim = 'eat'; });
  await sleep(2.4);
  // the show: ordinary bursts, then one shaped like Clawd, then a finale
  let fwT = 0, last = G.time, clawdDone = false;
  const show = 15;
  await new Promise(r => tween(show, (e) => {
    fwT -= G.time - last; last = G.time;
    if (!clawdDone && e > .42) {
      clawdDone = true; firework({ type: 'clawd', x: bx, y: 24, z: -85, size: 1.1 });
      tween(2.0, () => {}, () => { game.snap(); award('clawdfw'); helpers.forEach((h, i) => tween(.2 * i, () => {}, () => { h.say('!!', 1.5); h.mood('wow', 1.5); })); });
      fwT = 3.2;
    }
    if (fwT <= 0) { fwT = e > .8 ? rand(.2, .45) : rand(.5, 1.1); firework({ x: bx + rand(-38, 38) }); if (Math.random() < .3) tween(.18, () => {}, () => firework({ x: bx + rand(-38, 38) })); }
    S.eaten = e * .65;
  }, r));
  crew.forEach(c => { c.faceOverride = 0; c.workAnim = null; c.mood('happy', 99); c.hop(.6); c.blush = 1; });
  cam.shot(new V3(bx, 2.2, 6.6), new V3(bx, 2.1, 0), { k: 1.2 });
  for (let i = 0; i < 3; i++) tween(i * .6, () => {}, () => firework({ x: bx + rand(-25, 25), y: rand(12, 20) }));
  await sleep(3.2);
  S.result = { complete };
}

function diary(result) {
  const s = G.stats, by = s.byHelper.slice(0, 3);
  const topI = by.indexOf(Math.max(...by)), top = helpers[topI];
  const poured = ORDER.filter(c => S.syrOk[c]).map(c => FLAVOR[c]);
  const perfectPours = s.quality.filter(q => q === 1).length;
  const lines = [];
  lines.push(result.complete ? 'Today I made kakigōri with helper 1, helper 2 and helper 3. We ate it together on the balcony.' : 'Today we tried to make kakigōri, but the fireworks started before it was done. We ate it anyway.');
  if (s.tasksHelpers > s.tasksYou && by[topI] > 0) lines.push(`${top.name[0].toUpperCase() + top.name.slice(1)} did the most work (${by[topI]} tasks). ${topI === 2 ? 'Ice really is its thing.' : 'I should say thank you.'}`);
  else if (s.tasksYou > 0) lines.push('I did most of it myself. Next time I will let the helpers do more.');
  if (poured.length) lines.push(`The syrups were ${poured.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`);
  if (perfectPours) lines.push(perfectPours > 1 ? 'Two of my pours were perfect.' : 'One of my pours was perfect.');
  lines.push('Then there were fireworks, and one of them looked exactly like me!!');
  return { jp: result.complete ? 'きょうは みんなで かきごおりを たべました。はなびが きれいでした。' : 'きょうは かきごおりを つくりました。はなびが はじまってしまいました。', lines };
}

// ───────────── chapter definition ─────────────
export default {
  id: 'kakigori', day: 1, title: 'Kakigōri', jp: 'かき氷', short: 'かき氷', weather: 'はれ',
  blurb: 'Shaved ice for four, before the fireworks.',
  jpPreview: 'きょうは かきごおりを つくる。',
  prompt: 'make kakigōri for four', goal: 'make kakigōri for four',
  sky: 'clear', mood: 'day', dayLen: 180, phase: [0, 1], clock: [17 * 60, 19 * 60 + 45], clockNote: '🎆 fireworks at 7:45',
  helpers: [
    { spec: ['board'], specName: 'strawberry' },
    { spec: ['mint', 'rack'], specName: 'mint · syrups' },
    { spec: ['ice'], specName: 'ice' },
  ],
  intro: [['$ npm test'], ['  ✓ 42 passing', '#7bd88f'], ['$ git push'], ['  done for today ✦', '#f2c14e']],
  introShots: [
    { pos: [1.5, 1.6, 5.2], look: [0, 6.2, -20], fov: 50, dur: 2.6, to: { pos: [0.8, 1.9, 4.6], look: [0, 6.6, -20] } },
    { pos: [4.05, .52, .5], look: [4.45, .3, -.35], fov: 28, dur: 2.0, to: { pos: [4.2, .48, .35] } },
    { pos: [-4.3, .9, .75], look: [-4.8, .15, -.35], fov: 32, dur: 1.9, to: { pos: [-4.6, .85, .7] } },
    { pos: [2.5, 2.3, 1.7], look: [1.8, 2.75, -.3], fov: 30, dur: 1.9, to: { pos: [2.2, 2.4, 1.6] } },
  ],

  setup(root) {
    S = { mound: 0, crankProg: 0, hopper: 0, trayBlocks: 8, inTransit: 0, crankAngle: 0, cranking: 0, chop: 0,
      syr: { red: 0, green: 0, blue: 0 }, syrOk: { red: false, green: false, blue: false }, pouring: null,
      bowlAt: 'shaver', straw: 'whole', sliceProg: 0, mint: 'growing', mintProg: 0, eaten: 0 };
    syrupSig = '';
    build(root); P.root = root;
    updateTray(); drawSyrup();
  },

  stations: () => ({
    mint: { name: 'mint plant', spot: -5.75, job: 'mint', hit: [1.1, 1.3, 1.1, -6.6, .6, -.5], ring: [-6.6, -.55, 1.15], keywords: ['mint', 'leaf', 'garnish', 'pick'],
      tip: () => `mint plant · ${S.mint === 'growing' ? 'ready to pick' : 'picked ✓'}` },
    ice: { name: 'ice tray', spot: -3.95, job: 'ice', hit: [1.5, .9, 1.1, -4.8, .4, -.35], ring: [-4.8, -.35, 1.15], keywords: ['ice', 'tray', 'block', 'fetch'],
      tip: () => `ice tray · ${S.trayBlocks} cubes` },
    shaver: { name: 'ice shaver', spot: -1.1, job: 'ice', hit: [1.7, 2.8, 1.5, -2.2, 1.3, -.5], ring: [-2.4, -.4, 1.5], keywords: ['shave', 'shaver', 'crank', 'ice', 'snow'],
      tip: () => `ice shaver · ${S.mound}/4 shaved · ${S.hopper} loaded` },
    rack: { name: 'syrup rack', spot: 3.1, job: 'rack', hit: [1.9, 3.4, 1.0, RACK_X, 1.7, -.3], ring: [RACK_X, -.25, 1.5], keywords: ['syrup', 'syrups', 'pour', 'rack', 'flavor'],
      tip: () => `syrups · ${ORDER.map(c => FLAVOR[c] + (S.syrOk[c] ? ' ✓' : '')).join(' · ')}` },
    board: { name: 'cutting board', spot: 5.75, job: 'board', hit: [1.6, 1, 1.1, 4.6, .4, -.35], ring: [4.6, -.35, 1.15], keywords: ['strawberry', 'slice', 'cut', 'board', 'knife'],
      tip: () => `cutting board · strawberry ${S.straw === 'whole' ? 'whole' : 'sliced ✓'}` },
    bowl: { name: 'kakigōri', spot: () => P.bowl.position.x + 1.2, hitObj: () => P.bowlHit, ring: () => [P.bowl.position.x, P.bowl.position.z, 1.15],
      tip: () => ready() ? 'kakigōri for four · click to serve ✦' : 'kakigōri for four' },
  }),
  jobs,
  interact,
  ready,
  // clicking the bowl before it's done goes to whatever it needs next
  redirect: k => k === 'bowl' && !ready() ? (S.bowlAt === 'rack' ? (syrDone() ? 'board' : 'rack') : 'shaver') : k,

  todo() {
    const who = j => { const w = helpers.filter(h => h.job === j).map(h => h.short); if (G.mini && G.locks[{ ice: 'shaver', rack: 'rack', board: 'board', mint: 'mint' }[j]] === clawd) w.unshift('you'); return w; };
    return [
      { label: 'shave ice', done: S.mound >= 4, detail: '▰'.repeat(S.mound) + '▱'.repeat(4 - S.mound), workers: who('ice') },
      { label: 'pour syrups', done: syrDone(), blocked: S.bowlAt !== 'rack', detail: ORDER.map(c => `<i style="color:${COLORS[c]}">${S.syrOk[c] ? '●' : '○'}</i>`).join(''), workers: who('rack') },
      { label: 'slice strawberry', done: S.straw !== 'whole', detail: S.straw === 'placed' ? 'on top' : '', workers: who('board') },
      { label: 'pick mint', done: S.mint !== 'growing', detail: S.mint === 'placed' ? 'on top' : '', workers: who('mint') },
      { label: 'serve for four', done: false, blocked: !ready(), detail: ready() ? '← click the bowl' : '' },
    ];
  },
  hint() {
    if (ready()) return 'everything\'s ready — click the bowl to serve ✦';
    if (G.stats.deleg === 0 && G.t < 25) return 'click a station to work it yourself · or pick a helper below, then a station';
    if (G.stats.deleg > 0 && G.stats.deleg < 3 && G.t < 50) return 'helpers stay on a job until it\'s done · specialists ✦ work twice as fast';
    if (clawd.carry) return 'carrying ice → take it to the shaver';
    return '';
  },

  update(dt) {
    if (!S) return;
    S.cranking = Math.max(0, S.cranking - dt);
    P.crank.rotation.x = -S.crankAngle; P.blade.rotation.y = S.crankAngle * 2;
    if (S.cranking > 0) {
      for (let k = 0; k < 2; k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * .32; P.snow.emit(SHAVER_X + Math.cos(a) * r, 1.7, -.25 + Math.sin(a) * r, rand(-.2, .2), -1.2 * rand(.6, 1.2), rand(-.2, .2), rand(.5, 1)); }
      if (Math.random() < dt * 6) P.mist.emit(SHAVER_X + rand(-.4, .4), 1.2, -.25, rand(-.2, .2), .2, rand(-.1, .1), 1.4, .9, .95, 1);
    }
    if (clawd.workAnim === 'crank' && S.cranking <= 0 && G.mini?.kind === 'dial') clawd.workAnim = null;
    if (S.chop > 0) { S.chop -= dt; P.knife.position.y = .14 + S.chop * 1.2; if (S.chop <= 0) { P.knife.position.y = .14; if (clawd.workAnim === 'chop') clawd.workAnim = null; } }
    P.hopper.visible = S.hopper > 0; P.hopper.scale.y = 1 - S.crankProg * .7; P.hopper.position.y = 2.02 - S.crankProg * .1;
    const lvl = clamp((S.mound + (S.hopper > 0 ? S.crankProg : 0)) / 4, 0, 1) * (1 - S.eaten);
    const tsx = lvl > 0 ? .3 + .85 * lvl : .01, tsy = lvl > 0 ? .15 + 1.85 * lvl : .01, k = 1 - Math.exp(-dt * 6);
    P.mound.scale.x = P.mound.scale.z = lerp(P.mound.scale.x, tsx, k); P.mound.scale.y = lerp(P.mound.scale.y, tsy, k);
    const topY = .48 + .5 * P.mound.scale.y;
    P.topStraw.position.set(0, topY + .1, .05); P.topMint.position.set(.22, topY - .02, .12);
    // a cold breath off the mound
    if (lvl > .3 && Math.random() < dt * 2.5) P.mist.emit(P.bowl.position.x + rand(-.4, .4), P.bowl.position.y + topY * .7, P.bowl.position.z + .3, rand(-.1, .1), .15, .1, 1.6, .92, .96, 1);
    drawSyrup();
    for (const c of ORDER) {
      const s = P.streams[c], on = S.pouring === c;
      s.visible = on;
      if (on) { const y0 = 2.38, y1 = P.bowl.position.y + topY; s.position.set(P.bottles[c].position.x, (y0 + y1) / 2, -.3); s.scale.set(1 + Math.sin(G.time * 30) * .15, y0 - y1, 1); }
      P.bottles[c].rotation.z = on ? Math.sin(G.time * 3) * .05 : 0;
    }
    // flag ripples with the breeze
    const pos = P.flagGeo.attributes.position.array, base = P.flagBase, w = world.wind;
    for (let i = 0; i < pos.length; i += 3) { const x = base[i], y = base[i + 1], down = (.56 - y) / 1.12; pos[i + 2] = base[i + 2] + Math.sin(G.time * 3 + x * 4 + y * 2) * .06 * w * down; pos[i] = base[i] + Math.sin(G.time * 2.1 + y * 3) * .03 * w * down; }
    P.flagGeo.attributes.position.needsUpdate = true; P.flagGeo.computeVertexNormals();
  },

  ending,
  diary,
  teardown() { S = null; },

  ls: () => ['ice_tray/  shaver/  syrups/{ichigo,melon,blue_hawaii}  strawberry.ts  mint/  bowl.glass  氷.flag'],
  review: () => !S ? 'nothing to review' : ready() ? 'LGTM ✦ ship it (serve it)' : `changes requested: ${S.mound < 4 ? 'needs more ice' : !syrDone() ? 'needs syrup' : 'needs toppings'}`,
  commands: {
    'cat recipe.md': () => [
      '# kakigōri (かき氷)',
      'shaved ice, fluffy as fresh snow, with syrup poured over the top.',
      '- crank slowly: a hand shaver makes the lightest flakes',
      '- classic syrups: ichigo (strawberry), melon, blue hawaii',
      '- uji kintoki (kyoto): matcha syrup + sweet azuki beans',
      '- shirokuma (kagoshima): condensed milk + fruit, arranged like a polar bear',
      '- eat fast. it is summer.',
    ],
  },
};

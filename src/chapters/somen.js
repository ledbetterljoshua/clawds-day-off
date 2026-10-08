// Day 3 — Nagashi-sōmen (流しそうめん). Build a split-bamboo noodle slide, then catch dinner
// as it flows past. Two stages: build (five prep jobs), then flow (everyone catches along the run).
import { THREE, V3, mesh, group, box, rbox, cyl, sph, toon, canvasTex, MAT, hitMat, dotTex } from '../core/gfx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, emit } from '../core/state.js';
import { rand, randi, clamp, lerp, ease, easeOutBack, smooth, pick } from '../core/util.js';
import { tween, sleep } from '../core/tween.js';
import { clawd, helpers, crew } from '../core/crab.js';
import { lock, credit, unassign } from '../core/agents.js';
import { mini } from '../core/minigames.js';
import { audio } from '../core/audio.js';
import { term } from '../core/terminal.js';
import { cam } from '../core/camera.js';
import { hud } from '../core/hud.js';
import { sky } from '../core/sky.js';
import { Particles, sparkle, puff } from '../core/fx.js';

// ───────────── layout ─────────────
const FULL = 5;                 // bundles each of the four needs
const R = .13;                  // flume radius
const TILT = .32;               // each half-pipe's open side leans toward the camera so you can see in
const SEGS = [                  // axis endpoints, top of the tower first
  [[-6.55, 3.55, -.95], [-4.4, 3.0, -.84]],
  [[-4.45, 2.93, -.86], [-6.3, 2.35, -.96]],
  [[-6.28, 2.28, -.95], [-4.05, 1.72, -.8]],
  [[-4.05, 1.66, -.78], [1.0, 1.22, -.76]],
  [[1.0, 1.18, -.76], [5.62, .74, -.7]],
].map(([a, b]) => ({ a: new V3(...a), b: new V3(...b) }));
const MOUNT_ORDER = [4, 3, 2, 1, 0];          // built from the colander up to the top
const MOUNT_X = [-5.3, -5.15, -5.0, -1.4, 3.1];
const SEG_NAME = ['the top chute', 'the middle chute', 'the low chute', 'the long run', 'the last run'];
const PUMP_X = -6.25, PUMP_SPOT = -5.5;
const STOVE_X = -2.6, STOVE_SPOT = -1.75;
const TSUYU_X = -.55, TSUYU_SPOT = .3;
const PILE_X = 1.75, PILE_SPOT = 2.65;
const GARNISH_X = 3.65, GARNISH_SPOT = 4.55;
const ZONES = [-3.4, -1.6, .2, 2.0, 3.8];       // where each catch spot meets the run
const WORDS = ['one', 'two', 'three', 'four', 'five'];
const SKILL = [.62, .5, .38];                   // h1 is careful, h3 gets too excited
const COLANDER = new V3(6.02, .3, -.66);
const BASKET = new V3(-6.42, 3.92, -.8);
const STANDS = [-1.55, .55, 2.75, 5.35];
const XAXIS = new V3(1, 0, 0), YAXIS = new V3(0, 1, 0);

let S = null;   // evening state
let P = null;   // props
const ATTACHED = [];   // props hung on crew members; they outlive the chapter root

const flumeDone = () => S.mounted.every(Boolean);
const mountedCount = () => S.mounted.filter(Boolean).length;
const prepDone = () => flumeDone() && S.tank >= 1 && S.boiled && S.tsuyuDone && S.garnishDone;
const allFull = () => S.ate.every(n => n >= FULL);
const nextSeg = () => MOUNT_ORDER.find(i => !S.mounted[i] && !S.claimed[i]) ?? null;
const bar = (n, of) => '▰'.repeat(clamp(n, 0, of)) + '▱'.repeat(clamp(of - n, 0, of));
const nameOf = c => c === clawd ? 'I' : c.name[0].toUpperCase() + c.name.slice(1);
const whoOf = i => i === 3 ? clawd : helpers[i];

// ───────────── materials & textures ─────────────
const BAMBOO = toon(0x7fae4a), BAMBOO_DARK = toon(0x5d8a35), TWINE = toon(0x6b4a2a);
const BAMBOO_IN = toon(0xd6cb86, { side: THREE.BackSide });
const STICK = toon(0xd9b98a);
let texCache = null;
function textures() {
  if (texCache) return texCache;
  const stripes = (base, line) => canvasTex(64, 32, x => {
    x.fillStyle = base; x.fillRect(0, 0, 64, 32); x.strokeStyle = line; x.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(0, i * 3.6 + 1); x.bezierCurveTo(20, i * 3.6 + rand(-2, 2), 44, i * 3.6 + rand(-2, 2), 64, i * 3.6 + 1); x.stroke(); }
  });
  texCache = {
    noodle: stripes('#fbf8ef', 'rgba(205,195,170,.7)'),
    pink: stripes('#fde7ef', 'rgba(240,120,160,.85)'),
    water: canvasTex(128, 64, x => {
      x.fillStyle = 'rgba(78,160,226,.95)'; x.fillRect(0, 0, 128, 64);
      for (let i = 0; i < 46; i++) { x.strokeStyle = `rgba(255,255,255,${rand(.25, .75)})`; x.lineWidth = rand(1, 2.5); const y = rand(0, 64), x0 = rand(0, 128); x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + rand(10, 34), y + rand(-1, 1)); x.stroke(); }
    }),
    woven: canvasTex(128, 128, x => {
      x.fillStyle = '#c8a46a'; x.fillRect(0, 0, 128, 128); x.strokeStyle = 'rgba(110,80,40,.55)'; x.lineWidth = 2;
      for (let i = 0; i < 128; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i + 4); x.lineTo(128, i + 4); x.stroke(); }
    }),
    cup: canvasTex(128, 64, x => {
      x.fillStyle = '#f7f6f2'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#2d4f8f';
      x.fillRect(0, 6, 128, 4); x.fillRect(0, 54, 128, 3);
      for (let i = 0; i < 128; i += 16) { x.beginPath(); x.arc(i + 8, 32, 7, 0, Math.PI * 2); x.lineWidth = 2; x.strokeStyle = '#2d4f8f'; x.stroke(); }
    }),
    cucumber: canvasTex(64, 64, x => { x.fillStyle = '#3f7d32'; x.fillRect(0, 0, 64, 64); x.fillStyle = 'rgba(190,230,140,.5)'; for (let i = 0; i < 60; i++) x.fillRect(rand(0, 64), rand(0, 64), 2, 2); }),
    bottle: canvasTex(128, 64, x => {
      x.fillStyle = '#f3ead6'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#7a2a1a';
      x.font = '800 30px "M PLUS Rounded 1c", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('めんつゆ', 64, 34);
    }),
    sign: canvasTex(96, 384, x => {
      x.fillStyle = '#d9b88a'; x.fillRect(0, 0, 96, 384); x.strokeStyle = 'rgba(120,80,40,.35)';
      for (let i = 0; i < 12; i++) { x.beginPath(); x.moveTo(rand(0, 96), 0); x.bezierCurveTo(rand(0, 96), 128, rand(0, 96), 256, rand(0, 96), 384); x.stroke(); }
      x.fillStyle = '#2b2f3a'; x.font = '600 52px "Klee One", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      [...'流しそうめん'].forEach((c, i) => x.fillText(c, 48, 38 + i * 61));
    }),
  };
  texCache.water.wrapS = texCache.water.wrapT = THREE.RepeatWrapping;
  return texCache;
}

// ───────────── geometry helpers ─────────────
// a half-pipe along +X from 0 to len, open toward +Y; front faces are the outside
function halfPipeGeo(len, r = R, around = 14) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let j = 0; j <= 1; j++) for (let i = 0; i <= around; i++) {
    const a = Math.PI + (i / around) * Math.PI;
    pos.push(j * len, Math.sin(a) * r, Math.cos(a) * r); nor.push(0, Math.sin(a), Math.cos(a)); uv.push(j, i / around);
  }
  for (let i = 0; i < around; i++) { const a = i, b = i + around + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
// a segment's local frame: x down the pipe, y out of the open side (leaning toward the camera)
function frameOf(a, b) {
  const x = new V3().subVectors(b, a).normalize();
  const up = new V3(0, Math.cos(TILT), Math.sin(TILT));
  const y = up.sub(x.clone().multiplyScalar(up.dot(x))).normalize();
  const z = new V3().crossVectors(x, y);
  return { x, y, z, len: a.distanceTo(b), q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)) };
}
function rod(a, b, r, mat, parent, seg = 8) {
  const d = new V3().subVectors(b, a), len = d.length();
  const m = mesh(cyl(r, r, len, seg), mat, 0, 0, 0, parent);
  m.position.copy(a).addScaledVector(d, .5);
  m.quaternion.setFromUnitVectors(YAXIS, d.normalize());
  return m;
}
// a bamboo pole with node rings
function pole(a, b, r, parent) {
  const m = rod(a, b, r, BAMBOO, parent, 10);
  const d = new V3().subVectors(b, a), len = d.length();
  for (let t = .35; t < len - .1; t += .7) {
    const n = mesh(cyl(r * 1.18, r * 1.18, .035, 10), BAMBOO_DARK, 0, 0, 0, parent);
    n.position.copy(a).addScaledVector(d, t / len); n.quaternion.copy(m.quaternion);
  }
  return m;
}
const runAxis = x => { const s = x < SEGS[3].b.x ? SEGS[3] : SEGS[4]; const t = clamp((x - s.a.x) / (s.b.x - s.a.x), 0, 1); return new V3().lerpVectors(s.a, s.b, t); };

// ───────────── the path noodles ride ─────────────
let PATH = null;
const _p = new V3(), _d = new V3();
function buildPath() {
  const pts = [];
  SEGS.forEach(s => { const f = frameOf(s.a, s.b); pts.push(s.a.clone().addScaledVector(f.y, R * .3), s.b.clone().addScaledVector(f.y, R * .3)); });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  PATH = { pts, cum, len: cum[cum.length - 1] };
}
// position along the path at arc length s; odd intervals are the little drops between chutes
function pathAt(s) {
  const { pts, cum } = PATH;
  let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
  const t = clamp((s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), 0, 1);
  _p.lerpVectors(pts[i - 1], pts[i], t);
  _d.subVectors(pts[i], pts[i - 1]).normalize();
  return { p: _p, dir: _d, seg: Math.floor((i - 1) / 2), joint: (i - 1) % 2 === 1 };
}

// ───────────── props ─────────────
function build(root) {
  const T = textures();
  P = { root, hits: {}, segs: [], logs: [], waters: [] };
  P.noodleMat = toon(0xffffff, { map: T.noodle }); P.pinkMat = toon(0xffffff, { map: T.pink, emissive: 0xff6fa0, emissiveIntensity: .25 });
  P.strandMat = toon(0xf6f1e4); P.pinkStrandMat = toon(0xff7aa8, { emissive: 0xff4f8a, emissiveIntensity: .35 });
  P.tomatoMat = toon(0xe8302a);
  P.shadowMat = new THREE.MeshBasicMaterial({ color: 0x0a2a4a, transparent: true, opacity: .28, depthWrite: false }); P.mikanMat = toon(0xf59a23, { emissive: 0xf08a10, emissiveIntensity: .15 });

  // the tower: two poles, crossbars at each chute, the sign, the tank, the noodle basket
  for (const x of [-6.78, -4.22]) pole(new V3(x, 0, -1.06), new V3(x, 4.05, -1.06), .05, root);
  for (const y of [3.58, 2.96, 2.31, 1.75, .9]) pole(new V3(-6.9, y - .1, -1.08), new V3(-4.1, y - .1, -1.08), .03, root);
  const sign = mesh(new THREE.PlaneGeometry(.26, 1.04), toon(0xffffff, { map: T.sign, side: THREE.DoubleSide }), -4.62, .56, -.5, root);
  sign.rotation.set(-.08, .15, .03);
  mesh(box(.32, .05, .44), MAT.woodDark, -7.08, 3.6, -.98, root);
  P.tank = mesh(rbox(.42, .46, .36, .04), new THREE.MeshStandardMaterial({ color: 0x8fc7ef, transparent: true, opacity: .45, roughness: .1, depthWrite: false }), -7.08, 3.85, -.98, root, false);
  P.tankWater = mesh(box(.38, .42, .32), toon(0x3d8fe3, { transparent: true, opacity: .85 }), -7.08, 3.64, -.98, root, false);
  P.tankWater.scale.y = .001;
  rod(new V3(-6.88, 3.7, -.98), new V3(-6.62, 3.62, -.96), .025, MAT.metal, root);
  P.basket = group(root, BASKET.x, BASKET.y, BASKET.z);
  const zprof = [[0, 0], [.1, .005], [.16, .04], [.19, .09]].map(([a, b]) => new THREE.Vector2(a, b));
  mesh(new THREE.LatheGeometry(zprof, 18), toon(0xffffff, { map: T.woven, side: THREE.DoubleSide }), 0, 0, 0, P.basket);
  P.basketNoodles = mesh(new THREE.SphereGeometry(.15, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), P.noodleMat, 0, .03, 0, P.basket, false);
  P.basketNoodles.scale.set(1, .5, 1); P.basketNoodles.visible = false;
  rod(new V3(BASKET.x, BASKET.y + .09, BASKET.z), new V3(BASKET.x - .2, BASKET.y + .22, -1.05), .012, TWINE, root);

  // hand pump + hose up to the tank
  const PZ = -.88;
  mesh(rbox(.34, .08, .34, .03), MAT.dark, PUMP_X, .04, PZ, root);
  const pumpMat = toon(0x2f6b52);
  mesh(cyl(.09, .11, .58, 14), pumpMat, PUMP_X, .37, PZ, root);
  mesh(cyl(.12, .12, .06, 14), pumpMat, PUMP_X, .68, PZ, root);
  const spout = mesh(cyl(.03, .035, .22, 8), pumpMat, PUMP_X, .5, PZ + .12, root); spout.rotation.x = Math.PI / 2 - .3;
  P.pumpHandle = group(root, PUMP_X + .06, .72, PZ);
  mesh(rbox(.56, .04, .05, .015), pumpMat, .28, 0, 0, P.pumpHandle);
  mesh(cyl(.035, .035, .16, 8), MAT.woodLight, .56, 0, 0, P.pumpHandle).rotation.z = Math.PI / 2;
  P.pumpHandle.rotation.z = .35;
  const hose = new THREE.CatmullRomCurve3([new V3(PUMP_X, .72, PZ - .02), new V3(-6.55, 1.1, -1.12), new V3(-6.72, 2.4, -1.14), new V3(-6.82, 3.3, -1.12), new V3(-7.0, 4.02, -1.0)]);
  mesh(new THREE.TubeGeometry(hose, 48, .026, 6, false), toon(0x3b9d4a), 0, 0, 0, root);

  // stove + pot
  mesh(rbox(.72, .15, .48, .03), toon(0xdfe3e8), STOVE_X, .075, -.86, root);
  mesh(cyl(.035, .035, .03, 10), MAT.red, STOVE_X + .25, .1, -.61, root).rotation.x = Math.PI / 2;
  for (const a of [0, Math.PI / 2]) { const g = mesh(box(.42, .015, .03), MAT.dark, STOVE_X, .16, -.86, root); g.rotation.y = a + Math.PI / 4; }
  P.flame = mesh(new THREE.TorusGeometry(.14, .028, 6, 20), new THREE.MeshBasicMaterial({ color: 0x4aa8ff, toneMapped: false }), STOVE_X, .17, -.86, root, false);
  P.flame.rotation.x = Math.PI / 2; P.flame.visible = false;
  const potMat = toon(0xc9cdd3, { side: THREE.DoubleSide });
  mesh(new THREE.CylinderGeometry(.26, .24, .32, 22, 1, true), potMat, STOVE_X, .34, -.86, root);
  mesh(cyl(.24, .24, .01, 22), potMat, STOVE_X, .185, -.86, root);
  for (const s of [-1, 1]) mesh(rbox(.1, .03, .05, .01), MAT.dark, STOVE_X + s * .3, .44, -.86, root);
  P.potWater = mesh(cyl(.245, .245, .01, 22), toon(0xa9d8f5, { transparent: true, opacity: .9 }), STOVE_X, .44, -.86, root, false);
  P.potNoodles = mesh(new THREE.SphereGeometry(.18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), P.noodleMat, STOVE_X, .43, -.86, root, false);
  P.potNoodles.scale.set(1, .35, 1); P.potNoodles.visible = false;

  // tsuyu: the bottle, a jug, four soba-choko cups
  const bottleMat = new THREE.MeshStandardMaterial({ color: 0x3a1f12, transparent: true, opacity: .92, roughness: .2 });
  mesh(cyl(.065, .07, .26, 14), bottleMat, TSUYU_X - .38, .13, -1.0, root);
  mesh(cyl(.025, .045, .1, 10), bottleMat, TSUYU_X - .38, .31, -1.0, root);
  mesh(cyl(.028, .028, .03, 10), MAT.red, TSUYU_X - .38, .37, -1.0, root);
  mesh(cyl(.071, .071, .1, 14), toon(0xffffff, { map: T.bottle }), TSUYU_X - .38, .14, -1.0, root).rotation.y = -Math.PI / 2;
  const jugGlass = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, transparent: true, opacity: .35, roughness: .05, depthWrite: false });
  mesh(new THREE.CylinderGeometry(.1, .09, .22, 16, 1, true), jugGlass, TSUYU_X + .02, .11, -.98, root, false);
  P.jugLiquid = mesh(cyl(.088, .082, .2, 16), toon(0x7a4a25, { transparent: true, opacity: .9 }), TSUYU_X + .02, .1, -.98, root, false);
  P.jugLiquid.scale.y = .001;
  P.cups = [];
  for (let i = 0; i < 4; i++) {
    const x = TSUYU_X - .42 + i * .28;
    mesh(new THREE.CylinderGeometry(.07, .055, .1, 16, 1, true), toon(0xffffff, { map: T.cup, side: THREE.DoubleSide }), x, .05, -.6, root);
    mesh(cyl(.055, .055, .008, 16), toon(0xf7f6f2), x, .004, -.6, root, false);
    const liq = mesh(cyl(.064, .064, .008, 16), toon(0x6b3d1f), x, .08, -.6, root, false); liq.visible = false; P.cups.push(liq);
  }

  // bamboo pile: five split poles waiting to become a slide
  [[-1.02, .09], [-.84, .09], [-.66, .09], [-.93, .26], [-.75, .26]].forEach(([z, y], k) => {
    const g = group(root, PILE_X, y, z);
    const m = mesh(cyl(.085, .085, 1.3, 10), BAMBOO, 0, 0, 0, g); m.rotation.z = Math.PI / 2;
    for (const t of [-.45, 0, .45]) { const n = mesh(cyl(.098, .098, .03, 10), BAMBOO_DARK, t, 0, 0, g); n.rotation.z = Math.PI / 2; }
    g.rotation.y = rand(-.06, .06);
    P.logs.push(g);
  });

  // garnish board
  mesh(rbox(.95, .05, .55, .02), toon(0xe8c9a0), GARNISH_X, .025, -.9, root);
  P.cucumber = mesh(cyl(.045, .045, .42, 12), toon(0xffffff, { map: T.cucumber }), GARNISH_X - .15, .08, -.98, root);
  P.cucumber.rotation.z = Math.PI / 2;
  P.myoga = [0, 1].map(k => { const m = mesh(sph(.05, 10, 8), toon(0xd9708a), GARNISH_X + .18 + k * .12, .09, -.82 + k * .04, root); m.scale.set(1, 1.6, 1); m.rotation.z = 1.2; return m; });
  P.knife = group(root, GARNISH_X + .3, .09, -.74); P.knife.rotation.y = -.5;
  mesh(box(.42, .09, .015), MAT.metal, 0, 0, 0, P.knife); mesh(rbox(.2, .07, .05, .015), toon(0x3a3a42), .3, 0, 0, P.knife);
  mesh(cyl(.17, .14, .035, 18), MAT.white, GARNISH_X + .15, .018, -.47, root);
  P.slices = [];
  for (let k = 0; k < 14; k++) {
    const pink = k >= 8, s = mesh(box(.11, .012, .016), toon(pink ? 0xe58aa2 : 0x8fcf6a), GARNISH_X + .15 + rand(-.08, .08), .045 + k * .003, -.47 + rand(-.07, .07), root, false);
    s.rotation.y = rand(0, Math.PI); s.visible = false; P.slices.push(s);
  }

  // colander at the end, on an upturned bucket
  mesh(cyl(.22, .26, .3, 16), toon(0x4f86c9), COLANDER.x, .15, COLANDER.z, root);
  const cprof = [[0, 0], [.25, .02], [.36, .08], [.4, .16]].map(([a, b]) => new THREE.Vector2(a, b));
  mesh(new THREE.LatheGeometry(cprof, 24), toon(0xffffff, { map: T.woven, side: THREE.DoubleSide }), COLANDER.x, COLANDER.y, COLANDER.z, root);
  mesh(new THREE.TorusGeometry(.4, .02, 6, 24), toon(0xa8844e), COLANDER.x, COLANDER.y + .16, COLANDER.z, root).rotation.x = Math.PI / 2;
  P.colanderNoodles = mesh(new THREE.SphereGeometry(.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), P.noodleMat, COLANDER.x, COLANDER.y + .02, COLANDER.z, root, false);
  P.colanderNoodles.scale.set(1, .01, 1);

  // the flume: five chutes (with a faint outline until mounted) and the X-stands under the run
  const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .24, depthWrite: false, side: THREE.DoubleSide });
  SEGS.forEach((s, i) => {
    const f = frameOf(s.a, s.b), geo = halfPipeGeo(f.len + .06);
    const ghost = mesh(geo, ghostMat, s.a.x, s.a.y, s.a.z, root, false); ghost.quaternion.copy(f.q); ghost.position.addScaledVector(f.x, -.03);
    const g = group(root, s.a.x, s.a.y, s.a.z); g.quaternion.copy(f.q); g.position.addScaledVector(f.x, -.03); g.visible = false;
    mesh(geo, BAMBOO, 0, 0, 0, g); mesh(geo, BAMBOO_IN, 0, 0, 0, g, false);
    for (let t = .05; t < f.len; t += .72) { const n = mesh(new THREE.TorusGeometry(R * 1.04, .016, 5, 12, Math.PI), BAMBOO_DARK, t, 0, 0, g, false); n.rotation.set(Math.PI, Math.PI / 2, 0); }
    const wt = T.water.clone(); wt.needsUpdate = true; wt.repeat.set(f.len / .9, 1);
    const water = mesh(new THREE.PlaneGeometry(f.len, R * 1.7), new THREE.MeshBasicMaterial({ map: wt, transparent: true, opacity: 0, depthWrite: false }), f.len / 2, -R * .18, 0, g, false);
    water.rotation.x = -Math.PI / 2; water.renderOrder = 1; water.userData.speed = 1.2 + 3 * Math.max(0, -f.x.y);
    P.waters.push(water);
    // twine ties back to the frame
    if (i < 3) for (const e of [s.a, s.b]) rod(new V3(e.x, e.y - R, e.z), new V3(e.x, e.y - R - .03, -1.06), .012, TWINE, root);
    P.segs.push({ g, ghost, f, home: g.position.clone() });
  });
  for (const x of STANDS) {
    const top = runAxis(x), h = top.y - R * .85, z = top.z;
    pole(new V3(x - .32, 0, z), new V3(x + .12, h + .16, z), .03, root);
    pole(new V3(x + .32, 0, z), new V3(x - .12, h + .16, z), .03, root);
    mesh(cyl(.034, .034, .05, 8), TWINE, x, h, z, root);
  }
  // falling water: tank spout → top chute, last chute → colander
  const streamMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: .8, depthWrite: false });
  P.streamTop = rod(new V3(-6.62, 3.6, -.96), new V3(-6.55, 3.5, -.95), .02, streamMat, root);
  P.streamEnd = rod(new V3(5.66, .72, -.7), new V3(COLANDER.x - .05, COLANDER.y + .1, COLANDER.z), .024, streamMat, root);
  P.streamTop.visible = P.streamEnd.visible = false;

  // the catch ring around the pipe at Clawd's reach
  P.ring = mesh(new THREE.TorusGeometry(.3, .03, 8, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, toneMapped: false, depthWrite: false }), 0, 0, 0, root, false);
  P.ring.visible = false; P.ring.renderOrder = 3;
  P.ringHit = mesh(sph(.55, 10, 8), hitMat, 0, 0, 0, P.ring, false);

  // floor marks where you can stand to catch (shown once the slide opens)
  P.marks = ZONES.map(z => {
    const m = mesh(new THREE.RingGeometry(.34, .42, 32), new THREE.MeshBasicMaterial({ color: 0xd97757, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), z + .62, .014, .38, root, false);
    m.rotation.x = -Math.PI / 2; return m;
  });

  // hit boxes (stations); the flume hit covers the tower and both runs
  const hb = (k, w, h, d, x, y, z) => { P.hits[k] = mesh(box(w, h, d), hitMat, x, y, z, root, false); };
  hb('pump', .95, 1.3, .9, PUMP_X, .6, -.85);
  hb('stove', 1.0, 1.0, .9, STOVE_X, .45, -.85);
  hb('tsuyu', 1.25, .8, .9, TSUYU_X - .1, .35, -.82);
  hb('pile', 1.6, .6, .9, PILE_X, .25, -.86);
  hb('garnish', 1.3, .7, 1.0, GARNISH_X, .3, -.8);
  const parts = [];
  const tb = new THREE.BoxGeometry(2.9, 2.35, .7); tb.translate(-5.45, 2.7, -.88); parts.push(tb);
  for (const i of [3, 4]) { const { a, b } = SEGS[i], d = new V3().subVectors(b, a), g = new THREE.BoxGeometry(d.length(), .55, .6); g.rotateZ(Math.atan2(d.y, d.x)); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); parts.push(g); }
  P.hits.flume = mesh(mergeGeometries(parts), hitMat, 0, 0, 0, root, false);
  ZONES.forEach((z, n) => { hb('spot' + (n + 1), 1.35, 2.0, 1.5, z + .35, .95, -.2); P.hits['spot' + (n + 1)].visible = false; });

  // particles
  P.splash = new Particles({ max: 220, size: .05, gravity: -6, drag: .4, opacity: .9, parent: root });
  P.steam = new Particles({ max: 90, size: .32, gravity: .45, drag: 1.2, opacity: .3, parent: root });
  P.glints = new Particles({ max: 80, size: .12, additive: true, gravity: .2, drag: 2.5, parent: root });
  P.drops = new Particles({ max: 60, size: .045, gravity: -5, opacity: .9, parent: root });

  // fireflies that drift up from below the railing at dusk
  const N = 18, fpos = new Float32Array(N * 3), fcol = new Float32Array(N * 3);
  P.ffAnchor = [];
  for (let k = 0; k < N; k++) {
    const near = k >= 11;
    P.ffAnchor.push(near ? { x: rand(-3.2, 3.2), y: rand(.7, 2.4), z: rand(-.5, 1.6), ph: rand(0, 6.28), sp: rand(.3, .7), blink: rand(1.4, 2.6), near } : { x: rand(-8, 8), y: rand(-1.4, 2.6), z: rand(-4, -1.35), ph: rand(0, 6.28), sp: rand(.4, .9), blink: rand(1.6, 3.2) });
  }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3)); fg.setAttribute('color', new THREE.BufferAttribute(fcol, 3));
  P.ff = new THREE.Points(fg, new THREE.PointsMaterial({ size: .16, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  P.ff.frustumCulled = false; root.add(P.ff);
}

// chopsticks in a crab's right claw
function sticksFor(c) {
  if (c._sticks) return c._sticks;
  const g = group(c.hand, .0, .04, .1);
  for (const s of [-1, 1]) { const m = mesh(cyl(.011, .007, .46, 5), STICK, s * .022, .16, .12, g, false); m.rotation.x = -.55; }
  g.visible = false; ATTACHED.push(g); c._sticks = g;
  return g;
}
const showSticks = (c, v) => { sticksFor(c).visible = v; };

// ───────────── bamboo carrying + mounting ─────────────
function claim(i, who) { S.claimed[i] = who; S.pileLeft--; updatePile(); }
function unclaim(i) { if (!S.claimed[i] || S.mounted[i]) return; S.claimed[i] = null; S.pileLeft++; updatePile(); }
function updatePile() { P.logs.forEach((l, k) => l.visible = k < S.pileLeft); }
function carryBamboo(c, i) {
  c._seg = i;
  const m = group(c.headSlot, 0, .14, 0);
  mesh(cyl(.085, .085, 1.25, 10), BAMBOO, 0, 0, 0, m, false).rotation.z = Math.PI / 2;
  for (const t of [-.4, .05, .5]) mesh(cyl(.097, .097, .03, 10), BAMBOO_DARK, t, 0, 0, m, false).rotation.z = Math.PI / 2;
  c._log = m; ATTACHED.push(m);
  audio.sfx('knock');
}
function removeLog(c) { if (c._log) { c._log.parent?.remove(c._log); c._log = null; } }
function dropBamboo(c) {
  if (c._seg != null) { if (!S.mounted[c._seg]) unclaim(c._seg); c._seg = null; }
  removeLog(c);
}
function mountSeg(i, who) {
  if (S.mounted[i]) return;
  S.mounted[i] = true; S.claimed[i] = who; who._seg = null;
  const from = new V3(); (who._log || who.headSlot).getWorldPosition(from);
  removeLog(who);
  const sg = P.segs[i];
  sg.ghost.visible = false; sg.g.visible = true;
  tween(.75, e => {
    const k = ease(e);
    sg.g.position.lerpVectors(from, sg.home, k); sg.g.position.y += Math.sin(k * Math.PI) * .6;
    sg.g.scale.setScalar(Math.max(.05, easeOutBack(Math.min(1, e * 1.1))));
  }, () => {
    sg.g.position.copy(sg.home); sg.g.scale.setScalar(1);
    audio.sfx('knock'); tween(.12, () => {}, () => audio.sfx('knock'));
    const mid = new V3().addVectors(SEGS[i].a, SEGS[i].b).multiplyScalar(.5);
    sparkle(mid.x, mid.y + .15, mid.z, 12, [.75, 1, .5]);
  });
  S.by.build[who.i]++; credit(who);
  term.log(`${who.name} ▸ mounted ${SEG_NAME[i]} (${mountedCount()}/5)`, '#a8d17a');
  if (flumeDone()) { term.log('✓ the slide is built', '#7bd88f'); hud.toast('🎋 the bamboo slide is built', { dur: 2.4 }); }
  checkReady();
}

// ───────────── prep finishes ─────────────
function finishTank(who) {
  if (S.tankDone) return; S.tankDone = true; S.tank = 1; credit(who);
  term.log(`${who.name} ▸ the tank is full`, '#9fd3ff'); audio.sfx('chime'); checkReady();
}
function finishBoil(who) {
  if (S.boiled) return; S.boiled = true; S.boil = 1; S.by.boil = who.i; credit(who);
  term.log(`${who.name} ▸ boiled the sōmen and rinsed it cold`, '#e8e2da'); audio.sfx('chime');
  puff(STOVE_X, .7, -.86, 10); checkReady();
}
function finishTsuyu(who) {
  if (S.tsuyuDone) return; S.tsuyuDone = true; S.tsuyu = 1; S.by.tsuyu = who.i; credit(who);
  term.log(`${who.name} ▸ mixed the tsuyu`, '#c9915a'); audio.sfx('chime'); checkReady();
}
function finishGarnish(who) {
  if (S.garnishDone) return; S.garnishDone = true; S.garnish = 1; S.by.garnish = who.i; credit(who);
  term.log(`${who.name} ▸ sliced cucumber and myōga`, '#8fcf6a'); audio.sfx('chime'); checkReady();
}
function checkReady() { if (S.stage === 'build' && prepDone() && !S.flowQueued) { S.flowQueued = true; tween(1.4, () => {}, startFlow); } }

function startFlow() {
  if (!S || S.stage !== 'build' || G.mode !== 'play') return;
  S.stage = 'flow'; S.flowed = true; S.flowT = 0; S.spawnT = 2.4;
  for (const k of ['pump', 'flume', 'pile', 'stove', 'tsuyu', 'garnish']) P.hits[k].visible = false;
  ZONES.forEach((z, n) => { P.hits['spot' + (n + 1)].visible = true; G.stations['spot' + (n + 1)].job = 'catch' + (n + 1); });
  // anyone without a job takes a spot upstream; Clawd chooses where to stand
  const home = [3, 5, 1];
  helpers.forEach((h, i) => { if (h.job && !h.job.startsWith('catch')) unassign(h); if (!h.job) { h.job = 'catch' + home[i]; h.wake(); } });
  crew.forEach(c => showSticks(c, true));
  term.log('✓ everything is ready — let it flow!', '#7bd88f');
  hud.toast('🥢 the slide is open — stand by it and catch', { dur: 3 });
  clawd.say('pick a spot by the slide 🥢', 3); clawd.hop(.5);
  helpers[2].say('first!! ✦', 2);
  P.btn.classList.remove('sm-hidden');
}

// ───────────── noodles in the flume ─────────────
function makeBundle() {
  const g = group(P.root); g.visible = false;
  const noodle = group(g); noodle.scale.setScalar(1.6);
  const shadow = mesh(new THREE.CircleGeometry(.1, 16), P.shadowMat, 0, -.035, 0, noodle, false); shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1.7, 1, .9);
  const body = mesh(sph(.1, 12, 8), P.noodleMat, 0, .01, 0, noodle, false); body.scale.set(1.55, .45, .78);
  const strands = [];
  for (let k = 0; k < 3; k++) { const s = mesh(cyl(.009, .009, .36, 5), P.strandMat, rand(-.03, .03), .035 + k * .008, (k - 1) * .035, noodle, false); s.rotation.set(rand(-.15, .15), rand(-.2, .2), Math.PI / 2); strands.push(s); }
  const tomato = group(g); tomato.scale.setScalar(1.3); mesh(sph(.075, 12, 10), P.tomatoMat, 0, .03, 0, tomato, false); mesh(new THREE.ConeGeometry(.05, .03, 5), MAT.leaf, 0, .105, 0, tomato, false);
  const mikan = group(g); mikan.scale.setScalar(1.3); const mk = mesh(new THREE.SphereGeometry(.085, 12, 8, 0, Math.PI), P.mikanMat, 0, .03, 0, mikan, false); mk.scale.set(1.2, .8, .6); mk.rotation.x = -Math.PI / 2;
  const hit = mesh(sph(.4, 8, 6), hitMat, 0, 0, 0, g, false);
  const b = { g, noodle, body, strands, tomato, mikan, hit, alive: false, caught: false, pos: new V3() };
  hit.userData.bundle = b;
  return b;
}
function spawnBundle(type) {
  let b = S.bundles.find(x => !x.alive);
  if (!b) { if (S.bundles.length >= 18) return; b = makeBundle(); S.bundles.push(b); }
  Object.assign(b, { alive: true, caught: false, type, s: 0, drop: .38, rolled: new Set(), v: 1.6, seg: 0, wob: rand(0, 6) });
  b.noodle.visible = type === 'noodle' || type === 'pink';
  b.noodle.scale.setScalar(type === 'pink' ? 1.75 : 1.6); b.tomato.visible = type === 'tomato'; b.mikan.visible = type === 'mikan';
  b.body.material = type === 'pink' ? P.pinkMat : P.noodleMat;
  b.strands.forEach((s, k) => s.material = type === 'pink' && k < 2 ? P.pinkStrandMat : P.strandMat);
  b.g.visible = true; b.g.scale.setScalar(1); b.g.position.copy(BASKET); b.pos.copy(BASKET);
  S.spawned++;
  if (type === 'pink') { term.log('✿ a pink noodle is coming down…', '#ff8ab0'); }
}
function nextType() {
  if (!S.pinkBy && S.spawned >= S.pinkAt) { S.pinkAt = 1e9; return 'pink'; }
  if (S.spawned >= S.nextTreat) { S.nextTreat = S.spawned + randi(6, 8); S.treatFlip = !S.treatFlip; return S.treatFlip ? 'tomato' : 'mikan'; }
  return 'noodle';
}
function toColander(b) {
  b.caught = true;
  const from = b.g.position.clone(), to = COLANDER.clone().add(new V3(rand(-.12, .12), .14, rand(-.1, .1)));
  tween(.35, e => { b.g.position.lerpVectors(from, to, e); b.g.position.y += Math.sin(e * Math.PI) * .12; }, () => {
    b.alive = false; b.g.visible = false;
    if (b.type === 'noodle' || b.type === 'pink') S.colander++;
    for (let k = 0; k < 6; k++) P.splash.emit(COLANDER.x + rand(-.1, .1), COLANDER.y + .18, COLANDER.z, rand(-.8, .8), rand(.6, 1.6), rand(-.5, .5), .6, .8, .92, 1);
  });
  if (b.type === 'pink' && !S.pinkBy) {
    S.pinkEscapes++; S.pinkAt = S.spawned + 8;
    hud.toast(S.pinkEscapes > 1 ? '✿ the pink noodle got away again…' : '✿ the pink noodle got away… it\'ll come around again', { dur: 2.6 });
    term.log('  the pink noodle slipped into the colander', '#ff8ab0');
  }
}
function updateBundles(dt) {
  for (const b of S.bundles) {
    if (!b.alive || b.caught) continue;
    if (b.drop > 0) {
      b.drop -= dt; const e = 1 - Math.max(0, b.drop) / .38;
      b.g.position.lerpVectors(BASKET, PATH.pts[0], e); b.g.position.y += Math.sin(e * Math.PI) * .22;
      b.pos.copy(b.g.position);
      if (b.drop <= 0) { audio.sfx('splash', { gap: .25 }); for (let k = 0; k < 4; k++) P.splash.emit(PATH.pts[0].x, PATH.pts[0].y + .05, PATH.pts[0].z, rand(-.6, .6), rand(.5, 1.2), rand(-.3, .3), .5, .85, .93, 1); }
      continue;
    }
    const at = pathAt(b.s);
    const want = at.joint ? 3.2 : 1.25 + 3.2 * Math.max(0, -at.dir.y);
    b.v = lerp(b.v, want, 1 - Math.exp(-dt * 4));
    b.s += b.v * dt;
    if (b.s >= PATH.len) { toColander(b); continue; }
    const p = pathAt(b.s);
    b.seg = p.seg; b.pos.copy(p.p);
    b.g.position.copy(p.p); b.g.position.y += Math.sin(G.time * 9 + b.wob) * .008;
    b.g.quaternion.setFromUnitVectors(XAXIS, p.dir);
    if (b.type === 'pink' && Math.random() < dt * 16) P.glints.emit(b.pos.x, b.pos.y + .06, b.pos.z, rand(-.3, .3), rand(.2, .6), rand(-.2, .2), .6, 1, .55, .75);
  }
}

// ───────────── catching ─────────────
const zoneX = () => clawd.x - .75;
const onRun = () => S && S.stage === 'flow' && G.mode === 'play' && zoneX() > -4.05 && zoneX() < 5.55 && clawd.arrived();
function bundleInZone(range = .55) {
  const zx = zoneX(); let best = null, bd = range;
  for (const b of S.bundles) {
    if (!b.alive || b.caught || b.drop > 0 || b.seg < 3) continue;
    const d = Math.abs(b.pos.x - zx); if (d < bd) { bd = d; best = b; }
  }
  return best ? { b: best, d: bd } : null;
}
function attemptCatch() {
  if (!S || S.stage !== 'flow' || G.mode !== 'play') return;
  if (!onRun()) { if (!clawd.pending) clawd.say('walk over to the slide first', 1.6); return; }
  const z = bundleInZone();
  if (!z) { audio.sfx('clack'); S.ringMiss = .35; S.whiffs++; if (Math.random() < .35) clawd.say(pick(['too early', 'whoops', 'next one…']), 1); return; }
  const q = 1 - z.d / .55;
  G.stats.quality.push(.45 + .55 * q);
  catchBy(clawd, z.b);
}
function tapBundle(b) {
  if (onRun() && Math.abs(b.pos.x - zoneX()) < .75 && b.seg >= 3) { G.stats.quality.push(.8); catchBy(clawd, b); return; }
  if (onRun()) { clawd.say('wait for it at the ring 🥢', 1.4); S.ringMiss = .25; }
  else clawd.say('walk over to the slide first', 1.6);
}
function catchBy(c, b) {
  b.caught = true;
  const noodle = b.type === 'noodle' || b.type === 'pink';
  // once Clawd is full, every catch goes to whoever is hungriest
  const hungry = c === clawd && noodle && S.ate[3] >= FULL ? helpers.filter(h => S.ate[h.i] < FULL).sort((x, y) => S.ate[x.i] - S.ate[y.i])[0] : null;
  const from = b.g.position.clone(), to = new V3(); c.hand.getWorldPosition(to);
  tween(.28, e => { b.g.position.lerpVectors(from, to, ease(e)); b.g.position.y += Math.sin(e * Math.PI) * .3; b.g.scale.setScalar(1 - e * .4); },
    () => { if (!hungry) { b.alive = false; b.g.visible = false; } });
  audio.sfx('clack');
  if (!noodle) {
    S.treats[c.i].push(b.type);
    c.say(b.type === 'tomato' ? '🍅 tomato!' : '🍊 mikan!', 1.4); c.mood('happy', 1); c.hop(.3);
    if (c === clawd) sparkle(to.x, to.y + .2, to.z, 10, b.type === 'tomato' ? [1, .4, .3] : [1, .7, .2]);
    return;
  }
  if (b.type === 'pink') onPink(c);
  if (hungry) { passTo(hungry, b, to); return; }
  feed(c);
  checkAllFull();
}
function feed(c) {
  const i = c.i;
  S.ate[i]++;
  eat(c);
  if (S.ate[i] === FULL) {
    tween(1.1, () => {}, () => { c.say(c === clawd ? 'お腹いっぱい ✦ (full!)' : 'お腹いっぱい ✦', 2.2); if (c !== clawd) c.lastSay = 'お腹いっぱい ✦'; c.mood('happy', 2); c.hop(.6); });
    term.log(`${c.name} is full (${FULL} bundles)`, '#7bd88f');
  }
}
// Clawd hands a bundle down the line
function passTo(h, b, from) {
  S.served++;
  const g = b.g, to = new V3();
  clawd.say(pick([`for you, ${h.short} ✦`, 'pass it down', `${h.short}, catch!`]), 1.2); clawd.workAnim = 'wave';
  tween(.25, () => {}, () => {
    const f = from.clone();
    tween(.5, e => { h.hand.getWorldPosition(to); g.position.lerpVectors(f, to, e); g.position.y += Math.sin(e * Math.PI) * .7; g.scale.setScalar(.6); },
      () => { b.alive = false; g.visible = false; if (clawd.workAnim === 'wave') clawd.workAnim = null; if (S && S.stage !== 'build') { feed(h); checkAllFull(); } });
  });
  term.log(`clawd ▸ passed a bundle to ${h.name}`, '#e8e2da');
}
function checkAllFull() {
  if (allFull() && S.stage === 'flow') {
    S.stage = 'done';
    P.btn.classList.add('sm-hidden');
    term.log('✓ everyone is full — ごちそうさま', '#7bd88f');
    hud.toast('ごちそうさま — everyone ate', { dur: 2.4 });
    const q = G.stats.quality.length ? G.stats.quality.reduce((a, v) => a + v, 0) / G.stats.quality.length : 1;
    tween(2.6, () => {}, () => { if (S && G.mode === 'play') G.chapter && game_.finish({ complete: true, perfect: G.phase < .8 && q > .7 && !S.boilOvers }); });
  }
}
function eat(c) {
  c.eatT = 1.25; c.workAnim = 'eat';
  audio.sfx('slurp', { gap: .1 });
  const keep = c.lastSay;
  c.say(pick(['ずずっ', 'ずずず…', 'zuzu', 'ちゅるん']), .9);
  if (c !== clawd) c.lastSay = keep;
}
function onPink(c) {
  S.pinkBy = c;
  if (c === clawd) emit('sticker', 'pink');
  const p = new V3(); c.g.getWorldPosition(p);
  sparkle(p.x, p.y + c.height + .2, p.z, 28, [1, .5, .75]);
  hud.toast(`✿ ${c === clawd ? 'you' : c.name} caught the pink noodle!`, { dur: 3 });
  term.log(`✿ ${c.name} caught the pink noodle!`, '#ff8ab0');
  c.mood('love', 2.4); c.blush = 1;
  crew.forEach(o => { if (o !== c) { o.hop(.5); tween(rand(.1, .5), () => {}, () => o.say(pick(['わあ!', 'lucky!!', 'the pink one!']), 1.4)); } });
  if (c === clawd) G.stats.quality.push(1);
}

// ───────────── helper jobs ─────────────
const jobs = {
  build: {
    label: 'mount the flume',
    done: () => flumeDone(),
    release: h => dropBamboo(h),
    plan(h, sp) {
      if (h._seg != null) {
        const i = h._seg;
        return { x: MOUNT_X[i] + (h.i - 1) * .18, start: () => {
          let t = 0;
          return { kind: 'mount', anim: 'chop', face: -.3, verb: `mounting ${SEG_NAME[i]}`,
            step(dt) { t += dt; if (Math.random() < dt * 3) audio.sfx('knock'); if (t > 3 / sp) { mountSeg(i, h); return true; } } };
        } };
      }
      if (nextSeg() == null) return { x: h.x, wait: '⋯ the rest is being mounted' };
      return { x: PILE_SPOT + (h.i - 1) * .2, start: () => {
        const i = nextSeg(); if (i == null) return null;
        claim(i, h); let t = 0;
        return { kind: 'pick', anim: 'pick', face: -.6, verb: 'grabbing bamboo',
          cancel() { unclaim(i); },
          step(dt) { t += dt; if (t > 1 / sp) { carryBamboo(h, i); return true; } } };
      } };
    },
  },
  water: {
    label: 'pump water',
    done: () => S.tank >= 1,
    plan(h, sp) {
      if (G.locks.pump && G.locks.pump !== h) return { x: PUMP_SPOT + .65, wait: '⋯ my turn next' };
      return { x: PUMP_SPOT, start: () => {
        if (!lock('pump', h)) return null;
        return { kind: 'pump', lock: 'pump', anim: 'crank', face: -.8, verb: 'pumping water', step(dt) {
          S.tank = Math.min(1, S.tank + dt / (6.5 / sp)); S.pumpAngle += dt * 8 * sp; S.pumping = .2; S.by.pump[h.i] += dt;
          if (Math.random() < dt * 2.5) audio.sfx('trickle');
          if (S.tank >= 1) { finishTank(h); return true; }
        } };
      } };
    },
  },
  boil: {
    label: 'boil the sōmen',
    done: () => S.boiled,
    plan(h, sp) {
      if (G.locks.stove && G.locks.stove !== h) return { x: STOVE_SPOT + .65, wait: '⋯' };
      return { x: STOVE_SPOT, start: () => {
        if (!lock('stove', h)) return null;
        return { kind: 'boil', lock: 'stove', anim: 'stir', face: -.8, verb: 'boiling sōmen', step(dt) {
          S.boil = Math.min(1, S.boil + dt / (7 / sp)); S.boilFx = .25;
          if (S.boil >= 1) { finishBoil(h); return true; }
        } };
      } };
    },
  },
  tsuyu: {
    label: 'make tsuyu',
    done: () => S.tsuyuDone,
    plan(h, sp) {
      if (G.locks.tsuyu && G.locks.tsuyu !== h) return { x: TSUYU_SPOT + .65, wait: '⋯' };
      return { x: TSUYU_SPOT, start: () => {
        if (!lock('tsuyu', h)) return null;
        return { kind: 'tsuyu', lock: 'tsuyu', anim: 'pour', face: -.8, verb: 'mixing tsuyu', step(dt) {
          S.tsuyu = Math.min(1, S.tsuyu + dt / (3.6 / sp));
          if (Math.random() < dt * 4) audio.sfx('pour');
          if (S.tsuyu >= 1) { finishTsuyu(h); return true; }
        } };
      } };
    },
  },
  garnish: {
    label: 'slice garnish',
    done: () => S.garnishDone,
    plan(h, sp) {
      if (G.locks.garnish && G.locks.garnish !== h) return { x: GARNISH_SPOT + .65, wait: '⋯ board is busy' };
      return { x: GARNISH_SPOT, start: () => {
        if (!lock('garnish', h)) return null;
        return { kind: 'garnish', lock: 'garnish', anim: 'chop', face: -.8, verb: 'slicing cucumber', step(dt) {
          S.garnish = Math.min(1, S.garnish + dt / (4.6 / sp)); S.chop = .12;
          if (Math.random() < dt * 4) audio.sfx('chop');
          if (S.garnish >= 1) { finishGarnish(h); return true; }
        } };
      } };
    },
  },
};
ZONES.forEach((zx, n) => {
  jobs['catch' + (n + 1)] = {
    label: `catch at spot ${n + 1}`,
    done: () => !S || S.stage === 'done',
    release(h) { if (h.workAnim === 'hold' || h.workAnim === 'eat') h.workAnim = null; h.faceOverride = null; h.sitTarget = 0; },
    plan(h) {
      // helpers sharing a spot stand side by side
      const mates = helpers.filter(o => o.job === h.job && o.i < h.i).length;
      const x = zx + .22 + mates * .38;
      return { x, wait: S.ate[h.i] >= FULL ? 'お腹いっぱい ✦' : '🥢 ready' };
    },
  };
});

// ───────────── the player at a station ─────────────
let game_ = null;
function interact(k, game) {
  if (k.startsWith('spot')) {
    if (S.stage !== 'flow') return;
    clawd.faceOverride = -.55; clawd.say(pick(['ready 🥢', 'here!', 'いただきます']), 1.4);
    return;
  }
  switch (k) {
    case 'pile': {
      if (flumeDone()) return clawd.say('the slide is built ✓');
      if (clawd._seg != null) return clawd.say('already carrying one → the flume');
      const i = nextSeg(); if (i == null) return clawd.say('the others have the rest');
      claim(i, clawd); carryBamboo(clawd, i); clawd.workAnim = 'pick'; tween(.35, () => {}, () => { if (clawd.workAnim === 'pick') clawd.workAnim = null; });
      return clawd.say(`got ${SEG_NAME[i]} → the flume`, 1.8);
    }
    case 'flume': {
      if (flumeDone()) return clawd.say('the slide is built ✓');
      if (clawd._seg == null) return clawd.say('grab bamboo from the pile →');
      const i = clawd._seg;
      return game.work('flume', () => mini.timing({
        title: `tie ${SEG_NAME[i]} in place`, hint: 'tap when the line is in the green · three knots', cuts: 3, zoneW: .2,
        onCut(hit) { G.stats.quality.push(hit ? 1 : .5); audio.sfx('knock'); clawd.workAnim = 'chop'; tween(.2, () => {}, () => { if (clawd.workAnim === 'chop') clawd.workAnim = null; }); },
        onDone() { mountSeg(i, clawd); },
      }));
    }
    case 'pump': {
      if (S.tank >= 1) return clawd.say('the tank is full ✓');
      return game.work('pump', () => mini.custom({
        kind: 'pump',
        html: `<div class="mt">pump the water up</div><div class="sm-row"><div class="sm-tank" title="tank"><i id="sm-lvl"></i></div><button class="hold sm-lever" id="sm-lever">pump</button></div><div class="ms">press and release, over and over · or mash space</div>`,
        setup(el, c) {
          const lever = el.querySelector('#sm-lever'), lvl = el.querySelector('#sm-lvl');
          let down = false;
          const press = () => { if (down) return; down = true; lever.classList.add('on'); S.pumpDown = 1; audio.sfx('clunk'); };
          const release = () => {
            if (!down) return; down = false; lever.classList.remove('on'); S.pumpDown = 0;
            S.tank = Math.min(1, S.tank + .085); S.by.pump[3] += .6; S.pumping = .35; clawd.workAnim = 'crank'; audio.sfx('trickle');
            for (let k = 0; k < 3; k++) P.drops.emit(-7.08 + rand(-.1, .1), 4.1, -.98, rand(-.3, .3), rand(.4, 1), 0, .5, .75, .9, 1);
            if (S.tank >= 1) { c.close(false); finishTank(clawd); }
          };
          lever.onpointerdown = e => { e.stopPropagation(); lever.setPointerCapture(e.pointerId); press(); };
          lever.onpointerup = lever.onpointercancel = release;
          c.act = press; c.actUp = release;
          c.update = () => { lvl.style.height = S.tank * 100 + '%'; if (S.pumping <= 0 && clawd.workAnim === 'crank') clawd.workAnim = null; };
        },
        onClose() { S.pumpDown = 0; },
      }));
    }
    case 'stove': {
      if (S.boiled) return clawd.say('the sōmen is boiled ✓');
      return game.work('stove', () => mini.custom({
        kind: 'boil',
        html: `<div class="mt">boil the sōmen</div><div class="sm-row"><div class="sm-pot"><i id="sm-foam"></i><b></b></div><button class="sm-ring" id="sm-ring"><span><b>びっくり水</b><small>a splash of cold water</small></span></button></div><div class="ms">when the foam reaches the line, add cold water · tap or space</div><div class="res" id="sm-res"></div>`,
        setup(el, c) {
          let foam = .2, rate = rand(.2, .28);
          const f = el.querySelector('#sm-foam'), ring = el.querySelector('#sm-ring'), res = el.querySelector('#sm-res');
          const splash = () => {
            if (foam < .4) { res.textContent = 'not yet — let it come up'; res.style.color = 'var(--warn)'; }
            else { res.textContent = foam > .7 ? 'just right ✦' : 'ok'; res.style.color = 'var(--ok)'; }
            foam = Math.max(.12, foam - .6); rate = rand(.2, .32); audio.sfx('splash');
            puff(STOVE_X, .6, -.86, 4);
          };
          ring.onpointerdown = e => { e.stopPropagation(); splash(); };
          c.act = splash;
          c.update = dt => {
            S.boil = Math.min(1, S.boil + dt / 6); S.boilFx = .25; clawd.workAnim = 'stir';
            foam += rate * dt * (1 + S.boil * .8);
            if (foam >= 1) {
              S.boilOvers++; foam = .3; S.boil = Math.max(0, S.boil - .14);
              res.textContent = 'ah! it boiled over'; res.style.color = 'var(--warn)'; audio.sfx('splash'); puff(STOVE_X, .55, -.86, 12);
            }
            f.style.height = Math.min(1, foam) * 100 + '%';
            ring.style.setProperty('--p', S.boil);
            if (S.boil >= 1) { G.stats.quality.push(S.boilOvers ? .5 : 1); c.close(false); finishBoil(clawd); }
          };
        },
        onClose() { if (clawd.workAnim === 'stir') clawd.workAnim = null; },
      }));
    }
    case 'tsuyu': {
      if (S.tsuyuDone) return clawd.say('the tsuyu is ready ✓');
      return game.work('tsuyu', () => mini.pour({
        title: 'mix the tsuyu', color: '#7a4a25', band: [.62, .86], hint: 'one part tsuyu to three parts cold water · let go in the band',
        onFill(f, holding) { S.tsuyu = Math.min(1, f); clawd.workAnim = holding ? 'pour' : null; if (holding) audio.sfx('pour', { gap: .12 }); },
        onRelease(f, q) { G.stats.quality.push(q); finishTsuyu(clawd); },
        onClose(cancelled) { if (cancelled && !S.tsuyuDone) S.tsuyu = 0; },
      }));
    }
    case 'garnish': {
      if (S.garnishDone) return clawd.say('garnish is sliced ✓');
      return game.work('garnish', () => mini.timing({
        title: 'slice cucumber and myōga', cuts: 4, hint: 'tap or space when the line is in the green',
        onCut(hit, n, total) { G.stats.quality.push(hit ? 1 : .45); S.garnish = n / total; S.chop = .2; audio.sfx('chop'); clawd.workAnim = 'chop'; },
        onDone() { finishGarnish(clawd); },
      }));
    }
  }
}

// ───────────── the ending ─────────────
async function ending(result, game) {
  P.btn.classList.add('sm-hidden'); P.ring.visible = false;
  if (result.quit) { clawd.say('another hot day ✦'); await sleep(1); return; }
  const built = S.stage !== 'build';
  S.stage = 'done';
  P.segs.forEach(sg => sg.ghost.visible = false);
  const p0 = G.phase, p1 = Math.max(p0, .9);
  tween(6.5, e => G.phase = lerp(p0, p1, ease(e)));
  audio.setMood('dusk');
  if (!built) { clawd.say('the sun beat us. bowl sōmen it is', 2.8); clawd.mood('sad', 1.5); }
  else if (!result.complete) clawd.say('it got dark… one more bundle', 2.2);
  else { clawd.say('ごちそうさま… almost', 1.8); clawd.mood('happy', 1.5); }
  crew.forEach(c => { c.sitTarget = 0; c.eatT = 0; c.workAnim = null; showSticks(c, true); });
  await game.gather([[helpers[2], -1.95, .5], [helpers[0], -.75, .5], [helpers[1], .45, .55], [clawd, 1.75, .55]], { timeout: 3.5, speed: 3 });
  crew.forEach(c => { c.faceOverride = Math.PI; c.workAnim = 'eat'; });
  S.slurpT = .3;
  cam.shot(new V3(-.1, 2.05, 7.4), new V3(-.1, 1.1, -30), { k: 1.1, drift: .5 });
  await sleep(2.6);
  tween(5, e => { S.ffLocal = e; S.ffSky = e; });
  crew.forEach(c => c.workAnim = null);
  S.slurpT = 0;
  helpers[1].say('ほたる…', 2.4);
  tween(.7, () => {}, () => helpers[0].say('fireflies!', 2));
  tween(1.4, () => {}, () => clawd.say('…summer.', 2));
  await sleep(3.2);
  const h3 = helpers[2];
  landFirefly(h3);
  await sleep(1.4);
  h3.faceOverride = .45; h3.lookAt(new V3(h3.x, 2.4, h3.z));
  cam.shot(new V3(h3.x + 1.35, 1.35, 3.3), new V3(h3.x, .8, h3.z), { k: 1.5, fov: 36 });
  h3.mood('wow', 2.6); h3.say('!!', 1.6); h3.blush = 1;
  await sleep(1.6);
  h3.say('a firefly picked me ✦', 2.4);
  await sleep(2.4);
  h3.lookAt(null);
  crew.forEach(c => { c.faceOverride = 0; c.mood('happy', 99); c.hop(.6); });
  cam.shot(new V3(0, 1.55, 6.4), new V3(0, 1.0, 0), { k: 1.6 });
  clawd.say(result.complete ? 'ごちそうさまでした ✦' : 'still delicious ✦', 3);
  await sleep(1.9);
  game.snap();
  await sleep(2.2);
}
function landFirefly(h) {
  const fly = group(P.root);
  mesh(sph(.04, 10, 8), new THREE.MeshBasicMaterial({ color: 0xd8ff7a, toneMapped: false }), 0, 0, 0, fly, false);
  const glow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3)), new THREE.PointsMaterial({ size: .5, map: dotTex, color: 0xc8ff70, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  fly.add(glow);
  const from = new V3(h.x - 1.6, 2.2, -1.8), to = new V3();
  fly.position.copy(from);
  P.headFly = { fly, glow };
  tween(2.2, e => {
    h.headSlot.getWorldPosition(to); to.y += .12;
    fly.position.lerpVectors(from, to, ease(e)); fly.position.x += Math.sin(e * 9) * .25 * (1 - e); fly.position.y += Math.sin(e * 6) * .2 * (1 - e);
  }, () => { h.headSlot.attach(fly); ATTACHED.push(fly); });
}

// ───────────── diary ─────────────
function diary(result) {
  const lines = [];
  const built = mountedCount(), by = S.by;
  if (built < 5) {
    lines.push('We tried to build a noodle slide out of bamboo, but the sun went down before it was finished.');
    lines.push(S.boiled ? 'We ate the sōmen out of a bowl. It was still cold and good.' : 'We never even boiled the noodles. We drank cold barley tea and watched the sky instead.');
  } else {
    const top = by.build.indexOf(Math.max(...by.build));
    lines.push(`We built a noodle slide out of bamboo. ${top === 3 ? 'I' : nameOf(whoOf(top))} put up the most pieces.`);
    const pumper = by.pump.indexOf(Math.max(...by.pump));
    if (S.tankDone) lines.push(`${pumper === 3 ? 'I' : nameOf(whoOf(pumper))} pumped the water all the way to the top.`);
  }
  if (S.boilOvers) lines.push(S.boilOvers > 1 ? `The pot boiled over ${S.boilOvers} times. Oops.` : 'The pot boiled over once. Oops.');
  if (S.flowed) {
    const mine = S.ate[3];
    lines.push(mine === 0 ? 'I forgot to catch any noodles for myself.' : mine === 1 ? 'I caught one bundle.' : `I caught ${mine} bundles${mine > FULL ? ' (that is more than five!)' : ''}.`);
    const best = [0, 1, 2].reduce((a, i) => S.ate[i] > S.ate[a] ? i : a, 0);
    if (S.ate[best] > 0) lines.push(`${nameOf(helpers[best])} caught ${S.ate[best]}.`);
  }
  if (S.served) lines.push(S.served === 1 ? 'When I was full, I passed one bundle down to a helper.' : `When I was full, I passed ${S.served} bundles down to the helpers.`);
  if (S.pinkBy) lines.push(`${S.pinkBy === clawd ? 'I' : nameOf(S.pinkBy)} caught the pink noodle!!`);
  else if (S.pinkEscapes) lines.push(`Nobody caught the pink noodle. It got away${S.pinkEscapes > 1 ? ' twice' : ''}.`);
  const t = S.treats[3];
  if (t.length) lines.push(`I also caught ${t.includes('tomato') ? 'a cherry tomato' : ''}${t.includes('tomato') && t.includes('mikan') ? ' and ' : ''}${t.includes('mikan') ? 'a piece of mikan' : ''}.`);
  lines.push('When it got dark, fireflies came out over the trees. One landed on helper 3.');
  const jp = built < 5 ? 'きょうは ながしそうめんを つくろうとしたけど、ひが くれて しまいました。'
    : result.complete ? 'きょうは ながしそうめんを しました。ほたるが きれいでした。'
    : 'きょうは ながしそうめんを しました。よるに なって しまいました。';
  return { jp, lines };
}

// ───────────── chapter definition ─────────────
const CSS = `
#sm-catch{position:fixed;right:18px;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 92px);z-index:6;width:86px;height:86px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;touch-action:manipulation;transition:opacity .3s,transform .12s,border-color .15s,box-shadow .15s;color:var(--ink);font-family:var(--mono);user-select:none;-webkit-user-select:none}
#sm-catch b{font-size:26px;line-height:1.05}
#sm-catch span{font-size:11px;font-weight:600}
#sm-catch i{font-style:normal;font-size:10px;color:var(--dim)}
#sm-catch.hot{border-color:#7bd88f;box-shadow:0 0 0 3px rgba(123,216,143,.5),0 6px 24px rgba(0,0,0,.25)}
#sm-catch:active{transform:scale(.93)}
#sm-catch.sm-hidden{opacity:0;pointer-events:none}
@media (max-width:700px){#sm-catch{bottom:calc(max(14px,env(safe-area-inset-bottom)) + 136px);right:12px}}
.sm-row{display:flex;gap:18px;align-items:center;justify-content:center}
.sm-tank{width:40px;height:130px;border-radius:9px;background:rgba(255,255,255,.1);position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.14)}
.sm-tank i{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(#8fd3f7,#3d8fe3)}
.sm-lever{transition:transform .08s}
.sm-lever.on{transform:translateY(8px) scale(.97)}
.sm-pot{width:76px;height:118px;border-radius:6px 6px 22px 22px;background:#2c2733;position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.14)}
.sm-pot i{position:absolute;left:0;right:0;bottom:0;height:20%;background:radial-gradient(circle at 30% 35%,#fff 0 30%,transparent 32%) 0 0/14px 14px,#e3eefb}
.sm-pot b{position:absolute;left:0;right:0;bottom:78%;border-top:2px dashed #f7d488}
.sm-ring{width:112px;height:112px;border-radius:50%;border:0;padding:0;display:grid;place-items:center;background:conic-gradient(#7bd88f calc(var(--p,0)*1turn),#2c2733 0);cursor:pointer;touch-action:none}
.sm-ring span{width:90px;height:90px;border-radius:50%;background:#1d1a22;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
.sm-ring b{font-size:14px}
.sm-ring small{font-size:9px;color:var(--dim);max-width:70px;line-height:1.2}
`;

export default {
  id: 'somen', day: 3, title: 'Nagashi-sōmen', jp: '流しそうめん', short: 'そうめん', weather: 'はれ · とても あつい',
  blurb: 'Build a bamboo noodle slide, then catch dinner as it flows past.',
  jpPreview: 'きょうは ながしそうめんを する。',
  prompt: 'build a noodle slide', goal: 'build a noodle slide',
  sky: 'hot', mood: 'day', dayLen: 240, phase: [0, 1], clock: [16 * 60, 19 * 60 + 40], clockNote: '🎐 fireflies after dusk',
  helpers: [
    { spec: ['garnish'], specName: 'garnish' },
    { spec: ['boil', 'tsuyu'], specName: 'boil · tsuyu' },
    { spec: ['build', 'water'], specName: 'bamboo · water' },
  ],
  intro: [['$ git pull'], ['  Already up to date.', '#7bd88f'], ['$ npm run build'], ['  ✓ built in 0.42s', '#7bd88f'], ['$ curl wttr.in/balcony'], ['  ☀ 33°C · humid · cicadas: loud', '#f2c14e']],
  introShots: [
    { pos: [-1.2, 1.2, 5.6], look: [9, 9, -25], fov: 52, dur: 2.4, to: { pos: [-.8, 1.45, 5.2] } },
    { pos: [2.65, .78, .5], look: [1.75, .2, -.86], fov: 32, dur: 2.0, to: { pos: [2.45, .72, .38] } },
    { pos: [-1.9, 1.0, .8], look: [-2.6, .35, -.86], fov: 32, dur: 1.9, to: { pos: [-2.1, .95, .65] } },
    { pos: [-4.7, 3.0, 2.3], look: [-6.3, 3.0, -1], fov: 38, dur: 1.9, to: { pos: [-4.9, 3.2, 2.1] } },
  ],
  introSays() {
    helpers[2].say('bamboo! water! ✦', 3);
    tween(.8, () => {}, () => helpers[0].say('I call garnish', 2.4));
    tween(1.6, () => {}, () => helpers[1].say('so hot…', 2.4));
  },

  setup(root, game) {
    game_ = game;
    ATTACHED.splice(0).forEach(o => o.parent && o.parent.remove(o));
    crew.forEach(c => { c._seg = null; c._log = null; c._sticks = null; c.eatT = 0; });
    S = {
      stage: 'build', mounted: [false, false, false, false, false], claimed: [null, null, null, null, null], pileLeft: 5,
      tank: 0, tankDone: false, pumpAngle: 0, pumping: 0, pumpDown: 0,
      boil: 0, boiled: false, boilFx: 0, boilOvers: 0, tsuyu: 0, tsuyuDone: false, garnish: 0, garnishDone: false, chop: 0,
      water: 0, flowQueued: false, flowT: 0, spawnT: 0, spawned: 0, nextTreat: randi(5, 7), treatFlip: Math.random() < .5,
      pinkAt: randi(8, 11), pinkBy: null, pinkEscapes: 0, bundles: [],
      ate: [0, 0, 0, 0], treats: [[], [], [], []], colander: 0, served: 0, whiffs: 0, ringMiss: 0, slurpT: 0, ffLocal: 0, ffSky: 0,
      by: { build: [0, 0, 0, 0], pump: [0, 0, 0, 0], boil: null, tsuyu: null, garnish: null },
    };
    buildPath();
    build(root);
    if (G.dev.has('day')) window.__somen = { get S() { return S; }, get P() { return P; }, PATH: () => PATH };
    updatePile();
    P.css = document.createElement('style'); P.css.textContent = CSS; document.head.appendChild(P.css);
    P.btn = document.createElement('button');
    P.btn.id = 'sm-catch'; P.btn.className = 'panel sm-hidden'; P.btn.setAttribute('aria-label', 'catch the noodle');
    P.btn.innerHTML = '<b>🥢</b><span>catch</span><i id="sm-count">0/5</i>';
    P.btn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); attemptCatch(); });
    document.body.appendChild(P.btn);
  },

  stations: () => {
    const st = {
      pump: { name: 'hand pump', spot: PUMP_SPOT, job: 'water', hitObj: () => P.hits.pump, ring: [PUMP_X, -.82, 1.0], keywords: ['pump', 'water', 'tank', 'hose'],
        tip: () => `hand pump · tank ${Math.round(S.tank * 100)}%` },
      flume: { name: 'bamboo flume', spot: () => MOUNT_X[clawd._seg ?? nextSeg() ?? 3], job: 'build', hitObj: () => P.hits.flume, ring: () => [MOUNT_X[clawd._seg ?? nextSeg() ?? 3], .3, 1.0], keywords: ['flume', 'slide', 'mount', 'build', 'chute'],
        tip: () => `bamboo flume · ${mountedCount()}/5 mounted` },
      pile: { name: 'bamboo pile', spot: PILE_SPOT, job: 'build', hitObj: () => P.hits.pile, ring: [PILE_X, -.86, 1.2], keywords: ['bamboo', 'pile', 'carry', 'build'],
        tip: () => `bamboo · ${S.pileLeft} piece${S.pileLeft === 1 ? '' : 's'} left` },
      stove: { name: 'pot of sōmen', spot: STOVE_SPOT, job: 'boil', hitObj: () => P.hits.stove, ring: [STOVE_X, -.86, 1.0], keywords: ['boil', 'pot', 'stove', 'noodles', 'somen', 'sōmen'],
        tip: () => S.boiled ? 'pot · sōmen boiled and rinsed ✓' : `pot · ${S.boil > 0 ? `boiling ${Math.round(S.boil * 100)}%` : 'water ready'}` },
      tsuyu: { name: 'tsuyu', spot: TSUYU_SPOT, job: 'tsuyu', hitObj: () => P.hits.tsuyu, ring: [TSUYU_X - .1, -.8, 1.1], keywords: ['tsuyu', 'sauce', 'dip', 'mix', 'cups'],
        tip: () => S.tsuyuDone ? 'tsuyu · four cups poured ✓' : 'tsuyu · dipping sauce, mixed with cold water' },
      garnish: { name: 'garnish board', spot: GARNISH_SPOT, job: 'garnish', hitObj: () => P.hits.garnish, ring: [GARNISH_X, -.85, 1.1], keywords: ['garnish', 'cucumber', 'myoga', 'myōga', 'slice', 'knife'],
        tip: () => S.garnishDone ? 'garnish · sliced ✓' : 'garnish · cucumber + myōga' },
    };
    ZONES.forEach((z, n) => {
      st['spot' + (n + 1)] = {
        name: `catch spot ${n + 1}`, spot: z + .75, hitObj: () => P.hits['spot' + (n + 1)], ring: [z + .5, .32, .95], keywords: ['spot', 'catch', WORDS[n], String(n + 1)],
        tip: () => { const w = helpers.filter(h => h.job === 'catch' + (n + 1)).map(h => h.short); return `catch spot ${n + 1}${n === 0 ? ' · first in line' : n === 4 ? ' · last in line' : ''}${w.length ? ' · ' + w.join(', ') : ''}`; },
      };
    });
    return st;
  },
  jobs,
  interact,
  ready: () => !!S && allFull(),
  // without bamboo in hand, the flume means "go get bamboo"
  redirect: k => (k === 'flume' && !G.selected && S && clawd._seg == null && !flumeDone() && nextSeg() != null) ? 'pile' : k,

  todo() {
    const who = j => { const w = helpers.filter(h => h.job === j).map(h => h.short); const lk = { build: 'flume', water: 'pump', boil: 'stove', tsuyu: 'tsuyu', garnish: 'garnish' }[j]; if (G.mini && G.locks[lk] === clawd) w.unshift('you'); if (j === 'build' && clawd._seg != null && !w.includes('you')) w.unshift('you'); return w; };
    if (S.stage === 'build') return [
      { label: 'mount the flume', done: flumeDone(), detail: bar(mountedCount(), 5), workers: who('build') },
      { label: 'pump water', done: S.tank >= 1, detail: S.tank >= 1 ? '' : `${Math.round(S.tank * 100)}%`, workers: who('water') },
      { label: 'boil the sōmen', done: S.boiled, workers: who('boil') },
      { label: 'make tsuyu', done: S.tsuyuDone, workers: who('tsuyu') },
      { label: 'slice garnish', done: S.garnishDone, workers: who('garnish') },
      { label: 'let it flow', done: false, blocked: true, detail: prepDone() ? '…' : '' },
    ];
    const row = i => ({ label: i === 3 ? 'you eat' : `${helpers[i].name} eats`, done: S.ate[i] >= FULL, detail: bar(S.ate[i], FULL) + (S.pinkBy && S.pinkBy.i === i ? ' ✿' : '') });
    return [{ label: 'noodle slide', done: true, detail: 'flowing' }, row(3), row(0), row(1), row(2)];
  },
  hint() {
    if (!S) return '';
    if (S.stage === 'build') {
      if (clawd._seg != null) return 'carrying bamboo → click the flume to tie it in';
      if (G.stats.deleg === 0 && G.t < 25) return 'click a station to work it yourself · or pick a helper below, then a station';
      if (G.t < 70 && G.stats.deleg < 5) return 'helper 3 ✦ bamboo + water · helper 2 ✦ boiling + tsuyu · helper 1 ✦ garnish';
      if (flumeDone() && !prepDone()) return 'the slide is up · finish the prep and the noodles can flow';
      return '';
    }
    if (S.stage === 'flow') {
      if (S.ate[3] >= FULL && !allFull()) return 'you\'re full · keep catching — you\'ll hand each bundle to whoever is hungriest';
      if (!onRun()) return 'walk to a spot by the slide (click a ring) · then tap 🥢 when a noodle passes the ring';
      if (S.ate[3] < 2) return 'tap 🥢 or space when a noodle is inside the ring';
      if ([0, 1, 2].some(i => S.ate[i] >= FULL) && [0, 1, 2].some(i => S.ate[i] < 2)) return 'helpers upstream eat first · select one and move it to share the flow';
      return '';
    }
    return '';
  },

  pointer(type, e, ray) {
    if (type !== 'down' || !S || S.stage !== 'flow' || G.mode !== 'play') return;
    const live = S.bundles.filter(b => b.alive && !b.caught && b.drop <= 0).map(b => b.hit);
    const h = live.length ? ray.intersectObjects(live, false)[0] : null;
    if (h) { tapBundle(h.object.userData.bundle); return true; }
    if (P.ring.visible && ray.intersectObject(P.ringHit, false).length) { attemptCatch(); return true; }
  },
  key(e, type) {
    if (!S || S.stage !== 'flow' || G.mode !== 'play' || G.mini || e.code !== 'Space') return;
    e.preventDefault();
    if (type === 'down' && !e.repeat) attemptCatch();
    return true;
  },

  update(dt) {
    if (!S || !P) return;
    // pump handle: follows the player's lever, or swings while a helper pumps
    S.pumping = Math.max(0, S.pumping - dt);
    const hTarget = G.mini?.kind === 'pump' ? (S.pumpDown ? -.32 : .35) : S.pumping > 0 ? Math.sin(S.pumpAngle) * .33 : .35;
    P.pumpHandle.rotation.z = lerp(P.pumpHandle.rotation.z, hTarget, 1 - Math.exp(-dt * 16));
    P.tankWater.scale.y = Math.max(.001, S.tank); P.tankWater.position.y = 3.64 + .21 * Math.max(.001, S.tank);
    if (S.pumping > 0 && Math.random() < dt * 5) P.drops.emit(-7.0 + rand(-.05, .05), 4.02, -1.0, rand(-.15, .15), rand(.2, .6), 0, .4, .75, .9, 1);

    // water runs once the slide is built and the tank is full
    const want = flumeDone() && S.tank >= 1 ? 1 : 0;
    S.water = lerp(S.water, want, 1 - Math.exp(-dt * 1.4));
    P.waters.forEach(w => { w.material.opacity = S.water * .82; w.material.map.offset.x -= dt * w.userData.speed * .55; });
    P.streamTop.visible = P.streamEnd.visible = S.water > .08;
    P.streamTop.material.opacity = P.streamEnd.material.opacity = .8 * S.water;
    if (S.water > .3 && Math.random() < dt * 14) {
      const e = SEGS[randi(0, 4)].b;
      P.splash.emit(e.x, e.y + .02, e.z, rand(-.5, .5), rand(.4, 1.1), rand(-.2, .3), .5, .82, .93, 1);
    }
    if (S.water > .3 && Math.random() < dt * 8) P.splash.emit(COLANDER.x + rand(-.08, .08), COLANDER.y + .2, COLANDER.z, rand(-.6, .6), rand(.5, 1.2), rand(-.4, .4), .5, .82, .93, 1);
    audio.loop('water', S.water * .55);

    // the pot
    S.boilFx = Math.max(0, S.boilFx - dt);
    const boiling = S.boilFx > 0;
    P.flame.visible = boiling; if (boiling) P.flame.scale.setScalar(1 + Math.sin(G.time * 30) * .06);
    if (boiling && Math.random() < dt * 9) P.steam.emit(STOVE_X + rand(-.15, .15), .5, -.86 + rand(-.1, .1), rand(-.1, .1), rand(.3, .6), rand(-.1, .1), rand(1, 1.6), 1, 1, 1);
    if (boiling && Math.random() < dt * 12) P.splash.emit(STOVE_X + rand(-.18, .18), .45, -.86 + rand(-.15, .15), 0, rand(.3, .7), 0, .25, .9, .95, 1);
    audio.loop('bubble', boiling ? .45 : 0);
    P.potNoodles.visible = S.boil > 0 && !S.boiled; P.potNoodles.scale.set(.6 + .4 * S.boil, .3, .6 + .4 * S.boil);
    P.basketNoodles.visible = S.boiled && S.stage !== 'done';
    // tsuyu + garnish progress
    P.jugLiquid.scale.y = Math.max(.001, S.tsuyu); P.jugLiquid.position.y = .01 + .1 * Math.max(.001, S.tsuyu);
    P.cups.forEach(c => c.visible = S.tsuyuDone);
    S.chop = Math.max(0, S.chop - dt);
    P.knife.position.y = .09 + (S.chop > 0 ? Math.abs(Math.sin(G.time * 18)) * .18 : 0);
    const shown = Math.round(S.garnish * P.slices.length);
    P.slices.forEach((s, k) => s.visible = k < shown);
    P.cucumber.scale.y = 1 - S.garnish * .7;
    P.myoga.forEach(m => m.visible = S.garnish < .9);

    // noodles
    if (S.stage === 'flow' && G.mode === 'play') {
      S.flowT += dt; S.spawnT -= dt;
      if (S.spawnT <= 0) { spawnBundle(nextType()); S.spawnT = rand(1.45, 2.1); }
      // helpers at their spots try each bundle once as it passes
      for (const h of helpers) {
        if (!h.job || !h.job.startsWith('catch') || !h.arrived() || h.eatT > 0 || S.ate[h.i] >= FULL) continue;
        const zx = h.x - .22;
        for (const b of S.bundles) {
          if (!b.alive || b.caught || b.drop > 0 || b.seg < 3 || b.rolled.has(h.i)) continue;
          if (Math.abs(b.pos.x - zx) < .3) {
            b.rolled.add(h.i);
            if (Math.random() < SKILL[h.i] * (b.type === 'pink' ? .8 : 1)) { catchBy(h, b); break; }
            else if (Math.random() < .3) { const keep = h.lastSay; h.say(pick(['ah—', 'missed!', 'so fast', 'next one']), .9); h.lastSay = keep; }
          }
        }
      }
    }
    updateBundles(dt);

    // crew poses: chopsticks up at a spot, slurping after a catch, full helpers sit down
    for (const c of crew) {
      if (c.eatT > 0) { c.eatT -= dt; c.workAnim = 'eat'; if (c.eatT <= 0) c.workAnim = null; continue; }
      if (S.stage !== 'flow' || G.mode !== 'play') continue;
      const atSpot = c === clawd ? onRun() : !!(c.job && c.job.startsWith('catch') && c.arrived());
      if (atSpot && (c === clawd || S.ate[c.i] < FULL)) { c.workAnim = 'hold'; if (c !== clawd) c.faceOverride = -.4; }
      else if (c.workAnim === 'hold') c.workAnim = null;
      if (c !== clawd && atSpot && S.ate[c.i] >= FULL) c.sitTarget = 1;
    }
    if (S.slurpT > 0 && G.mode === 'ending') { S.slurpT -= dt; if (S.slurpT <= 0) { S.slurpT = rand(.5, .9); const c = pick(crew); c.say(pick(['ずずっ', 'ずずず…', 'ちゅるん']), .8); audio.sfx('slurp'); } }

    // the catch ring
    const showRing = onRun();
    P.ring.visible = showRing;
    const inZone = showRing ? bundleInZone() : null;
    if (showRing) {
      P.ring.position.copy(runAxis(zoneX())); P.ring.position.z += .05;
      S.ringMiss = Math.max(0, S.ringMiss - dt);
      const col = S.ringMiss > 0 ? 0xff6a5a : inZone ? 0x7bd88f : 0xffffff;
      P.ring.material.color.setHex(col);
      P.ring.scale.setScalar(inZone ? 1.15 + Math.sin(G.time * 18) * .05 : 1 + Math.sin(G.time * 4) * .04);
    }
    P.btn.classList.toggle('hot', !!inZone);
    const markOn = S.stage === 'flow' && G.mode === 'play' && !showRing;
    P.marks.forEach((m, n) => {
      const taken = helpers.some(h => h.job === 'catch' + (n + 1));
      m.material.opacity = lerp(m.material.opacity, markOn ? (taken ? .25 : .75) + Math.sin(G.time * 4 + n) * .15 : 0, 1 - Math.exp(-dt * 6));
      m.visible = m.material.opacity > .01;
    });
    P.btn.classList.toggle('sm-hidden', !(S.stage === 'flow' && G.mode === 'play'));
    const cnt = P.btn.querySelector('#sm-count'); const ct = `${Math.min(S.ate[3], 99)}/${FULL}`; if (cnt.textContent !== ct) cnt.textContent = ct;

    // fireflies: the sky's swarm over the trees, plus a few drifting up to the balcony
    const dusk = smooth(.74, .92, G.phase);
    sky.fireflies = Math.max(S.ffSky, dusk * .8);
    const lvl = Math.max(S.ffLocal, dusk * .5);
    const fp = P.ff.geometry.attributes.position.array, fc = P.ff.geometry.attributes.color.array;
    P.ffAnchor.forEach((a, k) => {
      const t = G.time * a.sp + a.ph, l = a.near ? S.ffLocal : lvl;
      fp[k * 3] = a.x + Math.sin(t * .7) * .6; fp[k * 3 + 1] = a.y + Math.sin(t * 1.1) * .35 + l * .4; fp[k * 3 + 2] = a.z + Math.cos(t * .9) * .4;
      const blink = (.25 + .75 * Math.pow(Math.max(0, Math.sin(G.time * a.blink + a.ph)), 3)) * l;
      fc[k * 3] = .75 * blink; fc[k * 3 + 1] = 1 * blink; fc[k * 3 + 2] = .35 * blink;
    });
    P.ff.geometry.attributes.position.needsUpdate = true; P.ff.geometry.attributes.color.needsUpdate = true;
    if (P.headFly) { const k = .6 + .4 * Math.pow(Math.max(0, Math.sin(G.time * 2.6)), 2); P.headFly.glow.material.opacity = k; }
  },

  ending,
  diary,
  teardown() {
    ATTACHED.splice(0).forEach(o => o.parent && o.parent.remove(o));
    crew.forEach(c => { c._seg = null; c._log = null; c._sticks = null; c.eatT = 0; });
    if (P) { [P.splash, P.steam, P.glints, P.drops].forEach(p => p && p.dispose()); P.btn?.remove(); P.css?.remove(); }
    audio.loop('water', 0); audio.loop('bubble', 0);
    sky.fireflies = 0;
    S = null; P = null;
  },

  ls: () => ['flume/{top,middle,low,run,last}.bamboo  pump/  tank  pot/  tsuyu/  garnish/{cucumber,myoga}  colander'],
  review: () => !S ? 'nothing to review' : S.stage === 'build' ? `changes requested: ${!flumeDone() ? `${5 - mountedCount()} chute${5 - mountedCount() === 1 ? '' : 's'} still unmounted` : 'prep isn\'t finished'}` : allFull() ? 'LGTM ✦ water pressure nominal, everyone fed' : 'LGTM · flow is live · some helpers still hungry',
  commands: {
    'cat recipe.md': () => [
      '# nagashi-sōmen (流しそうめん)',
      'thin wheat noodles sent down a split-bamboo flume of cold running water.',
      'catch them with chopsticks as they pass, dip in cold tsuyu, slurp.',
      '- boil sōmen ~2 minutes; when it foams up, add a cup of cold water (びっくり水)',
      '- rinse hard in cold water so the noodles stay springy',
      '- garnish: green onion, myōga, ginger, shiso, a little cucumber',
      '- most bundles in a pack are white; a few strands are pink or green. catching one is lucky.',
      '- in Kagoshima they spin sōmen around a round tub instead (sōmen-nagashi)',
    ],
  },
};

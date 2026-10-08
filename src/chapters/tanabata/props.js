// Day 4 props: the bamboo (笹), its decorations, the craft table, the wish desk.
import { THREE, V3, mesh, group, box, rbox, cyl, sph, toon, canvasTex, MAT, hitMat } from '../../core/gfx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand, pick, lerp } from '../../core/util.js';

// 五色 — the five tanzaku colors, from the five elements (black is usually purple on a strip)
export const GOSHIKI = [
  { jp: '青', en: 'green', css: '#3a9a6e', ink: '#14231c' },
  { jp: '赤', en: 'red', css: '#d8343c', ink: '#2a0d10' },
  { jp: '黄', en: 'yellow', css: '#e8b730', ink: '#2b2208' },
  { jp: '白', en: 'white', css: '#f4f1ec', ink: '#1d1b22' },
  { jp: '紫', en: 'purple', css: '#7b4fa0', ink: '#f6efe2' },
];
const PAPER = ['#d8343c', '#f08aa8', '#e8b730', '#3a9a6e', '#3d7fd6', '#7b4fa0', '#ef8a3c', '#79c3e8', '#f4f1ec'];

const col = c => new THREE.Color(c);
function paint(geo, color) {
  const n = geo.attributes.position.count, a = new Float32Array(n * 3), c = col(color);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
// merge geometries that may differ in uv/index: keep position + normal + color only
function mergeFlat(list) {
  const clean = list.map(g => {
    const n = g.index ? g.toNonIndexed() : g;
    const o = new THREE.BufferGeometry();
    o.setAttribute('position', n.attributes.position);
    if (n.attributes.normal) o.setAttribute('normal', n.attributes.normal);
    o.setAttribute('color', n.attributes.color);
    return o;
  });
  const m = mergeGeometries(clean);
  if (!m.attributes.normal) m.computeVertexNormals();
  return m;
}
const vtoon = (o = {}) => toon(0xffffff, { vertexColors: true, ...o });

// ───────── the bamboo ─────────
const leafBase = (() => {
  const len = .3, wid = .05, s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(wid, -len * .25, wid * .62, -len * .68);
  s.quadraticCurveTo(wid * .25, -len * .93, 0, -len);
  s.quadraticCurveTo(-wid * .25, -len * .93, -wid * .62, -len * .68);
  s.quadraticCurveTo(-wid, -len * .25, 0, 0);
  const g = new THREE.ShapeGeometry(s, 3);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, -Math.abs(p.getX(i)) * .7);   // fold along the midrib
  return g;
})();
const LEAF_GREENS = ['#4f9a3a', '#5fae45', '#3f8a35', '#6cb84f'];

function leafCluster(n, spread, up = false) {
  const geos = [], m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let k = 0; k < n; k++) {
    const a = lerp(-spread, spread, n === 1 ? .5 : k / (n - 1)) + rand(-.15, .15);
    e.set(rand(-.35, .35), rand(-.9, .9), a + (up ? Math.PI : 0));
    q.setFromEuler(e);
    const s = rand(.8, 1.15);
    m.compose(new V3(0, 0, 0), q, new V3(s, s, s));
    geos.push(paint(leafBase.clone().applyMatrix4(m), pick(LEAF_GREENS)));
  }
  return mergeFlat(geos);
}

export function buildBamboo(parent, x, z) {
  const B = { branches: [], anchors: [], clusters: [], x, z };
  // wooden bucket with gravel
  const staves = canvasTex(256, 64, c => {
    for (let i = 0; i < 16; i++) { c.fillStyle = i % 2 ? '#a8784a' : '#b98856'; c.fillRect(i * 16, 0, 16, 64); }
    c.fillStyle = 'rgba(40,20,10,.35)'; for (let i = 0; i < 16; i++) c.fillRect(i * 16, 0, 2, 64);
  });
  const bucket = group(parent, x, 0, z);
  mesh(new THREE.CylinderGeometry(.34, .28, .42, 24, 1, true), toon(0xffffff, { map: staves, side: THREE.DoubleSide }), 0, .21, 0, bucket);
  mesh(cyl(.28, .28, .02, 24), MAT.woodDark, 0, .01, 0, bucket);
  for (const y of [.09, .33]) mesh(new THREE.TorusGeometry(.32 - (.33 - y) * .14, .013, 6, 28), toon(0x3a3532), 0, y, 0, bucket).rotation.x = Math.PI / 2;
  mesh(cyl(.31, .31, .02, 24), toon(0x6d6458), 0, .37, 0, bucket, false);
  for (let i = 0; i < 9; i++) { const a = rand(0, 6.28), r = rand(.08, .26); mesh(sph(rand(.035, .055), 6, 5), toon(pick([0x8d877d, 0xa29b90, 0x77716a])), Math.cos(a) * r, .39, Math.sin(a) * r, bucket, false); }

  // the culm: a gently curving, tapering tube with lighter nodes
  B.pivot = group(parent, x, .4, z);          // rotates to stand the bamboo up
  B.sway = group(B.pivot);
  const H = 4.05;
  const curve = B.curve = new THREE.CatmullRomCurve3([[0, 0, 0], [.015, 1.1, 0], [.06, 2.2, .015], [.14, 3.2, .03], [.25, H, .05]].map(p => new V3(...p)));
  const tub = 40, rad = 8, tube = new THREE.TubeGeometry(curve, tub, .075, rad, false);
  const pos = tube.attributes.position, c = new V3(), v = new V3();
  for (let i = 0; i <= tub; i++) {
    curve.getPointAt(i / tub, c); const k = 1 - .58 * (i / tub);
    for (let j = 0; j <= rad; j++) { const idx = i * (rad + 1) + j; v.fromBufferAttribute(pos, idx).sub(c).multiplyScalar(k).add(c); pos.setXYZ(idx, v.x, v.y, v.z); }
  }
  tube.computeVertexNormals();
  mesh(tube, toon(0x5d9a3c), 0, 0, 0, B.sway);
  const nodes = [];
  for (let k = 1; k <= 9; k++) {
    const t = k / 10, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
    const g = new THREE.TorusGeometry(.075 * (1 - .58 * t) * 1.06, .011, 5, 14);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), tg)); g.translate(p.x, p.y, p.z);
    nodes.push(g);
  }
  mesh(mergeGeometries(nodes), toon(0x86bf5f), 0, 0, 0, B.sway);

  // branches: [t along the culm, direction φ (0 = right, π/2 = toward camera), elevation, length]
  const BR = [
    [.37, .25, .5, 1.1], [.39, Math.PI - .2, .55, 1.05],
    [.5, -.15, .55, 1.0], [.52, Math.PI + .3, .5, 1.0],
    [.62, .55, .62, .9], [.64, Math.PI - .55, .6, .9],
    [.74, -.35, .68, .75], [.76, Math.PI + .25, .7, .72],
    [.86, .3, .78, .55], [.87, Math.PI - .35, .8, .5],
  ];
  const twigMat = toon(0x7a8f45), leafMat = vtoon({ side: THREE.DoubleSide });
  BR.forEach(([t, phi, el, L], bi) => {
    const p = curve.getPointAt(t);
    const g = group(B.sway, p.x, p.y, p.z); g.rotation.y = -phi;
    const inner = group(g); inner.rotation.z = el;
    const tw = new THREE.CylinderGeometry(.009, .016, L, 5); tw.rotateZ(-Math.PI / 2); tw.translate(L / 2, 0, 0);
    mesh(tw, twigMat, 0, 0, 0, inner, false);
    const cls = [];
    for (const f of [1, .6]) {
      const cl = group(inner, L * f, 0, 0); cl.rotation.z = -el;
      mesh(leafCluster(f === 1 ? 7 : 5, f === 1 ? 1.25 : 1.0), leafMat, 0, 0, 0, cl);
      B.clusters.push(cl); cls.push(cl);
    }
    for (const f of [.92, .5]) {
      const a = new THREE.Object3D(); a.position.set(L * f, -.02, 0); inner.add(a);
      B.anchors.push({ obj: a, bi, f, side: Math.cos(phi) >= 0 ? 1 : -1, t, used: false });
    }
    B.branches.push({ g, inner, el, open: el, ph: rand(0, 6.28), L, clusters: cls });
  });
  // crown
  const top = curve.getPointAt(1), crown = group(B.sway, top.x, top.y, top.z);
  mesh(leafCluster(9, 1.1, true), leafMat, 0, 0, 0, crown);
  B.clusters.push(crown); B.crown = crown;

  // a raycast target for the whole plant; resized when it stands up
  B.hit = mesh(box(1, 1, 1), hitMat, 0, 0, 0, parent, false);
  B.setHit = (up, yaw = 0) => {
    if (up) { B.hit.position.set(x + .1, 1.7, z); B.hit.scale.set(1.6, 3.4, 1.2); B.hit.rotation.y = 0; }
    else { B.hit.position.set(x + 2.0 * Math.cos(yaw), .45, z - 2.0 * Math.sin(yaw)); B.hit.scale.set(4.2, .75, .7); B.hit.rotation.y = yaw; }
  };
  return B;
}

// bundled = branches folded up against the culm and leaves tied tight, the way bamboo is carried
export function setBundle(B, k) {   // k: 1 = tied, 0 = open
  B.branches.forEach(b => { b.open = lerp(b.el, 1.32, k); });
  B.clusters.forEach(c => c.scale.setScalar(lerp(1, .32, k)));
}

// ───────── decorations: each is a group whose origin is the top of its thread ─────────
const thread = (len) => { const g = new THREE.CylinderGeometry(.004, .004, len, 3); g.translate(0, -len / 2, 0); return paint(g, '#3a3532'); };

function craneGeo(color) {
  const P = {
    F: [.075, 0, 0], B: [-.075, 0, 0], K: [0, -.06, 0], WL: [-.015, .045, .19], WR: [-.015, .045, -.19],
    n0: [.05, -.012, .01], n1: [.08, 0, -.01], N: [.19, .13, 0], H: [.225, .095, 0], h0: [.185, .11, 0],
    t0: [-.05, -.012, .01], t1: [-.08, 0, -.01], T: [-.2, .14, 0],
  };
  const tris = [['F', 'B', 'WL'], ['F', 'WR', 'B'], ['F', 'K', 'B'], ['n0', 'N', 'n1'], ['N', 'H', 'h0'], ['t0', 'T', 't1']];
  const arr = [];
  tris.forEach(t => t.forEach(k => arr.push(...P[k])));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return paint(g, color);
}

export function makeCrane() {
  // a short string of three cranes (千羽鶴 in miniature)
  const cols = [pick(PAPER), pick(PAPER), pick(PAPER)], geos = [thread(.55)];
  cols.forEach((c, i) => { const g = craneGeo(c); g.scale(1.25, 1.25, 1.25); g.rotateY(i * 1.1); g.translate(0, -.14 - i * .17, 0); geos.push(g); });
  const o = new THREE.Group();
  mesh(mergeFlat(geos), vtoon({ side: THREE.DoubleSide }), 0, 0, 0, o, false);
  o.userData = { kind: 'crane', len: .6 };
  return o;
}

const lanternTex = canvasTex(64, 64, c => {
  c.fillStyle = '#d8343c'; c.fillRect(0, 0, 64, 64);
  c.fillStyle = 'rgba(0,0,0,.22)'; for (let y = 4; y < 64; y += 8) c.fillRect(0, y, 64, 2);
  c.fillStyle = '#fff3e0'; c.font = '800 26px "M PLUS Rounded 1c", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('祭', 32, 34);
});
export function makeLantern() {
  const o = new THREE.Group();
  mesh(thread(.1), vtoon(), 0, 0, 0, o, false);
  const body = mesh(new THREE.SphereGeometry(.09, 16, 10), toon(0xffffff, { map: lanternTex, emissive: 0xff7040, emissiveIntensity: 0 }), 0, -.21, 0, o, false);
  body.scale.set(1, 1.3, 1);
  mesh(cyl(.05, .05, .035, 12), toon(0x2a2420), 0, -.095, 0, o, false);
  mesh(cyl(.05, .05, .035, 12), toon(0x2a2420), 0, -.325, 0, o, false);
  const tassel = new THREE.CylinderGeometry(.008, .02, .12, 6); tassel.translate(0, -.4, 0);
  mesh(tassel, toon(0xe8b730), 0, 0, 0, o, false);
  o.userData = { kind: 'lantern', len: .46, glow: body.material };
  return o;
}

// cut-paper net (網飾り): a cone of paper with a diamond lattice cut into it
const netAlpha = canvasTex(128, 256, c => {
  c.fillStyle = '#000'; c.fillRect(0, 0, 128, 256);
  c.strokeStyle = '#fff'; c.lineWidth = 6;
  for (let i = -8; i < 16; i++) { c.beginPath(); c.moveTo(i * 16, 0); c.lineTo(i * 16 + 256 * .5, 256); c.stroke(); c.beginPath(); c.moveTo(i * 16, 0); c.lineTo(i * 16 - 256 * .5, 256); c.stroke(); }
  c.fillRect(0, 0, 128, 10);
});
netAlpha.colorSpace = THREE.NoColorSpace;
export function makeNet() {
  const o = new THREE.Group(), color = pick(['#7b4fa0', '#3d7fd6', '#3a9a6e', '#d8343c']);
  mesh(thread(.08), vtoon(), 0, 0, 0, o, false);
  const g = new THREE.CylinderGeometry(.025, .17, .62, 14, 1, true); g.translate(0, -.08 - .31, 0);
  mesh(g, toon(color, { alphaMap: netAlpha, alphaTest: .5, side: THREE.DoubleSide }), 0, 0, 0, o, false);
  mesh(cyl(.03, .03, .03, 10), toon(color), 0, -.085, 0, o, false);
  o.userData = { kind: 'net', len: .72 };
  return o;
}

export function makeChain() {
  // 輪つなぎ: paper rings, each through the last
  const geos = [], cols = PAPER.slice(0, 7);
  for (let i = 0; i < 9; i++) {
    const g = new THREE.TorusGeometry(.05, .011, 4, 14);
    if (i % 2) g.rotateY(Math.PI / 2);
    g.translate(0, -.05 - i * .072, 0);
    geos.push(paint(g, cols[i % cols.length]));
  }
  const o = new THREE.Group();
  mesh(mergeFlat(geos), vtoon(), 0, 0, 0, o, false);
  o.userData = { kind: 'chain', len: .7 };
  return o;
}

const ballTex = canvasTex(128, 64, c => {
  c.fillStyle = '#f08aa8'; c.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 40; i++) {
    const x = rand(0, 128), y = rand(0, 64), r = rand(4, 7);
    c.fillStyle = pick(['#fff3f6', '#e8b730', '#d8343c', '#f4f1ec']);
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; c.beginPath(); c.arc(x + Math.cos(a) * r * .6, y + Math.sin(a) * r * .6, r * .45, 0, 7); c.fill(); }
  }
});
// 吹き流し: a paper ball with long strips; strips flutter (see flutterStreamer)
export function makeStreamer() {
  const o = new THREE.Group(), N = 12, L = .95, segs = 10;
  mesh(thread(.06), vtoon(), 0, 0, 0, o, false);
  mesh(sph(.085, 16, 10), toon(0xffffff, { map: ballTex }), 0, -.13, 0, o, false);
  const geos = [], cols = ['#d8343c', '#f4f1ec', '#3a9a6e', '#e8b730', '#7b4fa0', '#3d7fd6'];
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2;
    const g = new THREE.PlaneGeometry(.034, L, 1, segs); g.translate(0, -L / 2, 0); g.rotateY(-a + Math.PI / 2); g.translate(Math.cos(a) * .065, -.17, Math.sin(a) * .065);
    geos.push(paint(g, cols[i % cols.length]));
  }
  const geo = mergeFlat(geos);
  const strips = mesh(geo, vtoon({ side: THREE.DoubleSide }), 0, 0, 0, o, false);
  o.userData = { kind: 'streamer', len: 1.15, strips, base: geo.attributes.position.array.slice(), ph: rand(0, 6) };
  return o;
}
export function flutterStreamer(o, t, wind) {
  const u = o.userData, p = u.strips.geometry.attributes.position.array, b = u.base;
  for (let i = 0; i < p.length; i += 3) {
    const depth = Math.max(0, -.17 - b[i + 1]);              // 0 at the ball, ~1 at the tips
    const w = Math.sin(t * 3.2 + depth * 6 + b[i] * 20 + u.ph) * .07 * wind * depth;
    p[i] = b[i] + w; p[i + 2] = b[i + 2] + Math.cos(t * 2.3 + depth * 5 + b[i + 2] * 20) * .05 * wind * depth;
  }
  u.strips.geometry.attributes.position.needsUpdate = true;
}

// ───────── tanzaku: vertical text drawn onto a strip ─────────
const CJK = /[　-ヿ㐀-鿿＀-￯]/;
function tokens(text) {
  const out = []; let buf = '';
  for (const ch of text) {
    if (CJK.test(ch)) { if (buf) { out.push({ t: buf, up: false }); buf = ''; } out.push({ t: ch, up: true }); }
    else if (ch === ' ') { buf += ' '; out.push({ t: buf, up: false }); buf = ''; }
    else buf += ch;
  }
  if (buf) out.push({ t: buf, up: false });
  return out;
}
// lay out tokens top-to-bottom in columns (right to left); Latin runs are set sideways
function layout(x, toks, size, h) {
  const cols = [[]]; let y = 0;
  for (const tk of toks) {
    const len = tk.up ? size * 1.08 : x.measureText(tk.t).width;
    if (y + len > h && cols[cols.length - 1].length) { cols.push([]); y = 0; }
    cols[cols.length - 1].push({ ...tk, y, len }); y += len;
  }
  return cols;
}
export function drawTanzaku(x, text, w, h, { bg = '#f4f1ec', ink = '#1d1b22', hole = true } = {}) {
  x.fillStyle = bg; x.fillRect(0, 0, w, h);
  // paper fibres
  x.globalAlpha = .08; for (let i = 0; i < 140; i++) { x.fillStyle = Math.random() < .5 ? '#fff' : '#000'; x.fillRect(rand(0, w), rand(0, h), rand(1, 3), rand(4, 14)); } x.globalAlpha = 1;
  if (hole) { x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(w / 2, w * .22, w * .07, 0, 7); x.fill(); }
  const top = w * .42, avail = h - top - w * .25, toks = tokens(text.trim());
  let size = Math.round(w * .5), cols;
  for (; size > 12; size -= 2) {
    x.font = `600 ${size}px "Klee One", "M PLUS Rounded 1c", sans-serif`;
    cols = layout(x, toks, size, avail);
    if (cols.length * size * 1.18 <= w * .86) break;
  }
  x.fillStyle = ink; x.textBaseline = 'middle'; x.textAlign = 'center';
  const colW = size * 1.18, x0 = w / 2 + (cols.length - 1) * colW / 2;
  cols.forEach((cl, ci) => {
    const used = cl.reduce((a, t) => Math.max(a, t.y + t.len), 0), cx = x0 - ci * colW, y0 = top + (cols.length === 1 ? (avail - used) * .15 : 0);
    for (const tk of cl) {
      if (tk.up) x.fillText(tk.t, cx, y0 + tk.y + tk.len / 2);
      else { x.save(); x.translate(cx, y0 + tk.y); x.rotate(Math.PI / 2); x.textAlign = 'left'; x.fillText(tk.t, 0, 0); x.restore(); }
    }
  });
}

export function makeTanzaku(text, color = GOSHIKI[3]) {
  const tex = canvasTex(128, 480, x => drawTanzaku(x, text, 128, 480, { bg: color.css, ink: color.ink }));
  const o = new THREE.Group();
  mesh(thread(.09), vtoon(), 0, 0, 0, o, false);
  const W = .11, H = .41;
  const front = new THREE.PlaneGeometry(W, H); front.translate(0, -.09 - H / 2, .002);
  mesh(front, toon(0xffffff, { map: tex }), 0, 0, 0, o, false);
  const back = new THREE.PlaneGeometry(W, H); back.rotateY(Math.PI); back.translate(0, -.09 - H / 2, -.002);
  mesh(back, toon(color.css), 0, 0, 0, o, false);
  o.userData = { kind: 'tanzaku', len: .5, tex };
  return o;
}

export const MAKERS = { crane: makeCrane, lantern: makeLantern, net: makeNet, chain: makeChain, streamer: makeStreamer };

// ───────── the craft table, streamer stand, basket, wish desk ─────────
export const TABLE_Y = .32;
export function buildCraft(parent) {
  const C = {}, T = TABLE_Y;
  // a low craft table with the folding mat on the left and the cutting area on the right
  mesh(rbox(3.75, .06, .9, .02), toon(0xd9b483), -3.35, T - .03, -.45, parent);
  for (const [a, b] of [[-5.1, -.82], [-1.6, -.82], [-5.1, -.08], [-1.6, -.08]]) mesh(box(.07, T - .06, .07), toon(0xa97b4c), a, (T - .06) / 2, b, parent);
  const grid = canvasTex(128, 96, c => { c.fillStyle = '#2f7d5b'; c.fillRect(0, 0, 128, 96); c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1; for (let i = 0; i < 128; i += 8) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 96); c.stroke(); } for (let j = 0; j < 96; j += 8) { c.beginPath(); c.moveTo(0, j); c.lineTo(128, j); c.stroke(); } });
  mesh(rbox(1.05, .014, .72, .005), toon(0xffffff, { map: grid }), -4.4, T + .007, -.45, parent, false);
  [['#d8343c', -4.82, -.7, .2], ['#e8b730', -4.55, -.74, -.15], ['#3d7fd6', -4.0, -.72, .35], ['#f08aa8', -3.9, -.5, -.1]].forEach(([c, x, z, r]) => {
    const m = mesh(box(.22, .08, .22), toon(c), x, T + .055, z, parent, false); m.rotation.y = r;
    const top = mesh(box(.22, .008, .22), toon(c), x, T + .099, z, parent, false); top.rotation.y = r + .12;
  });
  // a finished crane, sitting on the mat as a model
  const sample = new THREE.Group(); sample.position.set(-4.75, T + .1, -.32); sample.rotation.y = .8; sample.scale.setScalar(1.6); parent.add(sample);
  mesh(craneGeo('#d8343c'), vtoon({ side: THREE.DoubleSide }), 0, 0, 0, sample, false);
  // WIP paper square: two triangles that flap as it's folded
  C.paper = group(parent, -4.3, T + .03, -.36);
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-.14, 0, -.14, .14, 0, .14, .14, 0, -.14], 3)); tri.computeVertexNormals();
  C.paperMat = toon(0xd8343c, { side: THREE.DoubleSide });
  C.paperA = mesh(tri, C.paperMat, 0, 0, 0, C.paper, false);
  // the flap hinges on the square's diagonal (its local x axis); fold with rotation.x → -π
  C.paperFlap = group(C.paper); C.paperFlap.rotation.order = 'YXZ'; C.paperFlap.rotation.y = -Math.PI / 4;
  const triB = new THREE.BufferGeometry(); triB.setAttribute('position', new THREE.Float32BufferAttribute([-.198, 0, 0, .198, 0, 0, 0, 0, .198], 3)); triB.computeVertexNormals();
  C.paperB = mesh(triB, C.paperMat, 0, .002, 0, C.paperFlap, false);
  C.paper.visible = false;

  // cutting area: a paper roll, a cup of strips, scissors
  const roll = mesh(cyl(.07, .07, .62, 16), toon(0xf4f1ec), -2.95, T + .07, -.74, parent); roll.rotation.z = Math.PI / 2; roll.rotation.y = .15;
  mesh(cyl(.075, .075, .02, 16), toon(0xd8343c), -3.26, T + .07, -.69, parent, false).rotation.z = Math.PI / 2;
  mesh(cyl(.09, .08, .2, 14), toon(0x3a6bb0), -1.95, T + .1, -.72, parent);
  ['#d8343c', '#e8b730', '#3a9a6e', '#f08aa8', '#7b4fa0', '#ef8a3c'].forEach((c, i) => {
    const m = mesh(box(.035, .42, .006), toon(c), -1.95 + Math.cos(i) * .03, T + .3, -.72 + Math.sin(i) * .03, parent, false);
    m.rotation.set(rand(-.2, .2), i * .5, rand(-.25, .25));
  });
  ['#d8343c', '#e8b730', '#3a9a6e', '#3d7fd6', '#7b4fa0'].forEach((c, i) => { const m = mesh(box(.5, .006, .045), toon(c), -2.55, T + .01 + i * .006, -.6 + i * .012, parent, false); m.rotation.y = .1 - i * .05; });
  C.scissors = group(parent, -2.15, T + .03, -.4); C.scissors.rotation.y = .6;
  C.blades = [-1, 1].map(s => {
    const b = group(C.scissors); b.rotation.y = s * .12;
    mesh(box(.32, .012, .03), MAT.metal, .16, s * .002, 0, b, false);
    mesh(new THREE.TorusGeometry(.04, .012, 5, 12), MAT.red, -.05, s * .002, s * .03, b, false).rotation.x = Math.PI / 2;
    return b;
  });
  C.cutPaper = mesh(box(.34, .006, .24), toon(0x7b4fa0), -2.6, T + .012, -.32, parent, false); C.cutPaper.visible = false;
  C.rings = [];
  for (let i = 0; i < 9; i++) { const r = mesh(new THREE.TorusGeometry(.042, .009, 4, 12), toon(new THREE.Color(PAPER[i % 7]).getHex()), -2.85 + i * .072, T + .045, -.3, parent, false); r.rotation.x = i % 2 ? 0 : Math.PI / 2; r.visible = false; C.rings.push(r); }

  // streamer stand: a frame with a hoop and a paper ball; strips lengthen as one is made
  const sx = STREAM_X;
  mesh(box(.06, 1.3, .06), MAT.woodDark, sx - .34, .65, -.62, parent); mesh(box(.06, 1.3, .06), MAT.woodDark, sx + .34, .65, -.62, parent);
  mesh(box(.78, .06, .06), MAT.woodDark, sx, 1.3, -.62, parent);
  mesh(box(.82, .04, .34), MAT.woodDark, sx, .02, -.62, parent);
  C.hoop = group(parent, sx, 1.17, -.62);
  mesh(cyl(.004, .004, .12, 4), MAT.dark, 0, .06, 0, C.hoop, false);
  mesh(new THREE.TorusGeometry(.13, .013, 5, 22), toon(0xe8b730), 0, -.02, 0, C.hoop).rotation.x = Math.PI / 2;
  C.wipStrips = [];
  const scols = ['#d8343c', '#f4f1ec', '#3a9a6e', '#e8b730', '#7b4fa0', '#3d7fd6'];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2, g = new THREE.PlaneGeometry(.032, 1, 1, 1); g.translate(0, -.5, 0);
    const st = mesh(g, toon(scols[i % 6], { side: THREE.DoubleSide }), Math.cos(a) * .13, -.03, Math.sin(a) * .13, C.hoop, false);
    st.rotation.y = -a + Math.PI / 2; st.scale.y = .12; C.wipStrips.push(st);
  }
  return C;
}
export const STREAM_X = -.65;

export function buildBasket(parent, x, z) {
  const weave = canvasTex(128, 32, c => { c.fillStyle = '#c99a5b'; c.fillRect(0, 0, 128, 32); c.fillStyle = '#a77a40'; for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) c.fillRect(i * 8, j * 8, 8, 8); });
  const g = group(parent, x, 0, z);
  mesh(new THREE.CylinderGeometry(.24, .2, .2, 20, 1, true), toon(0xffffff, { map: weave, side: THREE.DoubleSide }), 0, .1, 0, g);
  mesh(cyl(.2, .2, .015, 20), toon(0xa77a40), 0, .008, 0, g);
  mesh(new THREE.TorusGeometry(.24, .012, 5, 24), toon(0x8a5a36), 0, .2, 0, g).rotation.x = Math.PI / 2;
  return g;
}

export function buildDesk(parent, x, z) {
  const D = {};
  const g = group(parent, x, 0, z);
  mesh(rbox(1.25, .045, .62, .015), toon(0x5a3826), 0, .21, 0, g);
  for (const [a, b] of [[-.55, -.24], [.55, -.24], [-.55, .24], [.55, .24]]) mesh(box(.05, .19, .05), toon(0x4a2c1e), a, .095, b, g);
  mesh(rbox(.2, .035, .3, .01), toon(0x26242a), -.38, .25, -.05, g);          // 硯 ink stone
  mesh(box(.12, .005, .09), toon(0x0c0b10), -.38, .27, -.11, g, false);
  const brush = group(g, -.12, .245, .12); brush.rotation.y = .5;
  mesh(new THREE.CylinderGeometry(.012, .012, .34, 6).rotateZ(Math.PI / 2), toon(0x9a6a3c), 0, 0, 0, brush, false);
  mesh(new THREE.ConeGeometry(.018, .07, 6).rotateZ(Math.PI / 2), toon(0x1a1716), -.2, 0, 0, brush, false);
  D.strips = GOSHIKI.map((c, i) => { const m = mesh(box(.085, .004, .32), toon(c.css), .2 + i * .05, .236 + i * .004, .02, g, false); m.rotation.y = -.5 + i * .25; return m; });
  mesh(box(.3, .028, .05), toon(0x1d1b22), .3, .27, .1, g, false);    // 文鎮 paperweight, holding the strips down
  D.group = g;
  return D;
}

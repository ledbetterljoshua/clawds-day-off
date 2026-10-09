// Townsfolk in yukata: round heads, ears that say who they are (cat, tanuki, rabbit, dog, a kid
// with a fox mask pushed to the side, an old man with an uchiwa fan). Each is one merged mesh
// plus a face card, so a crowd stays cheap.
import { THREE, V3, toon, box, cyl, sph, canvasTex } from '../../../core/gfx.js';
import { G } from '../../../core/state.js';
import { rand, pick, lerp, clamp, damp, wrapAngle } from '../../../core/util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeAtlas, prep } from './kit.js';

const YUKATA = [
  ['#2c3f7a', '#f4efe2', 'asagao'], ['#f2a7b5', '#ffffff', 'kingyo'], ['#3f8a6a', '#e8f2dc', 'stripe'], ['#efe8d8', '#2c3f7a', 'kasuri'],
  ['#7a4ca0', '#f0e2ff', 'asagao'], ['#e8843a', '#fff0d0', 'stripe'], ['#25303c', '#c8d8f0', 'kasuri'], ['#c8303a', '#fff2e8', 'kingyo'],
];
const SPECIES = [
  { id: 'cat', fur: [0xf2efe8, 0xe8a858, 0x3a3436, 0xc8c2b8], ears: 'tri' },
  { id: 'tanuki', fur: [0x9a7656, 0x8a6a4a], ears: 'round', mask: true },
  { id: 'rabbit', fur: [0xf4f1ec, 0xe2d4c4], ears: 'long' },
  { id: 'dog', fur: [0xd8b088, 0xf0e6d8, 0x8a6040], ears: 'flop' },
  { id: 'kid', fur: [0xf6d8c0], ears: 'none', kid: true, foxMask: true },
  { id: 'gramps', fur: [0xf0d0b0], ears: 'none', old: true },
];

let FA = null, YT = null, FACES = null;
function atlas() {
  if (FA) return FA;
  FA = makeAtlas(1024);
  YT = YUKATA.map(([bg, fg, pat]) => FA.tile(128, 128, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.fillStyle = fg; x.strokeStyle = fg;
    if (pat === 'stripe') for (let i = 0; i < 8; i++) x.fillRect(i * 16, 0, 5, h);
    if (pat === 'kasuri') for (let j = 0; j < 6; j++) for (let i = 0; i < 6; i++) { x.save(); x.translate(i * 22 + (j % 2) * 11 + 6, j * 22 + 8); x.fillRect(-5, -1.5, 10, 3); x.fillRect(-1.5, -5, 3, 10); x.restore(); }
    if (pat === 'asagao') for (let k = 0; k < 7; k++) { const cx = rand(10, w - 10), cy = rand(10, h - 10); for (let p = 0; p < 5; p++) { x.beginPath(); x.ellipse(cx + Math.cos(p * 1.256) * 7, cy + Math.sin(p * 1.256) * 7, 6, 4, p * 1.256, 0, 7); x.fill(); } x.fillStyle = '#f7e27a'; x.beginPath(); x.arc(cx, cy, 3, 0, 7); x.fill(); x.fillStyle = fg; }
    if (pat === 'kingyo') for (let k = 0; k < 6; k++) { const cx = rand(12, w - 12), cy = rand(10, h - 10); x.fillStyle = '#e8384c'; x.beginPath(); x.ellipse(cx, cy, 8, 5, .3, 0, 7); x.fill(); x.beginPath(); x.moveTo(cx - 6, cy - 2); x.lineTo(cx - 15, cy - 8); x.lineTo(cx - 13, cy + 5); x.fill(); }
  }));
  // face cards: eyes, mouths, whiskers, the tanuki's mask, gramps' happy squint
  FACES = {};
  for (const sp of SPECIES) FACES[sp.id] = FA.tile(128, 96, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    x.fillStyle = '#1e1a1c'; x.strokeStyle = '#1e1a1c'; x.lineWidth = 5; x.lineCap = 'round';
    if (sp.mask) { x.fillStyle = 'rgba(60,40,30,.75)'; x.beginPath(); x.ellipse(40, 44, 24, 16, -.2, 0, 7); x.ellipse(88, 44, 24, 16, .2, 0, 7); x.fill(); x.fillStyle = '#1e1a1c'; }
    if (sp.old) { for (const cx of [40, 88]) { x.beginPath(); x.arc(cx, 46, 9, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); } x.fillStyle = '#f4f1ec'; x.beginPath(); x.ellipse(64, 64, 22, 8, 0, 0, 7); x.fill(); }
    else for (const cx of [40, 88]) { x.beginPath(); x.ellipse(cx, 44, 6.5, 9, 0, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + 2, 40, 2.2, 0, 7); x.fill(); x.fillStyle = '#1e1a1c'; }
    if (sp.id === 'cat') { x.lineWidth = 3; x.beginPath(); x.moveTo(56, 62); x.quadraticCurveTo(60, 68, 64, 62); x.quadraticCurveTo(68, 68, 72, 62); x.stroke(); for (const s of [-1, 1]) for (const dy of [-4, 4]) { x.beginPath(); x.moveTo(64 + s * 22, 60 + dy); x.lineTo(64 + s * 44, 58 + dy * 2); x.stroke(); } }
    else if (sp.id === 'dog' || sp.id === 'tanuki') { x.beginPath(); x.ellipse(64, 58, 7, 5, 0, 0, 7); x.fill(); x.lineWidth = 3; x.beginPath(); x.moveTo(58, 68); x.quadraticCurveTo(64, 72, 70, 68); x.stroke(); }
    else if (!sp.old) { x.lineWidth = 3; x.beginPath(); x.arc(64, 60, 6, .2, Math.PI - .2); x.stroke(); }
    x.fillStyle = 'rgba(255,120,130,.45)'; x.beginPath(); x.ellipse(24, 62, 10, 6, 0, 0, 7); x.ellipse(104, 62, 10, 6, 0, 0, 7); x.fill();
  });
  return FA;
}

let MAT = null;
function mats() {
  if (MAT) return MAT;
  const a = atlas();
  MAT = { body: toon(0xffffff, { vertexColors: true, map: a.tex }), face: new THREE.MeshBasicMaterial({ map: a.tex, transparent: true, depthWrite: false, toneMapped: false }) };
  return MAT;
}

// the merged body of one townsperson, feet at y = 0, facing +z
function bodyGeo(sp, yk, fur, scale) {
  const a = atlas(), W = a.white, parts = [];
  const P = (geo, o) => parts.push(prep(geo, o));
  const pat = YT[yk], obi = pick([0xf2c14e, 0xd8343c, 0xf4f1ec, 0x2a2426, 0x7fc8a9]);
  P(new THREE.CylinderGeometry(.21, .3, .56, 14), { y: .34, tile: pat });
  for (const s of [-1, 1]) P(box(.15, .26, .22), { x: s * .28, y: .5, rz: s * .25, tile: pat });
  P(new THREE.CylinderGeometry(.225, .245, .11, 14), { y: .46, tile: W, color: obi });
  P(sph(.25, 16, 12), { y: .86, tile: W, color: fur });
  for (const s of [-1, 1]) P(box(.1, .06, .17), { x: s * .1, y: .03, tile: W, color: 0x6a4a32 });
  if (sp.ears === 'tri') for (const s of [-1, 1]) P(new THREE.ConeGeometry(.08, .16, 4), { x: s * .15, y: 1.08, z: -.02, rz: -s * .3, tile: W, color: fur });
  if (sp.ears === 'round') for (const s of [-1, 1]) P(sph(.075, 8, 6), { x: s * .17, y: 1.06, sz: .5, tile: W, color: 0x5a4636 });
  if (sp.ears === 'long') for (const s of [-1, 1]) P(sph(.06, 8, 6), { x: s * .09, y: 1.2, sy: 3, sz: .6, rz: -s * .15, tile: W, color: fur });
  if (sp.ears === 'flop') for (const s of [-1, 1]) P(sph(.08, 8, 6), { x: s * .22, y: .9, sy: 1.8, sz: .5, rz: s * .25, tile: W, color: 0x8a6040 });
  if (sp.mask) P(sph(.09, 8, 6), { y: .17, z: -.3, sx: .6, sz: 1.4, tile: W, color: 0x5a4636 });   // the tanuki's tail
  if (sp.foxMask) { P(sph(.13, 12, 8), { x: .2, y: .94, z: .06, sz: .45, ry: 1.0, tile: W, color: 0xf8f6f0 }); for (const s of [-1, 1]) P(new THREE.ConeGeometry(.045, .1, 4), { x: .2 + s * .05, y: 1.06, z: .05, ry: 1, tile: W, color: 0xf8f6f0 }); P(sph(.02, 6, 4), { x: .3, y: .95, z: .11, tile: W, color: 0xd8343c }); }
  if (sp.old) { P(sph(.12, 10, 8), { y: 1.07, sy: .5, tile: W, color: 0xf4f1ec }); P(box(.02, .22, .02), { x: .36, y: .62, z: .12, tile: W, color: 0xc8a060 }); P(new THREE.CircleGeometry(.14, 12), { x: .36, y: .82, z: .12, tile: W, color: 0xe8e0f0 }); }
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose());
  g.scale(scale, scale, scale);
  return g;
}

export class Folk {
  constructor(root) {
    this.g = new THREE.Group(); root.add(this.g);
    this.inner = new THREE.Group(); this.g.add(this.inner);
    // the face is a shell just outside the front of the head, so it curves with it
    this.face = new THREE.Mesh(new THREE.SphereGeometry(.257, 12, 8, Math.PI / 2 - .95, 1.9, Math.PI / 2 - .72, 1.44), mats().face); this.face.renderOrder = 3; this.face.userData.noInk = true;
    this.faceUV = this.face.geometry.attributes.uv.array.slice();
    this.inner.add(this.face);
    this.hand = new THREE.Group(); this.inner.add(this.hand);
    this.body = null; this.reset();
    this.bub = document.createElement('div'); this.bub.className = 'bub mt-bub'; this.bub.style.opacity = 0;
    document.getElementById('bubbles').appendChild(this.bub);
    this.bubT = 0;
  }
  // a new person: species, yukata, fur and size
  reset({ species = null } = {}) {
    const sp = species ? SPECIES.find(s => s.id === species) : pick(SPECIES);
    this.sp = sp; this.kid = !!sp.kid;
    this.scale = (sp.kid ? .78 : rand(.92, 1.06)) * 1.0;
    if (this.body) { this.inner.remove(this.body); this.body.geometry.dispose(); }
    this.body = new THREE.Mesh(bodyGeo(sp, Math.floor(Math.random() * YUKATA.length), pick(sp.fur), this.scale), mats().body);
    this.body.castShadow = true; this.inner.add(this.body);
    const t = FACES[sp.id], uv = this.face.geometry.attributes.uv, u0 = this.faceUV;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, t.u0 + u0[i * 2] * (t.u1 - t.u0), t.v0 + u0[i * 2 + 1] * (t.v1 - t.v0));
    uv.needsUpdate = true;
    this.face.position.set(0, .86 * this.scale, 0); this.face.scale.setScalar(this.scale);
    this.hand.position.set(.3 * this.scale, .5 * this.scale, .18 * this.scale);
    this.hand.clear();
    this.x = this.tx = 0; this.z = this.tz = 1; this.speed = rand(.9, 1.35); this.face0 = 0; this.walkT = rand(0, 6); this.t = rand(0, 9);
    this.role = 'idle'; this.wait = 0; this.happy = 0; this.sad = 0; this.eat = 0; this.g.visible = false; this.hop = 0;
    return this;
  }
  say(text, dur = 2.2) { this.bub.textContent = text; this.bub.dataset.chip = ''; this.bubT = dur; }
  arrived() { return Math.abs(this.tx - this.x) < .05 && Math.abs(this.tz - this.z) < .05; }
  update(dt, toScreen) {
    this.t += dt;
    const dx = this.tx - this.x, dz = this.tz - this.z, d = Math.hypot(dx, dz), moving = d > .05;
    let yaw = this.face0;
    if (moving) {
      const s = Math.min(d, this.speed * dt);
      this.x += dx / d * s; this.z += dz / d * s; this.walkT += dt * 11;
      yaw = Math.atan2(dx, dz);
    }
    this.g.rotation.y += wrapAngle(yaw - this.g.rotation.y) * damp(9, dt);
    const bob = moving ? Math.abs(Math.sin(this.walkT)) * .05 : Math.sin(this.t * 2) * .01;
    if (this.hop > 0) this.hop = Math.max(0, this.hop - dt);
    this.inner.position.y = bob + Math.abs(Math.sin(this.hop * 14)) * this.hop * .4;
    this.inner.rotation.z = moving ? Math.sin(this.walkT) * .05 : this.sad > 0 ? -.08 : 0;
    this.inner.rotation.x = this.sad > 0 ? .12 : 0;
    this.hand.rotation.x = this.eat > 0 ? -1 + Math.max(0, Math.sin(this.t * 3.4)) * -.6 : 0;
    this.g.position.set(this.x, 0, this.z);
    if (this.sad > 0) this.sad -= dt;
    // speech bubble
    if (this.bubT > 0) this.bubT -= dt;
    let show = this.bubT > 0 && this.g.visible && G.mode === 'play';
    const p = show ? toScreen(this.x, (1.32 + bob) * this.scale + .1, this.z) : null;
    if (p && (p.behind || p.x < -40 || p.x > innerWidth + 40)) show = false;
    this.bub.style.opacity = show ? Math.min(1, this.bubT * 3) : 0;
    if (show) { const hw = this.bub.offsetWidth / 2 + 8; this.bub.style.left = clamp(p.x, hw, innerWidth - hw) + 'px'; this.bub.style.top = Math.max(30, p.y) + 'px'; }
  }
  dispose() { this.bub.remove(); this.body?.geometry.dispose(); this.g.parent?.remove(this.g); }
}
export const FOLK_SPECIES = SPECIES.map(s => s.id);

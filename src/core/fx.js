// Particles and fireworks.
import { THREE, V3, scene, dotTex } from './gfx.js';
import { rand, pick } from './util.js';
import { audio } from './audio.js';
import { tween } from './tween.js';
import { sky } from './sky.js';
import { CLAWD_PIXELS } from './world.js';

const systems = new Set();

// A pooled point cloud. emit() particles, update() advances them (called automatically).
export class Particles {
  constructor({ max = 300, size = .07, color = 0xffffff, additive = false, map = dotTex, vertexColors = true, fog = true, opacity = 1, parent = scene, gravity = -3, drag = 0, floor = null, sizeAttenuation = true } = {}) {
    this.max = max; this.gravity = gravity; this.drag = drag; this.floor = floor;
    this.pos = new Float32Array(max * 3).fill(-999); this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3).fill(1); this.life = new Float32Array(max); this.life0 = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size, map, vertexColors, color, transparent: true, depthWrite: false, opacity, fog, sizeAttenuation, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: !additive });
    this.points = new THREE.Points(this.geo, this.mat); this.points.frustumCulled = false;
    parent.add(this.points);
    this.i = 0; this.fade = additive;
    systems.add(this);
  }
  emit(x, y, z, vx = 0, vy = 0, vz = 0, life = 1, r = 1, g = 1, b = 1) {
    const i = this.i++ % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.life[i] = this.life0[i] = life;
  }
  update(dt) {
    const { pos, vel, life, col } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      vel[i * 3 + 1] += this.gravity * dt;
      if (this.drag) { const k = 1 - this.drag * dt; vel[i * 3] *= k; vel[i * 3 + 1] *= k; vel[i * 3 + 2] *= k; }
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (life[i] <= 0 || (this.floor && pos[i * 3 + 1] < this.floor(pos[i * 3], pos[i * 3 + 2]))) { life[i] = 0; pos[i * 3 + 1] = -999; }
    }
    this.geo.attributes.position.needsUpdate = true;
    if (this.fade) {
      // additive systems fade by darkening their color with remaining life
      for (let i = 0; i < this.max; i++) if (life[i] > 0) { const k = Math.min(1, life[i] / (this.life0[i] * .5)); this.col[i * 3] *= .985 + .015 * k; this.col[i * 3 + 1] *= .985 + .015 * k; this.col[i * 3 + 2] *= .985 + .015 * k; }
      this.geo.attributes.color.needsUpdate = true;
    }
  }
  clear() { this.life.fill(0); this.pos.fill(-999); this.geo.attributes.position.needsUpdate = true; }
  dispose() { systems.delete(this); this.points.parent?.remove(this.points); this.geo.dispose(); this.mat.dispose(); }
}

// little sparkle burst for "done" moments
const sparkles = new Particles({ max: 400, size: .12, additive: true, gravity: -1.5, drag: 1.5 });
export function sparkle(x, y, z, n = 14, color = [1, .85, .5]) {
  for (let k = 0; k < n; k++) { const a = rand(0, Math.PI * 2), s = rand(.8, 2.2); sparkles.emit(x, y, z, Math.cos(a) * s, rand(.8, 2.5), Math.sin(a) * s * .5, rand(.5, 1), ...color); }
}
const puffs = new Particles({ max: 300, size: .25, gravity: .4, drag: 2, opacity: .55 });
export function puff(x, y, z, n = 8, color = [1, 1, 1]) {
  for (let k = 0; k < n; k++) puffs.emit(x + rand(-.15, .15), y, z + rand(-.15, .15), rand(-.4, .4), rand(.2, .8), rand(-.3, .3), rand(.6, 1.2), ...color);
}

// ── fireworks ──
const FW_COLORS = [[1, .45, .4], [1, .85, .45], [.5, .85, 1], [.6, 1, .6], [1, .6, .9], [1, 1, 1], [1, .62, .3]];
const bursts = [];
const shells = new Particles({ max: 60, size: .9, additive: true, gravity: -6, fog: false });
export function firework({ type = pick(['peony', 'peony', 'chrysanthemum', 'willow', 'ring']), x = rand(-40, 40), y = rand(15, 32), z = rand(-80, -95), color, delay = 0, size = 1 } = {}) {
  const c1 = color || pick(FW_COLORS), c2 = pick(FW_COLORS);
  const rise = 1.1;
  // the rising shell
  for (let i = 0; i < 6; i++) shells.emit(x, y - 22, z, rand(-.2, .2), 22 / rise + 3, 0, rise, 1, .8, .5);
  audio.sfx('launch');
  tween(rise + delay, () => {}, () => burst(type, new V3(x, y, z), c1, c2, size));
}
function burst(type, o, c1, c2, size) {
  const n = type === 'clawd' ? 0 : type === 'willow' ? 220 : 170;
  const dirs = [];
  if (type === 'clawd') {
    // a firework shaped like Clawd: the pixel grid, flat toward the camera
    CLAWD_PIXELS.forEach((row, r) => [...row].forEach((ch, c) => {
      if (ch === '.') return;
      if (ch === 'o') return; // eyes stay dark
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const w = rand(.85, 1.1);
        dirs.push({ v: new V3((c - 5) + a * .3 + rand(-.05, .05), (2.5 - r) + b * .3 + rand(-.05, .05), rand(-.15, .15)).multiplyScalar(1.6 * size), col: [1 * w, .5 * w, .32 * w] });
      }
    }));
  } else if (type === 'ring') {
    const ax = new V3(rand(-1, 1), rand(-1, 1), rand(-.3, .3)).normalize(), b1 = new V3().crossVectors(ax, new V3(0, 0, 1)).normalize(), b2 = new V3().crossVectors(ax, b1);
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; dirs.push({ v: b1.clone().multiplyScalar(Math.cos(a)).add(b2.clone().multiplyScalar(Math.sin(a))).multiplyScalar(11 * size), col: i % 2 ? c1 : c2 }); }
  } else {
    const sp = (type === 'willow' ? 8 : rand(9, 13)) * size;
    for (let i = 0; i < n; i++) dirs.push({ v: new V3().randomDirection().multiplyScalar(sp * rand(.85, 1)), col: i % 3 ? c1 : c2 });
  }
  const N = dirs.length, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  dirs.forEach((d, i) => { pos.set([o.x, o.y, o.z], i * 3); col.set(d.col, i * 3); });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: type === 'clawd' ? 1.5 : 1.5, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
  const p = new THREE.Points(geo, mat); p.frustumCulled = false; scene.add(p);
  bursts.push({ p, vel: dirs.map(d => d.v), life: 0, type, hold: type === 'clawd' ? 1.2 : 0 });
  sky.flash(new THREE.Color(...c1), type === 'clawd' ? 1.2 : 1);
  audio.sfx('boom', { delay: .35, size: type === 'clawd' ? 1.3 : 1 });
}
function updateBursts(dt) {
  for (let b = bursts.length - 1; b >= 0; b--) {
    const B = bursts[b]; B.life += dt; const pos = B.p.geometry.attributes.position.array;
    const g = B.type === 'willow' ? 3 : 5, dr = B.type === 'clawd' ? (B.life < .5 ? 0 : 2.4) : B.type === 'willow' ? 1.1 : 1.4;
    B.vel.forEach((v, i) => {
      if (B.type === 'clawd' && B.life < .45) { pos[i * 3] += v.x * dt * 2.2; pos[i * 3 + 1] += v.y * dt * 2.2; pos[i * 3 + 2] += v.z * dt * 2.2; return; }
      v.y -= g * dt * (B.type === 'clawd' ? .25 : 1); v.multiplyScalar(1 - dr * dt);
      pos[i * 3] += v.x * dt; pos[i * 3 + 1] += v.y * dt; pos[i * 3 + 2] += v.z * dt;
    });
    B.p.geometry.attributes.position.needsUpdate = true;
    const life = B.type === 'willow' ? 3.4 : B.type === 'clawd' ? 3.6 : 2.4;
    B.p.material.opacity = Math.max(0, Math.min(1, (life - B.life) / (life * .55)));
    if (B.type === 'clawd') B.p.material.size = 1.5 * (B.life < .5 ? 1 : 1 - (B.life - .5) * .1);
    if (B.life > life) { scene.remove(B.p); B.p.geometry.dispose(); B.p.material.dispose(); bursts.splice(b, 1); }
  }
}

export function updateFx(dt) {
  systems.forEach(s => s.update(dt));
  updateBursts(dt);
}

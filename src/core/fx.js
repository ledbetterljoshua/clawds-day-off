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
// type 'stars' takes an explicit star list (see starBurst); 'pattern' takes rows of characters and
// a { char: [r,g,b] } map and bursts that picture flat toward the camera. rise is the seconds from
// launch to burst; onBurst(o) fires at the burst.
export function firework({ type = pick(['peony', 'peony', 'chrysanthemum', 'willow', 'ring']), x = rand(-40, 40), y = rand(15, 32), z = rand(-80, -95), color, delay = 0, size = 1, stars, pattern, colors, trails = 1, rise = 1.1, onBurst } = {}) {
  const c1 = color || pick(FW_COLORS), c2 = pick(FW_COLORS);
  // the rising shell
  for (let i = 0; i < 6; i++) shells.emit(x, y - 22, z, rand(-.2, .2), 22 / rise + 3, 0, rise, 1, .8, .5);
  audio.sfx('launch');
  tween(rise + delay, () => {}, () => {
    const o = new V3(x, y, z);
    if (type === 'stars' || type === 'pattern') starBurst(o, type === 'pattern' ? patternStars(pattern, colors) : stars || [], { size, trails, color });
    else burst(type, o, c1, c2, size);
    onBurst && onBurst(o);
  });
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
        dirs.push({ v: new V3((c - 5) + a * .3 + rand(-.05, .05), (2.5 - r) + b * .3 + rand(-.05, .05), rand(-.15, .15)).multiplyScalar(1.6 * size), col: [.6 * w, .27 * w, .15 * w] });   // overlapping additive points saturate; keep it orange
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

// ── star-list fireworks ──
// A star is { v: [vx, vy, vz] (units/s), col: [r, g, b], fx, glitter }. fx is how it flies:
// peony (clean), tail (leaves a trail), willow (long, slow, drooping gold trails), flat (holds a
// drawn shape facing the camera, like the clawd firework). Glitter stars twinkle, then crackle.
const STAR_FX = {
  peony: { drag: 1.4, grav: 5, life: 2.4, trail: 0, tlife: 0 },
  tail: { drag: 1.3, grav: 4.5, life: 2.6, trail: 26, tlife: .5 },
  willow: { drag: 1.05, grav: 3, life: 3.9, trail: 34, tlife: 1.25, gold: true },
  flat: { drag: 2.4, grav: 1.25, life: 3.6, trail: 0, tlife: 0, hold: .45 },
};
const FX_KEYS = Object.keys(STAR_FX);
const GOLD = [1, .72, .32];
const starBursts = [];

// rows of characters → flat stars; '.' and unknown characters stay dark
export function patternStars(rows = [], colors = {}, { spread = 1.6, per = 2 } = {}) {
  const out = [], h = rows.length, w = Math.max(0, ...rows.map(r => r.length)), cx = (w - 1) / 2, cy = (h - 1) / 2;
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const col = colors[ch]; if (!col) return;
    for (let a = 0; a < per; a++) for (let b = 0; b < per; b++) {
      const ox = per > 1 ? (a / (per - 1) - .5) * .55 : 0, oy = per > 1 ? (b / (per - 1) - .5) * .55 : 0;
      out.push({ v: [(c - cx + ox + rand(-.05, .05)) * spread, (cy - r + oy + rand(-.05, .05)) * spread, rand(-.15, .15)], col, fx: 'flat', glitter: !!colors.glitter?.includes(ch) });
    }
  }));
  return out;
}

const starMat = size => new THREE.PointsMaterial({ size, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
function starBurst(o, stars, { size = 1, trails = 1, color } = {}) {
  const N = stars.length; if (!N) return;
  const low = sky.tier === 'low';
  const nTrailStars = stars.filter(s => STAR_FX[s.fx]?.trail || s.glitter).length;
  const T = nTrailStars ? Math.round(Math.min(nTrailStars * 9, low ? 700 : 1800) * trails) : 0;
  // trail points alive if every trail star emitted at full rate; scale emission to fit the pool
  const demand = stars.reduce((a, s) => { const F = STAR_FX[s.fx] || STAR_FX.peony; return a + (F.trail ? F.trail * F.tlife : s.glitter ? 8 * .35 : 0); }, 0);
  const mk = (n, sz) => {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(Math.max(n, 1) * 3).fill(-999);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Math.max(n, 1) * 3), 3));
    const p = new THREE.Points(geo, starMat(sz)); p.frustumCulled = false; scene.add(p); return p;
  };
  const B = {
    n: N, age: 0, o: o.clone(), stars: mk(N, 1.5 * Math.sqrt(size)), trail: T ? mk(T, .85) : null, T, ti: 0,
    vel: new Float32Array(N * 3), base: new Float32Array(N * 3), fx: new Uint8Array(N), glit: new Uint8Array(N), life: new Float32Array(N), acc: new Float32Array(N), cr: new Uint8Array(N),
    tvel: new Float32Array(Math.max(T, 1) * 3), tcol: new Float32Array(Math.max(T, 1) * 3), tlife: new Float32Array(Math.max(T, 1)), tlife0: new Float32Array(Math.max(T, 1)),
    rate: T ? Math.min(1, T / Math.max(1, demand)) : 0,
  };
  const pos = B.stars.geometry.attributes.position.array;
  let lum = [0, 0, 0];
  stars.forEach((s, i) => {
    pos.set([o.x, o.y, o.z], i * 3);
    B.vel.set([s.v[0] * size, s.v[1] * size, s.v[2] * size], i * 3);
    B.base.set(s.col, i * 3); lum = lum.map((v, k) => v + s.col[k]);
    const f = Math.max(0, FX_KEYS.indexOf(s.fx)); B.fx[i] = f; B.glit[i] = s.glitter ? 1 : 0;
    B.life[i] = STAR_FX[FX_KEYS[f]].life * rand(.9, 1.08);
  });
  starBursts.push(B);
  const fl = color || lum.map(v => v / N);
  sky.flash(new THREE.Color(...fl), Math.min(1.4, .7 + N / 500));
  audio.sfx('boom', { delay: .35, size: Math.min(1.5, .8 + N / 600) * Math.sqrt(size) });
  if (B.glit.some(Boolean)) for (let k = 0; k < 4; k++) audio.sfx('crackle', { delay: 1.5 + k * .18 + Math.random() * .1 });
}
function emitTrail(B, x, y, z, vx, vy, vz, r, g, b, life) {
  const i = B.ti++ % B.T, P = B.trail.geometry.attributes.position.array;
  P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
  B.tvel[i * 3] = vx; B.tvel[i * 3 + 1] = vy; B.tvel[i * 3 + 2] = vz;
  B.tcol[i * 3] = r; B.tcol[i * 3 + 1] = g; B.tcol[i * 3 + 2] = b;
  B.tlife[i] = B.tlife0[i] = life;
}
function updateStarBursts(dt) {
  for (let k = starBursts.length - 1; k >= 0; k--) {
    const B = starBursts[k]; B.age += dt;
    const pos = B.stars.geometry.attributes.position.array, col = B.stars.geometry.attributes.color.array, a = B.age;
    let alive = 0;
    for (let i = 0; i < B.n; i++) {
      const F = STAR_FX[FX_KEYS[B.fx[i]]], L = B.life[i], j = i * 3;
      if (a > L) { col[j] = col[j + 1] = col[j + 2] = 0; continue; }
      alive++;
      const v = B.vel;
      if (F.hold && a < F.hold) { pos[j] += v[j] * dt * 2.2; pos[j + 1] += v[j + 1] * dt * 2.2; pos[j + 2] += v[j + 2] * dt * 2.2; }
      else {
        v[j + 1] -= F.grav * dt; const d = 1 - F.drag * dt;
        v[j] *= d; v[j + 1] *= d; v[j + 2] *= d;
        pos[j] += v[j] * dt; pos[j + 1] += v[j + 1] * dt; pos[j + 2] += v[j + 2] * dt;
      }
      let br = Math.max(0, Math.min(1, (L - a) / (L * .55)));
      let r = B.base[j], g = B.base[j + 1], b = B.base[j + 2];
      if (F.gold) { const w = Math.min(1, a / L * 1.4); r += (GOLD[0] - r) * w; g += (GOLD[1] - g) * w; b += (GOLD[2] - b) * w; }
      if (B.glit[i]) br *= a > L * .62 ? (Math.random() < .35 ? 1.4 : .15) : .55 + Math.random() * .75;
      col[j] = r * br; col[j + 1] = g * br; col[j + 2] = b * br;
      if (B.trail && (F.trail || B.glit[i])) {
        B.acc[i] += dt * (F.trail || 8) * B.rate;
        while (B.acc[i] >= 1) {
          B.acc[i] -= 1;
          const tw = F.gold ? .7 : .45;
          emitTrail(B, pos[j], pos[j + 1], pos[j + 2], v[j] * .05, v[j + 1] * .05 - .4, v[j + 2] * .05,
            (r * (1 - tw) + GOLD[0] * tw) * br * .7, (g * (1 - tw) + GOLD[1] * tw) * br * .7, (b * (1 - tw) + GOLD[2] * tw) * br * .7, F.tlife || .35);
        }
      }
      // glitter stars crackle near the end: each pops into a few white sparks
      if (B.glit[i] && B.trail && !B.cr[i] && a > L * .62) { B.cr[i] = 1; for (let s = 0; s < 4; s++) emitTrail(B, pos[j], pos[j + 1], pos[j + 2], rand(-2.5, 2.5), rand(-2.5, 2.5), rand(-1, 1), 1.3, 1.25, 1.1, rand(.15, .3)); }
    }
    let tAlive = 0;
    if (B.trail) {
      const P = B.trail.geometry.attributes.position.array, C = B.trail.geometry.attributes.color.array;
      for (let i = 0; i < B.T; i++) {
        if (B.tlife[i] <= 0) continue;
        B.tlife[i] -= dt; const j = i * 3;
        if (B.tlife[i] <= 0) { P[j + 1] = -999; C[j] = C[j + 1] = C[j + 2] = 0; continue; }
        tAlive++;
        B.tvel[j + 1] -= 1.6 * dt;
        P[j] += B.tvel[j] * dt; P[j + 1] += B.tvel[j + 1] * dt; P[j + 2] += B.tvel[j + 2] * dt;
        const f = B.tlife[i] / B.tlife0[i], k = f * f;
        C[j] = B.tcol[j] * k; C[j + 1] = B.tcol[j + 1] * k; C[j + 2] = B.tcol[j + 2] * k;
      }
      B.trail.geometry.attributes.position.needsUpdate = true; B.trail.geometry.attributes.color.needsUpdate = true;
    }
    B.stars.geometry.attributes.position.needsUpdate = true; B.stars.geometry.attributes.color.needsUpdate = true;
    if (!alive && !tAlive) {
      for (const p of [B.stars, B.trail]) if (p) { scene.remove(p); p.geometry.dispose(); p.material.dispose(); }
      starBursts.splice(k, 1);
    }
  }
}
export const starBurstCount = () => starBursts.reduce((a, B) => a + B.n + B.T, 0);

// dispose every particle system that lives under `root` (the runner calls this on teardown)
export function disposeUnder(root) {
  for (const s of [...systems]) { let o = s.points; while (o && o !== root) o = o.parent; if (o === root) s.dispose(); }
}

export function updateFx(dt) {
  systems.forEach(s => s.update(dt));
  updateBursts(dt);
  updateStarBursts(dt);
}

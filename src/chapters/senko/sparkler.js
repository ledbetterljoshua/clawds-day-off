// The senkō hanabi: a twisted paper string, a molten bead (hinotama) that hangs from it and
// swings like a pendulum, and sparks that change character through the four stages.
import { THREE, V3, dotTex, canvasTex, camera } from '../../core/gfx.js';
import { rand, clamp, lerp, smooth } from '../../core/util.js';

export const STAGES = [
  { key: 'botan', jp: '牡丹', romaji: 'botan', en: 'peony', dur: 6.5 },
  { key: 'matsuba', jp: '松葉', romaji: 'matsuba', en: 'pine needles', dur: 9 },
  { key: 'yanagi', jp: '柳', romaji: 'yanagi', en: 'willow', dur: 8 },
  { key: 'chiri', jp: '散り菊', romaji: 'chiri-giku', en: 'scattering chrysanthemum', dur: 8.5 },
];

// ── sparks: short additive streaks that fork, the way matsuba sparks branch like pine needles ──
export class SparkPool {
  constructor(parent, max = 3200) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.age = new Float32Array(max); this.life = new Float32Array(max);
    this.gen = new Uint8Array(max); this.split = new Float32Array(max);
    this.trail = new Float32Array(max); this.grav = new Float32Array(max); this.heat = new Float32Array(max);
    this.pos = new Float32Array(max * 6); this.col = new Float32Array(max * 6);
    const geo = this.geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.lines = new THREE.LineSegments(geo, this.mat);
    this.lines.frustumCulled = false; this.lines.renderOrder = 3;
    parent.add(this.lines);
    // a bright point at each spark's head, so the burst reads as crackle and not just hairlines
    this.hpos = new Float32Array(max * 3); this.hcol = new Float32Array(max * 3);
    const hg = this.hgeo = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.BufferAttribute(this.hpos, 3).setUsage(THREE.DynamicDrawUsage));
    hg.setAttribute('color', new THREE.BufferAttribute(this.hcol, 3).setUsage(THREE.DynamicDrawUsage));
    hg.setDrawRange(0, 0);
    this.hmat = new THREE.PointsMaterial({ size: .022, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.heads = new THREE.Points(hg, this.hmat); this.heads.frustumCulled = false; this.heads.renderOrder = 3;
    parent.add(this.heads);
    this.onLand = null;   // (x, z) when a spark lands on the counter
  }
  spawn(x, y, z, vx, vy, vz, life, gen = 0, split = 0, trail = .03, grav = 2, heat = 1) {
    if (this.n >= this.max) return;
    const i = this.n++, i3 = i * 3;
    this.p[i3] = x; this.p[i3 + 1] = y; this.p[i3 + 2] = z;
    this.v[i3] = vx; this.v[i3 + 1] = vy; this.v[i3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.gen[i] = gen; this.split[i] = split;
    this.trail[i] = trail; this.grav[i] = grav; this.heat[i] = heat;
  }
  kill(i) {
    const j = --this.n; if (i === j) return;
    const i3 = i * 3, j3 = j * 3;
    for (let k = 0; k < 3; k++) { this.p[i3 + k] = this.p[j3 + k]; this.v[i3 + k] = this.v[j3 + k]; }
    this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.gen[i] = this.gen[j]; this.split[i] = this.split[j];
    this.trail[i] = this.trail[j]; this.grav[i] = this.grav[j]; this.heat[i] = this.heat[j];
  }
  update(dt) {
    const { p, v } = this;
    if (dt > 0) {
      const drag = 1 - 2.2 * dt;
      let i = 0;
      while (i < this.n) {
        const i3 = i * 3;
        this.age[i] += dt;
        if (this.age[i] >= this.life[i]) { this.kill(i); continue; }
        if (this.split[i] > 0 && this.age[i] >= this.split[i]) {
          this.split[i] = 0;
          const g = this.gen[i], kids = g === 0 ? 3 + (Math.random() * 3 | 0) : 2 + (Math.random() * 2 | 0);
          const sp = Math.hypot(v[i3], v[i3 + 1], v[i3 + 2]) || 1;
          for (let k = 0; k < kids; k++) {
            const dx = v[i3] / sp + rand(-.95, .95), dy = v[i3 + 1] / sp + rand(-.95, .95), dz = v[i3 + 2] / sp + rand(-.95, .95);
            const l = Math.hypot(dx, dy, dz) || 1, s = sp * rand(.45, .78);
            this.spawn(p[i3], p[i3 + 1], p[i3 + 2], dx / l * s, dy / l * s, dz / l * s,
              rand(.05, .12) * (g ? .75 : 1), g + 1, g === 0 && Math.random() < .7 ? rand(.025, .05) : 0,
              this.trail[i] * .8, this.grav[i], this.heat[i]);
          }
          this.life[i] = Math.min(this.life[i], this.age[i] + .015);   // a spark ends where it forks
        }
        v[i3] *= drag; v[i3 + 1] = v[i3 + 1] * drag - this.grav[i] * dt; v[i3 + 2] *= drag;
        p[i3] += v[i3] * dt; p[i3 + 1] += v[i3 + 1] * dt; p[i3 + 2] += v[i3 + 2] * dt;
        // the counter catches what lands on it; past the edge sparks fall into the dark
        if (p[i3 + 1] < 0 && p[i3 + 2] > -1.2 && p[i3 + 2] < 1.2 && Math.abs(p[i3]) < 11.5) {
          if (this.onLand && Math.random() < .2) this.onLand(p[i3], p[i3 + 2]);
          this.kill(i); continue;
        }
        if (p[i3 + 1] < -6) { this.kill(i); continue; }
        i++;
      }
    }
    const pos = this.pos, col = this.col;
    for (let i = 0; i < this.n; i++) {
      const i3 = i * 3, o = i * 6, t = this.age[i] / this.life[i], b = Math.pow(1 - t, 1.3), h = this.heat[i], tr = this.trail[i];
      pos[o] = p[i3]; pos[o + 1] = p[i3 + 1]; pos[o + 2] = p[i3 + 2];
      pos[o + 3] = p[i3] - v[i3] * tr; pos[o + 4] = p[i3 + 1] - v[i3 + 1] * tr; pos[o + 5] = p[i3 + 2] - v[i3 + 2] * tr;
      // white-gold heads, orange tails; values above 1 feed the bloom
      col[o] = 1.7 * b; col[o + 1] = (1.0 + .45 * h) * b; col[o + 2] = (.3 + .55 * h) * b;
      col[o + 3] = .6 * b; col[o + 4] = .22 * b; col[o + 5] = .04 * b;
      this.hpos[i3] = p[i3]; this.hpos[i3 + 1] = p[i3 + 1]; this.hpos[i3 + 2] = p[i3 + 2];
      this.hcol[i3] = 1.4 * b; this.hcol[i3 + 1] = (.85 + .4 * h) * b; this.hcol[i3 + 2] = (.25 + .45 * h) * b;
    }
    this.geo.setDrawRange(0, this.n * 2);
    this.hgeo.setDrawRange(0, this.n);
    this.hgeo.attributes.position.needsUpdate = true; this.hgeo.attributes.color.needsUpdate = true;
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
  clear() { this.n = 0; this.geo.setDrawRange(0, 0); this.hgeo.setDrawRange(0, 0); }
  dispose() { this.lines.parent?.remove(this.lines); this.heads.parent?.remove(this.heads); this.geo.dispose(); this.mat.dispose(); this.hgeo.dispose(); this.hmat.dispose(); }
}

// twisted washi paper: pink, violet, gold; the powder-filled tip at the bottom is dark
const stringTex = canvasTex(8, 128, x => {
  const cols = ['#f29ab8', '#b48be0', '#f2c14e', '#f6b3c8', '#9fd0ee'];
  for (let i = 0; i < 128; i += 5) { x.fillStyle = cols[(i / 5) % cols.length]; x.fillRect(0, i, 8, 5); }
  x.fillStyle = '#3d3434'; x.fillRect(0, 106, 8, 22);
});
stringTex.wrapS = stringTex.wrapT = THREE.RepeatWrapping;
// the paper string: a thin camera-facing ribbon along a curve from the claw to the bead
class Ribbon {
  constructor(parent, mat, n = 16) {
    this.n = n;
    this.pos = new Float32Array(n * 6);
    const uv = new Float32Array(n * 4), idx = [];
    for (let i = 0; i < n; i++) {
      const v = 1 - i / (n - 1);
      uv.set([0, v, 1, v], i * 4);
      if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = this.geo = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, mat); this.mesh.frustumCulled = false;
    parent.add(this.mesh);
  }
  // quadratic curve p0 → (control c) → p2
  set(p0, c, p2, width) {
    const cam = camera.position, n = this.n, pos = this.pos;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), u = 1 - t;
      _p.set(u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, u * u * p0.y + 2 * u * t * c.y + t * t * p2.y, u * u * p0.z + 2 * u * t * c.z + t * t * p2.z);
      _t.set(2 * u * (c.x - p0.x) + 2 * t * (p2.x - c.x), 2 * u * (c.y - p0.y) + 2 * t * (p2.y - c.y), 2 * u * (c.z - p0.z) + 2 * t * (p2.z - c.z));
      _s.subVectors(cam, _p).cross(_t).normalize().multiplyScalar(width / 2);
      pos[i * 6] = _p.x - _s.x; pos[i * 6 + 1] = _p.y - _s.y; pos[i * 6 + 2] = _p.z - _s.z;
      pos[i * 6 + 3] = _p.x + _s.x; pos[i * 6 + 4] = _p.y + _s.y; pos[i * 6 + 5] = _p.z + _s.z;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  dispose() { this.mesh.parent?.remove(this.mesh); this.geo.dispose(); }
}
const _p = new V3(), _t = new V3(), _s = new V3();
const BEAD_GEO = new THREE.SphereGeometry(1, 14, 10);
const SPENT_COL = new THREE.Color(.16, .13, .13), STRING_COL = new THREE.Color(.62, .58, .6);

const tmpA = new V3(), tmpB = new V3(), tmpC = new V3(), UP = new V3(0, 1, 0), _q = new THREE.Quaternion();

export class Sparkler {
  constructor(parent, pool, embers, smoke, { scale = 1, len = .42, fragile = false, spread = 1.4 } = {}) {
    this.pool = pool; this.embers = embers; this.smoke = smoke;
    this.scale = scale; this.len0 = len; this.fragile = fragile; this.spread = spread;
    this.g = new THREE.Group(); parent.add(this.g);
    this.stringMat = new THREE.MeshBasicMaterial({ map: stringTex, color: STRING_COL, side: THREE.DoubleSide });
    this.ribbon = new Ribbon(this.g, this.stringMat);
    this.beadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, .6, .25), toneMapped: false });
    this.bead = new THREE.Mesh(BEAD_GEO, this.beadMat);
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xffa24a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xff6a20, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    this.light = new THREE.PointLight(0xffa050, 0, 1.8 + 1.2 * scale, 1.5);
    this.g.add(this.bead, this.halo, this.aura, this.light);
    this.hand = new V3();       // where the claw pinches it
    this.anchor = new V3();     // where it starts to hang (the pendulum pivot)
    this.prevAnchor = null; this.anchorVel = new V3();
    this.off = new V3(); this.vel = new V3(); this.force = new V3();
    this.beadPos = new V3();
    this.droop = 0;          // extra drop pressure per second (the owner sets it when not held)
    this.jolt = 0;           // how hard the hand is being jerked around (units/s), from the owner
    this.rate = 1;           // burn-time scale
    this.damping = 1.6;
    this.reset();
  }

  reset() {
    this.state = 'unlit'; this.t = 0; this.stage = -1; this.len = this.len0; this.radius = 0; this.meter = 0;
    this.bright = 0; this.flash = 0; this.popT = .3; this.acc = 0; this.smokeT = 0; this.completed = false; this.cause = null;
    this.off.set(0, 0, 0); this.vel.set(0, 0, 0); this.fall = null; this.prevAnchor = null; this.spentT = 0;
    this.rate = 1;
    this.durs = STAGES.map(s => s.dur * rand(.88, 1.12));
    this.total = this.durs.reduce((a, b) => a + b, 0);
    this.stringMat.color.copy(STRING_COL);
    this.bead.visible = this.halo.visible = this.aura.visible = false; this.light.intensity = 0;
    this.g.visible = true;
  }

  get burning() { return this.state === 'burning'; }
  get out() { return this.state === 'spent'; }
  // swing amplitude in radians (position and velocity together)
  get amplitude() { const w2 = 9.8 / this.len; return Math.sqrt(this.off.lengthSq() + this.vel.lengthSq() / w2) / this.len; }
  stageProgress() {
    let t = this.t;
    for (let i = 0; i < 4; i++) { if (t < this.durs[i]) return [i, t / this.durs[i]]; t -= this.durs[i]; }
    return [3, 1];
  }

  ignite() {
    if (this.state !== 'unlit') return;
    this.state = 'burning'; this.t = 0; this.stage = -1; this.flash = 1; this.meter = 0;
    this.bead.visible = this.halo.visible = this.aura.visible = true;
    const b = this.beadPos;
    for (let k = 0; k < 14; k++) { const a = rand(0, 6.28); this.embers.emit(b.x, b.y, b.z, Math.cos(a) * rand(.3, .9), rand(-.2, .8), Math.sin(a) * rand(.3, .9), rand(.2, .5), 1, .7, .3); }
  }

  drop(cause = 'wobble') {
    if (this.state !== 'burning') return;
    this.state = 'falling'; this.cause = cause;
    this.fall = { p: this.beadPos.clone(), v: new V3(this.vel.x * .7, -.15, this.vel.z * .7) };
    this.onDrop && this.onDrop(cause);
  }

  _emitStage(dt, stage, sp) {
    const b = this.beadPos, S = this.scale * this.spread, pool = this.pool;
    if (stage === 0) {
      // botan: the bead swells; now and then it sputters a few tiny sparks
      this.popT -= dt;
      if (this.popT <= 0 && sp > .25) {
        this.popT = rand(.22, .65);
        const n = 3 + (Math.random() * 4 | 0);
        for (let k = 0; k < n; k++) { tmpA.randomDirection(); const s = rand(.25, .6) * S; pool.spawn(b.x, b.y, b.z, tmpA.x * s, tmpA.y * s, tmpA.z * s, rand(.07, .15), 2, 0, .015, 1.2, 1); }
        this.embers.emit(b.x, b.y, b.z, rand(-.3, .3), rand(0, .4), rand(-.3, .3), rand(.2, .4), 1, .6, .2);
        this.onPop && this.onPop();
      }
    } else if (stage === 1) {
      // matsuba: fierce crackle, sparks that fork and fork again
      const rate = (120 + 90 * Math.max(0, Math.sin(this.t * 7.3) * Math.sin(this.t * 3.1 + 1))) * this.scale;
      this.acc += rate * dt * smooth(0, .12, sp);
      while (this.acc >= 1) {
        this.acc -= 1;
        const a = rand(0, Math.PI * 2), y = rand(-.55, .45), h = Math.sqrt(1 - y * y), s = rand(.9, 1.9) * S;
        pool.spawn(b.x, b.y, b.z, Math.cos(a) * h * s, y * s, Math.sin(a) * h * s, rand(.1, .2), 0, rand(.035, .08), .045, 1.4, .9);
        if (Math.random() < .08) this.onCrackle && this.onCrackle();
      }
    } else if (stage === 2) {
      // yanagi: long, drooping willow streaks
      this.acc += 30 * this.scale * dt;
      while (this.acc >= 1) {
        this.acc -= 1;
        const a = rand(0, Math.PI * 2), r = rand(.4, 1), s = rand(.6, 1.1) * S;
        pool.spawn(b.x, b.y, b.z, Math.cos(a) * r * s, rand(-.5, .15) * s, Math.sin(a) * r * s, rand(.45, .8), 1, Math.random() < .12 ? rand(.15, .3) : 0, .095, 4.2, .45);
      }
    } else {
      // chiri-giku: fewer and fewer small flecks, like petals coming loose
      this.acc += lerp(12, 1.2, sp) * this.scale * dt;
      while (this.acc >= 1) {
        this.acc -= 1;
        tmpA.randomDirection(); const s = rand(.25, .6) * S;
        pool.spawn(b.x, b.y, b.z, tmpA.x * s, tmpA.y * s, tmpA.z * s, rand(.05, .12), 1, Math.random() < .35 ? rand(.02, .04) : 0, .015, 1, .7);
      }
    }
  }

  // wind: V3 force on the bead (gusts + breeze), from the owner
  update(dt, wind) {
    if (dt <= 0) return;
    // the hand's own motion swings the bead
    if (!this.prevAnchor) { this.prevAnchor = this.anchor.clone(); this.anchorVel.set(0, 0, 0); }
    const av = tmpA.subVectors(this.anchor, this.prevAnchor).divideScalar(dt);
    const aacc = tmpB.subVectors(av, this.anchorVel).divideScalar(dt);
    if (aacc.length() > 40) aacc.setLength(40);
    this.anchorVel.copy(av); this.prevAnchor.copy(this.anchor);

    const L = this.len, w2 = 9.8 / L, c = this.damping;
    const fx = wind ? wind.x : 0, fz = wind ? wind.z : 0;
    const ax = -w2 * this.off.x - c * this.vel.x - aacc.x * .9 + this.force.x + fx;
    const az = -w2 * this.off.z - c * this.vel.z - aacc.z * .9 + this.force.z + fz;
    this.vel.x += ax * dt; this.vel.z += az * dt;
    this.off.x += this.vel.x * dt; this.off.z += this.vel.z * dt;
    const r = Math.hypot(this.off.x, this.off.z), rmax = L * .85;
    if (r > rmax) { this.off.x *= rmax / r; this.off.z *= rmax / r; }
    const drop = Math.sqrt(Math.max(L * L - this.off.x * this.off.x - this.off.z * this.off.z, .0001));

    const jitter = this.state === 'burning' ? clamp(this.meter, 0, 1) * .005 * this.scale : 0;
    this.beadPos.set(this.anchor.x + this.off.x + rand(-jitter, jitter), this.anchor.y - drop, this.anchor.z + this.off.z + rand(-jitter, jitter));

    if (this.state === 'burning') this._burn(dt);
    else if (this.state === 'falling') this._fall(dt);
    else if (this.state === 'spent') { this.spentT += dt; if (this.spentT < 2.5 && Math.random() < dt * 6) this.smoke.emit(this.beadPos.x, this.beadPos.y + .02, this.beadPos.z, rand(-.03, .03), .12, rand(-.03, .03), rand(1.4, 2.2), .55, .55, .6); }

    // the string arcs from the claw, through the pivot, down to the bead (or to where it was)
    const end = this.state === 'falling' || this.state === 'spent' ? tmpC.copy(this.anchor).addScaledVector(tmpB.set(this.off.x, -drop, this.off.z), .92) : this.beadPos;
    tmpA.copy(this.anchor); tmpA.y += .04;
    this.ribbon.set(this.hand, tmpA, end, .009 * this.scale + .003);
  }

  _burn(dt) {
    this.t += dt * this.rate;
    const [stage, sp] = this.stageProgress();
    if (stage !== this.stage) { this.stage = stage; this.acc = 0; this.onStage && this.onStage(stage); }
    const R = .031 * this.scale;
    let rad, bright, li;
    if (stage === 0) { rad = R * smooth(0, .8, sp); bright = lerp(.7, 1.15, sp); li = lerp(.08, .28, sp); }
    else if (stage === 1) { rad = R * (1 + .07 * Math.sin(this.t * 23)); bright = 1.35; li = .42 + .2 * Math.random(); }
    else if (stage === 2) { rad = R * .95; bright = 1.15; li = .33 + .08 * Math.random(); }
    else { rad = R * lerp(.9, .5, sp); bright = lerp(.85, .12, sp); li = lerp(.2, .01, sp); }
    this.flash = Math.max(0, this.flash - dt * 3);
    this.radius = rad; this.bright = bright;
    this.len = this.len0 * (1 - .22 * this.t / this.total);
    this._emitStage(dt, stage, sp);

    // molten wobble: the bead never quite holds its shape
    const s = Math.max(rad, .002), j = .14;
    this.bead.position.copy(this.beadPos);
    this.bead.scale.set(s * (1 + rand(-j, j)), s * (1 + rand(-j, j) + .05), s * (1 + rand(-j, j)));
    const heat = bright + this.flash * 2;
    this.beadMat.color.setRGB(1.55 * heat + .25, .52 * heat + .1, .12 * heat + .02);
    this.halo.position.copy(this.beadPos);
    this.halo.scale.setScalar((rad * 7 + .03 + this.flash * .12) * (1 + rand(-.08, .08)));
    this.halo.material.opacity = clamp(.25 + bright * .38, 0, 1);
    this.aura.position.copy(this.beadPos);
    this.aura.scale.setScalar(.55 * this.scale * (.6 + bright * .4));
    this.aura.material.opacity = .025 + bright * .05;
    this.light.position.copy(this.beadPos);
    this.light.intensity = (li + this.flash * .6) * this.scale * (1 - .25 * clamp(this.meter, 0, 1) * Math.random());

    this.smokeT -= dt;
    if (this.smokeT <= 0) { this.smokeT = rand(.12, .3); this.smoke.emit(this.beadPos.x, this.beadPos.y + .03, this.beadPos.z, rand(-.04, .04), .16, rand(-.04, .04), rand(1.5, 2.6), .6, .58, .62); }

    if (this.fragile) {
      const m = this.amplitude, m0 = .24;
      // a swing past ~14° strains the bead; a jerked hand shakes it loose; letting go droops it
      const strain = (m > m0 ? (m - m0) * 3.4 : 0) + Math.max(0, this.jolt - .3) * .45 + this.droop;
      this.meter += strain > 0 ? strain * dt : -.55 * dt;
      this.meter = Math.max(0, this.meter);
      if (this.meter >= 1 || m > .78) this.drop(this.droop > 0 && m < m0 + .1 ? 'droop' : 'wobble');
    }
    if (this.t >= this.total) { this.completed = true; this.drop('end'); }
  }

  _fall(dt) {
    const F = this.fall;
    F.v.y -= 9.8 * dt; F.p.addScaledVector(F.v, dt);
    const k = Math.max(0, this.bright -= dt * (this.cause === 'end' ? .25 : .9));
    this.bead.position.copy(F.p); this.bead.scale.setScalar(Math.max(this.radius * (.6 + .4 * k), .004));
    this.beadMat.color.setRGB(1.2 * k + .3, .5 * k + .08, .12 * k);
    this.halo.position.copy(F.p); this.halo.scale.setScalar(this.radius * 5 * (.4 + k)); this.halo.material.opacity = .25 + .5 * k;
    this.aura.material.opacity = .04 * k;
    this.light.position.copy(F.p); this.light.intensity = .2 * k;
    if (Math.random() < dt * 30) this.embers.emit(F.p.x, F.p.y, F.p.z, rand(-.2, .2), rand(0, .3), rand(-.2, .2), rand(.15, .3), 1, .5, .15);
    const onCounter = F.p.z > -1.2 && F.p.z < 1.2, floor = onCounter ? 0 : -3;
    if (F.p.y <= floor + .01) {
      if (onCounter) for (let k2 = 0; k2 < 6; k2++) this.embers.emit(F.p.x, .01, F.p.z, rand(-.5, .5), rand(.2, .7), rand(-.5, .5), rand(.15, .35), 1, .55, .2);
      this.state = 'spent'; this.spentT = 0;
      this.bead.visible = this.halo.visible = this.aura.visible = false; this.light.intensity = 0;
      this.stringMat.color.copy(SPENT_COL);
      this.onOut && this.onOut(this.cause);
    }
  }

  dispose() {
    this.ribbon.dispose();
    this.g.parent?.remove(this.g);
    this.stringMat.dispose(); this.beadMat.dispose(); this.halo.material.dispose(); this.aura.material.dispose();
  }
}

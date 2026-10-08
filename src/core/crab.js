// Clawd and the helpers. One class, two sizes.
import { THREE, V3, scene, mesh, group, box, rbox, cyl, sph, toon, canvasTex, COL, toScreen, camera } from './gfx.js';
import { G, emit } from './state.js';
import { $, rand, clamp, lerp, damp, wrapAngle } from './util.js';
import { audio } from './audio.js';
import { puff } from './fx.js';

export const crew = [];
const bubbles = $('#bubbles');
const blockGeo = rbox(.38, .32, .38, .06);
export const iceMat = new THREE.MeshStandardMaterial({ color: 0xdff6ff, transparent: true, opacity: .78, roughness: .08, emissive: 0x9cc8e8, emissiveIntensity: .25 });
const SPOON_COLS = [0xe8384c, 0x40c25c, 0x3d8fe3, 0xf2c14e, 0xc7a6e8];

export class Crab {
  constructor({ name, short, scale = 1, speed = 2.6, i = 0 }) {
    Object.assign(this, { name, short, scale, baseSpeed: speed, speed, i });
    this.spec = []; this.icon = ''; this.specName = ''; this.voice = [];
    this.g = group(scene); this.inner = group(this.g);
    const m = this.mat = toon(COL.orange);
    this.body = mesh(rbox(1.15, .82, .8, .09), m, 0, .71, 0, this.inner);
    this.arms = [-1, 1].map(s => { const p = group(this.inner, s * .62, .62, 0); mesh(rbox(.3, .24, .36, .05), m, s * .08, 0, 0, p); return p; });
    this.legs = [-.42, -.15, .15, .42].map(x => { const p = group(this.inner, x, .32, .05); mesh(box(.15, .32, .2), m, 0, -.16, 0, p); return p; });
    this.faceTex = canvasTex(256, 160);
    this.face = mesh(new THREE.PlaneGeometry(.9, .5625), new THREE.MeshBasicMaterial({ map: this.faceTex, transparent: true, toneMapped: false }), 0, .78, .402, this.inner, false);
    this.sel = new THREE.Mesh(new THREE.RingGeometry(.72, .84, 40), new THREE.MeshBasicMaterial({ color: COL.orange, transparent: true, opacity: .9, toneMapped: false, depthWrite: false }));
    this.sel.rotation.x = -Math.PI / 2; this.sel.position.y = .015; this.sel.visible = false; this.g.add(this.sel);
    this.carryMesh = mesh(blockGeo, iceMat, 0, 1.32, 0, this.inner); this.carryMesh.visible = false;
    this.hand = group(this.arms[1], .2, 0, .1);        // props held in the right claw go here
    this.headSlot = group(this.inner, 0, 1.12, 0);     // hats, carried things
    this.spoon = group(this.hand); mesh(cyl(.025, .025, .55, 6), toon(0xc89a62), 0, .27, 0, this.spoon);
    mesh(sph(.075, 10, 8), toon(SPOON_COLS[i % SPOON_COLS.length]), 0, .57, 0, this.spoon); this.spoon.visible = false;
    this.g.traverse(o => { if (o.isMesh) o.userData.crab = this; });
    this.g.scale.setScalar(scale);
    this.bub = document.createElement('div'); this.bub.className = 'bub'; this.bub.style.opacity = 0; bubbles.appendChild(this.bub);
    this.reset({});
    crew.push(this);
  }

  reset({ x = 0, z = .5, face = 0, visible = true } = {}) {
    this.x = this.targetX = x; this.z = z; this.y = 0; this.rotY = face; this.faceOverride = null;
    this.walkT = 0; this.t = rand(0, 10); this.expr = 'normal'; this.exprT = 0; this.blinkT = rand(1, 4); this.happyT = 0;
    this.workAnim = null; this.carry = false; this.carryMesh.visible = false; this.job = null; this.action = null;
    this.waitMsg = ''; this.lastSay = ''; this.bubT = 0; this.idleT = 0; this.asleep = false; this.sit = 0; this.sitTarget = 0;
    this.gaze = { x: 0, y: 0 }; this.gazeTarget = null; this.blush = 0; this.sweat = 0; this.pending = null;
    this.spoon.visible = false; this.speed = this.baseSpeed; this.squash = 0;
    this.jumpY = 0; this.jumpV = 0; this.jumpHold = false; this.jumpBuf = 0;
    this.g.visible = visible; this.g.scale.setScalar(this.scale); this.sel.visible = false;
    this._face = null; this.drawFace('normal');
  }

  setRole(r = {}) {
    this.spec = r.spec || []; this.icon = r.icon || ''; this.specName = r.specName || ''; this.voice = r.voice || [];
  }

  drawFace(e) {
    const gx = Math.round(this.gaze.x * 10), gy = Math.round(this.gaze.y * 6), bl = this.blush > .3, sw = this.sweat > .3;
    const sig = `${e}|${gx}|${gy}|${bl}|${sw}`;
    if (this._face === sig) return; this._face = sig;
    const { x } = this.faceTex.userData;
    x.clearRect(0, 0, 256, 160);
    x.fillStyle = x.strokeStyle = '#141414'; x.lineWidth = 11; x.lineCap = x.lineJoin = 'round';
    const E = [[86 + gx, 66 + gy], [170 + gx, 66 + gy]];
    for (const [cx, cy] of E) {
      x.beginPath();
      if (e === 'normal') x.fillRect(cx - 12, cy - 20, 24, 40);
      else if (e === 'blink' || e === 'sleep') x.fillRect(cx - 13, cy + 4, 26, 8);
      else if (e === 'happy') { x.moveTo(cx - 16, cy + 8); x.lineTo(cx, cy - 10); x.lineTo(cx + 16, cy + 8); x.stroke(); }
      else if (e === 'focus') { const s = cx < 128 ? 1 : -1; x.moveTo(cx - 13 * s, cy - 14); x.lineTo(cx + 11 * s, cy); x.lineTo(cx - 13 * s, cy + 14); x.stroke(); }
      else if (e === 'wow') { x.arc(cx, cy, 13, 0, 7); x.stroke(); }
      else if (e === 'sad') { x.fillRect(cx - 10, cy - 6, 20, 26); x.moveTo(cx - 16, cy - 20 + (cx < 128 ? 8 : 0)); x.lineTo(cx + 16, cy - 20 + (cx < 128 ? 0 : 8)); x.stroke(); }
      else if (e === 'wink') { if (cx < 128) x.fillRect(cx - 12, cy - 20, 24, 40); else { x.moveTo(cx - 16, cy + 2); x.lineTo(cx + 16, cy + 2); x.stroke(); } }
      else if (e === 'love') { x.fillStyle = '#e8384c'; x.moveTo(cx, cy + 14); x.bezierCurveTo(cx - 26, cy - 4, cx - 10, cy - 24, cx, cy - 8); x.bezierCurveTo(cx + 10, cy - 24, cx + 26, cy - 4, cx, cy + 14); x.fill(); x.fillStyle = '#141414'; }
    }
    if (bl || e === 'happy' || e === 'love') { x.fillStyle = 'rgba(255,120,130,.55)'; x.beginPath(); x.ellipse(50, 112, 20, 10, 0, 0, 7); x.ellipse(206, 112, 20, 10, 0, 0, 7); x.fill(); }
    if (sw) { x.fillStyle = 'rgba(150,210,255,.95)'; x.beginPath(); x.moveTo(228, 10); x.quadraticCurveTo(244, 34, 228, 42); x.quadraticCurveTo(212, 34, 228, 10); x.fill(); }
    this.faceTex.needsUpdate = true;
  }

  setCarry(v) { this.carry = v; this.carryMesh.visible = !!v; }
  say(t, dur = 2.4) {
    if (!t) return; this.bub.textContent = t; this.bubT = dur; this.lastSay = t;
    if (G.mode === 'play' || G.mode === 'ending' || G.mode === 'intro') audio.sfx('voice', { i: this.i, n: t.length, gap: .15 });
  }
  mood(e, dur = 1.4) { this.expr = e; this.exprT = dur; }
  hop(h = .6) { this.happyT = Math.max(this.happyT, h); }
  // a real jump: hold for higher, stretch on the way up, squash and dust on landing.
  // Pressed while airborne, it's remembered for a moment and fires on landing.
  jump(power = 1) {
    if (!this.g.visible) return false;
    if (this.jumpY > 0) { this.jumpBuf = .14; return false; }
    this.wake(); this.idleT = 0; this.sitTarget = 0; this.sit = 0;
    this.jumpV = 6.4 * power; this.jumpY = 1e-3; this.jumpHold = true;
    this.mood('happy', .8);
    audio.sfx('jump', { x: this.x, small: this.scale < 1 });
    emit('jump', this);
    return true;
  }
  jumpRelease() { this.jumpHold = false; }
  lookAt(v) { this.gazeTarget = v; }   // world V3 or null (looks at camera/cursor)
  get height() { return 1.25 * this.scale; }
  arrived() { return Math.abs(this.targetX - this.x) < .05; }
  wake() { if (this.asleep) { this.asleep = false; this.idleT = 0; this.sitTarget = 0; this.mood('wow', .6); } }

  update(dt) {
    this.t += dt;
    if (this.jumpBuf > 0) this.jumpBuf -= dt;
    if (this.jumpY > 0) {
      // lighter gravity while the key is held on the way up; a quick fall
      this.jumpV -= (this.jumpV > 0 && this.jumpHold ? 16 : 36) * dt;
      this.jumpY += this.jumpV * dt;
      if (this.jumpY <= 0) {
        const v = Math.min(1, -this.jumpV / 7);
        this.jumpY = 0; this.jumpV = 0; this.squash = 1;
        for (const s of [-1, 1]) puff(this.x + s * .35 * this.scale, .04, this.z + .1, 3, [.86, .8, .7]);
        audio.sfx('land', { x: this.x, small: this.scale < 1, v });
        if (this.jumpBuf > 0) { this.jumpBuf = 0; this.jump(); }
      }
    }
    const dx = this.targetX - this.x, moving = Math.abs(dx) > .05 && this.speed > 0;
    let face = this.faceOverride ?? 0;
    if (moving) {
      if (this.asleep) this.wake();
      this.x += Math.sign(dx) * Math.min(Math.abs(dx), this.speed * dt * (G.effort > 0 ? 1.6 : 1));
      this.walkT += dt * 13; face = dx > 0 ? Math.PI / 2 : -Math.PI / 2; this.idleT = 0; this.sitTarget = 0;
      this.dustT = (this.dustT ?? 0) - dt;
      if (this.dustT < 0 && this.g.visible && this.y + this.jumpY < .05) { this.dustT = .28; puff(this.x - Math.sign(dx) * .35 * this.scale, .04, this.z + .1, 1, [.86, .8, .7]); }
    }
    this.rotY += wrapAngle(face - this.rotY) * damp(12, dt);
    const air = this.jumpY > 0;
    this.legs.forEach((l, i) => l.rotation.x = air ? (i % 2 ? .35 : -.35) : moving ? Math.sin(this.walkT + (i % 2) * Math.PI) * .55 : l.rotation.x * .8);

    // idle life: sit down after a while, doze off after longer
    const idle = !moving && !this.action && !this.workAnim && !this.job && G.mode === 'play' && this !== crew[0];
    this.idleT = idle ? this.idleT + dt : 0;
    if (idle && this.idleT > 14) this.sitTarget = 1;
    if (idle && this.idleT > 30 && !this.asleep) { this.asleep = true; this.say('z z z', 3); }
    if (!idle && this.asleep) this.wake();
    this.sit = lerp(this.sit, this.sitTarget, damp(4, dt));

    let bob = moving ? Math.abs(Math.sin(this.walkT)) * .07 : Math.sin(this.t * 2) * .012;
    let armA = 0, armB = 0, armUp = 0;
    switch (this.workAnim) {
      case 'crank': armA = Math.sin(this.t * 12) * .7; armB = -armA; bob += Math.abs(Math.sin(this.t * 6)) * .03; this.sweat = Math.min(1, this.sweat + dt * .4); break;
      case 'chop': armA = Math.sin(this.t * 14) * .6; bob += Math.abs(Math.sin(this.t * 7)) * .05; break;
      case 'pour': armA = -.6; armUp = .18; break;
      case 'pick': bob += Math.abs(Math.sin(this.t * 9)) * .05; break;
      case 'eat': armA = Math.max(0, Math.sin(this.t * 3.1 + this.i)) * -1.2; break;
      case 'stir': armA = Math.sin(this.t * 8) * .5; armB = Math.cos(this.t * 8) * .3; break;
      case 'wave': armA = -1.6 + Math.sin(this.t * 10) * .4; break;
      case 'hold': armA = -.9; break;
      case 'write': armA = -.4 + Math.sin(this.t * 16) * .12; bob += Math.abs(Math.sin(this.t * 5)) * .01; break;
      case 'cheer': armA = armB = -1.4 + Math.sin(this.t * 12) * .3; armUp = .1; bob += Math.abs(Math.sin(this.t * 9)) * .1; break;
    }
    if (air) { armA = armB = -1.1 + clamp(this.jumpV / 6, -1, 1) * .25; armUp = .08; }
    if (!this.workAnim || this.workAnim !== 'crank') this.sweat = Math.max(0, this.sweat - dt * .3);
    this.arms[1].rotation.x = armA; this.arms[0].rotation.x = armB;
    this.arms[0].position.y = this.arms[1].position.y = .62 + armUp;
    if (this.happyT > 0) { this.happyT -= dt; bob += Math.abs(Math.sin(this.t * 11)) * .22; }
    if (this.asleep) bob = Math.sin(this.t * 1.5) * .02;
    if (air) bob = 0;
    // squash on landing
    this.squash = Math.max(0, this.squash - dt * 4);
    const sq = Math.sin(this.squash * Math.PI) * .15;
    const st = air ? Math.min(1, Math.abs(this.jumpV) / 7) * .12 : 0;
    this.inner.scale.set(1 + sq - st * .5, 1 - sq - this.sit * .12 + st, 1 + sq - st * .5);
    this.inner.position.y = bob - this.sit * .2;
    this.legs.forEach(l => l.scale.y = 1 - this.sit * .7);
    this.g.position.set(this.x, this.y + this.jumpY, this.z); this.g.rotation.y = this.rotY;

    // gaze: look at a target, else drift toward the camera
    let gx = 0, gy = 0;
    if (this.gazeTarget) {
      const dxw = this.gazeTarget.x - this.x, dyw = this.gazeTarget.y - (this.y + .8 * this.scale);
      gx = clamp(dxw / 3, -1, 1) * (Math.abs(wrapAngle(this.rotY)) < 1 ? 1 : 0); gy = clamp(-dyw / 3, -1, 1);
    } else if (G.cursor && G.mode === 'play' && Math.abs(G.cursor.x - this.x) < 5 && Math.abs(wrapAngle(this.rotY)) < 1) {
      // follow the pointer when it's nearby
      gx = clamp((G.cursor.x - this.x) / 2.5, -1, 1); gy = clamp(-(G.cursor.y - (this.y + .8 * this.scale)) / 2.5, -1, 1);
    } else { gx = Math.sin(this.t * .37 + this.i) * .25; gy = Math.sin(this.t * .23 + this.i * 2) * .2; }
    this.gaze.x = lerp(this.gaze.x, gx, damp(5, dt)); this.gaze.y = lerp(this.gaze.y, gy, damp(5, dt));
    this.blush = Math.max(0, this.blush - dt * .3);

    // expression
    this.blinkT -= dt; if (this.exprT > 0) this.exprT -= dt;
    let e = this.exprT > 0 ? this.expr : this.asleep ? 'sleep' : (this.action || this.workAnim === 'crank' ? 'focus' : 'normal');
    if (this.blinkT < 0) { if (e === 'normal') e = 'blink'; if (this.blinkT < -.13) this.blinkT = rand(2, 5); }
    this.drawFace(e);

    // bubble
    if (this.bubT > 0) this.bubT -= dt;
    let show = this.bubT > 0 && this.g.visible && G.mode !== 'title' && G.mode !== 'diary';
    const p = show ? toScreen(this.x, this.y + this.jumpY + this.height + .35 + bob, this.z) : null;
    // crabs outside the shot keep their thoughts to themselves
    if (p && (p.behind || p.x < -40 || p.x > innerWidth + 40 || p.y < -40 || p.y > innerHeight + 40)) show = false;
    this.bub.style.opacity = show ? Math.min(1, this.bubT * 3) : 0;
    if (show) {
      const hw = this.bub.offsetWidth / 2 + 8;
      this.bub.style.left = clamp(p.x, hw, innerWidth - hw) + 'px';
      this.bub.style.top = Math.max(30, p.y) + 'px';
    }
  }
}

export const clawd = new Crab({ name: 'clawd', short: 'you', speed: 3.4, i: 3 });
export const helpers = [
  new Crab({ name: 'helper 1', short: 'h1', scale: .62, i: 0 }),
  new Crab({ name: 'helper 2', short: 'h2', scale: .62, i: 1 }),
  new Crab({ name: 'helper 3', short: 'h3', scale: .62, i: 2 }),
];
// default personalities; chapters may override spec/specName per day
export const PERSONA = [
  { icon: '🍓', specName: 'strawberry', voice: ['✦', 'precise!', 'one more pass', 'perfect slice'] },
  { icon: '🌿', specName: 'mint', voice: ['ahh, breeze', 'the city is humming', 'smells like rain', 'calm'] },
  { icon: '🧊', specName: 'ice', voice: ['ice is my thing ✦', 'strong claws!', 'let\'s gooo', 'cold and ready'] },
];
helpers.forEach((h, i) => h.setRole({ ...PERSONA[i], spec: [] }));

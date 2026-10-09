// 金魚すくい: a shallow tub of goldfish and a paper scoop (poi) that tears. Played in the world,
// looking down into the tub: press to dip the poi, slide it under a fish, let go to lift.
// The paper softens the longer it's wet, faster when you sweep it, and a heavy fish can break it.
import { THREE, V3, mesh, group, box, rbox, cyl, sph, toon, canvasTex, toScreen } from '../../../core/gfx.js';
import { G } from '../../../core/state.js';
import { $, rand, pick, clamp, lerp, damp, wrapAngle, isTouch } from '../../../core/util.js';
import { tween } from '../../../core/tween.js';
import { audio } from '../../../core/audio.js';
import { X, FRONT } from './street.js';

export const TUB = { x: X.gold, z: FRONT - .9, w: 3.3, d: 1.2, rim: .42, water: .35 };
const IN = { x: TUB.w / 2 - .14, z: TUB.d / 2 - .12 };
const KINDS = {
  wakin: { col: 0xff5a2a, w: .16, n: 6 },
  akame: { col: 0xe8302a, w: .16, n: 2 },
  sarasa: { col: 0xfff2e6, w: .18, n: 2, patch: true },
  demekin: { col: 0x1a181e, w: .34, n: 2, eyes: true },
};
export const FISH_NAME = { wakin: 'a red one', akame: 'a deep red one', sarasa: 'a red-and-white one', demekin: 'a black demekin' };

audio.register('plop', o => { const d = o.delay || 0; audio.tone(460, .12, 'sine', .07, 170, { delay: d }); audio.noise(.08, 'lowpass', 700, .06, .8, { delay: d }); });
audio.register('scoop', o => { const d = o.delay || 0; audio.noise(.22, 'bandpass', 1300, .1, .9, { delay: d, attack: .02, sweep: 2600 }); audio.tone(300, .14, 'sine', .05, 620, { delay: d }); });
audio.register('tear', o => { const d = o.delay || 0; audio.noise(.26, 'bandpass', 2600, .16, 2.2, { delay: d, attack: .005, sweep: 900, color: 'pink' }); for (let i = 0; i < 5; i++) audio.noise(.01, 'highpass', 5000, .08, .7, { delay: d + i * .035 }); });
audio.register('flip', o => { const d = o.delay || 0; audio.tone(880, .07, 'sine', .07, 1600, { delay: d }); audio.noise(.05, 'highpass', 2500, .05, .7, { delay: d + .05 }); });

// a fan tail with fin rays, painted once; alpha-cut so it reads as a shape, not a card
const tailTex = canvasTex(128, 128, (x, w, h) => {
  x.clearRect(0, 0, w, h);
  x.fillStyle = '#fff'; x.beginPath(); x.moveTo(w, h / 2);
  x.bezierCurveTo(w * .55, h * .38, w * .2, h * .02, w * .04, h * .1); x.quadraticCurveTo(w * .3, h * .5, w * .04, h * .9);
  x.bezierCurveTo(w * .2, h * .98, w * .55, h * .62, w, h / 2); x.fill();
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2; for (let k = -3; k <= 3; k++) { x.beginPath(); x.moveTo(w * .95, h / 2); x.lineTo(w * .15, h / 2 + k * h * .12); x.stroke(); }
});
const MATS = {};
function fishMat(kind) {
  if (MATS[kind]) return MATS[kind];
  const K = KINDS[kind];
  const body = K.patch
    ? toon(0xffffff, { emissive: 0x804030, emissiveIntensity: .25, map: canvasTex(64, 32, (x, w, h) => { x.fillStyle = '#fff4ea'; x.fillRect(0, 0, w, h); x.fillStyle = '#f0401e'; for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(rand(8, w - 8), rand(6, h - 6), rand(6, 12), rand(4, 8), rand(0, 3), 0, 7); x.fill(); } }) })
    : toon(K.col, { emissive: K.col, emissiveIntensity: kind === 'demekin' ? 0 : .38 });
  const tail = toon(K.patch ? 0xffc8b0 : K.col, { map: tailTex, alphaTest: .5, side: THREE.DoubleSide, emissive: K.patch ? 0x804030 : K.col, emissiveIntensity: kind === 'demekin' ? 0 : .3 });
  return MATS[kind] = { body, tail, eye: toon(0x111111) };
}
function fishMesh(kind) {
  const K = KINDS[kind], M = fishMat(kind), g = new THREE.Group();
  const s = kind === 'demekin' ? .95 : .8;
  const body = mesh(sph(.085, 14, 10), M.body, 0, 0, 0, g); body.scale.set(1.7 * s, .8 * s, .9 * s);
  const tail = group(g, -.13 * s, 0, 0);
  const tm = mesh(new THREE.PlaneGeometry(.2 * s, .2 * s), M.tail, -.09 * s, 0, 0, tail, false);
  tm.rotation.x = -Math.PI / 2; tm.rotation.z = Math.PI;
  if (K.eyes) for (const sz of [-1, 1]) mesh(sph(.03, 10, 8), M.body, .09 * s, .025, sz * .07 * s, g, false);
  else for (const sz of [-1, 1]) mesh(sph(.012, 6, 4), M.eye, .11 * s, .02, sz * .04 * s, g, false);
  g.userData.tail = tail;
  return g;
}

export function buildGoldfish(root, { onEnd, canPay, pay, keeperSay } = {}) {
  const GF = { active: false, caught: [], strength: 1, torn: false, roundCaught: [] };
  const tub = group(root, TUB.x, .07, TUB.z);   // on a low stand, clear of the stall floor
  const blue = toon(0x58a8e0), wall = (w, d, x, z) => mesh(box(w, TUB.rim, d), blue, x, TUB.rim / 2, z, tub);
  wall(TUB.w, .08, 0, -TUB.d / 2); wall(TUB.w, .08, 0, TUB.d / 2); wall(.08, TUB.d, -TUB.w / 2, 0); wall(.08, TUB.d, TUB.w / 2, 0);
  mesh(box(TUB.w, .06, TUB.d), toon(0x9ad6f2), 0, .03, 0, tub);
  // stones and a weed at the bottom
  for (let i = 0; i < 10; i++) { const st = mesh(sph(rand(.025, .05), 10, 8), toon(pick([0xb8b0a0, 0x8a8478, 0xd8d0c0])), rand(-IN.x, IN.x), .065, rand(-IN.z, IN.z), tub, false); st.scale.y = .5; }
  const ripTex = canvasTex(256, 128, (x, w, h) => { x.fillStyle = 'rgba(190,235,255,.06)'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 2; for (let i = 0; i < 9; i++) { x.beginPath(); const y = rand(0, h); for (let u = 0; u <= w; u += 8) x.lineTo(u, y + Math.sin(u * .05 + i) * 5); x.stroke(); } });
  ripTex.wrapS = ripTex.wrapT = THREE.RepeatWrapping;
  const water = mesh(new THREE.PlaneGeometry(TUB.w - .1, TUB.d - .1), new THREE.MeshBasicMaterial({ map: ripTex, transparent: true, depthWrite: false, color: 0xffffff }), 0, TUB.water, 0, tub, false);
  water.rotation.x = -Math.PI / 2; water.renderOrder = 2;
  GF.hit = mesh(box(TUB.w + .3, 1.2, TUB.d + .4), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }), TUB.x, .5, TUB.z, root, false);

  // fish
  GF.fish = [];
  for (const [kind, K] of Object.entries(KINDS)) for (let i = 0; i < K.n; i++) {
    const m = fishMesh(kind); tub.add(m);
    GF.fish.push({ kind, m, x: rand(-IN.x, IN.x), z: rand(-IN.z, IN.z), y: rand(.15, .26), a: rand(0, 6.28), v: rand(.18, .35), turn: 0, flee: 0, t: rand(0, 9), out: false });
  }
  // the poi: a pink plastic ring, a handle, and paper that wets and tears
  const poi = group(tub, 0, .7, 0); poi.visible = false;
  mesh(new THREE.TorusGeometry(.19, .018, 6, 28), toon(0xff8fb0), 0, 0, 0, poi, false).rotation.x = Math.PI / 2;
  mesh(box(.05, .02, .42), toon(0xff8fb0), .0, 0, .38, poi, false);
  const paperTex = canvasTex(128, 128);
  const paper = mesh(new THREE.CircleGeometry(.185, 28), new THREE.MeshBasicMaterial({ map: paperTex, transparent: true, depthWrite: false, side: THREE.DoubleSide }), 0, 0, 0, poi, false);
  paper.rotation.x = -Math.PI / 2; paper.renderOrder = 3;
  let holes = [];
  function drawPaper() {
    const x = paperTex.userData.x, w = 128, wet = clamp(1 - GF.strength, 0, 1);
    x.clearRect(0, 0, w, w);
    x.fillStyle = `rgba(${255 - wet * 40},${255 - wet * 30},${255 - wet * 20},${.88 - wet * .4})`; x.beginPath(); x.arc(64, 64, 63, 0, 7); x.fill();
    x.strokeStyle = 'rgba(200,190,170,.25)'; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(rand(0, w), rand(0, w)); x.lineTo(rand(0, w), rand(0, w)); x.stroke(); }
    x.globalCompositeOperation = 'destination-out';
    for (const [hx, hy, r] of holes) { x.beginPath(); for (let k = 0; k <= 12; k++) { const a = k / 12 * 6.283, rr = r * rand(.6, 1.2); x.lineTo(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr); } x.fill(); }
    x.globalCompositeOperation = 'source-over';
    paperTex.needsUpdate = true;
  }
  drawPaper();

  // the bowl the keeper hands you, at the near edge
  const bowl = group(tub, IN.x - .2, TUB.rim + .005, IN.z + .06);
  mesh(new THREE.CylinderGeometry(.13, .08, .09, 20, 1, true), toon(0xf4f1ec, { side: THREE.DoubleSide }), 0, .045, 0, bowl, false);
  mesh(new THREE.TorusGeometry(.13, .012, 6, 24), toon(0x3d74c8), 0, .09, 0, bowl, false).rotation.x = Math.PI / 2;
  mesh(new THREE.CircleGeometry(.08, 18), toon(0xdff0fa), 0, .002, 0, bowl, false).rotation.x = -Math.PI / 2;
  const bw = mesh(new THREE.CircleGeometry(.12, 20), new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: .4, depthWrite: false }), 0, .075, 0, bowl, false); bw.rotation.x = -Math.PI / 2; bw.userData.noInk = true;
  bowl.visible = false;
  const inBowl = [];

  // ripples on the water
  const ripMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, depthWrite: false });
  const ripples = [];
  function ripple(x, z, s = 1) {
    const r = new THREE.Mesh(new THREE.RingGeometry(.06, .075, 24), ripMat.clone()); r.rotation.x = -Math.PI / 2; r.position.set(x, TUB.water + .005, z); r.userData.noInk = true; tub.add(r);
    ripples.push({ r, t: 0, s });
  }

  // ── input: the poi follows the pointer across the water plane ──
  const plane = new THREE.Plane(new V3(0, 1, 0), -(TUB.water + .07)), hitP = new V3();
  const P = { x: 0, z: 0, tx: 0, tz: 0, down: false, depth: 0, speed: 0 };
  function aim(ray) {
    if (!ray.ray.intersectPlane(plane, hitP)) return;
    P.tx = clamp(hitP.x - TUB.x, -IN.x, IN.x); P.tz = clamp(hitP.z - TUB.z, -IN.z, IN.z);
  }
  GF.pointer = (type, e, ray) => {
    if (!GF.active) return false;
    if (e.target && e.target.closest && e.target.closest('#mt-tub')) return false;
    aim(ray);
    if (type === 'down' && !GF.torn) { P.down = true; P.x = P.tx; P.z = P.tz; audio.sfx('plop'); ripple(P.x, P.z, 1.4); scare(P.x, P.z, .45); GF.strength -= .03; }
    if (type === 'up' && P.down) { P.down = false; lift(); }
    return true;
  };

  function scare(x, z, r) { for (const f of GF.fish) { if (f.out) continue; const d = Math.hypot(f.x - x, f.z - z); if (d < r) { f.flee = .8; f.a = Math.atan2(f.z - z, f.x - x); f.v = .7; } } }

  function lift() {
    ripple(P.x, P.z, 1);
    const got = GF.fish.filter(f => !f.out && Math.hypot(f.x - P.x, f.z - P.z) < .17 && P.depth > .5);
    if (!got.length) { audio.sfx('plop'); return; }
    const load = got.reduce((a, f) => a + KINDS[f.kind].w, 0);
    if (GF.strength - load * .9 < 0) { tear(got); return; }
    GF.strength -= load * .5;
    audio.sfx('scoop');
    got.forEach((f, i) => catchFish(f, i * .12));
    drawPaper();
  }
  function catchFish(f, delay) {
    f.out = true;
    const from = new V3(P.x, .45, P.z), to = new V3(bowl.position.x, bowl.position.y + .1, bowl.position.z);
    tween(.55 + delay, e => { const k = clamp((e * (.55 + delay) - delay) / .55, 0, 1); f.m.position.lerpVectors(from, to, k); f.m.position.y += Math.sin(k * Math.PI) * .45; f.m.rotation.z = k * 9; }, () => {
      audio.sfx('flip'); f.m.visible = false;
      const m = fishMesh(f.kind); m.scale.setScalar(.55); bowl.add(m); inBowl.push({ m, a: rand(0, 6), r: rand(.02, .05) });
      GF.roundCaught.push(f.kind); GF.caught.push(f.kind);
      keeperSay(pick(['おっ、うまい!', 'nice scoop ✦', 'じょうず!']));
    });
  }
  function tear(dropped) {
    GF.torn = true; GF.strength = 0;
    holes = [[64 + rand(-10, 10), 64 + rand(-10, 10), 40], [rand(30, 90), rand(30, 90), 22]];
    drawPaper(); audio.sfx('tear');
    for (const f of dropped || []) { f.flee = 1; f.v = .9; }
    ripple(P.x, P.z, 1.6);
    keeperSay(dropped?.length ? pick(['ああ〜、おしい!', 'so close!']) : pick(['やぶれちゃった', 'the paper went']));
    tween(.9, () => { }, () => GF.active && GF.onTorn && GF.onTorn());
  }

  // ── a round ──
  GF.start = () => {
    GF.active = true; GF.torn = false; GF.strength = 1; holes = []; drawPaper();
    poi.visible = true; bowl.visible = true; P.down = false; P.depth = 0;
  };
  GF.stop = () => { GF.active = false; poi.visible = false; P.down = false; };
  GF.reset = () => { // put every fish back for a new evening
    GF.caught = []; GF.roundCaught = []; inBowl.splice(0).forEach(b => b.m.parent?.remove(b.m)); bowl.visible = false;
    GF.fish.forEach(f => { f.out = false; f.m.visible = true; f.x = rand(-IN.x, IN.x); f.z = rand(-IN.z, IN.z); });
  };
  GF.takeBowl = () => { const k = GF.roundCaught.slice(); GF.roundCaught = []; inBowl.splice(0).forEach(b => b.m.parent?.remove(b.m)); bowl.visible = false; return k; };

  GF.update = dt => {
    const t = G.time;
    ripTex.offset.x = t * .01; ripTex.offset.y = Math.sin(t * .3) * .02;
    // fish: wander, keep off the walls and each other, flee a fast poi
    for (const f of GF.fish) {
      if (f.out) continue;
      f.t += dt;
      f.turn += (Math.random() - .5) * dt * 3; f.turn *= 1 - dt * 1.5;
      let a = f.a + f.turn * dt * 2;
      const wx = Math.abs(f.x) / IN.x, wz = Math.abs(f.z) / IN.z;
      if (wx > .8 || wz > .7) { const home = Math.atan2(-f.z * .6, -f.x); a += wrapAngle(home - a) * dt * 2.5; }
      for (const o of GF.fish) { if (o === f || o.out) continue; const dx = f.x - o.x, dz = f.z - o.z, d = Math.hypot(dx, dz); if (d < .16 && d > 1e-4) a += wrapAngle(Math.atan2(dz, dx) - a) * dt * 1.2; }
      if (GF.active && P.down && P.speed > .9) { const d = Math.hypot(f.x - P.x, f.z - P.z); if (d < .35) { f.flee = .5; a = Math.atan2(f.z - P.z, f.x - P.x); } }
      f.a = a;
      const v = f.flee > 0 ? .75 : f.v;
      f.flee = Math.max(0, f.flee - dt);
      f.x = clamp(f.x + Math.cos(a) * v * dt, -IN.x, IN.x); f.z = clamp(f.z + Math.sin(a) * v * dt, -IN.z, IN.z);
      f.m.position.set(f.x, f.y + Math.sin(f.t * 1.7) * .01, f.z);
      f.m.rotation.set(0, -a, 0);
      f.m.userData.tail.rotation.y = Math.sin(f.t * (6 + v * 14)) * (.35 + v * .4);
    }
    for (const b of inBowl) { b.a += dt * 1.6; b.m.position.set(Math.cos(b.a) * b.r, .045, Math.sin(b.a) * b.r); b.m.rotation.y = -b.a - Math.PI / 2; b.m.userData.tail.rotation.y = Math.sin(G.time * 9 + b.a) * .4; }
    for (let i = ripples.length - 1; i >= 0; i--) { const R = ripples[i]; R.t += dt; R.r.scale.setScalar(1 + R.t * 6 * R.s); R.r.material.opacity = .5 * (1 - R.t / .9); if (R.t > .9) { R.r.parent.remove(R.r); R.r.geometry.dispose(); R.r.material.dispose(); ripples.splice(i, 1); } }
    if (!GF.active) return;
    // the poi
    const k = damp(18, dt), px = P.x, pz = P.z;
    P.x = lerp(P.x, P.tx, k); P.z = lerp(P.z, P.tz, k);
    P.speed = Math.hypot(P.x - px, P.z - pz) / Math.max(dt, 1e-3);
    P.depth = lerp(P.depth, P.down && !GF.torn ? 1 : 0, damp(12, dt));
    poi.position.set(P.x, lerp(.62, .2, P.depth), P.z);
    poi.rotation.x = lerp(-.25, 0, P.depth); poi.rotation.z = lerp(.18, 0, P.depth);
    if (P.down && !GF.torn) {
      // soaking, and sweeping the wet paper through the water
      GF.strength -= dt * .045 + P.speed * dt * .05;
      if (P.speed > .6 && Math.random() < dt * 8) ripple(P.x, P.z, .6);
      if (GF.strength <= 0) tear([]);
      else if (Math.random() < dt * 4) drawPaper();
    }
  };
  GF.poiScreen = () => toScreen(TUB.x + P.x, .47, TUB.z + P.z);
  return GF;
}

// camera looking down into the tub, framed so the whole tub fits on any screen
export function tubShot() {
  const asp = innerWidth / innerHeight, t = Math.tan(THREE.MathUtils.degToRad(20));
  // the stall's awning covers the tub, so the camera has to look in from the front at this angle;
  // on a portrait phone it stops short of fitting the whole tub rather than backing off past the
  // foreground lanterns
  const need = (TUB.w + .3) / 2, dist = clamp(need / (t * asp), 2.6, 7.2);
  const dir = new V3(0, 1.15, 1).normalize();
  const look = new V3(TUB.x, TUB.water + .07, TUB.z - .05);
  return [look.clone().addScaledVector(dir, dist), look];
}

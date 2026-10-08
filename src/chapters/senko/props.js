// The last night's set: a candle, the kayari-buta (the clay pig that holds a mosquito coil),
// a bucket of water for spent sparklers, an uchiwa, the packet of senkō hanabi, moonlight,
// and the apartment behind the balcony (only ever seen from the city side).
import { THREE, V3, mesh, group, box, rbox, cyl, sph, toon, canvasTex, MAT, dotTex, camera } from '../../core/gfx.js';
import { Particles } from '../../core/fx.js';
import { rand, clamp } from '../../core/util.js';
import { world } from '../../core/world.js';

export const LAYOUT = {
  z: -.92,                                        // the four perch here at the edge, facing the city
  seat: { h3: -2.6, h1: -1.25, clawd: .75, h2: 2.25 },
  candle: new V3(-.1, 0, -1.03),
  candlePark: new V3(1.05, 0, -.3),    // moved aside, out of the way, while the sparklers burn
  pig: new V3(-3.75, 0, -.5),
  bucket: new V3(3.05, 0, -.5),
  pack: new V3(2.45, 0, -.12),
};

const add = THREE.AdditiveBlending;
const glowMat = (r, g, b, o = 1) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), transparent: true, opacity: o, blending: add, depthWrite: false, toneMapped: false });

export function buildProps(root) {
  const P = { lit: 0, smokeT: 0, sticks: [] };

  // ── candle in a little brass dish ──
  const c = LAYOUT.candle;
  P.candle = group(root, c.x, 0, c.z);
  mesh(cyl(.11, .09, .025, 20), toon(0xb08a4a), 0, .0125, 0, P.candle);
  P.wax = mesh(cyl(.034, .036, .16, 14), toon(0xf4ecd8, { emissive: 0xffa050, emissiveIntensity: 0 }), 0, .105, 0, P.candle);
  mesh(cyl(.004, .004, .03, 4), MAT.dark, 0, .2, 0, P.candle, false);
  P.flame = group(P.candle, 0, .222, 0);
  P.flameOuter = mesh(sph(1, 12, 10), glowMat(1.15, .5, .14, .85), 0, .02, 0, P.flame, false);
  P.flameCore = mesh(sph(1, 10, 8), glowMat(1.5, 1.2, .75, 1), 0, .008, 0, P.flame, false);
  P.flameHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xffb060, transparent: true, opacity: .6, blending: add, depthWrite: false, toneMapped: false }));
  P.flameHalo.scale.setScalar(.18); P.flameHalo.position.y = .02; P.flame.add(P.flameHalo);
  P.candleLight = new THREE.PointLight(0xffb070, 0, 2.8, 1.4); P.candleLight.position.set(0, .26, 0); P.candle.add(P.candleLight);
  P.flame.visible = false;
  P.wickWorld = new V3(c.x, .245, c.z);

  // a match, for lighting the candle
  P.match = group(root, 0, 0, 0); P.match.visible = false;
  mesh(cyl(.006, .006, .12, 4), toon(0xe8d2a0), 0, -.06, 0, P.match, false);
  mesh(sph(.012, 8, 6), toon(0xc8343c), 0, 0, 0, P.match, false);
  P.matchFlame = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xffa040, transparent: true, opacity: .95, blending: add, depthWrite: false, toneMapped: false }));
  P.matchFlame.scale.setScalar(.12); P.matchFlame.position.y = .02; P.match.add(P.matchFlame);

  // ── kayari-buta: a terracotta pig with a smouldering coil inside ──
  P.pig = group(root, LAYOUT.pig.x, 0, LAYOUT.pig.z); P.pig.rotation.y = -2.53;   // snout toward the balcony
  const glaze = toon(0x9a5236), dark = toon(0x2a1a14);
  const body = mesh(sph(1, 22, 16), glaze, 0, .17, 0, P.pig); body.scale.set(.15, .14, .2);
  const snout = mesh(cyl(.088, .1, .06, 20), glaze, 0, .17, -.19, P.pig); snout.rotation.x = Math.PI / 2;
  const mouth = mesh(new THREE.CircleGeometry(.074, 20), dark, 0, .17, -.221, P.pig, false); mouth.rotation.y = Math.PI;
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(.04, .07, 8), glaze, s * .075, .295, -.07, P.pig); ear.rotation.z = -s * .35;
    mesh(sph(.012, 8, 6), dark, s * .062, .225, -.16, P.pig, false);
    for (const z of [-.1, .1]) mesh(cyl(.028, .03, .05, 8), glaze, s * .08, .025, z, P.pig);
  }
  // white brushed swirl on the side
  const swirl = canvasTex(128, 64, x => { x.strokeStyle = '#f3ead8'; x.lineWidth = 6; x.beginPath(); for (let i = 0; i < 60; i++) { const a = i * .3, r = 4 + i * .4; x.lineTo(64 + Math.cos(a) * r, 32 + Math.sin(a) * r * .6); } x.stroke(); });
  const deco = mesh(new THREE.SphereGeometry(1.004, 22, 16, Math.PI * .1, Math.PI * .5, Math.PI * .3, Math.PI * .35), new THREE.MeshToonMaterial({ map: swirl, transparent: true }), 0, .17, 0, P.pig, false);
  deco.scale.set(.15, .14, .2);
  P.coil = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xff6a30, transparent: true, opacity: .8, blending: add, depthWrite: false, toneMapped: false }));
  P.coil.scale.setScalar(.06); P.coil.position.set(0, .16, -.2); P.pig.add(P.coil);
  P.pig.updateMatrixWorld(true);
  P.snoutWorld = P.pig.localToWorld(new V3(0, .2, -.23));
  P.pigSmoke = new Particles({ parent: root, max: 220, size: .11, additive: true, gravity: .3, drag: 1.2, opacity: .22 });

  // ── the bucket of water ──
  P.bucket = group(root, LAYOUT.bucket.x, 0, LAYOUT.bucket.z);
  const zinc = toon(0xa3acb6, { side: THREE.DoubleSide });
  mesh(new THREE.CylinderGeometry(.2, .16, .27, 24, 1, true), zinc, 0, .135, 0, P.bucket);
  mesh(cyl(.16, .16, .01, 24), zinc, 0, .005, 0, P.bucket);
  const rim = mesh(new THREE.TorusGeometry(.2, .012, 6, 28), zinc, 0, .27, 0, P.bucket); rim.rotation.x = Math.PI / 2;
  const handle = mesh(new THREE.TorusGeometry(.2, .007, 4, 24, Math.PI), MAT.metal, 0, .27, 0, P.bucket, false); handle.rotation.y = .4;
  P.water = mesh(new THREE.CircleGeometry(.19, 28), new THREE.MeshStandardMaterial({ color: 0x1b2a40, roughness: .08, metalness: .3 }), 0, .21, 0, P.bucket, false);
  P.water.rotation.x = -Math.PI / 2;
  P.steam = new Particles({ parent: root, max: 120, size: .16, additive: true, gravity: .5, drag: 1.5, opacity: .25 });

  // ── an uchiwa with a goldfish ──
  const fanTex = canvasTex(128, 128, x => {
    x.fillStyle = '#f6f1e4'; x.beginPath(); x.arc(64, 64, 62, 0, 7); x.fill();
    x.strokeStyle = 'rgba(120,150,190,.35)'; x.lineWidth = 2;
    for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(40 + i * 20, 92 - i * 6, 12 + i * 4, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); }
    x.fillStyle = '#e8483c'; x.beginPath(); x.ellipse(70, 56, 22, 13, -.4, 0, 7); x.fill();
    x.beginPath(); x.moveTo(50, 66); x.quadraticCurveTo(26, 64, 30, 88); x.quadraticCurveTo(44, 76, 52, 74); x.fill();
    x.fillStyle = '#141414'; x.beginPath(); x.arc(84, 50, 2.5, 0, 7); x.fill();
  });
  const fan = group(root, 1.55, .012, -.2); fan.rotation.set(-Math.PI / 2, 0, .7);
  mesh(new THREE.CircleGeometry(.17, 30), new THREE.MeshToonMaterial({ map: fanTex, side: THREE.DoubleSide }), 0, .06, 0, fan, false);
  mesh(box(.03, .2, .012), toon(0xc8a46a), 0, -.18, 0, fan, false);

  // ── the packet of senkō hanabi, a few left over ──
  const packTex = canvasTex(128, 192, x => {
    x.fillStyle = '#f3ead6'; x.fillRect(0, 0, 128, 192);
    x.fillStyle = '#c8343c'; x.fillRect(0, 0, 128, 26); x.fillRect(0, 170, 128, 22);
    x.fillStyle = '#1f2f58'; x.font = '600 30px "Klee One", serif'; x.textAlign = 'center';
    ['線', '香', '花', '火'].forEach((ch, i) => x.fillText(ch, 64, 62 + i * 30));
    x.fillStyle = '#e8a33a'; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; x.fillRect(100 + Math.cos(a) * 12, 150 + Math.sin(a) * 12, 3, 3); }
  });
  const pack = group(root, LAYOUT.pack.x, .006, LAYOUT.pack.z); pack.rotation.y = -.35;
  const env = mesh(new THREE.PlaneGeometry(.22, .33), new THREE.MeshToonMaterial({ map: packTex }), 0, 0, 0, pack, false); env.rotation.x = -Math.PI / 2;
  const cols = [0xf29ab8, 0xb48be0, 0xf2c14e, 0x9fd0ee];
  for (let i = 0; i < 5; i++) {
    const s = mesh(cyl(.005, .005, .42, 5), toon(cols[i % 4]), -.02 + i * .012, .008, -.28, pack, false);
    s.rotation.x = Math.PI / 2; s.rotation.z = (i - 2) * .06;
  }

  // ── moonlight: a cool rim from the moon's side ──
  P.moon = new THREE.DirectionalLight(0x9fb2ff, .45);
  P.moon.position.set(-10, 10, -20); P.moon.target.position.set(0, 0, 0);
  root.add(P.moon, P.moon.target);

  // ── the apartment behind the balcony ──
  P.backdrop = group(root, 0, 0, 3.4);
  const wall = mesh(new THREE.PlaneGeometry(30, 12), toon(0x2b2430), 0, 3, 0, P.backdrop, false); wall.rotation.y = Math.PI;
  const doorTex = canvasTex(256, 256, x => {
    const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#ffcf8a'); gr.addColorStop(1, '#f0994e');
    x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
    x.fillStyle = 'rgba(120,60,20,.25)';
    x.beginPath(); x.ellipse(96, 54, 30, 16, 0, 0, 7); x.fill();           // a pendant lamp
    x.fillRect(94, 0, 4, 40);
    x.fillRect(150, 150, 70, 8); x.fillRect(160, 120, 12, 30); x.fillRect(190, 112, 18, 38);   // a shelf with things
    x.beginPath(); x.ellipse(40, 190, 26, 40, 0, 0, 7); x.fill();         // a plant
  });
  const door = mesh(new THREE.PlaneGeometry(5.6, 3.2), new THREE.MeshBasicMaterial({ map: doorTex, color: 0x9a8a78 }), 0, .2, -.02, P.backdrop, false); door.rotation.y = Math.PI;
  const frame = toon(0x1c1714);
  for (const x of [-2.8, 0, 2.8]) mesh(box(.09, 3.3, .08), frame, x, .2, -.05, P.backdrop, false);
  for (const y of [-1.4, 1.8]) mesh(box(5.8, .09, .08), frame, 0, y, -.05, P.backdrop, false);
  const sudareTex = canvasTex(64, 256, x => {
    x.clearRect(0, 0, 64, 256);
    for (let y = 0; y < 256; y += 3) { x.fillStyle = y % 6 ? 'rgba(70,46,24,.95)' : 'rgba(96,66,36,.92)'; x.fillRect(0, y, 64, 2); }
    x.fillStyle = 'rgba(40,26,14,1)'; x.fillRect(14, 0, 2, 256); x.fillRect(48, 0, 2, 256);
  });
  sudareTex.wrapS = THREE.RepeatWrapping; sudareTex.repeat.set(8, 1);
  const sudare = mesh(new THREE.PlaneGeometry(6.0, 2.3), new THREE.MeshBasicMaterial({ map: sudareTex, transparent: true }), 0, .95, -.1, P.backdrop, false); sudare.rotation.y = Math.PI;
  const win = mesh(new THREE.PlaneGeometry(1.7, 1.1), new THREE.MeshBasicMaterial({ map: doorTex, color: 0x7a6a5a }), 6.2, 1.0, -.02, P.backdrop, false); win.rotation.y = Math.PI;
  P.backdrop.visible = false;

  return P;
}

// spent sparkler sticks that end up standing in the bucket
export function addStick(P, colorHex) {
  const s = mesh(cyl(.005, .005, .32, 5), toon(colorHex), 0, 0, 0, P.bucket, false);
  s.position.set(rand(-.08, .08), .3, rand(-.08, .08));
  s.rotation.set(rand(-.35, .35), 0, rand(-.35, .35));
  P.sticks.push(s);
  return s;
}

export function updateProps(P, dt, t) {
  const lit = P.lit;
  P.flame.visible = lit > .01;
  if (P.flame.visible) {
    const fl = 1 + Math.sin(t * 23) * .06 + Math.sin(t * 37 + 1) * .05 + (Math.random() - .5) * .08;
    P.flame.scale.setScalar(lit);
    P.flameOuter.scale.set(.017 * fl, .042 * fl * (1 + .1 * Math.sin(t * 9)), .017 * fl);
    P.flameCore.scale.set(.007, .019 * fl, .007);
    P.flame.rotation.z = Math.sin(t * 1.3) * .1 * world.wind + Math.sin(t * 7) * .03;
    P.flameHalo.material.opacity = .32 * lit * fl;
    P.candleLight.intensity = .24 * lit * fl;
    P.wax.material.emissiveIntensity = .25 * lit;
  } else { P.candleLight.intensity = 0; P.wax.material.emissiveIntensity = 0; }
  // the coil's thin curl of smoke, leaning with the breeze
  P.smokeT -= dt;
  if (dt > 0 && P.smokeT <= 0) {
    P.smokeT = .08; const s = P.snoutWorld;
    P.pigSmoke.emit(s.x, s.y, s.z - .02, Math.sin(t * 1.7) * .05 + (world.wind - .5) * .1, .2, Math.cos(t * 1.3) * .04 - .02, rand(2.4, 3.2), .45, .44, .5);
  }
  P.coil.material.opacity = .55 + .3 * Math.sin(t * 2.1) * Math.sin(t * 3.7);
  // the apartment wall is behind the default camera: only show it from the city side
  P.backdrop.visible = camera.position.z < -.5;
}

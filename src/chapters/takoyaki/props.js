// Takoyaki props: the stove and pan (the star), batter, octopus, toppings, boat plates,
// dressings, the janome umbrella, and the rope basket to 3F. Everything is procedural.
import { THREE, V3, mesh, group, box, rbox, cyl, sph, toon, canvasTex, MAT, gradTex } from '../../core/gfx.js';
import { rand } from '../../core/util.js';

export const PAN_X = .3, PAN_Z = -.35, CUP_Y = .40, R = .155;
export const CUP_OFF = [-.6, -.2, .2, .6];
export const BOAT_X = [4.3, 5.35], BOAT_Z = -.35;
export const BASKET_X = 7.65, BASKET_Z = -.4;
export const BOAT_SLOTS = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) BOAT_SLOTS.push(new V3(-.33 + c * .22, .03 + R * .92, -.09 + r * .18));

// ── ball material: browning is painted per face from six "cook" values per instance ──
const LIN = h => new THREE.Color(h);
export function ballMaterial() {
  const m = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradTex });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, {
      uRaw: { value: LIN('#f4e6b8') }, uSet: { value: LIN('#efd391') }, uGold: { value: LIN('#d99843') },
      uBrown: { value: LIN('#9c5a26') }, uBurnt: { value: LIN('#3e2416') }, uSauce: { value: LIN('#5b2a12') },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aCookP; attribute vec3 aCookN; attribute float aSauce;
        varying vec3 vLocalN; varying vec3 vCP; varying vec3 vCN; varying float vSauce;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vLocalN = objectNormal; vCP = aCookP; vCN = aCookN; vSauce = aSauce;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uRaw, uSet, uGold, uBrown, uBurnt, uSauce;
        varying vec3 vLocalN; varying vec3 vCP; varying vec3 vCN; varying float vSauce;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec3 n = normalize(vLocalN);
          vec3 wp = max(n, 0.0); vec3 wn = max(-n, 0.0); wp *= wp; wn *= wn;
          float ws = wp.x + wp.y + wp.z + wn.x + wn.y + wn.z + 1e-4;
          float b = (dot(wp, vCP) + dot(wn, vCN)) / ws;
          vec3 c = mix(uRaw, uSet, smoothstep(0.0, 0.4, b));
          c = mix(c, uGold, smoothstep(0.4, 0.85, b));
          c = mix(c, uBrown, smoothstep(1.05, 1.45, b));
          c = mix(c, uBurnt, smoothstep(1.5, 2.1, b));
          vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
          float top = smoothstep(-0.2, 0.5, dot(normal, upV));
          c = mix(c, uSauce, vSauce * top * 0.92);
          c += vSauce * top * 0.25 * pow(max(dot(normal, normalize(vec3(0.35, 0.7, 0.6))), 0.0), 18.0);
          diffuseColor.rgb = c;
        }`);
  };
  m.customProgramCacheKey = () => 'takoyaki-ball';
  return m;
}

export function buildBalls(root) {
  const geo = new THREE.SphereGeometry(R, 22, 16);
  const n = 16;
  const cookP = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const cookN = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
  const sauce = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
  geo.setAttribute('aCookP', cookP); geo.setAttribute('aCookN', cookN); geo.setAttribute('aSauce', sauce);
  const im = new THREE.InstancedMesh(geo, ballMaterial(), n);
  im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
  root.add(im);
  return { im, cookP, cookN, sauce };
}

// ── stove + pan ──
export function buildStove(root) {
  const P = {};
  const cream = toon(0xefe8da), dark = toon(0x2c2b31);
  const stove = group(root, PAN_X, 0, PAN_Z);
  mesh(rbox(1.25, .24, .92, .05), cream, 0, .12, 0, stove);
  mesh(rbox(1.1, .02, .78, .01), dark, 0, .245, 0, stove, false);
  // canister door + knob on the front
  mesh(rbox(.42, .14, .02, .01), toon(0xd9d0bf), -.3, .12, .465, stove, false);
  P.knob = mesh(cyl(.06, .06, .06, 14), MAT.red, .4, .13, .48, stove); P.knob.rotation.x = Math.PI / 2;
  // pan supports
  for (const [x, z] of [[-.38, -.25], [.38, -.25], [-.38, .25], [.38, .25]]) mesh(box(.05, .07, .05), dark, x, .28, z, stove, false);
  // blue flame ring under the pan
  P.flame = new THREE.Mesh(new THREE.TorusGeometry(.36, .035, 6, 32), new THREE.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  P.flame.rotation.x = Math.PI / 2; P.flame.position.set(PAN_X, .29, PAN_Z); root.add(P.flame);
  P.flameInner = new THREE.Mesh(new THREE.TorusGeometry(.2, .025, 6, 24), P.flame.material);
  P.flameInner.rotation.x = Math.PI / 2; P.flameInner.position.set(PAN_X, .292, PAN_Z); root.add(P.flameInner);

  // the cast-iron plate
  const iron = toon(0x2a292e);
  mesh(rbox(1.72, .09, 1.72, .03), iron, PAN_X, .355, PAN_Z, root);
  for (const s of [-1, 1]) {
    mesh(box(.22, .05, .1), iron, PAN_X + s * .96, .37, PAN_Z, root);
    mesh(rbox(.3, .07, .11, .03), MAT.woodDark, PAN_X + s * 1.2, .37, PAN_Z, root);
  }
  const W = 512, toPx = v => (v + .86) / 1.72 * W;
  const panTex = canvasTex(W, W, x => {
    x.fillStyle = '#2b2a2f'; x.fillRect(0, 0, W, W);
    for (let i = 0; i < 1600; i++) { x.fillStyle = Math.random() < .5 ? 'rgba(255,255,255,.035)' : 'rgba(0,0,0,.08)'; x.fillRect(Math.random() * W, Math.random() * W, 2, 2); }
    for (const a of CUP_OFF) for (const b of CUP_OFF) {
      const cx = toPx(a), cy = toPx(b), r = .17 / 1.72 * W;
      const g = x.createRadialGradient(cx - r * .25, cy - r * .25, r * .1, cx, cy, r);
      g.addColorStop(0, '#0f0e11'); g.addColorStop(.75, '#1d1c21'); g.addColorStop(1, '#3a3940');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.09)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cy, r + 2, Math.PI * 1.1, Math.PI * 1.7); x.stroke();
    }
  });
  const top = mesh(new THREE.PlaneGeometry(1.72, 1.72), toon(0xffffff, { map: panTex }), PAN_X, .401, PAN_Z, root, false);
  top.rotation.x = -Math.PI / 2; top.receiveShadow = true;

  // batter that floods the plate and gets tucked in as balls are turned
  const spillTex = canvasTex(W, W, x => {
    x.clearRect(0, 0, W, W);
    x.fillStyle = '#f4e4b4';
    x.beginPath();
    for (let a = 0; a <= Math.PI * 2 + .01; a += .05) { const rr = W * .47 + Math.sin(a * 7) * 8 + Math.sin(a * 13) * 5; x.lineTo(W / 2 + Math.cos(a) * rr, W / 2 + Math.sin(a) * rr); }
    x.fill();
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(214,160,80,${rand(.08, .3)})`; x.beginPath(); x.arc(Math.random() * W, Math.random() * W, rand(2, 7), 0, 7); x.fill(); }
  });
  P.spillMat = toon(0xffffff, { map: spillTex, transparent: true, opacity: 0, depthWrite: false });
  P.spill = mesh(new THREE.PlaneGeometry(1.7, 1.7), P.spillMat, PAN_X, .404, PAN_Z, root, false);
  P.spill.rotation.x = -Math.PI / 2;

  // octopus pieces poking out of the batter
  const takoGeo = new THREE.SphereGeometry(.05, 10, 8); takoGeo.scale(1.1, .75, .9);
  P.tako = new THREE.InstancedMesh(takoGeo, toon(0xb83f57), 16); P.tako.frustumCulled = false; root.add(P.tako);

  // status rings around each cup
  const ringGeo = new THREE.RingGeometry(.18, .205, 32); ringGeo.rotateX(-Math.PI / 2);
  P.rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, depthWrite: false, toneMapped: false }), 16);
  P.rings.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(16 * 3), 3);
  P.rings.frustumCulled = false; P.rings.renderOrder = 3; root.add(P.rings);
  const hov = new THREE.RingGeometry(.23, .26, 32); hov.rotateX(-Math.PI / 2);
  P.hover = mesh(hov, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, depthWrite: false, toneMapped: false }), 0, CUP_Y + .015, 0, root, false);
  P.hover.visible = false; P.hover.renderOrder = 4;

  // pitcher, hovering over the pan while pouring
  P.pitcher = group(root, PAN_X, 1.1, PAN_Z); P.pitcher.visible = false;
  mesh(cyl(.13, .15, .3, 18), toon(0xf6f3ee), 0, 0, 0, P.pitcher);
  mesh(cyl(.125, .125, .01, 18), toon(0xf1dca2), 0, .14, 0, P.pitcher, false);
  mesh(new THREE.ConeGeometry(.05, .12, 8), toon(0xf6f3ee), .16, .1, 0, P.pitcher).rotation.z = -1.2;
  mesh(new THREE.TorusGeometry(.08, .018, 6, 12, Math.PI), toon(0xf6f3ee), -.16, 0, 0, P.pitcher).rotation.z = Math.PI / 2;
  P.stream = mesh(cyl(.028, .022, 1, 8), toon(0xf1dca2), 0, 0, 0, root, false); P.stream.visible = false;

  // toppings that land on the batter
  P.sprinkleGeo = new THREE.BufferGeometry();
  const N = 220, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    pos.set([PAN_X + rand(-.78, .78), CUP_Y + .012, PAN_Z + rand(-.78, .78)], i * 3);
    const k = i % 5; const c = k < 2 ? [1, .93, .75] : k < 3 ? [.95, .25, .3] : [.35, .75, .3];
    col.set(c, i * 3);
  }
  P.sprinkleGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  P.sprinkleGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  P.sprinkleGeo.setDrawRange(0, 0);
  P.sprinkles = new THREE.Points(P.sprinkleGeo, new THREE.PointsMaterial({ size: .035, vertexColors: true, transparent: true, depthWrite: false }));
  root.add(P.sprinkles);
  return P;
}

// ── batter bowl, octopus bowl, toppings ──
export function buildPrep(root) {
  const P = {};
  const bowlProf = [[0, 0], [.2, 0], [.3, .05], [.36, .18], [.38, .27], [.36, .27], [.33, .19], [.27, .07], [0, .05]].map(([a, b]) => new THREE.Vector2(a, b));
  const ceramic = toon(0xf4f1ec), blue = toon(0x3d6fb6);
  const bb = group(root, -4.5, 0, -.4);
  mesh(new THREE.LatheGeometry(bowlProf, 28), ceramic, 0, 0, 0, bb);
  mesh(new THREE.TorusGeometry(.37, .012, 6, 28), blue, 0, .265, 0, bb, false).rotation.x = Math.PI / 2;
  P.batterTex = canvasTex(256, 256);
  P.batterDisc = mesh(new THREE.CircleGeometry(.33, 28), toon(0xffffff, { map: P.batterTex }), 0, .2, 0, bb, false);
  P.batterDisc.rotation.x = -Math.PI / 2;
  // whisk: loops of wire on a handle
  P.whisk = group(bb, .1, .42, 0); P.whisk.rotation.z = .5;
  const wire = toon(0xc9ccd2);
  for (let i = 0; i < 4; i++) { const t = mesh(new THREE.TorusGeometry(.07, .006, 4, 16), wire, 0, -.08, 0, P.whisk, false); t.scale.y = 2; t.rotation.y = i * Math.PI / 4; }
  mesh(cyl(.016, .016, .22, 8), toon(0x9a6a40), 0, .1, 0, P.whisk);
  P.bowl = bb;
  // a pitcher waiting beside the bowl
  P.jug = group(root, -3.95, 0, -.75);
  mesh(cyl(.12, .14, .28, 16), ceramic, 0, .14, 0, P.jug);
  P.jugFill = mesh(cyl(.115, .115, .01, 16), toon(0xf1dca2), 0, .25, 0, P.jug, false); P.jugFill.visible = false;

  // octopus bowl
  const ob = group(root, -2.2, 0, -.45);
  mesh(new THREE.LatheGeometry(bowlProf.map(v => v.clone().multiplyScalar(.62)), 24), toon(0xe9f1f8), 0, 0, 0, ob);
  mesh(new THREE.TorusGeometry(.23, .008, 6, 24), toon(0x2f6fd0), 0, .165, 0, ob, false).rotation.x = Math.PI / 2;
  P.takoPile = [];
  const takoMat = toon(0xb83f57);
  for (let i = 0; i < 9; i++) { const m = mesh(sph(.045, 8, 6), takoMat, rand(-.12, .12), .11 + rand(0, .05), rand(-.12, .12), ob, false); m.scale.set(1.2, .7, .9); P.takoPile.push(m); }
  // toppings tray: tenkasu, beni-shōga, green onion
  const tray = group(root, -2.95, 0, -.55);
  mesh(rbox(.62, .04, .3, .02), toon(0x8a5a36), 0, .02, 0, tray);
  [[-.2, 0xfff1c9], [0, 0xe8484f], [.2, 0x5fae4a]].forEach(([x, c]) => {
    mesh(cyl(.085, .06, .05, 14), ceramic, x, .065, 0, tray);
    for (let k = 0; k < 6; k++) mesh(sph(.022, 6, 4), toon(c), x + rand(-.04, .04), .095, rand(-.04, .04), tray, false);
  });
  return P;
}
export function drawBatter(tex, mix) {
  const { x } = tex.userData;
  x.fillStyle = '#f2dea6'; x.fillRect(0, 0, 256, 256);
  // flour lumps fade as it's whisked smooth
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,255,255,${(1 - mix) * .8})`; const r = 4 + (i % 5) * 2; x.beginPath(); x.arc((i * 73) % 256, (i * 151) % 256, r, 0, 7); x.fill(); }
  x.strokeStyle = `rgba(214,170,90,${.15 + mix * .35})`; x.lineWidth = 3;
  for (let k = 0; k < 4; k++) { x.beginPath(); x.arc(128, 128, 30 + k * 22, k, k + 4.2); x.stroke(); }
  tex.needsUpdate = true;
}

// ── boat plates (舟皿) with their dressings ──
export function buildBoats(root) {
  const wood = toon(0xdcb47a), woodEdge = toon(0xa9773f);
  return BOAT_X.map(bx => {
    const g = group(root, bx, 0, BOAT_Z);
    mesh(box(.95, .02, .4), wood, 0, .02, 0, g);
    for (const s of [-1, 1]) mesh(box(.95, .09, .025), woodEdge, 0, .065, s * .2, g);
    for (const s of [-1, 1]) { const e = mesh(box(.025, .09, .425), woodEdge, s * .5, .07, 0, g); e.rotation.z = s * -.5; }
    // a sheet of paper under the takoyaki
    mesh(box(.8, .004, .34), toon(0xf7f3ea), 0, .032, 0, g, false);
    // aonori: green specks on top of the balls
    const ag = new THREE.BufferGeometry(), N = 110, ap = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const s = BOAT_SLOTS[i % 8]; const a = rand(0, Math.PI * 2), r = Math.sqrt(Math.random()) * R * .8; ap.set([s.x + Math.cos(a) * r, s.y + Math.sqrt(Math.max(0, R * R - r * r)) * .95 + .004, s.z + Math.sin(a) * r], i * 3); }
    ag.setAttribute('position', new THREE.BufferAttribute(ap, 3)); ag.setDrawRange(0, 0);
    const aonori = new THREE.Points(ag, new THREE.PointsMaterial({ size: .022, color: 0x3d8a2a, transparent: true, depthWrite: false }));
    g.add(aonori);
    // katsuobushi: thin flakes that curl and dance in the heat
    const fg = new THREE.PlaneGeometry(.058, .036, 3, 1);
    const flakes = new THREE.InstancedMesh(fg, toon(0xe8ad8c, { side: THREE.DoubleSide, transparent: true, opacity: .9 }), 48);
    flakes.frustumCulled = false; flakes.count = 0; g.add(flakes);
    const fl = [];
    for (let i = 0; i < 48; i++) { const s = BOAT_SLOTS[i % 8]; fl.push({ x: s.x + rand(-.08, .08), y: s.y + R * .9 + rand(0, .03), z: s.z + rand(-.06, .06), ph: rand(0, 6.28), ry: rand(0, 6.28), sp: rand(5, 9) }); }
    return { g, x: bx, aonori, ag, flakes, fl, mayo: null };
  });
}

// mayo: a white line following a drawn zigzag (points in 0..1 across the boat)
export function mayoLine(boat, pts) {
  if (boat.mayo) { boat.g.remove(boat.mayo); boat.mayo.geometry.dispose(); }
  if (!pts || pts.length < 2) return;
  const yTop = .03 + R * .92 + R * .98;
  const path = pts.map(([u, v]) => new V3((u - .5) * .82, yTop + Math.sin(u * Math.PI * 4) * .006, (v - .5) * .32));
  const curve = new THREE.CatmullRomCurve3(path);
  const geo = new THREE.TubeGeometry(curve, Math.min(220, path.length * 6), .011, 6, false);
  boat.mayo = mesh(geo, toon(0xfffbe6), 0, 0, 0, boat.g, false);
}
export function defaultZigzag() {
  const pts = [];
  for (let i = 0; i <= 9; i++) pts.push([.06 + i * .098, i % 2 ? .82 : .18]);
  return pts;
}

// ── 蛇の目傘: a red oil-paper umbrella with the white ring ──
export function buildUmbrella(root) {
  const P = {};
  const red = toon(0xc8323a);
  P.closed = group(root, 3.0, 0, -.95); P.closed.rotation.z = .22;
  mesh(new THREE.ConeGeometry(.09, 1.25, 12), red, 0, .78, 0, P.closed);
  mesh(cyl(.018, .018, .3, 6), MAT.woodDark, 0, .1, 0, P.closed);
  const tex = canvasTex(512, 64, x => {
    x.fillStyle = '#c8323a'; x.fillRect(0, 0, 512, 64);
    x.fillStyle = '#f6efe2'; x.fillRect(0, 34, 512, 10);
    x.strokeStyle = 'rgba(90,10,20,.45)'; x.lineWidth = 2;
    for (let i = 0; i < 512; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 64); x.stroke(); }
  });
  P.open = group(root, PAN_X, 0, PAN_Z - .55); P.open.visible = false;
  P.pole = mesh(cyl(.02, .02, 2.3, 8), MAT.woodDark, 0, 1.15, 0, P.open);
  mesh(cyl(.17, .2, .22, 14), toon(0x6d7680), 0, .11, 0, P.open);
  P.canopy = group(P.open, 0, 2.28, .5);
  const cone = mesh(new THREE.ConeGeometry(1.3, .42, 32, 1, true), toon(0xffffff, { map: tex, side: THREE.DoubleSide }), 0, 0, 0, P.canopy);
  cone.castShadow = true;
  mesh(cyl(.05, .05, .08, 10), toon(0xf6efe2), 0, .22, 0, P.canopy);
  P.canopy.rotation.x = -.14;
  return P;
}

// ── the basket on a rope from the neighbor upstairs ──
export function buildBasket(root) {
  const P = {};
  const weave = canvasTex(128, 64, x => {
    x.fillStyle = '#a06b34'; x.fillRect(0, 0, 128, 64);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 16; c++) { x.fillStyle = (r + c) % 2 ? '#c48a4a' : '#8a5a2b'; x.fillRect(c * 8, r * 8, 8, 8); }
  });
  const wm = toon(0xffffff, { map: weave });
  P.g = group(root, BASKET_X, 12, BASKET_Z);
  mesh(box(.74, .03, .5), wm, 0, .015, 0, P.g);
  for (const s of [-1, 1]) { mesh(box(.74, .22, .025), wm, 0, .12, s * .24, P.g); mesh(box(.025, .22, .5), wm, s * .36, .12, 0, P.g); }
  const handle = mesh(new THREE.TorusGeometry(.3, .018, 6, 20, Math.PI), wm, 0, .23, 0, P.g); handle.rotation.y = Math.PI / 2;
  P.rope = mesh(cyl(.008, .008, 12, 5), toon(0xd8c9a6), 0, .53 + 6, 0, P.g, false);
  // the neighbor's note
  P.noteTex = canvasTex(256, 128);
  P.note = mesh(new THREE.PlaneGeometry(.3, .15), new THREE.MeshLambertMaterial({ map: P.noteTex, side: THREE.DoubleSide }), -.15, .26, .1, P.g, false);
  P.note.rotation.x = -.9;
  // ramune: aqua glass with the marble in its neck
  const prof = [[0, 0], [.07, 0], [.075, .02], [.075, .17], [.05, .23], [.03, .26], [.034, .3], [.03, .34], [0, .34]].map(([a, b]) => new THREE.Vector2(a, b));
  P.ramune = group(P.g, .18, .03, 0); P.ramune.visible = false;
  mesh(new THREE.LatheGeometry(prof, 18), new THREE.MeshPhysicalMaterial({ color: 0x8fe0e8, transparent: true, opacity: .62, roughness: .05, clearcoat: 1 }), 0, 0, 0, P.ramune, false);
  P.marble = mesh(sph(.024, 10, 8), new THREE.MeshPhysicalMaterial({ color: 0xdff8ff, transparent: true, opacity: .8, roughness: 0 }), 0, .265, 0, P.ramune, false);
  mesh(cyl(.034, .034, .02, 12), toon(0x2f6fd0), 0, .345, 0, P.ramune, false);
  return P;
}
export function drawNote(tex, jp, en) {
  const { x } = tex.userData;
  x.fillStyle = '#fffdf6'; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#d8343c'; x.font = '600 34px "Klee One", serif'; x.textAlign = 'center'; x.fillText(jp, 128, 60);
  x.fillStyle = '#5b6274'; x.font = '20px "Klee One", serif'; x.fillText(en, 128, 100);
  tex.needsUpdate = true;
}

// small things the crew holds or wears
export function pickProp() {
  const g = new THREE.Group();
  const m = mesh(cyl(.007, .007, .34, 5), toon(0xd8b67a), 0, .12, .05, g, false); m.rotation.x = .9;
  return g;
}
export function leafHat() {
  const g = new THREE.Group();
  const leaf = mesh(sph(.55, 14, 8), toon(0x4f9a3c), 0, .12, 0, g); leaf.scale.set(1, .07, .78);
  mesh(cyl(.02, .02, .3, 5), toon(0x3d7a2c), 0, -.02, 0, g, false);
  g.rotation.z = .18;
  return g;
}
export function heldBall() {
  const g = new THREE.Group();
  mesh(sph(R * 1.05, 14, 10), toon(0xb8742c), 0, .04, 0, g, false);
  mesh(sph(R * 1.06, 14, 6, 0, Math.PI * 2, 0, Math.PI * .45), toon(0x5b2a12), 0, .04, 0, g, false);
  mesh(cyl(.006, .006, .3, 5), toon(0xd8b67a), 0, -.12, 0, g, false);
  return g;
}

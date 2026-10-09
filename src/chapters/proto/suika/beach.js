// The beach for the suikawari sketch: sand that keeps footprints, a painted sea whose foam comes
// and goes, a parasol, a towel, a cooler, and the watermelon (it cracks, then falls open).
import { THREE, V3, mesh, group, box, rbox, cyl, sph, toon, canvasTex, MAT } from '../../../core/gfx.js';
import { G } from '../../../core/state.js';
import { rand, clamp, lerp, pick } from '../../../core/util.js';
import { Particles } from '../../../core/fx.js';
import { sky } from '../../../core/sky.js';

export const SHORE = -6;                 // where the sand meets the sea (z)
export const MELON = new V3(0, 0, -1.2); // watermelon on its blue sheet
export const MELON_R = .38;
const PR = { x0: -11, x1: 11, z0: -6.4, z1: 7.2, px: 46 };  // the footprint canvas covers this

export let P = null;   // the set's props (a live binding for importers)

// ── textures ──
function sandTex() {
  // tiles both ways: ripple lines repeat across the width and wrap at the top and bottom
  const t = canvasTex(1024, 1024, (x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 60; i++) {
      const y0 = rand(0, h), k1 = pick([1, 2]), k2 = pick([3, 4, 5]), a1 = rand(4, 10), a2 = rand(1, 3), p1 = rand(0, 6), p2 = rand(0, 6);
      x.strokeStyle = `rgba(140,108,66,${rand(.05, .12)})`; x.lineWidth = rand(2, 5);
      for (const dy of [-h, 0, h]) {
        x.beginPath();
        for (let u = 0; u <= w; u += 8) x.lineTo(u, y0 + dy + Math.sin(u / w * Math.PI * 2 * k1 + p1) * a1 + Math.sin(u / w * Math.PI * 2 * k2 + p2) * a2);
        x.stroke();
      }
    }
    for (let i = 0; i < 9000; i++) {
      x.fillStyle = Math.random() < .55 ? `rgba(120,92,58,${rand(.06, .2)})` : `rgba(255,255,255,${rand(.25, .6)})`;
      x.fillRect(rand(0, w), rand(0, h), rand(1, 2.6), rand(1, 2.6));
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(9, 6);
  return t;
}
function seaTex() {
  const t = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    // soft crest streaks, lighter than the water around them
    for (let i = 0; i < 140; i++) {
      const y = rand(0, h), len = rand(30, 140), x0 = rand(0, w);
      x.strokeStyle = `rgba(${pick(['200,240,255', '255,255,255', '120,170,200'])},${rand(.15, .45)})`; x.lineWidth = rand(1.5, 4);
      for (const dx of [-w, 0, w]) { x.beginPath(); x.moveTo(x0 + dx, y); x.quadraticCurveTo(x0 + dx + len / 2, y - rand(1, 4), x0 + dx + len, y); x.stroke(); }
    }
    x.fillStyle = 'rgba(60,110,150,.12)';
    for (let i = 0; i < 40; i++) x.fillRect(rand(0, w), rand(0, h), rand(40, 160), rand(3, 8));
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(22, 10);
  return t;
}
function foamTex() {
  const t = canvasTex(1024, 128, (x, w, h) => {
    x.clearRect(0, 0, w, h);
    // a lacy band: the top of the canvas lies toward the sea. Solid along the wavy leading edge
    // (toward the sand), breaking into holes and fading out behind it
    x.fillStyle = 'rgba(255,255,255,.95)';
    x.beginPath(); x.moveTo(0, 0);
    for (let u = 0; u <= w; u += 8) x.lineTo(u, h * .56 + Math.sin(u / w * Math.PI * 2 * 7) * 9 + Math.sin(u / w * Math.PI * 2 * 17 + 1) * 5);
    x.lineTo(w, 0); x.closePath(); x.fill();
    x.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 260; i++) { x.beginPath(); x.ellipse(rand(0, w), rand(0, h * .42), rand(4, 16), rand(2, 7), 0, 0, Math.PI * 2); x.fillStyle = `rgba(0,0,0,${rand(.5, 1)})`; x.fill(); }
    const g = x.createLinearGradient(0, h * .45, 0, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.92)');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.globalCompositeOperation = 'source-over';
  });
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(6, 1);
  return t;
}
// watermelon rind: jagged dark stripes over light green. u = .25 faces the camera.
function rindDraw(x, w, h) {
  x.fillStyle = '#86c45a'; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(${pick(['60,110,40', '170,220,120'])},${rand(.08, .2)})`; x.fillRect(rand(0, w), rand(0, h), rand(2, 8), rand(2, 8)); }
  x.fillStyle = '#245a26';
  const n = 16;
  for (let s = 0; s < n; s++) {
    const u0 = (s + .5) / n * w, wd = w / n * .42;
    for (const dx of [0, -w, w]) {
      x.beginPath();
      for (let v = 0; v <= h; v += 4) x.lineTo(u0 + dx - wd / 2 + Math.sin(v * .19 + s) * 5 + rand(-2.5, 2.5), v);
      for (let v = h; v >= 0; v -= 4) x.lineTo(u0 + dx + wd / 2 + Math.sin(v * .23 + s * 2) * 5 + rand(-2.5, 2.5), v);
      x.closePath(); x.fill();
    }
  }
  // the pale ground spot where it lay in the field
  x.fillStyle = 'rgba(240,230,150,.55)'; x.beginPath(); x.ellipse(w * .75, h * .93, 50, 14, 0, 0, Math.PI * 2); x.fill();
}
// the cut face: red flesh with a ring of black seeds, then the white and green rind
function fleshTex() {
  return canvasTex(256, 256, (x, w, h) => {
    const c = w / 2;
    x.fillStyle = '#2f6a2c'; x.beginPath(); x.arc(c, c, c, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#eef3cf'; x.beginPath(); x.arc(c, c, c * .93, 0, Math.PI * 2); x.fill();
    const g = x.createRadialGradient(c, c, 0, c, c, c * .86); g.addColorStop(0, '#f2445a'); g.addColorStop(.8, '#e8384c'); g.addColorStop(1, '#f58a8a');
    x.fillStyle = g; x.beginPath(); x.arc(c, c, c * .86, 0, Math.PI * 2); x.fill();
    for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,${rand(150, 210)},${rand(170, 210)},${rand(.08, .2)})`; const a = rand(0, Math.PI * 2), r = rand(0, c * .8); x.fillRect(c + Math.cos(a) * r, c + Math.sin(a) * r, 3, 3); }
    x.fillStyle = '#1c1414';
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2 + rand(-.1, .1), r = c * rand(.46, .62);
      x.save(); x.translate(c + Math.cos(a) * r, c + Math.sin(a) * r); x.rotate(a + Math.PI / 2);
      x.beginPath(); x.ellipse(0, 0, 4, 7, 0, 0, Math.PI * 2); x.fill(); x.restore();
    }
  });
}
function stripeTex(cols, n = 7) {
  return canvasTex(256, 128, (x, w, h) => { for (let i = 0; i < n; i++) { x.fillStyle = cols[i % cols.length]; x.fillRect(i * w / n, 0, w / n + 1, h); } });
}
function tenuguiTex() {
  return canvasTex(256, 64, (x, w, h) => {
    x.fillStyle = '#26407a'; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 3;
    for (let r = 0; r < 2; r++) for (let i = -1; i < 9; i++) { x.beginPath(); x.arc(i * 32 + (r ? 16 : 0), 22 + r * 26, 12, Math.PI, Math.PI * 2); x.stroke(); }
  });
}

// ── build ──
export function build(root) {
  P = { root };
  const sand = toon(0xe9d0a2, { map: sandTex() });
  // the beach: a big plane that stops at the waterline, plus a dark wet band along it
  const sandM = mesh(new THREE.PlaneGeometry(140, 70), sand, 0, 0, SHORE - .4 + 35, root);
  sandM.rotation.x = -Math.PI / 2; sandM.castShadow = false;
  const wet = canvasTex(16, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(120,88,52,.55)'); g.addColorStop(.6, 'rgba(120,88,52,.18)'); g.addColorStop(1, 'rgba(120,88,52,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  const wetM = mesh(new THREE.PlaneGeometry(140, 2.2), toon(0xffffff, { map: wet, transparent: true, depthWrite: false }), 0, .003, SHORE + .7, root, false);
  wetM.rotation.x = -Math.PI / 2; wetM.receiveShadow = true;

  // the sea: vertex colors from turquoise at the shore to deep blue, crest streaks drifting in
  const sg = new THREE.PlaneGeometry(700, 340, 1, 40); sg.rotateX(-Math.PI / 2);
  const pos = sg.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  const near = new THREE.Color('#6fd8cf'), mid = new THREE.Color('#2fa3cf'), far = new THREE.Color('#2a63ae');
  for (let i = 0; i < pos.count; i++) {
    const d = (170 - pos.getZ(i)) / 340;   // 0 at the shore edge, 1 far out
    c.copy(near).lerp(mid, clamp(d * 22, 0, 1)).lerp(far, clamp((d - .05) * 3, 0, 1));
    cols.set([c.r, c.g, c.b], i * 3);
  }
  sg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  P.seaTex = seaTex();
  P.sea = mesh(sg, toon(0xffffff, { map: P.seaTex, vertexColors: true }), 0, -.08, SHORE + .2 - 170, root, false);
  P.sea.receiveShadow = false; P.sea.userData.noInk = true;

  // foam: two lacy strips that slide up the sand and back, out of step
  const ft = foamTex();
  P.foam = [0, 1].map(i => {
    const t = ft.clone(); t.needsUpdate = true; t.offset.x = i * .37;
    const m = mesh(new THREE.PlaneGeometry(140, 1.3), toon(0xffffff, { map: t, transparent: true, depthWrite: false }), 0, .006 + i * .002, SHORE, root, false);
    m.rotation.x = -Math.PI / 2; m.userData.ph = i * Math.PI; m.receiveShadow = true;
    return m;
  });

  // sun glints on the water
  P.glints = new Particles({ max: 260, size: .3, additive: true, gravity: 0, fog: false, parent: root });

  // far away: a green headland with a lighthouse, an island, a sail
  const hill = toon(0x4f7f58), hillDark = toon(0x3f6a4c);
  [[-112, -190, 46, .34], [-80, -180, 30, .3], [-142, -196, 40, .42]].forEach(([x, z, r, k]) => { const m = mesh(sph(r, 24, 12), x < -120 ? hillDark : hill, x, -3, z, root, false); m.scale.y = k; });
  mesh(cyl(1.1, 1.5, 7, 12), MAT.white, -64, 4.5, -178, root, false);
  mesh(new THREE.ConeGeometry(1.5, 2, 12), MAT.red, -64, 9, -178, root, false);
  { const m = mesh(sph(22, 20, 10), hillDark, 95, -3, -230, root, false); m.scale.y = .22; }
  P.sail = group(root, 34, -.05, -120);
  mesh(box(5, .8, 1.4), MAT.white, 0, 0, 0, P.sail, false);
  { const s = mesh(new THREE.ConeGeometry(2.2, 6.5, 3), toon(0xfff8ee), 0, 3.6, 0, P.sail, false); s.scale.z = .15; }

  // props: parasol, towel, cooler with ramune, bucket and spade, shells
  P.parasol = group(root, 6.6, 0, -2.6);
  { const pole = mesh(cyl(.045, .045, 2.7, 8), MAT.white, 0, 1.35, 0, P.parasol); pole.rotation.z = .12;
    const can = mesh(new THREE.ConeGeometry(1.8, .62, 16, 1, true), toon(0xffffff, { map: stripeTex(['#e84a4a', '#fbf6ee'], 16), side: THREE.DoubleSide }), -.16, 2.62, 0, P.parasol);
    can.rotation.z = .12; mesh(sph(.08, 8, 6), MAT.red, -.2, 2.98, 0, P.parasol); }
  P.towel = mesh(box(2.3, .03, 1.3), toon(0xffffff, { map: stripeTex(['#3d7fd6', '#fbf6ee', '#f2c14e', '#fbf6ee']) }), 5.9, .015, -1.7, root);
  P.towel.rotation.y = .12;
  P.cooler = group(root, 8.1, 0, -.7); P.cooler.rotation.y = -.35;
  mesh(rbox(.95, .6, .62, .06), toon(0x3d8fe3), 0, .3, 0, P.cooler); mesh(rbox(.99, .14, .66, .05), MAT.white, 0, .64, 0, P.cooler);
  mesh(box(.5, .06, .08), MAT.white, 0, .74, 0, P.cooler);
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fe0f0, transparent: true, opacity: .7, roughness: .1 });
  [[7.3, -.1], [7.45, .05]].forEach(([x, z]) => { mesh(cyl(.07, .08, .32, 12), glass, x, .16, z, root); mesh(sph(.045, 8, 6), toon(0xdff6ff), x, .26, z, root); });
  mesh(cyl(.2, .16, .32, 14), MAT.red, -7.4, .16, -2.8, root);
  { const sp = mesh(box(.08, .5, .03), toon(0xf2c14e), -7.05, .22, -2.7, root); sp.rotation.z = .5; }
  for (let i = 0; i < 9; i++) { const m = mesh(sph(.07, 8, 6), toon(pick([0xfff4ea, 0xf7c9c4, 0xf2e2c8])), rand(-9, 9), .02, rand(-5.4, 4.5), root, false); m.scale.set(1, .35, .8); m.rotation.y = rand(0, 3); }

  // where it bumps: things a blindfolded crab can walk into
  P.solids = [{ x: 6.6, z: -2.6, r: .35, what: 'the parasol' }, { x: 8.1, z: -.7, r: .7, what: 'the cooler' }, { x: -7.4, z: -2.8, r: .35, what: 'a bucket' }];

  // the blue sheet and the watermelon
  const tarp = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#4a86d8'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(rand(0, w), 0); x.lineTo(rand(0, w), h); x.stroke(); } x.strokeStyle = '#2f62b0'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6); });
  const tm = mesh(new THREE.PlaneGeometry(1.6, 1.6), toon(0xffffff, { map: tarp }), MELON.x, .008, MELON.z, root, false);
  tm.rotation.x = -Math.PI / 2; tm.rotation.z = .2; tm.receiveShadow = true;
  P.rind = canvasTex(512, 256, rindDraw);
  P.melon = mesh(new THREE.SphereGeometry(MELON_R, 36, 24), toon(0xffffff, { map: P.rind }), MELON.x, MELON_R * .92, MELON.z, root);
  P.melon.scale.y = .92; P.melon.rotation.y = .3;

  // the two halves, hidden until it splits: a dome of rind closed by the cut face
  P.flesh = fleshTex();
  const domeGeo = new THREE.SphereGeometry(MELON_R, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const capGeo = new THREE.CircleGeometry(MELON_R * .995, 32);
  P.halves = [1, -1].map(s => {
    const g = group(root, MELON.x, MELON_R * .92, MELON.z);
    const d = mesh(domeGeo, toon(0xffffff, { map: P.rind }), 0, 0, 0, g);
    const cap = mesh(capGeo, toon(0xffffff, { map: P.flesh }), 0, .001, 0, g); cap.rotation.x = Math.PI / 2;
    d.castShadow = true; g.rotation.z = s * Math.PI / 2; g.visible = false; g.userData.s = s;
    return g;
  });

  // footprints: a canvas over the arena, stamped as anyone walks
  P.prints = canvasTex(Math.round((PR.x1 - PR.x0) * PR.px), Math.round((PR.z1 - PR.z0) * PR.px));
  const pm = mesh(new THREE.PlaneGeometry(PR.x1 - PR.x0, PR.z1 - PR.z0), toon(0xffffff, { map: P.prints, transparent: true, depthWrite: false }), (PR.x0 + PR.x1) / 2, .004, (PR.z0 + PR.z1) / 2, root, false);
  pm.rotation.x = -Math.PI / 2; pm.receiveShadow = true;
  P.printDirty = false; P.printFade = 0; P.printT = 0;

  P.juice = new Particles({ max: 260, size: .09, gravity: -9, drag: .4, floor: () => .02, parent: root });
  P.spit = new Particles({ max: 60, size: .07, gravity: -9, floor: () => .02, parent: root });
  P.dizzy = new Particles({ max: 80, size: .16, additive: true, gravity: 0, drag: .5, parent: root });
  // where the blindfolded one is pointed: a chevron at its feet and a ring where the stick lands
  P.aim = group(root);
  const aimMat = new THREE.MeshBasicMaterial({ color: 0x6b4a2a, transparent: true, opacity: .32, depthWrite: false });
  const chev = new THREE.Shape(); chev.moveTo(0, .5); chev.lineTo(.26, .18); chev.lineTo(.13, .18); chev.lineTo(0, .33); chev.lineTo(-.13, .18); chev.lineTo(-.26, .18); chev.closePath();
  P.aimChev = mesh(new THREE.ShapeGeometry(chev), aimMat, 0, .012, 0, P.aim, false); P.aimChev.rotation.x = -Math.PI / 2;
  P.aimRing = mesh(new THREE.RingGeometry(.16, .22, 24), aimMat, 0, .012, 0, P.aim, false); P.aimRing.rotation.x = -Math.PI / 2;
  P.aim.visible = false; P.aim.traverse(o => o.userData.noInk = true);
  P.tenugui = tenuguiTex();
  P.wood = toon(0xc8935c);
  P.cracks = 0;
  return P;
}

// ── footprints ──
// crab tracks: each step leaves two of the four feet, alternating, across the direction of travel
export function stamp(x, z, th, scale, side) {
  if (!P) return;
  const { x: c } = P.prints.userData, px = PR.px;
  const cx = (x - PR.x0) * px, cy = (z - PR.z0) * px;
  const ax = Math.cos(th), az = -Math.sin(th);     // across the body (local +x)
  c.fillStyle = 'rgba(120,86,48,.26)';
  for (const off of side ? [-.42, .15] : [-.15, .42]) {
    const dx = ax * off * scale * px, dy = az * off * scale * px;
    c.beginPath(); c.ellipse(cx + dx, cy + dy, 1.7 * scale + .9, 2.4 * scale + 1, -th, 0, Math.PI * 2); c.fill();
  }
  P.printDirty = true;
}
export function clearPrints() {
  if (!P) return;
  const { x: c } = P.prints.userData; c.clearRect(0, 0, c.canvas.width, c.canvas.height); P.prints.needsUpdate = true;
}

// ── the watermelon ──
// n-th good hit: a crack spreading from the top down the front (u = .25 faces the camera)
export function crack(n) {
  if (!P) return;
  P.cracks = n;
  const { x } = P.rind.userData, w = 512, h = 256;
  const line = (u0, v0, len, ang, wid) => {
    let u = u0, v = v0;
    const pts = [[u, v]];
    for (let i = 0; i < len; i++) { ang += rand(-.6, .6); u += Math.cos(ang) * 9; v += Math.sin(ang) * 9; pts.push([u, v]); }
    x.lineJoin = 'round'; x.lineCap = 'round';
    x.strokeStyle = '#ff6a78'; x.lineWidth = wid * 2.4; x.beginPath(); pts.forEach(([a, b]) => x.lineTo(a, b)); x.stroke();
    x.strokeStyle = '#d32a3e'; x.lineWidth = wid * 1.5; x.beginPath(); pts.forEach(([a, b]) => x.lineTo(a, b)); x.stroke();
    x.strokeStyle = '#2a0c10'; x.lineWidth = wid * .55; x.beginPath(); pts.forEach(([a, b]) => x.lineTo(a, b)); x.stroke();
  };
  // the top of the texture is the crown of the watermelon, which is what the camera mostly sees
  const u0 = w * .25 + rand(-12, 12), seg = (u, v, len, ang, wid) => { line(u, v, len, ang, wid); line(u + w, v, len, ang, wid); line(u - w, v, len, ang, wid); };
  if (n === 1) { seg(u0, 4, 10, Math.PI / 2 - .2, 9); seg(u0 + w * .5, 2, 6, Math.PI / 2 + .3, 8); }
  if (n === 2) { seg(u0 - 30, 2, 14, Math.PI / 2 + .25, 11); seg(u0 + 40, 26, 9, -.2, 9); seg(u0 + w * .3, 4, 10, Math.PI / 2, 9); }
  if (n >= 3) { seg(u0 + 10, 2, 22, Math.PI / 2 - .1, 13); seg(u0 - 60, 40, 14, .3, 10); seg(u0 + w * .5, 2, 16, Math.PI / 2, 12); }
  P.rind.needsUpdate = true;
  P.melon.scale.x = 1.04; P.melon.scale.z = .96;
}
// it falls open: two halves rock apart, juice and seeds everywhere
export function split() {
  if (!P || P.split) return;
  P.split = { t: 0 };
  P.melon.visible = false;
  P.halves.forEach(g => { g.visible = true; g.rotation.z = g.userData.s * Math.PI / 2; g.position.set(MELON.x, MELON_R * .92, MELON.z); });
  juice(MELON.x, MELON_R, MELON.z, 70);
}
export function juice(x, y, z, n = 30) {
  if (!P) return;
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(.6, 3.2);
    if (Math.random() < .8) P.juice.emit(x, y, z, Math.cos(a) * s, rand(1.5, 4.5), Math.sin(a) * s * .7, rand(.6, 1.2), ...pick([[.95, .25, .3], [1, .45, .5], [.9, .18, .26]]));
    else P.juice.emit(x, y, z, Math.cos(a) * s * .7, rand(2, 4), Math.sin(a) * s * .5, rand(.8, 1.3), .1, .07, .07);
  }
}
export function resetMelon() {
  if (!P) return;
  P.split = null; P.cracks = 0;
  P.rind.userData.x.clearRect(0, 0, 512, 256); rindDraw(P.rind.userData.x, 512, 256); P.rind.needsUpdate = true;
  P.melon.visible = true; P.melon.scale.set(1, .92, 1);
  P.halves.forEach(g => g.visible = false);
}

// a slice to eat: a half disc of flesh with rind along the curve
let sliceGeo = null;
export function slice() {
  sliceGeo = sliceGeo || new THREE.CircleGeometry(.3, 18, Math.PI, Math.PI);
  const m = mesh(sliceGeo, toon(0xffffff, { map: P.flesh, side: THREE.DoubleSide }), 0, 0, 0, null);
  return m;
}
export function blindfold() {
  const g = new THREE.Group();
  const mat = toon(0xffffff, { map: P.tenugui });
  const band = mesh(box(1.22, .2, .88), mat, 0, .84, 0, g);
  band.castShadow = true;
  [[.12, -.25], [-.1, .3]].forEach(([x, r]) => { const t = mesh(box(.16, .1, .34), mat, x, .8, -.6, g); t.rotation.set(.5, r, 0); });
  return g;
}
export function stick() {
  const pivot = new THREE.Group(); pivot.position.set(.55, .74, .14);
  const s = mesh(cyl(.045, .055, 1.35, 8), P.wood, 0, .675, 0, pivot);
  s.castShadow = true;
  return pivot;
}

// ── per frame ──
const _sun = new V3();
export function update(dt, camX = 0) {
  if (!P) return;
  P.seaTex.offset.y -= dt * .006; P.seaTex.offset.x += dt * .002;
  // the foam runs up the sand and slides back, a little out of step
  P.foam.forEach((m, i) => {
    const t = G.time * .55 + m.userData.ph, s = Math.sin(t);
    m.position.z = SHORE + .15 + s * .45 + i * .1;
    m.material.opacity = .55 + .45 * Math.max(0, Math.cos(t));
    m.material.map.offset.x += dt * (i ? .004 : -.003);
  });
  // glints along the sun's path on the water
  _sun.copy(sky.sunDir);
  const az = Math.atan2(_sun.x, -_sun.z), lit = clamp(_sun.y * 4, 0, 1);
  if (lit > 0) for (let k = 0; k < 6; k++) {
    if (Math.random() > dt * 60 * .6) continue;
    const z = SHORE - Math.pow(Math.random(), 1.6) * 70, along = (SHORE + 12 - z) * Math.tan(az);
    P.glints.emit(camX + along + rand(-1, 1) * (1.5 + (SHORE - z) * .3), -.02, z, 0, 0, 0, rand(.08, .3), lit, lit * .95, lit * .8);
  }
  P.sail.position.x = 34 + Math.sin(G.time * .02) * 6; P.sail.rotation.z = Math.sin(G.time * .7) * .03;
  // footprints fade slowly; the canvas uploads at most ten times a second
  P.printFade += dt; P.printT += dt;
  if (P.printFade > 1.2) {
    P.printFade = 0;
    const { x: c } = P.prints.userData; c.globalCompositeOperation = 'destination-out'; c.fillStyle = 'rgba(0,0,0,.035)'; c.fillRect(0, 0, c.canvas.width, c.canvas.height); c.globalCompositeOperation = 'source-over';
    P.printDirty = true;
  }
  if (P.printDirty && P.printT > .1) { P.prints.needsUpdate = true; P.printDirty = false; P.printT = 0; }
  // the halves rock apart and settle cut side up
  if (P.split) {
    const S = P.split; S.t += dt;
    const e = Math.min(1, S.t / .55), bounce = Math.sin(Math.min(1, S.t / 1.3) * Math.PI * 3) * Math.exp(-S.t * 3) * .12;
    P.halves.forEach(g => {
      const s = g.userData.s;
      g.rotation.z = s * (Math.PI / 2 + (1 - Math.pow(1 - e, 3)) * .95 + bounce);
      g.position.x = MELON.x - s * (.05 + .34 * e);
      g.position.y = lerp(MELON_R * .92, MELON_R * .8, e);
    });
  }
}
// show the aim of a crab at (x, z) facing th whose stick reaches `reach`; null hides it
export function aim(x, z, th, reach, scale) {
  if (!P) return;
  P.aim.visible = x != null; if (x == null) return;
  P.aim.position.set(x, 0, z); P.aim.rotation.y = th;
  P.aimChev.position.set(0, .012, .35 * scale + .1); P.aimChev.scale.setScalar(scale * 1.2);
  P.aimRing.position.set(0, .012, reach);
}
export function teardown() { P = null; }

// The balcony that every evening happens on: counter, pergola, lanterns, the city below,
// the laptop. Chapter props go in the chapter's own root group, not here.
import { THREE, V3, scene, mesh, group, box, rbox, cyl, sph, toon, canvasTex, MAT, COL, hitMat } from './gfx.js';
import { rand, lerp } from './util.js';
import { termTex } from './terminal.js';
import { G } from './state.js';
import { audio } from './audio.js';
import { backdrop } from './backdrop.js';

export const world = { lanterns: [], lanternMats: [], wind: 0 };
const before = new Set(scene.children);

// ── the view: the town, the city in the haze, the trees (painted; see backdrop.js) ──
world.backdrop = backdrop;

// ── balcony ──
// painted plank grain: long soft streaks, a few knots, nail holes. Greyscale, so it only
// modulates the wood's own color under the cel lighting.
function grainTex(planks, holes) {
  const t = canvasTex(1024, 256, (x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    const ph = h / planks;
    for (let p = 0; p < planks; p++) {
      const y0 = p * ph;
      x.fillStyle = `rgba(120,80,50,${rand(.02, .1)})`; x.fillRect(0, y0, w, ph);
      for (let i = 0; i < 26; i++) {
        const y = y0 + rand(2, ph - 2), a = rand(.05, .16), amp = rand(1, 4), f = rand(.004, .012), ph0 = rand(0, 6);
        x.strokeStyle = `rgba(110,70,40,${a})`; x.lineWidth = rand(.8, 2.4); x.beginPath();
        for (let u = 0; u <= w; u += 16) x.lineTo(u, y + Math.sin(u * f + ph0) * amp);
        x.stroke();
      }
      if (Math.random() < .7) {
        const kx = rand(60, w - 60), ky = y0 + rand(ph * .3, ph * .7);
        for (let r = 3; r > 0; r--) { x.strokeStyle = `rgba(100,60,30,${.12 + .06 * r})`; x.lineWidth = 1.5; x.beginPath(); x.ellipse(kx, ky, 6 + r * 7, 2 + r * 2, 0, 0, Math.PI * 2); x.stroke(); }
      }
      if (holes) for (const u of [w * .25, w * .75]) { x.fillStyle = 'rgba(60,40,40,.55)'; x.beginPath(); x.arc(u, y0 + ph * .5, 3.2, 0, Math.PI * 2); x.fill(); }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const counterTop = grainTex(4, true); counterTop.repeat.set(4, 1);
const boardTex = grainTex(2, true); boardTex.repeat.set(4, 1);
mesh(box(23, .28, 2.4), toon(COL.wood, { map: counterTop }), 0, -.14, 0);
for (const z of [-.6, 0, .6]) mesh(box(23, .01, .02), MAT.woodDark, 0, .002, z, scene, false);
mesh(box(23, 1.1, .12), toon(0xb07a4e, { map: boardTex }), 0, -.8, 1.16);
for (let x = -11; x <= 11; x += .8) mesh(box(.14, 3, .14), MAT.woodDark, x, -2.8, .9);
for (const x of [-10.9, 10.9]) mesh(box(.35, 9.5, .35), MAT.woodDark, x, 1.5, -1.5);
mesh(box(22.5, .35, .35), MAT.woodDark, 0, 6.2, -1.5);

// chōchin paper: bamboo ribs, and a brushed character on the white ones (front is u = .25)
function lanternTex(ch) {
  const draw = (x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(70,40,30,.28)';
    for (let k = 1; k < 11; k++) x.fillRect(0, k * h / 11 - 1, w, 2);
    if (ch) {
      x.fillStyle = '#c8303a'; x.font = '600 58px "Klee One", serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(ch, w * .25, h * .52); x.fillText(ch, w * .75, h * .52);
    }
  };
  const t = canvasTex(256, 128, draw);
  // the brush font may still be loading; repaint once it's there
  if (ch) document.fonts?.load('600 58px "Klee One"', ch).then(() => { draw(t.userData.x, 256, 128); t.needsUpdate = true; }).catch(() => { });
  return t;
}

// lantern string
export const lanternY = t => 5.7 - 1.1 * (1 - Math.pow(2 * t - 1, 2));
{
  const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(new V3(lerp(-10.7, 10.7, t), lanternY(t), -1.3)); }
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, .016, 5), toon(0x3a2a2e), 0, 0, 0, scene, false);
  for (let i = 0; i < 7; i++) {
    const t = .1 + i * .8 / 6, x = lerp(-10.7, 10.7, t), y = lanternY(t);
    const tex = lanternTex(i % 2 ? '氷夏祭'[(i >> 1) % 3] : '');
    const mat = toon(i % 2 ? 0xf3ece2 : 0xd8343c, { map: tex, emissive: i % 2 ? 0xc89a60 : 0xff5040, emissiveMap: tex, emissiveIntensity: .05 });
    world.lanternMats.push(mat);
    const pivot = group(scene, x, y, -1.3);
    const l = mesh(sph(.32, 18, 12), mat, 0, -.45, 0, pivot); l.scale.y = 1.15;
    mesh(cyl(.14, .14, .08), MAT.woodDark, 0, -.07, 0, pivot); mesh(cyl(.14, .14, .08), MAT.woodDark, 0, -.83, 0, pivot);
    pivot.userData.ph = rand(0, 6);
    world.lanterns.push(pivot);
  }
}

// furin: a glass wind chime under the beam. It rings when it swings hard enough.
{
  const pivot = group(scene, -3.3, 6.0, -1.45);
  mesh(cyl(.006, .006, .35, 4), MAT.dark, 0, -.17, 0, pivot, false);
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xdff1ff, transparent: true, opacity: .55, roughness: .05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  const bell = mesh(new THREE.SphereGeometry(.17, 18, 10, 0, Math.PI * 2, 0, Math.PI * .55), glass, 0, -.36, 0, pivot, false);
  // painted goldfish band
  mesh(new THREE.SphereGeometry(.171, 18, 4, 0, Math.PI * 2, Math.PI * .3, Math.PI * .12), toon(0xe8384c, { transparent: true, opacity: .85 }), 0, -.36, 0, pivot, false);
  const clapper = group(pivot, 0, -.36, 0);
  mesh(cyl(.004, .004, .32, 4), MAT.dark, 0, -.16, 0, clapper, false);
  const strip = canvasTex(64, 256, x => {
    x.fillStyle = '#f7f3e8'; x.fillRect(0, 0, 64, 256); x.fillStyle = '#3a6bb0';
    x.font = '600 34px "Klee One", serif'; x.textAlign = 'center';
    ['す', 'ず', 'し', 'い'].forEach((c, i) => x.fillText(c, 32, 50 + i * 50));
  });
  const paper = mesh(new THREE.PlaneGeometry(.13, .5), new THREE.MeshBasicMaterial({ map: strip, side: THREE.DoubleSide }), 0, -.27, 0, clapper, false);
  world.furin = { pivot, clapper, bell, paper, swing: 0, v: 0, lastRing: 0 };
}

// a flat serrated leaf, base at the origin pointing +y, cupped along its midrib
const LEAF = (() => {
  const L = .42, W = .26, N = 28, pts = [];
  const hw = t => W * .5 * Math.pow(Math.sin(Math.PI * Math.min(t, .98)), .7) * (t > .25 ? 1 + .14 * ((t * 9) % 1) : 1);
  for (let i = 0; i <= N; i++) { const t = i / N; pts.push(new THREE.Vector2(hw(t), t * L)); }
  for (let i = N; i >= 0; i--) { const t = i / N; pts.push(new THREE.Vector2(-hw(t), t * L)); }
  const g = new THREE.ShapeGeometry(new THREE.Shape(pts), 1), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    uv.setXY(i, x / W + .5, y / L);
    p.setZ(i, (x / W) * (x / W) * .12 - (y / L) * (y / L) * .06);
  }
  g.computeVertexNormals();
  return g;
})();
const veinTex = canvasTex(128, 128, (x, w, h) => {
  x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  x.strokeStyle = 'rgba(40,70,30,.35)'; x.lineCap = 'round';
  x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2, h); x.lineTo(w / 2, 4); x.stroke();
  x.lineWidth = 1.6;
  for (let k = 1; k < 7; k++) { const y = h - k * h / 7.5; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(w / 2, y); x.quadraticCurveTo(w / 2 + s * w * .2, y - 6, w / 2 + s * w * .42, y - 16); x.stroke(); } }
});
veinTex.flipY = false;

// decor that lives on the balcony all week
mesh(cyl(.5, .38, .8), MAT.terracotta, 8.45, .4, -.6);
mesh(cyl(.46, .46, .02), toon(0x4a3326), 8.45, .79, -.6, scene, false);
// a strawberry plant like the one on the film's railing: trifoliate serrated leaves on long
// stems, and one pale berry that hasn't ripened yet
{
  const plant = group(scene, 8.45, .8, -.6);
  const leafMat = toon(0x4f9a48, { map: veinTex, side: THREE.DoubleSide }), stemMat = toon(0x5f8f45);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + rand(-.3, .3), out = rand(.3, .65), hgt = rand(.45, 1.2);
    const tip = new V3(Math.cos(a) * out, hgt, Math.sin(a) * out);
    const curve = new THREE.QuadraticBezierCurve3(new V3(Math.cos(a) * .05, 0, Math.sin(a) * .05), new V3(Math.cos(a) * out * .2, hgt * .8, Math.sin(a) * out * .2), tip);
    mesh(new THREE.TubeGeometry(curve, 10, .014, 4), stemMat, 0, 0, 0, plant);
    const head = group(plant, tip.x, tip.y, tip.z);
    head.rotation.y = -a + Math.PI / 2;
    for (const k of [-1, 0, 1]) {
      const l = mesh(LEAF, leafMat, 0, 0, 0, head);
      l.rotation.set(-.6 + k * k * .25, 0, k * .8);
      l.scale.setScalar(k ? 1.25 : 1.5);
    }
    if (i === 2) {
      const berry = group(plant, tip.x * .7, tip.y * .55, tip.z * .7);
      mesh(cyl(.006, .006, .3, 4), stemMat, 0, .1, 0, berry);
      const b = mesh(sph(.06, 14, 10), toon(0xf2ead2), 0, -.07, 0, berry); b.scale.y = 1.25;
      mesh(new THREE.ConeGeometry(.05, .03, 6), stemMat, 0, -.005, 0, berry).rotation.x = Math.PI;
    }
  }
}
mesh(rbox(.9, .45, .5, .06), MAT.white, 6.9, .22, -.65);
// two blue-green echeveria rosettes in the white planter, like the succulent in the film
{
  const sm = toon(0x6fa8a4), sg = new THREE.ConeGeometry(.045, .2, 5);
  for (const [cx, n] of [[6.68, 11], [7.1, 9]]) {
    for (let i = 0; i < n; i++) {
      const ring = i < 6 ? 0 : 1, a = i * 2.4, tilt = ring ? .45 : 1.05;
      const m = mesh(sg, sm, cx + Math.cos(a) * (ring ? .03 : .09), .47 + ring * .04, -.65 + Math.sin(a) * (ring ? .03 : .09), scene, false);
      m.rotation.set(0, -a, 0); m.rotateZ(-tilt); m.translateY(.07);
    }
  }
}

// ── laptop ──
world.laptop = group(scene, -8.4, 0, -.3); world.laptop.rotation.y = .2;
mesh(rbox(1.4, .06, .95, .02), toon(0x3a3a42), 0, .03, 0, world.laptop);
mesh(box(1.2, .005, .45), toon(0x24242a), 0, .062, -.1, world.laptop, false);
world.screenPivot = group(world.laptop, 0, .06, -.46); world.screenPivot.rotation.x = -.22;
mesh(rbox(1.4, .92, .05, .02), toon(0x3a3a42), 0, .46, 0, world.screenPivot);
world.screen = mesh(new THREE.PlaneGeometry(1.3, .82), new THREE.MeshBasicMaterial({ map: termTex, toneMapped: false }), 0, .46, .028, world.screenPivot, false);
world.laptopHit = mesh(box(1.6, 1.3, 1.3), hitMat, -8.4, .6, -.3, scene, false);
world.laptopHit.userData.station = 'laptop';
world.LAPTOP = { x: -8.4, spot: -7.25 };

// pixel-art canvas helper for the Clawd glyph (used by fireworks, UI)
// '#' body, 'o' eye
export const CLAWD_PIXELS = [
  '.#########.',
  '.##o###o##.',
  '###o###o###',
  '.#########.',
  '..#.#.#.#..',
  '..#.#.#.#..',
];

// everything built above is the balcony; an evening set somewhere else hides it (game.setScene)
world.balcony = scene.children.filter(o => !before.has(o));
world.balconyOn = true;
world.setBalcony = on => { world.balconyOn = on; world.balcony.forEach(o => o.visible = on); };

world.update = function (dt) {
  // breeze: slow gusts that move lanterns, the furin and anything else that listens
  const t = G.time;
  world.wind = .5 + .35 * Math.sin(t * .23) + .25 * Math.sin(t * .71 + 1) + .15 * Math.sin(t * 1.9);
  world.lanterns.forEach(p => { p.rotation.z = Math.sin(t * 1.3 + p.userData.ph) * .05 * world.wind; p.rotation.x = Math.sin(t * .9 + p.userData.ph) * .03 * world.wind; });
  const F = world.furin;
  const target = Math.sin(t * 1.7) * .25 * world.wind + Math.sin(t * 4.3) * .08 * world.wind;
  F.v += ((target - F.swing) * 18 - F.v * 2.2) * dt; F.swing += F.v * dt;
  F.pivot.rotation.z = F.swing * .35;
  F.clapper.rotation.z = F.swing * 1.3; F.clapper.rotation.x = Math.sin(t * 2.3) * .2 * world.wind;
  if (Math.abs(F.v) > .55 && t - F.lastRing > .8) { F.lastRing = t; audio.sfx('furin', { strength: Math.min(1, Math.abs(F.v) - .4) }); }
};

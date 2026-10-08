// The balcony that every evening happens on: counter, pergola, lanterns, the city below,
// the laptop. Chapter props go in the chapter's own root group, not here.
import { THREE, V3, scene, mesh, group, box, rbox, cyl, sph, toon, canvasTex, MAT, hitMat } from './gfx.js';
import { rand, lerp } from './util.js';
import { termTex } from './terminal.js';
import { G } from './state.js';
import { audio } from './audio.js';
import { backdrop } from './backdrop.js';

export const world = { lanterns: [], lanternMats: [], wind: 0 };

// ── the view: the town, the city in the haze, the trees (painted; see backdrop.js) ──
world.backdrop = backdrop;

// ── balcony ──
mesh(box(23, .28, 2.4), MAT.wood, 0, -.14, 0);
for (const z of [-.6, 0, .6]) mesh(box(23, .01, .02), MAT.woodDark, 0, .002, z, scene, false);
mesh(box(23, 1.1, .12), MAT.woodDark, 0, -.8, 1.16);
for (let x = -11; x <= 11; x += .8) mesh(box(.14, 3, .14), MAT.woodDark, x, -2.8, .9);
for (const x of [-10.9, 10.9]) mesh(box(.35, 9.5, .35), MAT.woodDark, x, 1.5, -1.5);
mesh(box(22.5, .35, .35), MAT.woodDark, 0, 6.2, -1.5);

// lantern string
export const lanternY = t => 5.7 - 1.1 * (1 - Math.pow(2 * t - 1, 2));
{
  const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(new V3(lerp(-10.7, 10.7, t), lanternY(t), -1.3)); }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x302020 })));
  for (let i = 0; i < 7; i++) {
    const t = .1 + i * .8 / 6, x = lerp(-10.7, 10.7, t), y = lanternY(t);
    const mat = toon(i % 2 ? 0xf3ece2 : 0xd8343c, { emissive: i % 2 ? 0xc89a60 : 0xff5040, emissiveIntensity: .05 });
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

// decor that lives on the balcony all week
mesh(cyl(.5, .38, .8), MAT.terracotta, 8.45, .4, -.6);
{
  const lm = toon(0x3f9348);
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const m = mesh(sph(.28, 12, 8), lm, 8.45 + Math.cos(a) * .3, 1.25 + rand(0, .5), -.6 + Math.sin(a) * .3); m.scale.set(.45, 1.6, .16); m.rotation.set(Math.sin(a) * .6, a, -Math.cos(a) * .6); }
}
mesh(rbox(.9, .45, .5, .06), MAT.white, 6.9, .22, -.65);
for (let i = 0; i < 5; i++) mesh(new THREE.ConeGeometry(.08, .28, 6), toon(0x7aa874), 6.6 + i * .15, .55, -.65 + rand(-.1, .1));

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

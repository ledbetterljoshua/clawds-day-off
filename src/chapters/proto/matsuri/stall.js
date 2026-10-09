// Our kakigōri yatai's working props: the ice box, a small hand-cranked shaver, the shaved cups
// waiting for syrup, three syrup bottles, the cups ready to hand over, and the coin tray.
import { THREE, V3, mesh, group, box, rbox, cyl, sph, toon, MAT } from '../../../core/gfx.js';
import { iceMat } from '../../../core/crab.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prep } from './kit.js';
import { X, FRONT } from './street.js';
import { Particles } from '../../../core/fx.js';
import { rand, lerp } from '../../../core/util.js';

export const FLAV = {
  red: { kana: 'いちご', en: 'strawberry', css: '#e8384c', mound: 0xff6b7a },
  green: { kana: 'メロン', en: 'melon', css: '#40c25c', mound: 0x7fe08a },
  blue: { kana: 'ハワイ', en: 'blue hawaii', css: '#3d8fe3', mound: 0x6ab4ff },
};
export const FLAVORS = ['red', 'green', 'blue'];

const CY = .55, CZ = FRONT - .42;          // counter top, the line props sit on
export const SX = {                        // x of each prop
  box: X.stall - 2.55, shaver: X.stall - 1.55, shaved: [-.6, -.27, .06].map(v => X.stall + v),
  bottles: [.62, .92, 1.22].map(v => X.stall + v), ready: [1.72, 2.02, 2.32, 2.62].map(v => X.stall + v), coins: X.stall + 2.95,
};
// where a worker stands for each job (front lane), and where the line starts
export const SPOT = { box: X.stall - 2.3, shave: X.stall - .75, syrup: X.stall + .95, serve: X.stall + 3.55 };
export const QUEUE = { x0: X.stall + 4.55, step: .95, z: .95 };

const cupGeo = (() => {
  const a = prep(new THREE.CylinderGeometry(.1, .074, .17, 16, 1, true), { y: .085, color: 0xfbf7ee });
  const b = prep(new THREE.CylinderGeometry(.1015, .092, .045, 16, 1, true), { y: .14, color: 0xd8343c });
  const c = prep(new THREE.CircleGeometry(.074, 16), { y: .002, rx: -Math.PI / 2, color: 0xe8e2d4 });
  return mergeGeometries([a, b, c]);
})();
const cupMat = toon(0xffffff, { vertexColors: true, side: THREE.DoubleSide });
const moundGeo = new THREE.SphereGeometry(.11, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const moundMats = { white: toon(0xf4fbff, { emissive: 0x9ab0c8, emissiveIntensity: .15 }), ...Object.fromEntries(FLAVORS.map(f => [f, toon(FLAV[f].mound, { emissive: FLAV[f].mound, emissiveIntensity: .12 })])) };

// a paper cup with a snow mound; flavor null = plain shaved ice
export function makeCup(flavor = null) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(cupGeo, cupMat); c.castShadow = true; g.add(c);
  const m = new THREE.Mesh(moundGeo, moundMats[flavor || 'white']); m.position.y = .165; m.scale.y = 1.15; g.add(m);
  g.userData.mound = m;
  g.userData.setFlavor = f => { m.material = moundMats[f || 'white']; };
  return g;
}

export function buildStall(root) {
  const P = { root };
  // ice box: an open cooler with blocks
  const ib = group(root, SX.box, CY, CZ);
  mesh(rbox(.86, .42, .56, .05), toon(0x5fb3b8), 0, .21, 0, ib);
  mesh(box(.8, .02, .5), toon(0x3a7a80), 0, .41, 0, ib, false);
  P.lid = mesh(rbox(.88, .06, .58, .03), toon(0xf4f1ec), 0, .64, -.3, ib); P.lid.rotation.x = -1.2;
  P.blocks = [0, 1, 2, 3].map(i => { const m = mesh(rbox(.3, .26, .3, .04), iceMat, -.2 + (i % 2) * .38, .33 + Math.floor(i / 2) * .02, -.1 + Math.floor(i / 2) * .2, ib); return m; });

  // the shaver: the teal cast-iron one from the balcony, at half size
  const sh = group(root, SX.shaver, CY, CZ); sh.scale.setScalar(.52);
  mesh(rbox(1.5, .12, 1.25, .04), MAT.teal, 0, .06, 0, sh);
  mesh(rbox(.26, 2.5, .26, .05), MAT.teal, 0, 1.3, -.55, sh);
  mesh(rbox(.3, .2, .85, .05), MAT.teal, 0, 2.45, -.2, sh);
  mesh(cyl(.52, .52, .1, 24), MAT.metal, 0, 1.8, .15, sh);
  P.blade = mesh(cyl(.4, .4, .02, 24), toon(0x8a9098), 0, 1.74, .15, sh);
  P.hopper = mesh(rbox(.38, .32, .38, .06), iceMat, 0, 2.02, .15, sh);
  mesh(cyl(.05, .05, .8, 10), MAT.metal, .4, 1.3, -.55, sh).rotation.z = Math.PI / 2;
  P.crank = group(sh, .78, 1.3, -.55);
  mesh(rbox(.08, .5, .1, .02), MAT.teal, 0, .22, 0, P.crank);
  mesh(cyl(.07, .07, .26), MAT.red, .14, .44, 0, P.crank).rotation.z = Math.PI / 2;
  P.shaverCup = makeCup(); P.shaverCup.position.set(SX.shaver, CY, CZ + .08); root.add(P.shaverCup);
  P.shaverCup.userData.mound.scale.setScalar(.01);

  // the cups waiting for syrup, and the cups ready to go
  P.shaved = SX.shaved.map(x => { const c = makeCup(); c.position.set(x, CY, CZ); c.visible = false; root.add(c); return c; });
  P.ready = SX.ready.map(x => { const c = makeCup('red'); c.position.set(x, CY, CZ + .05); c.visible = false; root.add(c); return c; });

  // syrup bottles with a pour stream
  P.bottles = FLAVORS.map((f, i) => {
    const g = group(root, SX.bottles[i], CY, CZ - .12), col = new THREE.Color(FLAV[f].css);
    mesh(cyl(.09, .1, .34, 14), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: .9, roughness: .15, emissive: col, emissiveIntensity: .2 }), 0, .17, 0, g);
    mesh(cyl(.035, .06, .12, 10), toon(0xf4f1ec), 0, .4, 0, g);
    return g;
  });
  P.stream = mesh(cyl(.02, .02, 1, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .9, toneMapped: false }), 0, 0, 0, root, false);
  P.stream.visible = false;

  // coin tray
  const ct = group(root, SX.coins, CY, CZ + .12);
  mesh(cyl(.2, .17, .06, 16), toon(0x9aa0a8), 0, .03, 0, ct);
  P.coins = [];
  for (let i = 0; i < 14; i++) { const m = mesh(cyl(.045, .045, .012, 12), toon(i % 3 ? 0xd9c27a : 0xc8ccd2), rand(-.12, .12), .07 + Math.floor(i / 5) * .012, rand(-.1, .1), ct, false); m.visible = false; P.coins.push(m); }

  P.snow = new Particles({ max: 160, size: .05, gravity: -3, floor: () => CY + .1, parent: root });
  P.coinFx = new Particles({ max: 40, size: .09, additive: true, gravity: -6, parent: root });
  return P;
}

// draw the stall's state onto its props
export function syncStall(P, S, t) {
  P.blocks.forEach((b, i) => b.visible = i < S.box);
  P.lid.rotation.x = S.box > 0 ? -1.2 : -.2;
  P.hopper.visible = S.hopper > 0;
  P.hopper.scale.y = .25 + .75 * (S.hopper / 6) - S.shaveProg * .12;
  P.crank.rotation.x = -S.crankA; P.blade.rotation.y = S.crankA * 2;
  const mound = P.shaverCup.userData.mound, k = S.shaveProg;
  mound.scale.set(lerp(.2, 1, k), lerp(.05, 1.15, k), lerp(.2, 1, k));
  P.shaverCup.visible = S.shaveProg > 0;
  P.shaved.forEach((c, i) => c.visible = i < S.shaved);
  P.ready.forEach((c, i) => { const r = S.ready[i]; c.visible = !!r && !r.flying; if (r) c.userData.setFlavor(r.flavor); });
  P.coins.forEach((c, i) => c.visible = i < Math.min(P.coins.length, Math.ceil(S.sold / 2)));
  const pour = S.pouring;
  P.stream.visible = !!pour;
  if (pour) {
    const i = FLAVORS.indexOf(pour.flavor), x = SX.bottles[i];
    P.stream.material.color.set(FLAV[pour.flavor].css);
    const y0 = CY + .62, y1 = CY + .25;
    P.stream.position.set(lerp(x, SX.shaved[0], .5), (y0 + y1) / 2, CZ - .02); P.stream.scale.set(1 + Math.sin(t * 30) * .2, y0 - y1, 1);
    P.bottles[i].rotation.z = .5 + Math.sin(t * 3) * .05; P.bottles[i].position.y = CY + .2;
  }
  P.bottles.forEach((b, i) => { if (!pour || FLAVORS[i] !== pour.flavor) { b.rotation.z *= .8; b.position.y = lerp(b.position.y, CY, .2); } });
}

export const shaverTop = () => new V3(SX.shaver, CY + .95, CZ + .08);
export const counterY = CY, counterZ = CZ;

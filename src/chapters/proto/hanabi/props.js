// The firework workshop on the counter: a workbench with an open half-shell (its cut face shows
// the design being packed), bowls of star pellets, paste and paper; and a rack of finished shells.
import { THREE, mesh, group, box, rbox, cyl, sph, toon, canvasTex, MAT } from '../../../core/gfx.js';
import { COLORS, mainColors } from './design.js';
import { drawShell } from './draw.js';

export const BENCH_X = -2.75, RACK_X = 3.75;
export const SLOT_XZ = [[-.6, -.72], [-.2, -.72], [.2, -.72], [.6, -.72], [-.6, -.38], [-.2, -.38], [.2, -.38], [.6, -.38]];

const kraftTex = (() => {
  const t = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { x.strokeStyle = `rgba(110,70,30,${.04 + Math.random() * .1})`; x.lineWidth = Math.random() * 1.4 + .3; const a = Math.random() * Math.PI, l = 4 + Math.random() * 14, px = Math.random() * w, py = Math.random() * h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
    for (let k = 0; k < 7; k++) { x.strokeStyle = 'rgba(90,55,25,.16)'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, k * 38 + 10); x.lineTo(w, k * 38 + 18); x.stroke(); }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();
export const kraftMat = toon(0xcf9f68, { map: kraftTex });

export function build(root) {
  const P = { slots: [] };
  // workbench: a low tray on a cloth
  const B = P.bench = group(root, BENCH_X, 0, -.5);
  mesh(rbox(2.4, .05, 1.05, .02), toon(0x3e5f8a), .25, .025, 0, B);                  // indigo cloth
  mesh(rbox(2.1, .08, .82, .03), MAT.woodLight, .25, .09, 0, B);
  // the half shell, cut face toward us; its face is the live design
  P.faceTex = canvasTex(512, 512);
  P.shell = group(B, -.45, .56, .02);
  const hemi = mesh(new THREE.SphereGeometry(.42, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), kraftMat, 0, 0, 0, P.shell);
  hemi.rotation.x = -Math.PI / 2;
  P.face = mesh(new THREE.CircleGeometry(.42, 48), toon(0xffffff, { map: P.faceTex, emissive: 0xffffff, emissiveMap: P.faceTex, emissiveIntensity: .18 }), 0, 0, .001, P.shell, false);
  mesh(cyl(.2, .26, .14, 20), MAT.woodDark, -.45, .2, .02, B);                          // cradle
  // the other half, waiting
  const other = mesh(new THREE.SphereGeometry(.42, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), kraftMat, -.45 + .02, .14, -.34, B);
  other.scale.set(.62, .62, .62); other.rotation.x = .2;
  // bowls of stars, one per color
  const pel = new THREE.InstancedMesh(sph(.028, 8, 6), toon(0xffffff), 7 * 6), m4 = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 1; i <= 7; i++) {
    const bx = .22 + (i - 1) * .16, bz = .22;
    mesh(cyl(.07, .05, .06, 16), toon(0xe9e2d4), bx, .16, bz, B);
    for (let k = 0; k < 6; k++) {
      m4.makeTranslation(bx + Math.cos(k * 2.1) * .03 * (k % 3), .2 + (k > 3 ? .025 : 0), bz + Math.sin(k * 2.1) * .03 * (k % 3));
      pel.setMatrixAt((i - 1) * 6 + k, m4); pel.setColorAt((i - 1) * 6 + k, c.setRGB(...COLORS[i].col.map(v => Math.min(1, v * .85))));
    }
  }
  pel.castShadow = true; B.add(pel);
  // paste pot and brush, kraft strips
  mesh(cyl(.09, .09, .14, 16), toon(0xf4f1ec), .9, .2, -.2, B);
  mesh(cyl(.075, .075, .02, 16), toon(0xe8e0c8), .9, .27, -.2, B, false);
  const brush = mesh(box(.03, .03, .34), MAT.woodDark, .95, .3, -.1, B); brush.rotation.set(.5, .3, 0);
  for (let k = 0; k < 4; k++) { const s = mesh(box(.5, .006, .07), kraftMat, .55, .135 + k * .007, -.28 + k * .02, B); s.rotation.y = .1 * k - .1; }

  // the rack: a wooden crate of short mortars; each finished shell sits in one
  const R = P.rack = group(root, RACK_X, 0, 0);
  mesh(rbox(1.7, .42, .66, .03), MAT.woodDark, 0, .21, -.55, R);
  const crateTex = canvasTex(256, 64, (x, w, h) => { x.fillStyle = '#e9dcc4'; x.fillRect(0, 0, w, h); x.fillStyle = '#b8322d'; x.font = '800 40px "M PLUS Rounded 1c", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('花火', w / 2, h / 2 + 2); });
  mesh(new THREE.PlaneGeometry(.62, .16), toon(0xffffff, { map: crateTex }), 0, .22, -.215, R, false);
  for (const [x, z] of SLOT_XZ) {
    mesh(cyl(.13, .13, .05, 18), toon(0x2a2420), x, .43, z, R, false);
    const g = group(R, x, .52, z); g.visible = false;
    mesh(sph(.12, 18, 12), kraftMat, 0, 0, 0, g);
    const band = mesh(new THREE.TorusGeometry(.121, .022, 8, 24), toon(0xffffff), 0, 0, 0, g); band.rotation.x = Math.PI / 2;
    const fuse = mesh(cyl(.012, .012, .12, 6), toon(0x6b4a2a), 0, .16, 0, g, false); fuse.rotation.z = .3;
    P.slots.push({ g, band, design: null, who: null });
  }
  return P;
}

export function setSlot(P, i, design, who) {
  const s = P.slots[i]; s.design = design; s.who = who;
  s.g.visible = !!design;
  if (design) { const c = mainColors(design)[0]; s.band.material.color.setRGB(...(c ? c.col : [1, 1, 1])).multiplyScalar(.9); s.g.scale.setScalar(1); }
}

let faceSig = '';
export function paintFace(P, design) {
  const sig = JSON.stringify([design.mode, design.rings, design.core, design.fx, design.grid, design.frame]);
  if (sig === faceSig) return; faceSig = sig;
  const { x, c } = P.faceTex.userData;
  drawShell(x, c.width, design, { full: true });
  P.faceTex.needsUpdate = true;
}
export function resetFace() { faceSig = ''; }

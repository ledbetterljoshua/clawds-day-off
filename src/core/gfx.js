import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export { THREE };
export const V3 = THREE.Vector3;

export const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 900);
scene.fog = new THREE.Fog(0xcfe6f7, 30, 240);

const resizers = [];
export const onResize = fn => resizers.push(fn);
export function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  resizers.forEach(f => f(w, h));
}
addEventListener('resize', resize);

// 3-step toon ramp shared by everything
export const gradTex = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 190, 190, 190, 255, 255, 255, 255, 255]), 3, 1);
gradTex.minFilter = gradTex.magFilter = THREE.NearestFilter; gradTex.needsUpdate = true;

export const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradTex, ...o });

export function mesh(geo, mat, x = 0, y = 0, z = 0, parent = scene, shadow = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = shadow;
  if (parent) parent.add(m);
  return m;
}
export const group = (parent = scene, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent && parent.add(g); return g; };
export const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const rbox = (w, h, d, r = .05) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
export const cyl = (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s);
export const sph = (r, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  draw && draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData = { c, x };
  return t;
}

export const dotTex = canvasTex(64, 64, x => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,255,255,.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
});

// shared palette
export const COL = { orange: 0xd97757, wood: 0xc8935c, woodDark: 0x8a5a36, terracotta: 0xc0673f, teal: 0x5fb3b8, metal: 0xb8bcc4, red: 0xd8343c, leaf: 0x4caf50 };
export const MAT = {
  wood: toon(COL.wood), woodDark: toon(COL.woodDark), woodLight: toon(0xe0b27a), terracotta: toon(COL.terracotta),
  metal: toon(COL.metal), red: toon(COL.red), teal: toon(COL.teal), leaf: toon(COL.leaf), white: toon(0xf4f1ec), dark: toon(0x2a2832),
};
// invisible, raycastable
export const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

// screen-space projection helper: world -> {x,y} css px, plus `behind`
const _p = new THREE.Vector3();
export function toScreen(x, y, z) {
  _p.set(x, y, z).project(camera);
  return { x: (_p.x * .5 + .5) * innerWidth, y: (-_p.y * .5 + .5) * innerHeight, behind: _p.z > 1 };
}

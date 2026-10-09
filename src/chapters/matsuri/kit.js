// Building blocks for a set that has to stay cheap: one painted canvas atlas for every sign,
// awning and shopfront, and a bucket that merges static parts into one mesh per material.
import { THREE, V3 } from '../../core/gfx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function makeAtlas(size = 2048) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const tiles = [];
  let cx = 0, cy = 0, rowH = 0;
  const paint = t => { x.save(); x.translate(t.x, t.y); x.beginPath(); x.rect(0, 0, t.w, t.h); x.clip(); x.clearRect(0, 0, t.w, t.h); t.draw(x, t.w, t.h); x.restore(); };
  const A = {
    tex, size,
    tile(w, h, draw) {
      if (cx + w > size) { cx = 0; cy += rowH + 4; rowH = 0; }
      const t = { x: cx, y: cy, w, h, draw, u0: (cx + 1) / size, u1: (cx + w - 1) / size, v0: 1 - (cy + h - 1) / size, v1: 1 - (cy + 1) / size };
      paint(t); tiles.push(t);
      cx += w + 4; rowH = Math.max(rowH, h);
      tex.needsUpdate = true;
      return t;
    },
    // canvas text only looks right once the web fonts are in; repaint everything when they are
    repaint() { tiles.forEach(paint); tex.needsUpdate = true; },
  };
  A.white = A.tile(8, 8, (x, w, h) => { x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); });
  return A;
}

const KEEP = ['position', 'normal', 'uv', 'color'];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3(), _c = new THREE.Color();

// prepare a geometry for merging: non-indexed, uv remapped into an atlas tile, a flat vertex color
export function prep(geo, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sx = s, sy = s, sz = s, color = 0xffffff, tile = null, matrix = null } = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
  const n = g.attributes.position.count;
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (tile) { const uv = g.attributes.uv; for (let i = 0; i < n; i++) uv.setXY(i, tile.u0 + uv.getX(i) * (tile.u1 - tile.u0), tile.v0 + uv.getY(i) * (tile.v1 - tile.v0)); }
  _c.set(color); const col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.applyMatrix4(matrix || _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)));
  return g;
}

export class Bucket {
  constructor() { this.parts = new Map(); }
  add(key, geo, o) {
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(prep(geo, o));
    return this;
  }
  geometry(key) { const list = this.parts.get(key); if (!list) return null; const g = mergeGeometries(list); list.forEach(x => x.dispose()); this.parts.delete(key); return g; }
  build(parent, mats, { shadow = true, noShadow = [] } = {}) {
    const out = {};
    for (const k of [...this.parts.keys()]) {
      const m = new THREE.Mesh(this.geometry(k), mats[k]);
      m.castShadow = shadow && !noShadow.includes(k); m.receiveShadow = !noShadow.includes(k);
      parent.add(m); out[k] = m;
    }
    return out;
  }
}

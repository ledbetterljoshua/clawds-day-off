// お面: a board of festival masks. Buy one and Clawd wears it pushed to the side, the way
// everyone does, for the rest of the night.
import { THREE, toon, canvasTex } from '../../core/gfx.js';
import { $, esc } from '../../core/util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeAtlas, prep } from './kit.js';
import { X, FRONT } from './street.js';

export const MASKS = [
  { id: 'kitsune', jp: '狐', name: 'fox', draw(x, w, h) {
    x.fillStyle = '#fbf8f2'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#d8343c'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(w / 2 + s * 40, h * .38); x.quadraticCurveTo(w / 2 + s * 70, h * .3, w / 2 + s * 88, h * .42); x.quadraticCurveTo(w / 2 + s * 66, h * .44, w / 2 + s * 40, h * .38); x.fill(); x.beginPath(); x.moveTo(w / 2 + s * 30, h * .12); x.lineTo(w / 2 + s * 70, h * .02); x.lineTo(w / 2 + s * 58, h * .26); x.fill(); }
    x.strokeStyle = '#1e1a1c'; x.lineWidth = 6; x.lineCap = 'round'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(w / 2 + s * 42, h * .42); x.lineTo(w / 2 + s * 72, h * .36); x.stroke(); }
    x.fillStyle = '#1e1a1c'; x.beginPath(); x.ellipse(w / 2, h * .62, 9, 6, 0, 0, 7); x.fill();
    x.strokeStyle = '#d8343c'; x.lineWidth = 4; x.beginPath(); x.moveTo(w / 2 - 22, h * .74); x.quadraticCurveTo(w / 2, h * .82, w / 2 + 22, h * .74); x.stroke();
    x.fillStyle = '#d9a640'; x.beginPath(); x.arc(w / 2, h * .22, 8, 0, 7); x.fill();
  } },
  { id: 'hyottoko', jp: 'ひょっとこ', name: 'hyottoko', draw(x, w, h) {
    x.fillStyle = '#f0c89a'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#3d74c8'; x.fillRect(0, h * .06, w, h * .1);
    x.fillStyle = '#1e1a1c'; x.beginPath(); x.ellipse(w * .36, h * .4, 14, 16, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(w * .66, h * .42, 9, 10, 0, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.beginPath(); x.arc(w * .37, h * .38, 4, 0, 7); x.fill();
    x.strokeStyle = '#1e1a1c'; x.lineWidth = 5; for (const [a, b] of [[.26, .46], [.56, .74]]) { x.beginPath(); x.moveTo(w * a, h * .27); x.quadraticCurveTo(w * (a + b) / 2, h * .2, w * b, h * .28); x.stroke(); }
    x.fillStyle = '#c8402a'; x.beginPath(); x.ellipse(w * .7, h * .72, 18, 14, 0, 0, 7); x.fill(); x.fillStyle = '#5a1a14'; x.beginPath(); x.ellipse(w * .72, h * .72, 8, 6, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(230,110,110,.5)'; x.beginPath(); x.ellipse(w * .26, h * .62, 16, 10, 0, 0, 7); x.fill();
  } },
  { id: 'okame', jp: 'おかめ', name: 'okame', draw(x, w, h) {
    x.fillStyle = '#fbf6ee'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#1e1a1c'; x.fillRect(0, 0, w, h * .14); for (const s of [-1, 1]) { x.beginPath(); x.ellipse(w / 2 + s * 38, h * .24, 8, 5, 0, 0, 7); x.fill(); }
    x.lineWidth = 5; x.strokeStyle = '#1e1a1c'; x.lineCap = 'round'; for (const s of [-1, 1]) { x.beginPath(); x.arc(w / 2 + s * 34, h * .46, 12, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
    x.fillStyle = 'rgba(240,110,120,.65)'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(w / 2 + s * 52, h * .62, 22, 14, 0, 0, 7); x.fill(); }
    x.fillStyle = '#d8343c'; x.beginPath(); x.ellipse(w / 2, h * .74, 8, 6, 0, 0, 7); x.fill();
  } },
  { id: 'oni', jp: '鬼', name: 'oni', draw(x, w, h) {
    x.fillStyle = '#d8402e'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#f2e6c8'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(w / 2 + s * 30, h * .2); x.lineTo(w / 2 + s * 46, -4); x.lineTo(w / 2 + s * 58, h * .22); x.fill(); }
    x.strokeStyle = '#1e1a1c'; x.lineWidth = 8; x.lineCap = 'round'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(w / 2 + s * 16, h * .34); x.lineTo(w / 2 + s * 58, h * .28); x.stroke(); }
    x.fillStyle = '#f7d046'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(w / 2 + s * 36, h * .44, 14, 10, 0, 0, 7); x.fill(); } x.fillStyle = '#1e1a1c'; for (const s of [-1, 1]) { x.beginPath(); x.arc(w / 2 + s * 36, h * .44, 5, 0, 7); x.fill(); }
    x.fillStyle = '#5a1a14'; x.fillRect(w / 2 - 36, h * .66, 72, 20); x.fillStyle = '#fbf6ee'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(w / 2 + s * 30, h * .66); x.lineTo(w / 2 + s * 22, h * .78); x.lineTo(w / 2 + s * 14, h * .66); x.fill(); }
  } },
  { id: 'neko', jp: '猫', name: 'cat', draw(x, w, h) {
    x.fillStyle = '#fbf8f2'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#f6a8b8'; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(w / 2 + s * 24, h * .14); x.lineTo(w / 2 + s * 64, 0); x.lineTo(w / 2 + s * 60, h * .3); x.fill(); }
    x.fillStyle = '#1e1a1c'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(w / 2 + s * 34, h * .44, 8, 12, 0, 0, 7); x.fill(); }
    x.fillStyle = '#f6a8b8'; x.beginPath(); x.moveTo(w / 2 - 8, h * .58); x.lineTo(w / 2 + 8, h * .58); x.lineTo(w / 2, h * .64); x.fill();
    x.strokeStyle = '#1e1a1c'; x.lineWidth = 3; x.beginPath(); x.moveTo(w / 2 - 14, h * .7); x.quadraticCurveTo(w / 2 - 7, h * .76, w / 2, h * .68); x.quadraticCurveTo(w / 2 + 7, h * .76, w / 2 + 14, h * .7); x.stroke();
    for (const s of [-1, 1]) for (const d of [-6, 6]) { x.beginPath(); x.moveTo(w / 2 + s * 26, h * .64 + d); x.lineTo(w / 2 + s * 70, h * .62 + d * 2); x.stroke(); }
  } },
  { id: 'clawd', jp: 'クロード', name: 'clawd', draw(x, w, h) {
    x.fillStyle = '#d97757'; x.fillRect(0, 0, w, h);
    x.fillStyle = '#141414'; x.fillRect(w * .3, h * .3, w * .09, h * .26); x.fillRect(w * .61, h * .3, w * .09, h * .26);
  } },
];

let MA = null, TILES = null, MAT = null;
function atlas() {
  if (MA) return MA;
  MA = makeAtlas(1024);
  TILES = MASKS.map(m => MA.tile(256, 256, (x, w, h) => m.draw(x, w, h)));
  MAT = toon(0xffffff, { map: MA.tex });
  return MA;
}

// a mask is a shallow shell: the front of a squashed sphere
const shell = () => new THREE.SphereGeometry(.3, 18, 14, Math.PI / 2 - 1.05, 2.1, Math.PI / 2 - 1.0, 2.0);

export function maskMesh(id) {
  atlas();
  const i = MASKS.findIndex(m => m.id === id), g = prep(shell(), { sz: .55, tile: TILES[i] });
  const m = new THREE.Mesh(g, MAT); m.castShadow = true;
  return m;
}

// the board at the back of the mask stall: two rows of three
export function buildMaskBoard(root, { boardZ = FRONT - 1.82 } = {}) {
  atlas();
  const parts = MASKS.map((m, i) => prep(shell(), { x: X.mask + (i % 3 - 1) * .95, y: 1.95 - Math.floor(i / 3) * .78, z: boardZ + .1, sz: .55, tile: TILES[i] }));
  const board = new THREE.Mesh(mergeGeometries(parts), MAT); parts.forEach(p => p.dispose());
  board.castShadow = board.receiveShadow = true; root.add(board);
  const peg = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.8), toon(0xd9b98a)); peg.position.set(X.mask, 1.6, boardZ + .02); root.add(peg);
  return board;
}

// little canvas portraits for the picker
export function maskThumb(id) {
  const m = MASKS.find(x => x.id === id), c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d'); x.save(); x.beginPath(); x.ellipse(48, 48, 40, 44, 0, 0, 7); x.clip(); x.scale(96 / 256, 96 / 256); m.draw(x, 256, 256); x.restore();
  x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2; x.beginPath(); x.ellipse(48, 48, 40, 44, 0, 0, 7); x.stroke();
  return c.toDataURL();
}

export const maskName = id => { const m = MASKS.find(x => x.id === id); return m ? `${m.jp} ${m.name}` : id; };
export const esc_ = esc;

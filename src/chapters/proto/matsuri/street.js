// The festival street: a row of machiya shopfronts, yatai stalls under strings of chōchin, a
// torii and shrine steps at the left end, the river embankment at the right end, hills behind.
// Everything static merges into a handful of meshes; the lanterns are instanced.
import { THREE, V3, toon, box, cyl, sph, canvasTex } from '../../../core/gfx.js';
import { G } from '../../../core/state.js';
import { rand, smooth, lerp } from '../../../core/util.js';
import { makeAtlas, Bucket, prep } from './kit.js';

export const X = { stall: 0, gold: -11, mask: 11, ice: -20.5, torii: -26.5, bank: 26, shopsEnd: 22.6 };
export const FRONT = -.4;          // the street-side edge of every stall
const ROUND = '"M PLUS Rounded 1c", sans-serif', BRUSH = '"Klee One", serif';

let A = null, T = null;
function atlas() {
  if (A) return A;
  A = makeAtlas(2048); T = {};
  const stripes = (a, b, n = 8, vertical = true) => (x, w, h) => { for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? b : a; if (vertical) x.fillRect(i * w / n, 0, w / n + 1, h); else x.fillRect(0, i * h / n, w, h / n + 1); } x.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 40; i++) x.fillRect(Math.random() * w, Math.random() * h, 2, 8); };
  T.kohaku = A.tile(256, 128, stripes('#d8343c', '#fbf7ee', 10));
  T.awnRed = A.tile(128, 128, stripes('#d8343c', '#fbf7ee', 8, false));
  T.awnBlue = A.tile(128, 128, stripes('#3d74c8', '#fbf7ee', 8, false));
  T.awnGreen = A.tile(128, 128, stripes('#3f9a58', '#fbf7ee', 8, false));
  T.awnOrange = A.tile(128, 128, stripes('#e88a2a', '#fbf7ee', 8, false));
  T.awnPurple = A.tile(128, 128, stripes('#8a5cc4', '#fbf7ee', 8, false));
  const sign = (bg, fg, text, font = ROUND, deco) => (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 6; x.strokeRect(3, 3, w - 6, h - 6);
    deco && deco(x, w, h);
    x.fillStyle = fg; x.font = `800 ${Math.round(h * .62)}px ${font}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, w / 2, h * .54, w * .9);
  };
  const waves = col => (x, w, h) => { x.fillStyle = col; for (let k = 0; k < 2; k++) { x.beginPath(); for (let u = 0; u <= w; u += 6) x.lineTo(u, h * (.78 + k * .1) + Math.sin(u * .05 + k) * 4); x.lineTo(w, h); x.lineTo(0, h); x.closePath(); x.globalAlpha = .45 + k * .3; x.fill(); } x.globalAlpha = 1; };
  T.signKaki = A.tile(512, 112, sign('#fbf7ee', '#d8343c', 'かき氷', ROUND, waves('#3d74c8')));
  T.signGold = A.tile(512, 112, sign('#bfe6f7', '#d8343c', '金魚すくい', ROUND, (x, w, h) => { for (const [u, s] of [[.08, 1], [.92, -1]]) { x.save(); x.translate(u * w, h * .5); x.scale(s, 1); x.fillStyle = '#ff6a2a'; x.beginPath(); x.ellipse(0, 0, 16, 9, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(-12, 0); x.lineTo(-26, -10); x.lineTo(-26, 10); x.fill(); x.restore(); } }));
  T.signMask = A.tile(512, 112, sign('#f7d046', '#2a2426', 'お面', BRUSH));
  T.signSoba = A.tile(512, 112, sign('#c8302a', '#fbf7ee', '焼きそば', BRUSH));
  T.signWata = A.tile(512, 112, sign('#f6a8c4', '#fbf7ee', 'わたあめ', ROUND));
  T.signRingo = A.tile(512, 112, sign('#fbf7ee', '#c8302a', 'りんごあめ', ROUND));
  T.signShateki = A.tile(512, 112, sign('#2f7a4a', '#fbf7ee', '射的', BRUSH));
  T.signIce = A.tile(512, 112, sign('#fbf7ee', '#2f6fd0', '氷屋', BRUSH, waves('#9fd3ff')));
  T.price = A.tile(256, 80, sign('#fbf7ee', '#2a2426', '一杯 300円', ROUND));
  T.priceGold = A.tile(256, 80, sign('#fbf7ee', '#2a2426', '一回 300円', ROUND));
  T.priceMask = A.tile(256, 80, sign('#fbf7ee', '#2a2426', 'お面 600円', ROUND));
  T.norenKaki = A.tile(384, 128, (x, w, h) => {
    x.fillStyle = '#fbfbf7'; x.fillRect(0, 0, w, h);
    waves('#3d74c8')(x, w, h);
    x.fillStyle = '#d8343c'; x.font = `800 ${h * .55}px ${ROUND}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) x.fillText('氷', w * (i + .5) / 3, h * .42);
    x.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 1; i < 3; i++) x.fillRect(w * i / 3 - 1, 0, 3, h);
  });
  T.norenIndigo = A.tile(384, 128, (x, w, h) => { x.fillStyle = '#26376a'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.8)'; x.font = `600 ${h * .5}px ${BRUSH}`; x.textAlign = 'center'; x.textBaseline = 'middle'; ['祭', '夏', '祭'].forEach((c, i) => x.fillText(c, w * (i + .5) / 3, h * .45)); x.fillStyle = 'rgba(0,0,0,.4)'; for (let i = 1; i < 3; i++) x.fillRect(w * i / 3 - 1, 0, 3, h); });
  T.koshi = A.tile(256, 256, (x, w, h) => { x.fillStyle = '#5a3a26'; x.fillRect(0, 0, w, h); x.fillStyle = '#7a5236'; for (let i = 0; i < 16; i++) x.fillRect(i * 16 + 2, 0, 9, h); x.fillStyle = '#4a2e1e'; x.fillRect(0, 0, w, 10); x.fillRect(0, h - 10, w, 10); x.fillRect(0, h / 2 - 4, w, 8); });
  T.plaster = A.tile(256, 256, (x, w, h) => { x.fillStyle = '#e9dcc4'; x.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(120,90,60,${rand(.02, .07)})`; x.fillRect(rand(0, w), rand(0, h), rand(2, 9), rand(2, 9)); } x.fillStyle = '#5a3a26'; x.fillRect(0, 0, 10, h); x.fillRect(w - 10, 0, 10, h); x.fillRect(0, h * .52, w, 8); });
  T.shoji = A.tile(256, 256, (x, w, h) => { const g = x.createRadialGradient(w / 2, h * .6, 10, w / 2, h / 2, w * .7); g.addColorStop(0, '#fff2c8'); g.addColorStop(1, '#f2b45a'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = '#5a3a26'; for (let i = 0; i <= 4; i++) x.fillRect(i * (w - 6) / 4, 0, 6, h); for (let j = 0; j <= 5; j++) x.fillRect(0, j * (h - 6) / 5, w, 6); });
  T.shutter = A.tile(256, 256, (x, w, h) => { x.fillStyle = '#8a8f96'; x.fillRect(0, 0, w, h); for (let j = 0; j < h; j += 9) { x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, j, w, 2); x.fillStyle = 'rgba(255,255,255,.12)'; x.fillRect(0, j + 2, w, 2); } });
  T.tiles = A.tile(256, 128, (x, w, h) => { x.fillStyle = '#3c3f48'; x.fillRect(0, 0, w, h); for (let j = 0; j < h; j += 16) for (let i = (j / 16) % 2 * 12; i < w; i += 24) { x.fillStyle = 'rgba(255,255,255,.08)'; x.fillRect(i, j, 20, 4); x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(i, j + 12, 20, 4); } });
  T.pegboard = A.tile(256, 256, (x, w, h) => { x.fillStyle = '#d9b98a'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(80,50,30,.45)'; for (let j = 10; j < h; j += 20) for (let i = 10; i < w; i += 20) { x.beginPath(); x.arc(i, j, 2.4, 0, 7); x.fill(); } });
  T.plaque = A.tile(128, 256, (x, w, h) => { x.fillStyle = '#20181a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d9a640'; x.lineWidth = 6; x.strokeRect(6, 6, w - 12, h - 12); x.fillStyle = '#e8bf5a'; x.font = `600 ${w * .58}px ${BRUSH}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('神', w / 2, h * .32); x.fillText('社', w / 2, h * .7); });
  T.glow = A.tile(64, 64, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, '#fff6d8'); g.addColorStop(1, '#ffb050'); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  T.shopSigns = ['酒', '米', '茶', '菓子', '本', '薬', '鮨', '湯'].map(t => A.tile(96, 192, (x, w, h) => { x.fillStyle = '#2a2024'; x.fillRect(0, 0, w, h); x.fillStyle = '#f4e6c8'; x.font = `600 ${t.length > 1 ? w * .5 : w * .66}px ${BRUSH}`; x.textAlign = 'center'; x.textBaseline = 'middle'; [...t].forEach((c, i) => x.fillText(c, w / 2, h * (t.length > 1 ? .3 + i * .4 : .5))); }));
  document.fonts?.load(`800 40px ${ROUND}`, 'かき氷金魚すくい').then(() => document.fonts.load(`600 40px ${BRUSH}`, 'お面焼きそば射的氷屋祭夏神社酒米茶菓子本薬鮨湯')).then(() => A.repaint()).catch(() => { });
  return A;
}
export const getAtlas = () => atlas();

// ── materials (shared across plays; the runner only disposes geometry) ──
let MATS = null;
function mats() {
  if (MATS) return MATS;
  const a = atlas();
  MATS = {
    flat: toon(0xffffff, { vertexColors: true }),
    paint: toon(0xffffff, { vertexColors: true, map: a.tex }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, map: a.tex }),
  };
  return MATS;
}
export const streetMats = () => mats();

// ── lanterns (instanced) ──
function paperTex(ch, ink) {
  return canvasTex(256, 128, (x, w, h) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
    x.fillStyle = 'rgba(70,40,30,.3)'; for (let k = 1; k < 11; k++) x.fillRect(0, k * h / 11 - 1, w, 2);
    x.fillStyle = ink; x.font = `600 58px ${BRUSH}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ch, w * .25, h * .52); x.fillText(ch, w * .75, h * .52);
  });
}
let LMATS = null;
function lanternMats() {
  if (LMATS) return LMATS;
  const red = paperTex('祭', '#2a1a1a'), white = paperTex('祭', '#c8303a');
  LMATS = {
    red: toon(0xd8343c, { map: red, emissive: 0xff5a40, emissiveMap: red, emissiveIntensity: .1 }),
    white: toon(0xf3ece2, { map: white, emissive: 0xffc070, emissiveMap: white, emissiveIntensity: .1 }),
    cap: toon(0x2a2024),
    string: toon(0x2a2024),
  };
  document.fonts?.load(`600 58px ${BRUSH}`, '祭').then(() => {
    for (const [k, ink] of [['red', '#2a1a1a'], ['white', '#c8303a']]) { const t = LMATS[k].map, x = t.userData.x; x.clearRect(0, 0, 256, 128); x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 128); x.fillStyle = 'rgba(70,40,30,.3)'; for (let i = 1; i < 11; i++) x.fillRect(0, i * 128 / 11 - 1, 256, 2); x.fillStyle = ink; x.font = `600 58px ${BRUSH}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('祭', 64, 66); x.fillText('祭', 192, 66); t.needsUpdate = true; }
  }).catch(() => { });
  return LMATS;
}

// ── the set ──
export function buildStreet(root, tier) {
  const a = atlas(), M = mats(), B = new Bucket(), lan = [], strings = [];
  const add = (k, g, o) => B.add(k, g, o);

  // ground: packed earth with stones, the river side turns to grass
  const groundTex = canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = '#b6a183'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 2200; i++) { const v = rand(-24, 24); x.fillStyle = `rgba(${120 + v},${100 + v},${80 + v},${rand(.08, .25)})`; x.fillRect(rand(0, w), rand(0, h), rand(1, 4), rand(1, 4)); }
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(90,75,60,${rand(.15, .3)})`; x.beginPath(); x.ellipse(rand(0, w), rand(0, h), rand(4, 11), rand(3, 7), rand(0, 3), 0, 7); x.fill(); }
  });
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping; groundTex.repeat.set(16, 4);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(70, 18), toon(0xffffff, { map: groundTex }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(-12, 0, 3); ground.receiveShadow = true; root.add(ground);
  // stone curb along the shopfronts, a drainage gutter
  add('flat', box(57, .12, .5), { x: -6.5, y: .06, z: -4.9, color: 0x8d877d });

  // ── yatai ──
  const yatai = (cx, { w = 4.4, d = 1.9, roof = T.awnRed, sign = T.signKaki, noren = null, counter = .55, front = FRONT, glowBack = true } = {}) => {
    const back = front - d, wood = 0x8a5a36;
    for (const sx of [-1, 1]) {
      add('flat', box(.12, 2.75, .12), { x: cx + sx * w / 2, y: 1.375, z: front, color: wood });
      add('flat', box(.12, 2.95, .12), { x: cx + sx * w / 2, y: 1.475, z: back, color: wood });
      add('flat', box(.08, .08, d), { x: cx + sx * w / 2, y: 2.62, z: front - d / 2, color: wood });
    }
    // counter, its kōhaku skirt, and the lit back of the stall
    if (counter) {
      add('flat', box(w, .08, .72), { x: cx, y: counter - .04, z: front - .36, color: 0xb88a58 });
      add('paint', new THREE.PlaneGeometry(w - .1, counter - .1), { x: cx, y: (counter - .1) / 2 + .02, z: front + .005, tile: T.kohaku });
    }
    add(glowBack ? 'glow' : 'paint', new THREE.PlaneGeometry(w - .14, 2.2), { x: cx, y: 1.25, z: back + .03, tile: T.glow, color: glowBack ? 0xb07a48 : 0xffffff });
    add('flat', box(w, .06, d), { x: cx, y: .03, z: front - d / 2, color: 0x6a4a32 });
    // roof: a striped canvas awning sloping toward the street, with a painted sign board
    add('paint', box(w + .5, .06, d + .7), { x: cx, y: 2.86, z: front - d / 2 + .2, rx: -.16, tile: roof });
    add('paint', new THREE.PlaneGeometry(w + .3, .5), { x: cx, y: 2.52, z: front + .29, tile: sign });
    add('flat', box(w + .32, .52, .05), { x: cx, y: 2.52, z: front + .25, color: 0x5a3a26 });
    if (noren) add('paint', new THREE.PlaneGeometry(w - .2, .42), { x: cx, y: 2.06, z: front + .2, tile: noren });
    lan.push({ x: cx - w / 2 - .05, y: 2.2, z: front + .32, red: true, s: .7, stall: cx }, { x: cx + w / 2 + .05, y: 2.2, z: front + .32, red: true, s: .7, stall: cx });
  };
  yatai(X.stall, { w: 6.2, roof: T.awnBlue, sign: T.signKaki, noren: T.norenKaki });
  yatai(X.gold, { w: 4.6, d: 2.6, roof: T.awnBlue, sign: T.signGold, counter: 0 });
  yatai(X.mask, { w: 4.4, roof: T.awnOrange, sign: T.signMask });
  yatai(-6, { w: 3.8, roof: T.awnRed, sign: T.signSoba, noren: T.norenIndigo });
  yatai(-16, { w: 3.6, roof: T.awnPurple, sign: T.signWata });
  yatai(16.2, { w: 3.8, roof: T.awnRed, sign: T.signRingo });
  yatai(20.4, { w: 3.4, roof: T.awnGreen, sign: T.signShateki });
  yatai(X.ice, { w: 3.6, roof: T.awnBlue, sign: T.signIce, noren: T.norenIndigo });
  // price boards
  add('paint', new THREE.PlaneGeometry(.9, .28), { x: X.stall + 3.4, y: 1.55, z: FRONT + .1, tile: T.price });
  add('paint', new THREE.PlaneGeometry(.9, .28), { x: X.gold + 2.55, y: 1.55, z: FRONT + .1, tile: T.priceGold });
  add('paint', new THREE.PlaneGeometry(.9, .28), { x: X.mask - 2.45, y: 1.55, z: FRONT + .1, tile: T.priceMask });

  // decor on the other stalls: yakisoba griddle, cotton candy bags, candy apples, the shooting gallery shelf
  add('flat', box(2.4, .12, .9), { x: -6, y: .64, z: FRONT - .55, color: 0x2e2e34 });
  for (let i = 0; i < 6; i++) add('flat', sph(.13, 8, 6), { x: -6.8 + i * .32, y: .72, z: FRONT - .5 + (i % 2) * .15, sy: .35, color: 0x9a6a3a });
  for (let i = 0; i < 7; i++) add('flat', sph(.2, 10, 8), { x: -17.3 + i * .5, y: 1.9 - (i % 2) * .25, z: FRONT - .15, sy: 1.3, color: [0xf6b8d4, 0xbfe0ff, 0xfff0a8][i % 3] });
  for (let i = 0; i < 12; i++) { const ax = 14.8 + (i % 6) * .45, ay = .78 + Math.floor(i / 6) * .38; add('flat', sph(.13, 10, 8), { x: ax, y: ay, z: FRONT - .55 + Math.floor(i / 6) * -.3, color: 0xc8202a }); add('flat', cyl(.012, .012, .3, 4), { x: ax, y: ay + .2, z: FRONT - .55 + Math.floor(i / 6) * -.3, color: 0xe8dcc0 }); }
  for (let j = 0; j < 3; j++) { add('flat', box(2.9, .06, .3), { x: 20.4, y: .9 + j * .45, z: FRONT - 1.5, color: 0x8a5a36 }); for (let i = 0; i < 5; i++) add('flat', box(.18, .22 + (i % 3) * .06, .14), { x: 19.3 + i * .55, y: 1.05 + j * .45, z: FRONT - 1.5, color: [0xf2c14e, 0x58b8e8, 0xe8586a, 0x7bd88f, 0xc7a6e8][(i + j) % 5] }); }
  // ice shop: a chest of blocks
  add('flat', box(1.6, .5, .7), { x: X.ice - .5, y: .8, z: FRONT - .55, color: 0x5fb3b8 });
  for (let i = 0; i < 3; i++) add('flat', box(.34, .3, .34), { x: X.ice - 1.05 + i * .4, y: 1.18, z: FRONT - .55, color: 0xdff6ff });

  // ── machiya shopfronts ──
  const SZ = -5.4;
  let sx = -30, n = 0;
  while (sx < X.shopsEnd - 1) {
    const w = Math.min(rand(4, 5.2), X.shopsEnd - sx), cx = sx + w / 2, h2 = n % 3 !== 1;
    add('paint', box(w - .06, h2 ? 4.4 : 3.2, 3), { x: cx, y: h2 ? 2.2 : 1.6, z: SZ - 1.5, tile: T.plaster, color: n % 2 ? 0xffffff : 0xeadfce });
    add('paint', new THREE.PlaneGeometry(w - .3, 1.9), { x: cx, y: 1.05, z: SZ + .01, tile: n % 4 === 3 ? T.shutter : T.koshi });
    if (n % 4 !== 3) add('glow', new THREE.PlaneGeometry(w * .42, 1.3), { x: cx + (n % 2 ? .6 : -.6), y: 1.0, z: SZ + .02, tile: T.shoji, color: 0xd8b088 });
    add('paint', box(w + .2, .1, 1.1), { x: cx, y: 2.3, z: SZ + .4, rx: -.38, tile: T.tiles });
    if (h2) { add('glow', new THREE.PlaneGeometry(w * .6, .5), { x: cx, y: 3.25, z: SZ + .02, tile: T.shoji, color: n % 2 ? 0xc89868 : 0xa07850 }); add('paint', box(w + .25, .12, 1.4), { x: cx, y: 4.5, z: SZ - .2, rx: -.45, tile: T.tiles }); }
    else add('paint', box(w + .25, .12, 1.4), { x: cx, y: 3.3, z: SZ - .2, rx: -.45, tile: T.tiles });
    add('paint', new THREE.PlaneGeometry(.42, .84), { x: cx - w / 2 + .45, y: 2.9 - (h2 ? 0 : .6), z: SZ + .05, tile: T.shopSigns[n % T.shopSigns.length] });
    sx += w; n++;
  }

  // ── torii and the shrine steps ──
  {
    const tx = X.torii, tz = -1.9, red = 0xd8432a, blk = 0x2a2426;
    for (const s of [-1, 1]) { add('flat', cyl(.15, .17, 4.3, 12), { x: tx + s * 1.35, y: 2.15, z: tz, color: red }); add('flat', cyl(.22, .22, .3, 12), { x: tx + s * 1.35, y: .15, z: tz, color: blk }); }
    add('flat', box(3.9, .24, .34), { x: tx, y: 4.3, z: tz, color: red });
    add('flat', box(4.2, .14, .4), { x: tx, y: 4.48, z: tz, color: blk });
    add('flat', box(3.3, .18, .22), { x: tx, y: 3.65, z: tz, color: red });
    add('paint', new THREE.PlaneGeometry(.42, .8), { x: tx, y: 3.95, z: tz + .13, tile: T.plaque });
    for (let i = 0; i < 9; i++) add('flat', box(3.2, .26, .62), { x: tx, y: .13 + i * .26, z: tz - .7 - i * .6, color: 0x8f8a82 });
    for (const s of [-1, 1]) { const lx = tx + s * 2.3, lz = tz + .2; add('flat', box(.5, .16, .5), { x: lx, y: .08, z: lz, color: 0x9a958c }); add('flat', cyl(.09, .09, .9, 8), { x: lx, y: .6, z: lz, color: 0x9a958c }); add('flat', box(.44, .36, .44), { x: lx, y: 1.22, z: lz, color: 0x9a958c }); add('glow', new THREE.PlaneGeometry(.22, .22), { x: lx, y: 1.22, z: lz + .225, tile: T.glow }); add('flat', new THREE.ConeGeometry(.42, .3, 4), { x: lx, y: 1.55, z: lz, ry: Math.PI / 4, color: 0x8a857c }); }
    // the shrine wood: dark round trees behind the steps
    for (let i = 0; i < 14; i++) add('flat', sph(rand(1.2, 2.2), 10, 8), { x: tx + rand(-6, 5), y: rand(2.5, 6.5), z: rand(-9, -6), color: [0x1f3a2c, 0x26422f, 0x1a3226][i % 3] });
  }

  // ── the river embankment at the right end ──
  {
    const grass = canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#5d8a4a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(${rand(40, 110)},${rand(100, 160)},${rand(40, 80)},.5)`; x.fillRect(rand(0, w), rand(0, h), 1.5, rand(3, 7)); } });
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping; grass.repeat.set(4, 4);
    const gm = toon(0xffffff, { map: grass });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), gm); top.rotation.x = -Math.PI / 2; top.position.set(X.shopsEnd + 8, .01, 3); top.receiveShadow = true; root.add(top);
    const slope = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), gm); slope.position.set(X.shopsEnd + 8, -1.5, -7.4); slope.rotation.x = -Math.PI / 2 + .5; slope.receiveShadow = true; root.add(slope);
    for (let i = 0; i < 6; i++) add('flat', box(.22, .7, .22), { x: X.shopsEnd + 1.5 + i * 1.6, y: .35, z: -4.1, color: 0x9a958c });
    add('flat', box(9.6, .1, .1), { x: X.shopsEnd + 5.5, y: .62, z: -4.1, color: 0x6a5a4a });
    // a hip-roofed end house so the shopfront row doesn't stop in mid-air
    add('flat', box(.3, 4.4, 3.2), { x: X.shopsEnd + .1, y: 2.2, z: SZ - 1.5, color: 0xd8c8b0 });
    const riverTex = canvasTex(512, 256, (x, w, h) => {
      const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0e1a2e'); g.addColorStop(1, '#1d3150'); x.fillStyle = g; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { const u = rand(0, w), c = ['255,190,110', '255,120,90', '200,220,255'][i % 3]; for (let k = 0; k < 14; k++) { x.fillStyle = `rgba(${c},${rand(.15, .5)})`; x.fillRect(u + rand(-6, 6), rand(0, h * .3) + k * h / 18, rand(6, 22), 2); } }
    });
    const river = new THREE.Mesh(new THREE.PlaneGeometry(140, 70), new THREE.MeshBasicMaterial({ map: riverTex, fog: false }));
    river.rotation.x = -Math.PI / 2; river.position.set(X.shopsEnd + 20, -3, -45); river.userData.noInk = true; root.add(river);
  }

  // ── hills and the far town, painted ──
  {
    const hillTex = canvasTex(2048, 512, (x, w, h) => {
      x.clearRect(0, 0, w, h);
      const ridge = (base, amp, f, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, h); for (let u = 0; u <= w; u += 8) x.lineTo(u, base - amp * (Math.sin(u * f) * .6 + Math.sin(u * f * 2.7 + 1) * .3 + Math.sin(u * f * 6.1 + 2) * .1)); x.lineTo(w, h); x.closePath(); x.fill(); };
      ridge(h * .42, h * .2, .004, '#2b3550'); ridge(h * .6, h * .14, .007, '#222a40');
      for (let i = 0; i < 260; i++) { const u = rand(0, w), v = rand(h * .66, h * .98); x.fillStyle = `rgba(255,${rand(170, 220)},${rand(90, 150)},${rand(.4, .9)})`; x.fillRect(u, v, rand(2, 4), rand(2, 3)); }
      ridge(h * .82, h * .05, .02, '#1a2134');
      for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(255,${rand(180, 230)},${rand(100, 160)},${rand(.5, 1)})`; x.fillRect(rand(0, w), rand(h * .86, h), 3, 2); }
    });
    const hills = new THREE.Mesh(new THREE.PlaneGeometry(420, 105), new THREE.MeshBasicMaterial({ map: hillTex, transparent: true, depthWrite: false, fog: false }));
    hills.position.set(0, 18, -150); hills.userData.noInk = true; hills.renderOrder = -1; root.add(hills);
  }

  // ── lantern strings: one along the stall fronts, one high in the foreground ──
  const string = (x0, x1, y, z, sag, every, period, redEvery = 2, s = 1) => {
    const pts = [];
    for (let x = x0; x <= x1 + 1e-6; x += .25) { const t = ((x - x0) % period) / period; pts.push(new V3(x, y - sag * 4 * t * (1 - t), z)); }
    strings.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, .014, 4));
    let i = 0;
    for (let x = x0 + every / 2; x < x1; x += every, i++) { const t = ((x - x0) % period) / period; lan.push({ x, y: y - sag * 4 * t * (1 - t) - .05, z, red: i % redEvery === 0, s }); }
  };
  string(-30, X.shopsEnd, 3.75, FRONT + .55, .32, 1.15, 5.75);
  string(-30, 31, 5.35, 3.2, .45, 1.6, 8, 3, 1.15);
  const wires = strings.map(g => { const m = new THREE.Mesh(prep(g), lanternMats().string); g.dispose(); m.castShadow = false; root.add(m); return m; });

  const L = lanternMats(), body = new THREE.SphereGeometry(.26, 14, 10), cap = new THREE.CylinderGeometry(.12, .12, .07, 10);
  const reds = lan.filter(l => l.red), whites = lan.filter(l => !l.red);
  const mkInst = (geo, mat, list, k = 1) => { const im = new THREE.InstancedMesh(geo, mat, list.length * k); im.castShadow = false; im.receiveShadow = false; im.frustumCulled = false; root.add(im); return im; };
  const lanterns = { list: lan, red: mkInst(body, L.red, reds), white: mkInst(body, L.white, whites), caps: mkInst(cap, L.cap, lan, 2), reds, whites, mats: L, frontWire: wires[1] };
  lan.forEach(l => { l.ph = rand(0, 6); });
  // the scenery takes shadows but doesn't cast them: a low dusk sun turns every awning into a long slab on the street
  const parts = B.build(root, M, { shadow: false, noShadow: ['glow'] });
  // the far shopfronts don't need to cast shadows (the key light is a dusk sun, then the moon)
  return { lanterns, parts, ground, atlas: a, T };
}

// lanterns sway in the breeze and glow up as the night comes on
const _o = new THREE.Object3D();
export function updateLanterns(L, wind, hideFront = false) {
  const t = G.time, glow = smooth(.6, .95, G.phase);
  L.frontWire.visible = !hideFront;
  L.mats.red.emissiveIntensity = .08 + glow * .95; L.mats.white.emissiveIntensity = .08 + glow * .9;
  let ri = 0, wi = 0, ci = 0;
  for (const l of L.list) {
    const rz = Math.sin(t * 1.3 + l.ph) * .06 * wind, rx = Math.sin(t * .9 + l.ph) * .04 * wind;
    const k = hideFront && (l.z > 2 || Math.abs(l.x - X.gold) < 2.7) ? 1e-4 : 1;
    _o.position.set(l.x, l.y, l.z); _o.rotation.set(rx, 0, rz); _o.scale.set(l.s * k, l.s * 1.18 * k, l.s * k); _o.updateMatrix();
    // the body hangs below the pivot
    _o.translateY(-.3); _o.updateMatrix();
    (l.red ? L.red : L.white).setMatrixAt(l.red ? ri++ : wi++, _o.matrix);
    for (const dy of [.27, -.27]) { _o.position.set(l.x, l.y, l.z); _o.rotation.set(rx, 0, rz); _o.scale.setScalar(l.s * k); _o.translateY(-.3 + dy * l.s * 1.18); _o.updateMatrix(); L.caps.setMatrixAt(ci++, _o.matrix); }
  }
  L.red.instanceMatrix.needsUpdate = L.white.instanceMatrix.needsUpdate = L.caps.instanceMatrix.needsUpdate = true;
}

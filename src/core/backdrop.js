// The view from the balcony, painted: the hillside town right below, the city in the haze, the
// mountains, the big trees beside the railing, the power lines. Every building and tree is a sprite cut from one
// procedurally painted atlas and drawn unlit — paint × the sky's light, faded into the horizon
// haze with distance, windows lit from a second (mask) atlas at night. Sky.js drives it through
// backdrop.update(); it paints itself on the first call, once the quality tier is known.
import { THREE, scene } from './gfx.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { smooth } from './util.js';

// ── painting helpers (sRGB 0..255 triples) ──
function seeded(s) {
  let a = s >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
// anime shading: shadows shift toward blue-violet, light toward warm white
const shade = (c, k = 1) => mix(c, [c[0] * .55, c[1] * .6, c[2] * .78 + 22], k);
const lit = (c, k = 1) => mix(c, [255, 247, 228], k * .55);
const pick = (r, a) => a[Math.floor(r() * a.length)];

const WALLS = [[240, 233, 219], [245, 242, 235], [224, 208, 184], [210, 213, 216], [203, 213, 222], [228, 199, 164], [238, 222, 208], [216, 226, 214]];
const APT = [[242, 238, 228], [230, 226, 216], [236, 220, 200], [214, 218, 222], [226, 210, 196], [200, 156, 128], [244, 236, 214]];
const ROOFS = [[70, 84, 108], [58, 66, 82], [112, 79, 62], [160, 88, 64], [86, 104, 98], [50, 62, 88], [126, 66, 54], [96, 100, 114]];
const TOWERS = [[150, 168, 196], [176, 186, 204], [128, 150, 182], [190, 192, 204], [112, 136, 170]];
const LAUNDRY = [[250, 250, 250], [240, 190, 196], [180, 210, 240], [246, 226, 150], [200, 232, 200]];
// [shadow, mid, light, highlight]
const GREENS = [
  [[38, 76, 66], [72, 124, 66], [132, 174, 80], [204, 226, 132]],
  [[30, 62, 60], [54, 104, 72], [100, 152, 86], [168, 206, 116]],
  [[46, 88, 62], [96, 144, 68], [156, 194, 86], [222, 236, 146]],
  [[34, 60, 70], [60, 100, 92], [104, 146, 116], [160, 194, 156]],
];

// a leafy clump outline: a disc ringed with small leaf-cluster bumps
function clumpPath(cx, cy, rad, r, bumps = 11) {
  const p = new Path2D(), n = bumps + (r() * 4 | 0);
  p.moveTo(cx + rad * .9, cy); p.arc(cx, cy, rad * .9, 0, Math.PI * 2);
  for (let i = 0; i < n; i++) {
    const a = (i + r() * .5) / n * Math.PI * 2, rr = rad * (.78 + r() * .12), br = rad * (.2 + r() * .14);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    p.moveTo(x + br, y); p.arc(x, y, br, 0, Math.PI * 2);
  }
  return p;
}
// one cauliflower clump in three cel tones, lit from the upper right, with painted leaf dabs
function clump(x, cx, cy, rad, r, G4, dabs = 1) {
  const P = clumpPath(cx, cy, rad, r);
  x.fillStyle = css(G4[0]); x.fill(P);
  x.save(); x.clip(P);
  x.fillStyle = css(G4[1]); x.fill(clumpPath(cx + rad * .14, cy - rad * .2, rad * .8, r, 9));
  x.fillStyle = css(G4[2]); x.fill(clumpPath(cx + rad * .3, cy - rad * .4, rad * .5, r, 7));
  const n = Math.floor(rad * rad * .09 * dabs) + 12;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * rad * 1.05, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
    const t = ((px - cx) * .55 - (py - cy) * .85) / rad + (r() - .5) * .35;
    const c = t > .55 ? G4[3] : t > .1 ? G4[2] : t > -.35 ? G4[1] : G4[0];
    x.fillStyle = css(c, .5 + r() * .4);
    x.beginPath(); x.ellipse(px, py, rad * (.05 + r() * .06), rad * (.028 + r() * .03), r() * Math.PI, 0, Math.PI * 2); x.fill();
  }
  const g = x.createLinearGradient(0, cy + rad * .1, 0, cy + rad);
  g.addColorStop(0, css(G4[0], 0)); g.addColorStop(1, css(shade(G4[0], .7), .6));
  x.fillStyle = g; x.fillRect(cx - rad * 1.3, cy, rad * 2.6, rad * 1.2);
  x.restore();
}
function canopy(x, w, h, r, { trunk = true, n = 7, size = .17, dabs = 1, top = .08 } = {}) {
  const G4 = pick(r, GREENS);
  if (trunk) {
    const tw = w * .045, bx = w * (.47 + r() * .06);
    x.fillStyle = css([92, 70, 58]); x.fillRect(bx - tw, h * .55, tw * 2, h * .45);
    x.fillStyle = css([132, 104, 82]); x.fillRect(bx, h * .55, tw * .8, h * .45);
    x.strokeStyle = css([92, 70, 58]); x.lineWidth = tw * .9; x.lineCap = 'round';
    for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(bx, h * .72); x.lineTo(bx + (r() - .5) * w * .5, h * (.4 + r() * .15)); x.stroke(); }
  }
  const blobs = [], cx = w / 2, cy = h * (trunk ? .4 : .5), rx = w * .34, ry = h * (trunk ? .3 : .36);
  blobs.push([cx, cy + ry * .1, Math.min(rx, ry) * .95]);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r());
    blobs.push([cx + Math.cos(a) * rx * d, Math.max(h * top + w * size, cy + Math.sin(a) * ry * d), w * size * (.75 + r() * .5)]);
  }
  blobs.sort((a, b) => a[1] - b[1]);
  for (const [bx, by, br] of blobs) clump(x, bx, by, Math.min(br, bx, w - bx), r, G4, dabs);
}

// kawara: rows of tiles with a sheen line on each row, faint seams between tiles
function tiles(x, path, x0, x1, y0, y1, roof, row) {
  x.save(); x.clip(path);
  const g = x.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, css(roof)); g.addColorStop(1, css(shade(roof, .35)));
  x.fillStyle = g; x.fillRect(x0, y0, x1 - x0, y1 - y0);
  const gl = x.createLinearGradient(x0, 0, x1, 0);
  gl.addColorStop(0, css(lit(roof, .0), 0)); gl.addColorStop(1, css(lit(roof, .8), .45));
  x.fillStyle = gl; x.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let y = y0 + row; y < y1; y += row) {
    x.fillStyle = css(shade(roof, .8), .6); x.fillRect(x0, y, x1 - x0, row * .3);
    x.fillStyle = css(lit(roof, .9), .3); x.fillRect(x0, y - row * .18, x1 - x0, row * .14);
  }
  x.fillStyle = css(shade(roof, .9), .14);
  for (let xx = x0; xx < x1; xx += row * 1.4) x.fillRect(xx, y0, row * .22, y1 - y0);
  x.restore();
}
// a window: frame, glass with a sky reflection; the mask gets its light order and color
function win(x, m, wx, wy, ww, wh, wall, r, lightOrder = r()) {
  x.fillStyle = css(lit(wall, .5)); x.fillRect(wx - 1.5, wy - 1.5, ww + 3, wh + 3);
  x.fillStyle = css([70, 84, 104]); x.fillRect(wx, wy, ww, wh);
  x.fillStyle = css([150, 174, 200], .55); x.beginPath(); x.moveTo(wx + ww * .2, wy); x.lineTo(wx + ww * .55, wy); x.lineTo(wx + ww * .25, wy + wh); x.lineTo(wx, wy + wh); x.lineTo(wx, wy + wh * .5); x.fill();
  if (r() < .5) { x.fillStyle = css(lit(wall, .5)); x.fillRect(wx + ww / 2 - .6, wy, 1.2, wh); }
  m.fillStyle = `rgb(${(.12 + lightOrder * .88) * 255 | 0},${r() < .22 ? 255 : 0},255)`; m.fillRect(wx, wy, ww, wh);
}
function laundry(x, x0, x1, y, r) {
  x.strokeStyle = css([90, 90, 100], .7); x.lineWidth = .8; x.beginPath(); x.moveTo(x0, y); x.lineTo(x1, y); x.stroke();
  for (let xx = x0 + 2; xx < x1 - 4; xx += 4 + r() * 5) { if (r() < .3) continue; x.fillStyle = css(pick(r, LAUNDRY)); x.fillRect(xx, y, 3 + r() * 4, 4 + r() * 6); }
}

// two-storey house with a tiled roof, seen from a little above. near = more roof showing.
function house(x, m, w, h, r, near) {
  const wall = pick(r, WALLS), roof = pick(r, ROOFS);
  const bw = w * (.7 + r() * .16), L = (w - bw) / 2 + (r() - .5) * w * .06, R = L + bw, ov = w * .045;
  const top = h * (.05 + r() * .06), eave = top + (h - top) * (near ? .44 + r() * .1 : .32 + r() * .08), ground = h * .985;
  const side = bw * (.12 + r() * .06);
  // walls: front, a lit side face on the right
  x.fillStyle = css(wall); x.fillRect(L, eave - 2, bw - side, ground - eave + 2);
  x.fillStyle = css(lit(wall, .7)); x.fillRect(R - side, eave - 2, side, ground - eave + 2);
  x.fillStyle = css(shade(wall, .5), .5); x.fillRect(R - side - 1, eave, 1.4, ground - eave);
  const gw = x.createLinearGradient(0, eave, 0, ground);
  gw.addColorStop(0, css(shade(wall), .55)); gw.addColorStop(.18, css(shade(wall), .12)); gw.addColorStop(.8, css(shade(wall), .08)); gw.addColorStop(1, css(shade(wall), .4));
  x.fillStyle = gw; x.fillRect(L, eave - 2, bw, ground - eave + 2);
  const two = r() < .78, mid = eave + (ground - eave) * .47, fh = ground - eave;
  // windows (upper floor, lower floor), a door, maybe a balcony with laundry
  const floors = two ? [[eave + fh * .1, mid - fh * .06], [mid + fh * .1, ground - fh * .06]] : [[eave + fh * .16, ground - fh * .08]];
  floors.forEach(([y0, y1], fi) => {
    const n = 1 + (r() * 3 | 0), span = bw - side - 8;
    for (let i = 0; i < n; i++) {
      const ww = Math.min(span / n - 6, 10 + r() * 12), wh = Math.min((y1 - y0) * .8, 8 + r() * 10);
      const wx = L + 4 + (i + .5) * span / n - ww / 2, wy = y0 + (y1 - y0 - wh) * .4;
      if (fi === floors.length - 1 && i === n - 1 && r() < .7) { // front door + porch light
        x.fillStyle = css([110, 86, 70]); x.fillRect(wx + ww * .3, y1 - (y1 - y0) * .92, Math.max(5, ww * .45), (y1 - y0) * .92);
        x.fillStyle = css([250, 230, 170]); x.fillRect(wx + ww * .3 - 3, y1 - (y1 - y0) * .9, 2, 2);
        m.fillStyle = 'rgb(255,0,255)'; m.fillRect(wx + ww * .3 - 3.5, y1 - (y1 - y0) * .9 - .5, 3, 3);
      } else win(x, m, wx, wy, ww, wh, wall, r);
    }
  });
  if (two && r() < .45) {
    const by = mid - fh * .04, bx0 = L + 3, bx1 = L + (bw - side) * (.5 + r() * .4);
    laundry(x, bx0 + 2, bx1 - 2, mid - fh * .36, r);
    x.fillStyle = css(lit(wall, .4)); x.fillRect(bx0, by - fh * .14, bx1 - bx0, fh * .14);
    x.fillStyle = css(shade(wall, .7), .8); x.fillRect(bx0, by, bx1 - bx0, 1.5);
  }
  if (r() < .4) { // air conditioner
    const ax = R - side - 14 - r() * 10, ay = ground - fh * .25;
    x.fillStyle = css([236, 236, 230]); x.fillRect(ax, ay, 11, 7); x.fillStyle = css([150, 154, 160]); x.beginPath(); x.arc(ax + 6.5, ay + 3.5, 2.4, 0, 7); x.fill();
  }
  if (two) { // the little roof between the floors
    const p = new Path2D(); p.rect(L - ov * .6, mid - fh * .085, bw + ov * 1.2, fh * .085);
    tiles(x, p, L - ov, R + ov, mid - fh * .085, mid, roof, Math.max(2.5, fh * .03));
    x.fillStyle = css(shade(wall), .6); x.fillRect(L, mid, bw, fh * .04);
  }
  // main roof: hipped (yosemune) or gabled (kirizuma)
  const p = new Path2D();
  if (r() < .65) { const k = bw * (.2 + r() * .1); p.moveTo(L - ov, eave); p.lineTo(R + ov, eave); p.lineTo(R - k, top); p.lineTo(L + k, top); p.closePath(); }
  else { const k = bw * .06; p.moveTo(L - ov, eave); p.lineTo(R + ov, eave); p.lineTo(R + ov - k, top); p.lineTo(L - ov + k, top); p.closePath(); }
  tiles(x, p, L - ov, R + ov, top, eave, roof, Math.max(3, (eave - top) / (near ? 9 : 6)));
  x.strokeStyle = css(lit(roof, .9)); x.lineWidth = 2.2; x.lineCap = 'round'; x.stroke(p);
  x.strokeStyle = css(shade(roof, .8)); x.lineWidth = 1.6; x.beginPath(); x.moveTo(L - ov, eave); x.lineTo(R + ov, eave); x.stroke();
  x.fillStyle = css(shade(wall), .7); x.fillRect(L, eave, bw, Math.max(2, fh * .05));
  if (r() < .25) { // solar panels
    const sx = L + bw * (.28 + r() * .1), sw = bw * .32, sy = top + (eave - top) * .3, sh = (eave - top) * .45;
    x.fillStyle = css([44, 58, 96]); x.fillRect(sx, sy, sw, sh);
    x.fillStyle = css([140, 170, 220], .45); x.fillRect(sx, sy, sw * .4, sh * .3);
    x.strokeStyle = css([110, 124, 160], .7); x.lineWidth = .7; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(sx + sw * i / 4, sy); x.lineTo(sx + sw * i / 4, sy + sh); x.stroke(); }
  }
  if (r() < .35) { // tv aerial
    const axx = L + bw * (.3 + r() * .4);
    x.strokeStyle = css([70, 70, 80], .85); x.lineWidth = 1;
    x.beginPath(); x.moveTo(axx, top + 2); x.lineTo(axx, top - h * .05); for (let i = 0; i < 3; i++) { x.moveTo(axx - 6 + i, top - h * .05 + i * 3); x.lineTo(axx + 6 - i, top - h * .05 + i * 3); } x.stroke();
  }
  // a block wall or a hedge along the street
  m.fillStyle = '#000'; m.fillRect(L - ov, ground - h * .1, bw + ov * 2, h * .1);
  if (r() < .55) {
    x.fillStyle = css([186, 184, 176]); x.fillRect(L - ov, ground - h * .07, bw + ov * 2, h * .07);
    x.fillStyle = css([150, 150, 150], .6); x.fillRect(L - ov, ground - h * .07, bw + ov * 2, 1.4);
  } else {
    const G4 = pick(r, GREENS);
    for (let xx = L - ov + 6; xx < R + ov - 4; xx += 9 + r() * 6) clump(x, xx, ground - h * .05, 6 + r() * 3, r, G4, .6);
  }
}

// an apartment block (manshon) with stacked balconies; tall = more floors
function apartment(x, m, w, h, r, tall) {
  const wall = pick(r, APT);
  const bw = w * (.84 + r() * .12), L = (w - bw) / 2, R = L + bw, side = bw * (.13 + r() * .07), fw = bw - side;
  const top = h * (tall ? .05 : .1) + r() * h * .05, floors = tall ? 7 + (r() * 4 | 0) : 3 + (r() * 3 | 0);
  const fh = (h - top - h * .05) / floors;
  x.fillStyle = css(wall); x.fillRect(L, top, fw, h - top);
  x.fillStyle = css(lit(wall, .6)); x.fillRect(L + fw, top, side, h - top);
  x.fillStyle = css(lit(wall, .9)); x.fillRect(L - 1, top - 3, bw + 2, 4);
  if (r() < .6) { // rooftop: a water tank or the lift housing
    const tx = L + fw * (.15 + r() * .6), tw = fw * .14;
    x.fillStyle = css(shade(wall, .25)); x.fillRect(tx, top - h * .05, tw, h * .05);
    x.fillStyle = css(lit(wall, .7)); x.fillRect(tx + tw * .6, top - h * .05, tw * .4, h * .05);
  }
  const units = Math.max(2, Math.round(fw / (14 + r() * 8)));
  const uw = fw / units, rail = r() < .5;
  for (let f = 0; f < floors; f++) {
    const y0 = top + 4 + f * fh;
    x.fillStyle = css(shade(wall, .75)); x.fillRect(L + 1, y0, fw - 2, fh * .6);
    for (let u = 0; u < units; u++) {
      const ux = L + u * uw;
      win(x, m, ux + uw * .14, y0 + fh * .1, uw * (.42 + r() * .2), fh * .44, shade(wall, .3), r);
      if (r() < .3) laundry(x, ux + 2, ux + uw - 2, y0 + fh * .12, r);
      x.fillStyle = css(shade(wall, .9), .7); x.fillRect(ux, y0, 1.2, fh);
    }
    // balcony parapet: solid, or a rail you can see through
    if (rail) {
      x.fillStyle = css(lit(wall, .3)); x.fillRect(L, y0 + fh * .6, fw, fh * .1);
      x.fillStyle = css(shade(wall, .3), .9); x.fillRect(L, y0 + fh * .7, fw, fh * .3);
      x.fillStyle = css(lit(wall, .5), .8); for (let xx = L + 2; xx < L + fw; xx += 3) x.fillRect(xx, y0 + fh * .7, .9, fh * .3);
    } else {
      x.fillStyle = css(lit(wall, .35)); x.fillRect(L, y0 + fh * .6, fw, fh * .4);
      x.fillStyle = css(shade(wall, .6), .7); x.fillRect(L, y0 + fh * .985, fw, 1.2);
    }
    for (let k = 0; k < 2; k++) win(x, m, L + fw + side * (.2 + k * .38), y0 + fh * .25, side * .24, fh * .4, lit(wall, .6), r);
  }
  x.fillStyle = css(shade(wall, .5), .45); x.fillRect(L + fw - 1, top, 1.5, h - top);
  if (!tall && r() < .5) { // ground-floor shop with an awning
    const c = pick(r, [[200, 70, 60], [60, 120, 170], [70, 140, 90], [220, 160, 60]]);
    x.fillStyle = css(c); x.fillRect(L, h - fh * .95, fw, fh * .25);
    x.fillStyle = css([255, 255, 255], .5); for (let xx = L; xx < L + fw; xx += 8) x.fillRect(xx, h - fh * .95, 4, fh * .25);
    m.fillStyle = 'rgb(255,0,255)'; m.fillRect(L + 3, h - fh * .66, fw - 6, fh * .5);
  }
}

// a far apartment block: a few big shapes and window dots; distance does the rest
function aptFar(x, m, w, h, r) {
  const wall = pick(r, APT), bw = w * (.82 + r() * .14), L = (w - bw) / 2, side = bw * (.16 + r() * .08), fw = bw - side;
  const top = h * (.08 + r() * .2), floors = 3 + (r() * 4 | 0), fh = (h - top) / floors;
  x.fillStyle = css(wall); x.fillRect(L, top, fw, h - top);
  x.fillStyle = css(lit(wall, .6)); x.fillRect(L + fw, top, side, h - top);
  x.fillStyle = css(lit(wall, .9)); x.fillRect(L - 1, top - 2, bw + 2, 3);
  for (let f = 0; f < floors; f++) {
    const y0 = top + 3 + f * fh;
    x.fillStyle = css(shade(wall, .55), .8); x.fillRect(L + 1, y0, fw - 2, fh * .42);
    for (let xx = L + 3; xx < L + fw - 4; xx += 6 + r() * 3) {
      if (r() < .25) continue;
      x.fillStyle = css([88, 100, 124], .8); x.fillRect(xx, y0 + fh * .08, 3.5, fh * .3);
      m.fillStyle = `rgb(${(.12 + r() * .88) * 255 | 0},${r() < .2 ? 255 : 0},255)`; m.fillRect(xx, y0 + fh * .08, 3.5, fh * .3);
    }
  }
}

// downtown towers for the skyline
function tower(x, m, w, h, r) {
  const col = pick(r, TOWERS), bw = w * (.62 + r() * .3), L = (w - bw) / 2, side = bw * .3;
  const crown = r(), top = h * (.03 + r() * .08);
  x.fillStyle = css(col); x.fillRect(L, top, bw - side, h - top);
  x.fillStyle = css(lit(col, .8)); x.fillRect(L + bw - side, top, side, h - top);
  const grid = r() < .5, fl = 3 + r() * 2;
  for (let y = top + 4; y < h - 2; y += fl) {
    x.fillStyle = css(shade(col, .5), .45); x.fillRect(L, y, bw, fl * .45);
    for (let xx = L + 1; xx < L + bw - 1; xx += grid ? 3 : 5) {
      if (r() < .35) { m.fillStyle = `rgb(${(.12 + r() * .88) * 255 | 0},${r() < .45 ? 255 : 0},255)`; m.fillRect(xx, y, 1.6, fl * .45); }
    }
  }
  if (crown < .3) { x.fillStyle = css(lit(col, .3)); x.fillRect(L + bw * .2, top - h * .04, bw * .6, h * .04); }
  else if (crown < .5) { x.fillStyle = css(shade(col, .3)); x.beginPath(); x.moveTo(L, top); x.lineTo(L + bw, top); x.lineTo(L + bw, top - h * .05); x.fill(); }
  else if (crown < .75) { x.strokeStyle = css(shade(col, .6)); x.lineWidth = 1.2; x.beginPath(); x.moveTo(L + bw * .5, top); x.lineTo(L + bw * .5, top - h * .08); x.stroke(); m.fillStyle = 'rgb(255,0,255)'; m.fillRect(L + bw * .5 - 1, top - h * .08 - 1, 2, 2); }
}

// ── the atlas ──
const ITEMS = [];
const add = (kind, n, w, h, paint) => { for (let i = 0; i < n; i++) ITEMS.push({ kind, w, h, paint, seed: ITEMS.length * 7919 + 13 }); };
add('bigtree', 3, 480, 452, (x, m, w, h, r) => canopy(x, w, h, r, { n: 16, size: .13, dabs: .7, top: .05 }));
add('house', 9, 230, 200, (x, m, w, h, r) => house(x, m, w, h, r, true));
add('housefar', 8, 230, 180, (x, m, w, h, r) => house(x, m, w, h, r, false));
add('apt', 8, 300, 196, (x, m, w, h, r) => apartment(x, m, w, h, r, false));
add('mansion', 4, 190, 270, (x, m, w, h, r) => apartment(x, m, w, h, r, true));
add('tower', 9, 96, 380, (x, m, w, h, r) => tower(x, m, w, h, r));
add('aptfar', 8, 260, 150, (x, m, w, h, r) => aptFar(x, m, w, h, r));
add('clump', 10, 220, 196, (x, m, w, h, r) => canopy(x, w, h, r, { trunk: r() < .5, n: 7, size: .17 }));
const KINDS = {};
ITEMS.forEach(it => (KINDS[it.kind] ||= []).push(it));

function paintAtlas(S) {
  const pad = 8, k = S / 2048;
  const order = ITEMS.slice().sort((a, b) => b.h - a.h);
  let px = pad, py = pad, rowH = 0;
  for (const it of order) {
    if (px + it.w + pad > 2048) { px = pad; py += rowH + pad; rowH = 0; }
    it.x = px; it.y = py; px += it.w + pad; rowH = Math.max(rowH, it.h);
  }
  if (py + rowH + pad > 2048) console.warn('backdrop: atlas overflow');
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const pc = mk(), mc = mk(), x = pc.getContext('2d'), m = mc.getContext('2d');
  m.fillStyle = '#000'; m.fillRect(0, 0, S, S);
  for (const it of ITEMS) {
    for (const c of [x, m]) { c.setTransform(k, 0, 0, k, it.x * k, it.y * k); c.save(); c.beginPath(); c.rect(0, 0, it.w, it.h); c.clip(); }
    it.paint(x, m, it.w, it.h, seeded(it.seed));
    x.restore(); m.restore();
    it.rect = [it.x / 2048, 1 - (it.y + it.h) / 2048, it.w / 2048, it.h / 2048];
  }
  // windows only count where there's paint in front of them; then flatten the mask onto black
  m.setTransform(1, 0, 0, 1, 0, 0);
  m.globalCompositeOperation = 'destination-in'; m.drawImage(pc, 0, 0); m.globalCompositeOperation = 'source-over';
  const flat = mk(), f = flat.getContext('2d'); f.fillStyle = '#000'; f.fillRect(0, 0, S, S); f.drawImage(mc, 0, 0);
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4; t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { paint: tex(pc, true), mask: tex(flat, false) };
}

function paintMountains(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), r = seeded(77);
  const ridge = (base, amp, ph, col, top) => {
    x.beginPath(); x.moveTo(0, H);
    for (let i = 0; i <= W; i += 2) {
      const t = i / W * Math.PI * 2;
      const y = base - amp * (.55 + .3 * Math.sin(t * 3 + ph) + .14 * Math.sin(t * 7 + ph * 2.3) + .04 * Math.sin(t * 17 + ph * 4.1) + .012 * Math.sin(t * 43 + ph));
      x.lineTo(i, y);
    }
    x.lineTo(W, H); x.closePath();
    const g = x.createLinearGradient(0, H * .2, 0, H);
    g.addColorStop(0, css(top)); g.addColorStop(1, css(mix(top, [226, 234, 242], .75)));
    x.fillStyle = g; x.fill();
  };
  ridge(H * .64, H * .3, r() * 6, [150, 168, 196], [150, 168, 196]);
  ridge(H * .8, H * .2, r() * 6, [128, 148, 176], [128, 148, 176]);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping;
  return t;
}

// ── where everything stands ──
// the balcony sits at the top of a hill; the town falls away to the plain at y = -27
export const groundY = R => -27 + 11 * (1 - smooth(16, 80, R));

function layout(low) {
  const r = seeded(2026), out = [];
  const put = (kind, R, az, w0, w1, sway = 0) => {
    const x = Math.sin(az) * R, z = -Math.cos(az) * R;
    if (z > -78 && z < -63 && R > 62 && kind !== 'clump') return; // keep the railway clear for the train
    const v = pick(r, KINDS[kind]), w = w0 + r() * (w1 - w0);
    out.push({ x, y: groundY(R) - .8, z, w, h: w * v.h / v.w, v, seed: r(), sway });
  };
  const gap = low ? 1.35 : 1;
  const ring = (R0, R1, dR, span, step, fill) => {
    for (let R = R0; R < R1; R += dR * gap) for (let az = -span + r() * step / R; az < span; az += (step + r() * step * .6) * gap / R) fill(R + (r() - .5) * dR * .8, az + (r() - .5) * step * .3 / R);
  };
  // the hillside just below the railing: roofs and trees, all below the sightline over the counter
  ring(17, 46, 5.5, 1.5, 8, (R, az) => { const k = r(); k < .55 ? put('house', R, az, 9, 13) : put('clump', R, az, 8, 12, .3); });
  // a band of tall trees down the slope, the tops showing just over the counter (the film's bushes)
  ring(48, 76, 7, 1.45, 11, (R, az) => { const k = r(); k < .5 ? put('bigtree', R, az, 14, 21, .15) : k < .8 ? put('house', R, az, 8, 12) : put('clump', R, az, 8, 12, .2); });
  // the town, falling away down the hill
  ring(76, 130, 6, 1.4, 9, (R, az) => { const k = r(); k < .5 ? put('house', R, az, 8, 12) : k < .56 ? put('mansion', R, az, 9, 12) : k < .64 ? put('apt', R, az, 13, 19) : put('clump', R, az, 7, 12, .2); });
  ring(130, 230, 11, 1.35, 12, (R, az) => { const k = r(); k < .3 ? put('housefar', R, az, 9, 13) : k < .4 ? put('mansion', R, az, 10, 14) : k < .7 ? put('aptfar', R, az, 15, 24) : put('clump', R, az, 8, 13); });
  ring(230, 310, 15, 1.3, 18, (R, az) => { const k = r(); k < .15 ? put('mansion', R, az, 12, 16) : k < .8 ? put('aptfar', R, az, 18, 30) : put('clump', R, az, 10, 15); });
  // downtown, in the haze a little right of center (where the film keeps it)
  for (let i = 0; i < (low ? 18 : 28); i++) { const a = (r() - .5) * (r() < .75 ? .32 : .7) + .08; put('tower', 310 + r() * 60, a, 7, 11); }
  // the big trees on either side of the balcony
  for (const [x, z, w, y] of [[-14.5, -6, 10.5, -8], [-18.5, -12, 12, -10], [14.8, -7, 11, -8.5], [19.5, -13, 12.5, -10.5], [-11.8, -15, 9, -11], [12.5, -17, 9.5, -12]]) {
    const v = pick(r, KINDS.bigtree);
    out.push({ x, y, z, w, h: w * v.h / v.w, v, seed: r(), sway: .25 });
  }
  return out.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)); // near first, for early depth rejection
}

// ── power lines (電線): a pole down the hill on the left, cables sagging across the sky ──
const POLES = [[-40, -40, 12.5], [78, -132, 9.5], [-128, -6, 11]];
function linesGeometry() {
  const parts = [], col = (g, hex) => {
    const c = new THREE.Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  };
  const V = THREE.Vector3, [A, B, C] = POLES.map(([x, z, top]) => new V(x, top, z));
  // each pole's cross-arms run across the line it carries
  const armDir = (p, q, o) => new V().subVectors(q, o).setY(0).normalize().applyAxisAngle(new V(0, 1, 0), Math.PI / 2);
  const arms = [armDir(A, B, C), armDir(B, B, A), armDir(C, A, C)];
  const attach = (P, dir, slot) => {
    const [dy, s] = [[.46, -2.3], [.46, 2.3], [-.94, -1.9], [-5.4, 0]][slot];
    return P.clone().addScaledVector(dir, s).add(new V(0, dy, 0));
  };
  POLES.forEach(([x, z, top], i) => {
    const base = groundY(Math.hypot(x, z)) - 1, H = top + 1 - base;
    const g = [col(new THREE.CylinderGeometry(.28, .46, H, 10).translate(0, base + H / 2, 0), '#a3a29c')];
    for (const [y, len] of [[top, 5.6], [top - 1.4, 4.6]]) {
      g.push(col(new THREE.BoxGeometry(len, .22, .24).translate(0, y, 0), '#3a3440'));
      for (const sx of [-.41, -.14, .14, .41]) g.push(col(new THREE.CylinderGeometry(.08, .12, .34, 6).translate(sx * len, y + .27, 0), '#eceae4'));
    }
    g.push(col(new THREE.CylinderGeometry(.6, .6, 1.6, 12).translate(.9, top - 4.6, 0), '#8e959c'));
    g.push(col(new THREE.CylinderGeometry(.66, .66, .12, 12).translate(.9, top - 3.75, 0), '#6c7278'));
    const pole = mergeGeometries(g);
    const d = arms[i]; pole.rotateY(Math.atan2(-d.z, d.x)); pole.translate(x, 0, z);
    parts.push(pole);
  });
  const span = (P, Q, dp, dq, sag) => {
    for (let slot = 0; slot < 4; slot++) {
      const a = attach(P, dp, slot), b = attach(Q, dq, slot), pts = [];
      for (let k = 0; k <= 40; k++) { const t = k / 40; pts.push(new V().lerpVectors(a, b, t).add(new V(0, -sag * 4 * t * (1 - t) * (slot === 3 ? 1.15 : 1), 0))); }
      parts.push(col(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, slot === 3 ? .09 : .12, 5), '#2a2033'));
    }
  };
  span(A, B, arms[0], arms[1], 6.5);
  span(A, C, arms[0], arms[2], 4.5);
  return mergeGeometries(parts.map(g => { g.deleteAttribute('uv'); return g; }));
}

// ── shaders ──
const U = {
  tPaint: { value: null }, tMask: { value: null }, tMount: { value: null },
  uTint: { value: new THREE.Color(1, 1, 1) }, uHaze: { value: new THREE.Color(.8, .85, .9) }, uGround: { value: new THREE.Color() },
  uHazeK: { value: .0046 }, uHazeMax: { value: .9 }, uLights: { value: 0 }, uLightI: { value: 1.6 },
  uTime: { value: 0 }, uWind: { value: .5 }, uShimmer: { value: 0 },
  uOutInv: { value: new THREE.Matrix3() }, uInInv: { value: new THREE.Matrix3() }, uExpK: { value: 1.75 },
  uSun: { value: new THREE.Vector3(.4, .3, -.9) },
};
const FRAG_COMMON = /* glsl */`
  uniform vec3 uTint, uHaze; uniform float uHazeK, uHazeMax, uLights, uLightI, uExpK; uniform mat3 uOutInv, uInInv;
  vec3 rrtInv(vec3 y){
    vec3 qa = 1. - y * .983729, qb = .0245786 - y * .4329510, qc = -(.000090537 + y * .238081);
    return (-qb + sqrt(qb * qb - 4. * qa * qc)) / (2. * qa);
  }
  // display color -> the scene value that lands on it after the final ACES pass (as the sky does)
  vec3 toScene(vec3 disp){ return max(uInInv * rrtInv(clamp(uOutInv * disp, 0., .985)) / uExpK, 0.); }
  float hazeAt(float d){ return (1. - exp(-max(d - 35., 0.) * uHazeK)) * uHazeMax; }`;
const OUT = /* glsl */`
  #include <tonemapping_fragment>
  #include <colorspace_fragment>`;

const townMat = new THREE.ShaderMaterial({
  uniforms: U, fog: false, alphaToCoverage: true,
  vertexShader: /* glsl */`
    attribute vec3 aPos; attribute vec2 aSize; attribute vec4 aRect; attribute vec3 aMisc;
    uniform float uTime, uWind, uShimmer;
    varying vec2 vUv; varying vec4 vRect; varying float vSeed, vDist, vHz;
    void main(){
      vec3 f = cameraPosition - aPos; f.y = 0.; f = normalize(f + vec3(1e-4, 0., 0.));
      vec3 right = vec3(f.z, 0., -f.x);
      vec3 wp = aPos + right * position.x * aSize.x + vec3(0., position.y * aSize.y, 0.);
      float sw = aMisc.y * position.y * position.y;
      wp += right * sw * (sin(uTime * 1.1 + aMisc.x * 40.) * .6 + sin(uTime * 2.6 + aMisc.x * 17.) * .25) * uWind;
      float far = smoothstep(90., 260., length(aPos.xz));
      wp.x += sin(uTime * 3.3 + position.y * 9. + aPos.x * .21) * uShimmer * far * .35;
      wp.y += sin(uTime * 2.7 + aPos.x * .37) * uShimmer * far * .15 * position.y;
      vUv = vec2(position.x + .5, position.y); vRect = aRect; vSeed = aMisc.x; vHz = aMisc.z;
      vec4 mv = viewMatrix * vec4(wp, 1.);
      vDist = -mv.z;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tPaint, tMask;
    varying vec2 vUv; varying vec4 vRect; varying float vSeed, vDist, vHz;
    ${FRAG_COMMON}
    void main(){
      vec2 uv = vRect.xy + vUv * vRect.zw;
      vec4 p = texture2D(tPaint, uv);
      if (p.a < .04) discard;
      float hz = hazeAt(vDist) * vHz;
      vec3 c = mix(p.rgb * uTint * (.93 + .14 * vSeed), uHaze, hz);
      vec3 sc = toScene(c);
      vec4 mk = texture2D(tMask, uv);
      float t = 1. - uLights * (.3 + .5 * fract(vSeed * 13.7));
      float on = mk.b * smoothstep(t - .05, t + .05, mk.r);
      sc += mix(vec3(1., .66, .32), vec3(.62, .78, 1.), mk.g) * on * uLightI * .55 * (1. - hz * .45);
      gl_FragColor = vec4(sc, smoothstep(.25, .75, p.a));
      ${OUT}
    }`,
});

const mountMat = new THREE.ShaderMaterial({
  uniforms: U, fog: false, side: THREE.BackSide,
  vertexShader: /* glsl */`
    varying vec2 vUv; varying float vDist;
    void main(){ vUv = vec2((1. - uv.x) * 4., uv.y); vec4 mv = modelViewMatrix * vec4(position, 1.); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tMount; varying vec2 vUv; varying float vDist;
    ${FRAG_COMMON}
    void main(){
      vec4 p = texture2D(tMount, vUv);
      if (p.a < .5) discard;
      gl_FragColor = vec4(toScene(mix(p.rgb * uTint, uHaze, hazeAt(vDist) * .88)), 1.);
      ${OUT}
    }`,
});

const groundMat = new THREE.ShaderMaterial({
  uniforms: U, fog: false,
  vertexShader: /* glsl */`
    varying float vDist; varying vec2 vXZ;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vDist = -mv.z; vXZ = position.xz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */`
    uniform vec3 uGround; varying float vDist; varying vec2 vXZ;
    ${FRAG_COMMON}
    float h(vec2 p){ return fract(sin(dot(floor(p), vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      float n = h(vXZ / 9.) * .5 + h(vXZ / 23. + 3.) * .5;
      vec3 c = uGround * (.86 + .22 * n) * uTint;
      gl_FragColor = vec4(toScene(mix(c, uHaze, hazeAt(vDist))), 1.);
      ${OUT}
    }`,
});

const linesMat = new THREE.ShaderMaterial({
  uniforms: U, fog: false, vertexColors: true,
  vertexShader: /* glsl */`
    varying vec3 vCol, vN; varying float vDist;
    void main(){ vCol = color; vN = normalize(mat3(modelMatrix) * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vDist = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: /* glsl */`
    uniform vec3 uSun; varying vec3 vCol, vN; varying float vDist;
    ${FRAG_COMMON}
    void main(){
      float l = smoothstep(-.02, .08, dot(normalize(vN), normalize(uSun)));
      vec3 c = vCol * mix(vec3(.6, .62, .82), vec3(1.05, 1.02, .97), l) * uTint;
      gl_FragColor = vec4(toScene(mix(c, uHaze, hazeAt(vDist) * .55)), 1.);
      ${OUT}
    }`,
});

function build(tier) {
  const low = tier === 'low';
  const { paint, mask } = paintAtlas(low ? 1024 : 2048);
  U.tPaint.value = paint; U.tMask.value = mask;
  U.tMount.value = paintMountains(low ? 1024 : 2048, low ? 128 : 256);

  const list = layout(low), n = list.length;
  const quad = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.getAttribute('position')); geo.setAttribute('uv', quad.getAttribute('uv'));
  const aPos = new Float32Array(n * 3), aSize = new Float32Array(n * 2), aRect = new Float32Array(n * 4), aMisc = new Float32Array(n * 3);
  list.forEach((s, i) => {
    aPos.set([s.x, s.y, s.z], i * 3); aSize.set([s.w, s.h], i * 2); aRect.set(s.v.rect, i * 4); aMisc.set([s.seed, s.sway, s.v.kind === 'tower' ? .8 : 1], i * 3);
  });
  geo.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3));
  geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(aSize, 2));
  geo.setAttribute('aRect', new THREE.InstancedBufferAttribute(aRect, 4));
  geo.setAttribute('aMisc', new THREE.InstancedBufferAttribute(aMisc, 3));
  geo.instanceCount = n;
  const town = new THREE.Mesh(geo, townMat);
  town.frustumCulled = false; town.userData.noInk = true;
  scene.add(town);

  const ring = new THREE.Mesh(new THREE.CylinderGeometry(470, 470, 90, 96, 1, true, Math.PI - 2.2, 4.4), mountMat);
  ring.position.y = -2; ring.frustumCulled = false; ring.userData.noInk = true;
  scene.add(ring);

  // the ground: a disc that follows the hill, denser rings near the balcony
  const gGeo = new THREE.RingGeometry(10, 560, 72, 40);
  const pos = gGeo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), R = Math.hypot(x, y), t = (R - 10) / 550, R2 = 10 + 550 * t * t, s = R2 / R;
    pos.setXYZ(i, x * s, y * s, 0);
  }
  gGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < pos.count; i++) pos.setY(i, groundY(Math.hypot(pos.getX(i), pos.getZ(i))) - .9);
  gGeo.computeVertexNormals();
  const ground = new THREE.Mesh(gGeo, groundMat);
  ground.frustumCulled = false; ground.userData.noInk = true;
  scene.add(ground);
  const lines = new THREE.Mesh(linesGeometry(), linesMat);
  lines.frustumCulled = false; lines.userData.noInk = true;
  scene.add(lines);
  backdrop.meshes = { town, ring, ground, lines };
  backdrop.count = n;
}

const _c = new THREE.Color();
export const backdrop = {
  U, meshes: null, count: 0,
  // Pl = sky.js's sampled palette for this moment; o = overcast level
  update(Pl, p, { moonOn = 0, overcast: o = 0, tier = 'high', outInv, inInv, expK, wind = .5, sun } = {}) {
    if (!backdrop.meshes) build(tier);
    U.uTint.value.copy(Pl.lit).lerp(_c.copy(Pl.ocL), .45 * o);
    U.uHaze.value.copy(Pl.hor).lerp(Pl.haze, Pl.hazeAmt);
    U.uGround.value.setRGB(.36, .46, .34);
    U.uHazeK.value = .0062 * 240 / Pl.fogFar;
    U.uLights.value = Math.max(smooth(.62, .95, p), moonOn) * (1 - .3 * o);
    U.uLightI.value = Pl.cityLit;
    if (outInv) U.uOutInv.value.copy(outInv);
    if (inInv) U.uInInv.value.copy(inInv);
    if (expK) U.uExpK.value = expK;
    if (sun) U.uSun.value.copy(sun);
    U.uTime.value = G.time; U.uWind.value = wind;
  },
};

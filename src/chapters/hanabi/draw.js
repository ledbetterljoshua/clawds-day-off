// Drawing the shell's cross-section (the designer canvas and the half-shell's face on the bench)
// and finding which star slot a point lands on. Slot 0 of each ring is at the top, going
// clockwise, which is also how the stars fly in the sky.
import { COLORS, EFFECTS, RINGS, RING_R, G, inGrid } from './design.js';

const geom = (size, full) => { const R = size * (full ? .5 : .47); return { cx: size / 2, cy: size / 2, R }; };
export const pelletR = (R, r) => R * [.062, .06, .058, .056][r];
export function slotXY(r, s, R) { const a = -Math.PI / 2 + s / RINGS[r] * Math.PI * 2, rr = RING_R[r] * R * .8; return [Math.cos(a) * rr, Math.sin(a) * rr]; }
const cell = R => R * 1.66 / G;

// kraft shell + burst charge, cached per size
const bases = new Map();
function base(size, full) {
  const key = size + (full ? 'f' : '');
  if (bases.has(key)) return bases.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'), { cx, cy, R } = geom(size, full);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const g = x.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R);
  g.addColorStop(0, '#dcb07a'); g.addColorStop(1, '#a8743f');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fill();
  // paper fibres and the pasted layers of a 玉貼り shell
  for (let i = 0; i < size * 1.2; i++) {
    const a = rnd() * Math.PI * 2, rr = R * (.88 + rnd() * .12), l = 3 + rnd() * 8, t = a + Math.PI / 2 + (rnd() - .5);
    x.strokeStyle = `rgba(90,52,20,${.08 + rnd() * .14})`; x.lineWidth = .6 + rnd();
    x.beginPath(); x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); x.lineTo(cx + Math.cos(a) * rr + Math.cos(t) * l, cy + Math.sin(a) * rr + Math.sin(t) * l); x.stroke();
  }
  for (const k of [.985, .95, .92]) { x.strokeStyle = 'rgba(80,45,15,.35)'; x.lineWidth = Math.max(1, R * .012); x.beginPath(); x.arc(cx, cy, R * k, 0, Math.PI * 2); x.stroke(); }
  // the burst charge: rice hulls coated in black powder
  const ri = R * .89;
  x.fillStyle = '#1f1b18'; x.beginPath(); x.arc(cx, cy, ri, 0, Math.PI * 2); x.fill();
  const n = Math.round(ri * ri / 22);
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * ri * .97;
    x.fillStyle = ['#2c2621', '#3a322a', '#171412', '#4a4038'][Math.floor(rnd() * 4)];
    x.beginPath(); x.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, R * .022 * (.6 + rnd()), R * .01 * (.6 + rnd()), rnd() * Math.PI, 0, Math.PI * 2); x.fill();
  }
  const sh = x.createRadialGradient(cx, cy, ri * .7, cx, cy, ri);
  sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.45)');
  x.fillStyle = sh; x.beginPath(); x.arc(cx, cy, ri, 0, Math.PI * 2); x.fill();
  bases.set(key, c);
  return c;
}

const mix = (a, b, t) => a.map((v, i) => Math.round((v + (b[i] - v) * t) * 255));
function pellet(x, px, py, pr, ci, flat) {
  const C = COLORS[ci], col = C.col;
  if (flat) { x.fillStyle = C.css; x.beginPath(); x.arc(px, py, pr, 0, Math.PI * 2); x.fill(); }
  else {
    const g = x.createRadialGradient(px - pr * .35, py - pr * .4, pr * .1, px, py, pr);
    g.addColorStop(0, `rgb(${mix(col, [1, 1, 1], .55)})`); g.addColorStop(.55, C.css); g.addColorStop(1, `rgb(${mix(col, [0, 0, 0], .45)})`);
    x.fillStyle = g; x.beginPath(); x.arc(px, py, pr, 0, Math.PI * 2); x.fill();
  }
  x.strokeStyle = flat ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,.5)'; x.lineWidth = Math.max(1, pr * .14);
  x.beginPath(); x.arc(px, py, pr, 0, Math.PI * 2); x.stroke();
  if (C.glitter) { x.fillStyle = '#fff'; for (const [dx, dy] of [[-.3, -.2], [.25, .3], [.35, -.35]]) { x.beginPath(); x.arc(px + dx * pr, py + dy * pr, pr * .14, 0, Math.PI * 2); x.fill(); } }
}

export function drawShell(x, size, d, { full = false, hover = null } = {}) {
  const { cx, cy, R } = geom(size, full);
  x.clearRect(0, 0, size, size);
  x.drawImage(base(size, full), 0, 0);
  x.lineCap = 'round';
  if (d.mode === 0) {
    d.rings.forEach((ring, r) => {
      const fx = EFFECTS[d.fx[r]].id, pr = pelletR(R, r);
      if (fx === 'flat') { x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 1; x.setLineDash([2, 4]); x.beginPath(); x.arc(cx, cy, RING_R[r] * R * .8, 0, Math.PI * 2); x.stroke(); x.setLineDash([]); }
      ring.forEach((ci, s) => {
        const [dx, dy] = slotXY(r, s, R), px = cx + dx, py = cy + dy;
        if (!ci) { x.strokeStyle = 'rgba(255,236,210,.3)'; x.lineWidth = 1.2; x.setLineDash([2, 3]); x.beginPath(); x.arc(px, py, pr * .8, 0, Math.PI * 2); x.stroke(); x.setLineDash([]); return; }
        const C = COLORS[ci], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        if (fx === 'tail') { x.strokeStyle = C.css + '88'; x.lineWidth = pr * .55; x.beginPath(); x.moveTo(px + ux * pr, py + uy * pr); x.lineTo(px + ux * pr * 2.3, py + uy * pr * 2.3); x.stroke(); }
        if (fx === 'willow') { x.strokeStyle = 'rgba(255,200,90,.6)'; x.lineWidth = pr * .4; x.beginPath(); x.moveTo(px, py + pr); x.quadraticCurveTo(px + ux * pr * 1.4, py + pr * 1.6, px + ux * pr * .6, py + pr * 2.6); x.stroke(); }
        pellet(x, px, py, pr, ci, fx === 'flat');
      });
    });
    const pr = pelletR(R, 0) * 1.12;
    if (d.core) pellet(x, cx, cy, pr, d.core, false);
    else { x.strokeStyle = 'rgba(255,236,210,.3)'; x.lineWidth = 1.2; x.setLineDash([2, 3]); x.beginPath(); x.arc(cx, cy, pr * .8, 0, Math.PI * 2); x.stroke(); x.setLineDash([]); }
    if (hover) {
      const [hx, hy] = hover.core ? [0, 0] : slotXY(hover.r, hover.s, R), hr = hover.core ? pr : pelletR(R, hover.r);
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2; x.beginPath(); x.arc(cx + hx, cy + hy, hr + 3, 0, Math.PI * 2); x.stroke();
    }
  } else {
    const cs = cell(R), ox = cx - cs * G / 2, oy = cy - cs * G / 2;
    if (d.frame) { x.strokeStyle = 'rgba(255,201,77,.75)'; x.lineWidth = cs * .22; x.setLineDash([1, cs * .55]); x.beginPath(); x.arc(cx, cy, R * .86, 0, Math.PI * 2); x.stroke(); x.setLineDash([]); }
    for (let i = 0; i < G * G; i++) {
      if (!inGrid(i)) continue;
      const px = ox + (i % G + .5) * cs, py = oy + (Math.floor(i / G) + .5) * cs, ci = d.grid[i];
      if (!ci) { x.fillStyle = 'rgba(255,236,210,.22)'; x.beginPath(); x.arc(px, py, Math.max(1, cs * .08), 0, Math.PI * 2); x.fill(); continue; }
      pellet(x, px, py, cs * .42, ci, false);
    }
    if (hover && hover.i != null) { const px = ox + (hover.i % G + .5) * cs, py = oy + (Math.floor(hover.i / G) + .5) * cs; x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 2; x.strokeRect(px - cs / 2, py - cs / 2, cs, cs); }
  }
}

// which slot is under (px, py)? { r, s } | { core: true } | { i } | null
export function hitSlot(px, py, size, d, full = false) {
  const { cx, cy, R } = geom(size, full), dx = px - cx, dy = py - cy;
  if (d.mode === 1) {
    const cs = cell(R), c = Math.floor((dx + cs * G / 2) / cs), r = Math.floor((dy + cs * G / 2) / cs), i = r * G + c;
    return c >= 0 && c < G && r >= 0 && r < G && inGrid(i) ? { i } : null;
  }
  let best = null, bd = Infinity;
  const pr0 = pelletR(R, 0) * 1.12;
  if (Math.hypot(dx, dy) < pr0 * 1.7) return { core: true };
  RINGS.forEach((N, r) => { for (let s = 0; s < N; s++) { const [sx, sy] = slotXY(r, s, R), q = Math.hypot(dx - sx, dy - sy); if (q < bd) { bd = q; best = { r, s }; } } });
  return best && bd < pelletR(R, best.r) * 1.9 ? best : null;
}

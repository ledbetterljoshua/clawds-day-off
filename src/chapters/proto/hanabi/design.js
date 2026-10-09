// A firework shell, the way a hanabi-shi packs one. Shell mode (割物 warimono): stars on rings
// around the burst charge; each ring bursts into a sphere, and its layout is the pattern in the
// sky. Picture mode (型物 katamono): stars laid out as a picture that bursts flat toward you.
// Designs are plain objects so they clone, encode into a share link and decode back exactly.
import { rand, pick } from '../../../core/util.js';

// index 0 is an empty slot; colors are named for what burns them
export const COLORS = [
  null,
  { el: 'Sr', jp: 'ストロンチウム', name: 'red', col: [1, .13, .09], css: '#ff4a3d', note: 'strontium: the red of every summer festival' },
  { el: 'Ca', jp: 'カルシウム', name: 'orange', col: [1, .42, .06], css: '#ff8b2c', note: 'calcium: a warm, lantern orange' },
  { el: 'Na', jp: 'ナトリウム', name: 'gold', col: [1, .72, .22], css: '#ffc94d', note: 'sodium: willow gold (it\'s salt, really)' },
  { el: 'Ba', jp: 'バリウム', name: 'green', col: [.26, 1, .26], css: '#5ff05b', note: 'barium burns green' },
  { el: 'Cu', jp: '銅', name: 'blue', col: [.2, .42, 1], css: '#5288ff', note: 'copper: blue is the hard one to make bright' },
  { el: 'Sr+Cu', jp: 'むらさき', name: 'purple', col: [.66, .26, 1], css: '#b26cff', note: 'purple: red and blue in one star, the trickiest' },
  { el: 'Mg', jp: 'マグネシウム', name: 'silver', col: [.95, .96, 1], css: '#eef1ff', note: 'magnesium: silver glitter that crackles at the end', glitter: true },
];

export const EFFECTS = [
  { id: 'peony', jp: '牡丹', name: 'peony', note: 'clean stars, a perfect sphere' },
  { id: 'tail', jp: '菊', name: 'chrysanthemum', note: 'every star draws a tail' },
  { id: 'willow', jp: '柳', name: 'willow', note: 'long gold trails that droop' },
  { id: 'flat', jp: '輪', name: 'ring', note: 'bursts flat, facing you: the layout is the picture' },
];

export const RINGS = [20, 16, 12, 8];           // slots per ring, outer to inner
export const RING_R = [1, .77, .54, .31];       // ring radius in the cross-section (shell = 1)
const SPEED = [16, 12.4, 8.8, 5.2];           // burst speed of each ring's stars
export const G = 13;                             // picture grid size
export const inGrid = i => { const c = i % G - 6, r = Math.floor(i / G) - 6; return c * c + r * r <= 6.6 * 6.6; };
export const SLOTS = RINGS.reduce((a, b) => a + b, 0);

export function blank(mode = 0) {
  return { mode, rings: RINGS.map(n => new Array(n).fill(0)), core: 0, fx: [1, 0, 0, 0], grid: new Array(G * G).fill(0), frame: 0, name: '' };
}
export const clone = d => JSON.parse(JSON.stringify(d));
export function starCount(d) {
  return d.mode === 0 ? d.rings.flat().filter(Boolean).length + (d.core ? 1 : 0) : d.grid.filter(Boolean).length;
}

// ── what it's called ──
export function autoName(d) {
  if (d.mode === 1) return '';
  const n = {}; let total = 0;
  d.rings.forEach(r => r.forEach(c => { if (c) { n[c] = (n[c] || 0) + 1; total++; } }));
  if (!total) return '';
  const top = Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(([, k], i) => i === 0 || k >= total * .2).map(([c]) => COLORS[c].name);
  const outer = d.rings.findIndex(r => r.some(Boolean));
  const fx = EFFECTS[d.fx[outer]].name, w = top.join('-and-');
  return `${/^[aeiou]/.test(w) ? 'an' : 'a'} ${w} ${fx}`;
}
export const displayName = d => (d.name || '').trim() || autoName(d) || (d.mode === 1 ? 'a secret shape' : 'an empty shell');
export const cleanName = s => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').slice(0, 30).trim();

// the colors a shell shows, for its paper band on the rack and its chip in the show
export function mainColors(d) {
  const cells = d.mode === 0 ? [...d.rings.flat(), d.core] : d.grid;
  const n = {}; cells.forEach(c => { if (c) n[c] = (n[c] || 0) + 1; });
  return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([c]) => COLORS[c]);
}

// ── the stars it bursts into (for fx.js 'stars' fireworks) ──
export function starsOf(d, { low = false } = {}) {
  const out = [];
  if (d.mode === 1) {
    const per = low ? 1 : 2, sp = 1.6;
    d.grid.forEach((c, i) => {
      if (!c || !inGrid(i)) return;
      const col = COLORS[c], x = i % G - 6, y = 6 - Math.floor(i / G);
      for (let a = 0; a < per; a++) for (let b = 0; b < per; b++) {
        const ox = per > 1 ? (a - .5) * .5 : 0, oy = per > 1 ? (b - .5) * .5 : 0;
        out.push({ v: [(x + ox + rand(-.05, .05)) * sp, (y + oy + rand(-.05, .05)) * sp, rand(-.15, .15)], col: col.col, fx: 'flat', glitter: !!col.glitter });
      }
    });
    if (d.frame) for (let k = 0; k < (low ? 28 : 44); k++) { const a = k / (low ? 28 : 44) * Math.PI * 2; out.push({ v: [Math.cos(a) * 7.6 * sp, Math.sin(a) * 7.6 * sp, 0], col: COLORS[3].col, fx: 'flat', glitter: false }); }
    return out;
  }
  d.rings.forEach((ring, r) => {
    const N = ring.length, fx = EFFECTS[d.fx[r]].id, step = Math.PI * 2 / N;
    ring.forEach((c, s) => {
      if (!c) return;
      const col = COLORS[c], th0 = Math.PI / 2 - s * step;   // slot 0 at the top, going clockwise like the drawing
      const k = fx === 'flat' ? (low ? 2 : 3) : (low ? 4 : 6);
      for (let i = 0; i < k; i++) {
        const th = th0 + (fx === 'flat' ? (i / k - .5 + rand(-.1, .1)) * step * .8 : rand(-.5, .5) * step);
        const sp = SPEED[r] * rand(.95, 1.04);
        if (fx === 'flat') out.push({ v: [Math.cos(th) * sp * .42, Math.sin(th) * sp * .42, rand(-.2, .2)], col: col.col, fx, glitter: !!col.glitter });
        else { const cz = rand(-1, 1), sz = Math.sqrt(1 - cz * cz); out.push({ v: [Math.cos(th) * sz * sp, Math.sin(th) * sz * sp, cz * sp], col: col.col, fx, glitter: !!col.glitter }); }
      }
    });
  });
  if (d.core) { const col = COLORS[d.core]; for (let i = 0; i < (low ? 8 : 16); i++) { const cz = rand(-1, 1), sz = Math.sqrt(1 - cz * cz), a = rand(0, Math.PI * 2), sp = rand(1.6, 2.4); out.push({ v: [Math.cos(a) * sz * sp, Math.sin(a) * sz * sp, cz * sp], col: col.col, fx: 'peony', glitter: !!col.glitter }); } }
  return out;
}

// ── share links: version, mode, then 4-bit cells, then the name in UTF-8 ──
const b64u = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
export function encode(d) {
  const out = [1, (d.mode & 1) | ((d.frame & 1) << 1)];
  let cells;
  if (d.mode === 0) { out.push(d.fx[0] | d.fx[1] << 2 | d.fx[2] << 4 | d.fx[3] << 6, d.core & 7); cells = d.rings.flat(); }
  else cells = d.grid.map((c, i) => inGrid(i) ? c : 0);
  for (let i = 0; i < cells.length; i += 2) out.push((cells[i] & 15) | ((cells[i + 1] ?? 0) & 15) << 4);
  const nm = [...new TextEncoder().encode(cleanName(d.name))].slice(0, 60);
  out.push(nm.length, ...nm);
  return b64u(out);
}
export function decode(str) {
  try {
    if (typeof str !== 'string' || !str || str.length > 400 || !/^[A-Za-z0-9_-]+$/.test(str)) return null;
    const b = unb64u(str);
    if (b[0] !== 1 || b.length < 4) return null;
    const d = blank(b[1] & 1); d.frame = (b[1] >> 1) & 1;
    let i = 2, n;
    if (d.mode === 0) { const f = b[i++]; d.fx = [f & 3, f >> 2 & 3, f >> 4 & 3, f >> 6 & 3]; d.core = b[i++] & 7; n = SLOTS; }
    else n = G * G;
    const cells = [];
    for (let k = 0; k < Math.ceil(n / 2); k++) { const v = b[i++]; if (v === undefined) return null; cells.push(v & 15, v >> 4); }
    const ok = v => v <= 7 ? v : 0;
    if (d.mode === 0) { let k = 0; d.rings = RINGS.map(N => cells.slice(k, k += N).map(ok)); }
    else d.grid = cells.slice(0, n).map((v, j) => inGrid(j) ? ok(v) : 0);
    const len = b[i++] ?? 0;
    if (len > 60 || i + len > b.length) return null;
    d.name = cleanName(new TextDecoder().decode(b.slice(i, i + len)));
    return starCount(d) ? d : null;
  } catch { return null; }
}

// ── the helpers' shells and the classics ──
const rows = (list, map) => { const g = new Array(G * G).fill(0); list.forEach((row, r) => [...row].forEach((ch, c) => { if (map[ch] && inGrid(r * G + c)) g[r * G + c] = map[ch]; })); return g; };
function picture(list, map, name, frame = 0) { const d = blank(1); d.grid = rows(list, map); d.name = name; d.frame = frame; return d; }
function shell(spec, name) {
  const d = blank(0);
  spec.rings.forEach((r, i) => { if (r == null) return; d.rings[i] = d.rings[i].map((_, s) => typeof r === 'function' ? r(s) : r); });
  d.fx = spec.fx; d.core = spec.core || 0; d.name = name;
  return d;
}

export const STRAWBERRY = picture([
  '......G......',
  '...GG.G.GG...',
  '....GGGGG....',
  '..RRRGGGRRR..',
  '.RRYRRRRRYRR.',
  '.RRRRRYRRRRR.',
  '.RYRRRRRRRYR.',
  '..RRRYRRYRR..',
  '..RYRRRRRRR..',
  '...RRRYRRR...',
  '....RRRRR....',
  '.....RYR.....',
  '......R......',
], { R: 1, Y: 3, G: 4 }, 'a strawberry');

export const WILLOW = shell({ rings: [3, null, 4, null], fx: [2, 0, 0, 0], core: 4 }, 'a green-and-gold willow');

function snowGrid() {
  const g = new Array(G * G).fill(0), set = (c, r, v) => { if (c >= 0 && c < G && r >= 0 && r < G && inGrid(r * G + c)) g[r * G + c] = Math.max(g[r * G + c] === 7 ? 7 : 0, v); };
  for (let k = 0; k < 6; k++) {
    const a = Math.PI / 2 + k * Math.PI / 3, dx = Math.cos(a), dy = -Math.sin(a);
    for (let t = 1; t <= 6; t += .5) set(Math.round(6 + dx * t), Math.round(6 + dy * t), t > 4.7 ? 5 : 7);
    for (const s of [-1, 1]) { const b = a + s * Math.PI / 3; for (let u = .7; u <= 2.1; u += .7) set(Math.round(6 + dx * 3.4 + Math.cos(b) * u), Math.round(6 + dy * 3.4 - Math.sin(b) * u), 5); }
  }
  g[6 * G + 6] = 7;
  return g;
}
export const SNOWFLAKE = (() => { const d = blank(1); d.grid = snowGrid(); d.name = 'a snowflake'; return d; })();

export const YAESHIN = shell({ rings: [1, null, 5, 3], fx: [1, 0, 0, 0], core: 7 }, 'a double-pistil chrysanthemum');
export const KAMURO = shell({ rings: [3, 3, null, null], fx: [2, 2, 0, 0], core: 7 }, 'a gold crown willow');

// ── 🎲: something pleasant, never noise ──
export function surprise() {
  if (Math.random() < .22) {
    const d = pick([STRAWBERRY, SNOWFLAKE]);
    return { ...clone(d), name: '' };
  }
  const d = blank(0), pal = [];
  while (pal.length < 3) { const c = 1 + Math.floor(Math.random() * 7); if (!pal.includes(c)) pal.push(c); }
  const layouts = [
    () => pal[0],
    s => s % 2 ? pal[0] : pal[1],
    (s, N) => s < N / 2 ? pal[0] : pal[1],
    s => s % 3 === 0 ? pal[2] : pal[0],
    (s, N) => (s % (N / 4) < N / 8) ? pal[1] : 0,
  ];
  const used = Math.random() < .5 ? [0, 2] : Math.random() < .5 ? [0, 1, 3] : [0, 2, 3];
  used.forEach(r => { const L = pick(layouts); d.rings[r] = d.rings[r].map((_, s) => L(s, RINGS[r]) || 0); });
  d.fx = [pick([0, 1, 1, 2, 3]), pick([0, 0, 3]), pick([0, 0, 1]), 0];
  d.core = Math.random() < .7 ? pick(pal) : 0;
  return d;
}

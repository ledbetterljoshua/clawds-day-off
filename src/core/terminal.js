// The laptop: a canvas texture on the 3D screen, plus an interactive terminal overlay
// (click the laptop or press `/`). Commands are registered by the game and by chapters.
import { canvasTex } from './gfx.js';
import { G } from './state.js';
import { $, esc } from './util.js';
import { sleep } from './tween.js';
import { audio } from './audio.js';

export const termTex = canvasTex(640, 400);
const lines = [];           // laptop screen log: { t, c }
const cmds = new Map();     // name -> { run, help, hidden }
const hist = []; let histI = -1;
let redraw = 0, live = '';  // live = what's being typed in the overlay (mirrored to the 3D screen)

const el = $('#term');
el.innerHTML = `
  <div class="tbar"><i></i><i></i><i></i><span>clawd@balcony — ~/day-off</span><button class="tx" aria-label="close terminal">esc</button></div>
  <div class="tbody" id="tbody">
    <div class="welcome"><b>✻ Welcome to Clawd Code</b> <span class="dim">day-off edition</span>
      <div class="dim">/help for commands · ↑↓ history · tab completes · esc closes</div>
      <div class="dim">cwd: ~/balcony</div></div>
  </div>
  <form class="tin" id="tform" autocomplete="off"><span class="pr">&gt;</span><input id="tinput" spellcheck="false" autocapitalize="off" aria-label="terminal input"></form>`;
const body = $('#tbody'), input = $('#tinput');

function addOut(t, c, cls = '') {
  const d = document.createElement('div');
  d.className = 'tl ' + cls;
  if (c) d.style.color = c;
  d.textContent = t;
  body.appendChild(d);
  while (body.children.length > 400) body.children[1].remove();
  body.scrollTop = body.scrollHeight;
}

export const term = {
  lines,
  isOpen: false,
  onDelegate: null,   // (helperIndex, text) => string|void   set by game
  onOpen: null,

  log(t, c) {
    t = String(t);
    lines.push({ t, c });
    if (lines.length > 200) lines.shift();
    addOut(t, c);
  },

  async typeLine(t, c, speed = .045) {
    const L = { t: '', c }; lines.push(L);
    for (const ch of t) { L.t += ch; if (ch !== ' ') audio.sfx('type'); await sleep(speed); }
    addOut(t, c);
  },

  clearScreen() { lines.length = 0; },

  // append to the last line (typing effects)
  amendLast(more) {
    const L = lines[lines.length - 1]; if (!L) return;
    L.t += more;
    const n = body.querySelector('.tl:last-child'); if (n) n.textContent = L.t;
  },

  register(name, run, help = '', opts = {}) { cmds.set(name, { run, help, ...opts }); },
  unregister(name) { cmds.delete(name); },

  open() {
    if (term.isOpen) return;
    term.isOpen = true; el.classList.remove('hidden');
    setTimeout(() => input.focus(), 30);
    body.scrollTop = body.scrollHeight;
    term.onOpen && term.onOpen();
    audio.sfx('pop');
  },
  close() {
    if (!term.isOpen) return;
    term.isOpen = false; el.classList.add('hidden'); input.blur(); live = '';
  },
  toggle() { term.isOpen ? term.close() : term.open(); },

  // run a command line as if typed
  run(raw) {
    raw = raw.trim(); if (!raw) return;
    addOut('> ' + raw, '#d97757', 'cmd');
    lines.push({ t: '> ' + raw, c: '#d97757' });
    let out;
    try { out = dispatch(raw); } catch (e) { out = 'error: ' + e.message; console.error(e); }
    emitOut(out);
  },

  print: o => emitOut(o),

  update(dt) {
    redraw -= dt;
    if (redraw <= 0) { draw(); redraw = .08; }
  },
};

function emitOut(out) {
  if (out == null) return;
  const arr = Array.isArray(out) ? out : [out];
  for (const o of arr) {
    if (o == null) continue;
    if (typeof o === 'string') term.log(o, '#e8e2da');
    else term.log(o.t, o.c);
  }
}

function dispatch(raw) {
  const low = raw.toLowerCase();
  // "h3 shave ice", "helper 2: pour syrups", "@h1 slice"
  const m = low.match(/^@?(?:h|helper)\s*([1-9])\s*[:,]?\s*(.*)$/);
  if (m && term.onDelegate) return term.onDelegate(+m[1] - 1, m[2]);
  // exact multi-word commands first ("git log", "cat recipe.md"), then first word
  if (cmds.has(low)) return cmds.get(low).run([], raw);
  const parts = low.split(/\s+/);
  for (let n = parts.length - 1; n >= 1; n--) {
    const key = parts.slice(0, n).join(' ');
    if (cmds.has(key)) return cmds.get(key).run(parts.slice(n), raw);
  }
  return { t: `command not found: ${parts[0]} — try /help`, c: '#f7d488' };
}

term.register('/help', () => {
  const rows = [...cmds.entries()].filter(([, v]) => v.help && !v.hidden).sort(([a], [b]) => a.localeCompare(b));
  return [
    { t: 'talk to helpers:  h1 slice strawberry · helper 3: shave ice', c: '#a79e94' },
    ...rows.map(([k, v]) => ({ t: `  ${k.padEnd(16)} ${v.help}`, c: '#e8e2da' })),
  ];
}, 'this list');
term.register('help', (a) => dispatch('/help'), '', { hidden: true });
term.register('/clear', () => { lines.length = 0; body.querySelectorAll('.tl').forEach(n => n.remove()); }, 'clear the screen');
term.register('clear', () => dispatch('/clear'), '', { hidden: true });
term.register('/exit', () => { setTimeout(() => term.close(), 250); return 'closing the laptop. it is your day off.'; }, 'close the terminal');
term.register('exit', () => dispatch('/exit'), '', { hidden: true });

$('#tform').addEventListener('submit', e => {
  e.preventDefault();
  const v = input.value; input.value = ''; live = '';
  if (v.trim()) { hist.push(v); histI = hist.length; }
  term.run(v);
});
input.addEventListener('input', () => { live = input.value; audio.sfx('type'); });
input.addEventListener('keydown', e => {
  e.stopPropagation();
  if (e.key === 'Escape') { term.close(); return; }
  if (e.key === 'ArrowUp' && hist.length) { histI = Math.max(0, histI - 1); input.value = hist[histI] || ''; e.preventDefault(); }
  if (e.key === 'ArrowDown' && hist.length) { histI = Math.min(hist.length, histI + 1); input.value = hist[histI] || ''; e.preventDefault(); }
  if (e.key === 'Tab') {
    e.preventDefault();
    const v = input.value.toLowerCase();
    const hit = [...cmds.keys()].filter(k => k.startsWith(v) && !cmds.get(k).hidden);
    if (hit.length === 1) input.value = hit[0] + ' ';
    else if (hit.length > 1) addOut(hit.join('   '), '#a79e94');
  }
});
input.addEventListener('keyup', e => e.stopPropagation());
el.querySelector('.tx').addEventListener('click', () => term.close());
el.addEventListener('pointerdown', e => e.stopPropagation());

// ── the 3D laptop screen ──
function draw() {
  const { x } = termTex.userData;
  x.fillStyle = '#1c1a22'; x.fillRect(0, 0, 640, 400);
  x.fillStyle = '#2a2731'; x.fillRect(0, 0, 640, 34);
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc(22 + i * 22, 17, 6.5, 0, 7); x.fill(); });
  // tiny clawd in the title bar
  x.fillStyle = '#d97757'; const px = 572, py = 8;
  [[1, 0, 9, 4], [0, 2, 1, 1], [10, 2, 1, 1], [2, 4, 1, 2], [4, 4, 1, 2], [6, 4, 1, 2], [8, 4, 1, 2]].forEach(([a, b, w, h]) => x.fillRect(px + a * 4, py + b * 4, w * 4, h * 4));
  x.fillStyle = '#1c1a22'; x.fillRect(px + 12, py + 4, 4, 8); x.fillRect(px + 28, py + 4, 4, 8);
  x.font = '600 21px "JetBrains Mono", monospace'; x.textBaseline = 'top';
  const show = lines.slice(-11);
  if (term.isOpen) show.push({ t: '> ' + live, c: '#d97757' });
  show.slice(-12).forEach((l, i) => { x.fillStyle = l.c || '#e8e2da'; x.fillText(l.t.slice(0, 46), 22, 48 + i * 28); });
  if (Math.floor(performance.now() / 500) % 2 === 0) {
    const vis = show.slice(-12), last = vis[vis.length - 1];
    const w = last ? x.measureText(last.t.slice(0, 46)).width : 0;
    x.fillStyle = '#e8e2da'; x.fillRect(22 + w + 4, 48 + Math.max(0, vis.length - 1) * 28, 11, 22);
  }
  termTex.needsUpdate = true;
}
draw();

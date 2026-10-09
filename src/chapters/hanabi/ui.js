// The firework maker's panels: the bench (designer), the rack card, the show console, and the
// share / gift cards. Plain DOM over the canvas, styled like the HUD panels.
import { $, esc, isTouch } from '../../core/util.js';
import { tone, noise } from '../../core/audio.js';
import { COLORS, EFFECTS, G as GRID, clone, displayName, cleanName, mainColors, starCount } from './design.js';
import { drawShell, hitSlot } from './draw.js';

const CSS = `
.hb{position:fixed;z-index:10;font-family:var(--mono);color:var(--ink);transition:opacity .25s,transform .25s}
.hb.off{opacity:0;pointer-events:none}
.hb-bench{right:16px;top:50%;transform:translateY(-50%);width:368px;max-height:calc(100vh - 24px);overflow:auto;padding:12px 14px 14px;display:flex;flex-direction:column;gap:9px;touch-action:manipulation}
.hb-bench.off{transform:translateY(-50%) translateX(30px)}
.hb-bench>*,.hb-card>*{flex-shrink:0}
.hb-head{display:flex;align-items:center;gap:10px}
.hb-title{display:flex;flex-direction:column;line-height:1.25;min-width:0;flex:1}
.hb-title b{font-family:var(--round);font-size:16px;font-weight:800}
.hb-title span{font-size:11px;color:var(--dim)}
.hb-x{background:none;border:1px solid var(--line);border-radius:8px;color:var(--dim);width:30px;height:30px;cursor:pointer;flex:none}
.hb-x:hover{color:var(--ink)}
.hb-seg{display:flex;border:1px solid var(--line);border-radius:999px;overflow:hidden;flex:none}
.hb-seg button{background:none;border:0;color:var(--dim);padding:5px 10px;font-size:12px;cursor:pointer;font-family:var(--round)}
.hb-seg button i{font-style:normal;font-family:var(--mono);font-size:10px;margin-left:3px}
.hb-seg button.on{background:var(--acc);color:#fff}
.hb-stage{display:grid;place-items:center}
.hb-cv{display:block;touch-action:none;cursor:crosshair;border-radius:50%}
.hb-pal{display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
.hb-chip{width:34px;height:34px;border-radius:50%;border:2px solid transparent;background:radial-gradient(circle at 35% 30%,#fff8 0,var(--c) 45%,color-mix(in srgb,var(--c),#000 40%) 100%);cursor:pointer;display:grid;place-items:center;padding:0}
.hb-chip span{font-size:9px;font-weight:600;color:#0008;letter-spacing:-.3px}
.hb-chip.on{border-color:#fff;box-shadow:0 0 0 2px var(--acc)}
.hb-chip.er{background:#2c2733;color:var(--dim);font-size:14px;border-color:var(--line)}
.hb-chip.er.on{border-color:#fff;color:var(--ink)}
.hb-note{font-size:11px;color:var(--dim);text-align:center;min-height:15px;line-height:1.35}
.hb-note b{color:var(--ink);font-weight:600}
.hb-rings{display:grid;grid-template-columns:repeat(4,1fr);gap:5px}
.hb-rg{background:#2a2530;border:1px solid var(--line);border-radius:9px;color:var(--ink);padding:5px 4px 4px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:1px;min-width:0}
.hb-rg i{font-style:normal;font-size:9.5px;color:var(--dim)}
.hb-rg b{font-family:var(--round);font-size:15px;font-weight:800;line-height:1.1}
.hb-rg span{font-size:9.5px;color:var(--dim);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hb-rg:hover{border-color:#ffffff40}
.hb-rg.wide{grid-column:span 4;flex-direction:row;justify-content:center;gap:8px;font-size:12px}
.hb-row{display:flex;gap:6px}
.hb-row input{flex:1;min-width:0;background:#1d1a22;border:1px solid var(--line);border-radius:8px;color:var(--ink);font:inherit;font-size:16px;padding:6px 9px}
@media (pointer:fine){.hb-row input{font-size:13px}}
.hb-acts{display:flex;gap:6px;flex-wrap:wrap}
.hb-btn{background:#2c2733;border:1px solid var(--line);border-radius:9px;color:var(--ink);font-size:12.5px;padding:8px 10px;cursor:pointer;white-space:nowrap}
.hb-btn:hover{border-color:#ffffff40}
.hb-btn.go{background:var(--acc);border-color:var(--acc);color:#fff;font-weight:600;flex:1}
.hb-btn.go:hover{filter:brightness(1.08)}
.hb-btn:disabled{opacity:.45;cursor:default;filter:none}
.hb-btn.big{padding:11px 14px;font-size:14px;width:100%}
.hb-pill{position:fixed;z-index:10;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);padding:9px 16px;font-size:12.5px;border-radius:999px;cursor:pointer;border:1px solid var(--line)}
.hb-card{position:fixed;z-index:11;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 24px));max-height:calc(100vh - 24px);overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.hb-card.off{transform:translate(-50%,-46%)}
.hb-list{list-style:none;display:flex;flex-direction:column;gap:4px}
.hb-list li{display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 6px;border-radius:8px;background:#ffffff08}
.hb-list li.you{background:rgba(217,119,87,.14)}
.hb-list li.empty{color:var(--dim);justify-content:center;font-size:11px;padding:7px}
.hb-list .n{color:var(--dim);width:14px;text-align:right;font-size:11px}
.hb-dot{width:22px;height:22px;border-radius:50%;flex:none;border:1px solid #0006}
.hb-list .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hb-list .by{color:var(--dim);font-size:11px;white-space:nowrap}
.hb-mini{background:none;border:1px solid var(--line);border-radius:7px;color:var(--ink);font-size:11px;padding:3px 7px;cursor:pointer}
.hb-small{font-size:11px;color:var(--dim);text-align:center}
.hb-show{left:50%;bottom:max(16px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:none}
.hb-show.off{transform:translateX(-50%) translateY(20px)}
.hb-q{display:flex;gap:7px;padding:7px 10px;border-radius:999px}
.hb-q i{width:16px;height:16px;border-radius:50%;border:1px solid #0006;transition:transform .2s,opacity .3s}
.hb-q i.next{transform:scale(1.45);box-shadow:0 0 0 2px #fff}
.hb-q i.gone{opacity:.25}
.hb-fire{pointer-events:auto;position:relative;width:96px;height:96px;border-radius:50%;border:2px solid #ffffff55;background:radial-gradient(circle at 40% 35%,#ff9c6e,#d4552c 60%,#8e2c14);color:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;box-shadow:0 8px 28px rgba(0,0,0,.4);touch-action:none;user-select:none;-webkit-user-select:none}
.hb-fire b{font-family:var(--round);font-size:22px;font-weight:800;line-height:1}
.hb-fire span{font-size:10px;opacity:.85}
.hb-fire::before{content:'';position:absolute;inset:-4px;border-radius:50%;border:3px solid #ffd27a;transform:scale(var(--ring,1.5));opacity:var(--ro,0);pointer-events:none}
.hb-fire.hit{animation:hbhit .25s}
@keyframes hbhit{50%{transform:scale(.9)}}
.hb-fire.mine{background:radial-gradient(circle at 40% 35%,#ffe9a0,#e0a53a 60%,#8a5a12)}
.hb-tip{font-size:12px;color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.6);text-align:center}
.hb-judge{position:fixed;z-index:10;left:50%;bottom:calc(max(16px,env(safe-area-inset-bottom)) + 180px);transform:translateX(-50%);font-family:var(--round);font-weight:800;font-size:20px;color:#ffd27a;text-shadow:0 2px 10px rgba(0,0,0,.6);pointer-events:none;opacity:0;transition:opacity .3s}
.hb-judge.on{opacity:1;transition:none}
.hb-prev{display:flex;gap:12px;align-items:center}
.hb-prev canvas{width:84px;height:84px;flex:none}
.hb-prev div{display:flex;flex-direction:column;gap:3px;font-size:12px;color:var(--dim)}
.hb-prev b{font-family:var(--round);font-size:16px;color:var(--ink)}
.hb-kick{font-size:12px;color:var(--warn)}
@media (max-width:700px){
  .hb-bench{left:8px;right:8px;top:auto;bottom:max(8px,env(safe-area-inset-bottom));transform:none;width:auto;max-height:86vh;padding:10px 11px 11px;gap:7px}
  .hb-bench.off{transform:translateY(30px)}
  .hb-chip{width:31px;height:31px}
  .hb-seg button{padding:5px 8px}
  .hb-judge{bottom:calc(max(16px,env(safe-area-inset-bottom)) + 170px)}
}
`;

let root = null;
function init() {
  if (!$('#hb-css')) { const s = document.createElement('style'); s.id = 'hb-css'; s.textContent = CSS; document.head.appendChild(s); }
  if (!root) { root = document.createElement('div'); root.id = 'hb-root'; document.body.appendChild(root); }
}
const stopKeys = el => ['keydown', 'keyup'].forEach(t => el.addEventListener(t, e => e.stopPropagation()));
function el(cls, html, panel = true) {
  init();
  const d = document.createElement('div'); d.className = `hb ${panel ? 'panel ' : ''}${cls} off`; d.innerHTML = html; root.appendChild(d);
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.remove('off')));
  d.addEventListener('pointerdown', e => e.stopPropagation());
  return d;
}
function drop(d) { if (!d) return; d.classList.add('off'); setTimeout(() => d.remove(), 260); }
export const swatch = d => { const c = mainColors(d).slice(0, 3).map(c => c.css); return c.length > 1 ? `conic-gradient(${c.map((x, i) => `${x} ${i / c.length * 100}% ${(i + 1) / c.length * 100}%`).join(',')})` : (c[0] || '#555'); };

// a soft pentatonic chime per star, so packing a ring plays a little phrase
const YO = [0, 2, 5, 7, 9];
let lastChime = 0;
function chime(deg, on) {
  const now = performance.now(); if (now - lastChime < 30) return; lastChime = now;
  if (!on) { noise(.05, 'bandpass', 1800, .03, 1); return; }
  const f = 523.25 * Math.pow(2, (YO[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5)) / 12);
  tone(f, .32, 'triangle', .045, null, { send: .3 }); tone(f * 2, .12, 'sine', .012, null, { delay: .01 });
}

// ── the bench: designing a shell ──
const RING_LABEL = ['outer', 'ring 2', 'ring 3', 'inner'];
export function openBench(S, cb) {
  let d = S.design, color = S.color || 1, hover = null, stroke = null, size = 0, dpr = 1;
  const P = el('hb-bench', `
    <div class="hb-head"><div class="hb-title"><b>花火玉</b><span id="hb-sub"></span></div>
      <div class="hb-seg"><button data-m="0">割物<i>shell</i></button><button data-m="1">型物<i>picture</i></button></div>
      <button class="hb-x" id="hb-x" aria-label="close the bench">✕</button></div>
    <div class="hb-stage"><canvas class="hb-cv" id="hb-cv" aria-label="the shell: tap or drag to place stars"></canvas></div>
    <div class="hb-pal">${COLORS.slice(1).map((c, i) => `<button class="hb-chip" data-c="${i + 1}" style="--c:${c.css}" aria-label="${c.name}"><span>${c.el}</span></button>`).join('')}<button class="hb-chip er" data-c="0" aria-label="eraser">⌫</button></div>
    <div class="hb-note" id="hb-note"></div>
    <div class="hb-rings" id="hb-rings"></div>
    <div class="hb-row"><input id="hb-name" maxlength="30" placeholder="name it" autocomplete="off" spellcheck="false" aria-label="name"><button class="hb-btn" id="hb-new">+ new</button><button class="hb-btn" id="hb-share">✉ send</button></div>
    <div class="hb-acts"><button class="hb-btn" id="hb-undo" aria-label="undo">↶</button><button class="hb-btn" id="hb-clear">clear</button><button class="hb-btn" id="hb-rand" aria-label="surprise me">🎲</button><button class="hb-btn go" id="hb-test">🚀 test fire</button><button class="hb-btn go" id="hb-load">✓ to the rack</button></div>`);
  const cv = $('#hb-cv', P), x = cv.getContext('2d'), name = $('#hb-name', P);
  stopKeys(name);
  const note = html => { $('#hb-note', P).innerHTML = html; };
  const colorNote = () => { const C = COLORS[color]; note(C ? `<b>${C.el} ${esc(C.jp)}</b> · ${esc(C.note)}` : '<b>eraser</b> · take stars back out'); };
  const fit = () => {
    const narrow = innerWidth <= 700;
    const css = Math.floor(narrow ? Math.min(innerWidth - 44, innerHeight * .39, 340) : Math.min(300, innerHeight - 330));
    dpr = Math.min(devicePixelRatio || 1, 2); size = Math.max(180, css);
    cv.style.width = cv.style.height = size + 'px'; cv.width = cv.height = Math.round(size * dpr);
    draw();
  };
  const draw = () => drawShell(x, cv.width, d, { hover: isTouch() ? null : hover });
  const sync = () => {
    P.querySelectorAll('.hb-seg button').forEach(b => b.classList.toggle('on', +b.dataset.m === d.mode));
    P.querySelectorAll('.hb-chip').forEach(b => b.classList.toggle('on', +b.dataset.c === color));
    const R = $('#hb-rings', P);
    R.innerHTML = d.mode === 0
      ? d.fx.map((f, r) => `<button class="hb-rg" data-r="${r}" title="${esc(EFFECTS[f].note)}"><i>${RING_LABEL[r]}</i><b>${EFFECTS[f].jp}</b><span>${EFFECTS[f].name}</span></button>`).join('')
      : `<button class="hb-rg wide" data-frame>frame <b>${d.frame ? '金の輪 gold ring' : 'none'}</b></button>`;
    R.querySelectorAll('[data-r]').forEach(b => b.onclick = () => {
      const r = +b.dataset.r; push(); d.fx[r] = (d.fx[r] + 1) % EFFECTS.length; const E = EFFECTS[d.fx[r]];
      note(`<b>${RING_LABEL[r]} · ${E.jp} ${E.name}</b> · ${esc(E.note)}`); chime(r * 2, true); changed(); sync();
    });
    const fr = R.querySelector('[data-frame]'); if (fr) fr.onclick = () => { push(); d.frame = d.frame ? 0 : 1; changed(); sync(); };
    name.value = d.name || ''; name.placeholder = displayName({ ...d, name: '' });
    $('#hb-sub', P).textContent = cb.label ? cb.label() : '';
    $('#hb-load', P).disabled = $('#hb-test', P).disabled = $('#hb-share', P).disabled = !starCount(d);
    draw();
  };
  const changed = () => { S.design = d; cb.onChange && cb.onChange(d); $('#hb-load', P).disabled = $('#hb-test', P).disabled = $('#hb-share', P).disabled = !starCount(d); name.placeholder = displayName({ ...d, name: '' }); draw(); };
  const push = () => { S.undo.push(clone(d)); if (S.undo.length > 40) S.undo.shift(); };
  const get = h => h.i != null ? d.grid[h.i] : h.core ? d.core : d.rings[h.r][h.s];
  const set = (h, v) => { if (h.i != null) d.grid[h.i] = v; else if (h.core) d.core = v; else d.rings[h.r][h.s] = v; };
  const deg = h => h.i != null ? Math.floor((GRID - 1 - Math.floor(h.i / GRID)) / 2) + (h.i % GRID) % 3 : h.core ? 0 : (3 - h.r) * 2 + h.s % 5;
  const at = e => { const b = cv.getBoundingClientRect(); return hitSlot((e.clientX - b.left) * dpr, (e.clientY - b.top) * dpr, cv.width, d); };
  const paint = e => {
    const h = at(e); if (!h) return;
    const cur = get(h);
    if (stroke.mode == null) stroke.mode = color && cur === color ? 'erase' : 'paint';
    const v = stroke.mode === 'erase' ? 0 : color;
    if (cur !== v) { set(h, v); stroke.changed = true; chime(deg(h), !!v); changed(); if (!noted) { noted = true; colorNote(); } }
  };
  cv.onpointerdown = e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); push(); stroke = { mode: null, changed: false }; paint(e); };
  cv.onpointermove = e => { if (stroke) paint(e); else if (!isTouch()) { const h = at(e); if (JSON.stringify(h) !== JSON.stringify(hover)) { hover = h; draw(); } } };
  cv.onpointerup = cv.onpointercancel = () => { if (stroke && !stroke.changed) S.undo.pop(); stroke = null; };
  cv.onpointerleave = () => { if (hover) { hover = null; draw(); } };
  P.querySelectorAll('.hb-chip').forEach(b => b.onclick = () => { color = S.color = +b.dataset.c; colorNote(); sync(); if (color) chime(color + 2, true); });
  let noted = !!starCount(d);
  P.querySelectorAll('.hb-seg button').forEach(b => b.onclick = () => { if (d.mode === +b.dataset.m) return; push(); d.mode = +b.dataset.m; note(d.mode ? '<b>型物 katamono</b> · draw a picture; it bursts flat, facing you' : '<b>割物 warimono</b> · each ring bursts into a sphere; the layout is the pattern'); changed(); sync(); });
  name.oninput = () => { d.name = cleanName(name.value); cb.onChange && cb.onChange(d); };
  $('#hb-x', P).onclick = () => cb.onClose();
  $('#hb-undo', P).onclick = () => { const u = S.undo.pop(); if (u) { d = S.design = u; changed(); sync(); } };
  $('#hb-clear', P).onclick = () => { push(); if (d.mode) d.grid = d.grid.map(() => 0); else { d.rings = d.rings.map(r => r.map(() => 0)); d.core = 0; } changed(); sync(); };
  $('#hb-rand', P).onclick = () => { push(); d = S.design = cb.surprise(); changed(); sync(); };
  $('#hb-new', P).onclick = () => { push(); d = S.design = cb.fresh(d.mode); changed(); sync(); };
  $('#hb-test', P).onclick = () => cb.onTest(d);
  $('#hb-load', P).onclick = () => cb.onLoad(d);
  $('#hb-share', P).onclick = () => cb.onShare(d);
  addEventListener('resize', fit);
  fit(); sync();
  if (starCount(d)) colorNote(); else note('<b>tap or drag around a ring</b> to pack stars · each ring bursts into a sphere');
  return {
    el: P,
    hide(on) { P.classList.toggle('off', on); },
    refresh() { d = S.design; sync(); },
    close() { removeEventListener('resize', fit); drop(P); },
  };
}

// ── the rack: tonight's running order ──
export function openRack(slots, cb) {
  const mine = slots.filter(s => s.who === 'you').length;
  const P = el('hb-card', `
    <div class="hb-head"><div class="hb-title"><b>今夜の花火</b><span>tonight's shells, in the order they'll go up</span></div><button class="hb-x" id="hb-rx" aria-label="close">✕</button></div>
    <ol class="hb-list">${slots.map((s, i) => s.design
      ? `<li class="${s.who === 'you' ? 'you' : ''}"><span class="n">${i + 1}</span><span class="hb-dot" style="background:${swatch(s.design)}"></span><span class="nm">${esc(displayName(s.design))}</span><span class="by">${esc(s.byLabel)}</span><button class="hb-mini" data-t="${i}" aria-label="test fire">▶</button>${s.who === 'you' ? `<button class="hb-mini" data-e="${i}">✎</button>` : ''}</li>`
      : `<li class="empty">${i + 1} · your shell goes here</li>`).join('')}</ol>
    <button class="hb-btn go big" id="hb-start" ${mine ? '' : 'disabled'}>start the show ▶</button>
    <div class="hb-small">${mine ? 'yours go up last, after the gold crown' : 'make a shell at the bench first'}</div>`);
  $('#hb-rx', P).onclick = () => cb.onClose();
  P.querySelectorAll('[data-t]').forEach(b => b.onclick = () => cb.onTest(+b.dataset.t));
  P.querySelectorAll('[data-e]').forEach(b => b.onclick = () => cb.onEdit(+b.dataset.e));
  $('#hb-start', P).onclick = () => cb.onStart();
  return { el: P, close() { drop(P); } };
}

// ── the show: one button, on the beat ──
export function openShow(list, cb) {
  const P = el('hb-show', `<div class="hb-q panel" id="hb-q">${list.map(s => `<i style="background:${swatch(s.design)}"></i>`).join('')}</div>
    <button class="hb-fire" id="hb-fire" aria-label="fire the next shell"><b>点火</b><span>fire</span></button>
    <div class="hb-tip" id="hb-tip">${isTouch() ? 'tap' : 'click or press space'} on the beat ✦</div>`, false);
  const J = document.createElement('div'); J.className = 'hb-judge'; root.appendChild(J);
  const btn = $('#hb-fire', P);
  btn.onpointerdown = e => { e.preventDefault(); e.stopPropagation(); cb.onFire(); };
  let jt = 0;
  return {
    el: P,
    setNext(i) { $('#hb-q', P).querySelectorAll('i').forEach((c, k) => { c.classList.toggle('next', k === i); c.classList.toggle('gone', k < i); }); },
    beat(ph) { btn.style.setProperty('--ring', (1 + Math.max(0, 1 - ph) * .55).toFixed(3)); btn.style.setProperty('--ro', (ph > .55 ? (ph - .55) / .45 : 0).toFixed(3)); },
    hit() { btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit'); },
    judge(t) { J.textContent = t; J.classList.add('on'); clearTimeout(jt); jt = setTimeout(() => J.classList.remove('on'), 520); },
    mine(on, label) { btn.classList.toggle('mine', on); btn.innerHTML = on ? '<b>スター<br>マイン</b>' : '<b>点火</b><span>fire</span>'; $('#hb-tip', P).textContent = label || ''; },
    tip(t) { $('#hb-tip', P).textContent = t; },
    close() { drop(P); J.remove(); },
  };
}

// ── share: a link that bursts your firework over someone else's balcony ──
export function openShare(d, url, cb) {
  const P = el('hb-card', `
    <div class="hb-head"><div class="hb-title"><b>✉ send a firework</b><span>whoever opens the link sees it burst over the balcony</span></div><button class="hb-x" id="hb-sx" aria-label="close">✕</button></div>
    <div class="hb-prev"><canvas id="hb-pc" width="168" height="168"></canvas><div><b>${esc(displayName(d))}</b><span>${starCount(d)} stars · ${d.mode ? '型物 a picture' : '割物 a shell'}</span></div></div>
    <div class="hb-row"><input readonly id="hb-url" value="${esc(url)}" aria-label="link"><button class="hb-btn go" id="hb-copy" style="flex:none">copy</button></div>
    ${navigator.share ? '<button class="hb-btn" id="hb-native">share…</button>' : ''}
    <div class="hb-small" id="hb-res"></div>`);
  drawShell($('#hb-pc', P).getContext('2d'), 168, d);
  const inp = $('#hb-url', P); stopKeys(inp);
  $('#hb-sx', P).onclick = () => cb.onClose();
  $('#hb-copy', P).onclick = () => {
    const ok = () => { $('#hb-res', P).textContent = 'copied ✦ paste it to a friend'; cb.onShared && cb.onShared(); };
    const fail = () => { inp.focus(); inp.select(); $('#hb-res', P).textContent = isTouch() ? 'selected · tap and hold to copy' : 'selected · press ⌘C / Ctrl+C'; cb.onShared && cb.onShared(); };
    try { navigator.clipboard.writeText(url).then(ok, fail); } catch { fail(); }
  };
  const nat = $('#hb-native', P);
  if (nat) nat.onclick = () => navigator.share({ title: 'a firework from Clawd\'s balcony', text: `I made ${displayName(d)} 🎆`, url }).then(() => cb.onShared && cb.onShared(), () => {});
  return { el: P, close() { drop(P); } };
}

// ── a firework someone sent you ──
export function openGift(d, cb) {
  const P = el('hb-card', `
    <div class="hb-kick">🎆 a firework from a friend</div>
    <div class="hb-prev"><canvas id="hb-gc" width="168" height="168"></canvas><div><b>“${esc(displayName(d))}”</b><span>made at someone else's bench, sent to yours</span></div></div>
    <div class="hb-acts"><button class="hb-btn" id="hb-again">▶ watch it again</button><button class="hb-btn go" id="hb-reply">make one back</button></div>`);
  drawShell($('#hb-gc', P).getContext('2d'), 168, d);
  $('#hb-again', P).onclick = () => cb.onWatch();
  $('#hb-reply', P).onclick = () => cb.onReply();
  return { el: P, close() { drop(P); } };
}

export function pill(text, onClick) {
  init();
  const b = document.createElement('button'); b.className = 'hb-pill panel'; b.textContent = text; root.appendChild(b);
  b.onclick = e => { e.stopPropagation(); onClick(); };
  b.addEventListener('pointerdown', e => e.stopPropagation());
  return { close() { b.remove(); } };
}

export function clearUI() { root?.querySelectorAll('.hb,.hb-pill,.hb-judge').forEach(n => n.remove()); }

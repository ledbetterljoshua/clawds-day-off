// Day 4 DOM: the tanzaku wish overlay, the wish reveal card, and the origami minigame panel.
import { G } from '../../core/state.js';
import { $, esc, rand, pick } from '../../core/util.js';
import { mini } from '../../core/minigames.js';
import { audio } from '../../core/audio.js';
import { GOSHIKI } from './props.js';

const CSS = `
#tb-wish{position:fixed;inset:0;z-index:15;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));background:radial-gradient(ellipse at center,rgba(12,10,30,.2),rgba(12,10,30,.6));transition:opacity .4s}
#tb-wish .tb-sheet{display:flex;gap:26px;align-items:center;background:var(--paper);color:var(--paper-ink);border-radius:14px;padding:22px 26px;box-shadow:0 24px 70px rgba(0,0,0,.45);max-width:min(620px,100%);max-height:100%;overflow:auto}
.tb-strip{--strip:#d8343c;--ink:#2a0d10;position:relative;width:76px;height:300px;flex:none;border-radius:2px;background:var(--strip);box-shadow:0 8px 18px rgba(0,0,0,.18),inset 0 0 0 1px rgba(0,0,0,.06);transform:rotate(-2deg);transition:background .25s}
.tb-strip::before{content:'';position:absolute;left:50%;top:13px;width:9px;height:9px;margin-left:-4.5px;border-radius:50%;background:rgba(0,0,0,.35)}
.tb-strip::after{content:'';position:absolute;left:50%;top:-26px;width:1.5px;height:44px;background:#3a3532}
.tb-text{position:absolute;top:34px;bottom:14px;left:6px;right:6px;writing-mode:vertical-rl;text-orientation:mixed;font-family:var(--hand);font-weight:600;font-size:20px;line-height:1.25;color:var(--ink);display:flex;align-items:center;overflow:hidden;word-break:break-word}
.tb-text.empty{opacity:.35}
.tb-form{display:flex;flex-direction:column;gap:12px;min-width:0;flex:1}
.tb-form h3{font-family:var(--round);font-weight:800;font-size:22px;line-height:1.15;text-wrap:balance}
.tb-form h3 small{display:block;font-family:var(--hand);font-weight:600;font-size:13px;color:var(--pencil);margin-bottom:4px}
.tb-form label{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--pencil)}
.tb-form input{font-family:var(--hand);font-size:18px;padding:10px 12px;border:1.5px solid var(--rule);border-radius:10px;background:#fff;color:var(--paper-ink);width:100%;outline:none}
.tb-form input:focus{border-color:var(--acc)}
.tb-row{display:flex;justify-content:space-between;align-items:center;gap:10px}
.tb-count{font-size:11px;color:var(--pencil);font-variant-numeric:tabular-nums}
.tb-colors{display:flex;gap:8px}
.tb-colors button{width:30px;height:30px;border-radius:50%;border:2px solid rgba(0,0,0,.12);cursor:pointer;font-family:var(--hand);font-size:12px;font-weight:600;display:grid;place-items:center}
.tb-colors button[aria-checked="true"]{outline:2.5px solid var(--acc);outline-offset:2px}
.tb-note{font-size:11px;color:var(--pencil);line-height:1.5}
.tb-acts{display:flex;gap:10px;flex-wrap:wrap}
#tb-card{position:fixed;z-index:13;top:16vh;left:max(16px,6vw);transform:translateY(-12px);display:flex;gap:16px;align-items:flex-start;opacity:0;transition:opacity .6s,transform .6s;pointer-events:none;max-width:calc(100vw - 32px)}
#tb-card.in{opacity:1;transform:none}
#tb-card .tb-strip{width:64px;height:250px}
#tb-card .tb-text{font-size:19px;top:30px}
#tb-card .tb-cap{background:rgba(22,20,27,.84);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:12px 14px;color:var(--ink);max-width:250px;margin-top:40px;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
#tb-card .tb-who{font-size:11px;color:var(--dim);letter-spacing:.04em}
#tb-card .tb-en{font-family:var(--hand);font-size:17px;line-height:1.4;margin-top:4px}
.tb-ori{position:relative;width:190px;height:150px;margin:2px auto;touch-action:none;cursor:grab;border-radius:10px;background:rgba(255,255,255,.06)}
.tb-ori svg{position:absolute;left:35px;top:15px;width:120px;height:120px;transition:transform .28s}
.tb-ori svg.flip{transform:scaleY(.15) rotate(8deg)}
.tb-ori .tb-arrow{position:absolute;right:8px;top:8px;font-size:26px;color:var(--acc);font-weight:600;animation:tbnudge 1s ease-in-out infinite}
@keyframes tbnudge{50%{transform:translate(var(--nx,0),var(--ny,0))}}
.tb-dots{letter-spacing:4px;color:var(--dim);font-size:11px}
.tb-dots b{color:var(--acc)}
@media (max-width:560px){
  #tb-wish .tb-sheet{flex-direction:column;gap:14px;padding:18px}
  #tb-wish .tb-strip{width:64px;height:210px}
  #tb-card{top:max(18px,env(safe-area-inset-top));left:50%;transform:translateX(-50%) translateY(-12px)}
  #tb-card.in{transform:translateX(-50%)}
  #tb-card .tb-strip{width:52px;height:200px}
  #tb-card .tb-cap{max-width:180px;margin-top:24px}
}`;

let styleEl = null;
export function injectCSS() { if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'tanabata-css'; styleEl.textContent = CSS; document.head.appendChild(styleEl); } }
export function removeUI() {
  styleEl?.remove(); styleEl = null;
  $('#tb-wish')?.remove(); $('#tb-card')?.remove();
}

const PLACEHOLDERS = ['to see the stars', 'for one more day off', 'that the tests keep passing', 'to remember this summer', 'shaved ice every day'];

// the wish sheet. resolves { text, color } or null if put off for later
export function openWish({ ending = false } = {}) {
  injectCSS();
  return new Promise(resolve => {
    $('#tb-wish')?.remove();
    let color = GOSHIKI[1];
    const el = document.createElement('div'); el.id = 'tb-wish'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'write your wish');
    el.innerHTML = `<div class="tb-sheet">
      <div class="tb-strip" id="tbStrip"><div class="tb-text empty" id="tbText">${esc(PLACEHOLDERS[0])}</div></div>
      <form class="tb-form" id="tbForm" autocomplete="off">
        <h3><small>たんざく · tanzaku</small>${ending ? 'The stars are coming out. Write your wish.' : 'Write a wish on the strip.'}</h3>
        <label for="tbInput">your wish</label>
        <input id="tbInput" maxlength="40" spellcheck="false" placeholder="${esc(pick(PLACEHOLDERS))}">
        <div class="tb-row"><div class="tb-colors" role="radiogroup" aria-label="paper color">${GOSHIKI.map((c, i) => `<button type="button" role="radio" aria-checked="${i === 1}" aria-label="${c.en}" data-i="${i}" style="background:${c.css};color:${c.ink}">${c.jp}</button>`).join('')}</div><span class="tb-count" id="tbCount">0/40</span></div>
        <div class="tb-note">五色の短冊: the five colors come from the five elements.</div>
        <div class="tb-acts"><button class="go" type="submit" id="tbHang">hang it ✦</button><button class="ghost" type="button" id="tbLater">${ending ? 'let clawd choose' : 'later'}</button></div>
      </form></div>`;
    document.body.appendChild(el);
    const input = $('#tbInput', el), text = $('#tbText', el), strip = $('#tbStrip', el), count = $('#tbCount', el);
    const paintStrip = () => { strip.style.setProperty('--strip', color.css); strip.style.setProperty('--ink', color.ink); };
    paintStrip();
    const sync = () => {
      const v = input.value.trim();
      text.textContent = v || input.placeholder; text.classList.toggle('empty', !v);
      count.textContent = `${input.value.length}/40`;
    };
    sync();
    input.addEventListener('input', () => { sync(); audio.sfx('brush', { gap: .08 }); });
    // typing here must never drive the game's keyboard shortcuts
    for (const t of ['keydown', 'keyup', 'keypress']) input.addEventListener(t, e => { e.stopPropagation(); if (t === 'keydown' && e.key === 'Escape') later(); });
    el.querySelectorAll('.tb-colors button').forEach(b => b.onclick = () => {
      color = GOSHIKI[+b.dataset.i];
      el.querySelectorAll('.tb-colors button').forEach(x => x.setAttribute('aria-checked', x === b)); paintStrip(); audio.sfx('paper');
    });
    const close = v => { el.style.opacity = 0; setTimeout(() => el.remove(), 380); resolve(v); };
    function later() { close(ending ? { text: input.value.trim() || 'for one more day off', color } : null); }
    $('#tbForm', el).addEventListener('submit', e => {
      e.preventDefault();
      const v = input.value.trim() || input.placeholder;
      audio.sfx('done');
      close({ text: v, color });
    });
    $('#tbLater', el).onclick = later;
    el.addEventListener('pointerdown', e => { if (e.target === el) later(); });
    setTimeout(() => input.focus(), 60);
  });
}
export const wishOpen = () => !!$('#tb-wish');

// a helper's (or Clawd's) wish, shown big while it's being written
export function showCard(who, jp, en, color) {
  injectCSS();
  let el = $('#tb-card');
  if (!el) { el = document.createElement('div'); el.id = 'tb-card'; document.body.appendChild(el); }
  el.innerHTML = `<div class="tb-strip" style="--strip:${color.css};--ink:${color.ink}"><div class="tb-text">${esc(jp)}</div></div>
    <div class="tb-cap"><div class="tb-who">${esc(who)}</div><div class="tb-en">${esc(en)}</div></div>`;
  requestAnimationFrame(() => el.classList.add('in'));
}
export function hideCard() { const el = $('#tb-card'); if (el) el.classList.remove('in'); }

// ── origami: fold along the arrows ──
const DIRS = { up: ['↑', 0, -1], down: ['↓', 0, 1], left: ['←', -1, 0], right: ['→', 1, 0] };
const SHAPES = {
  crane: [
    'M60 8 L112 60 L60 112 L8 60 Z',
    'M8 60 L112 60 L60 112 Z',
    'M60 24 L96 60 L60 96 L24 60 Z',
    'M60 6 L78 62 L60 114 L42 62 Z',
    'M6 30 L40 72 L46 22 L60 70 L74 22 L80 72 L108 30 L114 40 L104 37 L84 80 L60 100 L36 80 Z',
  ],
  lantern: [
    'M18 30 H102 V90 H18 Z',
    'M18 56 H102 V90 H18 Z',
    'M18 56 H102 V90 H18 Z M30 60 V86 M42 60 V86 M54 60 V86 M66 60 V86 M78 60 V86 M90 60 V86',
    'M18 30 H102 V90 H18 Z M30 40 V80 M42 40 V80 M54 40 V80 M66 40 V80 M78 40 V80 M90 40 V80',
    'M42 18 H78 Q106 60 78 102 H42 Q14 60 42 18 Z M50 24 Q36 60 50 96 M60 22 V98 M70 24 Q84 60 70 96',
  ],
};
const STEP_WORDS = { crane: ['fold in half', 'fold again', 'squash fold', 'petal fold', 'neck and tail'], lantern: ['fold in half', 'cut the slits', 'unfold', 'roll it round'] };

// returns the minigame controller; onDone(quality 0..1)
export function origami(kind, color, { onStep, onDone, onClose } = {}) {
  injectCSS();
  const shapes = SHAPES[kind], steps = shapes.length - 1;
  const seq = []; let last = '';
  for (let i = 0; i < steps; i++) { let d; do d = pick(Object.keys(DIRS)); while (d === last); seq.push(d); last = d; }
  let i = 0, q = 0, busy = false, start = null;
  const html = `<div class="mt">${kind === 'crane' ? 'fold a crane · 折り鶴' : 'fold a lantern · 提灯'}</div>
    <div class="tb-ori" id="tbOri"><svg viewBox="0 0 120 120" id="tbSvg"><path id="tbPath" fill="${color}" stroke="rgba(0,0,0,.25)" stroke-width="1.5" stroke-linejoin="round"/></svg><div class="tb-arrow" id="tbArrow"></div></div>
    <div class="tb-dots" id="tbDots"></div>
    <div class="ms" id="tbHint"></div><div class="res" id="res"></div>`;
  const c = mini.custom({
    kind: 'origami', html,
    setup(el) {
      const ori = $('#tbOri', el);
      ori.addEventListener('pointerdown', e => { e.stopPropagation(); ori.setPointerCapture(e.pointerId); start = [e.clientX, e.clientY]; });
      ori.addEventListener('pointerup', e => {
        if (!start) return; const dx = e.clientX - start[0], dy = e.clientY - start[1]; start = null;
        if (Math.hypot(dx, dy) < 22) { c.act(); return; }      // a tap folds the way the arrow says, a little less neatly
        c.fold(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      });
      render();
    },
    act() { c.fold(seq[i], .75); },
    onClose,
  });
  function render() {
    const el = $('#mini');
    $('#tbPath', el).setAttribute('d', shapes[i]);
    const done = i >= steps;
    const [glyph, nx, ny] = done ? ['✓', 0, 0] : DIRS[seq[i]];
    const ar = $('#tbArrow', el); ar.textContent = glyph; ar.style.setProperty('--nx', nx * 6 + 'px'); ar.style.setProperty('--ny', ny * 6 + 'px');
    $('#tbDots', el).innerHTML = Array.from({ length: steps }, (_, k) => k < i ? '<b>●</b>' : '○').join(' ');
    $('#tbHint', el).textContent = done ? 'done!' : `${STEP_WORDS[kind][i]} · swipe ${glyph} or press the arrow`;
  }
  c.fold = (dir, quality) => {
    if (busy || i >= steps || G.mini !== c) return;
    const ok = dir === seq[i], qq = quality ?? (ok ? 1 : .45);
    q += qq; i++; busy = true;
    const res = $('#res', $('#mini')); res.textContent = ok ? (qq === 1 ? 'crisp fold ✦' : 'fold') : 'a little crumpled'; res.style.color = ok ? 'var(--ok)' : 'var(--warn)';
    audio.sfx('fold'); onStep && onStep(i / steps);
    const svg = $('#tbSvg', $('#mini')); svg.classList.add('flip');
    setTimeout(() => {
      if (G.mini !== c) return;
      svg.classList.remove('flip'); render(); busy = false;
      if (i >= steps) setTimeout(() => { if (G.mini === c) { c.close(false); onDone && onDone(q / steps); } }, 420);
    }, 200);
  };
  return c;
}
export const ARROWS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };

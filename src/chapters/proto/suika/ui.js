// DOM for the suikawari sketch: the command pad with its context meter, helper 1's question,
// the blindfold (dark cloth, a little light through the weave, voices at its edges) and the
// title card. Its CSS is injected here and removed on unmount.
import { esc } from '../../../core/util.js';

const CSS = `
body.sk-suika #hint{bottom:calc(max(14px,env(safe-area-inset-bottom)) + 168px)}
body.sk-suika #term{height:min(32vh,250px)}
#sk-pad{position:fixed;z-index:6;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(468px,calc(100vw - 20px));padding:10px 10px 10px;user-select:none;-webkit-user-select:none;touch-action:none;transition:opacity .35s,transform .35s}
#sk-pad.off{opacity:0;pointer-events:none;transform:translate(-50%,16px)}
.sk-meter{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--dim);padding:0 4px 8px}
.sk-meter .lab{letter-spacing:.06em;text-transform:uppercase;font-size:10px}
.sk-pips{display:flex;gap:3px;flex:1}
.sk-pips i{flex:1;height:7px;border-radius:2px;background:rgba(255,255,255,.12);transition:background .25s}
.sk-pips i.on{background:var(--acc)}
.sk-pips i.hot{background:var(--warn)}
.sk-n{font-variant-numeric:tabular-nums;color:var(--ink);min-width:34px;text-align:right}
.sk-sw{white-space:nowrap}
.sk-sw b{color:var(--ink);letter-spacing:2px}
.sk-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.sk-grid button{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-height:50px;padding:6px 4px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.07);color:var(--ink);font-size:18px;line-height:1.1;cursor:pointer;touch-action:none;transition:background .12s,transform .08s,border-color .12s}
.sk-grid button span{font-size:10.5px;color:var(--dim)}
.sk-grid button:active,.sk-grid button.flash{transform:scale(.95);background:rgba(217,119,87,.35)}
.sk-grid button.on{border-color:var(--acc);background:rgba(217,119,87,.28)}
.sk-grid button.on span{color:var(--ink)}
.sk-grid .swing{background:#c8423a;border-color:#e86a5e;font-weight:700;font-size:15px;letter-spacing:.04em}
.sk-grid .swing span{color:#ffd9d2}
.sk-grid .stop{font-size:17px}
.sk-grid .stop.pulse{animation:skpulse .5s infinite alternate}
@keyframes skpulse{to{background:rgba(247,212,136,.45);border-color:var(--warn)}}
.sk-grid button[disabled]{opacity:.28;pointer-events:none}
.sk-grid kbd{position:absolute;top:3px;right:5px;font:9px var(--mono);color:rgba(255,255,255,.32)}
#sk-pad.blind .sk-grid .pr{display:none}
#sk-pad.blind [data-c="left"]{grid-area:1/1}
#sk-pad.blind [data-c="fwd"]{grid-area:1/2}
#sk-pad.blind [data-c="right"]{grid-area:1/3}
#sk-pad.blind [data-c="back"]{grid-area:2/2}
#sk-pad.blind [data-c="swing"]{grid-area:1/4/3/5}
.sk-ask{position:absolute;inset:0;border-radius:12px;background:rgba(22,20,27,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:10px;transition:opacity .2s}
.sk-ask .q{font-size:13px;text-align:center}
.sk-ask .a{display:flex;gap:8px;width:100%}
.sk-ask button{flex:1;min-height:52px;border-radius:10px;border:1px solid var(--acc);background:rgba(217,119,87,.18);color:var(--ink);font-size:13px;cursor:pointer;padding:6px}
.sk-ask button span{display:block;font-size:10.5px;color:var(--dim);margin-top:2px}
#sk-blind{position:fixed;inset:0;z-index:3;pointer-events:none;opacity:0;transition:opacity .7s;overflow:hidden;background:#1c0e0b}
#sk-blind .weave{position:absolute;inset:-75%;background:
  repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 2px,transparent 2px 6px),
  repeating-linear-gradient(90deg,rgba(255,200,170,.05) 0 2px,transparent 2px 6px),
  radial-gradient(ellipse at 50% 50%,#4a2219,#200d0a 75%)}
#sk-blind .glow{position:absolute;inset:0;background:radial-gradient(ellipse 60% 50% at 50% 28%,rgba(255,150,90,var(--lk,.18)),transparent 72%);mix-blend-mode:screen}
#sk-blind .vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,transparent 45%,rgba(0,0,0,.55))}
.sk-edge{position:absolute;transform:translate(-50%,-50%);background:rgba(22,20,27,.92);border:1px solid var(--line);color:var(--ink);font-size:13px;padding:6px 11px;border-radius:10px;white-space:nowrap;transition:opacity .35s;max-width:70vw;overflow:hidden;text-overflow:ellipsis}
.sk-edge b{margin-right:5px}
.sk-edge.loud{font-weight:700;color:#fff;border-color:var(--warn)}
#sk-title{position:fixed;z-index:7;left:50%;top:38%;transform:translate(-50%,-50%);text-align:center;color:#fff;text-shadow:0 2px 18px rgba(0,40,80,.45);pointer-events:none;opacity:0;transition:opacity .8s}
#sk-title b{display:block;font-family:var(--hand);font-weight:600;font-size:clamp(28px,8vw,58px);letter-spacing:.04em;white-space:nowrap}
#sk-title span{display:block;font-size:13px;letter-spacing:.2em;text-transform:uppercase;margin-top:6px;opacity:.9}
@media (pointer:coarse){.sk-grid kbd{display:none}}
@media (max-width:700px){body.sk-suika #hint{bottom:calc(max(14px,env(safe-area-inset-bottom)) + 172px)}.sk-grid button{min-height:52px}}
`;

const BTN = [
  ['left', '⟲', 'left', '←', 'mv'], ['fwd', '⬆', 'forward', '↑', 'mv'], ['right', '⟳', 'right', '→', 'mv'], ['stop', '✋', 'stop', 'esc', 'pr stop'],
  ['little', 'ちょっと', 'a little', '⇧', 'pr tog'], ['back', '⬇', 'back', '↓', 'mv'], ['around', '↻', 'turn around', 'Q', 'pr'], ['swing', 'SWING!', '振る', 'space', 'swing'],
];

let pad = null, blindEl = null, titleEl = null, styleEl = null, H = null, mode = 'off';
const $ = (s, r = document) => r.querySelector(s);

export const ui = {
  mount(handlers) {
    H = handlers;
    styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl);
    document.body.classList.add('sk-suika');
    pad = document.createElement('div'); pad.id = 'sk-pad'; pad.className = 'panel off';
    pad.innerHTML = `<div class="sk-meter"><span class="lab">context</span><span class="sk-pips"></span><span class="sk-n"></span><span class="sk-sw">swings <b></b></span></div>
      <div class="sk-grid">${BTN.map(([c, g, l, k, cls]) => `<button data-c="${c}" class="${cls}" aria-label="${l}">${g}<span>${l}</span><kbd>${k}</kbd></button>`).join('')}</div>
      <div class="sk-ask hidden"><div class="q"></div><div class="a"></div></div>`;
    document.body.appendChild(pad);
    pad.addEventListener('pointerdown', e => e.stopPropagation());
    pad.querySelectorAll('.sk-grid button').forEach(b => {
      const c = b.dataset.c;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch { /* synthetic or already gone */ }
        if (mode === 'blind') { H.hold(c, true); b.classList.add('on'); } else H.cmd(c);
      });
      const up = () => { if (mode === 'blind') { H.hold(c, false); b.classList.remove('on'); } };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
    });
    blindEl = document.createElement('div'); blindEl.id = 'sk-blind';
    blindEl.innerHTML = '<div class="weave"></div><div class="glow"></div><div class="vig"></div>';
    document.getElementById('bubbles').before(blindEl);
    titleEl = document.createElement('div'); titleEl.id = 'sk-title'; document.body.appendChild(titleEl);
  },
  unmount() {
    [pad, blindEl, titleEl, styleEl].forEach(e => e?.remove());
    pad = blindEl = titleEl = styleEl = null; H = null; mode = 'off';
    document.body.classList.remove('sk-suika');
  },
  // 'prompt' (one press, one message), 'blind' (hold to walk and turn), or 'off'
  mode(m) {
    mode = m; if (!pad) return;
    pad.classList.toggle('off', m === 'off');
    pad.classList.toggle('blind', m === 'blind');
    $('.lab', pad).textContent = m === 'blind' ? 'blindfolded · listen' : 'context';
    $('.sk-pips', pad).style.visibility = $('.sk-n', pad).style.visibility = m === 'blind' ? 'hidden' : '';
    if (m !== 'prompt') ui.unask();
    pad.querySelectorAll('.sk-grid button').forEach(b => b.classList.remove('on', 'pulse'));
  },
  context(used, max) {
    if (!pad) return;
    const pips = $('.sk-pips', pad);
    if (pips.children.length !== max) pips.innerHTML = '<i></i>'.repeat(max);
    [...pips.children].forEach((p, i) => { p.classList.toggle('on', i < used); p.classList.toggle('hot', i < used && used > max - 3); });
    $('.sk-n', pad).textContent = `${used}/${max}`;
  },
  swings(left, max) { if (pad) $('.sk-sw b', pad).textContent = '●'.repeat(Math.max(0, left)) + '○'.repeat(Math.max(0, max - left)); },
  little(on) { pad?.querySelector('[data-c="little"]').classList.toggle('on', on); },
  flash(c) { const b = pad?.querySelector(`[data-c="${c}"]`); if (!b) return; b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 140); },
  pulse(c, on) { pad?.querySelector(`[data-c="${c}"]`)?.classList.toggle('pulse', on); },
  enable(on) { pad?.querySelectorAll('.sk-grid button').forEach(b => b.disabled = !on); },
  ask(q, opts) {
    if (!pad) return;
    const a = $('.sk-ask', pad);
    $('.q', a).innerHTML = q;
    $('.a', a).innerHTML = opts.map(([k, l, s]) => `<button data-k="${k}">${esc(l)}<span>${esc(s || '')}</span></button>`).join('');
    a.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); H.answer(b.dataset.k); }));
    a.classList.remove('hidden');
  },
  unask() { pad && $('.sk-ask', pad).classList.add('hidden'); },
  blind(on) { if (blindEl) blindEl.style.opacity = on ? 1 : 0; },
  light(v) { blindEl?.style.setProperty('--lk', (.08 + .32 * v).toFixed(3)); },
  spin(a) { const w = blindEl && $('.weave', blindEl); if (w) w.style.transform = `rotate(${a}rad) scale(1.05)`; },
  // a voice from a direction: bearing 0 = ahead (top of the screen), +π/2 = your left
  edge(icon, text, bearing, { loud = false, dur = 2.2 } = {}) {
    if (!blindEl) return;
    const d = document.createElement('div'); d.className = 'sk-edge' + (loud ? ' loud' : '');
    d.innerHTML = `<b>${icon}</b>${esc(text)}`;
    const sx = 50 - 36 * Math.sin(bearing), sy = 50 - 34 * Math.cos(bearing);
    d.style.left = sx + '%'; d.style.top = sy + '%';
    blindEl.appendChild(d);
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 400); }, dur * 1000);
  },
  clearEdges() { blindEl?.querySelectorAll('.sk-edge').forEach(e => e.remove()); },
  title(big, small, dur = 2.6) {
    if (!titleEl) return;
    titleEl.innerHTML = `<b>${esc(big)}</b><span>${esc(small)}</span>`;
    titleEl.style.opacity = 1;
    setTimeout(() => { if (titleEl) titleEl.style.opacity = 0; }, dur * 1000);
  },
};

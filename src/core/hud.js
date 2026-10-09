// In-play HUD: the todo panel (Claude Code style), sky clock, helper cards, hint line,
// hover tooltip, and toasts. Reads the active chapter for content.
import { G } from './state.js';
import { $, esc, forTouch } from './util.js';
import { helpers } from './crab.js';
import { audio } from './audio.js';

const ids = ['#todo', '#clock', '#crew', '#hint'];
// toasts sit between the todo and clock panels; where that gap is too narrow (tablets in portrait,
// phones) they drop below the taller panel
function placeToasts() {
  const box = $('#toasts'), t = $('#todo').getBoundingClientRect(), c = $('#clock').getBoundingClientRect();
  const fits = !t.width || box.offsetWidth + 24 <= c.left - t.right;
  box.style.top = fits ? '' : Math.max(t.bottom, c.bottom) + 10 + 'px';
}
let todoSig = '', hudT = 0;

export const hud = {
  onCard: null,       // (helper) => void   set by game
  show(which = ids) { which.forEach(id => $(id).classList.remove('hidden')); },
  hide(which = ids) { which.forEach(id => $(id).classList.add('hidden')); $('#tip').classList.add('hidden'); },

  setup(def) {
    todoSig = '';
    $('#crew').innerHTML = '';
    const showCrew = def.delegation !== false;
    $('#crew').style.display = showCrew ? '' : 'none';
    $('#clock .s').textContent = def.clockNote || '';
  },

  // rows: [{ label, done, detail(html), workers:[str], blocked }]
  renderTodo() {
    const def = G.chapter; if (!def || !def.todo) return;
    const rows = def.todo();
    const html = `<div class="th"><span class="dot"></span>${esc(def.goal || def.prompt || '')}</div>` + rows.map(r =>
      `<div class="row ${r.done ? 'done' : ''} ${r.blocked && !r.done ? 'blocked' : ''}"><span class="box">${r.done ? '✓' : '☐'}</span><span class="lab">${esc(r.label)}</span><span class="det">${r.detail || ''}</span>${!r.done && r.workers?.length ? `<span class="who">${r.workers.join(' · ')}</span>` : ''}</div>`).join('');
    if (html !== todoSig) { $('#todo').innerHTML = html; todoSig = html; }
  },

  renderCrew() {
    const el = $('#crew');
    if (!el.children.length) {
      el.innerHTML = helpers.map(h => `<button class="card panel" data-i="${h.i}"><b>${h.name}</b><span class="spec"></span><span class="st">idle</span></button>`).join('');
      el.querySelectorAll('.card').forEach(b => b.onclick = e => { e.stopPropagation(); hud.onCard && hud.onCard(helpers[+b.dataset.i]); });
    }
    el.querySelectorAll('.card').forEach((b, i) => {
      const h = helpers[i];
      b.classList.toggle('sel', G.selected === h);
      b.style.display = h.g.visible ? '' : 'none';
      const spec = `${h.icon} ${h.specName}`;
      const sp = b.querySelector('.spec'); if (sp.textContent !== spec) sp.textContent = spec;
      const job = h.job && G.chapter?.jobs?.[h.job];
      const st = h.asleep ? 'z z z' : h.action ? `▸ ${h.action.verb || h.action.kind}` : job ? (h.waitMsg || `→ ${job.label || h.job}`) : 'idle';
      const s = b.querySelector('.st'); if (s.textContent !== st) s.textContent = st;
    });
  },

  renderClock() {
    const def = G.chapter; if (!def) return;
    const [a, b] = def.clock || [17 * 60, 19 * 60 + 45];
    const m = Math.round(a + (b - a) * G.phase), hh = Math.floor(m / 60) % 24, mm = m % 60;
    const ap = hh >= 12 ? 'pm' : 'am', h12 = hh % 12 || 12;
    const icon = G.phase < .55 ? '☀' : G.phase < .86 ? '🌇' : '🌙';
    $('#clock .t').textContent = `${icon} ${h12}:${String(mm).padStart(2, '0')} ${ap}`;
  },
  clockText(phase = G.phase) {
    const [a, b] = G.chapter?.clock || [17 * 60, 19 * 60 + 45];
    const m = Math.round(a + (b - a) * phase), hh = Math.floor(m / 60) % 24, mm = m % 60;
    return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'pm' : 'am'}`;
  },

  setHint(t) { const h = $('#hint'); t = forTouch(t); if (h.textContent !== t) h.textContent = t; },

  tip(text, x, y) {
    const tip = $('#tip');
    if (!text) { tip.classList.add('hidden'); return; }
    tip.classList.remove('hidden'); tip.textContent = text; tip.style.left = x + 'px'; tip.style.top = y + 'px';
  },

  toast(html, { dur = 3.2, kind = '' } = {}) {
    const d = document.createElement('div'); d.className = 'toast panel ' + kind; d.innerHTML = forTouch(html);
    $('#toasts').appendChild(d); placeToasts();
    requestAnimationFrame(() => d.classList.add('in'));
    setTimeout(() => { d.classList.remove('in'); setTimeout(() => d.remove(), 500); }, dur * 1000);
    audio.sfx('chime');
  },

  update(dt) {
    hudT -= dt;
    if (hudT > 0 || G.mode !== 'play') return;
    hudT = .12;
    hud.renderTodo(); hud.renderCrew(); hud.renderClock();
    const def = G.chapter;
    let hint = '';
    if (G.selected) hint = `${G.selected.name} (${G.selected.icon} ${G.selected.specName}) selected → click a station to delegate`;
    else if (def?.hint) hint = def.hint() || '';
    hud.setHint(hint);
  },
};

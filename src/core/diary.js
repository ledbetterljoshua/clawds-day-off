// なつやすみ えにっき — the summer picture diary. Title cover, the week, and one page per
// evening (a photo taken at the evening's best moment + what happened, in a kid's diary voice).
import { G } from './state.js';
import { $, $$, esc } from './util.js';
import { renderer } from './gfx.js';
import { save } from './save.js';
import { audio } from './audio.js';
import { cam } from './camera.js';
import { clawd } from './crab.js';

const ov = $('#overlay');
const WEEKDAY_JP = ['日', '月', '火', '水', '木', '金', '土'];
const STAMPS = {
  perfect: { jp: 'たいへん<br>よくできました', en: 'excellent work' },
  good: { jp: 'よく<br>できました', en: 'well done' },
  tried: { jp: 'がんばり<br>ました', en: 'good effort' },
};
export const PIX = `<svg class="pix" viewBox="0 0 11 6" shape-rendering="crispEdges" aria-hidden="true"><g fill="#d97757"><rect x="1" y="0" width="9" height="4"/><rect x="0" y="2" width="1" height="1"/><rect x="10" y="2" width="1" height="1"/><rect x="2" y="4" width="1" height="2"/><rect x="4" y="4" width="1" height="2"/><rect x="6" y="4" width="1" height="2"/><rect x="8" y="4" width="1" height="2"/></g><g class="eyes" fill="#141414"><rect x="3" y="1" width="1" height="2"/><rect x="7" y="1" width="1" height="2"/></g></svg>`;
export const CREDIT = `after <a href="https://x.com/ishuagra02/status/2107488996490166538" target="_blank" rel="noopener">“Claude's day off”</a> by Ishu Agrawal (<a href="https://x.com/ishuagra02" target="_blank" rel="noopener">@ishuagra02</a>), animated by Opus 5.5`;

function stampSVG(tier, big = false) {
  const s = STAMPS[tier] || STAMPS.good;
  return `<div class="stamp ${big ? 'big' : ''}" title="${s.en}"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" stroke-width="1.5"/>${[0, 72, 144, 216, 288].map(a => `<ellipse cx="50" cy="16" rx="5" ry="8" fill="currentColor" transform="rotate(${a} 50 50)" opacity=".9"/>`).join('')}</svg><span>${s.jp}</span></div>`;
}

const CREW = [['helper 1', '🍓', 'strawberry'], ['helper 2', '🌿', 'mint'], ['helper 3', '🧊', 'ice']];
function crewHTML() {
  const H = save.data.helpers || [];
  if (!H.some(h => h.days)) return '';
  return `<div class="crew-note"><div class="pg-kicker">Clawd's crew</div><ul>${CREW.map(([n, ic, sp], i) => {
    const h = H[i] || { tasks: 0, days: 0 };
    return `<li><span class="cn-ic">${ic}</span><span class="cn-name">${n} <i>${sp}</i></span><span class="cn-n">${h.tasks} task${h.tasks === 1 ? '' : 's'} · ${h.days} evening${h.days === 1 ? '' : 's'}</span></li>`;
  }).join('')}</ul></div>`;
}

function dateOf(def) {
  // the week of Mon Aug 3 – Fri Aug 7
  const d = new Date(2026, 7, 2 + def.day);
  return { m: d.getMonth() + 1, d: d.getDate(), wd: WEEKDAY_JP[d.getDay()], en: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) };
}

let chapters = [], onPlay = null, selected = null;

export const diary = {
  init(list, playFn) { chapters = list; onPlay = playFn; },
  hide() { ov.classList.add('hidden'); ov.innerHTML = ''; },

  unlocked(def) {
    if (G.dev.has('all')) return true;
    const i = chapters.indexOf(def);
    return i === 0 || !!save.day(chapters[i - 1].id)?.done;
  },
  nextDay() { return chapters.find(c => !save.day(c.id)?.done && diary.unlocked(c)) || chapters[0]; },

  showTitle() {
    G.mode = 'title';
    cam.play(); cam.drift = 1;
    if (!G.chapter) { clawd.workAnim = 'write'; clawd.faceOverride = -2.0; }
    const next = diary.nextDay(), started = Object.keys(save.data.days).length > 0;
    ov.className = 'title-view';
    ov.innerHTML = `
      <div class="cover">
        <div class="cv-kicker">なつやすみ えにっき <span>summer picture diary</span></div>
        <div class="cv-band">${PIX}<h1>Clawd's Day Off</h1><div class="cv-sub">five summer evenings on a balcony</div></div>
        <div class="cv-week">${chapters.map(c => { const e = save.day(c.id); return `<div class="cv-day ${e?.done ? 'done' : ''}" title="${esc(c.title)}"><b>${esc(c.short || c.jp)}</b><span>${esc(c.title)}</span>${e?.done ? stampSVG(e.stamp) : ''}</div>`; }).join('')}</div>
        <div class="cv-name"><span>なまえ</span> クロード · Clawd</div>
        <div class="cv-actions">
          <button class="go" id="go">${started ? `continue · ${esc(next.title)}` : 'start the week'}</button>
          ${started ? '<button class="ghost" id="book">open the diary</button>' : ''}
          <button class="ghost icon" id="cvgear" aria-label="settings">⚙</button>
        </div>
        <div class="credit">${CREDIT}</div>
      </div>`;
    $('#go', ov).onclick = () => { audio.init(); onPlay(next); };
    const b = $('#book', ov); if (b) b.onclick = () => { audio.init(); diary.showBook(next); };
    $('#cvgear', ov).onclick = () => diary.onSettings && diary.onSettings();
  },

  // the open diary: the week on the left, one day's page on the right
  showBook(focus, { fresh = false } = {}) {
    G.mode = 'diary';
    selected = focus || diary.nextDay();
    ov.className = 'book-view';
    ov.innerHTML = `<div class="book"><div class="pg left" id="pgL"></div><div class="pg right" id="pgR"></div></div>`;
    diary.renderWeek(); diary.renderPage(selected, fresh);
  },

  renderWeek() {
    const L = $('#pgL', ov); if (!L) return;
    const all = chapters.every(c => save.day(c.id)?.done);
    L.innerHTML = `<div class="pg-head"><span class="pg-kicker">なつやすみ えにっき</span><h2>${all ? 'Clawd\'s summer ✦' : 'Clawd\'s week'}</h2>${all ? '<p class="pg-done">five evenings, all written down. thank you for spending them here.</p>' : ''}</div>
      <ol class="week">${chapters.map((c, i) => {
        const e = save.day(c.id), dt = dateOf(c), open = diary.unlocked(c);
        return `<li><button class="wk ${selected === c ? 'sel' : ''} ${open ? '' : 'locked'}" data-i="${i}" ${open ? '' : 'disabled'}>
          <span class="wk-date">${dt.m}/${dt.d}<i>${dt.wd}</i></span>
          <span class="wk-title"><b>${esc(c.jp)}</b> ${esc(c.title)}</span>
          <span class="wk-state">${e?.done ? (e.photo ? `<img class="wk-thumb" src="${e.photo}" alt="">` : '') + stampSVG(e.stamp) : open ? `<span class="wk-next">${c === diary.nextDay() ? 'tonight' : 'open'}</span>` : '🔒'}</span></button></li>`;
      }).join('')}</ol>
      ${crewHTML()}
      <div class="pg-foot"><button class="ghost" id="cover">cover</button><span class="credit">${CREDIT}</span></div>`;
    $$('.wk', L).forEach(b => b.onclick = () => { selected = chapters[+b.dataset.i]; diary.renderWeek(); diary.renderPage(selected); audio.sfx('select'); });
    $('#cover', L).onclick = () => diary.showTitle();
  },

  renderPage(def, fresh = false) {
    const R = $('#pgR', ov); if (!R) return;
    const e = save.day(def.id), dt = dateOf(def), i = chapters.indexOf(def), nxt = chapters[i + 1];
    const text = e?.text || null;
    R.innerHTML = `
      <div class="dp-date"><span>${dt.m}がつ ${dt.d}にち ${dt.wd}ようび</span><span class="dp-wx">てんき: ${esc(def.weather || 'はれ')}</span></div>
      <div class="dp-pic">${e?.photo ? `<img src="${e.photo}" alt="${esc(def.title)} — the evening's photo">` : `<div class="dp-empty"><b>${esc(def.jp)}</b><span>${esc(def.blurb || '')}</span></div>`}
        ${e?.done ? stampSVG(e.stamp, true) : ''}</div>
      <div class="dp-text">${text ? `<p class="jp">${esc(text.jp || '')}</p>${(text.lines || []).map(l => `<p>${esc(l)}</p>`).join('')}` : `<p class="jp">${esc(def.jpPreview || '')}</p><p>${esc(def.blurb || '')}</p>`}</div>
      ${e?.stats ? `<div class="dp-stats">${esc(e.stats)}</div>` : ''}
      <div class="dp-actions">
        ${fresh && nxt && diary.unlocked(nxt) ? `<button class="go" id="next">next evening · ${esc(nxt.title)}</button>` : ''}
        <button class="${fresh && nxt ? 'ghost' : 'go'}" id="play">${e?.done ? 'play this evening again' : 'play this evening'}</button>
      </div>`;
    $('#play', R).onclick = () => onPlay(def);
    const n = $('#next', R); if (n) n.onclick = () => onPlay(nxt);
    if (fresh && e?.done) { const st = $('.dp-pic .stamp', R); st?.classList.add('slam'); setTimeout(() => audio.sfx('stamp'), 420); }
  },

  // grab the current frame as a small jpeg (call right after a render)
  capture(w = 640, h = 400) {
    try {
      const src = renderer.domElement, c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'), sa = src.width / src.height, da = w / h;
      let sw = src.width, sh = src.height, sx = 0, sy = 0;
      if (sa > da) { sw = sh * da; sx = (src.width - sw) / 2; } else { sh = sw / da; sy = (src.height - sh) / 2; }
      x.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
      return c.toDataURL('image/jpeg', .82);
    } catch (e) { console.warn('capture failed', e); return null; }
  },
};

audio.register('stamp', () => { audio.noise(.12, 'lowpass', 500, .5); audio.tone(110, .15, 'sine', .2, 70); });

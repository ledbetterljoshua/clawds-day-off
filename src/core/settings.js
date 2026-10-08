// Settings card: volumes, graphics, motion, and erasing the diary (with an in-page confirm).
import { G } from './state.js';
import { $, esc } from './util.js';
import { audio } from './audio.js';
import { save } from './save.js';
import { post } from './post.js';
import { renderer } from './gfx.js';

const el = document.createElement('div');
el.id = 'settings'; el.className = 'hidden'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'settings');
document.body.appendChild(el);

export function applyGraphics(q) {
  if ('quality' in post) post.quality = q;
  post.enabled = q !== 'low' || !('quality' in post);
  renderer.shadowMap.enabled = q !== 'low';
  renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'low' ? 1.25 : 2));
}

export const settings = {
  get reduceMotion() { return !!save.setting('reduceMotion') || matchMedia('(prefers-reduced-motion: reduce)').matches; },
  init() {
    const q = save.setting('quality'); if (q) applyGraphics(q);
    document.documentElement.dataset.calm = save.setting('reduceMotion') ? '1' : '';
  },
  open(onClose) {
    const v = audio.volumes, q = save.setting('quality') || ('quality' in post ? post.quality : 'high');
    el.innerHTML = `<div class="st-card">
      <div class="st-head"><b>settings</b><button class="st-x" id="stx" aria-label="close settings">✕</button></div>
      ${['music', 'sfx', 'amb'].map(k => `<label class="st-row"><span>${{ music: 'music', sfx: 'sound effects', amb: 'cicadas & breeze' }[k]}</span><input type="range" id="st-${k}" min="0" max="1" step=".05" value="${v[k]}"></label>`).join('')}
      <div class="st-row"><span>graphics</span><span class="st-seg"><button data-q="high" class="${q !== 'low' ? 'on' : ''}">pretty</button><button data-q="low" class="${q === 'low' ? 'on' : ''}">light</button></span></div>
      <label class="st-row"><span>calmer camera</span><input type="checkbox" id="st-motion" ${save.setting('reduceMotion') ? 'checked' : ''}></label>
      <div class="st-row st-danger"><span>erase the diary</span><button id="st-erase" class="ghost">erase…</button></div>
      <div class="st-confirm hidden" id="st-confirm">Erase all five evenings, photos and wishes? <button id="st-yes" class="ghost">erase</button><button id="st-no" class="ghost">keep</button></div>
    </div>`;
    el.classList.remove('hidden'); G.paused = true;
    const close = () => { el.classList.add('hidden'); G.paused = false; onClose && onClose(); };
    $('#stx', el).onclick = close;
    el.onclick = e => { if (e.target === el) close(); };
    ['music', 'sfx', 'amb'].forEach(k => $(`#st-${k}`, el).oninput = e => { audio.setVolumes({ [k]: +e.target.value }); save.setting('volumes', audio.volumes); });
    el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      save.setting('quality', b.dataset.q); applyGraphics(b.dataset.q);
      el.querySelectorAll('[data-q]').forEach(x => x.classList.toggle('on', x === b));
    });
    $('#st-motion', el).onchange = e => { save.setting('reduceMotion', e.target.checked); document.documentElement.dataset.calm = e.target.checked ? '1' : ''; };
    $('#st-erase', el).onclick = () => $('#st-confirm', el).classList.remove('hidden');
    $('#st-no', el).onclick = () => $('#st-confirm', el).classList.add('hidden');
    $('#st-yes', el).onclick = () => { save.reset(); location.reload(); };
    setTimeout(() => $('#st-music', el).focus(), 30);
    el.onkeydown = e => { if (e.key === 'Escape') close(); e.stopPropagation(); };
  },
};

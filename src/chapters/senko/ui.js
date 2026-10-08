// Chapter-owned DOM: the soft stage names, the sparklers-left mark, and the credits page.
import { esc } from '../../core/util.js';
import { audio } from '../../core/audio.js';

const CSS = `
#senko-stage{position:fixed;left:50%;bottom:calc(max(14px,env(safe-area-inset-bottom)) + 104px);transform:translateX(-50%);z-index:6;text-align:center;pointer-events:none;color:#fff;opacity:0;transition:opacity 1.4s ease;text-shadow:0 2px 14px rgba(0,0,0,.7);width:min(560px,92vw)}
#senko-stage.on{opacity:1}
#senko-stage b{display:block;font-family:var(--hand);font-weight:600;font-size:clamp(28px,4.4vw,40px);letter-spacing:.12em;color:#fff4e2}
#senko-stage span{display:block;font-family:var(--mono);font-size:12px;letter-spacing:.06em;color:#f2d9b6;margin-top:2px}
#senko-stage i{display:block;font-style:normal;font-family:var(--hand);font-size:14px;color:#e9dcc6;margin-top:10px;opacity:0;transition:opacity 2s ease 1.2s}
#senko-stage.on i.on{opacity:.9}
#senko-left{position:fixed;top:max(14px,env(safe-area-inset-top));left:14px;z-index:5;display:flex;align-items:center;gap:10px;padding:9px 13px;font-size:12px;color:var(--dim);transition:opacity .8s}
#senko-left b{font-family:var(--hand);font-weight:600;font-size:15px;color:var(--ink)}
#senko-left .sk{display:flex;gap:6px;align-items:flex-end;height:22px}
#senko-left .sk i{width:3px;height:22px;border-radius:2px;background:linear-gradient(#f29ab8,#b48be0 45%,#f2c14e 80%,#3d3434 80%);transition:opacity .6s,height .6s}
#senko-left .sk i.used{opacity:.22;height:14px}
#senko-credits{position:fixed;inset:0;z-index:15;display:flex;align-items:center;justify-content:flex-end;padding:24px max(16px,6vw);pointer-events:none;opacity:0;transition:opacity 1.8s ease;background:linear-gradient(90deg,rgba(6,8,22,0) 30%,rgba(6,8,22,.45))}
#senko-credits.on{opacity:1}
#senko-credits .page{pointer-events:auto;width:min(430px,100%);max-height:calc(100% - 8px);overflow:auto;background:var(--paper);color:var(--paper-ink);border-radius:6px 14px 14px 6px;box-shadow:-6px 0 0 #d6cfbf inset,0 24px 60px rgba(0,0,0,.45);padding:26px 28px 22px;display:flex;flex-direction:column;gap:12px;position:relative}
#senko-credits .ln{opacity:0;transform:translateY(6px);transition:opacity 1.2s ease,transform 1.2s ease}
#senko-credits .ln.on{opacity:1;transform:none}
#senko-credits .jp{font-family:var(--hand);font-weight:600;font-size:26px;letter-spacing:.04em}
#senko-credits .gloss{font-family:var(--hand);font-size:13px;color:var(--pencil);margin-top:-8px}
#senko-credits .title{font-family:var(--round);font-weight:800;font-size:30px;line-height:1.05;margin-top:6px;text-wrap:balance}
#senko-credits .sub{font-family:var(--hand);font-size:14px;color:var(--pencil);margin-top:-8px}
#senko-credits .role{display:grid;grid-template-columns:92px minmax(0,1fr);gap:2px 12px;border-top:1.5px solid var(--rule);padding-top:10px}
#senko-credits .role span{font-family:var(--mono);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--pencil);padding-top:3px}
#senko-credits .role b{font-family:var(--hand);font-weight:600;font-size:15px;line-height:1.45}
#senko-credits .role i{grid-column:2;font-style:normal;font-family:var(--hand);font-size:13px;color:var(--pencil)}
#senko-credits a{color:inherit}
#senko-credits .thanks{font-family:var(--hand);font-size:16px;border-top:1.5px solid var(--rule);padding-top:12px}
#senko-credits .small{font-size:10.5px;color:var(--pencil)}
#senko-credits .act{display:flex;justify-content:flex-start;padding-top:4px}
#senko-credits .hanko{position:absolute;right:20px;top:18px;width:74px;height:74px;border-radius:50%;border:3px solid var(--stamp);color:var(--stamp);display:grid;place-items:center;font-family:var(--hand);font-weight:600;font-size:12px;line-height:1.15;text-align:center;transform:rotate(-12deg);mix-blend-mode:multiply;opacity:0;transition:opacity .4s ease,transform .5s cubic-bezier(.2,1.6,.4,1)}
#senko-credits .hanko.on{opacity:.9;transform:rotate(-12deg) scale(1)}
#senko-credits .hanko:not(.on){transform:rotate(-30deg) scale(2)}
@media (max-width:760px){#senko-credits{justify-content:center;align-items:flex-end;padding:16px;background:linear-gradient(180deg,rgba(6,8,22,0) 20%,rgba(6,8,22,.5))}#senko-stage{bottom:calc(max(14px,env(safe-area-inset-bottom)) + 120px)}}
@media (prefers-reduced-motion:reduce){#senko-credits .ln{transition:none}}
`;

let style = null, stageEl = null, leftEl = null, credEl = null, stageTimer = 0;

export const ui = {
  mount() {
    ui.unmount();
    style = document.createElement('style'); style.id = 'senko-css'; style.textContent = CSS; document.head.appendChild(style);
    stageEl = document.createElement('div'); stageEl.id = 'senko-stage'; document.body.appendChild(stageEl);
    leftEl = document.createElement('div'); leftEl.id = 'senko-left'; leftEl.className = 'panel hidden'; document.body.appendChild(leftEl);
  },
  unmount() {
    clearTimeout(stageTimer);
    for (const el of [style, stageEl, leftEl, credEl]) el?.remove();
    style = stageEl = leftEl = credEl = null;
  },

  stage(st, note = '') {
    if (!stageEl) return;
    clearTimeout(stageTimer);
    stageEl.innerHTML = `<b>${esc(st.jp)}</b><span>${esc(st.romaji)} · ${esc(st.en)}</span>${note ? `<i>${esc(note)}</i>` : ''}`;
    stageEl.classList.remove('on'); void stageEl.offsetWidth; stageEl.classList.add('on');
    if (note) requestAnimationFrame(() => stageEl.querySelector('i')?.classList.add('on'));
    stageTimer = setTimeout(() => stageEl && stageEl.classList.remove('on'), note ? 6500 : 3600);
  },
  clearStage() { clearTimeout(stageTimer); stageEl?.classList.remove('on'); },

  left(used, total = 3) {
    if (!leftEl) return;
    leftEl.innerHTML = `<b>線香花火</b><div class="sk" aria-label="${total - used} of ${total} sparklers left">${Array.from({ length: total }, (_, i) => `<i class="${i < used ? 'used' : ''}"></i>`).join('')}</div>`;
  },
  showLeft(v) { leftEl?.classList.toggle('hidden', !v); },

  // the closing page; resolves when the player turns to the diary (or after a long while)
  credits() {
    return new Promise(resolve => {
      credEl = document.createElement('div'); credEl.id = 'senko-credits';
      credEl.innerHTML = `<div class="page" role="dialog" aria-label="credits">
        <div class="hanko" aria-hidden="true">おつかれ<br>さまでした</div>
        <div class="ln jp">おつかれさまでした。</div>
        <div class="ln gloss">otsukaresama deshita · what you say to someone at the end of a long day's work</div>
        <div class="ln title">Clawd's Day Off</div>
        <div class="ln sub">five summer evenings on a balcony</div>
        <div class="ln role"><span>original film</span><b><a href="https://x.com/ishuagra02/status/2107488996490166538" target="_blank" rel="noopener">“Claude's day off”</a> by Ishu Agrawal (<a href="https://x.com/ishuagra02" target="_blank" rel="noopener">@ishuagra02</a>)</b><i>animated by Opus 5.5</i></div>
        <div class="ln role"><span>game</span><b>Joshua Ledbetter</b><i>built with Claude</i></div>
        <div class="ln role"><span>with</span><b>clawd · helper 1 🍓 · helper 2 🌿 · helper 3 🧊</b><i>and the furin, the lanterns, and the moon</i></div>
        <div class="ln thanks">Thank you for spending the week with them.</div>
        <div class="ln small">an unofficial fan project · made in code</div>
        <div class="ln act"><button class="go" id="senko-cont">to the diary ›</button></div>
      </div>`;
      document.body.appendChild(credEl);
      requestAnimationFrame(() => credEl.classList.add('on'));
      const lines = [...credEl.querySelectorAll('.ln')];
      const timers = lines.map((l, i) => setTimeout(() => l.classList.add('on'), 900 + i * 850));
      timers.push(setTimeout(() => { credEl?.querySelector('.hanko')?.classList.add('on'); audio.sfx('stamp'); }, 900 + lines.length * 850 + 300));
      let done = false;
      const finish = () => {
        if (done) return; done = true;
        timers.forEach(clearTimeout);
        const el = credEl; if (!el) { resolve(); return; }
        el.classList.remove('on');
        setTimeout(() => { el.remove(); if (credEl === el) credEl = null; resolve(); }, 900);
      };
      credEl.querySelector('#senko-cont').onclick = finish;
      credEl.addEventListener('pointerdown', e => e.stopPropagation());
      timers.push(setTimeout(finish, 45000));
    });
  },
};

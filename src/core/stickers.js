// シール: a sticker sheet in the diary. Anything can award one: award(id) or emit('sticker', id).
import { on } from './state.js';
import { save } from './save.js';
import { audio } from './audio.js';
import { esc } from './util.js';

export const STICKERS = [
  { id: 'delegate', g: '🤝', name: 'first delegation', hint: 'hand a job to a helper' },
  { id: 'parallel', g: '🔀', name: 'three at once', hint: 'keep all three helpers working at the same time' },
  { id: 'diy', g: '✋', name: 'by hand', hint: 'finish an evening without delegating anything' },
  { id: 'manager', g: '📋', name: 'pure orchestration', hint: 'finish an evening without doing a single task yourself' },
  { id: 'perfect', g: '🌸', name: 'たいへんよくできました', hint: 'earn the top stamp' },
  { id: 'nightowl', g: '🌙', name: 'night owl', hint: 'let the night fall before you finish' },
  { id: 'pour', g: '🍧', name: 'perfect pour', hint: 'pour a syrup inside the band' },
  { id: 'clawdfw', g: '✦', name: 'a firework like me', hint: 'stay for the fireworks on monday' },
  { id: 'polaroid', g: '📷', name: 'photographer', hint: 'take your own photo (P or 📷)' },
  { id: 'effort', g: '🔥', name: 'effort: max', hint: 'try a certain slash command' },
  { id: 'train', g: '🚃', name: 'gatan goton', hint: 'make a train go by (terminal)' },
  { id: 'hanabi', g: '🎆', name: 'たまや〜', hint: 'launch a firework from the terminal' },
  { id: 'crabsay', g: '🦀', name: 'crabsay', hint: 'make clawd say something (terminal)' },
  { id: 'golden', g: '🐙', name: 'sixteen golden', hint: 'turn every takoyaki perfectly' },
  { id: 'basket', g: '🧺', name: 'ありがとう 3F', hint: 'send takoyaki upstairs' },
  { id: 'pink', g: '🩷', name: 'the pink noodle', hint: 'catch the one pink noodle' },
  { id: 'wish', g: '🎋', name: 'a wish', hint: 'hang a wish on the bamboo' },
  { id: 'chirigiku', g: '🎇', name: '散り菊', hint: 'keep a sparkler alive to the very end' },
  { id: 'week', g: '🏅', name: 'summer, written down', hint: 'finish all five evenings' },
];

let toast = null;
export function setStickerToast(fn) { toast = fn; }

export function award(id) {
  const s = STICKERS.find(x => x.id === id); if (!s) return false;
  const got = save.data.stickers || (save.data.stickers = {});
  if (got[id]) return false;
  got[id] = Date.now(); save.write();
  audio.sfx('sticker');
  toast && toast(`<span class="stk-toast"><b>${s.g}</b> シール! ${esc(s.name)}</span>`);
  return true;
}
on('sticker', award);

export function stickersHTML() {
  const got = save.data.stickers || {};
  const n = STICKERS.filter(s => got[s.id]).length;
  return `<div class="stickers"><div class="pg-kicker">シール · stickers <span>${n}/${STICKERS.length}</span></div><ul>${STICKERS.map(s => got[s.id]
    ? `<li class="stk on" title="${esc(s.name)}"><b>${s.g}</b></li>`
    : `<li class="stk" title="${esc(s.hint)}"><b>?</b></li>`).join('')}</ul></div>`;
}

audio.register('sticker', () => { audio.tone(1046, .12, 'triangle', .12); audio.tone(1568, .25, 'triangle', .1, null, { delay: .08 }); audio.noise(.05, 'highpass', 4000, .08); });

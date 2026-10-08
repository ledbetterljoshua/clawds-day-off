// Tweens and sleeps run on the game clock (so they respect G.speed and pause with the loop).
const list = [];

export function tween(dur, fn, done, tag) {
  const T = { t: 0, dur: Math.max(1e-4, dur), fn, done, tag, dead: false };
  list.push(T);
  return T;
}

export const sleep = (s, tag) => new Promise(r => tween(s, () => {}, r, tag));

// resolves when pred() is true (checked every frame), or after `timeout` seconds
export function until(pred, timeout = 1e9, tag) {
  return new Promise(r => {
    const T = tween(timeout, () => { if (pred()) { T.dead = true; r(true); } }, () => r(false), tag);
  });
}

export function updateTweens(dt) {
  for (let i = list.length - 1; i >= 0; i--) {
    const T = list[i];
    if (T.dead) { list.splice(i, 1); continue; }
    T.t += dt;
    const e = Math.min(1, T.t / T.dur);
    try { T.fn(e, T); } catch (err) { console.error(err); T.dead = true; continue; }
    if (T.dead) { list.splice(i, 1); continue; }
    if (e >= 1) { list.splice(i, 1); try { T.done && T.done(); } catch (err) { console.error(err); } }
  }
}

// Killed sleeps never resolve; whatever awaited them is simply abandoned.
export function killTweens(tag) { for (const T of list) if (T.tag === tag) T.dead = true; }
